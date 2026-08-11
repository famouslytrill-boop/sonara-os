"use strict";

// Refuse a Supabase request that crosses tenants without saying so.
//
// Why this is not solved by RLS (CRIT-3 in the 2026-07-27 audit): every data
// path in this application uses the service-role key, which bypasses Row Level
// Security entirely. The ~1,600 RLS policies in the schema protect direct
// anon/authenticated Data API access and do nothing for application traffic.
// The real multi-tenant boundary is a developer remembering to append
// `&organization_id=eq.<id>` to each query.
//
// lib/sonara-tenant-data.cjs offered a safe way to build those queries, but
// nothing forced anybody to use it, and 75 call sites did not. Rewriting all 75
// would have been a large diff through codegen-managed files, and it still
// would not have stopped the 76th.
//
// So the check lives at the only place every one of them passes through: the
// fetch to the Supabase REST API. install() wraps global fetch, inspects
// anything addressed to /rest/v1/, and throws when a tenant-scoped table is
// queried or written without a tenant.
//
// This is a boundary, not a warning. It throws in every environment. A guard
// that logs and continues in production is exactly the pattern this codebase
// has been bitten by -- a signal that reports success without being true.
//
// EXEMPT_PATTERNS is the honest part of the design. Some unscoped access is
// legitimate: a lookup by a secret token, a founder operation deliberately
// spanning tenants, an existence probe that reads no rows. Each one is listed
// with the reason it is safe. Adding to that list is a visible decision in a
// diff, which is the whole point -- omission was invisible, exemption is not.

const { TENANT_SCOPED_TABLES, GLOBAL_TABLES } = require("./sonara-tenant-scoped-tables.cjs");

const TENANT_COLUMN = "organization_id";

class TenantGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "TenantGuardError";
  }
}

// Reads that legitimately cross tenants, each with why it is safe.
//
// `table` must match exactly. `when` receives { method, query, body } and
// returns true if this specific request is the exempt one -- so an exemption
// for "lookup by token hash" does not also excuse a full table scan.
const EXEMPT_PATTERNS = Object.freeze([
  {
    table: "business_employee_invites",
    reason:
      "An invite is redeemed by presenting its token before the recipient belongs to anything. " +
      "The token hash is the credential; scoping by organization would require knowing the answer first.",
    when: ({ query }) => /token_hash=eq\./.test(query)
  },
  {
    table: "business_employee_invites",
    reason: "Marking a redeemed invite accepted, addressed by the primary key returned from the token lookup above.",
    when: ({ method, query }) => method === "PATCH" && /(^|&)id=eq\./.test(query)
  },
  {
    table: "billing_entitlements",
    reason:
      "Stripe webhooks arrive with no session. The organization comes out of the subscription metadata and " +
      "is written into the row; the upsert conflict target is (organization_id, entitlement_key), so the " +
      "tenant is carried in the body rather than the query.",
    when: ({ method, body }) => method === "POST" && bodyCarriesTenant(body)
  },
  {
    table: "billing_subscriptions",
    reason: "Same webhook path as billing_entitlements: the tenant is in the row being written, not the query.",
    when: ({ method, body }) => method === "POST" && bodyCarriesTenant(body)
  },
  {
    table: "purchases",
    reason: "Checkout completion, addressed by the Stripe session id, with the organization written into the row.",
    when: ({ method, body }) => method === "POST" && bodyCarriesTenant(body)
  },
  {
    table: "stripe_customers",
    reason: "Upsert keyed on stripe_customer_id; the organization is written into the row.",
    when: ({ method, body }) => method === "POST" && bodyCarriesTenant(body)
  },
  {
    table: "organizations",
    reason:
      "An organization row is itself the tenant. Looking one up by slug, or creating the first one, cannot " +
      "be scoped to an organization that does not exist yet.",
    when: () => true
  },
  {
    table: "organization_memberships",
    reason:
      "Resolving which organizations a user belongs to. This is the query that produces the organization id " +
      "every other query is then scoped by, so it necessarily runs before one is known. It is always " +
      "filtered by user_id, which is the caller's own verified identity.",
    when: ({ query, method, body }) => /user_id=eq\./.test(query) || (method === "POST" && bodyCarriesTenant(body))
  },
  {
    table: "business_memberships",
    reason: "Same as organization_memberships: resolves the caller's own workspaces from their verified user id.",
    when: ({ query, method, body }) => /user_id=eq\./.test(query) || (method === "POST" && bodyCarriesTenant(body))
  },
  {
    table: "support_requests",
    reason:
      "Founder support console. Admin-gated at the route, and its purpose is to see every tenant's requests -- " +
      "a support queue scoped to one tenant would not be a support queue.",
    when: () => true
  },
  {
    table: "service_catalog_items",
    reason: "The published catalog is the same for everyone; it is marketing copy, not customer data.",
    when: () => true
  }
]);

