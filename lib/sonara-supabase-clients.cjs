"use strict";

// Two ways to talk to Supabase, and a clear rule for which to use.
//
// CRIT-3 item (2). Today every query in this application carries the
// service-role key, which bypasses Row Level Security. That makes the ~1,600
// RLS policies in the schema decoration as far as application traffic is
// concerned: they protect direct Data API access and nothing else.
//
// A user-scoped client forwards the caller's own access token instead. Postgres
// then evaluates the policies with auth.uid() set to that user, so a query that
// asks for another organization's rows comes back empty no matter what the
// application code intended. That is a boundary the application cannot talk its
// way past -- unlike lib/sonara-tenant-guard.cjs, which can only check that a
// query names *an* organization, not the right one.
//
// ---------------------------------------------------------------------------
// Why nothing is switched over yet
// ---------------------------------------------------------------------------
//
// Measuring the schema first found the prerequisite: of the 206 tenant-scoped
// tables, 184 had no policy a signed-in user could read through. Switching a
// read to a user token against one of those returns zero rows -- the screen
// goes blank. supabase/migrations/20260728120000_member_read_policies.sql adds
// the missing policies for the tables the application actually reads, but a
// migration that has not been applied to production yet cannot be relied on.
//
// So this module ships the capability and the checks, and
// `pnpm run report:user-scoped` says which tables are ready. Read paths move
// over once the migration has landed and that report says they can. Switching
// first and finding out afterwards is how you take a workspace down.

const REQUIRED_ANON_KEY_ENV = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"];

class SupabaseClientError extends Error {
  constructor(message) {
    super(message);
    this.name = "SupabaseClientError";
  }
}

/**
 * Headers for a query that runs with full database rights, ignoring RLS.
 *
 * Correct for: webhook processing, founder/admin operations, anything running
 * without a signed-in caller, and writes whose scope is established by the
 * server rather than by the requester.
 */
function serviceRoleHeaders(config, options = {}) {
  if (!config?.serviceRoleKey) throw new SupabaseClientError("service-role headers requested without a service-role key");
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json"
  };
  if (options.prefer) headers.Prefer = options.prefer;
  return headers;
}

/**
 * Headers for a query that runs as the signed-in caller, with RLS enforced.
 *
 * Correct for: reading anything the caller owns. The apikey stays the publishable
 * anon key -- it identifies the project, not the caller -- while the bearer token
 * is the caller's own. Sending the service-role key as apikey here would hand
 * PostgREST a reason to ignore policies again and quietly undo the point.
 */
function userScopedHeaders(config, accessToken, options = {}) {
  const token = String(accessToken || "").trim();
  if (!token) throw new SupabaseClientError("user-scoped headers requested without a caller access token");
  if (!config?.anonKey) {
    throw new SupabaseClientError(
      `user-scoped headers need a publishable key; set one of ${REQUIRED_ANON_KEY_ENV.join(" or ")}`
    );
  }
  if (token === config.serviceRoleKey) {
    // Passing the service-role key as the caller's token would look like a
    // user-scoped read and behave like an unrestricted one.
    throw new SupabaseClientError("the service-role key must never be used as a caller access token");
  }
  const headers = {
    apikey: config.anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  if (options.prefer) headers.Prefer = options.prefer;
  return headers;
}

/**
 * Which client a request should use.
 *
 * The rule is deliberately narrow: a read on behalf of a signed-in caller can
 * use their token, and only once the table is known to be readable that way.
 * Everything else stays on service-role, because a wrong answer here is either
 * a blank screen or a bypassed policy.
 */
function chooseClient({ method = "GET", table, accessToken, readyTables }) {
  const verb = String(method).toUpperCase();
  if (verb !== "GET" && verb !== "HEAD") return { client: "service_role", reason: "writes establish their own scope server-side" };
  if (!accessToken) return { client: "service_role", reason: "no signed-in caller to run as" };
  if (!table) return { client: "service_role", reason: "no table resolved" };
  if (!readyTables || !readyTables.has(table)) {
    return { client: "service_role", reason: `${table} has no member-readable policy yet` };
  }
  return { client: "user", reason: "signed-in read of a member-readable table" };
}

module.exports = {
  serviceRoleHeaders,
  userScopedHeaders,
  chooseClient,
  SupabaseClientError,
  REQUIRED_ANON_KEY_ENV
};
