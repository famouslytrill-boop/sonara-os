"use strict";

// An in-memory stand-in for Supabase Auth and PostgREST.
//
// Cross-tenant tests need two organizations with real rows in them, driven
// through the real Express routes. Seeding a live Supabase project would make
// the suite depend on network, credentials, and cleanup, and CI has none of
// those. This implements enough of PostgREST to answer the queries this
// application actually makes, and records every one so a test can assert on
// what was asked rather than only on what came back.
//
// That distinction is the point. "Organization B's data did not appear on the
// page" can be true by accident -- a render bug, an empty result, a swallowed
// error. "The application never issued a query that could have returned
// organization B's data" is the property worth holding.

const crypto = require("node:crypto");
const tenantGuard = require("../../lib/sonara-tenant-guard.cjs");

const PASSTHROUGH = Symbol("not a supabase request");

const OPERATORS = "eq|in|is|neq|gt|gte|lt|lte";

// One `column.operator.value`, as it appears inside an or= group.
function parseCondition(text) {
  const match = String(text).match(new RegExp(`^([A-Za-z_][\\w]*)\\.(${OPERATORS})\\.(.*)$`, "s"));
  if (!match) return null;
  return { column: match[1], operator: match[2], value: match[3] };
}

function parseFilters(searchParams) {
  const filters = [];
  for (const [key, value] of searchParams.entries()) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) continue;

    // or=(a.gte.X,b.is.null). Needed for an interval overlap, which cannot be
    // written as a conjunction when one end of the interval is nullable.
    if (key === "or") {
      const inner = String(value).replace(/^\(|\)$/g, "");
      const conditions = inner.split(",").map(parseCondition);
      if (conditions.some((condition) => !condition)) {
        throw new Error(`fake-supabase cannot parse or=${value}. Model it rather than letting the query match every row.`);
      }
      filters.push({ any: conditions });
      continue;
    }

    // `not.` negates the operator after it: `published_at=not.is.null` is how
    // PostgREST asks for a published row, and the public scroll page and the
    // follower list both ask it that way. Refusing it made both unreachable from
    // any test driving the real routes -- the request failed here, the route
    // reported a failed read, and that looked exactly like the guard refusing it.
    //
    // Never on organization_id. `organization_id=not.eq.<own>` is every OTHER
    // tenant, and tests/cross-tenant-isolation.test.js reads a filter on that
    // column as the scope -- it would see the right id and call the query scoped.
    // The tenant guard refuses that shape too; the fake refuses it louder.
    let text = String(value);
    const negate = text.startsWith("not.");
    if (negate) {
      if (key === "organization_id") {
        throw new Error(`fake-supabase refuses ${key}=${value}: a negated organization filter selects every other tenant and is not a scope.`);
      }
      text = text.slice("not.".length);
    }
    const match = text.match(new RegExp(`^(${OPERATORS})\\.(.*)$`, "s"));
    // Loud rather than skipped.
    //
    // This used to `continue`, so a filter the fake does not model disappeared
    // and the query returned every row -- which reads in a test as a tenant
    // filter that works. A harness that silently widens a query is the same
    // defect as a check that passes on an empty list.
    if (!match) {
      throw new Error(`fake-supabase cannot parse the filter ${key}=${value}. Model it rather than letting the query match every row.`);
    }
    filters.push(negate
      ? { column: key, operator: match[1], value: match[2], negate: true }
      : { column: key, operator: match[1], value: match[2] });
  }
  return filters;
}

function matches(row, filter) {
  if (filter.any) return filter.any.some((condition) => matches(row, condition));
  if (filter.negate) return !matches(row, { column: filter.column, operator: filter.operator, value: filter.value });
  const actual = row[filter.column];
  switch (filter.operator) {
    case "eq":
      return String(actual) === filter.value;
    case "neq":
      return String(actual) !== filter.value;
    case "is":
      return filter.value === "null" ? actual === null || actual === undefined : String(actual) === filter.value;
    case "in": {
      const list = filter.value.replace(/^\(|\)$/g, "").split(",").map((item) => item.replace(/^"|"$/g, ""));
      return list.includes(String(actual));
    }
    case "gt":
      return actual > filter.value;
    case "gte":
      return actual >= filter.value;
    case "lt":
      return actual < filter.value;
    case "lte":
      return actual <= filter.value;
    default:
      // Unreachable: parseFilters refuses an operator this does not know. Kept
      // as a throw rather than a permissive `return true`, because the
      // permissive version is how an unmodelled operator becomes "matches
      // everything" and a tenant filter quietly stops filtering.
      throw new Error(`fake-supabase has no operator ${filter.operator}`);
  }
}

