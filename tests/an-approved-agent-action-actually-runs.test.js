"use strict";

// Approving used to change nothing, and the page said so.
//
// lib/sonara-agent-authority.cjs stopped a sensitive action and gave a reason.
// The runner recorded the refusal. Nothing re-ran it: the runner is called per
// request by the page wanting work done, so an approval had nowhere to live and
// nothing to consume it. /owner/agent-activity carried a card explaining that a
// button there would have written "approved" and changed nothing else --
// telling an owner their refund was authorised while no refund existed.
//
// This is that loop closed, asserted end to end through Express rather than on
// the modules underneath: propose, queue, approve, and the record the action
// was about actually changing.
//
// The two failures it is really guarding are the ones that look like success.
// An approve button that writes a state and runs nothing. And a second click
// that runs the action twice.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-agent-queue",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-agent-queue"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { shouldQueue, stateAfterRun, approvalFor, actionFor } = require("../lib/sonara-agent-queue.cjs");
const { decideExecution } = require("../lib/sonara-agent-authority.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "owner@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";
const CONTENT_ID = "66666666-6666-4666-8666-666666666666";
const PENDING_ID = "77777777-7777-4777-8777-777777777777";
const OTHER_ID = "88888888-8888-4888-8888-888888888888";

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });

// A small stand-in for PostgREST that honours the filters this code relies on:
// the organization scope, and `state=eq.waiting` on the claim. A stub that
// ignored those would pass every assertion below while the real thing let one
// organisation approve another's action and let two clicks run one action twice.
function makeDatabase() {
  return {
    pending: [],
    content: [{ id: CONTENT_ID, organization_id: ORGANIZATION_ID, title: "Launch post", channel: "email", approval_status: "review_required" }],
    logged: []
  };
}

function stubFetch(db) {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    const body = options.body ? JSON.parse(options.body) : null;
    const idIn = (target.match(/id=eq\.([0-9a-f-]+)/) || [])[1];
    const orgIn = decodeURIComponent((target.match(/organization_id=eq\.([0-9a-f-]+)/) || [])[1] || "");

    if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Queue Ltd" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    if (table === "agent_action_logs") { db.logged.push(body); return json([], 201); }

    if (table === "agent_pending_actions") {
      if (method === "POST") {
        const row = { ...body, id: PENDING_ID, created_at: new Date().toISOString() };
        db.pending.push(row);
        return json([row], 201);
      }
      if (method === "PATCH") {
        const onlyWaiting = /state=eq\.waiting/.test(target);
        const hits = db.pending.filter((row) => row.id === idIn && row.organization_id === orgIn && (!onlyWaiting || row.state === "waiting"));
        for (const row of hits) Object.assign(row, body);
        return json(hits.map((row) => ({ ...row })));
      }
      return json(db.pending.filter((row) => row.organization_id === orgIn).map((row) => ({ ...row })));
    }

    if (table === "growth_content_queue") {
      if (method === "PATCH") {
        const hits = db.content.filter((row) => row.id === idIn && row.organization_id === orgIn);
        for (const row of hits) Object.assign(row, body);
        return json(hits.map((row) => ({ ...row })));
      }
      return json(db.content.filter((row) => row.organization_id === orgIn).map((row) => ({ ...row })));
    }
    return json([]);
  };
}

