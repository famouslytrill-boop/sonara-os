"use strict";
const assert = require("node:assert/strict");
const { evaluateSloBurn } = require("../lib/sonara-slo-burn-control.cjs");
const NOW = 1800000000000;
function samples(count, durationMs, failing = 0) {
  return Array.from({ length: count }, (_, i) => ({
    timestampMs: NOW - Math.floor((i / count) * durationMs), ok: i >= failing
  }));
}
describe("SLO multiwindow fault recognition", () => {
  it("does not alert on a tiny sample or missing evidence", () => {
    assert.equal(evaluateSloBurn(samples(5, 60_000, 5), { nowMs: NOW }).status, "insufficient_evidence");
    assert.equal(evaluateSloBurn([], { nowMs: NOW }).alert, false);
  });
  it("pages candidates only for verified high burn on both windows", () => {
    const r = evaluateSloBurn(samples(1000, 60 * 60_000, 100), { nowMs: NOW });
    assert.equal(r.status, "page_candidate");
    assert.equal(r.reason, "slo_fast_burn");
    assert.equal(r.permittedAction, "alert_only");
  });
  it("does not misreport a five-minute incident burst as one hour of observed burn", () => {
    const r=evaluateSloBurn(samples(1000,5*60_000,100), {nowMs:NOW});
    assert.equal(r.alert,false);
    assert.equal(r.status,"insufficient_evidence");
    assert.equal(r.reason,"insufficient_long_window_coverage");
    assert.equal(r.windows[0].countSufficient,true);
    assert.equal(r.windows[0].coverageSufficient,false);
  });
  it("denies two isolated bursts that span the hour but leave a large telemetry gap", () => {
    const newest=samples(100,60_000,100);
    const oldest=samples(100,60_000,100).map(x=>({...x,timestampMs:x.timestampMs-3540000}));
    const r=evaluateSloBurn([...newest,...oldest],{nowMs:NOW});
    assert.equal(r.alert,false);
    assert.equal(r.reason,"insufficient_long_window_coverage");
    assert.equal(r.windows[0].long.coveredBuckets<6,true);
  });
  it("fails closed on impossible long-window coverage thresholds",()=>{
    assert.equal(evaluateSloBurn(samples(100,3600000,100),{
      nowMs:NOW,minLongCoverageRatio:2}).status,"invalid_evidence");
    assert.equal(evaluateSloBurn(samples(100,3600000,100),{
      nowMs:NOW,minLongBuckets:13}).status,"invalid_evidence");
  });
  it("does not page on healthy high-throughput traffic", () => {
    assert.equal(evaluateSloBurn(samples(1000, 60_000, 0), { nowMs: NOW }).alert, false);
  });
  it("rejects future forged timestamps and impossible outcomes", () => {
    assert.equal(evaluateSloBurn([{ timestampMs: NOW + 100000, ok: true }], {nowMs:NOW}).status, "invalid_evidence");
    assert.equal(evaluateSloBurn([{ timestampMs: NOW, ok: 1 }], {nowMs:NOW}).status, "invalid_evidence");
  });
  it("a stale incident outside the six hour window has no alert authority", () => {
    assert.equal(evaluateSloBurn(samples(500, 60_000, 500).map(x => ({...x,timestampMs:x.timestampMs - 7 * 60 * 60_000})), { nowMs: NOW }).alert, false);
  });
});