function bodyCarriesTenant(body) {
  if (!body) return false;
  const text = typeof body === "string" ? body : String(body);
  // Every row in the payload must carry it. An array where only the first row
  // does would otherwise pass, writing the rest to whatever the database
  // defaults to.
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  if (!rows.length) return false;
  return rows.every((row) => row && typeof row === "object" && row[TENANT_COLUMN] !== undefined && row[TENANT_COLUMN] !== null);
}

function queryCarriesTenant(query) {
  // eq. is the normal case; in. covers a caller scoping to several
  // organizations they have been shown to belong to.
  return new RegExp(`(^|&)${TENANT_COLUMN}=(eq|in)\\.`).test(query);
}

// Two shapes are scoped without naming an organization. Both are rules rather
// than per-table exemptions, because they are properties of the query itself
// and adding a table should not require remembering to list it again.

// `?select=id&limit=1` -- an existence probe. Twelve of these run on the
// readiness screens to answer "is this table reachable". It returns at most one
// id and no customer data. It does reveal whether *somebody* has a row, which
// is why the shape is pinned tightly: any other column, or any larger limit,
// stops being a probe and needs a real scope.
function isExistenceProbe(method, query) {
  if (method !== "GET" && method !== "HEAD") return false;
  const parameters = new URLSearchParams(query);
  const keys = [...parameters.keys()].sort();
  if (keys.join(",") !== "limit,select") return false;
  return parameters.get("select") === "id" && parameters.get("limit") === "1";
}

// A row belonging to one person rather than one organization -- notification
// and preference rows. Filtering by user_id is a scope, and a narrower one
// than organization_id would be.
//
// The limit worth being honest about: this layer cannot tell a verified user id
// from an attacker-supplied one. It trusts that the id came from the session,
// which every current call site does. If a route ever takes a user_id from
// query input, this rule would not catch it -- that is a route-level concern
// and this guard does not claim to solve it.
function isCallerScoped(query) {
  return /(^|&)user_id=(eq|in)\./.test(query);
}

/**
 * Decide whether a Supabase REST request is allowed to proceed.
 * Returns { allowed: true } or { allowed: false, message }.
 */
