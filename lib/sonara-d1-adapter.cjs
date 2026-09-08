"use strict";

// Cloudflare D1 -- a serverless SQL database at the edge, for derived data only.
//
// ## The rule this module exists to enforce
//
// **Supabase is the system of record. D1 may not hold anything Supabase owns.**
//
// That is not a preference. This product's entire tenant boundary is
// `organization_id` filtering against Supabase, because the service-role key
// bypasses row-level security -- so a customer record living in a second
// database is a customer record outside the only boundary there is. And two
// stores holding the same row is the split-brain that ends with an invoice
// total that depends on which one you asked.
//
// A second database is still worth having for the things Supabase is a poor fit
// for: counters read on every request, an edge-local cache, a rollup somebody
// recomputes. All of those are *derived* -- losing the whole database costs a
// recomputation and nothing else. That is the line, and `assertDerivedOnly`
// below makes it a refusal rather than a convention.
//
// The check is deliberately blunt: any identifier in the SQL that matches a
// table this project's migrations create -- tenant-scoped or global -- is
// refused. It over-refuses, and that is the direction to fail in. A D1 table
// called `invoices` is exactly the mistake worth catching, and a column that
// happens to share a table's name is a rename away from being allowed.
//
// ## What this is not
//
// Not a licence question -- no Cloudflare code ships here. It is a price:
// `CLAUDE.md` says a hosted service with a free tier is a price, not a licence,
// and a shipped feature resting on one stops working when the tier changes. So
// this obeys the same four rules as every other adapter: off by default, never
// a dependency, never renders its configuration, and validates anything that
// becomes part of a request.

const base = require("./sonara-service-adapter.cjs");
const { TENANT_SCOPED_TABLES, GLOBAL_TABLES } = require("./sonara-tenant-scoped-tables.cjs");

const LABEL = "Cloudflare D1";
const PREFIX = "SONARA_D1";

const ENV_KEYS = base.envKeysFor(PREFIX, ["account", "database", "token"]);

const ACCOUNT_PATTERN = /^[0-9a-f]{32}$/i;
// A D1 database id is a UUID. Same reasoning as the account id in the Workers
// AI adapter: it lands in the request path, so it is pinned to its real shape
// rather than merely checked for slashes.
const DATABASE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Both sets, not just the tenant-scoped one. A global table is still a table
// Supabase owns; `plans` or `countries` living in two places is the same
// split-brain with lower stakes, and the rule is easier to hold when it has no
// exceptions to remember.
const RESERVED_TABLE_NAMES = new Set([...TENANT_SCOPED_TABLES, ...GLOBAL_TABLES]);

function getD1Readiness(options = {}) {
  const readiness = base.readinessFor({
    label: LABEL,
    prefix: PREFIX,
    required: ["account", "database"],
    secrets: ["token"],
    ...options
  });

  if (readiness.status !== "configured") return readiness;

  if (!ACCOUNT_PATTERN.test(readiness.account)) {
    return { ok: false, enabled: true, status: "setup_required", keys: ENV_KEYS, host: readiness.host, detail: `${ENV_KEYS.account} is not a Cloudflare account id (32 hex characters).` };
  }

  if (!DATABASE_PATTERN.test(readiness.database)) {
    return { ok: false, enabled: true, status: "setup_required", keys: ENV_KEYS, host: readiness.host, detail: `${ENV_KEYS.database} is not a D1 database id (a UUID).` };
  }

  return readiness;
}

/**
 * Why a statement may not run against D1.
 *
 * Returns a reason string, or "" when the statement is allowed. Separated from
 * `query` so the rule can be tested directly and read on its own, rather than
 * only through a call that also needs a configured account.
 */
function derivedOnlyViolation(sql) {
  if (typeof sql !== "string" || !sql.trim()) return "A query needs SQL.";

  // Comments first: they are how a reserved name gets past a scan that reads
  // the statement as written, and D1 has no need for them from here.
  if (/--|\/\*/.test(sql)) return "SQL comments are not accepted here.";

  // One statement per call. Not a style rule -- a batch is how a second,
  // unscanned statement rides along behind an allowed one.
  if (sql.replace(/;\s*$/, "").includes(";")) return "Only one statement per call.";

  // Identifiers as written. This does not parse SQL and does not claim to: it
  // asks whether any word in the statement is the name of a table this
  // project's migrations create, which is the question that matters.
  const identifiers = sql.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  for (const identifier of identifiers) {
    const name = identifier.toLowerCase();
    if (RESERVED_TABLE_NAMES.has(name)) {
      return `"${name}" is a table Supabase owns. D1 holds derived data only -- see the header of lib/sonara-d1-adapter.cjs.`;
    }
  }

  return "";
}

/**
 * Run one parameterised statement against D1.
 *
 * `params` is required to be an array even when empty, so that "there are no
 * parameters" and "I forgot to pass the parameters" are different calls. Values
 * belong in `params`, never interpolated into `sql`.
 *
 * It carries no default on purpose, and the test that says so caught this:
 * written as `params = []`, a caller who omitted the argument got an empty
 * array and sailed past the very check written to catch them. A guard that
 * cannot fire for its own case is the defect `CLAUDE.md` is about, so the
 * default is gone and `query(sql)` is now an error rather than a silent
 * no-parameter call.
 *
 * Returns { ok: true, rows } or { ok: false, code, detail } and never throws.
 */
async function query(sql, params, { readiness = getD1Readiness(), fetchImpl = fetch } = {}) {
  if (!Array.isArray(params)) {
    return { ok: false, code: "invalid_params", detail: "params must be an array; values belong in params rather than in the SQL." };
  }

  const violation = derivedOnlyViolation(sql);
  if (violation) return { ok: false, code: "refused", detail: violation };

  if (!ACCOUNT_PATTERN.test(String(readiness.account || "")) || !DATABASE_PATTERN.test(String(readiness.database || ""))) {
    return { ok: false, code: "setup_required", detail: `${ENV_KEYS.account} or ${ENV_KEYS.database} is not a usable value.` };
  }

  const called = await base.postJson(
    readiness,
    `/accounts/${readiness.account}/d1/database/${readiness.database}/query`,
    { sql, params },
    { fetchImpl, headers: readiness.token ? { Authorization: `Bearer ${readiness.token}` } : {} }
  );
  if (!called.ok) return called;

  if (called.data?.success === false) {
    const first = Array.isArray(called.data.errors) ? called.data.errors[0] : undefined;
    return { ok: false, code: "query_failed", detail: first?.message ? String(first.message).slice(0, 200) : "D1 refused the statement." };
  }

  // D1 answers with an array of results, one per statement. One statement is
  // enforced above, so the first entry is the answer -- but an absent entry is
  // carried as a failure rather than read as an empty result set. A failed read
  // rendered as "you have no rows" is the shape this repository has been bitten
  // by before.
  const first = Array.isArray(called.data?.result) ? called.data.result[0] : undefined;
  if (!first || !Array.isArray(first.results)) {
    return { ok: false, code: "unreadable_response", detail: "D1 answered without a result set." };
  }

  return { ok: true, rows: first.results };
}

module.exports = { ENV_KEYS, getD1Readiness, query, derivedOnlyViolation, RESERVED_TABLE_NAMES, ACCOUNT_PATTERN, DATABASE_PATTERN };
