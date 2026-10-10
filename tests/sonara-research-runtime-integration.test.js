"use strict";
const assert = require("node:assert/strict");
const { ATLAS, getAtlasCoverage, planTop50Research } = require("../lib/sonara-research-atlas.cjs");
const { planComparableTop50 } = require("../lib/sonara-research-comparable-top50.cjs");
const { reconcileComparableEvidence } = require("../lib/sonara-research-evidence-reconciliation.cjs");
const { assessTop50RankSensitivity } = require("../lib/sonara-research-rank-sensitivity.cjs");
const { planFormulaForAtlas, getFormulaResearchCoverage } = require("../lib/sonara-research-formula-blueprints.cjs");
const { listExecutableFormulas } = require("../lib/sonara-formula-engine.cjs");

const makeRows = (count = 51) => Array.from({ length: count }, (_, index) => ({
  entityId: `operator_${index + 1}`, evidenceId: `source_${index + 1}`,
  value: index + 1, metric: "annual_revenue", unit: "usd",
  period: "2025", geography: "US", observedAt: "2026-10-01"
}));
const comparison = (rows = makeRows()) => ({
  categoryId: "us_restaurants", metric: "annual_revenue", unit: "usd",
  period: "2025", geography: "US", reviewedAt: "2026-10-09",
  observations: rows
});
const receipts = rows => rows.map((row, index) => ({
  entityId: row.entityId, evidenceId: row.evidenceId,
  sourceUrl: `https://example.org/research/record-${index + 1}`,
  stance: "supports", observedAt: "2026-10-01"
}));
const intervals = rows => rows.map(row => ({
  entityId: row.entityId, evidenceId: row.evidenceId,
  lower: row.value, upper: row.value, intervalType: "scenario_bounds"
}));

describe("SONARA real-module Research Atlas integration", () => {
  it("uses the actual 50-category Atlas without calling external sources", () => {
    assert.equal(ATLAS.length, 50);
    assert.equal(getAtlasCoverage().publisherRankingCategories, 4);
    assert.equal(planTop50Research("us_restaurants").reference.role, "context_only");
    assert.equal(getAtlasCoverage().productionAuthorized, false);
  });
  it("returns only provisional ordered candidates for consistent synthetic rows", () => {
    const draft = planComparableTop50(comparison());
    assert.equal(draft.observedCount, 51);
    assert.equal(draft.candidateTop50.length, 50);
    assert.equal(draft.candidateTop50[0].value, 51);
    assert.equal(draft.candidateTop50.at(-1).value, 2);
    assert.equal(draft.sourceVerified, false);
    assert.equal(draft.publicationAuthorized, false);
  });
  it("withholds a candidate list if 50th/51st values tie", () => {
    const rows = makeRows();
    rows[0] = { ...rows[0], value: 2 };
    const draft = planComparableTop50(comparison(rows));
    assert.equal(draft.cutoffTieRequiresReview, true);
    assert.equal(draft.candidateTop50.length, 0);
  });
  it("reconciles matching source metadata but never confers independent truth", () => {
    const rows = makeRows();
    const report = reconcileComparableEvidence({
      comparison: comparison(rows), receipts: receipts(rows)
    });
    assert.equal(report.supportedMeasurements, 51);
    assert.equal(report.unsupportedMeasurements, 0);
    assert.equal(report.evidenceIndependentlyVerified, false);
    assert.equal(report.reviewerIdentityAuthenticated, false);
    assert.equal(report.productionAuthorized, false);
  });
  it("finds missing supporting receipts across the actual evidence audit", () => {
    const rows = makeRows();
    const report = reconcileComparableEvidence({
      comparison: comparison(rows), receipts: receipts(rows).slice(0, 47)
    });
    assert.equal(report.unsupportedMeasurements, 4);
    assert.ok(report.blockers.includes("measurements_missing_supporting_receipts"));
  });
  it("detects contradictory source metadata without issuing publishing approval", () => {
    const rows = makeRows();
    const submitted = receipts(rows);
    submitted.push({ ...submitted[0], stance: "contradicts",
      sourceUrl: "https://second.example.net/independent-record" });
    const report = reconcileComparableEvidence({
      comparison: comparison(rows), receipts: submitted
    });
    assert.equal(report.contradictedMeasurements, 1);
    assert.ok(report.blockers.includes("contradictions_found"));
    assert.equal(report.publicationAuthorized, false);
  });
  it("rejects unsafe receipt URLs in the actual evidence parser", () => {
    const rows = makeRows();
    const submitted = receipts(rows);
    submitted[0] = { ...submitted[0], sourceUrl: "http://localhost/private" };
    const report = reconcileComparableEvidence({
      comparison: comparison(rows), receipts: submitted
    });
    assert.equal(report.malformedOrUnmatchedReceipts, 1);
    assert.equal(report.unsupportedMeasurements, 1);
    assert.equal(report.sourceDatesIndependentlyVerified, false);
  });
  it("computes exact sample-relative ranks without calling them national ranks", () => {
    const rows = makeRows();
    const report = assessTop50RankSensitivity({
      comparison: comparison(rows), intervals: intervals(rows)
    });
    assert.equal(report.withinSampleTop50Count, 50);
    assert.equal(report.outsideSampleTop50Count, 1);
    assert.equal(report.ambiguousBoundaryCount, 0);
    assert.equal(report.sampleRepresentative, false);
    assert.equal(report.rankingVerified, false);
  });
  it("detects sample cutoff ambiguity caused by overlapping scenario intervals", () => {
    const rows = makeRows();
    const supplied = intervals(rows);
    supplied[0] = { ...supplied[0], lower: 0, upper: 2 };
    const report = assessTop50RankSensitivity({
      comparison: comparison(rows), intervals: supplied
    });
    assert.ok(report.ambiguousBoundaryCount >= 2);
    assert.ok(report.blockers.includes("uncertainty_overlaps_top50_cutoff"));
    assert.equal(report.uncertaintyMethodValidated, false);
  });
  it("resolves scientific formula metadata from real handlers without evaluating them", () => {
    const handlers = listExecutableFormulas();
    const catalog = getFormulaResearchCoverage();
    assert.equal(catalog.concepts, 50);
    assert.ok(handlers.length >= 9);
    assert.ok(catalog.existingEngineAssociations >= 9);
    const inventory = planFormulaForAtlas({ conceptId: "eoq", categoryId: "us_restaurants" });
    assert.equal(inventory.canonicalHandler.key, "eoq");
    assert.equal(inventory.evaluatorExecuted, false);
    assert.equal(inventory.customerDecisionAuthorized, false);
  });
  it("keeps regulated financial research outside automatic business decisions", () => {
    const plan = planFormulaForAtlas({ conceptId: "npv", categoryId: "us_hedge_funds" });
    assert.equal(plan.regulatoryReviewRequired, true);
    assert.equal(plan.productionAuthorized, false);
  });
});
