// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

const { classifyAction, mayApproveOwnerAction } = require("./sonara-agent-authority.cjs");

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
  enabled=false,customerCanPause=true,expiresAt=null
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
  if(expiresAt!==null&&(!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now()))
    blockers.push("automation_expiry_invalid_or_past");
  if(enabled===true&&plan.ok&&plan.executionMode==="approval_per_run")
    blockers.push("sensitive_automation_cannot_be_blanket_enabled");
  return Object.freeze({
    state:blockers.length?"automation_definition_blocked":"automation_definition_review_ready",
    blockers:Object.freeze(blockers),plan,
    customerOwnsAutomation:true,enabledByThisDecision:false,
    toolExecutionAuthorized:false,standingApprovalForSensitiveActions:false
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
module.exports={SKILLS,TRIGGERS,skillPlan,automationDefinitionPreflight,automationRunDecision};
