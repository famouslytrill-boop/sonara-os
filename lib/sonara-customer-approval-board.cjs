// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Customer-owned governance board. Pure decision support only: it never
// publishes, pays, deletes, signs, sends, changes permissions or executes tools.
// Server routes must derive all identity/role/step-up evidence independently.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const RISK_CLASSES=Object.freeze([
  "routine_private","external_publish","customer_campaign","financial_change",
  "security_change","legal_commitment","destructive_change"
]);
const HIGH=new Set(["financial_change","security_change","legal_commitment","destructive_change"]);
const OWNER_ROLES=new Set(["owner","business_owner","admin"]);
function time(value){const t=typeof value==="string"?Date.parse(value):NaN;return Number.isFinite(t)?t:null;}

function approvalPlan({riskClass,eligibleHumanApproverCount,soloOwnerMode=false}={}){
  if(!RISK_CLASSES.includes(riskClass))return Object.freeze({ok:false,code:"unknown_risk_class"});
  if(!Number.isSafeInteger(eligibleHumanApproverCount)||eligibleHumanApproverCount<1)
    return Object.freeze({ok:false,code:"no_eligible_human_approver"});
  if(riskClass==="routine_private")return Object.freeze({
    ok:true,mode:"single_human",requiredDistinctApprovals:1,stepUpRequired:false,
    minimumSecondConfirmationDelaySeconds:0,independentChannelRequired:false
  });
  if(HIGH.has(riskClass)){
    if(eligibleHumanApproverCount>=2)return Object.freeze({
      ok:true,mode:"dual_control",requiredDistinctApprovals:2,stepUpRequired:true,
      minimumSecondConfirmationDelaySeconds:0,
      independentChannelRequired:riskClass==="financial_change"||riskClass==="security_change"
    });
    if(soloOwnerMode===true)return Object.freeze({
      ok:true,mode:"solo_owner_step_up",requiredDistinctApprovals:1,stepUpRequired:true,
      // Delayed reconfirmation reduces accidental one-click execution. It is
      // not equivalent to an independent second person.
      minimumSecondConfirmationDelaySeconds:300,
      independentChannelRequired:riskClass==="financial_change"||riskClass==="security_change",
      residualRisk:"no_independent_second_human"
    });
    return Object.freeze({ok:false,code:"second_human_required_or_explicit_solo_owner_mode"});
  }
  return Object.freeze({
    ok:true,mode:"single_owner",requiredDistinctApprovals:1,stepUpRequired:true,
    minimumSecondConfirmationDelaySeconds:0,independentChannelRequired:false
  });
}

function evaluateApprovalBoard({
  organizationId,serverOrganizationId,riskClass,requestId,proposalSnapshotHash,
  requestedAt,expiresAt,proposedByUserId,eligibleHumanApproverCount,
  soloOwnerMode=false,decisions=[],stepUpVerified=false,
  independentChannelVerified=false,soloSecondConfirmationAt
}={}){
  const blockers=[];
  if(!UUID.test(organizationId||"")||organizationId!==serverOrganizationId)blockers.push("tenant_scope_unverified");
  if(!UUID.test(requestId||""))blockers.push("request_id_invalid");
  if(!SHA.test(proposalSnapshotHash||""))blockers.push("proposal_snapshot_hash_invalid");
  if(!UUID.test(proposedByUserId||""))blockers.push("proposer_identity_invalid");
  const start=time(requestedAt),expiry=time(expiresAt);
  if(start===null||expiry===null||expiry<=start)blockers.push("approval_window_invalid");
  const plan=approvalPlan({riskClass,eligibleHumanApproverCount,soloOwnerMode});
  if(!plan.ok)blockers.push(plan.code);

  const valid=[];
  const seenDecisionIds=new Set();
  const seenUsers=new Set();
  for(const row of Array.isArray(decisions)?decisions:[]){
    if(!row||!UUID.test(row.id||"")||seenDecisionIds.has(row.id)){blockers.push("duplicate_or_invalid_decision_id");continue;}
    seenDecisionIds.add(row.id);
    if(row.status!=="approved"&&row.status!=="declined"){blockers.push("decision_status_invalid");continue;}
    if(!UUID.test(row.userId||"")||!OWNER_ROLES.has(row.role)){blockers.push("decision_actor_not_authorized");continue;}
    if(row.snapshotHash!==proposalSnapshotHash){blockers.push("decision_for_different_snapshot");continue;}
    const at=time(row.decidedAt);
    if(at===null||start===null||expiry===null||at<start||at>expiry){blockers.push("decision_timestamp_outside_window");continue;}
    if(seenUsers.has(row.userId)){blockers.push("duplicate_approver_identity");continue;}
    seenUsers.add(row.userId);valid.push(row);
  }

  if(valid.some(x=>x.status==="declined"))blockers.push("board_declined");
  const approvals=valid.filter(x=>x.status==="approved");
  if(plan.ok&&approvals.length<plan.requiredDistinctApprovals)blockers.push("approval_quorum_not_met");
  if(plan.ok&&plan.stepUpRequired&&stepUpVerified!==true)blockers.push("step_up_authentication_missing");
  if(plan.ok&&plan.independentChannelRequired&&independentChannelVerified!==true)
    blockers.push("independent_channel_confirmation_missing");

  if(plan.ok&&plan.mode==="dual_control"&&approvals.some(x=>x.userId===proposedByUserId))
    blockers.push("proposer_cannot_satisfy_dual_control_quorum");

  if(plan.ok&&plan.mode==="solo_owner_step_up"){
    if(approvals.length&&approvals[0].userId!==proposedByUserId)
      blockers.push("solo_owner_approval_identity_mismatch");
    const second=time(soloSecondConfirmationAt);
    const min=start===null?null:start+plan.minimumSecondConfirmationDelaySeconds*1000;
    if(second===null||min===null||second<min||second>expiry)
      blockers.push("delayed_owner_reconfirmation_missing");
  }

  return Object.freeze({
    state:blockers.length?"approval_blocked":"approval_evidence_ready",
    blockers:Object.freeze([...new Set(blockers)]),plan,
    validApprovalCount:approvals.length,
    executionAuthorized:false,customerControlsBoard:true,
    legalValidityCertified:false
  });
}

module.exports={RISK_CLASSES,approvalPlan,evaluateApprovalBoard};
