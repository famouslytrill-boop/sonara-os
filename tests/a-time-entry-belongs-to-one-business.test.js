"use strict";

// Closing somebody's shift, and whose shift it may be.
//
// /api/business/time-entries/stop resolved no organization at all. It took an id
// from the request body and patched employee_time_entries with the service key,
// which bypasses row level security -- so any signed-in customer could close any
// time entry in any business, stamping clock_out_at, status, and a break length
// of their choosing.
//
// break_minutes is the part that reaches a number somebody is paid on:
// workedHours() subtracts it, and it feeds the labour cost on the daily sales
// page. A negative break adds hours.
//
// Found by auditing every hand-written POST in routes/sonara-last9-routes.cjs
// for whether it resolves an organization. Three of the four did. This one did
// not, and 2,025 tests passed over it.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-time",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-time"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const USER = { id: "77777777-7777-4777-8777-777777777777", email: "owner@example.com" };
const OURS = "88888888-8888-4888-8888-888888888888";
const MY_ENTRY = "12345678-1234-4234-8234-123456789012";
const THEIR_ENTRY = "99999999-9999-4999-8999-999999999999";
const MY_EMPLOYEE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THEIR_EMPLOYEE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let patched;
let inserted;
let readable;

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

function stub() {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") {
      return json([{ organization_id: OURS, user_id: USER.id, role: "owner", status: "active" }]);
    }
    if (table === "business_memberships") {
      return json([{ id: "m", organization_id: OURS, workspace_id: "w", role: "owner", status: "active" }]);
    }
    if (method === "PATCH") {
      patched = { url: target, body: JSON.parse(options.body || "{}") };
      return json([{ id: "patched" }]);
    }
    if (method === "POST") {
      inserted = JSON.parse(options.body || "{}");
      return json([{ id: "created" }], 201);
    }
    if (!readable) return json({ message: "no" }, 500);
    // PostgREST honours both filters. Only our own rows come back scoped to us.
    const scoped = target.includes(`organization_id=eq.${OURS}`);
    if (table === "employee_time_entries") {
      return json(scoped && target.includes(`id=eq.${MY_ENTRY}`) ? [{ id: MY_ENTRY }] : []);
    }
    if (table === "business_employee_profiles") {
      return json(scoped && target.includes(`id=eq.${MY_EMPLOYEE}`) ? [{ id: MY_EMPLOYEE }] : []);
    }
    return json([]);
  };
}

// Posts JSON, which is what a JSON client does. These assert the API's own
// answers -- a status and a code -- and acceptsHtml() in the route file treats a
// form-encoded body as a form post whatever the Accept header says, so a
// form-encoded request here would always be answered with a redirect. That
// behaviour is deliberate and has its own test below.
function post(path, body) {
  patched = null;
  inserted = null;
  return request(app)
    .post(path)
    .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
    .set("Accept", "application/json")
    .send(body)
    .redirects(0);
}

describe("a time entry belongs to one business", () => {
  let realFetch;

  before(() => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    readable = true;
    global.fetch = stub();
  });

  it("closes an entry that belongs to this business", async () => {
    const result = await post("/api/business/time-entries/stop", { id: MY_ENTRY, break_minutes: "30" });
    assert.equal(result.status, 200, `refused its own entry: ${JSON.stringify(result.body)}`);
    assert.ok(patched, "nothing was patched");
    assert.equal(patched.body.break_minutes, 30);
    assert.equal(patched.body.status, "submitted");
  });

  // The defect. Before the ownership check this patched somebody else's row.
  it("will not close an entry in another business", async () => {
    const result = await post("/api/business/time-entries/stop", { id: THEIR_ENTRY });
    assert.equal(result.status, 403);
    assert.equal(result.body.code, "entry_not_yours");
    assert.equal(patched, null, "another business's time entry was written to");
  });

  // A read that failed is not an entry belonging to somebody else. Treating the
  // two the same either refuses a legitimate clock-out during an outage or, the
  // other way round, writes across a tenant boundary on no evidence.
  it("refuses rather than guessing when the entry cannot be read", async () => {
    readable = false;
    const result = await post("/api/business/time-entries/stop", { id: MY_ENTRY });
    assert.equal(result.status, 502);
    assert.equal(result.body.code, "entry_unreadable");
    assert.equal(patched, null);
  });

  // workedHours() subtracts this. A negative break is extra hours on somebody's
  // timesheet, and it feeds the labour cost on the daily sales page.
  it("never records a negative break", async () => {
    await post("/api/business/time-entries/stop", { id: MY_ENTRY, break_minutes: "-90" });
    assert.equal(patched.body.break_minutes, 0, "a negative break was stored, which adds hours");
  });

  it("refuses an id that is not an id, rather than putting it in a filter", async () => {
    const result = await post("/api/business/time-entries/stop", { id: "not-a-uuid" });
    assert.equal(result.status, 400);
    assert.equal(patched, null);
  });

  // The row action on /business-builder/owner/time is an HTML form, so this
  // used to answer a button press with raw JSON in the browser.
  it("returns a manager to their page rather than to a JSON body", async () => {
    const result = await request(app)
      .post("/api/business/time-entries/stop")
      .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
      .set("Accept", "text/html")
      .type("form")
      .send({ id: MY_ENTRY })
      .redirects(0);
    assert.equal(result.status, 303);
    assert.equal(result.headers.location, "/business-builder/owner/time");
  });

  describe("attributing work to a person", () => {
    // A manager legitimately clocks somebody else in -- the form asks "Who is
    // starting" -- so the employee is not forced to be the caller. It does have
    // to be one of this business's people.
    it("clocks in one of this business's employees", async () => {
      const result = await post("/api/business/time-entries/start", { employee_id: MY_EMPLOYEE });
      assert.equal(result.status, 200, `refused its own employee: ${JSON.stringify(result.body)}`);
      assert.equal(inserted.employee_id, MY_EMPLOYEE);
      assert.equal(inserted.organization_id, OURS);
    });

    it("will not record hours against another business's employee", async () => {
      const result = await post("/api/business/time-entries/start", { employee_id: THEIR_EMPLOYEE });
      assert.equal(result.status, 403);
      assert.equal(result.body.code, "employee_id_not_yours");
      assert.equal(inserted, null, "hours were attributed to somebody in another business");
    });

    // The staff portal lists check-ins by employee_id, so an unchecked one
    // writes a location record onto a colleague's page.
    it("will not record a check-in against another business's employee", async () => {
      const result = await post("/api/location/events", { employee_id: THEIR_EMPLOYEE });
      assert.equal(result.status, 403);
      assert.equal(result.body.code, "employee_id_not_yours");
      assert.equal(inserted, null);
    });

    it("still takes a check-in that names nobody", async () => {
      const result = await post("/api/location/events", { event_type: "check_in" });
      assert.equal(result.status, 200, `refused a check-in with no employee: ${JSON.stringify(result.body)}`);
      assert.equal(inserted.organization_id, OURS);
    });
  });
});
