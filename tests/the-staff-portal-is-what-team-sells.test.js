"use strict";

// What the $79 plan actually buys.
//
// docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md introduces Team at $79 and says
// exactly what it sells: "The staff portal, per-person schedules, time entries
// and assigned tasks already exist and **are given away**."
//
// They were. All six /staff pages were registered with requireCustomer, so any
// signed-in account -- including a free one -- opened every one of them. Team's
// only difference from All three at $39 was a sentence on the pricing page.
//
// Nothing failed, because nothing asked. The pricing tests check that the page
// shows the amount the config holds; the entitlement tests check that a plan key
// opens a workspace. Neither asks whether a plan's *description* is true, and a
// plan that charges for something free is the same defect this codebase keeps
// finding, wearing a price tag: a claim that reports something without it being
// so.
//
// The third case below is the one that matters most. An employee shown "upgrade
// required" because a billing read timed out is being told their employer has
// not paid.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-team",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-team"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { FEATURE_ENTITLEMENT_KEYS, getPaidEntitlementKeys } = require("../lib/sonara-paid-access.cjs");
const { STRIPE_PLANS } = require("../lib/sonara-stripe-plans.cjs");

const USER = { id: "41414141-4141-4141-8141-414141414141", email: "staff@example.com" };
const OURS = "42424242-4242-4242-8242-424242424242";

const STAFF_PATHS = ["/staff", "/staff/schedule", "/staff/time", "/staff/tasks", "/staff/announcements", "/staff/location"];

// What the org's billing looks like this run: a plan slug, or null for none, or
// "unreadable" for a read that does not answer.
let plan;

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

function stub() {
  return async (url) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") {
      return json([{ organization_id: OURS, user_id: USER.id, role: "member", status: "active" }]);
    }
    if (table === "business_memberships") {
      return json([{ id: "m", organization_id: OURS, workspace_id: "w", role: "member", status: "active" }]);
    }
    if (table === "user_roles") return json([]);
    if (table === "billing_entitlements") {
      if (plan === "unreadable") return json({ message: "no" }, 500);
      // PostgREST applies the entitlement_key=in.(...) filter, so a row only
      // comes back when the held plan is one the feature accepts.
      const accepted = target.includes(encodeURIComponent("team_monthly")) || target.includes("team_monthly");
      return json(plan === "team_monthly" && accepted ? [{ entitlement_key: "team_monthly", status: "active", metadata: {} }] : []);
    }
    if (table === "billing_subscriptions") {
      if (plan === "unreadable") return json({ message: "no" }, 500);
      return json([]);
    }
    return json([]);
  };
}

function open(path) {
  return request(app)
    .get(path)
    .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
    .set("Accept", "text/html")
    .redirects(0);
}

describe("the staff portal is what Team sells", () => {
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
    plan = null;
    global.fetch = stub();
  });

  it("has staff pages to check", () => {
    // Guards the loops below. Every one of them passes over an empty list.
    assert.ok(STAFF_PATHS.length >= 6, `only ${STAFF_PATHS.length} staff paths listed; this check has gone blind`);
  });

  it("sells the staff portal under Team and nothing cheaper", () => {
    assert.deepEqual(FEATURE_ENTITLEMENT_KEYS.staff_portal, ["team_monthly"]);
    assert.deepEqual(getPaidEntitlementKeys("staff_portal"), ["team_monthly"]);
    // If the description ever stops mentioning staff, this pairing is stale and
    // somebody should notice here rather than on the pricing page.
    assert.match(STRIPE_PLANS.team_monthly.description, /staff/i, "Team no longer describes itself as the staff plan");
  });

  it("opens every staff page for a business on Team", async () => {
    plan = "team_monthly";
    for (const path of STAFF_PATHS) {
      const result = await open(path);
      assert.equal(result.status, 200, `${path} refused a Team subscriber (${result.status})`);
    }
  });

  // The defect. Before this gate every one of these returned 200 for a free
  // account, so Team charged $79 for what everybody already had.
  it("does not open a staff page for a business that has not bought Team", async () => {
    plan = null;
    for (const path of STAFF_PATHS) {
      const result = await open(path);
      assert.equal(result.status, 402, `${path} is still free (${result.status})`);
      assert.match(result.text, /[Uu]pgrade/, `${path} refused without saying why`);
    }
  });

  // Both reads have to answer before anyone is told they have not paid. This is
  // the case that must never become a paywall: a 402 here accuses a paying
  // employer of not paying, on the strength of a request that failed.
  it("says the check failed rather than that the employer has not paid", async () => {
    plan = "unreadable";
    for (const path of STAFF_PATHS) {
      const result = await open(path);
      assert.equal(result.status, 503, `${path} answered ${result.status} on an unreadable billing read`);
      assert.doesNotMatch(result.text, /Upgrade required/, `${path} showed a paywall on a failed read`);
    }
  });
});
