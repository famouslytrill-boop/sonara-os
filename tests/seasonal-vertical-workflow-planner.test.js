// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { gunzipSync } = require("node:zlib");
const { createHash } = require("node:crypto");
const {
  VERTICALS, VERTICAL_KEYS, SEASONS, MAX_EVENTS,
  getVerticalPlaybook, planSeasonalCapacity, calculateJobQuote,
  summarizeOperationalEvents, compressOperationalSummary
} = require("../lib/sonara-seasonal-vertical-playbooks.cjs");

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
function event(overrides = {}) {
  return {
    organizationId: ORG_A, eventId: "evt_1", recordId: "work_1",
    status: "delivered", revision: 2, ...overrides
  };
}

describe("seasonal vertical planning boundary", () => {
  it("covers all requested operations without implying they are live", () => {
    assert.equal(VERTICALS.length, 16);
    assert.equal(new Set(VERTICAL_KEYS).size, VERTICALS.length);
    for (const definition of VERTICALS) {
      for (const season of definition.seasons) assert.ok(SEASONS.includes(season));
      const plan = getVerticalPlaybook(definition.key);
      assert.equal(plan.runtimeExecution, false);
      assert.equal(plan.activeProviderIntegrations, false);
      assert.ok(plan.operations.length);
      assert.ok(plan.requiresExplicitHumanReview.length);
    }
  });

  it("separates seasonal and year-round work", () => {
    assert.equal(getVerticalPlaybook("winter_services", "winter").seasonFit, true);
    assert.equal(getVerticalPlaybook("winter_services", "summer").seasonFit, false);
    assert.equal(getVerticalPlaybook("bars", "summer").seasonFit, true);
    assert.throws(() => getVerticalPlaybook("unknown"), /unknown_vertical/);
    assert.throws(() => getVerticalPlaybook("bars", "monsoon"), /unknown_season/);
  });

  it("does not silently perform a regulated sale or worker classification", () => {
    assert.ok(getVerticalPlaybook("bars").requiresExplicitHumanReview.includes("regulated_sale"));
    assert.ok(getVerticalPlaybook("food_trucks").requiresExplicitHumanReview.includes("food_safety"));
    assert.ok(getVerticalPlaybook("independent_contractors").requiresExplicitHumanReview.includes("worker_classification"));
    assert.ok(getVerticalPlaybook("tow_trucks").requiresExplicitHumanReview.includes("autonomous_dispatch"));
  });

  it("calculates crew capacity and an explicit seasonal scenario exactly", () => {
    const result = planSeasonalCapacity({
      baselineJobs: 100, seasonFactorBasisPoints: 15000,
      workers: 2, minutesPerWorker: 480, minutesPerJob: 45,
      reserveBasisPoints: 1000
    });
    assert.equal(result.scenarioJobs, 150);
    assert.equal(result.usableCrewMinutes, 864);
    assert.equal(result.feasibleJobs, 19);
    assert.equal(result.unservedJobs, 131);
    assert.equal(result.weatherDataConnected, false);
    assert.equal(result.classification, "user_supplied_capacity_scenario_not_prediction");
  });

  it("assumes no seasonal uplift without owner-provided evidence", () => {
    const plan = planSeasonalCapacity({
      baselineJobs: 3, workers: 0, minutesPerWorker: 480, minutesPerJob: 30
    });
    assert.equal(plan.seasonFactorBasisPoints, 10000);
    assert.equal(plan.scenarioJobs, 3);
    assert.equal(plan.unservedJobs, 3);
  });

  it("rejects impossible, fractional, negative and unbounded resources", () => {
    const base = { baselineJobs: 2, workers: 1, minutesPerWorker: 480, minutesPerJob: 30 };
    assert.throws(() => planSeasonalCapacity({ ...base, minutesPerJob: 0 }), /invalid_zero_minutes/);
    assert.throws(() => planSeasonalCapacity({ ...base, workers: 1.5 }), /invalid_workers/);
    assert.throws(() => planSeasonalCapacity({ ...base, reserveBasisPoints: 10000 }), /invalid_reserve_basis_points/);
    assert.throws(() => planSeasonalCapacity({ ...base, seasonFactorBasisPoints: NaN }), /invalid_season_factor_basis_points/);
    assert.throws(() => planSeasonalCapacity({ ...base, minutesPerWorker: 2000 }), /invalid_minutes_per_worker/);
  });

  it("computes precise revenue, variable cost and contribution without payment execution", () => {
    const quote = calculateJobQuote({
      lineItems: [
        { quantity: 2, unitPriceCents: 12500, unitCostCents: 8500 },
        { quantity: 1, unitPriceCents: 5000, unitCostCents: 2500 }
      ],
      deliveryFeeCents: 2500, deliveryCostCents: 1000
    });
    assert.equal(quote.revenueCents, 32500);
    assert.equal(quote.variableCostCents, 20500);
    assert.equal(quote.contributionCents, 12000);
    assert.equal(quote.contributionMarginBasisPoints, 3692);
    assert.equal(quote.customerActionExecuted, false);
    assert.ok(quote.excluded.includes("taxes"));
  });

  it("reports losses, zero revenue and overflows without losing cents", () => {
    const negative = calculateJobQuote({
      lineItems: [{ quantity: 1, unitPriceCents: 100, unitCostCents: 125 }]
    });
    assert.equal(negative.contributionCents, -25);
    assert.equal(negative.contributionMarginBasisPoints, -2500);
    assert.equal(calculateJobQuote({ lineItems: [{ quantity: 1, unitPriceCents: 0, unitCostCents: 0 }] }).contributionMarginBasisPoints, null);
    assert.throws(() => calculateJobQuote({ lineItems: [] }), /invalid_line_items/);
    assert.throws(() => calculateJobQuote({
      lineItems: [{ quantity: 2, unitPriceCents: -1, unitCostCents: 0 }]
    }), /invalid_unit_price_cents/);
    assert.throws(() => calculateJobQuote({
      lineItems: Array.from({ length: 10 }, () => ({ quantity: 10000, unitPriceCents: 100000000000, unitCostCents: 0 }))
    }), /scenario_overflow/);
  });

  it("counts only exact repeated events and redacts customer payload fields", () => {
    const input = event({ customerEmail: "private@example.com", deliveryAddress: "private street" });
    const summary = summarizeOperationalEvents({
      organizationId: ORG_A,
      events: [input, { ...input }, event({ eventId: "evt_2", status: "invoiced" })]
    });
    assert.equal(summary.totalReceived, 3);
    assert.equal(summary.uniqueEvents, 2);
    assert.equal(summary.exactDuplicates, 1);
    assert.equal(summary.statusCounts.delivered, 1);
    assert.equal(summary.statusCounts.invoiced, 1);
    assert.equal(summary.containsRawCustomerData, false);
    const packed = compressOperationalSummary(summary);
    assert.equal(packed.format, "gzip+base64");
    assert.equal(packed.encrypted, false);
    const raw = gunzipSync(Buffer.from(packed.data, "base64"));
    assert.equal(packed.originalBytes, raw.length);
    assert.equal(packed.sha256, createHash("sha256").update(raw).digest("hex"));
    assert.equal(packed.sha256.length, 64);
    assert.notEqual(packed.sha256, createHash("sha256").update(Buffer.from(raw.toString("utf8") + " ")).digest("hex"));
    const original = JSON.parse(raw.toString("utf8"));
    assert.equal(original.uniqueEvents, 2);
    assert.equal(original.version, 1);
    assert.ok(!JSON.stringify(original).includes("private@example.com"));
    assert.ok(!JSON.stringify(summary).includes("private@example.com"));
    assert.ok(!JSON.stringify(summary).includes("private street"));
  });

  it("fails closed on mixed organizations and conflicting event identities", () => {
    assert.throws(() => summarizeOperationalEvents({
      organizationId: ORG_A, events: [event(), event({ organizationId: ORG_B, eventId: "evt_3" })]
    }), /organization_mismatch/);
    assert.throws(() => summarizeOperationalEvents({
      organizationId: ORG_A, events: [event(), event({ status: "cancelled" })]
    }), /conflicting_event_identity/);
    assert.throws(() => summarizeOperationalEvents({
      organizationId: "not-a-uuid", events: []
    }), /invalid_organization/);
    assert.throws(() => compressOperationalSummary({
      organizationId: ORG_A, customerEmail: "private@example.com"
    }), /unvalidated_operational_summary/);
  });

  it("bounds event batch sizes and disallows arbitrary status/revision values", () => {
    assert.throws(() => summarizeOperationalEvents({
      organizationId: ORG_A, events: Array.from({ length: MAX_EVENTS + 1 }, () => event())
    }), /invalid_event_batch/);
    assert.throws(() => summarizeOperationalEvents({
      organizationId: ORG_A, events: [event({ status: "__proto__" })]
    }), /invalid_event_fields/);
    assert.throws(() => summarizeOperationalEvents({
      organizationId: ORG_A, events: [event({ revision: 1.25 })]
    }), /invalid_event_fields/);
    assert.throws(() => summarizeOperationalEvents({
      organizationId: ORG_A, events: [event({ eventId: "bad/id" })]
    }), /invalid_event_fields/);
  });
});
