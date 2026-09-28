"use strict";

// Every button that submits has to reach a handler.
//
// tests/no-dead-links.test.js crawls the router and follows every internal
// `href`, which covers links. Nothing covered the other half of the surface:
// `<form action="...">`. A form whose action names a path with no handler for
// its method renders a button that looks exactly like a working one, sits in
// the page at full contrast, and does nothing when a customer clicks it. From
// outside it is indistinguishable from a feature.
//
// That shape survives every check this repository already runs:
//
//   - verify:route-surface proves every route the server answers is declared,
//     and that no two surfaces claim one route. It reads routes, not pages, so
//     a form pointing at a path that was never registered is invisible to it.
//   - verify:route-registry proves every route in the page manifest is
//     registered. Same direction, same blind spot.
//   - no-dead-links follows `href="..."` only. Its own regex says so.
//   - signed-in-workspace-crawl asserts pages render for an authenticated
//     customer. A page renders perfectly well with a dead form in it.
//
// Measured when this was written, 27 September 2026: 291 pages answered 200,
// 302 POST routes were registered, and the crawl found 141 distinct form
// targets -- 119 POST, 22 GET. None of them were dead. That is the point worth
// recording: this check was not written to fix a bug, it was written because
// 119 submit targets had nothing standing behind them, and "none are broken
// today" is a measurement with a date on it rather than a property.
//
// This crawls TWICE, and the second pass is the one that earns its keep.
//
// The first version crawled only with every table stubbed empty. That was
// established as a real limit by falsifying it: a dead action planted on a
// row-action form left the check green, because a form rendered once per row
// renders zero times when there are no rows. The note recorded that row-level
// actions were not covered.
//
// They are now. The seeded pass returns one plausible row for every list read,
// so row controls render. What it found immediately, on 27 September 2026:
// **seven Creator Studio buttons that submitted to no route at all** -- six
// Archive controls and the artist Status control. Six of those tables had no
// archived_at column either. Empty-state crawling could never have seen any of
// them, and neither could the logged-out crawl, verify:route-surface or
// verify:route-registry.
//
// Both passes are kept rather than the seeded one replacing the empty one. They
// render different pages: 291 answered 200 empty against 301 seeded, and the
// empty state is the one every new account is actually in.
//
// The session stub is the one from signed-in-workspace-crawl, and for the same
// reason: most forms only exist behind authentication, so a logged-out crawl
// would pass by rendering login redirects and reading almost no forms at all --
// shape 1, a check satisfied by measuring nothing. The floors below exist so
// that failure mode is loud instead of green.

const assert = require("node:assert/strict");
const request = require("supertest");

// Set here and restored in after(), per the convention in tests/setup-env.cjs:
// it strips every SUPABASE_ variable for isolation, and a file needing
// configured providers sets them for its own run. Module scope would leak
// across files -- see the note in tests/signed-in-workspace-crawl.test.js.
const SUPABASE_ENV = Object.freeze({
  SUPABASE_URL: "https://stub.supabase.co",
  NEXT_PUBLIC_SUPABASE_URL: "https://stub.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-form-crawl",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-form-crawl",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-form-crawl"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "form-crawl@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";

// Floors, set below what was measured rather than at it, so ordinary growth
// does not fail the check while a directory rename or a broken walk does.
// Every one of these guards shape 1: an empty population would otherwise clear
// every assertion below by having nothing to disagree with.
const MINIMUM_PAGES = 200;          // measured 291 empty, 301 seeded
const MINIMUM_POST_ROUTES = 200;    // measured 302
const MINIMUM_FORM_TARGETS = 180;   // measured 237 across both passes
const MINIMUM_POST_TARGETS = 160;   // measured 215 across both passes
// The seeded pass has to contribute, or it is a second run of the first one
// reporting success twice. Measured: 141 empty, 237 combined -- 96 row controls
// that only exist once a table has a row in it.
const MINIMUM_SEEDED_ONLY = 40;

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

// One plausible row, carrying the column names these pages read. It is a fixed
// shape rather than per-table, because the question here is whether a rendered
// action has a handler, not whether a page renders a column correctly.
const SEEDED_ROW = Object.freeze({
  id: "11111111-1111-4111-8111-111111111111",
  organization_id: ORGANIZATION_ID, workspace_id: "workspace",
  name: "Sample", title: "Sample", label: "Sample", slug: "sample",
  description: "Sample record", summary: "Sample", body: "Sample",
  status: "active", state: "active", stage: "active", lifecycle_status: "active",
  archived: false, is_archived: false, published: false, is_published: false,
  visibility: "private", role: "owner", kind: "sample", type: "sample",
  email: "sample@example.com", phone: "+15555550100", handle: "sample",
  amount: 1000, amount_cents: 1000, price: 1000, price_cents: 1000,
  quantity: 1, count: 1, position: 1, sort_order: 1,
  currency: "usd", locale: "en-US", timezone: "America/New_York",
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  starts_at: "2026-09-01T00:00:00Z", ends_at: "2026-09-02T00:00:00Z",
  metadata: {}, settings: {}, tags: []
});

function stubFetch({ seeded = false } = {}) {
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
      if (table === "organizations") {
        return json([{ id: ORGANIZATION_ID, name: "Form Crawl Ltd" }]);
      }
      // Echo back an entitlement the request itself asked for, so paid surfaces
      // render their forms. Guessing a column value here is how an earlier
      // crawl concluded paying customers were locked out.
      if (table === "billing_entitlements") {
        const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1])
          .split(",").filter(Boolean);
        const granted = asked.includes("all_three_monthly") ? "all_three_monthly" : asked[0];
        return json(granted ? [{ entitlement_key: granted, status: "active" }] : []);
      }
      if (method === "POST" || method === "PATCH") return json([{ id: "created" }], 201);
      return json(seeded ? [SEEDED_ROW] : []);
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

// `/products/:id/status` has to match the rendered `/products/abc-123/status`.
// A parameter matches one segment and never a `/`, so `:id` cannot swallow a
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
    // A protocol endpoint, not a page: with no provider code it is correctly 400.
    .filter((route) => route !== "/auth/callback")
    .sort();
}

