// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const { planRestaurantCreatorGrowthScenario: plan } = require("../lib/sonara-restaurant-creator-growth-planner.cjs");

const example = () => ({
  restaurant: { menuPriceCents: 2000, variableCostCents: 800, offerDiscountCents: 200,
    dailyCapacityOrders: 100, committedDailyOrders: 70, campaignDays: 5 },
  creator: { sourceVideoSeconds: 120, targetClipSeconds: 20, plannedPosts: 4 },
  growth: { forecastQualifiedVisits: 1000, campaignBudgetCents: 10000,
    historicalQualifiedVisits: 200, historicalAttributedOrders: 20 }
});

describe("cross-product restaurant / Creator / Growth / networking scenario planner", () => {
  it("calculates bounded sales capacity, contribution and media candidate counts", () => {
    const r = plan(example());
    assert.equal(r.ok, true);
    assert.equal(r.results.unitContributionCents, 1000);
    assert.equal(r.results.availableIncrementalOrders, 150);
    assert.equal(r.results.observedConversionRate, 0.1);
    assert.equal(r.results.estimatedDemandOrders, 100);
    assert.equal(r.results.projectedIncrementalOrders, 100);
    assert.equal(r.results.estimatedNetContributionCents, 90000);
    assert.equal(r.results.breakEvenOrders, 10);
    assert.equal(r.results.plannedClipCandidates, 4);
    assert.deepEqual(r.stages.map(x => x.product), ["business_builder", "creator_studio", "growth_studio", "sonara_industries"]);
    assert.equal(r.sideEffectsExecuted, false);
    assert.equal(r.automatedPublishingAllowed, false);
    assert.equal(r.ownerApprovalStillRequired, true);
  });
  it("caps demand at spare capacity and rejects overbooked baselines", () => {
    const x = example(); x.restaurant.dailyCapacityOrders = 75;
    assert.equal(plan(x).results.projectedIncrementalOrders, 25);
    x.restaurant.committedDailyOrders = 76;
    assert.equal(plan(x).field, "restaurant.committedDailyOrders");
  });
  it("treats missing or insufficient attribution as unknown, not zero performance", () => {
    const x = example();
    delete x.growth.historicalQualifiedVisits;
    delete x.growth.historicalAttributedOrders;
    const r = plan(x);
    assert.equal(r.ok, true);
    assert.equal(r.results.observedConversionRate, null);
    assert.equal(r.results.projectedIncrementalOrders, null);
    assert.equal(r.results.estimatedNetContributionCents, null);
    assert.ok(r.issues.includes("attribution_history_insufficient"));
    x.growth.historicalQualifiedVisits = 29;
    x.growth.historicalAttributedOrders = 2;
    assert.equal(plan(x).results.projectedIncrementalOrders, null);
    x.growth.historicalAttributedOrders = 30;
    assert.equal(plan(x).ok, false);
    x.growth.historicalQualifiedVisits = null;
    assert.equal(plan(x).code, "incomplete_history");
  });
  it("signals uneconomic offers, impossible break-even and raw-media shortages", () => {
    const x = example();
    x.restaurant.variableCostCents = 2500;
    x.creator.plannedPosts = 12;
    const r = plan(x);
    assert.equal(r.results.breakEvenOrders, null);
    assert.ok(r.issues.includes("offer_has_nonpositive_unit_contribution"));
    assert.ok(r.issues.includes("insufficient_raw_media_for_requested_clips"));
    const y = example();
    y.growth.campaignBudgetCents = 200000;
    assert.ok(plan(y).issues.includes("break_even_exceeds_spare_capacity"));
  });
  it("rejects malformed values and never trusts coerced strings or huge numbers", () => {
    for (const bad of [NaN, Infinity, -1, "2000", 1.5, Number.MAX_SAFE_INTEGER]) {
      const x = example(); x.restaurant.menuPriceCents = bad;
      assert.equal(plan(x).code, "invalid_scenario_input");
    }
    assert.equal(plan(null).ok, false);
    assert.equal(plan({ restaurant: {}, creator: {}, growth: {} }).ok, false);
    const x = example(); x.growth.historicalAttributedOrders = 201;
    assert.equal(plan(x).field, "growth.historicalAttributedOrders");
  });
  it("is deterministic, immutable and never echoes arbitrary private customer data", () => {
    const x = example();
    x.restaurant.customerEmail = "secret@example.invalid";
    x.growth.providerAccessToken = "private-token";
    const first = plan(x); const second = plan(x);
    assert.deepEqual(first, second);
    assert.ok(Object.isFrozen(first.results));
    assert.ok(Object.isFrozen(first.stages[0]));
    assert.equal(JSON.stringify(first).includes("secret@example.invalid"), false);
    assert.equal(JSON.stringify(first).includes("private-token"), false);
    assert.equal(first.requiredIndependentEvidence.length, 6);
  });
});
