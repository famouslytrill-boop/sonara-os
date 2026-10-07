"use strict";
const assert = require("node:assert/strict");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");

const USER = "22222222-2222-4222-8222-222222222222";
const PRIMARY = "11111111-1111-4111-8111-111111111111";
const BUSINESS = "44444444-4444-4444-8444-444444444444";
const WORKSPACE = "66666666-6666-4666-8666-666666666666";
const UNKNOWN = "88888888-8888-4888-8888-888888888888";
const RESOURCE = "55555555-5555-4555-8555-555555555555";
const BOOKING = "77777777-7777-4777-8777-777777777777";
const RESOURCE_PAGE = "/business-builder/owner/reservation-resources";
const WAITLIST_PAGE = "/business-builder/owner/waitlist";
const ENV = {
  SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon_booking_workflow_fixture_1234567890",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon_booking_workflow_fixture_1234567890",
  SUPABASE_SERVICE_ROLE_KEY: "service_role_booking_workflow_fixture_1234567890"
};

describe("a manager turns a waitlist entry into a recorded booking offer", function realWorkflow() {
  this.timeout(30000);
  let app, previousFetch, previousEnv;
  before(() => {
    previousFetch = global.fetch;
    previousEnv = Object.fromEntries(Object.keys(ENV).map((key) => [key, process.env[key]]));
    Object.assign(process.env, ENV);
    app = require("../server");
  });
  afterEach(() => { global.fetch = previousFetch; });
  after(() => {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  function world(edit = () => {}) {
    Object.assign(process.env, ENV);
    const tables = {
      organization_memberships: [{ user_id: USER, organization_id: PRIMARY, role: "member", status: "active", created_at: "2026-01-01T00:00:00Z" }],
      business_memberships: [{ id: WORKSPACE, user_id: USER, organization_id: BUSINESS,
        workspace_id: WORKSPACE, role: "manager", status: "active", created_at: "2026-02-01T00:00:00Z" }],
      business_assets: [
        { id: PRIMARY, organization_id: PRIMARY, name: "Private primary resource", status: "active", metadata: { bookable: true } },
        { id: RESOURCE, organization_id: BUSINESS, name: "Window table", status: "active", asset_type: "other",
          metadata: { bookable: true, resource_type: "table", capacity: 4 } }
      ],
      business_bookings: [{ id: BOOKING, organization_id: BUSINESS, customer_name: "Rae",
        status: "requested", metadata: { waitlist: true, waitlist_state: "waiting" }, created_at: "2026-10-01T00:00:00Z" }]
    };
    edit(tables);
    const fake = createFakeSupabase({ url: ENV.SUPABASE_URL, ids: "uuid", tables,
      users: { "token-booking-workflow": { id: USER, email: "manager@example.com" } } });
    global.fetch = fake.install(async () => { throw new Error("external fixture request refused"); });
    return fake;
  }
  function get(path, workspace = WORKSPACE) {
    const pending = request(app).get(path).set("accept", "text/html").set("authorization", "Bearer token-booking-workflow");
    return new URL(path, "http://fixture.invalid").searchParams.has("workspaceId")
      ? pending : pending.query({ workspaceId: workspace });
  }
  function form(path, body) {
    return request(app).post(path).set("accept", "text/html").set("authorization", "Bearer token-booking-workflow")
      .type("form").send({ ...body, workspaceId: WORKSPACE });
  }
  function api(path, body) {
    return request(app).post(path).set("accept", "application/json").set("authorization", "Bearer token-booking-workflow")
      .set("x-business-workspace-id", WORKSPACE).send(body);
  }

  it("opens the scoped work screen and links to it from bookings", async () => {
    world();
    const resources = await get(RESOURCE_PAGE);
    assert.equal(resources.status, 200);
    assert.match(resources.headers["cache-control"], /private.*no-store/);
    assert.match(resources.text, /Window table/);
    assert.doesNotMatch(resources.text, /Private primary resource/);
    const bookings = await get("/business-builder/owner/bookings");
    assert.equal(bookings.status, 200);
    assert.ok(bookings.text.includes(RESOURCE_PAGE + "?workspaceId=" + WORKSPACE));
    assert.ok(bookings.text.includes(WAITLIST_PAGE + "?workspaceId=" + WORKSPACE));
  });

  it("completes a native resource-to-waitlist-to-offer workflow in the managed business", async () => {
    const fake = world();
    const created = await form("/api/business/reservation-resources",
      { name: "Quiet room", resource_type: "room", capacity: "6", organization_id: PRIMARY });
    assert.equal(created.status, 303);
    const resourcePage = await get(created.headers.location);
    assert.equal(resourcePage.status, 200);
    assert.match(resourcePage.text, /Quiet room/);
    const resource = fake.rows("business_assets").find((row) => row.name === "Quiet room");
    assert.equal(resource.organization_id, BUSINESS);
    const added = await form("/api/business/waitlist", { customer_name: "Mina", customer_email: "mina@example.com",
      resource_ids: resource.id, party_size: "3", preferred_start: "2026-10-08T14:00", preferred_end: "2026-10-08T15:00" });
    assert.equal(added.status, 303);
    const waitlist = await get(added.headers.location);
    assert.equal(waitlist.status, 200);
    assert.match(waitlist.text, /Mina/);
    const entry = fake.rows("business_bookings").find((row) => row.customer_name === "Mina");
    assert.equal(entry.organization_id, BUSINESS);
    const offer = await form("/api/business/waitlist/" + entry.id + "/offer", {});
    assert.equal(offer.status, 303);
    const recorded = await get(offer.headers.location);
    assert.equal(recorded.status, 200);
    assert.match(recorded.text, /Offer recorded/);
    const row = fake.rows("business_bookings").find((item) => item.id === entry.id);
    assert.equal(row.status, "requested");
    assert.equal(row.metadata.waitlist_state, "offered");
    assert.equal(row.metadata.offered_by, USER);
    const replay = await api("/api/business/waitlist/" + entry.id + "/offer", {});
    assert.equal(replay.status, 200);
    assert.equal(replay.body.alreadyOffered, true);
    assert.equal(replay.body.customerNotified, false);
    assert.equal(fake.queries.filter((q) => q.method === "PATCH" && q.table === "business_bookings").length, 1);
    assert.ok(fake.queries.filter((q) => q.method === "POST" && ["business_assets", "business_bookings"].includes(q.table))
      .every((q) => q.body.organization_id === BUSINESS));
  });

  it("refuses foreign related records through the real manager and tenant gates", async () => {
    const fake = world((tables) => { tables.customers = [{ id: PRIMARY, organization_id: PRIMARY, name: "Private customer" }]; });
    const response = await api("/api/business/waitlist", { customer_name: "Mina", customer_id: PRIMARY });
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "reference_not_found");
    assert.equal(fake.queries.filter((q) => q.table === "business_bookings" && q.method === "POST").length, 0);
  });

  it("denies an unowned workspace before reading any operational records", async () => {
    const fake = world();
    const response = await get(WAITLIST_PAGE, UNKNOWN);
    assert.equal(response.status, 403);
    assert.equal(fake.queries.filter((q) => ["business_bookings", "business_assets"].includes(q.table)).length, 0);
  });

  it("shows a failed read without calling it an empty waitlist", async () => {
    world();
    const fetch = global.fetch;
    global.fetch = (url, init) => new URL(url).pathname.endsWith("business_bookings")
      ? Promise.resolve(new Response("{}", { status: 503 })) : fetch(url, init);
    const response = await get(WAITLIST_PAGE);
    assert.equal(response.status, 503);
    assert.match(response.text, /We could not read your waitlist/);
    assert.doesNotMatch(response.text, /Nobody is waiting/);
  });

  it("does not revive a booking confirmed before the conditional offer write", async () => {
    const fake = world();
    const fetch = global.fetch;
    let raced = false;
    global.fetch = async (url, init = {}) => {
      if (init.method === "PATCH" && new URL(url).pathname.endsWith("business_bookings") && !raced) {
        raced = true;
        await fetch(fake.url + "/rest/v1/business_bookings?organization_id=eq." + BUSINESS + "&id=eq." + BOOKING,
          { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) });
      }
      return fetch(url, init);
    };
    const response = await api("/api/business/waitlist/" + BOOKING + "/offer", {});
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "waitlist_entry_changed");
    const row = fake.rows("business_bookings").find((item) => item.id === BOOKING);
    assert.equal(row.status, "confirmed");
    assert.equal(row.metadata.waitlist_state, "waiting");
  });
});
