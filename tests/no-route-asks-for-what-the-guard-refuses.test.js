"use strict";

// No route asks Postgres for something the tenant guard will refuse.
//
// lib/sonara-tenant-guard.cjs wraps fetch and throws on a query against a
// tenant-scoped table that names no organization, unless EXEMPT_PATTERNS says
// why that exact query is safe. Every route reaches Postgres through a small
// fetch wrapper that catches what fetch throws and reports a failed read -- so a
// refusal never surfaces as an error. It surfaces as a page saying "We cannot
// reach this just now".
//
// Until 2 October 2026 that was what a visitor got from /events/:slug,
// /store/:slug, /creator/:handle, /chat/:slug and /shared/:token, and /s/:slug
// failed the same way; publishing an event or a chat page failed at its address
// check; and following a creator answered "That did not change". Most of those
// lookups were recorded as deliberate in scripts/report-tenant-scoped-queries.mjs
// and none was in EXEMPT_PATTERNS, which is the list that runs. Every test of
// those pages passed in the suite, because none met the guard: some replace
// global fetch with a stub, and the ones on tests/helpers/fake-supabase.cjs had
// it behind the fake whenever an earlier file had loaded server.js first. The
// fake now applies the guard itself. And the one guard test that drives real
// pages drove five that read nothing tenant-scoped.
//
// So this drives every GET and POST route in server.js, anonymous and signed in,
// with the real guard in front of a fake PostgREST, and fails on any refusal at
// all. A refused query is never correct. Either it is missing its tenant filter
// and the feature cannot work, or it is deliberate and its exemption is missing,
// and the feature cannot work.
//
// ## Why the guard is installed here rather than relied on
//
// server.js installs it on first require. In a mocha run some other file has
// usually required server.js already, and anything that later assigns
// global.fetch -- as most route tests do -- takes the guard out of the chain. So
// this installs it explicitly, with the module's own install(), over the fake,
// and the first test proves it is in place: a query naming no organization must
// be refused by the very fetch the routes call.
//
// ## What a sweep cannot reach, and what covers it instead
//
// A path only runs if the data and the identity let it. The publish checks need a
// valid form; the follower list needs follows. Those are driven one by one below
// with seeded rows, and each must both reach the table and render what it read --
// reaching the table proves the guard let it through, rendering proves the page
// used it. The storefront's address check sits behind a management unlock the
// sweep cannot pass, so it is driven through the real route module with that
// middleware replaced and the guard still in front.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const tenantGuard = require("../lib/sonara-tenant-guard.cjs");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");

const SUPABASE = "https://project.supabase.co";
const ORG = "aaaaaaaa-0000-0000-0000-00000000000a";
const USER = "11111111-0000-0000-0000-000000000001";
const PROFILE = "cccccccc-0000-4000-8000-00000000000c";

function seed() {
  return {
    organizations: [{ id: ORG, name: "ALPHA-ORG", slug: "alpha" }],
    organization_memberships: [
      { id: "m1", organization_id: ORG, user_id: USER, status: "active", role: "owner", created_at: "2026-01-01" }
    ],
    growth_events: [{
      id: "e1", organization_id: ORG, venue_id: null, title: "SPRING-FAIR", summary: "A fair.", kind: "event",
      status: "published", starts_at: "2026-11-01T10:00:00Z", ends_at: null, capacity: 10, slug: "spring-fair",
      cancellation_reason: null
    }],
    merchant_storefronts: [{
      id: "s1", organization_id: ORG, slug: "corner-shop", enabled: true, headline: "CORNER-SHOP", intro: "Hello.",
      currency: "usd", accepts_orders: true
    }],
    creator_artist_profiles: [
      { id: PROFILE, organization_id: ORG, public_handle: "nova", status: "active", artist_name: "NOVA-ARTIST", public_description: "Sings." }
    ],
    creator_follows: [{ id: "f1", follower_user_id: USER, artist_profile_id: PROFILE, created_at: "2026-01-01" }],
    lead_capture_pages: [
      { id: "l1", organization_id: ORG, slug: "ask-us", enabled: true, headline: "ASK-US-PAGE", greeting: "Hi.", closing: "Bye." }
    ],
    scroll_sites: [{
      id: "sc1", organization_id: ORG, slug: "my-scroll", title: "MY-SCROLL", published_at: "2026-01-01",
      document: { title: "MY-SCROLL", sections: [{ kind: "hero", heading: "MY-SCROLL-HEADING", body: "Read on." }] }
    }]
  };
}

