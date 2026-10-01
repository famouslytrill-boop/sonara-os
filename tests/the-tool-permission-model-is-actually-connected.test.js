"use strict";

// The companion to tests/the-autonomy-breaker-is-actually-connected.test.js, and
// it exists for the same reason that one does.
//
// The breaker was correct in isolation and wired to nothing for months. Every
// test injected its reader straight into `createRunner`, so the gate was proven
// to work WHEN GIVEN HISTORY while nothing asserted the application gave it any.
// A tool permission model is the same kind of thing: a decision function that is
// easy to prove correct and easy to leave unreferenced.
//
// So this file injects nothing. It drives the real Express route with a database
// stub that answers the permission read, and asserts the outcome CHANGES with the
// configuration. Remove `readPermissions` from
// routes/sonara-agent-activity-routes.cjs and these fail.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-for-tool-permissions",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-for-tool-permissions"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));
for (const [key, value] of Object.entries(SUPABASE_ENV)) process.env[key] = process.env[key] || value;

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { PERMISSION_CATEGORIES, PERMISSIONS_TABLE } = require("../lib/sonara-agent-tool-permissions.cjs");

const USER = { id: "55555555-5555-4555-8555-555555555555", email: "owner@example.com" };
const ORGANIZATION_ID = "66666666-6666-4666-8666-666666666666";

// On the self-serve allowlist, so the only thing that can refuse it is a gate.
// A gated action would be refused anyway and would prove nothing about this one.
const SELF_SERVE = "summarise_records";

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });

// `permissions` is what the permission table answers with; `unreadable` makes
// that one read fail while leaving every other read working, which is the state
// that must refuse rather than permit.
function stubFetch({ permissions = [], unreadable = false, seen = [] } = {}) {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];

    if (table === "organization_memberships") {
      return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    }
    if (table === "business_memberships") {
      return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    }
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Permission Ltd" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    if (table === PERMISSIONS_TABLE) {
      seen.push({ target });
      if (unreadable) return json({ message: "boom" }, 503);
      return json(permissions);
    }
    // A clean, dateless-free history so the breaker and the volume cap both stay
    // out of the way: this file is about one gate and nothing else.
    if (table === "agent_action_logs") {
      if (method === "GET") return json([]);
      return json([], 201);
    }
    if (table === "agent_pending_actions") {
      if (method === "POST") return json([{ id: "77777777-7777-4777-8777-777777777777" }], 201);
      return json([]);
    }
    return json([]);
  };
}

const auth = (req) => req.set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`);
const propose = (actionType) =>
  auth(request(app).post("/api/agents/queue/propose"))
    .set("Accept", "application/json")
    .type("json")
    .send({ action_type: actionType })
    .redirects(0);

const permitted = (toolName, requiresApproval = false) => ({ tool_name: toolName, allowed: true, requires_approval: requiresApproval });

describe("the tool permission model is actually connected", () => {
  let realFetch;
  let seen;

  beforeEach(() => {
    // Set per test rather than once at load: another spec file's `after()`
    // deletes these variables, and this file sorts after it. With the assignment
    // only at load time every propose here answered 503 and the suite reported
    // "no permission read was made" -- a true sentence about the wrong cause.
    for (const [key, value] of Object.entries(SUPABASE_ENV)) process.env[key] = value;
    realFetch = global.fetch;
    seen = [];
  });
  afterEach(() => { global.fetch = realFetch; });
  after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("reads the organization's tool permissions before running an unattended action", async () => {
    global.fetch = stubFetch({ permissions: [], seen });
    const response = await propose(SELF_SERVE);
    // Checked first: "no permission read" is also what a 503 looks like, and the
    // two have completely different causes.
    assert.equal(response.status, 200, `the request never reached the runner: ${response.status} ${JSON.stringify(response.body)}`);
    assert.ok(seen.length >= 1, "no permission read was made, so nothing is enforcing which tools this organization allows");
  });

  it("asks only for this organization's permissions", async () => {
    global.fetch = stubFetch({ permissions: [], seen });
    await propose(SELF_SERVE);
    const read = decodeURIComponent(seen[0].target);
    assert.match(read, /organization_id=eq\./, "the permission read is not scoped to an organization, which is the entire reason this table exists rather than entity_agent_tool_registry");
    assert.match(read, /tool_name/, "the permission read does not ask for the tool name it has to match");
    assert.match(read, /allowed/, "the permission read does not ask whether the tool is allowed");
    assert.match(read, /requires_approval/, "the permission read does not ask whether the tool still needs an owner");
  });

  it("runs the action when the organization has configured nothing, as it did before this model existed", async () => {
    global.fetch = stubFetch({ permissions: [], seen });
    const response = await propose(SELF_SERVE);
    assert.equal(response.status, 200);
    assert.notEqual(response.body?.category, PERMISSION_CATEGORIES.denied, "an organization with no configuration must not have every action refused");
  });

  it("holds the action once the organization has permissions and this tool is not among them", async () => {
    global.fetch = stubFetch({ permissions: [permitted("some_other_tool")], seen });
    const response = await propose(SELF_SERVE);
    assert.equal(response.status, 200, `expected the route to answer: ${JSON.stringify(response.body)}`);
    assert.equal(
      response.body?.category,
      PERMISSION_CATEGORIES.denied,
      `a tool absent from a configured permission set must be held; got ${JSON.stringify(response.body)}`
    );
  });

  it("runs the action when the organization has permitted exactly that tool", async () => {
    global.fetch = stubFetch({ permissions: [permitted(SELF_SERVE)], seen });
    const response = await propose(SELF_SERVE);
    assert.equal(response.status, 200);
    assert.notEqual(
      response.body?.category,
      PERMISSION_CATEGORIES.denied,
      `a permitted tool must still run, or this gate refuses everything: ${JSON.stringify(response.body)}`
    );
  });

  it("holds a permitted tool whose row still asks for the owner", async () => {
    global.fetch = stubFetch({ permissions: [permitted(SELF_SERVE, true)], seen });
    const response = await propose(SELF_SERVE);
    assert.equal(response.status, 200);
    assert.equal(response.body?.category, PERMISSION_CATEGORIES.approval_required, `got ${JSON.stringify(response.body)}`);
  });

  // The direction that distinguishes an authorization check from a reliability
  // heuristic: the breaker stands aside when it cannot read, this does not.
  it("holds the action when the permission read fails, rather than permitting it", async () => {
    global.fetch = stubFetch({ unreadable: true, seen });
    const response = await propose(SELF_SERVE);
    assert.equal(response.status, 200, `expected the route to answer: ${JSON.stringify(response.body)}`);
    assert.equal(
      response.body?.category,
      PERMISSION_CATEGORIES.unavailable,
      `an unreadable permission set must escalate, not grant: ${JSON.stringify(response.body)}`
    );
  });
});
