"use strict";

// The controls a customer only sees once they have data.
//
// Two gates already cover the empty application. `no-dead-links` follows every
// internal `href`, logged out. `every-form-posts-somewhere` reads every
// `<form action>`, signed in but against empty tables. Both are honest about
// what they cover, and the header of the second says so outright: "Covering row
// actions needs a seeded crawl, which is a larger change than this and is not
// pretended at here."
//
// That honest scope limit was concealing live defects. A control rendered once
// per row -- Edit, Archive, a status select, a detail link -- renders zero times
// against an empty table, so neither gate can see it. Fourteen Creator Studio
// controls were dead in production for exactly that reason: the page rendered an
// Edit link on every row and no route answered it, and every check was green.
//
// So this crawl seeds. Every table read returns one plausible row, both passes
// run, and what interests this file is the difference: the targets that appear
// ONLY when an account has data. Those are the ones nothing else looks at.
//
// Links are fetched rather than matched against the route table, and that
// distinction has already mattered here: matching reported nine dead links --
// favicon, fonts, stylesheets, the webmanifest -- because `express.static`
// serves them and they are not registered routes. Fetching returns 200 for all
// nine. Forms are matched, because a form's method is what decides whether a
// handler exists for it and issuing the POST would write.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  SUPABASE_URL: "https://stub.supabase.co",
  NEXT_PUBLIC_SUPABASE_URL: "https://stub.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-row-crawl",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-row-crawl",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-row-crawl"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const USER = { id: "55555555-5555-4555-8555-555555555555", email: "row-crawl@example.com" };
const ORGANIZATION_ID = "66666666-6666-4666-8666-666666666666";
const ROW_ID = "77777777-7777-4777-8777-777777777777";

// Floors. Every assertion below is satisfied by a population of nothing, so
// each one is asserted non-empty with a message saying the crawl went blind
// rather than that the application is clean.
const MINIMUM_PAGES = 200;
const MINIMUM_SEEDED_ONLY_TARGETS = 20;

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

// One row, wide enough that a page reading an unexpected column still gets a
// value rather than undefined. Columns are added here when a page is found to
// read one unguarded -- `schema_key` is the case that proved the point: it is
// `text not null`, the page calls `row.schema_key.replace(...)` with no guard,
// and a fixture omitting it produced a 500 that looked like a page defect and
// was a fixture defect.
const SEEDED_ROW = Object.freeze({
  id: ROW_ID,
  organization_id: ORGANIZATION_ID,
  workspace_id: "workspace",
  user_id: USER.id,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  name: "Seeded record",
  title: "Seeded record",
  label: "Seeded record",
  slug: "seeded-record",
  description: "A row so that row-level controls render.",
  status: "active",
  state: "active",
  schema_key: "sample_records",
  currency: "GBP",
  amount_cents: 1000,
  price_cents: 1000,
  quantity: 1,
  email: "seeded@example.com",
  archived_at: null,
  medium: "mixed",
  revision: 1,
  graph: { version: 1, nodes: [], edges: [] }
});

function stubFetch({ seeded }) {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();

    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});

    if (target.includes("/rest/v1/")) {
      const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
      if (table === "organization_memberships") {
        return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
      }
      if (table === "business_memberships") {
        return json([{ id: "membership", organization_id: ORGANIZATION_ID, workspace_id: "workspace", role: "owner", status: "active" }]);
      }
      if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Row Crawl Ltd" }]);
      if (table === "billing_entitlements") {
        const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1])
          .split(",").filter(Boolean);
        const granted = asked.includes("all_three_monthly") ? "all_three_monthly" : asked[0];
        return json(granted ? [{ entitlement_key: granted, status: "active" }] : []);
      }
      if (method === "POST" || method === "PATCH") return json([{ id: "created" }], 201);
      return json(seeded ? [{ ...SEEDED_ROW, table_name: table }] : []);
    }

    return undefined;
  };
}

function registeredRoutes() {
  const routes = [];
  (function walk(stack) {
    for (const layer of stack) {
      if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
    }
  })(app._router ? app._router.stack : app.router.stack);
  return routes;
}

