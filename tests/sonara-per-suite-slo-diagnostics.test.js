"use strict";
const assert = require("node:assert/strict");
const { evaluateSuiteSloBurn, SUITES } =
  require("../lib/sonara-per-suite-slo-diagnostics.cjs");
const NOW = 1800000000000;
const observations = (suite, count, durationMs, failures = 0) =>
  Array.from({ length: count }, (_, index) => ({
    suite, timestampMs: NOW - Math.floor(index / count * durationMs),
    ok: index >= failures
  }));
describe("SONARA per-product SLO isolation", () => {
  it("isolates sustained Business Builder burn from healthy Creator Studio", () => {
    const all = [
      ...observations("business_builder", 1000, 3600000, 100),
      ...observations("creator_studio", 1000, 3600000, 0)
    ];
    const result = evaluateSuiteSloBurn(all, {nowMs:NOW});
    assert.equal(result.status, "measured");
    assert.equal(result.alert, true);
    assert.equal(result.products.find(p => p.suite === "business_builder").alert, true);
    assert.equal(result.products.find(p => p.suite === "creator_studio").alert, false);
    assert.equal(result.products.find(p => p.suite === "growth_studio").status, "insufficient_evidence");
  });
  it("suppresses short bursts with missing long-window evidence on one product", () => {
    const result = evaluateSuiteSloBurn(
      observations("growth_studio", 1000, 5 * 60000, 100), {nowMs:NOW});
    const growth = result.products.find(p => p.suite === "growth_studio");
    assert.equal(growth.alert, false);
    assert.equal(growth.reason, "insufficient_long_window_coverage");
    assert.equal(result.alert, false);
  });
  it("does not include customer identifiers or per-tenant dimensions", () => {
    const result = evaluateSuiteSloBurn(
      [{suite:"sonara_one",ok:false,timestampMs:NOW,
        tenantId:"customer-abc",route:"/api/org/customer-abc?token=secret"}],
      {nowMs:NOW});
    assert.equal(JSON.stringify(result).includes("customer-abc"),false);
    assert.equal(JSON.stringify(result).includes("secret"),false);
    assert.equal(result.products.length,4);
  });
  it("rejects spoofed suites rather than making a new cardinality dimension", () => {
    const result = evaluateSuiteSloBurn(
      [{suite:"tenant-123",ok:false,timestampMs:NOW}],{nowMs:NOW});
    assert.equal(result.status,"invalid_evidence");
    assert.equal(result.alert,false);
  });
  it("rejects invalid options, timestamp types and unbounded samples", () => {
    assert.equal(evaluateSuiteSloBurn([], {nowMs:NOW,minLongBuckets:13}).status,"invalid_evidence");
    assert.equal(evaluateSuiteSloBurn([{suite:"growth_studio",ok:false,timestampMs:"now"}],{nowMs:NOW}).status,"invalid_evidence");
    assert.equal(evaluateSuiteSloBurn([], {nowMs:-1}).status,"invalid_evidence");
  });
  it("stays alert-only and emits the four declared suites in fixed order", () => {
    const result=evaluateSuiteSloBurn([], {nowMs:NOW});
    assert.deepEqual(result.products.map(p=>p.suite),SUITES);
    assert.equal(result.permittedAction,"alert_only");
    assert.equal(result.alert,false);
  });
});
