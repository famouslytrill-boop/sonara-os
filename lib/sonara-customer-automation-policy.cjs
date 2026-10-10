// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

const { classifyAction, mayApproveOwnerAction } = require("./sonara-agent-authority.cjs");
const { authorizationDecision } = require("./sonara-customer-authorization-calculator.cjs");
const { operationCost, tokenBucketDecision, concurrencyDecision, dailyBudgetDecision } =
  require("./sonara-rate-budget-math.cjs");
const { timestampEvidence } = require("./sonara-time-authority.cjs");
const { residualRisk } = require("./sonara-deterministic-risk-assessment.cjs");
const { proofPacket } = require("./sonara-customer-proof-engine.cjs");

// Customer-facing skills. This is a capability catalog, not tool authority.
// Sensitive examples are included only to route them to approval-per-run.
const SKILLS=Object.freeze({
  records_summarizer:Object.freeze({actionType:"summarise_records",maxToolCalls:0,sideEffect:"none"}),
  draft_writer:Object.freeze({actionType:"draft_content",maxToolCalls:0,sideEffect:"private_draft"}),
  reply_drafter:Object.freeze({actionType:"draft_reply",maxToolCalls:0,sideEffect:"private_draft"}),
  report_builder:Object.freeze({actionType:"prepare_report",maxToolCalls:2,sideEffect:"private_record"}),
  data_quality:Object.freeze({actionType:"check_data_quality",maxToolCalls:2,sideEffect:"none"}),
  next_step_planner:Object.freeze({actionType:"suggest_next_step",maxToolCalls:2,sideEffect:"none"}),
  record_classifier:Object.freeze({actionType:"categorise_record",maxToolCalls:1,sideEffect:"reversible_record"}),
  campaign_dispatch:Object.freeze({actionType:"customer_campaign_dispatch",maxToolCalls:4,sideEffect:"external"}),
  review_publisher:Object.freeze({actionType:"publish_review",maxToolCalls:2,sideEffect:"external"}),
  refund_preparation:Object.freeze({actionType:"issue_refund",maxToolCalls:2,sideEffect:"money"})
});
const TRIGGERS=Object.freeze(new Set([
  "manual","schedule","record_created","record_changed","deadline_approaching","threshold_crossed"
]));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validZone(zone){
  try{new Intl.DateTimeFormat("en-US",{timeZone:zone}).format(new Date(0));return typeof zone==="string"&&zone.length<=80;}catch{return false;}
}
function skillPlan(skillKey){
  const skill=SKILLS[skillKey];
  if(!skill)return Object.freeze({ok:false,code:"unknown_customer_skill"});
  const authority=classifyAction(skill.actionType);
  return Object.freeze({
    ok:true,skillKey,actionType:skill.actionType,maxToolCalls:skill.maxToolCalls,
    sideEffect:skill.sideEffect,
    executionMode:authority.requiresOwnerApproval?"approval_per_run":"bounded_unattended_candidate",
    authority
  });
}
function automationDefinitionPreflight({
  organizationId,serverOrganizationId,automationId,createdByUserId,creatorRole,
  skillKey,trigger,timeZone="UTC",maxRunsPerDay=24,maxConcurrentRuns=1,
  enabled=false,customerCanPause=true,expiresAt=null,now=null
}={}){
  const blockers=[];
  if(!UUID.test(organizationId||"")||organizationId!==serverOrganizationId)blockers.push("tenant_scope_unverified");
  if(!UUID.test(automationId||"")||!UUID.test(createdByUserId||""))blockers.push("automation_identity_invalid");
  const owner=mayApproveOwnerAction(creatorRole);
  if(!owner.allowed)blockers.push(owner.code);
  const plan=skillPlan(skillKey);
  if(!plan.ok)blockers.push(plan.code);
  if(!TRIGGERS.has(trigger))blockers.push("unknown_automation_trigger");
  if(!validZone(timeZone))blockers.push("invalid_time_zone");
  if(!Number.isSafeInteger(maxRunsPerDay)||maxRunsPerDay<1||maxRunsPerDay>1440)
    blockers.push("daily_run_cap_invalid");
  if(!Number.isSafeInteger(maxConcurrentRuns)||maxConcurrentRuns<1||maxConcurrentRuns>10)
    blockers.push("concurrency_cap_invalid");
  if(customerCanPause!==true)blockers.push("customer_pause_control_required");
  if(expiresAt!==null){
    const expiry=Date.parse(expiresAt),trustedNow=Date.parse(now);
    if(!Number.isFinite(expiry))blockers.push("automation_expiry_invalid");
    else if(!Number.isFinite(trustedNow))blockers.push("trusted_now_required_for_expiry_check");
    else if(expiry<=trustedNow)blockers.push("automation_expiry_not_future");
  }
  if(enabled===true&&plan.ok&&plan.executionMode==="approval_per_run")
    blockers.push("sensitive_automation_cannot_be_blanket_enabled");
  return Object.freeze({
    state:blockers.length?"automation_definition_blocked":"automation_definition_review_ready",
    blockers:Object.freeze(blockers),plan,
    customerOwnsAutomation:true,enabledByThisDecision:false,
    toolExecutionAuthorized:false,standingApprovalForSensitiveActions:false,
    trustedTimeRequiredForExpiry:expiresAt!==null
  });
}
function automationRunDecision({
  skillKey,runCountToday,maxRunsPerDay,activeRuns,maxConcurrentRuns,
  ownerApprovalPresent=false,ownerRole,customerPaused=false
}={}){
  const blockers=[];
  const plan=skillPlan(skillKey);
  if(!plan.ok)blockers.push(plan.code);
  if(!Number.isSafeInteger(runCountToday)||runCountToday<0||
     !Number.isSafeInteger(maxRunsPerDay)||maxRunsPerDay<1)blockers.push("daily_usage_unreadable");
  else if(runCountToday>=maxRunsPerDay)blockers.push("daily_run_cap_reached");
  if(!Number.isSafeInteger(activeRuns)||activeRuns<0||
     !Number.isSafeInteger(maxConcurrentRuns)||maxConcurrentRuns<1)blockers.push("concurrency_unreadable");
  else if(activeRuns>=maxConcurrentRuns)blockers.push("concurrency_cap_reached");
  if(customerPaused===true)blockers.push("customer_paused_automation");
  if(plan.ok&&plan.executionMode==="approval_per_run"){
    if(ownerApprovalPresent!==true)blockers.push("owner_approval_required_this_run");
    if(!mayApproveOwnerAction(ownerRole).allowed)blockers.push("owner_role_required");
  }
  return Object.freeze({
    state:blockers.length?"automation_run_blocked":"automation_run_candidate",
    blockers:Object.freeze([...new Set(blockers)]),plan,
    runExecuted:false,externalSideEffectExecuted:false,
    customerCanCancel:true
  });
}
const RUN_POLICY=Object.freeze({
  records_summarizer:Object.freeze({authorizationAction:"read",resourceClass:"tenant_confidential",riskRequired:false,proofRequired:false}),
  draft_writer:Object.freeze({authorizationAction:"create",resourceClass:"tenant_confidential",riskRequired:false,proofRequired:false}),
  reply_drafter:Object.freeze({authorizationAction:"create",resourceClass:"tenant_confidential",riskRequired:false,proofRequired:false}),
  report_builder:Object.freeze({authorizationAction:"create",resourceClass:"tenant_confidential",riskRequired:false,proofRequired:false}),
  data_quality:Object.freeze({authorizationAction:"read",resourceClass:"tenant_confidential",riskRequired:false,proofRequired:false}),
  next_step_planner:Object.freeze({authorizationAction:"read",resourceClass:"tenant_confidential",riskRequired:false,proofRequired:false}),
  record_classifier:Object.freeze({authorizationAction:"update",resourceClass:"tenant_confidential",riskRequired:false,proofRequired:false}),
  campaign_dispatch:Object.freeze({authorizationAction:"publish",resourceClass:"tenant_confidential",riskRequired:true,proofRequired:false}),
  review_publisher:Object.freeze({authorizationAction:"publish",resourceClass:"restricted",riskRequired:true,proofRequired:true}),
  refund_preparation:Object.freeze({authorizationAction:"billing_admin",resourceClass:"restricted",riskRequired:true,proofRequired:false})
});

