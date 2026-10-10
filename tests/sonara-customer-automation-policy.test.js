// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const {SKILLS,skillPlan,automationDefinitionPreflight,automationRunDecision,
  governedAutomationRunPreflight}=
  require("../lib/sonara-customer-automation-policy.cjs");
const ORG="11111111-1111-4111-8111-111111111111";
const A="22222222-2222-4222-8222-222222222222";
const U="33333333-3333-4333-8333-333333333333";
const valid=(o={})=>({organizationId:ORG,serverOrganizationId:ORG,automationId:A,
  createdByUserId:U,creatorRole:"owner",skillKey:"report_builder",trigger:"schedule",
  timeZone:"America/New_York",maxRunsPerDay:24,maxConcurrentRuns:1,
  enabled:false,customerCanPause:true,...o});
describe("customer automation and agent skills",()=>{
  it("reuses existing agent authority for safe unattended candidate skills",()=>{
    const p=skillPlan("report_builder");
    assert.equal(p.executionMode,"bounded_unattended_candidate");
    assert.equal(p.authority.requiresOwnerApproval,false);
  });
  it("routes customer campaigns to approval on every run",()=>{
    const p=skillPlan("campaign_dispatch");
    assert.equal(p.executionMode,"approval_per_run");
    assert.equal(p.authority.category,"customer_campaigns");
  });
  it("routes review publishing and refunds to approval-per-run",()=>{
    assert.equal(skillPlan("review_publisher").executionMode,"approval_per_run");
    assert.equal(skillPlan("refund_preparation").executionMode,"approval_per_run");
  });
  it("requires owner/admin/business-owner to create governed automations",()=>{
    const out=automationDefinitionPreflight(valid({creatorRole:"employee"}));
    assert.ok(out.blockers.includes("owner_role_required"));
  });
  it("requires customer pause control and strict daily/concurrency caps",()=>{
    assert.ok(automationDefinitionPreflight(valid({customerCanPause:false}))
      .blockers.includes("customer_pause_control_required"));
    assert.ok(automationDefinitionPreflight(valid({maxRunsPerDay:5000}))
      .blockers.includes("daily_run_cap_invalid"));
    assert.ok(automationDefinitionPreflight(valid({maxConcurrentRuns:20}))
      .blockers.includes("concurrency_cap_invalid"));
  });
  it("requires trusted caller time for replayable expiry checks",()=>{
    let out=automationDefinitionPreflight(valid({expiresAt:"2026-10-08T00:00:00Z"}));
    assert.ok(out.blockers.includes("trusted_now_required_for_expiry_check"));
    out=automationDefinitionPreflight(valid({expiresAt:"2026-10-08T00:00:00Z",now:"2026-10-07T00:00:00Z"}));
    assert.equal(out.state,"automation_definition_review_ready");
    assert.equal(out.trustedTimeRequiredForExpiry,true);
    out=automationDefinitionPreflight(valid({expiresAt:"2026-10-06T00:00:00Z",now:"2026-10-07T00:00:00Z"}));
    assert.ok(out.blockers.includes("automation_expiry_not_future"));
  });
  it("does not blanket-enable sensitive automations",()=>{
    const out=automationDefinitionPreflight(valid({skillKey:"campaign_dispatch",enabled:true}));
    assert.ok(out.blockers.includes("sensitive_automation_cannot_be_blanket_enabled"));
    assert.equal(out.standingApprovalForSensitiveActions,false);
  });
  it("allows safe skill definitions without granting runtime tool execution",()=>{
    const out=automationDefinitionPreflight(valid());
    assert.equal(out.state,"automation_definition_review_ready");
    assert.equal(out.enabledByThisDecision,false);
    assert.equal(out.toolExecutionAuthorized,false);
  });
  it("blocks a run when customer has paused it",()=>{
    const out=automationRunDecision({skillKey:"report_builder",runCountToday:0,maxRunsPerDay:5,
      activeRuns:0,maxConcurrentRuns:1,customerPaused:true});
    assert.ok(out.blockers.includes("customer_paused_automation"));
  });
  it("enforces daily and concurrent run budgets",()=>{
    assert.ok(automationRunDecision({skillKey:"report_builder",runCountToday:5,maxRunsPerDay:5,
      activeRuns:0,maxConcurrentRuns:1}).blockers.includes("daily_run_cap_reached"));
    assert.ok(automationRunDecision({skillKey:"report_builder",runCountToday:0,maxRunsPerDay:5,
      activeRuns:1,maxConcurrentRuns:1}).blockers.includes("concurrency_cap_reached"));
  });
  it("requires fresh owner approval for each sensitive run",()=>{
    let out=automationRunDecision({skillKey:"campaign_dispatch",runCountToday:0,maxRunsPerDay:5,
      activeRuns:0,maxConcurrentRuns:1,ownerApprovalPresent:false,ownerRole:"owner"});
    assert.ok(out.blockers.includes("owner_approval_required_this_run"));
    out=automationRunDecision({skillKey:"campaign_dispatch",runCountToday:0,maxRunsPerDay:5,
      activeRuns:0,maxConcurrentRuns:1,ownerApprovalPresent:true,ownerRole:"owner"});
    assert.equal(out.state,"automation_run_candidate");
    assert.equal(out.runExecuted,false);
  });
  it("unknown skills fail closed",()=>{
    assert.equal(skillPlan("send_money").ok,false);
    assert.ok(automationDefinitionPreflight(valid({skillKey:"send_money"})).blockers.includes("unknown_customer_skill"));
  });
  it("catalog keeps customer automation skills explicit and inspectable",()=>{
    assert.ok(Object.keys(SKILLS).length>=8);
    assert.equal(SKILLS.campaign_dispatch.sideEffect,"external");
  });

  const governed=(o={})=>governedAutomationRunPreflight({
    organizationId:ORG,serverOrganizationId:ORG,userId:U,role:"owner",
    skillKey:"report_builder",ownsRecord:true,
    runCountToday:0,maxRunsPerDay:24,activeRuns:0,maxConcurrentRuns:2,
    customerPaused:false,serverReceivedAt:"2026-10-08T18:00:00-04:00",
    timeZone:"America/New_York",payloadBytes:1024,declaredWorkUnits:1,
    rateState:{capacityUnits:100,refillUnitsPerMinute:60,availableUnits:100,
      lastRefillAt:"2026-10-08T17:59:00-04:00"},
    dailyState:{usedUnits:10,dailyLimitUnits:1000},
    stepUpVerified:false,approvalDecision:null,...o
  });

  it("composes the existing controls for a safe private automation without executing it",()=>{
    const out=governed();
    assert.equal(out.state,"governed_run_preflight_ready");
    assert.equal(out.authorization.allowed,true);
    assert.equal(out.rateBudget.allowed,true);
    assert.equal(out.dailyBudget.allowed,true);
    assert.equal(out.concurrency.allowed,true);
    assert.equal(out.runtimePermissionGranted,false);
    assert.equal(out.rateStateConsumed,false);
    assert.equal(out.externalSideEffectExecuted,false);
  });

  it("blocks a safe automation when the shared weighted budget is exhausted",()=>{
    const out=governed({rateState:{capacityUnits:100,refillUnitsPerMinute:0,
      availableUnits:0,lastRefillAt:"2026-10-08T18:00:00-04:00"}});
    assert.ok(out.blockers.includes("budget_exhausted_no_refill"));
    assert.equal(out.rateStateConsumed,false);
  });

  it("requires fresh customer-board evidence and step-up for each campaign dispatch",()=>{
    let out=governed({skillKey:"campaign_dispatch",stepUpVerified:true,
      riskInput:{likelihood:2,impact:3,controlEffectivenessBasisPoints:5000,
        controlEvidenceVerified:true,controlEvidenceCurrent:true}});
    assert.ok(out.blockers.includes("customer_board_approval_required_this_run"));
    out=governed({skillKey:"campaign_dispatch",stepUpVerified:false,
      approvalDecision:{state:"approval_evidence_ready"},
      riskInput:{likelihood:2,impact:3,controlEffectivenessBasisPoints:5000,
        controlEvidenceVerified:true,controlEvidenceCurrent:true}});
    assert.ok(out.blockers.includes("step_up_authentication_required"));
  });

  it("requires verified residual risk for sensitive automation instead of assuming controls work",()=>{
    const out=governed({skillKey:"campaign_dispatch",stepUpVerified:true,
      approvalDecision:{state:"approval_evidence_ready"},
      riskInput:{likelihood:3,impact:4,controlEffectivenessBasisPoints:8000,
        controlEvidenceVerified:false,controlEvidenceCurrent:true}});
    assert.ok(out.blockers.includes("verified_residual_risk_required"));
    assert.equal(out.risk.residualBand,"unknown");
  });

  it("holds critical residual risk on the manual path even after customer approval",()=>{
    const out=governed({skillKey:"campaign_dispatch",stepUpVerified:true,
      approvalDecision:{state:"approval_evidence_ready"},
      riskInput:{likelihood:5,impact:5,controlEffectivenessBasisPoints:0,
        controlEvidenceVerified:true,controlEvidenceCurrent:true}});
    assert.ok(out.blockers.includes("critical_residual_risk_requires_manual_path"));
    assert.equal(out.externalSideEffectExecuted,false);
  });

  it("shows high residual risk as an owner-attention flag without pretending it is a probability",()=>{
    const out=governed({skillKey:"campaign_dispatch",stepUpVerified:true,
      approvalDecision:{state:"approval_evidence_ready"},
      riskInput:{likelihood:4,impact:4,controlEffectivenessBasisPoints:1000,
        controlEvidenceVerified:true,controlEvidenceCurrent:true}});
    assert.ok(out.reviewFlags.includes("high_residual_risk_owner_attention"));
    assert.equal(out.risk.probabilityClaimed,false);
  });

  it("requires complete attributable proof before an automated customer review may reach publication preflight",()=>{
    const claimHash="a".repeat(64);
    const base={
      skillKey:"review_publisher",stepUpVerified:true,
      approvalDecision:{state:"approval_evidence_ready"},
      riskInput:{likelihood:2,impact:2,controlEffectivenessBasisPoints:5000,
        controlEvidenceVerified:true,controlEvidenceCurrent:true}
    };
    let out=governed(base);
    assert.ok(out.blockers.includes("proof_packet_required_for_review_publication"));
    out=governed({...base,proofInput:{
      organizationId:ORG,serverOrganizationId:ORG,claimHash,
      requiredEvidenceTypes:["customer_confirmation"],
      evidence:[{id:"44444444-4444-4444-8444-444444444444",organizationId:ORG,
        type:"customer_confirmation",sourceRef:"review_author_confirmation",
        claimHash,hashVerified:true,actorIdentityVerified:true}]
    }});
    assert.equal(out.proof.state,"required_evidence_complete");
    assert.equal(out.state,"governed_run_preflight_ready");
    assert.equal(out.externalSideEffectExecuted,false);
  });

  it("rejects untrusted timestamps and malformed resource-budget state before a run",()=>{
    let out=governed({serverReceivedAt:"local time"});
    assert.ok(out.blockers.includes("trusted_server_time_invalid"));
    out=governed({rateState:null});
    assert.ok(out.blockers.includes("resource_budget_state_invalid"));
  });
});
