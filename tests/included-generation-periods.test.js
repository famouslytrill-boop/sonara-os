"use strict";
const assert = require("node:assert/strict");
const { subscriptionPeriod, generationAllowance } = require("../lib/sonara-generation-allowance.cjs");
const start = 1790899200, end = start + 2592000;
describe("included generation periods", () => {
  it("supports legacy subscriptions and current Stripe item periods", () => {
    const expected = { ok: true, start: new Date(start * 1000).toISOString(), end: new Date(end * 1000).toISOString() };
    assert.deepEqual(subscriptionPeriod({ current_period_start: start, current_period_end: end }), expected);
    assert.deepEqual(subscriptionPeriod({ items: { data: [{ current_period_start: start, current_period_end: end, price: { id: "price_FixtureWorkspace" }, quantity: 1 }], has_more: false } }), expected);
    assert.deepEqual(subscriptionPeriod({ current_period_start: start, current_period_end: end, items: { data: [{ id: "legacy_item" }] } }), expected);
  });
  it("refuses mixed, missing, reversed, fractional and out-of-range periods", () => {
    for (const pair of [[null, end], [start, start], [start, start - 1], [start + 0.5, end], [start, 253402300800], ["1790899200", end]]) {
      assert.equal(subscriptionPeriod({ current_period_start: pair[0], current_period_end: pair[1] }).ok, false);
    }
    assert.equal(subscriptionPeriod({ items: { data: [{ current_period_start: start, current_period_end: end }, { current_period_start: start, current_period_end: end + 1 }] } }).ok, false);
  });
  it("sends tenant identity and reservations only through the server RPC", async () => {
    const original = global.fetch; let received;
    global.fetch = async (url, options) => { received = { url, options }; return Response.json({ ok: true, remainingMinor: 200 }); };
    try {
      const result = await generationAllowance({ config: { ok: true, url: "https://example.supabase.co", serviceRoleKey: "test-server-key" }, organizationId: "org-a", action: "reserve", jobId: "job-a", amountMinor: 300 });
      assert.equal(result.ok, true);
      assert.equal(received.url, "https://example.supabase.co/rest/v1/rpc/generation_usage");
      assert.deepEqual(JSON.parse(received.options.body), { p_organization_id: "org-a", p_action: "reserve", p_job_id: "job-a", p_amount_minor: 300, p_entry: {} });
    } finally { global.fetch = original; }
  });
  it("fails closed on outages, malformed replies and HTTP failures", async () => {
    const original = global.fetch;
    try {
      for (const handler of [async () => { throw new Error("offline"); }, async () => Response.json([], { status: 200 }), async () => Response.json({ ok: true }, { status: 500 })]) {
        global.fetch = handler;
        assert.deepEqual(await generationAllowance({ config: { ok: true, url: "https://example.supabase.co", serviceRoleKey: "test-server-key" }, organizationId: "org-a" }), { ok: false, code: "generation_allowance_unavailable" });
      }
    } finally { global.fetch = original; }
  });
});


describe("verified Stripe periods reach generation billing", () => {
  it("persists modern item periods alongside the tenant and workspace", async () => {
    const { createBilling } = require("../lib/sonara-billing.cjs");
    const { STRIPE_PLANS } = require("../lib/sonara-stripe-plans.cjs");
    const writes = [], previous = global.fetch;
    global.fetch = async (url, options) => {
      if (String(url).includes("/stripe_customers?")) return Response.json([
        { stripe_customer_id: "cus_test", organization_id: "org-a", user_id: "user_test" }
      ]);
      writes.push({ url, row: JSON.parse(options.body) });
      return Response.json([]);
    };
    try {
      const billing = createBilling({ STRIPE_PLANS, getEnv: (key) => key === "STRIPE_PRICE_WORKSPACE_MONTHLY" ? "price_FixtureWorkspace" : "", getPublicAppUrl: () => "https://example.test", getSafeAbsoluteUrl: (v) => v,
        getSupabaseServerConfig: () => ({ ok: true, url: "https://example.supabase.co", serviceRoleKey: "fixture-only" }), supabaseHeaders: () => ({}),
        safeCountTable: async () => ({ ok: true, count: 0 }), formatMetric: () => "", insertActivityEvent: async () => ({ ok: true }) });
      assert.equal((await billing.synchronizeBillingFromStripeEvent({ type: "customer.subscription.updated", created: start,
        data: { object: { id: "sub_test", customer: "cus_test", status: "active", metadata: { organization_id: "org-a", plan: "workspace_monthly", workspace: "creator_studio" },
          items: { data: [{ current_period_start: start, current_period_end: end }] } } } })).ok, true);
      assert.equal(writes.length, 2);
      for (const { row } of writes) { assert.equal(row.organization_id, "org-a"); assert.equal(row.metadata.current_period_start, new Date(start * 1000).toISOString()); assert.equal(row.metadata.current_period_end, new Date(end * 1000).toISOString()); assert.equal(row.metadata.workspace, "creator_studio"); }
      assert.equal(writes[0].row.current_period_end, new Date(end * 1000).toISOString());
    } finally { global.fetch = previous; }
  });
});