// The kitchen-sink form every POST route is sent in the sweep. Fields a route does
// not read are ignored; the ones it does read are plausible enough to get past
// validation into whatever it queries next.
const FORM = {
  slug: "new-slug", event_id: "e1", title: "A title", name: "A name", display_name: "A name",
  email: "pat@example.com", party_size: "1", attending: "true", enabled: "on", publish: "true",
  handle: "new-handle", quantity: "1", message: "hello", body: "hello", reason: "spam",
  starts_at: "2026-11-01T10:00", kind: "event"
};

// A token in the shape lib/sonara-shared-results.cjs issues. "sample-token" was
// refused by the route's own shape check before any query, so the sweep never
// reached the /shared/:token lookup -- which the guard was refusing too.
const SAMPLE_PARAMS = { slug: "spring-fair", handle: "nova", token: "AbCdEfGhIjKlMnOpQrStUvWxYz012345", id: "e1" };
const EDIT_ID = "dddddddd-0000-4000-8000-00000000000d";

// Every request here comes from its own client address. The rate limiters fall
// back to one in-process store keyed on the first x-forwarded-for entry, and the
// POST sweep reaches /auth/signup like everything else: from one shared address
// it used up the signup allowance, and tests/server.test.js -- run later in the
// same process -- got 429 where it expected 503. A sweep that changes what the
// next file observes is measuring with a thumb on the scale.
let clientNumber = 0;
function nextClient() {
  clientNumber += 1;
  return `10.${(clientNumber >> 16) & 255}.${(clientNumber >> 8) & 255}.${clientNumber & 255}`;
}

