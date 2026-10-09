"use strict";

// The entitlement reader asks two tables whether this customer holds a plan
// that opens this product: `billing_entitlements`, then `billing_subscriptions`.
// Both reads were guarded by `if (response?.ok)` with no else, so a read that
// failed and a read that found nothing arrived at the same ending — 402, and
// this sentence:
//
//   "Paid access is locked until payment updates show an active or trialing
//    plan, or an active one-time purchase."
//
// rendered under the heading "Upgrade required", beside a link to pricing.
//
// That is a paying customer being told, during an outage on our side, that they
// have not paid. 402 is literally Payment Required. The first thing somebody
// thinks when shown a paywall they already paid past is that they have been
// charged wrongly, and the page confirms it.
//
// A plan can live in either table, so one silent read is enough to make the
// conclusion unfounded.

const assert = require("node:assert/strict");
const { createPaidEntitlementReader } = require("../lib/sonara-paid-entitlement.cjs");

const USER = { id: "22222222-2222-4222-8222-222222222222", email: "paid@example.com" };
const CONFIG = { ok: true, url: "https://project.supabase.co", serviceRoleKey: "service-role" };
const ORGANIZATION = { ok: true, organizationId: "org-1", source: "organization_memberships" };

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const failed = () => ({ ok: false, status: 500, json: async () => ({}) });

// `entitlements` and `subscriptions` are what each billing table answers: an
// array of rows, or "failed" for a read that did not answer.
function build({ entitlements = [], subscriptions = [], organization = ORGANIZATION, allowedKeys = ["all_three_monthly", "team_monthly"] } = {}) {
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/billing_entitlements")) return entitlements === "failed" ? failed() : ok(entitlements);
    if (target.includes("/billing_subscriptions")) return subscriptions === "failed" ? failed() : ok(subscriptions);
    throw new Error(`unexpected read: ${target}`);
  };
  return createPaidEntitlementReader({
    getCustomerPrimaryOrganization: async () => organization,
    getSupabaseServerConfig: () => CONFIG,
    supabaseHeaders: () => ({ apikey: CONFIG.serviceRoleKey }),
    getPaidEntitlementKeys: () => allowedKeys
  });
}

