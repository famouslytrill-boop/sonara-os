// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { createStripeReconciliationInspector } = require("../lib/sonara-stripe-reconciliation.cjs");

const ORGANIZATION = "00000000-0000-4000-8000-000000000051";
const SUBSCRIPTION = "sub_test123";
const CUSTOMER = "cus_test123";
const PRICE = "price_test123";
const saved = {
  organization_id: ORGANIZATION,
  provider_subscription_ref: SUBSCRIPTION,
  provider_customer_ref: CUSTOMER,
  plan_slug: "workspace_monthly",
  status: "active",
  provider_event_at: "2026-10-09T07:30:00.000Z",
  metadata: { workspace: "creator_studio" }
};
const provider = {
  id: SUBSCRIPTION, object: "subscription", customer: CUSTOMER,
  status: "active",
  metadata: { organization_id: ORGANIZATION, plan: "workspace_monthly", workspace: "creator_studio" },
  items: { data: [{ price: { id: PRICE }, quantity: 1 }], has_more: false }
};
const json = (body) => ({ ok: true, json: async () => body });

function harness({ row = saved, stripe = provider, testKey = "sk_test_fake_key", env = {},
  databaseResponse, stripeResponse } = {}) {
  const calls = [];
  const config = {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    STRIPE_SECRET_KEY: testKey,
    STRIPE_PRICE_WORKSPACE_MONTHLY: PRICE,
    ...env
  };
  const transport = async (url, options) => {
    calls.push({ url: String(url), options });
    assert.equal(options.method, "GET", "no POST/PATCH/DELETE ever issued during reconciliation");
    assert.equal(options.redirect, "error", "never forward scoped credentials to a redirect");
    if (String(url).includes("/rest/v1/billing_subscriptions?")) {
      return databaseResponse === undefined ? json([row]) : databaseResponse;
    }
    if (String(url).startsWith("https://api.stripe.com/v1/subscriptions/")) {
      return stripeResponse === undefined ? json(stripe) : stripeResponse;
    }
    throw Error("Unexpected URL, refusing side effect");
  };
  const inspector = createStripeReconciliationInspector({
    fetch: transport,
    getEnv: (name) => config[name] || "",
    getSupabaseServerConfig: () => ({ ok: true, url: config.NEXT_PUBLIC_SUPABASE_URL }),
    supabaseHeaders: () => ({ Authorization: "Bearer SERVICE_ROLE_SECRET" }),
    plans: { workspace_monthly: { env: "STRIPE_PRICE_WORKSPACE_MONTHLY", mode: "subscription" } }
  });
  return { inspector, calls };
}
const inspect = (h, options = {}) => h.inspector.inspect({
  organizationId: ORGANIZATION, subscriptionId: SUBSCRIPTION, ...options
});