describe("every form on every page submits to a route that exists", function () {
  this.timeout(120000);

  let realFetch;
  let targets;
  let pagesRendered;
  let postRoutes;
  let getRoutes;

  before(async () => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;

    const routes = registeredRoutes();
    postRoutes = [...new Set(routes.filter((r) => r.methods.includes("post")).map((r) => r.path))];
    getRoutes = [...new Set(routes.filter((r) => r.methods.includes("get")).map((r) => r.path))];

    targets = new Map();
    pagesRendered = 0;

    for (const seeded of [false, true]) {
      global.fetch = stubFetch({ seeded });
      await crawl(crawlablePages(routes), seeded);
    }
  });

  async function crawl(pages, seeded) {
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
        // No method attribute means GET, which is what the HTML spec says and
        // what the browser will actually do.
        const method = ((attributes.match(/\bmethod="([^"]*)"/i) || [])[1] || "get").toLowerCase();
        if (action === undefined) continue;

        const path = action.split("#")[0].split("?")[0];
        // Off-site submissions are somebody else's routing table.
        if (!path.startsWith("/")) continue;

        const key = `${method} ${path}`;
        if (!targets.has(key)) targets.set(key, { method, path, from: [], seededOnly: seeded });
        else if (!seeded) targets.get(key).seededOnly = false;
        targets.get(key).from.push(page);
      }
    }
    // The floor is per pass, not the sum: two passes over a broken walk would
    // otherwise clear a floor neither pass could clear alone.
    pagesRendered = Math.max(pagesRendered, renderedThisPass);
  }

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("rendered enough pages and routes to be measuring something", () => {
    assert.ok(
      pagesRendered >= MINIMUM_PAGES,
      `only ${pagesRendered} pages rendered HTML; this crawl has gone blind rather than found a clean application`
    );
    assert.ok(
      postRoutes.length >= MINIMUM_POST_ROUTES,
      `only ${postRoutes.length} POST routes registered; the route walk has gone blind`
    );
  });

  it("found forms to check, of both methods", () => {
    assert.ok(
      targets.size >= MINIMUM_FORM_TARGETS,
      `only ${targets.size} distinct form targets found; the form scan has gone blind`
    );
    const posting = [...targets.values()].filter((t) => t.method === "post");
    const getting = [...targets.values()].filter((t) => t.method !== "post");
    assert.ok(
      posting.length >= MINIMUM_POST_TARGETS,
      `only ${posting.length} POST form targets found; the method attribute is probably no longer being read`
    );
    // Both halves asserted, so a regex that silently stopped matching one of
    // them cannot leave the other reporting success.
    assert.ok(getting.length > 0, "no GET form targets found; the method default is probably not being applied");
  });

  it("the seeded pass reaches row controls the empty pass cannot", () => {
    const seededOnly = [...targets.values()].filter((t) => t.seededOnly);
    assert.ok(
      seededOnly.length >= MINIMUM_SEEDED_ONLY,
      `only ${seededOnly.length} form target(s) appeared solely in the seeded pass. ` +
        "Either row controls stopped rendering or the seeded stub stopped seeding, " +
        "and this file is running the empty crawl twice while reporting success twice."
    );
  });

  it("every form action resolves to a registered handler for its own method", () => {
    const matchers = {
      post: postRoutes.map(pathMatcher),
      get: getRoutes.map(pathMatcher)
    };

    const dead = [];
    for (const target of targets.values()) {
      const pool = target.method === "post" ? matchers.post : matchers.get;
      if (pool.some((matcher) => matcher.test(target.path))) continue;
      dead.push(
        `${target.method.toUpperCase()} ${target.path}  ` +
          `(submitted from ${target.from.length}: ${[...new Set(target.from)].slice(0, 3).join(", ")})`
      );
    }

    assert.deepEqual(
      dead,
      [],
      `${dead.length} form(s) submit to a path with no handler for that method. ` +
        `A customer clicking these gets nothing.\n  ${dead.join("\n  ")}`
    );
  });
});