/**
 * Compose the existing independent controls before a customer automation may
 * even be handed to a side-effect adapter. This does not consume a token,
 * acquire a concurrency slot, write a database row, call a model, publish,
 * send a campaign or move money.
 */
function governedAutomationRunPreflight({
  organizationId,serverOrganizationId,userId,role,skillKey,ownsRecord=false,
  runCountToday,maxRunsPerDay,activeRuns,maxConcurrentRuns,customerPaused=false,
  serverReceivedAt,timeZone="UTC",payloadBytes=0,declaredWorkUnits=0,
  rateState,dailyState,stepUpVerified=false,approvalDecision=null,
  riskInput=null,proofInput=null
}={}){
  const blockers=[];
  const reviewFlags=[];
  const plan=skillPlan(skillKey);
  if(!plan.ok) blockers.push(plan.code);
  const policy=RUN_POLICY[skillKey] || null;
  if(!policy) blockers.push("run_policy_missing");

  let timeEvidence=null;
  try{
    timeEvidence=timestampEvidence({serverReceivedAt,timeZone});
    if(timeEvidence.issues.length) reviewFlags.push(...timeEvidence.issues);
  }catch{
    blockers.push("trusted_server_time_invalid");
  }

  const boardReady=approvalDecision?.state==="approval_evidence_ready";
  const authz=policy ? authorizationDecision({
    organizationId,resourceOrganizationId:serverOrganizationId,userId,role,
    action:policy.authorizationAction,resourceClass:policy.resourceClass,
    ownsRecord,stepUpVerified,boardEvidenceReady:boardReady
  }) : null;
  if(authz && !authz.allowed) blockers.push(...authz.blockers);

  const run=automationRunDecision({
    skillKey,runCountToday,maxRunsPerDay,activeRuns,maxConcurrentRuns,
    ownerApprovalPresent:boardReady,ownerRole:role,customerPaused
  });
  if(run.state!=="automation_run_candidate") blockers.push(...run.blockers);

  let cost=null,bucket=null,daily=null,concurrency=null;
  try{
    cost=operationCost({operation:"automation_run",payloadBytes,declaredWorkUnits});
    if(!cost.ok) blockers.push(cost.code);
    if(cost.ok){
      bucket=tokenBucketDecision({
        capacityUnits:rateState?.capacityUnits,
        refillUnitsPerMinute:rateState?.refillUnitsPerMinute,
        availableUnits:rateState?.availableUnits,
        lastRefillAt:rateState?.lastRefillAt,
        now:serverReceivedAt,
        requestCostUnits:cost.costUnits
      });
      if(!bucket.allowed) blockers.push(bucket.reason);
      daily=dailyBudgetDecision({
        usedUnits:dailyState?.usedUnits,
        dailyLimitUnits:dailyState?.dailyLimitUnits,
        requestCostUnits:cost.costUnits
      });
      if(!daily.allowed) blockers.push(daily.reason);
    }
    concurrency=concurrencyDecision({active:activeRuns,limit:maxConcurrentRuns,requested:1});
    if(!concurrency.allowed) blockers.push(concurrency.reason);
  }catch{
    blockers.push("resource_budget_state_invalid");
  }

  let risk=null;
  if(policy?.riskRequired){
    if(!riskInput){
      blockers.push("risk_assessment_required_for_sensitive_run");
    }else{
      try{
        risk=residualRisk(riskInput);
        if(risk.residualBand==="unknown") blockers.push("verified_residual_risk_required");
        else if(risk.residualBand==="critical") blockers.push("critical_residual_risk_requires_manual_path");
        else if(risk.residualBand==="high") reviewFlags.push("high_residual_risk_owner_attention");
      }catch{
        blockers.push("risk_assessment_invalid");
      }
    }
  }

  let proof=null;
  if(policy?.proofRequired){
    if(!proofInput){
      blockers.push("proof_packet_required_for_review_publication");
    }else{
      try{
        proof=proofPacket(proofInput);
        if(proof.state!=="required_evidence_complete")
          blockers.push("proof_packet_incomplete_for_review_publication");
      }catch{
        blockers.push("proof_packet_invalid");
      }
    }
  }

  if(plan.ok&&plan.executionMode==="approval_per_run"&&!boardReady)
    blockers.push("customer_board_approval_required_this_run");

  return Object.freeze({
    state:blockers.length?"governed_run_blocked":"governed_run_preflight_ready",
    blockers:Object.freeze([...new Set(blockers)]),
    reviewFlags:Object.freeze([...new Set(reviewFlags)]),
    plan,policy,authorization:authz,timeEvidence,
    operationCost:cost,rateBudget:bucket,dailyBudget:daily,concurrency,
    risk,proof,
    runtimePermissionGranted:false,
    rateStateConsumed:false,
    concurrencySlotAcquired:false,
    automationRunRecorded:false,
    modelCalled:false,
    externalSideEffectExecuted:false
  });
}

module.exports={SKILLS,TRIGGERS,RUN_POLICY,skillPlan,automationDefinitionPreflight,
  automationRunDecision,governedAutomationRunPreflight};