describe("no route asks for what the tenant guard refuses", () => {
  let app;
  let fake;
  let fakeFetch;
  let savedFetch;
  let savedEnv;
  let guarded;
  let refusals;
  let current;
  const crashed = [];

  before(() => {
    savedEnv = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";

    // server.js first. Its own install() runs on first require and wraps whatever
    // global.fetch is at that moment; requiring it after the chain below is built
    // put a second guard OUTSIDE the recorder, which then refused queries before
    // the recorder could see them -- the first version of this file did exactly
    // that, and the harness test below is what caught it.
    app = require("../server");
    savedFetch = global.fetch;

    // The fake is rebuilt before every test (see beforeEach), because the sweeps
    // really do write: the POST sweep, signed in as the owner, cancels the seeded
    // event through /api/growth/events/cancel, and an RSVP probe run after it was
    // correctly refused as "cancelled". The guard wraps this indirection, so it
    // stays in front of whichever fake is current.
    const throughCurrentFake = async function throughCurrentFake(input, init) {
      return fakeFetch.call(this, input, init);
    };

    // The real install(), onto a holder rather than globalThis, so it wraps the
    // fake no matter what some earlier file did to global.fetch.
    const holder = { fetch: throughCurrentFake };
    tenantGuard.install({ global: holder });
    guarded = holder.fetch;

    refusals = [];
    global.fetch = async function recordingRefusals(input, init) {
      try {
        return await guarded.call(this, input, init);
      } catch (error) {
        if (error && error.name === "TenantGuardError") {
          const where = (String(error.message).match(/Path: (.*)/) || [])[1] || "";
          refusals.push(`${current} asked for ${String(init?.method || "GET").toUpperCase()} ${where.replace("/rest/v1/", "")}`);
        }
        throw error;
      }
    };
  });

  after(() => {
    // And whatever the sweeps did put in the limiters' fallback store goes with
    // them, including buckets keyed on the signed-in subject rather than the
    // address.
    require("../lib/sonara-rate-limit.cjs").__resetInMemoryBucketsForTests();
    global.fetch = savedFetch;
    for (const [key, value] of Object.entries(savedEnv || {})) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    refusals.length = 0;
    crashed.length = 0;
    fake = createFakeSupabase({ users: { "token-a": { id: USER, email: "a@example.com" } }, tables: seed() });
    fakeFetch = fake.install(savedFetch);
  });

  const routesWith = (method) => app._router.stack
    .map((layer) => layer.route)
    .filter((route) => route && route.methods[method] && typeof route.path === "string");
  const concrete = (routePath) => routePath.replace(/:([A-Za-z_]+)\??/g, (_, name) => SAMPLE_PARAMS[name] || "sample");

  // ---------------------------------------------------------------------------
  // The harness can fail
  // ---------------------------------------------------------------------------

  it("has the real guard in front of the fake, or nothing below is measured", async () => {
    assert.equal(guarded.__sonaraTenantGuard, true, "install() did not wrap the fake");

    // A query naming no organization must be refused by the fetch the routes call.
    current = "the harness";
    await assert.rejects(
      global.fetch(`${SUPABASE}/rest/v1/customer_records?select=*`),
      (error) => error.name === "TenantGuardError"
    );
    assert.equal(refusals.length, 1, "a refusal by the guard was not recorded; the sweeps below would read clean while blind");
    assert.equal(fake.queries.length, 0, "the refused query reached the fake, so the guard is not in front of it");

    // And a scoped one goes through to the fake.
    const response = await global.fetch(`${SUPABASE}/rest/v1/growth_events?select=id&organization_id=eq.${ORG}`);
    assert.equal(response.ok, true);
    assert.equal(fake.queries.length, 1, "a scoped query did not reach the fake");
  });

  // ---------------------------------------------------------------------------
  // Every route
  // ---------------------------------------------------------------------------

  it("refuses nothing any GET route asks for, and none of them crashes, anonymous or signed in", async function sweepGets() {
    this.timeout(120000);
    const routes = routesWith("get");
    // 552 when written. Far fewer means the stack walk broke, and an empty sweep
    // refuses nothing.
    assert.ok(routes.length >= 400, `only ${routes.length} GET routes found; this sweep has gone blind`);

    for (const route of routes) {
      for (const [who, token] of [["anonymous", null], ["signed in", "token-a"]]) {
        current = `GET ${route.path} (${who})`;
        const call = request(app).get(concrete(route.path)).set("accept", "text/html").set("x-forwarded-for", nextClient());
        if (token) call.set("Authorization", `Bearer ${token}`);
        const response = await call.catch(() => null);
        if (response && response.status === 500) crashed.push(current);
      }
    }

    // The sweep has to have reached the database, or "nothing was refused" is
    // only "nothing was asked".
    assert.ok(fake.queries.length >= 200, `the GET sweep sent only ${fake.queries.length} queries; it is not exercising the routes`);
    assert.deepEqual(refusals, [], `the tenant guard refused these, so the pages behind them fail:\n  ${refusals.join("\n  ")}`);
    // 500 is what lib/sonara-async-route-safety.cjs answers when a handler throws.
    // A deliberate failure here says 503 or 502 and a sentence; a 500 is a page
    // that crashed. The four asset-file routes did, on every request.
    assert.deepEqual(crashed, [], `these routes crashed (500):\n  ${crashed.join("\n  ")}`);
  });

  it("refuses nothing any POST route asks for, and none of them crashes, anonymous or signed in", async function sweepPosts() {
    this.timeout(120000);
    const routes = routesWith("post");
    // 343 when written.
    assert.ok(routes.length >= 250, `only ${routes.length} POST routes found; this sweep has gone blind`);

    for (const route of routes) {
      for (const [who, token] of [["anonymous", null], ["signed in", "token-a"]]) {
        current = `POST ${route.path} (${who})`;
        const call = request(app).post(concrete(route.path)).type("form").send(FORM).set("accept", "text/html").set("x-forwarded-for", nextClient());
        if (token) call.set("Authorization", `Bearer ${token}`);
        const response = await call.catch(() => null);
        if (response && response.status === 500) crashed.push(current);
      }
    }

    assert.ok(fake.queries.length >= 100, `the POST sweep sent only ${fake.queries.length} queries; it is not exercising the routes`);
    assert.deepEqual(refusals, [], `the tenant guard refused these, so the actions behind them fail:\n  ${refusals.join("\n  ")}`);
    assert.deepEqual(crashed, [], `these routes crashed (500):\n  ${crashed.join("\n  ")}`);
  });

  it("refuses nothing any PATCH or DELETE route asks for, and none of them crashes", async function sweepEdits() {
    this.timeout(60000);
    const routes = [...routesWith("patch").map((route) => ["patch", route]), ...routesWith("delete").map((route) => ["delete", route])];
    // 10 PATCH and 3 DELETE when written. They change rows rather than read them,
    // so an unscoped one is worse than an unscoped read -- and these are JSON
    // endpoints, so they are sent JSON.
    assert.ok(routes.length >= 8, `only ${routes.length} PATCH and DELETE routes found; this sweep has gone blind`);

    // Every one of them refuses an id that is not a uuid before it queries
    // anything. Sent "e1", the first version of this sweep reached nothing but the
    // sign-in and role lookups, in 38ms, and passed.
    const uuidPath = (routePath) => routePath.replace(/:([A-Za-z_]+)\??/g, (_, name) => (name === "resource" ? "customers" : EDIT_ID));
    for (const [method, route] of routes) {
      for (const [who, token] of [["anonymous", null], ["signed in", "token-a"]]) {
        current = `${method.toUpperCase()} ${route.path} (${who})`;
        const call = request(app)[method](uuidPath(route.path)).send({ ...FORM, id: EDIT_ID, status: "draft" }).set("accept", "application/json").set("x-forwarded-for", nextClient());
        if (token) call.set("Authorization", `Bearer ${token}`);
        const response = await call.catch(() => null);
        if (response && response.status === 500) crashed.push(current);
      }
    }

    // Past sign-in and into the routes' own tables, or this measured nothing.
    const own = new Set(fake.queries.map((query) => query.table).filter((table) => !["user_roles", "organization_memberships"].includes(table)));
    assert.ok(own.size >= 4, `the edit sweep reached only ${[...own].join(", ") || "sign-in lookups"}; it is not exercising the routes`);
    assert.deepEqual(refusals, [], `the tenant guard refused these:\n  ${refusals.join("\n  ")}`);
    assert.deepEqual(crashed, [], `these routes crashed (500):\n  ${crashed.join("\n  ")}`);
  });

  // ---------------------------------------------------------------------------
  // The pages a stranger opens, and the actions behind them, one by one
  // ---------------------------------------------------------------------------

  const PAGES = [
    { method: "GET", path: "/events/spring-fair", reads: "growth_events", shows: "SPRING-FAIR" },
    { method: "GET", path: "/store/corner-shop", reads: "merchant_storefronts", shows: "CORNER-SHOP" },
    { method: "GET", path: "/creator/nova", reads: "creator_artist_profiles", shows: "NOVA-ARTIST" },
    { method: "GET", path: "/chat/ask-us", reads: "lead_capture_pages", shows: "ASK-US-PAGE" },
    { method: "GET", path: "/s/my-scroll", reads: "scroll_sites", shows: "MY-SCROLL-HEADING" },
    { method: "GET", path: "/account/following", token: "token-a", reads: "creator_artist_profiles", shows: "NOVA-ARTIST" },
    {
      method: "POST", path: "/events/spring-fair", reads: "growth_events", writes: "growth_event_rsvps",
      form: { display_name: "Pat", email: "pat@example.com", party_size: "2", attending: "true" }, shows: "You are confirmed"
    },
    {
      method: "POST", path: "/api/growth/events/publish", token: "token-a", reads: "growth_events",
      form: { event_id: "e1", slug: "spring-fair-two" }, redirects: /done=published/
    },
    {
      method: "POST", path: "/api/lead-capture-page", token: "token-a", reads: "lead_capture_pages",
      form: { slug: "ask-us-two", enabled: "on" }, redirects: /^\/growth-studio\/owner\/chat-widget(\?(?!problem)|$)/
    },
    {
      method: "POST", path: `/api/creator-profiles/${PROFILE}/follow`, token: "token-a", reads: "creator_artist_profiles",
      writes: "creator_follows", form: {}, redirects: /^\/creator\/nova$/
    }
  ];

  for (const page of PAGES) {
    it(`${page.method} ${page.path} reads ${page.reads} past the guard and uses what it read`, async () => {
      current = `${page.method} ${page.path}`;
      let call = page.method === "GET"
        ? request(app).get(page.path)
        : request(app).post(page.path).type("form").send(page.form);
      call = call.set("accept", "text/html").set("x-forwarded-for", nextClient());
      if (page.token) call = call.set("Authorization", `Bearer ${page.token}`);
      const response = await call;
      // What the page said, so a failure here reads as the page's own sentence.
      const said = `${response.status}: ${String(response.text || "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240)}`;

      assert.deepEqual(refusals, [], `the guard refused part of ${page.path}:\n  ${refusals.join("\n  ")}`);
      assert.ok(
        fake.queries.some((query) => query.table === page.reads && query.method === "GET"),
        `${page.path} never read ${page.reads}; read: ${[...new Set(fake.queries.map((query) => query.table))].join(", ")}`
      );
      if (page.writes) {
        assert.ok(
          fake.queries.some((query) => query.table === page.writes && query.method === "POST"),
          `${page.path} never wrote ${page.writes}; it answered ${said}`
        );
      }
      assert.notEqual(response.status, 503, `${page.path} answered 503 -- the failed-read page`);
      if (page.shows) {
        assert.equal(response.status, 200, `${page.path} answered ${response.status}`);
        assert.ok(response.text.includes(page.shows), `${page.path} rendered without ${page.shows}`);
      }
      if (page.redirects) {
        assert.equal(response.status, 303, `${page.path} answered ${response.status}`);
        assert.match(String(response.headers.location || ""), page.redirects);
      }
    });
  }

  it("lets a business manager's storefront address check past the guard", async () => {
    // Behind requireUnlockedBusinessManager in server.js, which the sweep cannot
    // unlock. The real route module, with only that middleware replaced; the
    // fetch it calls is still the guarded one.
    const registerMerchantStoreRoutes = require("../routes/sonara-merchant-store-routes.cjs");
    const shop = express();
    shop.use(express.urlencoded({ extended: false }));
    registerMerchantStoreRoutes(shop, {
      layout: ({ heading, body }) => `<h1>${heading}</h1><p>${body}</p>`,
      brandCard: (title, body) => `<section><h2>${title}</h2>${body}</section>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value),
      requireBusinessManager: (req, res, next) => { req.sonaraUser = { id: USER }; next(); },
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG }),
      getSupabaseServerConfig: () => ({ ok: true, url: SUPABASE, serviceRoleKey: "service-role-placeholder" }),
      supabaseHeaders: () => ({ apikey: "service-role-placeholder" }),
      createRateLimiter: () => (req, res, next) => next()
    });

    current = "POST /api/business/storefront/publish";
    const response = await request(shop).post("/api/business/storefront/publish").type("form")
      .send({ slug: "corner-shop", publish: "true" }).set("accept", "text/html").set("x-forwarded-for", nextClient());

    assert.deepEqual(refusals, [], `the guard refused the storefront address check:\n  ${refusals.join("\n  ")}`);
    assert.ok(
      fake.queries.some((query) => query.table === "merchant_storefronts" && /select=organization_id/.test(query.search) && /slug=eq\./.test(query.search)),
      "the address check never reached merchant_storefronts"
    );
    assert.equal(response.status, 303);
    assert.doesNotMatch(String(response.headers.location || ""), /problem=save_failed/, "the address check still failed");
  });

  // ---------------------------------------------------------------------------
  // The exemptions stay as narrow as the lookups they were written for
  // ---------------------------------------------------------------------------

  describe("each public-page exemption admits its lookup and nothing wider", () => {
    const allowed = (query) => tenantGuard.inspect("GET", `${SUPABASE}/rest/v1/${query}`).allowed;
    const EVENT = "id,organization_id,venue_id,title,summary,kind,status,starts_at,ends_at,capacity,slug,cancellation_reason";

    it("admits the event lookup only as written", () => {
      assert.equal(allowed(`growth_events?select=${EVENT}&slug=eq.spring-fair&status=neq.draft&limit=1`), true);
      // A draft must stay unreachable.
      assert.equal(allowed(`growth_events?select=${EVENT}&slug=eq.spring-fair&limit=1`), false);
      assert.equal(allowed(`growth_events?select=${EVENT}&slug=eq.spring-fair&status=eq.draft&limit=1`), false);
      // A column nobody reviewed for a public page.
      assert.equal(allowed(`growth_events?select=${EVENT},metadata&slug=eq.spring-fair&status=neq.draft&limit=1`), false);
      assert.equal(allowed("growth_events?select=*&slug=eq.spring-fair&status=neq.draft&limit=1"), false);
      // An enumeration rather than a lookup.
      assert.equal(allowed(`growth_events?select=${EVENT}&slug=like.*&status=neq.draft&limit=1`), false);
      assert.equal(allowed(`growth_events?select=${EVENT}&slug=eq.spring-fair&status=neq.draft&limit=100`), false);
      assert.equal(allowed(`growth_events?select=${EVENT}&slug=eq.spring-fair&status=neq.draft&limit=1&or=(slug.eq.x)`), false);
      assert.equal(allowed(`growth_events?select=${EVENT}&slug=eq.a&slug=eq.b&status=neq.draft&limit=1`), false);
    });

    it("admits the address checks with one column, never a row", () => {
      assert.equal(allowed("growth_events?select=id&slug=eq.spring-fair&limit=1"), true);
      assert.equal(allowed("growth_events?select=id,title&slug=eq.spring-fair&limit=1"), false);
      assert.equal(allowed("merchant_storefronts?select=organization_id&slug=eq.corner-shop&limit=1"), true);
      assert.equal(allowed("merchant_storefronts?select=organization_id,headline&slug=eq.corner-shop&limit=1"), false);
      assert.equal(allowed("lead_capture_pages?slug=eq.ask-us&select=organization_id&limit=1"), true);
      assert.equal(allowed("lead_capture_pages?slug=eq.ask-us&select=*&limit=1"), false);
    });

    it("keeps an unpublished creator's draft content out of every creator lookup", () => {
      assert.equal(allowed("creator_artist_profiles?select=id,artist_name&public_handle=eq.nova&status=eq.active&limit=1"), true);
      assert.equal(allowed("creator_artist_profiles?select=id,organization_id&public_handle=eq.nova&status=eq.active&limit=1"), false);
      // By id, only whether it is published -- never its name.
      assert.equal(allowed(`creator_artist_profiles?select=id,public_handle&id=eq.${PROFILE}&status=eq.active&limit=1`), true);
      assert.equal(allowed(`creator_artist_profiles?select=id,artist_name&id=eq.${PROFILE}&status=eq.active&limit=1`), false);
      // The follower list, only for published profiles and only by uuid.
      const list = `id=in.(%22${PROFILE}%22)`;
      assert.equal(allowed(`creator_artist_profiles?select=id,artist_name&${list}&public_handle=not.is.null&status=eq.active`), true);
      assert.equal(allowed(`creator_artist_profiles?select=id,artist_name&${list}&status=eq.active`), false);
      assert.equal(allowed("creator_artist_profiles?select=id,artist_name&id=in.(%22nova%22)&public_handle=not.is.null&status=eq.active"), false);
    });

    it("admits the shop, chat and scroll lookups only for published rows", () => {
      const shopColumns = "id,organization_id,slug,enabled,headline,intro,currency,accepts_orders";
      assert.equal(allowed(`merchant_storefronts?select=${shopColumns}&slug=eq.corner-shop&enabled=eq.true&limit=1`), true);
      assert.equal(allowed(`merchant_storefronts?select=${shopColumns}&slug=eq.corner-shop&enabled=eq.false&limit=1`), false);
      assert.equal(allowed("lead_capture_pages?slug=eq.ask-us&enabled=is.true&select=id,organization_id,slug,headline,greeting,closing&limit=1"), true);
      assert.equal(allowed("lead_capture_pages?slug=eq.ask-us&enabled=is.false&select=id,organization_id,slug,headline,greeting,closing&limit=1"), false);
      assert.equal(allowed("scroll_sites?select=title,document,slug&slug=eq.my-scroll&published_at=not.is.null&limit=1"), true);
      assert.equal(allowed("scroll_sites?select=title,document,slug&slug=eq.my-scroll&limit=1"), false);
      assert.equal(allowed("scroll_sites?select=title,document,slug,organization_id&slug=eq.my-scroll&published_at=not.is.null&limit=1"), false);
    });

    it("refuses every public-page exemption to a write", () => {
      for (const [table, query] of [
        ["growth_events", `select=${EVENT}&slug=eq.spring-fair&status=neq.draft&limit=1`],
        ["scroll_sites", "select=title,document,slug&slug=eq.my-scroll&published_at=not.is.null&limit=1"]
      ]) {
        for (const method of ["PATCH", "DELETE"]) {
          assert.equal(tenantGuard.inspect(method, `${SUPABASE}/rest/v1/${table}?${query}`).allowed, false, `${method} ${table} was let through`);
        }
      }
    });
  });
});
