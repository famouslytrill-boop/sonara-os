"use strict";
const assert = require("node:assert/strict");
const { assessMarketFocus } = require("../lib/sonara-market-focus.cjs");
const { getMarketIntelligenceFramework } = require("../lib/sonara-market-intelligence-registry.cjs");
const { evaluateFormula } = require("../lib/sonara-formula-library.cjs");
const express = require("express");
const request = require("supertest");
const now = Date.parse("2026-10-04T18:00:00Z");
function opportunity() {
  return { target_segment: "cleaners", owner_name: "pilot owner", metadata: { focus_evidence: {
    customer_commitment: "paid pilot recorded", source_reference: "internal interview record",
    measured_at: "2026-10-03T18:00:00Z", revenue_cents: 5900, variable_cost_cents: 1200, cost_ceiling_cents: 1500
  } } };
}
describe("Market focus uses evidence rather than an optimistic opportunity score", () => {
  it("keeps empty evidence unknown, even for a high-score opportunity", () => {
    const result = assessMarketFocus({ market_score: 100 }, now);
    assert.equal(result.decision, "validate");
    assert.equal(result.economics, null);
    assert.ok(result.blockers.includes("customer_commitment_required"));
  });
  it("calculates contribution and remains advisory for a complete candidate", () => {
    const input = opportunity();
    const original = JSON.stringify(input);
    const result = assessMarketFocus(input, now);
    assert.equal(result.decision, "pilot_candidate");
    assert.equal(result.economics.contributionCents, 4700);
    assert.equal(result.economics.contributionMarginPercent, 79.66);
    assert.equal(result.evidenceVerified, false);
    assert.equal(JSON.stringify(input), original);
  });
  it("refuses stale, future and undated evidence", () => {
    for (const date of ["2026-08-01T18:00:00Z", "2026-10-05T18:00:00Z", "2026-10-03", "invalid"]) {
      const input = opportunity(); input.metadata.focus_evidence.measured_at = date;
      assert.ok(assessMarketFocus(input, now).blockers.includes("fresh_dated_evidence_required"));
    }
  });
  it("does not coerce missing, string, negative or nonfinite costs into zero", () => {
    for (const value of [undefined, null, "0", -1, NaN, Infinity, 1.5]) {
      const input = opportunity(); input.metadata.focus_evidence.variable_cost_cents = value;
      assert.equal(assessMarketFocus(input, now).economics, null);
    }
  });
  it("refuses losses and spending above the recorded ceiling", () => {
    const input = opportunity(); input.metadata.focus_evidence.variable_cost_cents = 6000;
    const result = assessMarketFocus(input, now);
    assert.ok(result.blockers.includes("positive_contribution_required"));
    assert.ok(result.blockers.includes("cost_ceiling_exceeded"));
  });
  it("exposes the focus through the existing authenticated framework", () => {
    const focus = getMarketIntelligenceFramework().researchAndDevelopment.marketFocus;
    assert.equal(focus.status, "validation_required");
    assert.equal(Object.keys(focus.companies).length, 3);
  });
});

describe("Expanded deterministic calculations", () => {
  const examples = [
    ["expected_loss", { event_probability: 0.2, loss_amount: 500 }, 100],
    ["smoothed_demand_level", { alpha: 0.25, observed_demand: 140, previous_level: 100 }, 110],
    ["service_capacity_jobs", { available_minutes: 480, minutes_per_job: 90 }, 5],
    ["media_duration_seconds", { frame_count: 300, frames_per_second: 30 }, 10],
    ["media_payload_mebibytes", { bitrate_bits_per_second: 8388608, duration_seconds: 60 }, 60],
    ["tracked_motion_speed", { displacement_meters: 12, elapsed_seconds: 3 }, 4]
  ];
  for (const [key, values, expected] of examples) {
    it(`computes ${key} from a hand-calculated example through the real endpoint`, async () => {
      const app = express(); app.use(express.json());
      require("../routes/sonara-formula-routes.cjs")(app);
      const response = await request(app).post("/api/formulas/evaluate").send({ formulaKey: key, inputValues: values });
      assert.equal(response.status, 200);
      assert.equal(response.body.resultValue, expected);
    });
  }
  it("rejects impossible probabilities, fractional frames and zero elapsed time", () => {
    assert.equal(evaluateFormula("expected_loss", { event_probability: 2, loss_amount: 100 }).code, "invalid_input");
    assert.equal(evaluateFormula("media_duration_seconds", { frame_count: 1.5, frames_per_second: 30 }).code, "invalid_input");
    assert.equal(evaluateFormula("tracked_motion_speed", { displacement_meters: 10, elapsed_seconds: 0 }).code, "invalid_input");
    assert.equal(evaluateFormula("service_capacity_jobs", { available_minutes: true, minutes_per_job: 5 }).code, "invalid_input");
  });
  it("does not invent a loss amount or smoothing observation", () => {
    assert.equal(evaluateFormula("expected_loss", { event_probability: 0.2 }).code, "missing_inputs");
    assert.equal(evaluateFormula("smoothed_demand_level", { alpha: 0.2, previous_level: 4 }).code, "missing_inputs");
  });
});
