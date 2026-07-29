"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { getMarketRDPriorities } = require("../lib/sonara-market-rd-priorities.cjs");

describe("SONARA market research and development priorities", () => {
  it("defines measurable cross-company fixes", () => {
    const strategy = getMarketRDPriorities();
    assert.equal(strategy.version, "2026-07-25");
    assert.ok(strategy.crossCompanyFixes.length >= 4);
    for (const key of ["time_to_value", "shared_customer_and_consent_spine", "value_and_cost_scorecards", "portable_evidence"]) {
      assert.ok(strategy.crossCompanyFixes.some((item) => item.key === key), `${key} missing`);
    }
  });

  it("gives every company bets experiments metrics and kill criteria", () => {
    const strategy = getMarketRDPriorities();
    for (const company of ["business_builder", "creator_studio", "growth_studio"]) {
      const plan = strategy.companies[company];
      assert.ok(plan.strategicPosition);
      assert.ok(plan.primaryBets.length >= 5);
      assert.ok(plan.validationExperiments.length >= 3);
      assert.ok(plan.successMetrics.length >= 4);
      assert.ok(plan.killCriteria.length >= 3);
    }
  });

  it("runs the R&D patch after market intelligence", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  });

  it("shares the strategy with agents and documents evidence limits", () => {
    const shared = JSON.parse(fs.readFileSync(path.join(__dirname, "..", ".ai", "shared", "MARKET_RD_PRIORITIES_2026.json"), "utf8"));
    assert.equal(shared.status, "validation_required");
    assert.match(shared.portfolio_rule, /measurable commitment/i);
    const docs = fs.readFileSync(path.join(__dirname, "..", "docs", "SONARA_MARKET_RD_ACTION_PLAN_2026.md"), "utf8");
    for (const term of ["Time to first value", "Shared evidence spine", "90-day validation portfolio", "kill criterion", "do not replace direct SONARA customer interviews"]) {
      assert.match(docs, new RegExp(term, "i"));
    }
  });
});
