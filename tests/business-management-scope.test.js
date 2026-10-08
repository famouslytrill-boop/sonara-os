"use strict";

// A manager's business can differ from their ordinary primary organization.
// Exercise the real resolver, including overlapping workspaces for one actor.
const assert = require("node:assert/strict");
const { setImmediate } = require("node:timers");
const {
  runWithBusinessManagementScope,
  organizationInBusinessManagementScope
} = require("../lib/sonara-business-management-scope.cjs");
const { createCustomerPrimaryOrganizationResolver } = require("../lib/sonara-customer-organization.cjs");

const USER = { id: "22222222-2222-4222-8222-222222222222" };
const OTHER_USER = { id: "33333333-3333-4333-8333-333333333333" };
const PRIMARY = "11111111-1111-4111-8111-111111111111";
const MANAGED = "44444444-4444-4444-8444-444444444444";
const SECOND = "55555555-5555-4555-8555-555555555555";
const membership = (organizationId = MANAGED, role = "manager") => ({
  organization_id: organizationId, status: "active", role
});

describe("a management request stays in the business that authorized it", () => {
  let originalFetch;
  let queries;
  let resolve;
  beforeEach(() => {
    originalFetch = global.fetch;
    queries = [];
    global.fetch = async (url, init = {}) => {
      queries.push({ url: String(url), method: init.method || "GET" });
      return { ok: true, json: async () => [{ organization_id: PRIMARY, role: "member" }] };
    };
    resolve = createCustomerPrimaryOrganizationResolver({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co" }),
      supabaseHeaders: () => ({})
    });
  });
  afterEach(() => { global.fetch = originalFetch; });

  it("uses the verified manager's business instead of their primary member workspace", async () => {
    const work = runWithBusinessManagementScope(USER, membership(), async () => {
      await new Promise((done) => setImmediate(done));
      return resolve({ ...USER }, { autoBootstrap: true });
    });
    assert.equal(work.ok, true);
    assert.deepEqual(await work.value, {
      ok: true, organizationId: MANAGED, role: "manager", source: "business_memberships"
    });
    assert.deepEqual(queries, [], "a verified request looked up or created an unrelated workspace");
  });

  it("keeps a verified legacy database UUID usable without another membership lookup", async () => {
    const legacy = "00000000-0000-0000-0000-000000000031";
    const work = runWithBusinessManagementScope(USER, membership(legacy, "owner"), () => resolve(USER));
    assert.equal(work.ok, true);
    assert.equal((await work.value).organizationId, legacy);
    assert.deepEqual(queries, []);
  });

  it("retains ordinary primary membership lookup outside management requests", async () => {
    assert.deepEqual(await resolve({ ...USER, organization_id: MANAGED, role: "owner" }, {
      autoBootstrap: false, organizationId: MANAGED
    }), { ok: true, organizationId: PRIMARY, role: "member", source: "organization_memberships" });
    assert.equal(queries.length, 1);
    assert.match(queries[0].url, /organization_memberships/);
  });

  it("refuses another actor inside a management request without lookup or bootstrap", async () => {
    const work = runWithBusinessManagementScope(USER, membership(), () => resolve(OTHER_USER));
    assert.deepEqual(await work.value, { ok: false, code: "business_scope_actor_mismatch" });
    assert.deepEqual(queries, []);
  });

  it("refuses a missing actor rather than inheriting management authority", async () => {
    const work = runWithBusinessManagementScope(USER, membership(), () => resolve(null));
    assert.deepEqual(await work.value, { ok: false, code: "customer_auth_required" });
    assert.deepEqual(queries, []);
  });

  it("isolates two concurrent businesses managed by the same user across awaited work", async () => {
    let release;
    const bothEntered = new Promise((done) => { release = done; });
    let entered = 0;
    const visit = (organizationId, role) => runWithBusinessManagementScope(USER, membership(organizationId, role), async () => {
      const before = await resolve(USER);
      entered += 1;
      if (entered === 2) release();
      await bothEntered;
      await new Promise((done) => setImmediate(done));
      const after = await resolve({ id: USER.id });
      assert.equal(before.organizationId, organizationId);
      assert.equal(after.organizationId, organizationId);
      assert.equal(after.role, role);
      return after.organizationId;
    }).value;
    assert.deepEqual(await Promise.all([visit(MANAGED, "manager"), visit(SECOND, "owner")]), [MANAGED, SECOND]);
    assert.equal(organizationInBusinessManagementScope(USER), null);
    assert.deepEqual(queries, []);
  });

  it("isolates concurrent users instead of sharing the last manager's authority", async () => {
    const visit = (user, organizationId) => runWithBusinessManagementScope(user, membership(organizationId), async () => {
      await new Promise((done) => setImmediate(done));
      return resolve(user);
    }).value;
    const answers = await Promise.all([visit(USER, MANAGED), visit(OTHER_USER, SECOND)]);
    assert.deepEqual(answers.map((answer) => answer.organizationId), [MANAGED, SECOND]);
    assert.deepEqual(queries, []);
  });

  it("rejects another user's explicit membership before entering a delegated handler", () => {
    let invoked = 0;
    const valid = membership(MANAGED, "manager");
    const foreign = runWithBusinessManagementScope(USER,
      { ...valid, user_id: OTHER_USER.id }, () => { invoked += 1; });
    assert.equal(foreign.ok, false);
    assert.equal(foreign.code, "business_scope_unverified");
    assert.equal(invoked, 0);
    const own = runWithBusinessManagementScope(USER,
      { ...valid, user_id: USER.id }, () => { invoked += 1; return "authorized"; });
    assert.equal(own.ok, true);
    assert.equal(own.value, "authorized");
    assert.equal(invoked, 1);
  });

  it("does not enter the handler for unverified, inactive, or non-management memberships", () => {
    const candidates = [
      null, {}, membership("not-an-organization"), { ...membership(), status: "inactive" },
      { ...membership(), role: "employee" }, { ...membership(), role: "admin" },
      { ...membership(), role: null }, { ...membership(), organization_id: null }
    ];
    let entered = 0;
    for (const row of candidates) {
      const answer = runWithBusinessManagementScope(USER, row, () => { entered += 1; });
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "business_scope_unverified");
    }
    assert.equal(runWithBusinessManagementScope(null, membership(), () => { entered += 1; }).ok, false);
    assert.equal(entered, 0);
    assert.equal(organizationInBusinessManagementScope(USER), null);
  });

  it("pins verified values even if a caller later mutates the original objects", async () => {
    const actor = { ...USER };
    const row = membership();
    const work = runWithBusinessManagementScope(actor, row, async () => {
      row.organization_id = SECOND;
      row.role = "owner";
      actor.id = OTHER_USER.id;
      return resolve(USER);
    });
    const answer = await work.value;
    assert.equal(answer.organizationId, MANAGED);
    assert.equal(answer.role, "manager");
    assert.deepEqual(queries, []);
  });

  it("restores the parent business after a nested request returns", async () => {
    const work = runWithBusinessManagementScope(USER, membership(), async () => {
      const nested = runWithBusinessManagementScope(USER, membership(SECOND, "owner"), () => resolve(USER));
      assert.equal((await nested.value).organizationId, SECOND);
      return resolve(USER);
    });
    assert.equal((await work.value).organizationId, MANAGED);
    assert.equal(organizationInBusinessManagementScope(USER), null);
  });

  it("restores ordinary lookup when the delegated handler throws", async () => {
    assert.throws(() => runWithBusinessManagementScope(USER, membership(), () => {
      throw new Error("handler failed");
    }), /handler failed/);
    assert.equal((await resolve(USER, { autoBootstrap: false })).organizationId, PRIMARY);
    assert.equal(queries.length, 1);
  });

  it("restores ordinary lookup when awaited work rejects", async () => {
    const work = runWithBusinessManagementScope(USER, membership(), async () => {
      await new Promise((done) => setImmediate(done));
      throw new Error("read failed");
    });
    await assert.rejects(work.value, /read failed/);
    assert.equal((await resolve(USER, { autoBootstrap: false })).organizationId, PRIMARY);
    assert.equal(queries.length, 1);
  });

  it("keeps a missing database configuration unavailable even with verified membership", async () => {
    const unavailable = createCustomerPrimaryOrganizationResolver({
      getSupabaseServerConfig: () => ({ ok: false }), supabaseHeaders: () => ({})
    });
    const work = runWithBusinessManagementScope(USER, membership(), () => unavailable(USER));
    assert.deepEqual(await work.value, { ok: false, code: "workspace_unavailable" });
    assert.deepEqual(queries, []);
  });
});
