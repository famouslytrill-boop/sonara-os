"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");

const {
  SCREENSHOT_TOOL_RADAR_BATCH17,
  NON_REPOSITORY_REFERENCES_BATCH17,
  CONFIRMED_EXISTING_RECORDS_BATCH17,
  ARCHITECTURE_EXTENSIONS_BATCH17,
  getScreenshotToolReadinessBatch17
} = require("../lib/sonara-screenshot-tool-radar-batch17.cjs");

const {
  SCREENSHOT_DERIVED_STRATEGIES,
  getScreenshotDerivedStrategies
} = require("../lib/sonara-screenshot-derived-strategies.cjs");

const finance = require("../lib/sonara-financial-intelligence-formulas.cjs");

describe("Batch 17 screenshot, design, finance and strategy convergence", () => {
  it("records verified repositories as disabled, human-reviewed research", () => {
    const readiness = getScreenshotToolReadinessBatch17();
    assert.equal(readiness.batch, 17);
    assert.equal(readiness.repositoryCount, 22);
    assert.equal(readiness.verifiedCount, 22);
    assert.equal(readiness.nonRepositoryReferenceCount, 16);
    assert.equal(readiness.confirmedExistingRecordCount, 6);
    assert.equal(readiness.architectureExtensionCount, 7);
    assert.equal(readiness.productionExecutionCount, 0);

    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH17.every((item) => item.repositoryVerified === true));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH17.every((item) => item.enabledInProduction === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH17.every((item) => item.canExecute === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH17.every((item) => item.humanReviewRequired === true));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH17.every((item) => item.safety.length > 0));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH17.every((item) => item.nextStep));
  });

  it("keeps noncommercial and reciprocal-license sources behind explicit boundaries", () => {
    const autoskills = SCREENSHOT_TOOL_RADAR_BATCH17.find((item) => item.key === "autoskills");
    assert.equal(autoskills.license, "CC BY-NC 4.0");
    assert.equal(autoskills.integrationStatus, "blocked_commercial_source");
    assert.match(autoskills.blockedUses.join(" "), /commercial SONARA/i);

    const oneterm = SCREENSHOT_TOOL_RADAR_BATCH17.find((item) => item.key === "oneterm");
    assert.equal(oneterm.license, "AGPL-3.0");
    assert.equal(oneterm.reciprocalLicense, true);

    const windrecorder = SCREENSHOT_TOOL_RADAR_BATCH17.find((item) => item.key === "windrecorder");
    assert.equal(windrecorder.license, "GPL-2.0");
    assert.equal(windrecorder.reciprocalLicense, true);
  });

  it("records the AI CFO licence evidence limitation instead of inventing a LICENSE file", () => {
    const cfo = SCREENSHOT_TOOL_RADAR_BATCH17.find((item) => item.key === "ai_cfo_agent");
    assert.match(cfo.license, /README declaration/i);
    assert.match(cfo.license, /no root LICENSE/i);
    assert.match(cfo.blockedUses.join(" "), /autonomous financial transactions/i);
  });

  it("preserves ambiguous visual leads without fabricating repositories or licences", () => {
    const unresolved = NON_REPOSITORY_REFERENCES_BATCH17.filter((item) =>
      /unresolved/.test(item.status || "")
    );
    assert.ok(unresolved.length >= 7);
    assert.ok(unresolved.every((item) => !Object.hasOwn(item, "repository")));
    assert.ok(unresolved.every((item) => !Object.hasOwn(item, "license")));
  });

  it("confirms prior Jev, Munder Difflin, LiveCharts2, Phi, Wechaty and Clash records without duplication", () => {
    assert.deepEqual(
      CONFIRMED_EXISTING_RECORDS_BATCH17.map((item) => item.key),
      [
        "jev_ultrafast_existing_batch16",
        "munder_difflin_existing_batch16",
        "livecharts2_existing_batch16",
        "phi_cookbook_existing_batch2",
        "wechaty_existing_batch7",
        "clash_verge_existing_batch6"
      ]
    );
  });

  it("publishes seven bounded architecture extensions", () => {
    assert.equal(ARCHITECTURE_EXTENSIONS_BATCH17.length, 7);
    assert.ok(ARCHITECTURE_EXTENSIONS_BATCH17.some((item) => item.key === "typed_fast_decision_lane"));
    assert.ok(ARCHITECTURE_EXTENSIONS_BATCH17.some((item) => item.key === "curated_skill_supply_chain"));
    assert.ok(ARCHITECTURE_EXTENSIONS_BATCH17.some((item) => item.key === "financial_truth_before_narrative"));
    assert.ok(ARCHITECTURE_EXTENSIONS_BATCH17.some((item) => item.key === "automation_recovery_contract"));
  });

  it("exposes every Batch 17 repository through the existing public research catalog", async () => {
    const response = await request(app)
      .get("/api/ecosystem/requested-repositories")
      .set("Accept", "application/json");

    assert.equal(response.status, 200);
    const keys = new Set(response.body.repositories.map((item) => item.key));
    for (const item of SCREENSHOT_TOOL_RADAR_BATCH17) {
      assert.ok(keys.has(item.key), `missing Batch 17 repository from public catalog: ${item.key}`);
    }
    assert.ok(response.body.nonRepositoryReferences.some((item) => item.key === "studio_grade_structure_prompt"));
  });

  it("keeps screenshot-derived strategies non-authorizing and exposes them through the agent catalog", async () => {
    const catalog = getScreenshotDerivedStrategies();
    assert.equal(catalog.strategyCount, 8);
    assert.equal(SCREENSHOT_DERIVED_STRATEGIES.length, 8);
    assert.ok(SCREENSHOT_DERIVED_STRATEGIES.every((item) => item.canExecuteFromRecord === false));
    assert.ok(SCREENSHOT_DERIVED_STRATEGIES.every((item) => item.humanReviewRequired === true));

    const response = await request(app)
      .get("/api/ecosystem/agent-skill-strategies")
      .set("Accept", "application/json");
    assert.equal(response.status, 200);
    assert.equal(response.body.screenshotDerivedStrategies.strategyCount, 8);
    assert.ok(response.body.screenshotDerivedStrategies.strategies.some((item) => item.key === "versioned_memory"));
  });

  it("computes transparent finance primitives and explicit non-finite runway state", () => {
    assert.equal(finance.netCashFlow({ cashInflows: 125000, cashOutflows: 100000 }), 25000);
    assert.equal(finance.monthlyNetBurn({ cashInflows: 80000, cashOutflows: 100000 }), 20000);
    assert.deepEqual(finance.runwayMonths({ cashBalance: 120000, monthlyBurn: 20000 }), {
      value: 6,
      state: "finite_runway"
    });
    assert.deepEqual(finance.runwayMonths({ cashBalance: 120000, monthlyBurn: 0 }), {
      value: null,
      state: "not_currently_burning_cash"
    });
    assert.equal(finance.grossMarginPercent({ revenue: 100000, costOfGoodsSold: 40000 }), 60);
    assert.equal(finance.periodGrowthPercent({ current: 125000, previous: 100000 }), 25);
    assert.equal(finance.customerAcquisitionCost({ acquisitionSpend: 10000, newCustomers: 100 }), 100);
    assert.equal(finance.simpleLtv({
      averageRevenuePerCustomer: 100,
      grossMarginPercentValue: 80,
      churnRatePercent: 5
    }), 1600);
    assert.equal(finance.burnMultiple({ netBurn: 50000, netNewAnnualRecurringRevenue: 100000 }), 0.5);
    assert.equal(finance.revenueConcentrationPercent({ topCustomerRevenue: 25000, totalRevenue: 100000 }), 25);
  });

  it("models scenarios deterministically and refuses to call unreconciled data decision-ready", () => {
    const scenario = finance.scenarioRunway({
      cashBalance: 120000,
      baselineMonthlyInflows: 80000,
      baselineMonthlyOutflows: 100000,
      inflowChangePercent: 10,
      outflowChangePercent: -10
    });
    assert.equal(scenario.scenarioMonthlyInflows, 88000);
    assert.equal(scenario.scenarioMonthlyOutflows, 90000);
    assert.equal(scenario.scenarioMonthlyBurn, 2000);
    assert.deepEqual(scenario.runway, { value: 60, state: "finite_runway" });

    const weak = finance.dataQualityFlags({
      reconciled: false,
      periodAligned: true,
      currencyAligned: true,
      sourceRows: 20
    });
    assert.equal(weak.readyForDecisionSupport, false);
    assert.deepEqual(weak.flags, ["not_reconciled"]);

    const strong = finance.dataQualityFlags({
      reconciled: true,
      periodAligned: true,
      currencyAligned: true,
      sourceRows: 20
    });
    assert.equal(strong.readyForDecisionSupport, true);
    assert.deepEqual(strong.flags, []);

    assert.throws(
      () => finance.monthlyNetBurn({ cashInflows: -1, cashOutflows: 10 }),
      /cashInflows must be >= 0/
    );
  });

  it("adds a first-party DESIGN.md and premium UI review skill grounded in canonical authority", () => {
    const root = path.join(__dirname, "..");
    const design = fs.readFileSync(path.join(root, "DESIGN.md"), "utf8");
    const skill = fs.readFileSync(path.join(root, ".claude/skills/reviewing-premium-sonara-ui/SKILL.md"), "utf8");

    assert.match(design, /public\/sonara-design-system\.css/);
    assert.match(design, /reduced-motion/i);
    assert.match(design, /state clarity/i);
    assert.match(design, /External design-source rule/i);
    assert.match(skill, /DESIGN\.md/);
    assert.match(skill, /Do not output a subjective beauty score/i);
    assert.match(skill, /accessibility and performance/i);
  });
});
