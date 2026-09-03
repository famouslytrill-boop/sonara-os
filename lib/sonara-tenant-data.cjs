"use strict";

// Tenant-scoped PostgREST query construction.
//
// Why this exists (CRIT-3 in docs/audits/2026-07-27-ENGINEERING_AUDIT.md):
//
// Every data path in this application uses the Supabase service-role key, which
// bypasses Row Level Security entirely. The ~1,600 RLS policies in the schema
// protect direct anon/authenticated Data API access, but they do nothing for
// application traffic. The actual multi-tenant boundary is a developer
// remembering to append `&organization_id=eq.<id>` to each query.
//
// An audit of all 69 PostgREST call sites on 2026-07-27 found no missing scope.
// **Re-audited 3 September 2026, at 126 call sites, and the finding still
// holds.** Reads against a tenant-scoped table carry the filter, inserts carry
// the column in the body, and every deliberately unscoped read has a reason
// that survives being written down:
//
//   business_employee_invites  filtered on token_hash. The token IS the
//                              credential, and the invitee does not know their
//                              organization yet -- the invite is what tells
//                              them.
//   business_memberships       filtered on user_id. This is the query that
//                              DETERMINES which organization you are in, so it
//                              cannot be filtered by one.
//   support_requests           genuinely global, behind requireAdmin at
//                              /admin/support. The founder support queue.
//
// The two unscoped PATCHes are the same shape: each targets a row the request
// already fetched and proved, by token or by admin gate.
//
// The design inverts the default. You cannot omit the tenant scope by
// forgetting it -- you must either supply `organizationId`, or consciously
// declare `scope: "global"` with a written reason that shows up in review.
//
// ## What this module does NOT do, said plainly
//
// It is **available**, not enforced. As of 3 September 2026 it is called from
// **one file and five call sites**, against 126 PostgREST call sites in the
// runtime. Six route files have been written since it was added and none of
// them uses it.
//
// The header above used to stop at "a guard against the next query somebody
// writes", which reads as though new queries go through it. They do not. The
// boundary on the other 121 sites is still a developer remembering to append
// `&organization_id=eq.<id>`, exactly as it was before this file existed --
// re-verified by hand today, and by hand is the only way it has ever been
// verified.
//
// `tests/tenant-isolation.test.js` proves this module rejects an unscoped
// query. That is a true statement about this module and not a statement about
// the application, and the test now says so and pins the adoption count, so
// nobody reads a runtime-wide guarantee into a green tick again. The count is a
// ratchet: migrating a file to this module is meant to raise it.

const TENANT_COLUMN = "organization_id";

class TenantScopeError extends Error {
  constructor(message) {
    super(message);
    this.name = "TenantScopeError";
  }
}

function encode(value) {
  return encodeURIComponent(String(value));
}

// Reject anything that could smuggle a second PostgREST parameter. Values are
// URL-encoded anyway, so this is belt and braces -- but a caller passing an
// unencoded object or array would otherwise stringify into something surprising.
function assertScalar(name, value) {
  const type = typeof value;
  if (value === null || value === undefined) {
    throw new TenantScopeError(`${name} must not be null or undefined`);
  }
  if (type !== "string" && type !== "number" && type !== "boolean") {
    throw new TenantScopeError(`${name} must be a string, number, or boolean (received ${type})`);
  }
  if (type === "string" && value.trim() === "") {
    throw new TenantScopeError(`${name} must not be empty`);
  }
}

/**
 * Build a PostgREST query path with a mandatory tenant scope.
 *
 * @param {string} table                Table name, e.g. "launch_checklist_items".
 * @param {object} options
 * @param {string} [options.organizationId]  Tenant to scope to. Required unless scope is "global".
 * @param {"tenant"|"global"} [options.scope="tenant"]
 * @param {string} [options.globalReason]    Required when scope is "global". Recorded so the
 *                                           decision is visible in review rather than implicit.
 * @param {string} [options.select]
 * @param {Record<string, string|number|boolean>} [options.eq]  Additional equality filters.
 * @param {string} [options.order]
 * @param {number} [options.limit]
 * @returns {string} Path beginning with "/rest/v1/".
 */
function buildTenantQuery(table, options = {}) {
  if (!table || !/^[a-z0-9_]+$/.test(table)) {
    throw new TenantScopeError(`table must be a lowercase identifier (received ${JSON.stringify(table)})`);
  }

  const scope = options.scope || "tenant";

  if (scope !== "tenant" && scope !== "global") {
    throw new TenantScopeError(`scope must be "tenant" or "global" (received ${JSON.stringify(scope)})`);
  }

  if (scope === "global") {
    // Deliberately unscoped reads are legitimate -- shared catalogs, lookups by
    // a secret token, founder operations across every tenant. They just must be
    // stated, not arrived at by omission.
    if (!options.globalReason || String(options.globalReason).trim().length < 10) {
      throw new TenantScopeError(
        `a global-scope query on "${table}" must supply globalReason explaining why it crosses tenants`
      );
    }
  } else {
    if (!options.organizationId) {
      throw new TenantScopeError(
        `query on "${table}" is tenant-scoped but no organizationId was supplied. ` +
          `Pass organizationId, or pass scope: "global" with a globalReason if crossing tenants is intended.`
      );
    }
    assertScalar("organizationId", options.organizationId);
  }

  const parameters = [];

  if (options.select) parameters.push(`select=${encode(options.select)}`);
  if (scope === "tenant") parameters.push(`${TENANT_COLUMN}=eq.${encode(options.organizationId)}`);

  for (const [column, value] of Object.entries(options.eq || {})) {
    if (!/^[a-z0-9_]+$/.test(column)) {
      throw new TenantScopeError(`filter column must be a lowercase identifier (received ${JSON.stringify(column)})`);
    }
    if (column === TENANT_COLUMN) {
      // Otherwise a caller could pass organizationId AND an eq filter on the
      // same column, and PostgREST would AND them -- surprising, and a way to
      // accidentally widen or contradict the scope.
      throw new TenantScopeError(`do not filter on ${TENANT_COLUMN} directly; use the organizationId option`);
    }
    assertScalar(`eq.${column}`, value);
    parameters.push(`${column}=eq.${encode(value)}`);
  }

  if (options.order) parameters.push(`order=${encode(options.order)}`);

  if (options.limit !== undefined) {
    const limit = Number(options.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new TenantScopeError(`limit must be an integer between 1 and 1000 (received ${options.limit})`);
    }
    parameters.push(`limit=${limit}`);
  }

  return `/rest/v1/${table}${parameters.length ? `?${parameters.join("&")}` : ""}`;
}

/**
 * Convenience wrapper: build the query, then fetch it with service-role headers.
 * Returns { ok, status, rows } and never throws on network failure.
 */
async function fetchTenantRows(table, options, { getSupabaseServerConfig }) {
  const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : { ok: false };
  if (!config?.ok) return { ok: false, status: 503, rows: [] };

  // buildTenantQuery throws on a missing scope; let that propagate. A
  // programming error here must be loud, not silently degraded to an empty
  // result that looks like "this tenant has no rows".
  const path = buildTenantQuery(table, options);

  const response = await fetch(`${config.url}${path}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    }
  }).catch(() => undefined);

  if (!response?.ok) return { ok: false, status: response?.status || 0, rows: [] };
  return { ok: true, status: response.status, rows: await response.json().catch(() => []) };
}

module.exports = {
  buildTenantQuery,
  fetchTenantRows,
  TenantScopeError,
  TENANT_COLUMN
};
