const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createBilling } = require("../lib/sonara-billing.cjs");
function billing(plans = { workspace_monthly: { mode: "subscription" } }) {
  return createBilling({
    STRIPE_PLANS: plans,
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
    const event = { type: "customer.subscription.updated", created: 1780000000, data: { object: {
      id: "sub_test", customer: "cus_test", status: "active", metadata: { organization_id: "org_test", plan: "workspace_monthly" }
    } } };
    for (const failedTable of ["billing_subscriptions", "billing_entitlements"]) {
      global.fetch = async (url) => String(url).includes("/stripe_customers?")
        ? { ok: true, json: async () => [{ stripe_customer_id: "cus_test", organization_id: "org_test", user_id: "user_test" }] }
        : { ok: !String(url).includes(failedTable) };
      assert.equal((await billing().synchronizeBillingFromStripeEvent(event)).ok, false);
    }
    global.fetch = async (url) => String(url).includes("/stripe_customers?")
      ? { ok: true, json: async () => [{ stripe_customer_id: "cus_test", organization_id: "org_test", user_id: "user_test" }] }
      : { ok: true };
    assert.equal((await billing().synchronizeBillingFromStripeEvent(event)).ok, true);
  });
  it("does not write parent billing records for connected merchant events", async () => {
    global.fetch = async () => { throw new Error("unexpected database access"); };
    assert.deepEqual(await billing().synchronizeBillingFromStripeEvent({ account: "acct_merchant", type: "customer.subscription.updated" }), { ok: true, ignored: true });
    assert.deepEqual(await billing().synchronizeCheckoutSessionCompleted({ account: "acct_merchant" }), { ok: true, ignored: true });
  });
  it("does not acknowledge a correctly classified paid checkout when its purchase write fails", async () => {
    const calls = [];
    global.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes("/stripe_customers?")) return { ok: true, json: async () => [
        { stripe_customer_id: "cus_test", organization_id: "org_test", user_id: "user_test" }
      ] };
      return { ok: !String(url).includes("/purchases?") };
    };
    const result = await billing({ legitimate_one_time: { mode: "payment" } }).synchronizeBillingFromStripeEvent({
      type: "checkout.session.async_payment_succeeded",
      data: { object: {
        id: "cs_test", customer: "cus_test", mode: "payment", payment_status: "paid",
        metadata: { organization_id: "org_test", plan: "legitimate_one_time" }
      } }
    });
    assert.equal(result.ok, false);
    assert.equal(calls.length, 2, "customer binding read and purchase write must both occur");
    assert.match(calls[0], /\/stripe_customers\?/);
    assert.match(calls[1], /\/purchases\?/);
  });

  it("never exchanges a one-time Checkout payment for recurring subscription entitlements", async () => {
    const plans = {
      workspace_monthly: { mode: "subscription" },
      all_three_monthly: { mode: "subscription" },
      team_monthly: { mode: "subscription" },
      workspace_annual: { mode: "subscription" },
      business_builder_one_time: { quoted: true, retired: true }
    };
    let calls = 0;
    global.fetch = async () => { calls += 1; throw Error("unauthorized database mutation"); };
    const service = billing(plans);
    for (const plan of [...Object.keys(plans), "unknown_plan", "free"]) {
      const response = await service.synchronizeBillingFromStripeEvent({
        type: "checkout.session.completed",
        data: { object: {
          id: "cs_guard_" + plan, mode: "payment", payment_status: "paid",
          metadata: { organization_id: "org_test", plan }
        } }
      });
      assert.deepEqual(response, { ok: false, code: "checkout_plan_mode_mismatch" }, plan);
    }
    assert.equal(calls, 0, "payment/subscription plan mismatch wrote a purchase or entitlement");
  });

  it("requires identity for a paid one-time Checkout session before making database writes", async () => {
    let calls = 0;
    global.fetch = async () => { calls += 1; throw Error("payment without metadata wrote to database"); };
    for (const session of [
      { mode: "payment", payment_status: "paid", metadata: { organization_id: "org_test", plan: "setup_one_time" } },
      { id: "cs_missing_org", mode: "payment", payment_status: "paid", metadata: { plan: "setup_one_time" } },
      { id: "cs_missing_plan", mode: "payment", payment_status: "paid", metadata: { organization_id: "org_test" } }
    ]) {
      const result = await billing({ setup_one_time: { mode: "payment" } }).synchronizeCheckoutSessionCompleted({
        data: { object: session }
      });
      assert.deepEqual(result, { ok: false, code: "checkout_metadata_missing" });
    }
    assert.equal(calls, 0);
  });

  it("fulfills only explicitly configured non-retired one-time plans after payment", async () => {
    const calls = [];
    global.fetch = async (url, init) => {
      if (String(url).includes("/stripe_customers?")) return { ok: true, json: async () => [
        { stripe_customer_id: "cus_test", organization_id: "org_test", user_id: "user_test" }
      ] };
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      return { ok: true };
    };
    const service = billing({ setup_one_time: { mode: "payment" }, workspace_monthly: { mode: "subscription" } });
    const receipt = { id: "cs_paid_once", customer: "cus_test", mode: "payment", payment_status: "paid",
      payment_intent: "pi_test", metadata: { organization_id: "org_test", plan: "setup_one_time", user_id: "user_test" } };
    const result = await service.synchronizeBillingFromStripeEvent({
      type: "checkout.session.async_payment_succeeded", data: { object: receipt }
    });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/purchases\?/);
    assert.match(calls[1].url, /\/billing_entitlements\?/);
    assert.equal(calls[0].body.organization_id, "org_test");
    assert.equal(calls[1].body.organization_id, "org_test");
    assert.equal(calls[1].body.entitlement_key, "setup_one_time");
    assert.equal(calls[1].body.metadata.checkout_session_id, "cs_paid_once");
  });

  it("ignores non-payment sessions and unpaid one-time checkouts without fulfillment", async () => {
    let calls = 0;
    global.fetch = async () => { calls += 1; throw Error("unpaid session caused mutation"); };
    const service = billing({ setup_one_time: { mode: "payment" } });
    for (const session of [
      { id: "cs_subscription", mode: "subscription", payment_status: "paid", metadata: { plan: "setup_one_time" } },
      { id: "cs_unpaid", mode: "payment", payment_status: "unpaid", metadata: { plan: "setup_one_time" } }
    ]) {
      assert.deepEqual(await service.synchronizeCheckoutSessionCompleted({ data: { object: session } }), { ok: true, ignored: true });
    }
    assert.equal(calls, 0);
  });

  it("refuses to assign signed subscription events to a tenant that does not own the Stripe customer", async () => {
    const event = (org, customer = "cus_test") => ({
      type: "customer.subscription.updated", created: 1780000000,
      data: { object: {
        id: "sub_test", customer, status: "active",
        metadata: { organization_id: org, plan: "workspace_monthly" }
      } }
    });
    const cases = [
      { rows: [], code: "stripe_webhook_customer_mismatch" },
      { rows: [{ stripe_customer_id: "cus_test", organization_id: "org_B", user_id: "user_A" }], code: "stripe_webhook_customer_mismatch" },
      { rows: [
        { stripe_customer_id: "cus_test", organization_id: "org_A", user_id: "user_A" },
        { stripe_customer_id: "cus_test", organization_id: "org_A", user_id: "user_B" }
      ], code: "stripe_webhook_customer_mismatch" },
      { rows: { code: "unexpected_object" }, code: "stripe_webhook_customer_unreadable" },
      { rows: null, code: "stripe_webhook_customer_unreadable" }
    ];
    for (const { rows, code } of cases) {
      const urls = [];
      global.fetch = async (url) => {
        urls.push(String(url));
        return { ok: true, json: async () => rows };
      };
      assert.deepEqual(await billing().synchronizeBillingFromStripeEvent(event("org_A")), { ok: false, code });
      assert.equal(urls.length, 1, "subscription or entitlement write attempted after bad ownership read");
      assert.match(urls[0], /\/stripe_customers\?/);
      assert.match(urls[0], /stripe_customer_id=eq.cus_test/);
    }
    let writes = 0;
    global.fetch = async () => { writes++; throw new Error("customer absence caused I/O"); };
    assert.deepEqual(
      await billing().synchronizeBillingFromStripeEvent(event("org_A", null)),
      { ok: false, code: "stripe_webhook_customer_missing" }
    );
    assert.equal(writes, 0);
  });

  it("refuses a one-time receipt whose user or organization conflicts with the immutable customer ledger", async () => {
    const service = billing({ setup_one_time: { mode: "payment" } });
    const event = (org, user) => ({
      type: "checkout.session.completed",
      data: { object: {
        id: "cs_test", customer: "cus_test", mode: "payment", payment_status: "paid",
        metadata: { organization_id: org, plan: "setup_one_time", user_id: user }
      } }
    });
    for (const [org, user] of [["org_other", "user_owner"], ["org_owner", "user_other"]]) {
      const urls = [];
      global.fetch = async (url) => {
        urls.push(String(url));
        return { ok: true, json: async () => [{
          stripe_customer_id: "cus_test", organization_id: "org_owner", user_id: "user_owner"
        }] };
      };
      assert.deepEqual(await service.synchronizeBillingFromStripeEvent(event(org, user)),
        { ok: false, code: "stripe_webhook_customer_mismatch" });
      assert.equal(urls.length, 1, "purchase/entitlement was written from wrong customer binding");
    }
  });

  it("does not acknowledge cancellation when the saved subscription cannot be read", async () => {
    const ev = {
      type: "customer.subscription.deleted", created: 1780000000,
      data: { object: {
        id: "sub_deleted", customer: "cus_test", status: "canceled",
        metadata: { organization_id: "org_test", plan: "workspace_monthly" }
      } }
    };
    for (const response of [undefined, { ok: false }, { ok: true, json: async () => { throw Error("broken JSON"); } }]) {
      const urls = [];
      global.fetch = async (url) => { urls.push(String(url)); return response; };
      assert.deepEqual(await billing().synchronizeBillingFromStripeEvent(ev),
        { ok: false, code: "stripe_cancellation_subscription_unreadable" });
      assert.equal(urls.length, 1);
      assert.match(urls[0], /\/billing_subscriptions\?/);
    }
  });

  it("revokes a previously recorded canceled subscription without a remaining Stripe customer map", async () => {
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), body: options?.body ? JSON.parse(options.body) : null });
      if (String(url).includes("billing_subscriptions?select=")) return {
        ok: true, json: async () => [{
          provider_subscription_ref: "sub_cancel", provider_customer_ref: "cus_original",
          organization_id: "org_original", plan_slug: "workspace_monthly",
          metadata: { workspace: "creator_studio" }
        }]
      };
      if (String(url).includes("/stripe_customers?")) throw new Error("deleted mapping must not be consulted for cancellation");
      return { ok: true };
    };
    const event = { type: "customer.subscription.deleted", created: 1780000000, data: { object: {
      id: "sub_cancel", customer: "cus_original", status: "canceled",
      metadata: {}
    } } };
    const outcome = await billing().synchronizeBillingFromStripeEvent(event);
    assert.equal(outcome.ok, true);
    assert.equal(calls.length, 3, "one historical verification plus two upserts");
    assert.match(calls[0].url, /provider_subscription_ref=eq.sub_cancel/);
    assert.equal(calls[1].body.organization_id, "org_original");
    assert.equal(calls[1].body.status, "canceled");
    assert.equal(calls[1].body.provider_customer_ref, "cus_original");
    assert.equal(calls[2].body.organization_id, "org_original");
    assert.equal(calls[2].body.status, "disabled");
    assert.equal(calls[2].body.entitlement_key, "workspace_monthly");
    assert.equal(calls[2].body.metadata.workspace, "creator_studio");
  });

  it("does not reassign a cancellation to an unrelated tenant or provider customer", async () => {
    const cases = [
      { organization_id: "org_attacker" },
      { plan: "all_three_monthly" },
      { workspace: "growth_studio" }
    ];
    const persisted = {
      provider_subscription_ref: "sub_cancel", provider_customer_ref: "cus_original",
      organization_id: "org_original", plan_slug: "workspace_monthly",
      metadata: { workspace: "creator_studio" }
    };
    for (const metadata of cases) {
      const calls = [];
      global.fetch = async (url) => {
        calls.push(String(url));
        return { ok: true, json: async () => [persisted] };
      };
      const response = await billing().synchronizeBillingFromStripeEvent({
        type: "customer.subscription.deleted", created: 1780000000, data: { object: {
          id: "sub_cancel", customer: "cus_original", status: "canceled", metadata
        } }
      });
      assert.deepEqual(response, { ok: false, code: "stripe_cancellation_subscription_mismatch" });
      assert.equal(calls.length, 1, "no writes after a conflicting metadata claim");
    }
    for (const mismatch of [
      { provider_customer_ref: "cus_another" },
      { provider_subscription_ref: "sub_other" },
      { organization_id: null },
      { plan_slug: "unrecognized_plan" }
    ]) {
      let calls = 0;
      global.fetch = async () => {
        calls += 1;
        return { ok: true, json: async () => [{ ...persisted, ...mismatch }] };
      };
      const result = await billing().synchronizeBillingFromStripeEvent({
        type: "customer.subscription.deleted", created: 1780000000, data: { object: {
          id: "sub_cancel", customer: "cus_original", status: "canceled"
        } }
      });
      assert.equal(result.code, "stripe_cancellation_subscription_mismatch");
      assert.equal(calls, 1);
    }
  });

  it("never treats a mislabeled deletion as an authorized cancellation", async () => {
    let count = 0;
    global.fetch = async () => { count += 1; throw Error("unverified cancellation caused I/O"); };
    for (const bad of [
      { id: "sub_cancel", customer: "cus_original", status: "active" },
      { id: "sub_cancel", customer: "not-a-customer", status: "canceled" }
    ]) {
      const result = await billing().synchronizeBillingFromStripeEvent({
        type: "customer.subscription.deleted", created: 1780000000, data: { object: bad }
      });
      assert.deepEqual(result, { ok: false, code: "stripe_cancellation_invalid" });
    }
    assert.equal(count, 0);
  });

  it("does not invent a subscription owner when historical cancellation proof is missing or ambiguous", async () => {
    const ev = {
      type: "customer.subscription.deleted", created: 1780000000,
      data: { object: { id: "sub_cancel", customer: "cus_original", status: "canceled" } }
    };
    const valid = {
      provider_subscription_ref: "sub_cancel", provider_customer_ref: "cus_original",
      organization_id: "org_original", plan_slug: "workspace_monthly", metadata: {}
    };
    for (const rows of [
      [],
      [valid, valid],
      { code: "postgrest_singular" },
      null,
      [{ ...valid, provider_customer_ref: "cus_wrong" }]
    ]) {
      let calls = 0;
      global.fetch = async (url) => {
        calls += 1;
        assert.match(String(url), /billing_subscriptions\?select=/);
        return { ok: true, json: async () => rows };
      };
      const result = await billing().synchronizeBillingFromStripeEvent(ev);
      assert.equal(result.ok, false);
      assert.match(result.code, /stripe_cancellation_subscription_(unreadable|mismatch)/);
      assert.equal(calls, 1, "invalid historical identity must not write any billing row");
    }
  });

  it("does not use the cancellation-only fallback for inactive subscription updates", async () => {
    const calls = [];
    global.fetch = async (url) => {
      calls.push(String(url));
      return { ok: true, json: async () => [] };
    };
    const response = await billing().synchronizeBillingFromStripeEvent({
      type: "customer.subscription.updated", created: 1780000000,
      data: { object: {
        id: "sub_cancel", customer: "cus_original", status: "canceled",
        metadata: { organization_id: "org_original", plan: "workspace_monthly" }
      } }
    });
    assert.deepEqual(response, { ok: false, code: "stripe_webhook_customer_mismatch" });
    assert.equal(calls.length, 1);
    assert.match(calls[0], /stripe_customers\?/);
  });

  it("leaves canceled subscription reconciliation retryable when entitlement persistence fails", async () => {
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push(String(url));
      if (String(url).includes("billing_subscriptions?select=")) return {
        ok: true, json: async () => [{
          organization_id: "org_original", provider_customer_ref: "cus_original",
          provider_subscription_ref: "sub_cancel", plan_slug: "workspace_monthly", metadata: {}
        }]
      };
      if (String(url).includes("/billing_entitlements?")) return { ok: false, status: 503 };
      return { ok: true };
    };
    const result = await billing().synchronizeBillingFromStripeEvent({
      type: "customer.subscription.deleted", created: 1780000000,
      data: { object: { id: "sub_cancel", customer: "cus_original", status: "canceled" } }
    });
    assert.equal(result.ok, false);
    assert.equal(calls.length, 3);
    assert.match(calls[1], /billing_subscriptions\?on_conflict=/);
    assert.match(calls[2], /billing_entitlements\?on_conflict=/);
  });

  it("never creates a provider customer when the tenant mapping cannot be read", async () => {
    for (const response of [undefined, { ok: false }, { ok: true, json: async () => { throw Error("bad JSON"); } }, { ok: true, json: async () => ({}) }]) {
      const calls = [];
      global.fetch = async (url) => { calls.push(url); return response; };
      const result = await billing().getOrCreateStripeCustomer({ id: "user" }, "org");
      assert.equal(result.code, "stripe_customer_mapping_unreadable");
      assert.equal(calls.length, 1);
      assert.ok(calls[0].includes("organization_id=eq.org&user_id=eq.user"));
    }
  });

  it("refuses conflicting or malformed customer mappings", async () => {
    for (const rows of [[{ stripe_customer_id: "cus_A" }, { stripe_customer_id: "cus_B" }], [{ stripe_customer_id: "acct_wrong" }]]) {
      let calls = 0;
      global.fetch = async () => { calls += 1; return { ok: true, json: async () => rows }; };
      assert.equal((await billing().getOrCreateStripeCustomer({ id: "user" }, "org")).ok, false);
      assert.equal(calls, 1);
    }
  });

  it("reuses an existing tenant mapping without contacting Stripe", async () => {
    let calls = 0;
    global.fetch = async () => { calls += 1; return { ok: true, json: async () => [{ stripe_customer_id: "cus_A" }] }; };
    assert.deepEqual(await billing().getOrCreateStripeCustomer({ id: "user" }, "org"), { ok: true, stripeCustomerId: "cus_A", source: "database" });
    assert.equal(calls, 1);
  });

  it("rejects an unreadable provider response without recording a mapping", async () => {
    for (const customer of [null, {}, { id: "acct_wrong" }]) {
      let writes = 0;
      global.fetch = async (url, init) => {
        if (url === "https://api.stripe.com/v1/customers") return { ok: true, json: async () => customer };
        if (init.method === "POST") writes += 1;
        return { ok: true, json: async () => [] };
      };
      assert.equal((await billing().getOrCreateStripeCustomer({ id: "user" }, "org")).code, "stripe_customer_missing");
      assert.equal(writes, 0);
    }
  });

  it("blocks checkout after a failed mapping write and retries with stable provider parameters", async () => {
    const providerCalls = [];
    let writable = false;
    let stored = false;
    global.fetch = async (url, init) => {
      if (url === "https://api.stripe.com/v1/customers") {
        providerCalls.push(init);
        return { ok: true, json: async () => ({ id: "cus_Retry" }) };
      }
      if (init.method === "POST") { stored = writable; return { ok: writable }; }
      return { ok: true, json: async () => stored ? [{ stripe_customer_id: "cus_Retry" }] : [] };
    };
    const service = billing();
    assert.equal((await service.getOrCreateStripeCustomer({ id: "user", email: "old@example.com" }, "org")).code, "stripe_customer_mapping_unwritable");
    writable = true;
    assert.equal((await service.getOrCreateStripeCustomer({ id: "user", email: "new@example.com" }, "org")).ok, true);
    assert.equal(providerCalls.length, 2);
    assert.equal(providerCalls[0].headers["Idempotency-Key"], providerCalls[1].headers["Idempotency-Key"]);
    assert.equal(providerCalls[0].body, providerCalls[1].body);
    assert.equal(providerCalls[0].headers["Idempotency-Key"].includes("user"), false);
  });

  it("separates tenant creation keys and refuses an unconfirmed conflict write", async () => {
    const keys = [];
    global.fetch = async (url, init) => {
      if (url === "https://api.stripe.com/v1/customers") {
        keys.push(init.headers["Idempotency-Key"]);
        return { ok: true, json: async () => ({ id: "cus_Conflict" }) };
      }
      return { ok: true, json: async () => [] };
    };
    for (const org of ["orgA", "orgB"]) {
      assert.equal((await billing().getOrCreateStripeCustomer({ id: "user" }, org)).code, "stripe_customer_mapping_unconfirmed");
    }
    assert.notEqual(keys[0], keys[1]);
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
      process.env.STRIPE_WEBHOOK_SECRET = ["whsec", "delivery", "regression", "fixture"].join("_");
      process.env.STRIPE_WEBHOOK_SECRET = ["whsec", "delivery", "regression", "1234567890"].join("_");
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://delivery.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role";
      const payload = JSON.stringify({ id: "evt_retry", type: "customer.subscription.updated", created: 1780000000, data: { object: {
        id: "sub_retry", customer: "cus_retry", status: "active", metadata: { organization_id: "00000000-0000-0000-0000-000000000051", plan: "workspace_monthly" }
      } } });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex");
      const send = () => request(app).post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", `t=${timestamp},v1=${signature}`).send(payload);
      global.fetch = async (url) => ({
        ok: !String(url).includes("billing_entitlements"),
        json: async () => String(url).includes("/stripe_customers?")
          ? [{ stripe_customer_id: "cus_retry", organization_id: "00000000-0000-0000-0000-000000000051", user_id: "user_test" }] : []
      });
      const failed = await send();
      assert.equal(failed.status, 503);
      assert.equal(failed.body.code, "billing_sync_retry_required");
      global.fetch = async (url) => ({
        ok: !String(url).includes("billing_webhook_events"),
        json: async () => String(url).includes("/stripe_customers?")
          ? [{ stripe_customer_id: "cus_retry", organization_id: "00000000-0000-0000-0000-000000000051", user_id: "user_test" }] : []
      });
      const auditFailed = await send();
      assert.equal(auditFailed.status, 503);
      assert.equal(auditFailed.body.code, "billing_audit_retry_required");
      global.fetch = async (url) => ({
        ok: true,
        json: async () => String(url).includes("/stripe_customers?")
          ? [{ stripe_customer_id: "cus_retry", organization_id: "00000000-0000-0000-0000-000000000051", user_id: "user_test" }] : []
      });
      assert.equal((await send()).status, 200);
    } finally {
      global.fetch = previousFetch;
      keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
    }
  });
});
