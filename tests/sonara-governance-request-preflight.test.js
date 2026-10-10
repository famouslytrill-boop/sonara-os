// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const {preflightGovernedRequest,riskClassForAction}=
  require("../lib/sonara-governance-request-preflight.cjs");

const ORG="11111111-1111-4111-8111-111111111111";
const U1="22222222-2222-4222-8222-222222222222";
const U2="33333333-3333-4333-8333-333333333333";
const U3="44444444-4444-4444-8444-444444444444";
const REQ="55555555-5555-4555-8555-555555555555";
const D1="66666666-6666-4666-8666-666666666666";
const D2="77777777-7777-4777-8777-777777777777";
const HASH="a".repeat(64);

const common=(o={})=>({
  organizationId:ORG,resourceOrganizationId:ORG,userId:U1,role:"owner",
  action:"update",resourceClass:"tenant_standard",ownsRecord:true,
  stepUpVerified:false,
  likelihood:2,impact:2,controlEffectivenessBasisPoints:0,
  controlEvidenceVerified:false,controlEvidenceCurrent:false,
  serverReceivedAt:"2026-10-08T21:00:00Z",timeZone:"America/New_York",
  operation:"authenticated_read",payloadBytes:0,declaredWorkUnits:0,
  capacityUnits:100,refillUnitsPerMinute:60,availableUnits:100,
  lastRefillAt:"2026-10-08T20:59:00Z",
  dailyUsedUnits:0,dailyLimitUnits:1000,activeConcurrency:0,concurrencyLimit:2,
  proofRequired:false,...o
});

const publish=(o={})=>common({
  action:"publish",resourceClass:"tenant_confidential",stepUpVerified:true,
  riskClass:"external_publish",likelihood:3,impact:4,
  controlEffectivenessBasisPoints:5000,
  controlEvidenceVerified:true,controlEvidenceCurrent:true,
  requestId:REQ,proposalSnapshotHash:HASH,
  requestedAt:"2026-10-08T20:55:00Z",expiresAt:"2026-10-08T21:10:00Z",
  proposedByUserId:U3,eligibleHumanApproverCount:2,soloOwnerMode:false,
  decisions:[
    {id:D1,organizationId:ORG,requestId:REQ,userId:U1,role:"owner",
      status:"approved",snapshotHash:HASH,decidedAt:"2026-10-08T20:56:00Z"},
    {id:D2,organizationId:ORG,requestId:REQ,userId:U2,role:"admin",
      status:"approved",snapshotHash:HASH,decidedAt:"2026-10-08T20:57:00Z"}
  ],...o
});

describe("governed request preflight",()=>{
  it("maps consequential actions to explicit risk classes",()=>{
    assert.equal(riskClassForAction("publish"),"external_publish");
    assert.equal(riskClassForAction("delete"),"destructive_change");
    assert.equal(riskClassForAction("billing_admin"),"financial_change");
  });

  it("allows a routine private preflight while keeping execution impossible",()=>{
    const out=preflightGovernedRequest(common());
    assert.equal(out.state,"preflight_evidence_ready");
    assert.equal(out.preflightReady,true);
    assert.equal(out.executionAuthorized,false);
    assert.equal(out.sharedBudgetConsumed,false);
    assert.equal(out.idempotencyClaimed,false);
    assert.equal(out.sideEffectExecuted,false);
  });

  it("requires customer board evidence for external publication",()=>{
    const out=preflightGovernedRequest(publish({decisions:[]}));
    assert.equal(out.state,"preflight_blocked");
    assert.ok(out.blockers.includes("approval_quorum_not_met"));
  });

  it("accepts exact-snapshot independent board evidence but still does not execute",()=>{
    const out=preflightGovernedRequest(publish());
    assert.equal(out.state,"preflight_evidence_ready");
    assert.equal(out.approvalBoard.state,"approval_evidence_ready");
    assert.equal(out.executionAuthorized,false);
  });

  it("blocks approval for a different proposal snapshot",()=>{
    const rows=publish().decisions.map((row,i)=>i?{...row,snapshotHash:"b".repeat(64)}:row);
    const out=preflightGovernedRequest(publish({decisions:rows}));
    assert.ok(out.blockers.includes("decision_for_different_snapshot"));
  });

  it("blocks high-risk work when control-effectiveness evidence is unknown",()=>{
    const out=preflightGovernedRequest(publish({
      controlEvidenceVerified:false,controlEvidenceCurrent:false
    }));
    assert.ok(out.blockers.includes("high_risk_control_evidence_unknown"));
  });

  it("fails closed on cross-tenant resource access",()=>{
    const out=preflightGovernedRequest(common({
      resourceOrganizationId:"99999999-9999-4999-8999-999999999999"
    }));
    assert.ok(out.blockers.includes("tenant_scope_unverified"));
  });

  it("blocks when weighted token budget is exhausted",()=>{
    const out=preflightGovernedRequest(common({
      availableUnits:0,refillUnitsPerMinute:0
    }));
    assert.ok(out.blockers.includes("budget_exhausted_no_refill"));
  });

  it("blocks when daily budget or concurrency is exhausted",()=>{
    let out=preflightGovernedRequest(common({dailyUsedUnits:1000,dailyLimitUnits:1000}));
    assert.ok(out.blockers.includes("daily_budget_exceeded"));
    out=preflightGovernedRequest(common({activeConcurrency:2,concurrencyLimit:2}));
    assert.ok(out.blockers.includes("concurrency_budget_exceeded"));
  });

  it("requires complete proof when the workflow declares proof mandatory",()=>{
    const out=preflightGovernedRequest(common({
      proofRequired:true,claimHash:HASH,requiredEvidenceTypes:["provider_event"],evidence:[]
    }));
    assert.ok(out.blockers.includes("required_proof_incomplete"));
    assert.equal(out.proof.state,"evidence_incomplete");
  });

  it("accepts independently retrieved provider proof without calling it truth certification",()=>{
    const evidence=[{
      id:"88888888-8888-4888-8888-888888888888",organizationId:ORG,
      type:"provider_event",sourceRef:"stripe_evt_123",claimHash:HASH,
      hashVerified:true,independentlyRetrieved:true,actorIdentityVerified:false
    }];
    const out=preflightGovernedRequest(common({
      proofRequired:true,claimHash:HASH,requiredEvidenceTypes:["provider_event"],evidence
    }));
    assert.equal(out.state,"preflight_evidence_ready");
    assert.equal(out.proof.verificationTier,"independently_verified");
    assert.equal(out.proof.claimTruthCertified,false);
  });

  it("records client clock skew without allowing it to replace server receipt",()=>{
    const out=preflightGovernedRequest(common({
      clientOccurredAt:"2026-10-08T12:00:00-04:00"
    }));
    assert.equal(out.timeEvidence.deadlineAnchor,"server_received_at");
    assert.ok(out.timeEvidence.issues.includes("client_clock_skew_exceeds_policy"));
  });

  it("blocks an explicit risk class that contradicts the action",()=>{
    const out=preflightGovernedRequest(common({action:"publish",riskClass:"routine_private"}));
    assert.ok(out.blockers.includes("risk_class_does_not_match_action"));
  });
});
