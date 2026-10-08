"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const NOW = 1800000000000;
const CLI = path.resolve(__dirname, "../scripts/diagnose-suite-slo-evidence.mjs");
const AS_OF = new Date(NOW).toISOString();
function record(i, durationMs, status = 200) {
  return {
    event: "http.request",
    ts: new Date(NOW - durationMs).toISOString(),
    correlation: "00000000-0000-4000-8000-" + String(i).padStart(12, "0"),
    outcome: status >= 500 ? "failed" : status >= 400 ? "refused" : "ok",
    reason: status >= 500 ? "5xx" : status >= 400 ? "4xx" :
      status >= 300 ? "3xx" : "2xx",
    detail: {
      method: "GET", route: "/api/business-builder/work-orders/:id",
      product: "business_builder", journey: "field_operations",
      status, duration_ms: 1.5, recovery_posture: "diagnostics_only"
    },
    organization: "tenant-SECRET", authorization: "Bearer-SENSITIVE"
  };
}
function run(lines, args = ["--as-of", AS_OF]) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-suite-slo-"));
  try {
    const file = path.join(temp, "observations.jsonl");
    fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
    return spawnSync(process.execPath, [CLI, "--input", file, ...args], {
      encoding: "utf8", timeout: 8000
    });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
describe("SONARA offline suite SLO CLI end-to-end (no network or live ops)",()=>{
  it("parses complete server-log copies without emitting tenant data or operational alerts",()=>{
    const log = Array.from({length: 1000}, (_,i)=>JSON.stringify(
      record(i,Math.floor(i/1000*3600000),i<100?503:200)));
    const result=run(log);
    assert.equal(result.status,0,result.stderr);
    const parsed=JSON.parse(result.stdout);
    assert.equal(parsed.operationalAlert,false);
    assert.equal(parsed.authoritativeCollectorContinuity,false);
    assert.equal(parsed.products.find(x=>x.suite==="business_builder").candidateAlertFromUnverifiedEvidence,true);
    assert.doesNotMatch(result.stdout,/tenant-SECRET|Bearer-SENSITIVE/);
    assert.equal(parsed.totalLines,1000);
  });
  it("does not convert a five-minute burst to a sustained-hour candidate",()=>{
    const log=Array.from({length:1000},(_,i)=>JSON.stringify(
      record(i,Math.floor(i/1000*300000),i<100?503:200)));
    const result=run(log);
    assert.equal(result.status,0,result.stderr);
    const parsed=JSON.parse(result.stdout);
    assert.equal(parsed.products.find(x=>x.suite==="business_builder").candidateAlertFromUnverifiedEvidence,false);
    assert.equal(parsed.products.find(x=>x.suite==="business_builder").reason,"insufficient_long_window_coverage");
  });
  it("fails closed on malformed JSON without printing the sensitive input",()=>{
    const result=run([JSON.stringify(record(1,1000)), "invalid-json token=SECRET"]);
    assert.equal(result.status,1,result.stderr);
    const parsed=JSON.parse(result.stdout);
    assert.equal(parsed.completeParsing,false);
    assert.equal(parsed.counts.invalid,1);
    assert.doesNotMatch(result.stdout,/invalid-json|token=SECRET/);
  });
  it("rejects a malformed evaluation clock before opening the input file",()=>{
    const result=run([JSON.stringify(record(1,1000))],["--as-of","broken-clock"]);
    assert.equal(result.status,2);
    assert.equal(result.stdout,"");
    assert.match(result.stderr,/Usage:/);
  });
});
