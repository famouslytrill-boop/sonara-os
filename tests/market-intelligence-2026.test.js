// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const {
  MARKET_SNAPSHOT_DATE,
  MARKET_SIGNALS_2026,
  VERTICAL_OPPORTUNITIES,
  IMPLEMENTATION_SEQUENCE,
  opportunityScore,
  get2026MarketIntelligence
} = require("../lib/sonara-2026-market-intelligence.cjs");
const { getSeptember19PatternConvergence } = require("../lib/sonara-september19-pattern-convergence.cjs");

describe("2026 market intelligence control layer", () => {
  it("keeps external research non-executing and date-bounded", () => {
    const snapshot = get2026MarketIntelligence();
    assert.equal(MARKET_SNAPSHOT_DATE, "2026-09-20");
    assert.equal(snapshot.productionExecutionCount, 0);
    assert.equal(snapshot.researchOnly, true);
    assert.ok(MARKET_SIGNALS_2026.length >= 10);
    for (const signal of MARKET_SIGNALS_2026) {
      assert.equal(signal.runtimeAuthority, "none");
      assert.equal(signal.productionCapability, false);
      assert.ok(signal.sourceUrl.startsWith("https://"));
      assert.ok(signal.asOf <= MARKET_SNAPSHOT_DATE);
    }
  });

  it("covers the requested cross-industry operating surfaces", () => {
    const keys = new Set(VERTICAL_OPPORTUNITIES.map((item) => item.key));
    for (const key of [
      "agentic_platform_core",
      "small_business_management",
      "restaurant_pos_kiosk",
      "field_services_trades",
      "fleet_logistics_delivery",
      "retail_store_ecommerce",
      "payments_fintech",
      "creator_social_streaming",
      "media_production",
      "manufacturing_robotics",
      "real_estate_rental",
      "gaming_interactive_spatial",
      "education_translation",
      "security_identity_monitoring",
      "public_sector_integrations"
    ]) {
      assert.equal(keys.has(key), true, `missing vertical ${key}`);
    }
  });

  it("prioritizes shared platform primitives before specialized regulated integrations", () => {
    assert.ok(IMPLEMENTATION_SEQUENCE.length >= 10);
    assert.equal(
      IMPLEMENTATION_SEQUENCE[0],
      "shared_identity_tenant_entitlement_and_approval_contract"
    );
    assert.equal(
      IMPLEMENTATION_SEQUENCE.at(-1),
      "regulated_partner_integrations_only_after_domain_specific_review"
    );
  });

  it("scores opportunities deterministically and penalizes integration/regulatory risk", () => {
    const lowRisk = opportunityScore({
      pain: 0.9,
      platformReuse: 0.9,
      dataAdvantage: 0.8,
      monetization: 0.8,
      adoptionReadiness: 0.8,
      integrationRisk: 0.2,
      regulatoryRisk: 0.1
    });
    const highRisk = opportunityScore({
      pain: 0.9,
      platformReuse: 0.9,
      dataAdvantage: 0.8,
      monetization: 0.8,
      adoptionReadiness: 0.8,
      integrationRisk: 1,
      regulatoryRisk: 1
    });
    assert.equal(lowRisk, 0.813);
    assert.equal(highRisk, 0.6);
    assert.ok(lowRisk > highRisk);
    assert.throws(() => opportunityScore({
      pain: 2,
      platformReuse: 1,
      dataAdvantage: 1,
      monetization: 1,
      adoptionReadiness: 1,
      integrationRisk: 0,
      regulatoryRisk: 0
    }), /between 0 and 1/);
  });

  it("is exposed through the existing platform-pattern convergence API contract", () => {
    const convergence = getSeptember19PatternConvergence();
    assert.equal(convergence.marketSignalCount, MARKET_SIGNALS_2026.length);
    assert.equal(convergence.verticalOpportunityCount, VERTICAL_OPPORTUNITIES.length);
    assert.equal(convergence.marketIntelligence.snapshotDate, MARKET_SNAPSHOT_DATE);
    assert.equal(convergence.marketIntelligence.productionExecutionCount, 0);
  });

  it("returns defensive copies for arrays exposed to callers", () => {
    const first = get2026MarketIntelligence();
    const second = get2026MarketIntelligence();
    first.implementationSequence.pop();
    first.verticalOpportunities[0].coverage.pop();
    assert.equal(second.implementationSequence.length, IMPLEMENTATION_SEQUENCE.length);
    assert.equal(
      second.verticalOpportunities[0].coverage.length,
      VERTICAL_OPPORTUNITIES[0].coverage.length
    );
  });
});