describe("a paying customer is not shown a paywall we cannot justify", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  it("preserves separately granted historical one-time purchase access", async () => {
    const read = build({
      allowedKeys: ["business_builder_one_time", "workspace_monthly"],
      entitlements: [{ entitlement_key: "business_builder_one_time", status: "active" }]
    });
    const result = await read(USER, "business_builder");
    assert.equal(result.ok, true);
    assert.equal(result.source, "billing_entitlements");
  });

  it("does not accept an active recurring entitlement when every subscription is canceled", async () => {
    const result = await build({
      entitlements: [{ entitlement_key: "all_three_monthly", status: "active" }],
      subscriptions: []
    })(USER, "creator_studio");
    assert.equal(result.ok, false);
    assert.equal(result.code, "upgrade_required");
    assert.equal(result.reason, "billing_state_missing");
  });

  it("uses the matching active subscription instead of the first workspace's subscription", async () => {
    const read = build({
      allowedKeys: ["workspace_monthly"],
      entitlements: [{ entitlement_key: "workspace_monthly", status: "active", metadata: { workspace: "business_builder" } }],
      subscriptions: [
        { plan_slug: "workspace_monthly", status: "active", metadata: { workspace: "business_builder" } },
        { plan_slug: "workspace_monthly", status: "trialing", metadata: { workspace: "creator_studio" } }
      ]
    });
    const result = await read(USER, "creator_studio");
    assert.equal(result.ok, true);
    assert.equal(result.source, "billing_subscriptions");
    assert.equal(result.entitlementKey, "workspace_monthly");
  });

  it("keeps searching across different active plans instead of denying on the first mismatch", async () => {
    const result = await build({
      allowedKeys: ["workspace_monthly", "all_three_monthly"],
      subscriptions: [
        { plan_slug: "workspace_monthly", status: "active", metadata: { workspace: "growth_studio" } },
        { plan_slug: "all_three_monthly", status: "active", metadata: {} }
      ]
    })(USER, "creator_studio");
    assert.equal(result.ok, true);
    assert.equal(result.entitlementKey, "all_three_monthly");
  });

  it("does not unlock an unrelated workspace when all active subscriptions cover different workspaces", async () => {
    const result = await build({
      allowedKeys: ["workspace_monthly"],
      subscriptions: [
        { plan_slug: "workspace_monthly", status: "active", metadata: { workspace: "growth_studio" } },
        { plan_slug: "workspace_monthly", status: "active", metadata: { workspace: "business_builder" } }
      ]
    })(USER, "creator_studio");
    assert.equal(result.ok, false);
    assert.equal(result.status, 402);
    assert.equal(result.reason, "different_workspace_chosen");
  });

  it("does not trust a recurring entitlement when the subscription read fails", async () => {
    const result = await build({
      entitlements: [{ entitlement_key: "all_three_monthly", status: "active" }],
      subscriptions: "failed"
    })(USER, "creator_studio");
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.code, "entitlement_unreadable");
  });

  it("fails closed when more active subscriptions exist than can be evaluated", async () => {
    const subscriptions = Array.from({ length: 101 }, (_, index) => ({
      plan_slug: "workspace_monthly", status: "active", metadata: { workspace: "business_builder" },
      sequence: index
    }));
    const result = await build({
      allowedKeys: ["workspace_monthly"], subscriptions
    })(USER, "creator_studio");
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.reason, "subscription_scan_incomplete");
  });

  it("does not misreport an unreadable subscription as a different-workspace paywall", async () => {
    const result = await build({
      allowedKeys: ["workspace_monthly"],
      entitlements: [{ entitlement_key: "workspace_monthly", status: "active", metadata: { workspace: "business_builder" } }],
      subscriptions: "failed"
    })(USER, "creator_studio");
    assert.equal(result.status, 503);
    assert.equal(result.code, "entitlement_unreadable");
  });

  it("rejects malformed returned entitlement or subscription rows", async () => {
    for (const candidate of [
      { entitlements: [null] },
      { entitlements: [{ entitlement_key: "unrecognized", status: "active" }] },
      { subscriptions: [null] },
      { subscriptions: [{ plan_slug: "unknown", status: "active" }] }
    ]) {
      const result = await build(candidate)(USER, "creator_studio");
      assert.equal(result.status, 503);
      assert.equal(result.code, "entitlement_unreadable");
    }
  });

  it("opens the product on an active subscription", async () => {
    const read = build({ subscriptions: [{ plan_slug: "team_monthly", status: "active" }] });
    const result = await read(USER, "creator_studio");
    assert.equal(result.ok, true);
    assert.equal(result.source, "billing_subscriptions");
  });

  // Without this, the assertions below would pass against a reader that never
  // says upgrade_required at all, and the distinction they are about would be
  // untested.
  it("still asks for payment when both reads answered and found nothing", async () => {
    const result = await build({})(USER, "creator_studio");
    assert.equal(result.ok, false);
    assert.equal(result.status, 402);
    assert.equal(result.code, "upgrade_required");
    assert.equal(result.reason, "billing_state_missing");
    assert.match(result.message, /Paid access is locked until payment updates show an active or trialing plan/);
  });

  it("does not ask for payment when the entitlement read failed", async () => {
    const result = await build({ entitlements: "failed" })(USER, "creator_studio");
    assert.equal(result.status, 503, "a customer was shown Payment Required over a read that never happened");
    assert.equal(result.code, "entitlement_unreadable");
    assert.doesNotMatch(result.message, /locked|upgrade|payment updates/i);
  });

  it("does not ask for payment when the subscription read failed", async () => {
    // The one that matters most: a plan held in billing_subscriptions and only
    // that read failing. The entitlement read answers, correctly, with nothing.
    const result = await build({ entitlements: [], subscriptions: "failed" })(USER, "creator_studio");
    assert.equal(result.status, 503);
    assert.equal(result.reason, "billing_state_unreadable");
  });

  it("does not ask for payment when a read answered with something that is not a list", async () => {
    const result = await build({ entitlements: { message: "server error" }, subscriptions: [] })(USER, "creator_studio");
    assert.equal(result.code, "entitlement_unreadable");
  });

  it("does not ask for payment when the workspace itself could not be read", async () => {
    const result = await build({ organization: { ok: false, code: "workspace_unreadable" } })(USER, "creator_studio");
    assert.equal(result.status, 503);
    assert.equal(result.reason, "workspace_unreadable");
  });

  it("still asks for payment when the customer genuinely has no workspace", async () => {
    const result = await build({ organization: { ok: false, code: "workspace_not_ready" } })(USER, "creator_studio");
    assert.equal(result.status, 402);
    assert.equal(result.code, "upgrade_required");
  });

  it("gives the page a heading that is not a demand for money", async () => {
    // server.js renders `heading` as the page title and drops the pricing link
    // when it is present. Without it a 503 rendered under "Upgrade required".
    const unreadable = await build({ entitlements: "failed" })(USER, "creator_studio");
    assert.equal(unreadable.heading, "We could not check your plan");

    const unpaid = await build({})(USER, "creator_studio");
    assert.equal(unpaid.heading, undefined, "a genuine upgrade must keep the upgrade heading and the pricing link");
  });
});