// `:id` matches one segment and never a `/`, so a parameter cannot swallow a
// path boundary and make an unrelated route look like a handler.
function pathMatcher(routePath) {
  const source = routePath
    .split("/")
    .map((segment) => (segment.startsWith(":") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${source}$`);
}

function crawlablePages(routes) {
  return [...new Set(routes.filter((route) => route.methods.includes("get")).map((route) => route.path))]
    .filter((route) => !route.includes(":"))
    .filter((route) => !route.startsWith("/api/"))
    .filter((route) => !route.startsWith("/admin"))
    .filter((route) => route !== "/auth/callback")
    .sort();
}

describe("every control that only appears once there is data reaches a handler", function () {
  this.timeout(240000);

  let realFetch;
  let pagesRendered = 0;
  let postRoutes = [];
  let getRoutes = [];
  // key -> { method, path, from: [], seededOnly: boolean }
  const forms = new Map();
  const links = new Map();

  before(async () => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;

    const routes = registeredRoutes();
    postRoutes = [...new Set(routes.filter((r) => r.methods.includes("post")).map((r) => r.path))];
    getRoutes = [...new Set(routes.filter((r) => r.methods.includes("get")).map((r) => r.path))];
    const pages = crawlablePages(routes);

    for (const seeded of [false, true]) {
      global.fetch = stubFetch({ seeded });
      let renderedThisPass = 0;
      for (const page of pages) {
        let res;
        try {
          res = await request(app)
            .get(page)
            .set("Accept", "text/html")
            .set("Cookie", [`${CUSTOMER_SESSION_COOKIE}=stub-session`]);
        } catch {
          continue;
        }
        if (res.status !== 200) continue;
        if (!/text\/html/.test(res.headers["content-type"] || "")) continue;
        renderedThisPass += 1;

        for (const tag of res.text.matchAll(/<form\b([^>]*)>/gi)) {
          const attributes = tag[1];
          const action = (attributes.match(/\baction="([^"]*)"/i) || [])[1];
          if (action === undefined) continue;
          const method = ((attributes.match(/\bmethod="([^"]*)"/i) || [])[1] || "get").toLowerCase();
          const path = action.split("#")[0].split("?")[0];
          if (!path.startsWith("/")) continue;
          const key = `${method} ${path}`;
          if (!forms.has(key)) forms.set(key, { method, path, from: [], seededOnly: seeded });
          if (!seeded) forms.get(key).seededOnly = false;
          forms.get(key).from.push(page);
        }

        for (const match of res.text.matchAll(/href="(\/[^"#?]*)"/g)) {
          const href = match[1];
          if (!links.has(href)) links.set(href, { from: [], seededOnly: seeded });
          if (!seeded) links.get(href).seededOnly = false;
          links.get(href).from.push(page);
        }
      }
      // The seeded pass renders at least as many pages; take the larger so a
      // pass that failed outright cannot lower the figure the floor checks.
      pagesRendered = Math.max(pagesRendered, renderedThisPass);
    }
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("rendered enough pages, in both passes, to be measuring something", () => {
    assert.ok(
      pagesRendered >= MINIMUM_PAGES,
      `only ${pagesRendered} pages rendered HTML; this crawl has gone blind rather than found a clean application`
    );
    assert.ok(postRoutes.length >= 200, `only ${postRoutes.length} POST routes registered; the route walk has gone blind`);
  });

  it("found controls that only exist once there is data", () => {
    // If seeding changes nothing, the stub is not reaching the queries the
    // pages make and this whole file is measuring the empty state twice.
    const seededOnly = [...forms.values()].filter((t) => t.seededOnly).length
      + [...links.values()].filter((t) => t.seededOnly).length;
    assert.ok(
      seededOnly >= MINIMUM_SEEDED_ONLY_TARGETS,
      `only ${seededOnly} targets appeared exclusively in the seeded pass; seeding is not reaching the pages, ` +
        `so this crawl is measuring the empty state twice and cannot see a row-level control at all`
    );
  });

  it("every row-level form submits to a registered handler for its own method", () => {
    const matchers = { post: postRoutes.map(pathMatcher), get: getRoutes.map(pathMatcher) };
    const dead = [];
    for (const target of forms.values()) {
      if (!target.seededOnly) continue;
      const pool = target.method === "post" ? matchers.post : matchers.get;
      if (pool.some((matcher) => matcher.test(target.path))) continue;
      dead.push(
        `${target.method.toUpperCase()} ${target.path}  (submitted from ${[...new Set(target.from)].slice(0, 3).join(", ")})`
      );
    }
    assert.deepEqual(
      dead,
      [],
      `${dead.length} row-level form(s) submit to a path with no handler for that method. These only render once a ` +
        `customer has data, which is why no other check sees them.\n  ${dead.join("\n  ")}`
    );
  });

  it("every row-level link answers when followed", async () => {
    const dead = [];
    for (const [href, info] of links) {
      if (!info.seededOnly) continue;
      const path = href.replace(/\/$/, "") || "/";
      let status;
      try {
        const res = await request(app)
          .get(path)
          .set("Accept", "text/html")
          .set("Cookie", [`${CUSTOMER_SESSION_COOKIE}=stub-session`]);
        status = res.status;
      } catch (error) {
        status = `threw ${error.message}`;
      }
      if (status === 404 || status === 405 || status === 500) {
        dead.push(`${status}  ${href}  (linked from ${[...new Set(info.from)].slice(0, 3).join(", ")})`);
      }
    }
    assert.deepEqual(
      dead,
      [],
      `${dead.length} row-level link(s) do not answer. A customer with data sees these and clicking gets ` +
        `nothing.\n  ${dead.join("\n  ")}`
    );
  });
});
