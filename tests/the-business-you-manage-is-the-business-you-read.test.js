"use strict";

// Drive the deployed manager gate and delegated record APIs together.
// A primary member in A manages B and C: authorization and record scope must
// select the same business, including overlapping requests from one actor.
const assert = require("node:assert/strict");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");

const USER = "22222222-2222-4222-8222-222222222222";
const PRIMARY = "11111111-1111-4111-8111-111111111111";
const BUSINESS = "44444444-4444-4444-8444-444444444444";
const SECOND = "55555555-5555-4555-8555-555555555555";
const WORKSPACE = "66666666-6666-4666-8666-666666666666";
const OTHER_WORKSPACE = "77777777-7777-4777-8777-777777777777";
const UNKNOWN_WORKSPACE = "88888888-8888-4888-8888-888888888888";
const ENV = Object.freeze({
  SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon_manager_scope_fixture_1234567890",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon_manager_scope_fixture_1234567890",
  SUPABASE_SERVICE_ROLE_KEY: "service_role_manager_scope_fixture_1234567890"
});
const RECORD_TABLES = new Set(["business_assets", "business_bookings"]);

function membership(organizationId, workspaceId, role, createdAt) {
  return { id: workspaceId, user_id: USER, organization_id: organizationId,
    workspace_id: workspaceId, role, status: "active", created_at: createdAt };
}
function seed() {
  const organizations = [PRIMARY, BUSINESS, SECOND];
  return {
    organization_memberships: [{
      user_id: USER, organization_id: PRIMARY, role: "member", status: "active",
      created_at: "2026-01-01T00:00:00Z"
    }],
    business_memberships: [
      membership(BUSINESS, WORKSPACE, "manager", "2026-02-01T00:00:00Z"),
      membership(SECOND, OTHER_WORKSPACE, "owner", "2026-03-01T00:00:00Z")
    ],
    business_assets: organizations.map((organizationId, index) => ({
      id: organizationId, organization_id: organizationId,
      name: ["Primary private resource", "Managed resource", "Second resource"][index],
      asset_type: "equipment", status: "active", metadata: { bookable: true, capacity: 1 }
    })),
    business_bookings: organizations.map((organizationId, index) => ({
      id: organizationId, organization_id: organizationId,
      customer_name: ["Primary private customer", "Managed customer", "Second customer"][index],
      status: "requested", metadata: { waitlist: true, waitlist_state: "waiting" },
      created_at: "2026-06-01T00:00:00Z"
    }))
  };
}

