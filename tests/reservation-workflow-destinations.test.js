"use strict";

const assert = require("node:assert/strict");
const register = require("../routes/sonara-operations-expansion-routes.cjs");
const { RESOURCE_PAGE, WAITLIST_PAGE } = require("../lib/sonara-reservation-pages.cjs");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const WORKSPACE = "33333333-3333-4333-8333-333333333333";
const RESOURCE = "44444444-4444-4444-8444-444444444444";
const BOOKING = "55555555-5555-4555-8555-555555555555";
const LOCATION = "66666666-6666-4666-8666-666666666666";
const USER = "77777777-7777-4777-8777-777777777777";
const foreign = "88888888-8888-4888-8888-888888888888";
const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

function tables() {
  return {
    business_assets: [
      { id: RESOURCE, organization_id: ORG, name: "Window table", status: "active", asset_type: "other",
        metadata: { bookable: true, resource_type: "table", capacity: 4 } },
      { id: foreign, organization_id: OTHER, name: "Foreign private room", status: "active",
        metadata: { bookable: true } }
    ],
    business_locations: [{ id: LOCATION, organization_id: ORG, name: "Front room", status: "active" }],
    business_bookings: [
      { id: BOOKING, organization_id: ORG, customer_name: "Waiting customer", customer_email: "customer@example.com",
        status: "requested", metadata: { waitlist: true, waitlist_state: "waiting", resource_ids: [RESOURCE], party_size: 2 },
        created_at: "2026-10-01T12:00:00Z" },
      { id: foreign, organization_id: OTHER, customer_name: "Foreign private customer", status: "requested",
        metadata: { waitlist: true, waitlist_state: "waiting" } }
    ]
  };
}

