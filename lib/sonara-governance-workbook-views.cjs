// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

// Spreadsheet/reporting projections of already-decided governance evidence.
// These produce plain values only: no macros, eval, external links, or Excel
// formula strings. They do not calculate authority or execute workflow actions.
const SHEETS=Object.freeze({
  risk_register:Object.freeze(["risk_ref","inherent_score","inherent_band","residual_score","residual_band","evidence_state","review_due_at"]),
  approval_board:Object.freeze(["request_ref","risk_class","state","valid_approvals","required_approvals","expires_at","blockers"]),
  proof_register:Object.freeze(["claim_ref","verification_tier","coverage_basis_points","verified_evidence_count","missing_evidence","state"]),
  customer_reviews:Object.freeze(["review_ref","sentiment","author_state","publication_state","relationship_disclosure_required","blockers"]),
  automations:Object.freeze(["automation_ref","skill_key","trigger","execution_mode","runs_today","daily_limit","active_runs","concurrency_limit","state"]),
  rate_budgets:Object.freeze(["subject_ref","operation","available_units","capacity_units","cost_units","retry_after_seconds","state"])
});
function cleanText(v,max=240){return String(v??"").slice(0,max);}
function row(sheet,data={}){
  const cols=SHEETS[sheet];
  if(!cols)throw new Error("unknown_governance_sheet");
  const out=Object.create(null);
  for(const key of cols){
    const value=data[key];
    if(Array.isArray(value))out[key]=value.map(x=>cleanText(x,120)).join(" | ");
    else if(value===null||value===undefined)out[key]=null;
    else if(typeof value==="number"||typeof value==="boolean")out[key]=value;
    else out[key]=cleanText(value);
  }
  return Object.freeze(out);
}
function workbookManifest(){
  return Object.freeze(Object.entries(SHEETS).map(([sheet,columns])=>Object.freeze({
    sheet,columns:Object.freeze([...columns]),executableFormulas:false,
    macrosAllowed:false,externalLinksAllowed:false
  })));
}
function riskWorkbookRow({riskRef,inherent,residual,reviewDueAt=null}={}){
  return row("risk_register",{risk_ref:riskRef,
    inherent_score:inherent?.inherentScore,inherent_band:inherent?.band,
    residual_score:residual?.residualScore,residual_band:residual?.residualBand,
    evidence_state:residual?.controlEffectivenessApplied===true?"verified_controls_applied":"control_evidence_unknown",
    review_due_at:reviewDueAt});
}
function approvalWorkbookRow({requestRef,riskClass,decision,expiresAt}={}){
  return row("approval_board",{request_ref:requestRef,risk_class:riskClass,
    state:decision?.state,valid_approvals:decision?.validApprovalCount,
    required_approvals:decision?.plan?.requiredDistinctApprovals,
    expires_at:expiresAt,blockers:decision?.blockers||[]});
}
function proofWorkbookRow({claimRef,packet}={}){
  return row("proof_register",{claim_ref:claimRef,verification_tier:packet?.verificationTier,
    coverage_basis_points:packet?.requiredCoverageBasisPoints,
    verified_evidence_count:packet?.verifiedEvidenceCount,
    missing_evidence:packet?.requiredMissing||[],state:packet?.state});
}
function reviewWorkbookRow({reviewRef,sentiment,gate}={}){
  return row("customer_reviews",{review_ref:reviewRef,sentiment,
    author_state:gate?.authorState,publication_state:gate?.state,
    relationship_disclosure_required:(gate?.requiredDisclosures||[]).includes("material_reviewer_relationship"),
    blockers:gate?.blockers||[]});
}
module.exports={SHEETS,row,workbookManifest,riskWorkbookRow,approvalWorkbookRow,proofWorkbookRow,reviewWorkbookRow};
