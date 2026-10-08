// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

// Pure state-transition checks for a future transactional executor.
// It never writes a database, decrements a budget, calls a provider or performs
// a side effect. Production must claim idempotency + approval snapshot + shared
// budgets atomically before invoking the external adapter.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const KEY=/^[A-Za-z0-9._:-]{8,160}$/;
function instant(v,name){const t=typeof v==="string"?Date.parse(v):NaN;if(!Number.isFinite(t))throw new Error("invalid_"+name);return t;}

function claimDecision({
  preflight,organizationId,serverOrganizationId,requestId,proposalSnapshotHash,
  idempotencyKey,now,approvalExpiresAt,existingClaim=null,
  canonicalSnapshotHash,canonicalApprovalState,
  sharedBudgetCanConsume=false,concurrencySlotAvailable=false
}={}){
  const blockers=[];
  if(!preflight||preflight.preflightReady!==true||preflight.state!=="preflight_evidence_ready")
    blockers.push("preflight_not_ready");
  if(!UUID.test(organizationId||"")||organizationId!==serverOrganizationId)
    blockers.push("tenant_scope_unverified");
  if(!UUID.test(requestId||""))blockers.push("request_id_invalid");
  if(!SHA.test(proposalSnapshotHash||"")||proposalSnapshotHash!==canonicalSnapshotHash)
    blockers.push("canonical_snapshot_mismatch");
  if(!KEY.test(idempotencyKey||""))blockers.push("idempotency_key_invalid");
  let current=null,expiry=null;
  try{current=instant(now,"now");expiry=instant(approvalExpiresAt,"approval_expires_at");}
  catch(error){blockers.push(error.message);}
  if(current!==null&&expiry!==null&&current>expiry)blockers.push("approval_expired_before_claim");
  if(canonicalApprovalState!=="approval_evidence_ready"&&
     preflight.expectedRiskClass!=="routine_private")
    blockers.push("canonical_approval_no_longer_ready");
  if(sharedBudgetCanConsume!==true)blockers.push("shared_budget_atomic_consume_required");
  if(concurrencySlotAvailable!==true)blockers.push("concurrency_slot_required");
  if(existingClaim){
    if(existingClaim.organizationId!==organizationId)blockers.push("existing_claim_tenant_mismatch");
    else if(existingClaim.idempotencyKey!==idempotencyKey)blockers.push("existing_claim_key_mismatch");
    else if(existingClaim.snapshotHash!==proposalSnapshotHash)blockers.push("existing_claim_snapshot_mismatch");
    else if(["claimed","executing","settled"].includes(existingClaim.state))
      return Object.freeze({
        state:"idempotent_existing_claim",blockers:Object.freeze(blockers),
        claimMayBeCreated:false,sideEffectMayStart:false,
        existingState:existingClaim.state,
        replayMustReturnRecordedOutcome:existingClaim.state==="settled"
      });
  }
  return Object.freeze({
    state:blockers.length?"claim_blocked":"atomic_claim_candidate",
    blockers:Object.freeze([...new Set(blockers)]),
    claimMayBeCreated:blockers.length===0,
    sideEffectMayStart:false,
    atomicRequirements:Object.freeze([
      "insert_unique_idempotency_claim",
      "recheck_exact_snapshot",
      "recheck_approval_state",
      "consume_shared_rate_budget",
      "acquire_concurrency_slot"
    ])
  });
}

function startExecutionDecision({
  claimState,claimSnapshotHash,currentSnapshotHash,claimOrganizationId,
  serverOrganizationId,executorName,providerConfigured=false
}={}){
  const blockers=[];
  if(claimState!=="claimed")blockers.push("claim_not_owned");
  if(!SHA.test(claimSnapshotHash||"")||claimSnapshotHash!==currentSnapshotHash)
    blockers.push("snapshot_changed_after_claim");
  if(!UUID.test(claimOrganizationId||"")||claimOrganizationId!==serverOrganizationId)
    blockers.push("tenant_scope_changed_after_claim");
  if(typeof executorName!=="string"||!/^[a-z][a-z0-9_.:-]{2,80}$/.test(executorName))
    blockers.push("executor_name_invalid");
  if(providerConfigured!==true)blockers.push("executor_provider_unavailable");
  return Object.freeze({
    state:blockers.length?"execution_start_blocked":"execution_start_candidate",
    blockers:Object.freeze(blockers),
    externalCallExecuted:false
  });
}

function settleDecision({
  claimState,executorAttempted=false,executorSucceeded=false,
  providerResultRef,providerResultVerified=false,
  sideEffectObserved=false,now
}={}){
  const blockers=[];
  if(!["executing","claimed"].includes(claimState))blockers.push("claim_not_settleable");
  try{instant(now,"now");}catch(error){blockers.push(error.message);}
  if(executorSucceeded===true&&executorAttempted!==true)blockers.push("success_without_attempt");
  if(executorSucceeded===true){
    if(typeof providerResultRef!=="string"||!KEY.test(providerResultRef))
      blockers.push("provider_result_ref_invalid");
    if(providerResultVerified!==true)blockers.push("provider_result_unverified");
    if(sideEffectObserved!==true)blockers.push("side_effect_not_observed");
  }
  const target=blockers.length?"settlement_blocked":
    executorSucceeded?"settled_success_candidate":
      executorAttempted?"settled_failure_candidate":"release_unused_claim_candidate";
  return Object.freeze({
    state:target,blockers:Object.freeze(blockers),
    outcomeMayBeRecorded:blockers.length===0,
    providerTruthCertified:false,
    concurrencyReleaseRequired:blockers.length===0,
    retryRequiresSameIdempotencyKey:executorAttempted===true
  });
}

module.exports={claimDecision,startExecutionDecision,settleDecision};