describe("reservation resources and waitlist destinations", () => {
  let previousFetch;
  beforeEach(() => { previousFetch = global.fetch; });
  afterEach(() => { global.fetch = previousFetch; });

  function world({ seed = tables(), intercept, denied = false, scope = ORG } = {}) {
    const fake = createFakeSupabase({ tables: seed, ids: "uuid" });
    const fetch = fake.install(async () => { throw new Error("external fetch refused"); });
    global.fetch = async (url, init = {}) => intercept?.(new URL(url), init, fake, fetch) ?? fetch(url, init);
    const registered = new Map();
    let guards = 0;
    const deps = {
      layout: ({ title, sections, actions }) => "<main><h1>" + escape(title) + "</h1>" + actions.join("") + sections.join("") + "</main>",
      linkAction: (href, label) => '<a href="' + escape(href) + '">' + escape(label) + "</a>",
      escapeHtml: escape,
      requireBusinessManager: (req, res, next) => {
        guards += 1;
        if (denied) return res.status(403).json({ ok: false, code: "business_forbidden" });
        req.sonaraUser = { id: USER };
        req.sonaraBusinessMembership = { organization_id: scope, workspace_id: WORKSPACE, role: "manager", status: "active" };
        return next();
      },
      getCustomerPrimaryOrganization: async (_user, options) => {
        assert.equal(options.autoBootstrap, false);
        return { ok: true, organizationId: scope };
      },
      getSupabaseServerConfig: () => ({ ok: true, url: fake.url }),
      supabaseHeaders: () => ({})
    };
    const app = {};
    for (const method of ["get", "post"]) app[method] = (path, ...handlers) => registered.set(method + " " + path, handlers);
    register(app, deps);
    async function call(method, path, { body = {}, params = {}, query = {}, html = false } = {}) {
      const handlers = registered.get(method.toLowerCase() + " " + path);
      assert.equal(handlers.length, 2, "every operation uses the manager gate");
      const req = { body, params, query, get: (name) => name === "accept" ? html ? "text/html" : "application/json" : "" };
      const res = {
        statusCode: 200, headers: {}, status(n) { this.statusCode = n; return this; },
        set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
        type(value) { this.typeValue = value; return this; },
        json(value) { this.jsonValue = value; return this; }, send(value) { this.html = value; return this; },
        redirect(status, location) { this.statusCode = status; this.location = location; return this; }
      };
      await handlers[0](req, res, () => handlers[1](req, res));
      return res;
    }
    return { fake, call, guardCount: () => guards };
  }
  function mutations(fake) { return fake.queries.filter((q) => ["POST", "PATCH"].includes(q.method)); }

  it("renders scoped resources, real form actions and the selected workspace", async () => {
    const { call, fake } = world();
    const res = await call("get", RESOURCE_PAGE, { html: true });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["cache-control"], "private, no-store");
    assert.match(res.html, /Window table/);
    assert.doesNotMatch(res.html, /Foreign private/);
    assert.match(res.html, /method="post" action="\/api\/business\/reservation-resources"/);
    assert.match(res.html, /name="workspaceId" value="33333333/);
    assert.match(res.html, /owner\/waitlist\?workspaceId=/);
    assert.ok(fake.queries.every((q) => q.filters.some((f) => f.column === "organization_id" && f.value === ORG)));
  });

  it("shares each organization-scoped reader once between the waiting-list page and its JSON twins", async () => {
    const { call, fake } = world();
    const page = await call("get", WAITLIST_PAGE, { html: true });
    assert.equal(page.statusCode, 200);
    const bookingReads = () => fake.queries.filter((query) => query.table === "business_bookings");
    const assetReads = () => fake.queries.filter((query) => query.table === "business_assets");
    assert.equal(bookingReads().length, 1, "page must call the shared waitlist reader once");
    assert.equal(assetReads().length, 1, "page must call the shared resource reader once");
    assert.ok([...bookingReads(), ...assetReads()].every((query) =>
      query.filters.some((filter) => filter.column === "organization_id" && filter.value === ORG)));

    const waitlistJson = await call("get", "/api/business/waitlist");
    const resourceJson = await call("get", "/api/business/reservation-resources");
    assert.equal(waitlistJson.statusCode, 200);
    assert.equal(resourceJson.statusCode, 200);
    assert.equal(bookingReads().length, 2, "JSON waitlist has one separately scoped read");
    assert.equal(assetReads().length, 2, "JSON resources have one separately scoped read");
    assert.ok(JSON.stringify(waitlistJson.jsonValue).includes("Waiting customer"));
    assert.ok(JSON.stringify(resourceJson.jsonValue).includes("Window table"));
    assert.doesNotMatch(JSON.stringify(waitlistJson.jsonValue), /Foreign private/);
    assert.doesNotMatch(JSON.stringify(resourceJson.jsonValue), /Foreign private/);
  });

  it("renders the actual create and offer forms with a route to the existing booking", async () => {
    const { call } = world();
    const res = await call("get", WAITLIST_PAGE, { html: true });
    assert.match(res.html, /method="post" action="\/api\/business\/waitlist"/);
    assert.ok(res.html.includes('action="/api/business/waitlist/' + BOOKING + '/offer"'));
    assert.ok(res.html.includes("/owner/bookings/" + BOOKING + "?workspaceId="));
    assert.match(res.html, /Contact the customer directly/);
    assert.doesNotMatch(res.html, /Foreign private/);
  });

  it("denies pages and every mutation before any database access", async () => {
    const { call, fake, guardCount } = world({ denied: true });
    for (const [method, path] of [["get", RESOURCE_PAGE], ["get", WAITLIST_PAGE],
      ["post", "/api/business/reservation-resources"], ["post", "/api/business/waitlist"],
      ["post", "/api/business/waitlist/:bookingId/offer"]]) {
      assert.equal((await call(method, path)).statusCode, 403);
    }
    assert.equal(guardCount(), 5);
    assert.equal(fake.queries.length, 0);
  });

  it("escapes stored record names and submitted values in HTML", async () => {
    const seed = tables();
    seed.business_assets[0].name = '<img src=x onerror="attack()">';
    const { call } = world({ seed });
    const read = await call("get", RESOURCE_PAGE, { html: true });
    assert.match(read.html, /&lt;img/);
    assert.doesNotMatch(read.html, /<img/);
    const failed = await call("post", "/api/business/waitlist", { html: true,
      body: { customer_name: '"><script>attack()</script>', party_size: "1.5", notes: "<unsafe>" } });
    assert.equal(failed.statusCode, 400);
    assert.match(failed.html, /&lt;script&gt;/);
    assert.match(failed.html, /&lt;unsafe&gt;/);
    assert.doesNotMatch(failed.html, /<script\b/i);
    const mixedCase = await call("post", "/api/business/waitlist", { html: true,
      body: { customer_name: '\"><ScRiPt src=x>attack()</ScRiPt >', party_size: "1.5" } });
    assert.equal(mixedCase.statusCode, 400);
    assert.match(mixedCase.html, /&lt;ScRiPt src=x&gt;/);
    assert.doesNotMatch(mixedCase.html, /<script\b/i);
  });

  it("shows failed and malformed reads as unavailable rather than an empty list", async () => {
    for (const malformed of [false, true]) {
      const { call } = world({ intercept: (url) => url.pathname.endsWith("business_assets")
        ? new Response(JSON.stringify(malformed ? { invalid: [] } : {}), { status: malformed ? 200 : 503 }) : undefined });
      const page = await call("get", RESOURCE_PAGE, { html: true });
      assert.equal(page.statusCode, 503);
      assert.match(page.html, /We could not read your resources/);
      assert.doesNotMatch(page.html, /No resources yet/);
      const api = await call("get", "/api/business/reservation-resources");
      assert.equal(api.statusCode, 503);
      assert.equal(api.jsonValue.ok, false);
    }
  });

  it("labels truncated lists and filters out ordinary assets and completed bookings", async () => {
    const seed = tables();
    seed.business_assets = Array.from({ length: 202 }, (_, i) => ({
      id: String(i), organization_id: ORG, name: "Resource " + i, status: "active", metadata: { bookable: true }
    }));
    seed.business_assets.push({ id: "ordinary", organization_id: ORG, name: "Ordinary asset",
      status: "active", metadata: { bookable: false } });
    seed.business_bookings[0].status = "confirmed";
    const { call } = world({ seed });
    const page = await call("get", RESOURCE_PAGE, { html: true });
    assert.match(page.html, /There may be more records/);
    assert.doesNotMatch(page.html, /Ordinary asset/);
    const wait = await call("get", WAITLIST_PAGE, { html: true });
    assert.doesNotMatch(wait.html, /Waiting customer/);
    const api = await call("get", "/api/business/reservation-resources");
    assert.equal(api.jsonValue.resources.length, 202);
    assert.equal(api.jsonValue.partial, false);
  });

  it("retains the legacy JSON shapes while adding explicit truncation evidence", async () => {
    const { call } = world();
    const resource = await call("get", "/api/business/reservation-resources");
    assert.equal(resource.jsonValue.resources[0].id, RESOURCE);
    assert.equal(resource.jsonValue.partial, false);
    const wait = await call("get", "/api/business/waitlist");
    assert.equal(wait.jsonValue.waitlist[0].id, BOOKING);
    assert.equal(wait.jsonValue.partial, false);
  });

  it("posts a resource in the verified organization and redirects native forms to that workspace", async () => {
    const { call, fake } = world();
    const res = await call("post", "/api/business/reservation-resources", { html: true,
      body: { name: "Quiet room", resource_type: "room", capacity: "8", location_id: LOCATION, organization_id: OTHER } });
    assert.equal(res.statusCode, 303);
    assert.equal(res.location, RESOURCE_PAGE + "?workspaceId=" + WORKSPACE + "&saved=resource");
    const inserted = mutations(fake)[0];
    assert.equal(inserted.table, "business_assets");
    assert.equal(inserted.body.organization_id, ORG);
    assert.equal(inserted.body.asset_type, "other");
    assert.equal(inserted.body.metadata.resource_type, "room");
    assert.equal(inserted.body.metadata.capacity, 8);
  });

  it("rejects fractional, empty, nonnumeric, array and oversized capacities without inserting", async () => {
    const { call, fake } = world();
    for (const capacity of ["", "1.5", "NaN", "Infinity", 0, -1, 1001, [2], true]) {
      const res = await call("post", "/api/business/reservation-resources", { body: { name: "Room", capacity } });
      assert.equal(res.statusCode, 400, "capacity " + String(capacity));
      assert.equal(res.jsonValue.code, "invalid_capacity");
    }
    assert.equal(mutations(fake).length, 0);
  });

  it("refuses a location from a different business before saving", async () => {
    const seed = tables();
    seed.business_locations.push({ id: foreign, organization_id: OTHER, name: "Foreign" });
    const { call, fake } = world({ seed });
    const res = await call("post", "/api/business/reservation-resources", { body: { name: "Room", location_id: foreign } });
    assert.equal(res.statusCode, 404);
    assert.equal(mutations(fake).length, 0);
  });

  it("keeps a submitted draft and warns before retrying an unconfirmed save", async () => {
    const { call } = world({ intercept: (url, init) => init.method === "POST" && url.pathname.endsWith("business_assets")
      ? new Response("[]", { status: 201 }) : undefined });
    const res = await call("post", "/api/business/reservation-resources", { html: true,
      body: { name: "Draft room", capacity: "6", notes: "Keep these notes" } });
    assert.equal(res.statusCode, 502);
    assert.match(res.html, /value="Draft room"/);
    assert.match(res.html, /Keep these notes/);
    assert.match(res.html, /Check the list before trying to add it again/);
  });

  it("saves a native waitlist form with one selected resource and explicit UTC times", async () => {
    const { call, fake } = world();
    const before = process.env.TZ;
    process.env.TZ = "Pacific/Honolulu";
    try {
      const res = await call("post", "/api/business/waitlist", { html: true,
        body: { customer_name: "Mina", customer_email: "mina@example.com", party_size: "3",
          resource_ids: RESOURCE, preferred_start: "2026-10-08T14:00", preferred_end: "2026-10-08T15:00",
          organization_id: OTHER } });
      assert.equal(res.statusCode, 303);
      assert.equal(res.location, WAITLIST_PAGE + "?workspaceId=" + WORKSPACE + "&saved=waitlist");
      const body = mutations(fake)[0].body;
      assert.equal(body.organization_id, ORG);
      assert.deepEqual(body.metadata.resource_ids, [RESOURCE]);
      assert.equal(body.metadata.preferred_start, "2026-10-08T14:00:00.000Z");
      assert.equal(body.metadata.preferred_end, "2026-10-08T15:00:00.000Z");
      assert.equal(body.metadata.party_size, 3);
      assert.equal(body.status, "requested");
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });

  it("refuses unavailable, inactive, nonbookable and foreign resources without a write", async () => {
    for (const edit of [
      (seed) => { seed.business_assets[0].status = "inactive"; },
      (seed) => { seed.business_assets[0].metadata.bookable = false; },
      (seed) => { seed.business_assets[0].organization_id = OTHER; },
      (seed) => { seed.business_assets = []; }
    ]) {
      const seed = tables(); edit(seed);
      const { call, fake } = world({ seed });
      const res = await call("post", "/api/business/waitlist", { body: { customer_name: "Mina", resource_ids: [RESOURCE] } });
      assert.equal(res.statusCode, 404);
      assert.equal(res.jsonValue.code, "resource_not_available");
      assert.equal(mutations(fake).length, 0);
    }
  });

  it("checks every supplied foreign key in the current business before inserting", async () => {
    for (const [column, table] of [["location_id", "business_locations"], ["service_id", "business_service_catalog"],
      ["assigned_employee_id", "business_employee_profiles"], ["customer_id", "customers"]]) {
      const seed = tables();
      seed[table] = [{ id: foreign, organization_id: OTHER }];
      const { call, fake } = world({ seed });
      const res = await call("post", "/api/business/waitlist", { body: { customer_name: "Mina", [column]: foreign } });
      assert.equal(res.statusCode, 404, column);
      assert.equal(mutations(fake).length, 0);
      const lookup = fake.queries.find((q) => q.table === table);
      assert.ok(lookup.filters.some((f) => f.column === "organization_id" && f.value === ORG));
    }
  });

  it("rejects invalid contact, size, resources and calendar dates before a mutation", async () => {
    const { call, fake } = world();
    for (const body of [{}, { customer_name: "Mina", customer_email: "invalid" },
      { customer_name: "Mina", party_size: 2.2 }, { customer_name: "Mina", resource_ids: { id: RESOURCE } },
      { customer_name: "Mina", preferred_start: "2026-02-31T12:00" },
      { customer_name: "Mina", preferred_start: "yesterday" },
      { customer_name: "Mina", preferred_start: "2026-10-08T15:00", preferred_end: "2026-10-08T14:00" }]) {
      assert.equal((await call("post", "/api/business/waitlist", { body })).statusCode, 400);
    }
    assert.equal(mutations(fake).length, 0);
  });

  it("records the offer once, preserves metadata and never claims customer notification", async () => {
    const { call, fake } = world();
    const args = { params: { bookingId: BOOKING } };
    const first = await call("post", "/api/business/waitlist/:bookingId/offer", args);
    assert.equal(first.statusCode, 200);
    assert.equal(first.jsonValue.customerNotified, false);
    assert.equal(first.jsonValue.entry.metadata.waitlist_state, "offered");
    assert.equal(first.jsonValue.entry.metadata.offered_by, USER);
    assert.deepEqual(first.jsonValue.entry.metadata.resource_ids, [RESOURCE]);
    const offeredAt = first.jsonValue.entry.metadata.offered_at;
    const second = await call("post", "/api/business/waitlist/:bookingId/offer", args);
    assert.equal(second.jsonValue.alreadyOffered, true);
    assert.equal(second.jsonValue.entry.metadata.offered_at, offeredAt);
    assert.equal(mutations(fake).length, 1);
    const patch = mutations(fake)[0];
    assert.ok(patch.filters.some((f) => f.column === "status" && f.value === "requested"));
    assert.deepEqual(JSON.parse(patch.filters.find((f) => f.column === "metadata").value),
      { waitlist: true, waitlist_state: "waiting", resource_ids: [RESOURCE], party_size: 2 });
  });

  it("does not offer a closed or foreign entry", async () => {
    for (const state of ["booked", "cancelled", "expired"]) {
      const seed = tables(); seed.business_bookings[0].metadata.waitlist_state = state;
      const { call, fake } = world({ seed });
      const res = await call("post", "/api/business/waitlist/:bookingId/offer", { params: { bookingId: BOOKING } });
      assert.equal(res.statusCode, 409);
      assert.equal(mutations(fake).length, 0);
    }
    const { call, fake } = world();
    const res = await call("post", "/api/business/waitlist/:bookingId/offer", { params: { bookingId: foreign } });
    assert.equal(res.statusCode, 404);
    assert.equal(mutations(fake).length, 0);
  });

  it("does not overwrite a concurrent metadata change", async () => {
    let raced = false;
    const { call, fake } = world({ intercept: async (url, init, db, fetch) => {
      if (init.method !== "PATCH" || raced) return fetch(url.href, init);
      raced = true;
      await fetch(db.url + "/rest/v1/business_bookings?organization_id=eq." + ORG + "&id=eq." + BOOKING,
        { method: "PATCH", body: JSON.stringify({ metadata: { waitlist: true, waitlist_state: "waiting", party_size: 9 } }) });
      return fetch(url.href, init);
    } });
    const res = await call("post", "/api/business/waitlist/:bookingId/offer", { params: { bookingId: BOOKING } });
    assert.equal(res.statusCode, 409);
    const row = fake.rows("business_bookings").find((item) => item.id === BOOKING);
    assert.equal(row.metadata.party_size, 9);
    assert.equal(row.metadata.waitlist_state, "waiting");
  });

  it("does not revive a booking confirmed between the read and the offer write", async () => {
    let raced = false;
    const { call, fake } = world({ intercept: async (url, init, db, fetch) => {
      if (init.method !== "PATCH" || raced) return fetch(url.href, init);
      raced = true;
      await fetch(db.url + "/rest/v1/business_bookings?organization_id=eq." + ORG + "&id=eq." + BOOKING,
        { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) });
      return fetch(url.href, init);
    } });
    const res = await call("post", "/api/business/waitlist/:bookingId/offer", { params: { bookingId: BOOKING } });
    assert.equal(res.statusCode, 409);
    const row = fake.rows("business_bookings").find((item) => item.id === BOOKING);
    assert.equal(row.status, "confirmed");
    assert.equal(row.metadata.waitlist_state, "waiting");
  });

  it("distinguishes an unreadable offer lookup from a missing entry", async () => {
    const { call, fake } = world({ intercept: (url, init) => url.pathname.endsWith("business_bookings") && init.method === "GET"
      ? new Response("{}", { status: 503 }) : undefined });
    const res = await call("post", "/api/business/waitlist/:bookingId/offer", { params: { bookingId: BOOKING } });
    assert.equal(res.statusCode, 503);
    assert.equal(mutations(fake).length, 0);
  });
});
