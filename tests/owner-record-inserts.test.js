"use strict";

// Do the Business Builder record forms actually save?
//
// They did not. The generic insert in routes/sonara-last9-routes.cjs ended with
// `user_id: org.userId || null` for every resource, and seventeen of the
// nineteen tables behind those endpoints have no user_id column. PostgREST
// rejects an insert naming a column that is not there, so a customer who filled
// in a location, a service, a booking, an inventory item, a vendor or a vehicle
// was redirected back to the page with ?problem= and no record saved.
//
// The whole suite passed throughout, and the reason is worth stating because it
// generalises: every test here stubs Supabase, and a stub accepts any payload.
// Asserting that a POST returns 200 against a stub proves the handler ran, not
// that the database would have taken what it sent. The shape of what is sent
// was never compared against the shape of what exists.
//
// So this file does not stub the answer. It reads the columns out of
// supabase/migrations/ and checks the payload against them.

const assert = require("node:assert/strict");
const request = require("supertest");
const { tableColumns } = require("../lib/sonara-migration-columns.cjs");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-inserts",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-inserts"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const USER = { id: "77777777-7777-4777-8777-777777777777", email: "owner@example.com" };
const ORGANIZATION_ID = "88888888-8888-4888-8888-888888888888";

// One representative body per endpoint: the required fields, plus a couple of
// optional ones where they exist, because a payload is only as wrong as the
// keys it carries.
const SUBMISSIONS = Object.freeze({
  "/api/business/locations": { name: "Main shop", city: "Leeds" },
  "/api/business/services": { name: "Haircut", category: "salon" },
  "/api/business/bookings": { customer_name: "Sam Patel" },
  "/api/business/staff": { display_name: "Alex Fry" },
  "/api/business/vendors": { name: "Northern Supplies" },
  "/api/business/inventory": { name: "Flour", unit: "kg" },
  "/api/business/recipes": { name: "House loaf" },
  "/api/business/menu-items": { name: "Flat white" },
  "/api/business/vehicles": { vehicle_type: "van" },
  "/api/business/maintenance": { description: "Brake service" },
  "/api/business/waste": { item_name: "Milk" },
  "/api/creator/music-projects": { title: "First demo" },
  "/api/location/zones": { name: "Delivery area" },
  // The three operations workspaces, which were built against tables the
  // application had never queried. Getting a column name wrong there is the
  // same failure as the original bug, on a page with no history of working.
  "/api/business/purchase-orders": { po_number: "PO-1001", notes: "Weekly order" },
  "/api/business/stock-counts": { count_date: "2026-08-05", notes: "Monthly count" },
  "/api/business/transfers": { notes: "Move stock to the second shop" }
});

let captured = new Map();

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

function stubFetch() {
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
      if (method === "POST") {
        // The point of the file: keep what was sent, and check it against the
        // schema rather than answering 201 and moving on.
        try {
          captured.set(table, JSON.parse(options.body));
        } catch {
          captured.set(table, { unparseable: true });
        }
        return json([{ id: "created" }], 201);
      }
      return json([]);
    }
    return undefined;
  };
}

