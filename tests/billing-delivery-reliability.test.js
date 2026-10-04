const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createBilling } = require("../lib/sonara-billing.cjs");
function billing() {
  return createBilling({
    STRIPE_PLANS: { workspace_monthly: { mode: "subscription" } },
    getEnv: () => "", getPublicAppUrl: () => "https://example.com",
    getSafeAbsoluteUrl: (value, fallback) => value || fallback,
    getSupabaseServerConfig: () => ({ ok: true, url: "https://database.example.com" }),
    supabaseHeaders: () => ({}), safeCountTable: async () => 0,
    formatMetric: () => "", insertActivityEvent: async () => undefined
  });
}
describe("billing delivery reliability", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it("rejects correctly signed old and future deliveries and accepts an overlapping key", () => {
    const service = billing(), body = Buffer.from("{}"), secret = "test-secret";
    const now = Math.floor(Date.now() / 1000);
    const header = (stamp) => `t=${stamp},v1=${crypto.createHmac("sha256", secret).update(`${stamp}.${body}`).digest("hex")}`;
    assert.equal(service.verifyStripeWebhookSignature(body, header(now - 600), secret).ok, false);
    assert.equal(service.verifyStripeWebhookSignature(body, header(now + 600), secret).ok, false);
    assert.equal(service.verifyStripeWebhookSignature(body, `${header(now)},v1=${"0".repeat(64)}`, secret).ok, true);
    assert.equal(service.verifyStripeWebhookSignature(body, `${header(now)},t=${now}`, secret).ok, false);
  });
  it("requires both subscription and entitlement writes to succeed", async () => {
    const event = { type: "customer.subscription.updated", data: { object: {
      id: "sub_test", status: "active", metadata: { organization_id: "org_test", plan: "workspace_monthly" }
    } } };
    for (const failedTable of ["billing_subscriptions", "billing_entitlements"]) {
      global.fetch = async (url) => ({ ok: !url.includes(failedTable) });
      assert.equal((await billing().synchronizeBillingFromStripeEvent(event)).ok, false);
    }
    global.fetch = async () => ({ ok: true });
    assert.equal((await billing().synchronizeBillingFromStripeEvent(event)).ok, true);
  });
  it("does not write parent billing records for connected merchant events", async () => {
    global.fetch = async () => { throw new Error("unexpected database access"); };
    assert.deepEqual(await billing().synchronizeBillingFromStripeEvent({ account: "acct_merchant", type: "customer.subscription.updated" }), { ok: true, ignored: true });
    assert.deepEqual(await billing().synchronizeCheckoutSessionCompleted({ account: "acct_merchant" }), { ok: true, ignored: true });
  });
  it("does not acknowledge a paid checkout when its purchase write fails", async () => {
    global.fetch = async (url) => ({ ok: !url.includes("/purchases?") });
    const result = await billing().synchronizeBillingFromStripeEvent({ type: "checkout.session.async_payment_succeeded", data: { object: {
      id: "cs_test", mode: "payment", payment_status: "paid", metadata: { organization_id: "org_test", plan: "legacy_purchase" }
    } } });
    assert.equal(result.ok, false);
  });
});

describe("billing webhook HTTP retry contract", () => {
  it("returns 503 for persistence failure, then 200 after a successful retry", async () => {
    const request = require("supertest");
    const app = require("../server");
    const keys = ["STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
    const saved = keys.map((key) => process.env[key]);
    const previousFetch = global.fetch;
    try {
      process.env.STRIPE_WEBHOOK_SECRET = "test_webhook_secret";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://delivery.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role";
      const payload = JSON.stringify({ id: "evt_retry", type: "customer.subscription.updated", data: { object: {
        id: "sub_retry", status: "active", metadata: { organization_id: "00000000-0000-0000-0000-000000000051", plan: "workspace_monthly" }
      } } });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex");
      const send = () => request(app).post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", `t=${timestamp},v1=${signature}`).send(payload);
      global.fetch = async (url) => ({ ok: !String(url).includes("billing_entitlements"), json: async () => [] });
      const failed = await send();
      assert.equal(failed.status, 503);
      assert.equal(failed.body.code, "billing_sync_retry_required");
      global.fetch = async (url) => ({ ok: !String(url).includes("billing_webhook_events"), json: async () => [] });
      const auditFailed = await send();
      assert.equal(auditFailed.status, 503);
      assert.equal(auditFailed.body.code, "billing_audit_retry_required");
      global.fetch = async () => ({ ok: true, json: async () => [] });
      assert.equal((await send()).status, 200);
    } finally {
      global.fetch = previousFetch;
      keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
    }
  });
});
