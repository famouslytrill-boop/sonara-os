"use strict";
const assert = require("node:assert/strict");
const { createOfflineSuiteSloAccumulator, MAX_OBSERVATIONS } =
  require("../lib/sonara-offline-slo-evidence.cjs");
const NOW = 1800000000000;
function req(i, t = NOW, status = 200, path = "/api/business-builder/work-orders/:id") {
  const product = path.startsWith("/api/creator/") ? "creator_studio" : "business_builder";
  const journey = product === "creator_studio" ? "creator_generation" : "field_operations";
  return {
    event:"http.request",ts:new Date(t).toISOString(),
    correlation:"00000000-0000-4000-8000-"+String(i).padStart(12,"0"),
    outcome:status>=500?"failed":status>=400?"refused":"ok",
    reason:status>=500?"5xx":status>=400?"4xx":status>=300?"3xx":"2xx",
    detail:{status,method:"GET",route:path,product,journey,
      duration_ms:1.5,recovery_posture:"diagnostics_only"},
    organization:"private-tenant-id",authorization:"Bearer secret-should-not-print"
  };
}
describe("read-only SONARA offline SLO log evidence",()=>{
  it("only emits fixed product aggregates and never operational alert authority",()=>{
    const a=createOfflineSuiteSloAccumulator({nowMs:NOW});
    a.add(req(1));a.add(req(2,NOW,503,"/api/creator/generation/:id"));
    const r=a.report();
    assert.equal(r.status,"parsed_not_authenticated");
    assert.equal(r.operationalAlert,false);
    assert.equal(r.authoritativeCollectorContinuity,false);
    assert.equal(r.products.length,4);
    assert.equal(r.relevantSamples,2);
    assert.doesNotMatch(JSON.stringify(r),/private-tenant-id|secret-should-not-print|Bearer/);
  });
  it("distinguishes short-term traffic spikes from verified hour coverage",()=>{
    const a=createOfflineSuiteSloAccumulator({nowMs:NOW});
    for(let i=0;i<1000;i++)a.add(req(i,NOW-Math.floor(i/1000*300000),i<100?503:200));
    const p=a.report().products.find(x=>x.suite==="business_builder");
    assert.equal(p.reason,"insufficient_long_window_coverage");
    assert.equal(p.candidateAlertFromUnverifiedEvidence,false);
  });
  it("records sustained high burn as a diagnostic candidate but never pages",()=>{
    const a=createOfflineSuiteSloAccumulator({nowMs:NOW});
    for(let i=0;i<1000;i++)a.add(req(i,NOW-Math.floor(i/1000*3600000),i<100?503:200));
    const r=a.report();
    assert.equal(r.products.find(x=>x.suite==="business_builder").candidateAlertFromUnverifiedEvidence,true);
    assert.equal(r.operationalAlert,false);
    assert.equal(r.permittedAction,"diagnostics_only");
  });
  it("rejects duplicate correlation IDs and forged suite labels",()=>{
    const a=createOfflineSuiteSloAccumulator({nowMs:NOW});
    a.add(req(1));a.add(req(1));
    const forged=req(2);forged.detail.product="creator_studio";a.add(forged);
    const r=a.report();
    assert.equal(r.counts.duplicates,1);
    assert.equal(r.counts.invalid,1);
    assert.equal(r.completeParsing,false);
  });
  it("marks unknown routes incomplete without including them in product SLOs",()=>{
    const a=createOfflineSuiteSloAccumulator({nowMs:NOW});
    const record=req(1);record.detail.route="unmatched";
    record.detail.product="unclassified";record.detail.journey="other";
    a.add(record);
    const r=a.report();
    assert.equal(r.counts.unmapped,1);
    assert.equal(r.relevantSamples,0);
    assert.equal(r.completeParsing,false);
  });
  it("rejects contradictory status, malformed times and future observations",()=>{
    const a=createOfflineSuiteSloAccumulator({nowMs:NOW});
    const bad=req(1,NOW,503);bad.outcome="ok";a.add(bad);
    const future=req(2,NOW+10000);a.add(future);
    const wrongTime=req(3);wrongTime.ts="2026-99-99T00:00:00.000Z";a.add(wrongTime);
    assert.equal(a.report().counts.invalid,3);
  });
  it("excludes historical traffic, ignores nonrequest logs and fails on corrupt lines",()=>{
    const a=createOfflineSuiteSloAccumulator({nowMs:NOW});
    a.add(req(1,NOW-7*3600000));a.add({event:"other"});
    a.rejectMalformedLine();
    const r=a.report();
    assert.equal(r.relevantSamples,0);
    assert.equal(r.counts.historical,1);
    assert.equal(r.counts.ignored,1);
    assert.equal(r.counts.invalid,1);
    assert.equal(r.status,"incomplete_evidence");
  });
  it("bounds retained observations without converting truncated evidence into success",()=>{
    const a=createOfflineSuiteSloAccumulator({nowMs:NOW});
    for(let i=0;i<MAX_OBSERVATIONS+1;i++)a.add(req(i));
    const r=a.report();
    assert.equal(r.counts.overflow,1);
    assert.equal(r.relevantSamples,MAX_OBSERVATIONS);
    assert.equal(r.completeParsing,false);
    assert.equal(r.operationalAlert,false);
  });
});