describe("the Business Builder record forms", () => {
  let realFetch;

  before(() => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("can read the schema at all, so the rest of this file means something", () => {
    // Without this, a parser that returned nothing would make every check below
    // pass by having no columns to disagree with.
    const columns = tableColumns("inventory_items");
    assert.ok(columns, "inventory_items was not found in supabase/migrations");
    assert.ok(columns.size >= 5, `only ${columns.size} columns parsed for inventory_items; the reader has gone blind`);
    assert.ok(columns.has("organization_id"), "organization_id missing from the parsed columns");
    assert.equal(columns.has("user_id"), false, "inventory_items now has user_id; this test's premise has changed");
  });

  it("sends only columns the table actually has", async function () {
    this.timeout(60000);
    const wrong = [];
    for (const [path, body] of Object.entries(SUBMISSIONS)) {
      captured = new Map();
      const res = await request(app)
        .post(path)
        .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub-access-token`)
        .set("Accept", "text/html")
        .type("form")
        .send(body)
        .redirects(0);
      if (![200, 303].includes(res.status)) {
        wrong.push(`${path} returned ${res.status} before reaching the database`);
        continue;
      }
      const [table, payload] = [...captured][0] || [];
      if (!payload) {
        wrong.push(`${path} sent no insert at all`);
        continue;
      }
      const columns = tableColumns(table);
      if (!columns) {
        wrong.push(`${path} writes to ${table}, which is not in the migrations`);
        continue;
      }
      const unknown = Object.keys(payload).filter((key) => !columns.has(key));
      if (unknown.length) wrong.push(`${path} -> ${table} sends ${unknown.join(", ")}, which ${table} does not have`);
    }
    assert.deepEqual(wrong, [], `these forms send columns that do not exist, so the insert is rejected and nothing saves:\n  ${wrong.join("\n  ")}`);
  });

  it("still scopes every insert to the organization", async () => {
    // The column that was correct before must stay correct. This read goes out
    // with the service key, so organization_id on the row is what keeps one
    // business's records out of another's.
    const unscoped = [];
    for (const [path, body] of Object.entries(SUBMISSIONS)) {
      captured = new Map();
      await request(app)
        .post(path)
        .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub-access-token`)
        .set("Accept", "text/html")
        .type("form")
        .send(body)
        .redirects(0);
      const [, payload] = [...captured][0] || [];
      if (!payload) continue;
      if (payload.organization_id !== ORGANIZATION_ID) unscoped.push(`${path} sent organization_id ${payload.organization_id}`);
    }
    assert.deepEqual(unscoped, [], unscoped.join("\n  "));
  });

  it("refuses to take the organization from the form", async () => {
    // Otherwise a manager of one business could post organization_id for
    // another and write into it, since the insert runs with the service key.
    captured = new Map();
    await request(app)
      .post("/api/business/locations")
      .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub-access-token`)
      .set("Accept", "text/html")
      .type("form")
      .send({ name: "Someone else's shop", organization_id: "99999999-9999-4999-8999-999999999999" })
      .redirects(0);
    const [, payload] = [...captured][0] || [];
    assert.equal(payload.organization_id, ORGANIZATION_ID, "a submitted organization_id overrode the session's organization");
  });

  it("names a real column wherever it records who did it", () => {
    // A wrong person column is the same bug in a different place, and it would
    // fail every insert on that one endpoint while the others kept working --
    // harder to spot than all of them failing at once.
    const { RESOURCE_MAP } = require("../routes/sonara-last9-routes.cjs");
    assert.ok(RESOURCE_MAP && Object.keys(RESOURCE_MAP).length >= 15, "RESOURCE_MAP is not exported or has shrunk; this check has gone blind");
    const wrong = [];
    for (const [path, resource] of Object.entries(RESOURCE_MAP)) {
      if (!resource.person) continue;
      const columns = tableColumns(resource.table);
      if (!columns) {
        wrong.push(`${path}: ${resource.table} is not in the migrations`);
        continue;
      }
      if (!columns.has(resource.person)) wrong.push(`${path}: ${resource.table} has no column ${resource.person}`);
    }
    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  it("records the person on every table that has somewhere to put one", () => {
    // The other direction. Omitting `person` is how the bug was fixed, so it is
    // also how attribution gets quietly dropped on a table that wanted it.
    const { RESOURCE_MAP } = require("../routes/sonara-last9-routes.cjs");
    const PERSON_COLUMNS = ["user_id", "created_by", "logged_by", "counted_by"];
    const missed = [];
    for (const [path, resource] of Object.entries(RESOURCE_MAP)) {
      if (resource.person) continue;
      const columns = tableColumns(resource.table);
      if (!columns) continue;
      const available = PERSON_COLUMNS.filter((column) => columns.has(column));
      if (available.length) missed.push(`${path}: ${resource.table} has ${available.join(", ")} and records nobody`);
    }
    assert.deepEqual(missed, [], missed.join("\n  "));
  });
});
