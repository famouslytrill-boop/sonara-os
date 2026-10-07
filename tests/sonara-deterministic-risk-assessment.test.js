// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const {inherentRisk,residualRisk,expectedLossScenario,evidenceFreshness,reviewPriority}=
  require("../lib/sonara-deterministic-risk-assessment.cjs");
describe("deterministic risk assessment",()=>{
  it("uses a transparent 5x5 inherent risk matrix",()=>{
    assert.deepEqual(inherentRisk({likelihood:5,impact:5}).band,"critical");
    assert.equal(inherentRisk({likelihood:2,impact:2}).inherentScore,4);
  });
  it("does not claim the matrix is a predicted probability",()=>{
    assert.equal(inherentRisk({likelihood:3,impact:4}).probabilityClaimed,false);
  });
  it("refuses to apply control effectiveness without current verified evidence",()=>{
    const out=residualRisk({likelihood:4,impact:4,controlEffectivenessBasisPoints:8000,
      controlEvidenceVerified:false,controlEvidenceCurrent:true});
    assert.equal(out.residualScore,null);
    assert.equal(out.residualBand,"unknown");
  });
  it("applies measured control effectiveness conservatively when verified",()=>{
    const out=residualRisk({likelihood:4,impact:4,controlEffectivenessBasisPoints:5000,
      controlEvidenceVerified:true,controlEvidenceCurrent:true});
    assert.equal(out.inherentScore,16);
    assert.equal(out.residualScore,8);
    assert.equal(out.residualBand,"moderate");
  });
  it("never turns a risk calculation into execution authority",()=>{
    assert.equal(residualRisk({likelihood:1,impact:1,controlEffectivenessBasisPoints:10000,
      controlEvidenceVerified:true,controlEvidenceCurrent:true}).decisionAuthorized,false);
  });
  it("calculates scenario expected loss in exact cents with conservative rounding",()=>{
    const out=expectedLossScenario({eventProbabilityBasisPoints:3333,lossAmountCents:10001});
    assert.equal(out.expectedLossCents,3334);
    assert.equal(out.classification,"scenario_expected_value_not_forecast");
  });
  it("does not reserve or move money from expected-loss math",()=>{
    assert.equal(expectedLossScenario({eventProbabilityBasisPoints:5000,lossAmountCents:10000}).paymentReserved,false);
  });
  it("marks old evidence stale rather than silently reusing it",()=>{
    const out=evidenceFreshness({checkedAt:"2026-01-01T00:00:00Z",
      now:"2026-10-07T00:00:00Z",maxAgeDays:90});
    assert.equal(out.current,false);assert.equal(out.state,"stale");
  });
  it("prioritizes sensitive, urgent, broad-impact issues without calling it legal severity",()=>{
    const out=reviewPriority({residualBand:"critical",deadlineHours:3,
      customerImpactCount:1200,dataClassification:"restricted_sensitive_media"});
    assert.equal(out.queue,"urgent");
    assert.equal(out.classification,"triage_priority_not_legal_severity");
    assert.equal(out.automaticAdverseAction,false);
  });
  it("rejects out-of-range likelihood, impact and probability inputs",()=>{
    assert.throws(()=>inherentRisk({likelihood:0,impact:1}),/invalid_likelihood/);
    assert.throws(()=>inherentRisk({likelihood:1,impact:6}),/invalid_impact/);
    assert.throws(()=>expectedLossScenario({eventProbabilityBasisPoints:10001,lossAmountCents:1}),
      /invalid_event_probability_basis_points/);
  });
});