function inspect(method, url, body) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return { allowed: true };
  }

  const match = parsed.pathname.match(/\/rest\/v1\/([a-z0-9_]+)/i);
  if (!match) return { allowed: true };

  const table = match[1].toLowerCase();

  // Stored procedures enforce their own scoping in SQL, where the check can
  // see the caller. Second-guessing them from the URL would mean reading
  // arguments this layer cannot interpret.
  if (parsed.pathname.includes("/rest/v1/rpc/")) return { allowed: true };

  if (!TENANT_SCOPED_TABLES.has(table)) {
    if (GLOBAL_TABLES.has(table)) return { allowed: true };
    // Not in either list. Rather than guess, allow it and say so -- the
    // generated list is regenerated from migrations by verify:tenant-tables,
    // and blocking an unrecognised name would turn a stale list into an outage.
    //
    // "and say so" was the half that did not happen. inspect() returned this
    // field and install() read only .allowed, so a table the guard had never
    // heard of passed in complete silence -- the guard reporting that it covers
    // every tenant-scoped table while the one case it cannot judge produced no
    // signal at all. It still passes, because failing closed here trades a
    // quiet hole for an outage. It no longer passes quietly.
    return { allowed: true, unrecognised: table };
  }

  const query = parsed.search.replace(/^\?/, "");
  const upperMethod = String(method || "GET").toUpperCase();

  if (upperMethod === "POST") {
    if (bodyCarriesTenant(body)) return { allowed: true };
  } else if (queryCarriesTenant(query) || isCallerScoped(query) || isExistenceProbe(upperMethod, query)) {
    return { allowed: true };
  }

  for (const exemption of EXEMPT_PATTERNS) {
    if (exemption.table !== table) continue;
    if (exemption.when({ method: upperMethod, query, body })) return { allowed: true };
  }

  return {
    allowed: false,
    message:
      `${upperMethod} on "${table}" has no tenant scope. ${table} carries ${TENANT_COLUMN}, so this request ` +
      `would read or write across every organization.\n` +
      `  Fix: add ${TENANT_COLUMN}=eq.<id> to the query (or ${TENANT_COLUMN} to each row of a POST body).\n` +
      `  If crossing tenants is genuinely intended, add an entry to EXEMPT_PATTERNS in ` +
      `lib/sonara-tenant-guard.cjs with the reason it is safe.\n` +
      `  Path: ${parsed.pathname}${parsed.search}`
  };
}

// Installed-ness belongs to the target, not to this module. It was a single
// boolean, so the first install anywhere made every later one a silent no-op --
// including onto a test's own scope object, where the test then exercised an
// unwrapped fetch and concluded the guard worked. Tracking the target is more
// correct and it is what stops a test passing without testing anything.
const installedTargets = new WeakSet();

/**
 * Wrap global fetch so every Supabase REST request is inspected.
 *
 * Wrapping rather than replacing matters: tests/setup-env.cjs installs its own
 * offline firewall over fetch, and the two have to compose. Whatever is present
 * when this runs keeps handling the request once the check passes.
 */
function install(options = {}) {
  const target = options.global || globalThis;
  if (installedTargets.has(target)) return false;
  if (typeof target.fetch !== "function") return false;

  // Once per table name, not once per request. A table queried on every page
  // load would otherwise print a line per request, and a warning that frequent
  // is one nobody reads -- which puts this back where it started, only louder.
  const announced = new Set();
  const report = typeof options.onUnrecognised === "function"
    ? options.onUnrecognised
    : (table) => {
        console.warn(
          `[tenant-guard] "${table}" is queried but appears in neither TENANT_SCOPED_TABLES nor GLOBAL_TABLES, ` +
            `so the guard cannot tell whether it carries ${TENANT_COLUMN} and is letting its queries through ` +
            `unchecked. Run \`pnpm run gen:tenant-tables\` if a migration added it; if no migration creates ` +
            `it, that is the bug.`
        );
      };

  const inner = target.fetch;
  const guarded = async function sonaraTenantGuardedFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || String(input);
    if (/\/rest\/v1\//.test(url)) {
      const verdict = inspect(init?.method || "GET", url, init?.body);
      if (!verdict.allowed) throw new TenantGuardError(verdict.message);
      if (verdict.unrecognised && !announced.has(verdict.unrecognised)) {
        announced.add(verdict.unrecognised);
        report(verdict.unrecognised);
      }
    }
    return inner.call(this, input, init);
  };

  Object.defineProperty(guarded, "__sonaraTenantGuard", { value: true, enumerable: false });
  // tests/setup-env.cjs identifies its firewall by a tagged property. Carry the
  // tag across so wrapping it does not make the runtime think the firewall is
  // gone and start letting real requests out.
  if (inner.__sonaraOfflineFirewall) {
    Object.defineProperty(guarded, "__sonaraOfflineFirewall", { value: true, enumerable: false });
  }

  target.fetch = guarded;
  installedTargets.add(target);
  return true;
}

module.exports = {
  install,
  inspect,
  bodyCarriesTenant,
  queryCarriesTenant,
  isExistenceProbe,
  isCallerScoped,
  TenantGuardError,
  EXEMPT_PATTERNS,
  TENANT_COLUMN
};