const auth = (req) => req.set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`);
const propose = (body) => auth(request(app).post("/api/agents/queue/propose")).set("Accept", "application/json").type("json").send(body).redirects(0);
const approve = (id) => auth(request(app).post("/api/agents/queue/approve")).set("Accept", "application/json").type("json").send({ id }).redirects(0);
const decline = (id) => auth(request(app).post("/api/agents/queue/decline")).set("Accept", "application/json").type("json").send({ id }).redirects(0);

describe("an approved agent action actually runs", () => {
  let realFetch;
  let db;

  beforeEach(() => {
    Object.assign(process.env, SUPABASE_ENV);
    db = makeDatabase();
    realFetch = global.fetch;
    global.fetch = stubFetch(db);
  });

  afterEach(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("queues a gated action instead of running it, and keeps what it would need to run", async function queue() {
    this.timeout(20000);
    const response = await propose({ action_type: "approve_scheduled_content", payload: { content_id: CONTENT_ID }, subject: "Launch post" });
    assert.equal(response.status, 200);
    assert.equal(response.body.queued, true);
    assert.equal(db.pending.length, 1);
    assert.equal(db.pending[0].state, "waiting");
    // The payload is the whole reason the queue is its own table. Without it an
    // approval has nothing to re-run with, which is why agent_action_logs -- an
    // audit trail that deliberately stores none -- could not be the queue.
    assert.deepEqual(db.pending[0].payload, { content_id: CONTENT_ID });
    assert.equal(db.content[0].approval_status, "review_required", "proposing ran the action");
  });

  it("changes the record when the owner approves, not just the state", async function run() {
    this.timeout(20000);
    await propose({ action_type: "approve_scheduled_content", payload: { content_id: CONTENT_ID } });
    const response = await approve(PENDING_ID);
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "completed");
    assert.equal(db.pending[0].state, "ran");
    // The assertion the whole change exists for.
    assert.equal(db.content[0].approval_status, "approved", "the owner approved and the record did not change");
  });

  it("runs the action once, however many times the button is pressed", async function once() {
    this.timeout(20000);
    await propose({ action_type: "approve_scheduled_content", payload: { content_id: CONTENT_ID } });
    await approve(PENDING_ID);
    db.content[0].approval_status = "review_required"; // so a second run would be visible
    const second = await approve(PENDING_ID);
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "already_decided");
    assert.equal(db.content[0].approval_status, "review_required", "the action ran a second time");
  });

  it("says nothing happened when nothing implements the action", async function nothing() {
    this.timeout(20000);
    const queued = await propose({ action_type: "issue_refund", subject: "Invoice 42" });
    assert.equal(queued.body.queued, true);
    assert.equal(db.pending[0].category, "refunds");
    const response = await approve(PENDING_ID);
    assert.equal(response.body.status, "unimplemented");
    assert.equal(db.pending[0].state, "unimplemented");
    // The sentence an owner reads. A row saying "approved" and nothing else is
    // exactly what the page used to refuse to show.
    assert.match(String(db.pending[0].run_reason), /nothing has happened and nothing was changed/i);
  });

  it("declines without running anything", async function declined() {
    this.timeout(20000);
    await propose({ action_type: "approve_scheduled_content", payload: { content_id: CONTENT_ID } });
    const response = await decline(PENDING_ID);
    assert.equal(response.status, 200);
    assert.equal(db.pending[0].state, "declined");
    assert.equal(db.content[0].approval_status, "review_required");
  });

  it("does not queue an action the rules already allow", async function selfServe() {
    this.timeout(20000);
    const response = await propose({ action_type: "summarise_records" });
    assert.equal(response.status, 200);
    assert.equal(response.body.queued, false);
    assert.equal(db.pending.length, 0, "a self-serve action was put in front of the owner as a decision");
  });

  it("touches nothing when the approved action names a record in another workspace", async function scoped() {
    this.timeout(20000);
    await propose({ action_type: "approve_scheduled_content", payload: { content_id: OTHER_ID } });
    const response = await approve(PENDING_ID);
    assert.notEqual(response.body.status, "completed");
    assert.equal(db.pending[0].state, "failed");
    assert.equal(db.content[0].approval_status, "review_required");
  });

  it("shows the waiting action and both buttons on the page", async function page() {
    this.timeout(20000);
    await propose({ action_type: "approve_scheduled_content", payload: { content_id: CONTENT_ID }, subject: "Launch post" });
    const response = await auth(request(app).get("/owner/agent-activity")).set("Accept", "text/html").redirects(0);
    assert.equal(response.status, 200);
    assert.match(response.text, /Waiting for your decision/);
    assert.ok(response.text.includes('action="/api/agents/queue/approve"'), "no approve button");
    assert.ok(response.text.includes('action="/api/agents/queue/decline"'), "no decline button");
    assert.match(response.text, /Launch post/);
    // The card that said approving was not wired up must be gone, because it no
    // longer describes the page.
    assert.doesNotMatch(response.text, /Approving is not wired up yet/);
  });

  it("offers a job to hand an agent, drawn from real records", async function proposeForm() {
    this.timeout(20000);
    const response = await auth(request(app).get("/owner/agent-activity")).set("Accept", "text/html").redirects(0);
    assert.ok(response.text.includes('action="/api/agents/queue/propose"'), "no way to give an agent a job");
    assert.ok(response.text.includes(`value="${CONTENT_ID}"`), "the picker does not offer the item that exists");
  });

  // The gate itself, asserted directly, because everything above goes through
  // the happy path and this is the part that must not be reachable.
  it("still refuses an approval that names nobody", () => {
    const pending = { id: PENDING_ID, action_type: "issue_refund", proposed_by: null };
    const decision = decideExecution({ action: actionFor(pending), approval: approvalFor({ pending, decidedBy: null }) });
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /does not say who gave it/);
  });

  it("queues only what a person could actually decide", () => {
    assert.equal(shouldQueue({ status: "refused", classification: { category: "refunds" } }), true);
    // An action with no name is not waiting on an approval, it is waiting on
    // somebody fixing something. Putting it in front of an owner asks them to
    // approve a bug.
    assert.equal(shouldQueue({ status: "refused", classification: { category: "unnamed" } }), false);
    assert.equal(shouldQueue({ status: "completed", classification: { category: "self_serve" } }), false);
    assert.equal(shouldQueue({ status: "failed", classification: { category: "refunds" } }), false);
    assert.equal(shouldQueue(null), false);
  });

  it("never records a run it did not get an outcome for as having run", () => {
    assert.equal(stateAfterRun(null).state, "failed");
    assert.equal(stateAfterRun({ status: "refused", reason: "no" }).state, "refused");
    assert.equal(stateAfterRun({ status: "completed" }).state, "ran");
    assert.equal(stateAfterRun({ status: "unimplemented" }).state, "unimplemented");
  });
});
