// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

// Deterministic risk prioritization, not actuarial/legal truth and not a credit,
// insurance, housing or eligibility decision. Numeric outputs are transparent
// internal prioritization conventions, never predicted probabilities unless an
// explicit measured probability input is separately supplied.
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function safeInt(v,name,min,max){
  if(!Number.isSafeInteger(v)||v<min||v>max)throw new Error("invalid_"+name);
  return v;
}
function inherentRisk({likelihood,impact}={}){
  const l=safeInt(likelihood,"likelihood",1,5);
  const i=safeInt(impact,"impact",1,5);
  const score=l*i;
  const band=score<=4?"low":score<=9?"moderate":score<=16?"high":"critical";
  return Object.freeze({
    likelihood:l,impact:i,inherentScore:score,band,
    probabilityClaimed:false,decisionAuthorized:false
  });
}
function residualRisk({
  likelihood,impact,controlEffectivenessBasisPoints,
  controlEvidenceVerified=false,controlEvidenceCurrent=false
}={}){
  const inherent=inherentRisk({likelihood,impact});
  if(controlEvidenceVerified!==true||controlEvidenceCurrent!==true){
    return Object.freeze({
      ...inherent,residualScore:null,residualBand:"unknown",
      controlEffectivenessApplied:false,
      reason:"control_effectiveness_evidence_unverified"
    });
  }
  const e=safeInt(controlEffectivenessBasisPoints,"control_effectiveness_basis_points",0,10000);
  // Ceiling is conservative: 8.01 stays 9 rather than looking safer as 8.
  const residual=Math.ceil(inherent.inherentScore*(10000-e)/10000);
  const band=residual===0?"minimal":residual<=4?"low":residual<=9?"moderate":residual<=16?"high":"critical";
  return Object.freeze({
    ...inherent,residualScore:residual,residualBand:band,
    controlEffectivenessApplied:true,
    controlEffectivenessBasisPoints:e,
    decisionAuthorized:false
  });
}
function expectedLossScenario({eventProbabilityBasisPoints,lossAmountCents}={}){
  const p=safeInt(eventProbabilityBasisPoints,"event_probability_basis_points",0,10000);
  if(!Number.isSafeInteger(lossAmountCents)||lossAmountCents<0)throw new Error("invalid_loss_amount_cents");
  const loss=BigInt(lossAmountCents);
  const expected=(loss*BigInt(p)+9999n)/10000n;
  if(expected>MAX)throw new Error("risk_amount_overflow");
  return Object.freeze({
    expectedLossCents:Number(expected),
    eventProbabilityBasisPoints:p,lossAmountCents,
    classification:"scenario_expected_value_not_forecast",
    paymentReserved:false
  });
}
function evidenceFreshness({checkedAt,now,maxAgeDays}={}){
  const a=typeof checkedAt==="string"?Date.parse(checkedAt):NaN;
  const b=typeof now==="string"?Date.parse(now):NaN;
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)throw new Error("invalid_evidence_clock");
  const days=safeInt(maxAgeDays,"max_age_days",1,3650);
  const age=Math.floor((b-a)/86400000);
  return Object.freeze({
    ageDays:age,maxAgeDays:days,current:age<=days,
    state:age<=days?"current":"stale"
  });
}
function reviewPriority({
  residualBand,deadlineHours,customerImpactCount=0,dataClassification="tenant_standard"
}={}){
  const base={minimal:0,low:1,moderate:2,high:3,critical:4,unknown:4}[residualBand];
  if(base===undefined)throw new Error("invalid_residual_band");
  if(!Number.isFinite(deadlineHours)||deadlineHours<0)throw new Error("invalid_deadline_hours");
  if(!Number.isSafeInteger(customerImpactCount)||customerImpactCount<0)throw new Error("invalid_customer_impact_count");
  const sensitivity=["restricted_legal","restricted_sensitive_media"].includes(dataClassification)?2:
    dataClassification==="tenant_confidential"?1:0;
  const urgency=deadlineHours<=4?3:deadlineHours<=24?2:deadlineHours<=72?1:0;
  const reach=customerImpactCount>=1000?2:customerImpactCount>=100?1:0;
  const index=Math.min(10,base+sensitivity+urgency+reach);
  const queue=index>=8?"urgent":index>=5?"high":index>=3?"normal":"low";
  return Object.freeze({
    priorityIndex:index,queue,
    classification:"triage_priority_not_legal_severity",
    automaticAdverseAction:false
  });
}
module.exports={inherentRisk,residualRisk,expectedLossScenario,evidenceFreshness,reviewPriority};