describe("the business you manage is the business your record APIs read", function scopeThroughServer() {
  this.timeout(30000);
  let app;
  let savedFetch;
  let savedEnv;
  before(() => {
    savedFetch = global.fetch;
    savedEnv = Object.fromEntries(Object.keys(ENV).map((key) => [key, process.env[key]]));
    Object.assign(process.env, ENV);
    app = require("../server");
  });
  afterEach(() => { global.fetch = savedFetch; });
  after(() => {
    global.fetch = savedFetch;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function world(edit = () => {}) {
    // The shared suite resets environment between cases. Configure this offline
    // world each time, as the real-server commerce fixture does.
    Object.assign(process.env, ENV);
    const tables = seed();
    edit(tables);
    const fake = createFakeSupabase({
      url: ENV.SUPABASE_URL, ids: "uuid", tables,
      users: { "token-manager-scope": { id: USER, email: "manager@example.com" } }
    });
    global.fetch = fake.install(async (url) => {
      throw new Error("manager-scope fixture refused external request: " + String(url));
    });
    return fake;
  }
  function get(path, workspaceId = WORKSPACE) {
    return request(app).get(path).set("accept", "application/json")
      .set("Authorization", "Bearer token-manager-scope")
      .set("x-business-workspace-id", workspaceId);
  }
  function post(path, body, workspaceId = WORKSPACE) {
    return request(app).post(path).set("accept", "application/json")
      .set("Authorization", "Bearer token-manager-scope")
      .set("x-business-workspace-id", workspaceId).send(body);
  }
  function assertScoped(fake, expected, method = "GET") {
    const queries = fake.queries.filter((query) => RECORD_TABLES.has(query.table) && query.method === method);
    assert.ok(queries.length > 0, "the test reached no record query");
    for (const query of queries) {
      if (method === "POST") assert.equal(query.body.organization_id, expected);
      else assert.ok(query.filters.some((filter) => filter.column === "organization_id"
        && filter.operator === "eq" && filter.value === expected), JSON.stringify(query));
    }
    assert.equal(fake.queries.some((query) => query.table === "organization_memberships"), false,
      "a manager route fell back to the actor's different primary organization");
    assert.equal(fake.queries.some((query) => query.table === "rpc:sonara_bootstrap_customer_workspace"), false,
      "a delegated read created a different workspace");
  }

  it("reads bookable resources from the selected managed business", async () => {
    const fake = world();
    const response = await get("/api/business/reservation-resources");
    assert.equal(response.status, 200, response.text);
    assert.deepEqual(response.body.resources.map((row) => row.name), ["Managed resource"]);
    assertScoped(fake, BUSINESS);
  });

  it("reads the waitlist from the business that granted manager access", async () => {
    const fake = world();
    const response = await get("/api/business/waitlist");
    assert.equal(response.status, 200, response.text);
    assert.deepEqual(response.body.waitlist.map((row) => row.customer_name), ["Managed customer"]);
    assertScoped(fake, BUSINESS);
  });

  it("selects another authorized workspace without changing the primary membership", async () => {
    const fake = world();
    const response = await get("/api/business/waitlist", OTHER_WORKSPACE);
    assert.equal(response.status, 200, response.text);
    assert.deepEqual(response.body.waitlist.map((row) => row.customer_name), ["Second customer"]);
    assertScoped(fake, SECOND);
    assert.equal(fake.rows("organization_memberships")[0].organization_id, PRIMARY);
  });

  it("isolates simultaneous workspace requests for the same signed-in manager", async () => {
    const fake = world();
    const [first, second] = await Promise.all([
      get("/api/business/reservation-resources", WORKSPACE),
      get("/api/business/reservation-resources", OTHER_WORKSPACE)
    ]);
    assert.equal(first.status, 200, first.text);
    assert.equal(second.status, 200, second.text);
    assert.deepEqual(first.body.resources.map((row) => row.name), ["Managed resource"]);
    assert.deepEqual(second.body.resources.map((row) => row.name), ["Second resource"]);
    const reads = fake.queries.filter((query) => query.table === "business_assets");
    assert.equal(reads.length, 2);
    assert.deepEqual(reads.map((query) => query.filters.find((filter) => filter.column === "organization_id")?.value).sort(),
      [BUSINESS, SECOND].sort());
  });

  it("creates resources in the authorized business even when the body claims another organization", async () => {
    const fake = world();
    const response = await post("/api/business/reservation-resources", {
      name: "Added resource", capacity: 3, organization_id: PRIMARY, organizationId: PRIMARY
    }, OTHER_WORKSPACE);
    assert.equal(response.status, 201, response.text);
    assert.equal(response.body.resource.organization_id, SECOND);
    assertScoped(fake, SECOND, "POST");
    assert.equal(fake.rows("business_assets").filter((row) => row.organization_id === PRIMARY).length, 1);
  });

  it("creates a waiting customer in the business that authorized the write", async () => {
    const fake = world();
    const response = await post("/api/business/waitlist", {
      customer_name: "New managed customer", organization_id: PRIMARY, organizationId: PRIMARY
    });
    assert.equal(response.status, 201, response.text);
    assert.equal(response.body.entry.organization_id, BUSINESS);
    assertScoped(fake, BUSINESS, "POST");
    assert.equal(fake.rows("business_bookings").filter((row) => row.organization_id === PRIMARY).length, 1);
  });

  it("refuses an unrelated selected workspace before any record read or write", async () => {
    const fake = world();
    const read = await get("/api/business/waitlist", UNKNOWN_WORKSPACE);
    const write = await post("/api/business/waitlist", { customer_name: "No access" }, UNKNOWN_WORKSPACE);
    assert.equal(read.status, 403, read.text);
    assert.equal(write.status, 403, write.text);
    assert.deepEqual(fake.queries.filter((query) => RECORD_TABLES.has(query.table)), []);
  });

  it("refuses a selected workspace where the actor is only an employee", async () => {
    const fake = world((tables) => { tables.business_memberships[0].role = "employee"; });
    const response = await get("/api/business/waitlist");
    assert.equal(response.status, 403, response.text);
    assert.deepEqual(fake.queries.filter((query) => RECORD_TABLES.has(query.table)), []);
  });

  it("refuses an inactive management membership", async () => {
    const fake = world((tables) => { tables.business_memberships[0].status = "inactive"; });
    const response = await get("/api/business/reservation-resources");
    assert.equal(response.status, 403, response.text);
    assert.deepEqual(fake.queries.filter((query) => RECORD_TABLES.has(query.table)), []);
  });

  it("refuses an unreadable organization on a returned membership instead of reading the primary business", async () => {
    const fake = world((tables) => { tables.business_memberships[0].organization_id = "invalid-organization"; });
    const response = await get("/api/business/waitlist");
    assert.equal(response.status, 403, response.text);
    assert.deepEqual(fake.queries.filter((query) => RECORD_TABLES.has(query.table)), []);
    assert.equal(fake.queries.some((query) => query.table === "organization_memberships"), false);
  });
});
