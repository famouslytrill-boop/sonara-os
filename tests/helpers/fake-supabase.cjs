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

const PASSTHROUGH = Symbol("not a supabase request");

function parseFilters(searchParams) {
  const filters = [];
  for (const [key, value] of searchParams.entries()) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) continue;
    const match = String(value).match(/^(eq|in|is|neq|gt|gte|lt|lte)\.(.*)$/s);
    if (!match) continue;
    filters.push({ column: key, operator: match[1], value: match[2] });
  }
  return filters;
}

function matches(row, filter) {
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
      return true;
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

  function rowsFor(table) {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  }

  async function handle(input, init = {}) {
    const requestUrl = typeof input === "string" ? input : input?.url || String(input);
    if (!requestUrl.startsWith(url)) return PASSTHROUGH;

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
      const created = incoming.map((row, index) => ({ id: `generated-${table}-${rowsFor(table).length + index}`, ...row }));
      rowsFor(table).push(...created);
      return jsonResponse(created, 201);
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
     * through, so the tenant guard and the suite's offline firewall keep
     * working around it.
     */
    install(previousFetch) {
      const inner = previousFetch;
      return async function fakeSupabaseFetch(input, init) {
        const result = await handle(input, init);
        if (result !== PASSTHROUGH) return result;
        return inner ? inner.call(this, input, init) : jsonResponse({}, 404);
      };
    }
  };
}

module.exports = { createFakeSupabase, PASSTHROUGH };
