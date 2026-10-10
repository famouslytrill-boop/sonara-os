// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const {claimDecision,startExecutionDecision,settleDecision}=
  require("../lib/sonara-governance-execution-state.cjs");
const ORG="11111111-1111-4111-8111-111111111111";
const REQ="22222222-2222-4222-8222-222222222222";
const HASH="a".repeat(64);
const preflight={preflightReady:true,state:"preflight_evidence_ready",expectedRiskClass:"financial_change"};
const claim=(o={})=>({
  preflight,organizationId:ORG,serverOrganizationId:ORG,requestId:REQ,
  proposalSnapshotHash:HASH,idempotencyKey:"billing-change:req-12345678",
  now:"2026-10-08T21:00:00Z",approvalExpiresAt:"2026-10-08T21:10:00Z",
  existingClaim:null,canonicalSnapshotHash:HASH,
  canonicalApprovalState:"approval_evidence_ready",
  sharedBudgetCanConsume:true,concurrencySlotAvailable:true,...o
});
describe("governance execution claim/settlement",()=>{
  it("produces an atomic claim candidate but never starts the side effect",()=>{
    const out=claimDecision(claim());
    assert.equal(out.state,"atomic_claim_candidate");
    assert.equal(out.claimMayBeCreated,true);
    assert.equal(out.sideEffectMayStart,false);
    assert.ok(out.atomicRequirements.includes("insert_unique_idempotency_claim"));
  });
  it("requires canonical snapshot to still match at claim time",()=>{
    const out=claimDecision(claim({canonicalSnapshotHash:"b".repeat(64)}));
    assert.ok(out.blockers.includes("canonical_snapshot_mismatch"));
  });
  it("blocks when approval expires between preflight and claim",()=>{
    const out=claimDecision(claim({
      now:"2026-10-08T21:11:00Z",approvalExpiresAt:"2026-10-08T21:10:00Z"
    }));
    assert.ok(out.blockers.includes("approval_expired_before_claim"));
  });
  it("requires shared budget consumption and concurrency claim in the atomic boundary",()=>{
    assert.ok(claimDecision(claim({sharedBudgetCanConsume:false}))
      .blockers.includes("shared_budget_atomic_consume_required"));
    assert.ok(claimDecision(claim({concurrencySlotAvailable:false}))
      .blockers.includes("concurrency_slot_required"));
  });
  it("treats a repeated settled idempotency key as replay, not a second execution",()=>{
    const out=claimDecision(claim({existingClaim:{
      organizationId:ORG,idempotencyKey:"billing-change:req-12345678",
      snapshotHash:HASH,state:"settled"
    }}));
    assert.equal(out.state,"idempotent_existing_claim");
    assert.equal(out.claimMayBeCreated,false);
    assert.equal(out.replayMustReturnRecordedOutcome,true);
  });
  it("blocks a stale idempotency key reused against different bytes",()=>{
    const out=claimDecision(claim({existingClaim:{
      organizationId:ORG,idempotencyKey:"billing-change:req-12345678",
      snapshotHash:"b".repeat(64),state:"claimed"
    }}));
    assert.ok(out.blockers.includes("existing_claim_snapshot_mismatch"));
  });
  it("requires a claimed row, exact snapshot, tenant and configured executor to start",()=>{
    const good=startExecutionDecision({
      claimState:"claimed",claimSnapshotHash:HASH,currentSnapshotHash:HASH,
      claimOrganizationId:ORG,serverOrganizationId:ORG,
      executorName:"stripe.subscription_change",providerConfigured:true
    });
    assert.equal(good.state,"execution_start_candidate");
    assert.equal(good.externalCallExecuted,false);
    assert.ok(startExecutionDecision({
      claimState:"waiting",claimSnapshotHash:HASH,currentSnapshotHash:HASH,
      claimOrganizationId:ORG,serverOrganizationId:ORG,
      executorName:"stripe.subscription_change",providerConfigured:true
    }).blockers.includes("claim_not_owned"));
  });
  it("blocks if request bytes changed after the atomic claim",()=>{
    const out=startExecutionDecision({
      claimState:"claimed",claimSnapshotHash:HASH,currentSnapshotHash:"b".repeat(64),
      claimOrganizationId:ORG,serverOrganizationId:ORG,
      executorName:"stripe.subscription_change",providerConfigured:true
    });
    assert.ok(out.blockers.includes("snapshot_changed_after_claim"));
  });
  it("requires verified provider result evidence before settling success",()=>{
    const out=settleDecision({
      claimState:"executing",executorAttempted:true,executorSucceeded:true,
      providerResultRef:"stripe:evt_12345678",providerResultVerified:false,
      sideEffectObserved:true,now:"2026-10-08T21:01:00Z"
    });
    assert.ok(out.blockers.includes("provider_result_unverified"));
  });
  it("records failed execution as a settlement candidate using same idempotency key on retry",()=>{
    const out=settleDecision({
      claimState:"executing",executorAttempted:true,executorSucceeded:false,
      now:"2026-10-08T21:01:00Z"
    });
    assert.equal(out.state,"settled_failure_candidate");
    assert.equal(out.retryRequiresSameIdempotencyKey,true);
    assert.equal(out.concurrencyReleaseRequired,true);
  });
  it("does not certify provider truth even after verified settlement evidence",()=>{
    const out=settleDecision({
      claimState:"executing",executorAttempted:true,executorSucceeded:true,
      providerResultRef:"stripe:evt_12345678",providerResultVerified:true,
      sideEffectObserved:true,now:"2026-10-08T21:01:00Z"
    });
    assert.equal(out.state,"settled_success_candidate");
    assert.equal(out.providerTruthCertified,false);
  });
});
