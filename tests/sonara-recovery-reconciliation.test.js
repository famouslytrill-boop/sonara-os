"use strict";
const assert=require("node:assert/strict");
const {inspectRecoveryBacklog}=require("../lib/sonara-recovery-reconciliation.cjs");
const NOW=1800000000000;
describe("SONARA read-only recovery reconciliation",()=>{
  it("distinguishes due, waiting and expired jobs without executing any retry",()=>{
    const rows=[
      {state:"queued",notBeforeMs:NOW+1000,deadlineAtMs:NOW+10000},
      {state:"queued",notBeforeMs:NOW-1000,deadlineAtMs:NOW+10000},
      {state:"queued",notBeforeMs:NOW-10000,deadlineAtMs:NOW-100},
      {state:"verified",deadlineAtMs:NOW-1000}
    ];
    const result=inspectRecoveryBacklog(rows,{nowMs:NOW});
    assert.equal(result.status,"measured");
    assert.equal(result.counts.waiting,1);
    assert.equal(result.counts.due,1);
    assert.equal(result.counts.deadlineLapsed,1);
    assert.equal(result.counts.verified,1);
    assert.equal(result.autoRequeueAllowed,false);
    assert.equal(result.manualReviewRequired,1);
  });
  it("never auto-requeues a stuck, failed or unverified outcome",()=>{
    const rows=[
      {state:"started",startedAtMs:NOW-240000,deadlineAtMs:NOW+1000},
      {state:"started",startedAtMs:NOW-5000,deadlineAtMs:NOW+10000},
      {state:"failed",deadlineAtMs:NOW-10000},
      {state:"unverified",deadlineAtMs:NOW-10000}
    ];
    const result=inspectRecoveryBacklog(rows,{nowMs:NOW});
    assert.equal(result.counts.stalled,1);
    assert.equal(result.counts.inFlight,1);
    assert.equal(result.manualReviewRequired,3);
    assert.equal(result.autoRequeueAllowed,false);
  });
  it("does not expose tenant identities or provider secrets from evidence",()=>{
    const report=inspectRecoveryBacklog([{
      state:"failed",deadlineAtMs:NOW,organizationId:"secret-tenant",
      providerToken:"secret-key",resourceId:"customer-data"
    }],{nowMs:NOW});
    assert.doesNotMatch(JSON.stringify(report),/secret-tenant|secret-key|customer-data/);
  });
  it("rejects corrupt data rather than announcing a clean backlog",()=>{
    assert.equal(inspectRecoveryBacklog([{state:"impossible",deadlineAtMs:NOW}],{nowMs:NOW}).status,"invalid_evidence");
    assert.equal(inspectRecoveryBacklog([{state:"started",deadlineAtMs:NOW}],{nowMs:NOW}).status,"invalid_evidence");
    assert.equal(inspectRecoveryBacklog([{state:"queued",notBeforeMs:"tomorrow",deadlineAtMs:NOW}],{nowMs:NOW}).status,"invalid_evidence");
  });
});