describe("read-only provider-backed Stripe reconciliation", () => {
  it("only makes two scoped GETs for a fully matching subscription", async () => {
    const h = harness();
    const result = await inspect(h);
    assert.equal(result.code, "consistent");
    assert.equal(result.action, "none");
    assert.equal(result.readOnly, true);
    assert.equal(h.calls.length, 2);
    assert.match(h.calls[0].url, /organization_id=eq\.00000000-0000-4000-8000-000000000051/);
    assert.match(h.calls[0].url, /provider_subscription_ref=eq\.sub_test123/);
    assert.equal(h.calls[1].url, "https://api.stripe.com/v1/subscriptions/sub_test123");
    assert.equal(h.calls[1].options.headers.Authorization, "Bearer sk_test_fake_key");
    assert.doesNotMatch(JSON.stringify(result), /SERVICE_ROLE_SECRET|sk_test_fake_key|cus_test123/);
  });

  it("flags a provider cancellation as high-priority review, without mutating billing tables", async () => {
    const h = harness({ stripe: { ...provider, status: "canceled" } });
    const result = await inspect(h);
    assert.equal(result.code, "revocation_review_priority");
    assert.equal(result.action, "human_review");
    assert.equal(result.recordedStatus, "active");
    assert.equal(result.providerStatus, "canceled");
    assert.equal(h.calls.length, 2);
  });

  it("does not automatically clear a quarantined same-second conflict", async () => {
    const h = harness({ row: {
      ...saved, status: "reconciliation_required",
      metadata: { ...saved.metadata, same_second_conflict: true }
    } });
    const result = await inspect(h);
    assert.equal(result.code, "reconciliation_required");
    assert.equal(result.action, "human_review");
    assert.equal(h.calls.length, 2);
  });

  it("does not trust provider metadata to reassign a recorded tenant", async () => {
    const h = harness({ stripe: { ...provider, metadata: {
      ...provider.metadata, organization_id: "00000000-0000-4000-8000-000000000052"
    } } });
    const result = await inspect(h);
    assert.equal(result.code, "stripe_subscription_metadata_conflict");
    assert.equal(result.ok, false);
    assert.equal(h.calls.length, 2);
  });

  it("rejects a provider Customer ID that does not match the immutable tenant record", async () => {
    const h = harness({ stripe: { ...provider, customer: "cus_wrong123" } });
    const result = await inspect(h);
    assert.equal(result.code, "stripe_subscription_identity_unverified");
    assert.equal(h.calls.length, 2);
  });

  it("rejects wrong Stripe Price and extra subscription items without an access decision", async () => {
    for (const stripe of [
      { ...provider, items: { data: [{ price: { id: "price_wrong123" }, quantity: 1 }] } },
      { ...provider, items: { data: [provider.items.data[0], provider.items.data[0]] } },
      { ...provider, items: { data: [provider.items.data[0]], has_more: true } },
      { ...provider, items: { data: [{ price: PRICE, quantity: 2 }] } }
    ]) {
      const h = harness({ stripe });
      const result = await inspect(h);
      assert.equal(result.ok, false);
      assert.match(result.code, /stripe_subscription_(items_ambiguous|price_mismatch)/);
      assert.equal(h.calls.length, 2);
    }
  });

  it("rejects missing, ambiguous or mismatched historical subscription mappings before Stripe is contacted", async () => {
    for (const row of [[], [saved, saved], [{ ...saved, organization_id: "00000000-0000-4000-8000-000000000052" }]]) {
      const h = harness({ databaseResponse: json(row) });
      const result = await inspect(h);
      assert.equal(result.ok, false);
      assert.equal(h.calls.length, 1);
    }
    const h = harness({ row: { ...saved, provider_customer_ref: "cus_other" } });
    assert.equal((await inspect(h)).code, "stripe_subscription_identity_unverified");
  });

  it("refuses malformed or unreadable database/provider JSON without throwing or leaking account data", async () => {
    for (const response of [
      null, { ok: false }, { ok: true },
      { ok: true, json: () => { throw Error("synchronous parse failure"); } },
      { ok: true, json: async () => { throw Error("hidden key"); } }
    ]) {
      const h = harness({ databaseResponse: response });
      const result = await inspect(h);
      assert.equal(result.code, "subscription_record_unreadable");
      assert.equal(h.calls.length, 1);
    }
    const h = harness({ stripeResponse: { ok: true, json: async () => ({ error: { message: "secret" } }) } });
    assert.equal((await inspect(h)).code, "stripe_subscription_identity_unverified");
  });

  it("never queries a provider for missing or malformed customer / subscription IDs", async () => {
    for (const args of [
      { organizationId: "not-a-uuid", subscriptionId: SUBSCRIPTION },
      { organizationId: ORGANIZATION, subscriptionId: "sub_../../test" },
      { organizationId: ORGANIZATION, subscriptionId: "" }
    ]) {
      const h = harness();
      assert.equal((await inspect(h, args)).code, "invalid_inspection_scope");
      assert.equal(h.calls.length, 0);
    }
    const h = harness({ row: { ...saved, provider_customer_ref: null } });
    assert.equal((await inspect(h)).code, "subscription_identity_mismatch");
    assert.equal(h.calls.length, 1);
  });

  it("fails before provider access if catalog price configuration is missing", async () => {
    const h = harness({ env: { STRIPE_PRICE_WORKSPACE_MONTHLY: "" } });
    const result = await inspect(h);
    assert.equal(result.code, "configured_price_unavailable");
    assert.equal(h.calls.length, 1);
  });

  it("rejects live Stripe access without explicit read-only opt-in", async () => {
    const h = harness({ testKey: "sk_live_fake_key" });
    assert.equal((await inspect(h)).code, "live_inspection_requires_explicit_opt_in");
    assert.equal(h.calls.length, 0, "live-key refusal must happen before even database reads");
    const approved = await inspect(h, { allowLiveReadonly: true });
    assert.equal(approved.code, "consistent");
    assert.equal(h.calls.length, 2);
  });

  it("never follows an untrusted database origin", async () => {
    for (const url of ["http://project.supabase.co", "https://test:pass@project.supabase.co",
      "https://project.supabase.co/api", "https://project.supabase.co?key=x"]) {
      const h = harness({ env: { NEXT_PUBLIC_SUPABASE_URL: url } });
      assert.equal((await inspect(h)).code, "database_origin_untrusted");
      assert.equal(h.calls.length, 0);
    }
  });

  it("CLI provides explicit usage requirements without touching Stripe", async () => {
    const { main } = await import("../scripts/inspect-stripe-subscription.mjs");
    const printed = [];
    const count = await main({ argv: ["--invalid"], print: (value) => printed.push(value),
      env: {}, transport: async () => { throw Error("unexpected provider request"); } });
    assert.equal(count, 2);
    assert.match(printed[0], /Usage:.*--organization=/);
  });
});
