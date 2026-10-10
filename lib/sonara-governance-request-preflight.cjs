// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

const { authorizationDecision } = require("./sonara-customer-authorization-calculator.cjs");
const { operationCost, tokenBucketDecision, concurrencyDecision, dailyBudgetDecision } =
  require("./sonara-rate-budget-math.cjs");
const { timestampEvidence } = require("./sonara-time-authority.cjs");
const { residualRisk } = require("./sonara-deterministic-risk-assessment.cjs");
const { proofPacket } = require("./sonara-customer-proof-engine.cjs");
const { evaluateApprovalBoard } = require("./sonara-customer-approval-board.cjs");

// This is a compositional preflight, not an executor. A route/worker must
// re-read canonical membership, approval rows, rate-budget state and evidence
// inside the same trusted transaction/claim boundary before side effects.
const ACTION_RISK = Object.freeze({
  read: "routine_private",
  create: "routine_private",
  update: "routine_private",
  export: "routine_private",
  publish: "external_publish",
  delete: "destructive_change",
  security_admin: "security_change",
  billing_admin: "financial_change"
});
const HIGH_RISK = new Set([
  "external_publish","customer_campaign","financial_change",
  "security_change","legal_commitment","destructive_change"
]);

function riskClassForAction(action, requestedRiskClass) {
  if (action === "approve") return requestedRiskClass || null;
  return ACTION_RISK[action] || null;
}

function preflightGovernedRequest({
  organizationId, resourceOrganizationId, userId, role, action, resourceClass,
  ownsRecord=false, publicResource=false, stepUpVerified=false,

  riskClass, likelihood, impact, controlEffectivenessBasisPoints,
  controlEvidenceVerified=false, controlEvidenceCurrent=false,

  requestId, proposalSnapshotHash, requestedAt, expiresAt, proposedByUserId,
  eligibleHumanApproverCount, soloOwnerMode=false, decisions=[],
  independentChannelVerified=false, soloSecondConfirmationAt,

  serverReceivedAt, clientOccurredAt, providerOccurredAt,
  providerVerified=false, maxClientSkewSeconds=300, timeZone="UTC",

  operation, payloadBytes=0, declaredWorkUnits=0,
  capacityUnits, refillUnitsPerMinute, availableUnits, lastRefillAt,
  dailyUsedUnits, dailyLimitUnits, activeConcurrency, concurrencyLimit,

  proofRequired=false, claimHash, requiredEvidenceTypes=[], evidence=[]
}={}) {
  const blockers=[];
  const expectedRiskClass=riskClassForAction(action,riskClass);
  if(!expectedRiskClass) blockers.push("risk_class_unresolved");
  if(action!=="approve" && riskClass && riskClass!==expectedRiskClass)
    blockers.push("risk_class_does_not_match_action");

  let board=null;
  const boardRequired=HIGH_RISK.has(expectedRiskClass);
  if(boardRequired){
    board=evaluateApprovalBoard({
      organizationId,serverOrganizationId:resourceOrganizationId,
      riskClass:expectedRiskClass,requestId,proposalSnapshotHash,
      requestedAt,expiresAt,proposedByUserId,
      eligibleHumanApproverCount,soloOwnerMode,decisions,
      stepUpVerified,independentChannelVerified,soloSecondConfirmationAt
    });
    if(board.state!=="approval_evidence_ready") blockers.push(...board.blockers);
  }

  const auth=authorizationDecision({
    organizationId,resourceOrganizationId,userId,role,action,resourceClass,
    ownsRecord,stepUpVerified,
    boardEvidenceReady:!boardRequired || board?.state==="approval_evidence_ready",
    publicResource
  });
  if(!auth.allowed) blockers.push(...auth.blockers);

  let time=null;
  try {
    time=timestampEvidence({
      serverReceivedAt,clientOccurredAt,providerOccurredAt,
      providerVerified,maxClientSkewSeconds,timeZone
    });
  } catch (error) {
    blockers.push(error.message || "time_evidence_invalid");
  }

  let risk=null;
  try {
    risk=residualRisk({
      likelihood,impact,controlEffectivenessBasisPoints,
      controlEvidenceVerified,controlEvidenceCurrent
    });
    if(HIGH_RISK.has(expectedRiskClass) && risk.residualBand==="unknown")
      blockers.push("high_risk_control_evidence_unknown");
  } catch (error) {
    blockers.push(error.message || "risk_assessment_invalid");
  }

  const cost=operationCost({operation,payloadBytes,declaredWorkUnits});
  if(!cost.ok) blockers.push(cost.code);

  let token=null,daily=null,concurrency=null;
  if(cost.ok){
    try {
      token=tokenBucketDecision({
        capacityUnits,refillUnitsPerMinute,availableUnits,lastRefillAt,
        now:serverReceivedAt,requestCostUnits:cost.costUnits
      });
      if(!token.allowed) blockers.push(token.reason);
    } catch (error) { blockers.push(error.message || "rate_budget_invalid"); }

    try {
      daily=dailyBudgetDecision({
        usedUnits:dailyUsedUnits,dailyLimitUnits,requestCostUnits:cost.costUnits
      });
      if(!daily.allowed) blockers.push(daily.reason);
    } catch (error) { blockers.push(error.message || "daily_budget_invalid"); }

    try {
      concurrency=concurrencyDecision({
        active:activeConcurrency,limit:concurrencyLimit,requested:1
      });
      if(!concurrency.allowed) blockers.push(concurrency.reason);
    } catch (error) { blockers.push(error.message || "concurrency_budget_invalid"); }
  }

  let proof=null;
  if(proofRequired){
    proof=proofPacket({
      organizationId,serverOrganizationId:resourceOrganizationId,
      claimHash,requiredEvidenceTypes,evidence
    });
    if(proof.state!=="required_evidence_complete"){
      blockers.push("required_proof_incomplete",...proof.issues);
    }
  }

  const unique=[...new Set(blockers)];
  const ready=unique.length===0;
  return Object.freeze({
    state:ready?"preflight_evidence_ready":"preflight_blocked",
    blockers:Object.freeze(unique),
    expectedRiskClass,
    authorization:auth,
    timeEvidence:time,
    riskAssessment:risk,
    resourceCost:cost,
    tokenBudget:token,
    dailyBudget:daily,
    concurrencyBudget:concurrency,
    proof,
    approvalBoard:board,
    preflightReady:ready,
    // Deliberately false: shared budget consumption, exact DB row locking,
    // idempotency claim and side-effect execution have not happened here.
    executionAuthorized:false,
    sharedBudgetConsumed:false,
    idempotencyClaimed:false,
    sideEffectExecuted:false
  });
}

module.exports={ACTION_RISK,HIGH_RISK,riskClassForAction,preflightGovernedRequest};