function project(row, select) {
  if (!select || select === "*") return { ...row };
  const columns = select.split(",").map((column) => column.trim()).filter((column) => column && column !== "*");
  if (!columns.length) return { ...row };
  const projected = {};
  for (const column of columns) projected[column] = row[column];
  return projected;
}

function jsonResponse(body, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

/**
 * @param {object} options
 * @param {Record<string, {id: string, email: string}>} options.users  bearer token -> user
 * @param {Record<string, object[]>} options.tables                    table -> rows
 * @param {string} [options.url]
 */
function createFakeSupabase(options = {}) {
  const url = options.url || "https://project.supabase.co";
  const users = options.users || {};
  const tables = new Map(Object.entries(options.tables || {}).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]));
  const queries = [];
  // Unique constraints, including partial ones: { table: [{ name, columns, where? }] }.
  // Only what a test declares is enforced -- the fake does not read migrations --
  // so a test relying on one declares it, and the migration replay proves the
  // real index exists. A plain insert that collides answers 409 with Postgres's
  // own code, as PostgREST does.
  const unique = options.unique || {};
  function violatedConstraint(table, row) {
    for (const constraint of unique[table] || []) {
      if (constraint.where && !constraint.where(row)) continue;
      const clash = rowsFor(table).some((existing) =>
        (!constraint.where || constraint.where(existing))
        && constraint.columns.every((column) => existing[column] !== undefined && String(existing[column]) === String(row[column])));
      if (clash) return constraint.name;
    }
    return null;
  }

  function rowsFor(table) {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  }

  // Ours by origin, not by prefix. `startsWith(url)` also matched
  // https://project.supabase.co.attacker.test -- CodeQL's "incomplete URL
  // substring sanitization" -- which in a fake means a request to some other
  // host is answered as Supabase and never reaches the firewall behind it.
  const origin = new URL(url).origin;
  function isOurs(requestUrl) {
    try {
      return new URL(requestUrl).origin === origin;
    } catch {
      return false;
    }
  }

  async function handle(input, init = {}) {
    const requestUrl = typeof input === "string" ? input : input?.url || String(input);
    if (!isOurs(requestUrl)) return PASSTHROUGH;

    const parsed = new URL(requestUrl);
    const method = String(init.method || "GET").toUpperCase();

    if (parsed.pathname === "/auth/v1/user") {
      const token = String(init.headers?.Authorization || init.headers?.authorization || "").replace(/^Bearer\s+/i, "");
      const user = users[token];
      if (!user) return jsonResponse({ message: "invalid token" }, 401);
      return jsonResponse(user);
    }

    // Stored procedures are not modelled. Returning a shaped failure lets the
    // caller take its own degraded path instead of throwing here.
    if (parsed.pathname.startsWith("/rest/v1/rpc/")) {
      queries.push({ method, table: `rpc:${parsed.pathname.split("/").pop()}`, search: parsed.search, filters: [] });
      return jsonResponse({ ok: false, code: "rpc_not_modelled" }, 404);
    }

    const restMatch = parsed.pathname.match(/^\/rest\/v1\/([a-z0-9_]+)$/i);
    if (!restMatch) return PASSTHROUGH;

    const table = restMatch[1];
    const filters = parseFilters(parsed.searchParams);
    let body;
    if (init.body) {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = undefined;
      }
    }

    queries.push({ method, table, search: parsed.search, filters, body });

    const select = parsed.searchParams.get("select");
    const limit = Number(parsed.searchParams.get("limit") || 0);

    if (method === "GET" || method === "HEAD") {
      let selected = rowsFor(table).filter((row) => filters.every((filter) => matches(row, filter)));
      const order = parsed.searchParams.get("order");
      if (order) {
        const [column, ...rest] = order.split(".");
        const descending = rest.includes("desc");
        selected = [...selected].sort((left, right) => {
          const a = left[column];
          const b = right[column];
          if (a === b) return 0;
          return (a > b ? 1 : -1) * (descending ? -1 : 1);
        });
      }
      if (limit > 0) selected = selected.slice(0, limit);
      return jsonResponse(selected.map((row) => project(row, select)), 200, {
        "content-range": `0-${Math.max(selected.length - 1, 0)}/${selected.length}`
      });
    }

    if (method === "POST") {
      const incoming = Array.isArray(body) ? body : [body].filter(Boolean);
      // `ids: "uuid"` for a caller that checks an id is a uuid before it will use
      // it, as the marketplace order routes do. The default stays readable.
      // Column defaults, as the migration declares them. Only what a test declares:
      // a conditional write like `checkout_attempts=eq.0` matches nothing against a
      // row the fake inserted without the database's default, and that reads in a
      // test exactly like a race the route lost.
      const defaults = (options.defaults || {})[table] || {};
      const created = incoming.map((row, index) => ({
        id: options.ids === "uuid" ? crypto.randomUUID() : `generated-${table}-${rowsFor(table).length + index}`,
        ...Object.fromEntries(Object.entries(defaults).map(([column, value]) => [column, typeof value === "function" ? value() : value])),
        ...row
      }));
      // Upserts. `on_conflict` names the key, and the Prefer header says what a
      // duplicate does: ignore-duplicates keeps the existing row and returns
      // nothing for it, merge-duplicates updates it. Without this a replayed
      // webhook's "insert the grant, ignore if present" looked in a test like a
      // second grant -- or, worse, a test of "only one grant" passed because the
      // fake had silently stored two and nobody counted.
      const conflictKey = parsed.searchParams.get("on_conflict");
      const prefer = String(init.headers?.Prefer || init.headers?.prefer || "");
      const resolution = /resolution=ignore-duplicates/.test(prefer) ? "ignore" : /resolution=merge-duplicates/.test(prefer) ? "merge" : null;
      if (conflictKey && !resolution) {
        throw new Error(`fake-supabase: on_conflict=${conflictKey} without a resolution in Prefer is a plain insert in PostgREST. Say which you mean.`);
      }
      const keyColumns = conflictKey ? conflictKey.split(",").map((column) => column.trim()) : [];
      const sameKey = (left, right) => keyColumns.every((column) => left[column] !== undefined && String(left[column]) === String(right[column]));
      const inserted = [];
      for (const row of created) {
        const existing = keyColumns.length ? rowsFor(table).find((candidate) => sameKey(candidate, row)) : null;
        if (existing) {
          if (resolution === "merge") Object.assign(existing, row);
          continue;
        }
        const violated = violatedConstraint(table, row);
        if (violated) {
          return jsonResponse({ code: "23505", message: `duplicate key value violates unique constraint "${violated}"` }, 409);
        }
        rowsFor(table).push(row);
        inserted.push(row);
      }
      return jsonResponse(inserted, 201);
    }

    if (method === "PATCH") {
      const updated = [];
      for (const row of rowsFor(table)) {
        if (!filters.every((filter) => matches(row, filter))) continue;
        Object.assign(row, body || {});
        updated.push(row);
      }
      return jsonResponse(updated, 200);
    }

    if (method === "DELETE") {
      const kept = rowsFor(table).filter((row) => !filters.every((filter) => matches(row, filter)));
      const removed = rowsFor(table).length - kept.length;
      tables.set(table, kept);
      return jsonResponse(Array(removed).fill({}), 200);
    }

    return jsonResponse([], 200);
  }

  return {
    url,
    queries,
    rows: (table) => rowsFor(table).map((row) => ({ ...row })),
    reset: () => {
      queries.length = 0;
    },
    /**
     * Wrap an existing fetch. Anything not addressed to this fake falls
     * through to it, so the suite's offline firewall keeps working around it.
     *
     * The tenant guard is applied HERE, in front of the fake, every time. It
     * used to be left to wherever server.js happened to install it, which
     * depended on load order: a file that installed this and then required
     * server.js for the first time got the guard in front; in the full suite an
     * earlier file had already required server.js, so the guard sat inside
     * `previousFetch`, behind the fake, and never saw a Supabase URL. Run alone,
     * tests/a-chat-widget-captures-one-business-lead.test.js failed 12 tests
     * against the guard as it stood on 2 October 2026 and
     * tests/a-public-profile-publishes-three-things.test.js failed one; in the
     * suite both passed -- while the guard refused /chat/:slug and
     * /creator/:handle on every production request. In production every request
     * passes the guard, so every request to this fake does too.
     */
    install(previousFetch) {
      const inner = previousFetch;
      return async function fakeSupabaseFetch(input, init) {
        const requestUrl = typeof input === "string" ? input : input?.url || String(input);
        if (isOurs(requestUrl) && /\/rest\/v1\//.test(requestUrl)) {
          const verdict = tenantGuard.inspect(init?.method || "GET", requestUrl, init?.body);
          if (!verdict.allowed) throw new tenantGuard.TenantGuardError(verdict.message);
        }
        const result = await handle(input, init);
        if (result !== PASSTHROUGH) return result;
        return inner ? inner.call(this, input, init) : jsonResponse({}, 404);
      };
    }
  };
}

module.exports = { createFakeSupabase, PASSTHROUGH };
