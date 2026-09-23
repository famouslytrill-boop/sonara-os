// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const {
  SNAPSHOT_DATE,
  CHANNELS,
  CANONICAL_COMMERCE_GRAPH,
  INVARIANTS,
  MARKET_SIGNALS,
  BENCHMARKS,
  ROADMAP,
  AGENT_POLICY,
  availableToPromise,
  commerceReadinessScore,
  getCommerceMarketRadar2026
} = require("../lib/commerce-market-radar-2026.cjs");

describe("SONARA commerce + omnichannel market radar 2026", () => {
  it("is dated research with no runtime or payment authority", () => {
    const radar = getCommerceMarketRadar2026();
    assert.equal(SNAPSHOT_DATE, "2026-09-22");
    assert.equal(radar.authority, "research_and_design_only");
    assert.equal(radar.runtimeAuthority, "none");
    assert.equal(radar.executionEnabled, false);
    assert.equal(radar.productionClaim, false);
  });

  it("defines one commerce graph across digital physical B2B and agent channels", () => {
    for (const key of [
      "product", "variant", "inventory_position", "cart", "checkout_session",
      "order", "fulfillment", "return_authorization", "refund", "purchase_order",
      "transfer_order", "register", "evidence_event"
    ]) assert.ok(CANONICAL_COMMERCE_GRAPH.includes(key), key);

    for (const channel of [
      "owned_web_storefront", "staff_pos", "self_service_kiosk",
      "b2b_portal", "agentic_commerce", "pickup", "local_delivery"
    ]) assert.ok(CHANNELS.includes(channel), channel);
  });

  it("keeps channel adapters from becoming sources of truth", () => {
    assert.ok(INVARIANTS.some((item) => /channel adapters never become the source of truth/i.test(item)));
    assert.ok(INVARIANTS.some((item) => /payment credentials never enter model context/i.test(item)));
    assert.ok(INVARIANTS.some((item) => /returns are first-class/i.test(item)));
  });

  it("preserves source provenance and market-reference boundaries", () => {
    assert.ok(MARKET_SIGNALS.length >= 15);
    for (const item of MARKET_SIGNALS) {
      assert.match(item.sourceUrl, /^https:\/\//, item.key);
      assert.match(item.observedAt, /^202[5-6]-\d{2}-\d{2}$/, item.key);
      assert.equal(item.relationship, "market_reference_not_integration");
      assert.ok(item.finding.length > 20, item.key);
      assert.ok(item.designRule.length > 20, item.key);
    }
    assert.ok(BENCHMARKS.length >= 10);
    for (const item of BENCHMARKS) assert.equal(item.relationship, "market_reference_not_integration");
  });

  it("computes available-to-promise deterministically and never below zero", () => {
    assert.equal(availableToPromise({ onHand: 10, reserved: 2, safetyStock: 3, blocked: 1 }), 4);
    assert.equal(availableToPromise({ onHand: 2, reserved: 5 }), 0);
    assert.throws(() => availableToPromise({ onHand: "unknown" }), /finite numbers/);
  });

  it("scores commerce readiness deterministically without pretending it is a forecast", () => {
    const perfect = {
      catalogIntegrity: 1,
      inventoryAccuracy: 1,
      orderLifecycle: 1,
      paymentReconciliation: 1,
      fulfillmentEvidence: 1,
      returnsLifecycle: 1,
      channelConsistency: 1,
      securityAndAuthority: 1
    };
    assert.equal(commerceReadinessScore(perfect), 100);
    assert.equal(commerceReadinessScore(perfect), commerceReadinessScore(perfect));
    assert.equal(commerceReadinessScore({ catalogIntegrity: 999 }), 18);
  });

  it("stages runtime expansion instead of turning every commerce surface on", () => {
    assert.ok(ROADMAP.days0to30.some((item) => /Canonical Commerce Graph/i.test(item)));
    assert.ok(ROADMAP.days30to90.some((item) => /owned storefront canary/i.test(item)));
    assert.ok(ROADMAP.days30to90.some((item) => /staff POS canary/i.test(item)));
    assert.ok(ROADMAP.days90to180.some((item) => /agentic-commerce adapter/i.test(item)));
  });

  it("keeps autonomous spend and sensitive commerce mutations bounded", () => {
    assert.ok(AGENT_POLICY.forbiddenByDefault.includes("placing unrestricted purchases"));
    assert.ok(AGENT_POLICY.deterministicCommandRequired.includes("issue refund"));
    assert.ok(AGENT_POLICY.explicitHumanOrPolicyAuthorizationRequired.includes("capture or commit spend"));
  });
});
