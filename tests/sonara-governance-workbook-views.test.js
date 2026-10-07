// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const {workbookManifest,riskWorkbookRow,approvalWorkbookRow,proofWorkbookRow,reviewWorkbookRow}=
  require("../lib/sonara-governance-workbook-views.cjs");
describe("governance spreadsheet views",()=>{
  it("defines six values-only governance sheets",()=>{
    const m=workbookManifest();
    assert.equal(m.length,6);
    for(const sheet of m){
      assert.equal(sheet.executableFormulas,false);
      assert.equal(sheet.macrosAllowed,false);
      assert.equal(sheet.externalLinksAllowed,false);
    }
  });
  it("projects risk evidence without inventing residual risk",()=>{
    const row=riskWorkbookRow({riskRef:"risk_1",
      inherent:{inherentScore:16,band:"high"},
      residual:{residualScore:null,residualBand:"unknown",controlEffectivenessApplied:false}});
    assert.equal(row.inherent_score,16);
    assert.equal(row.residual_score,null);
    assert.equal(row.evidence_state,"control_evidence_unknown");
  });
  it("projects approval quorum and blockers visibly",()=>{
    const row=approvalWorkbookRow({requestRef:"req_1",riskClass:"financial_change",
      expiresAt:"2026-10-07T07:00:00Z",
      decision:{state:"approval_blocked",validApprovalCount:1,
        plan:{requiredDistinctApprovals:2},blockers:["approval_quorum_not_met"]}});
    assert.equal(row.required_approvals,2);
    assert.match(row.blockers,/approval_quorum_not_met/);
  });
  it("shows proof coverage and missing evidence separately",()=>{
    const row=proofWorkbookRow({claimRef:"claim_1",packet:{
      verificationTier:"attributable",requiredCoverageBasisPoints:5000,
      verifiedEvidenceCount:1,requiredMissing:["provider_event"],state:"evidence_incomplete"}});
    assert.equal(row.coverage_basis_points,5000);
    assert.match(row.missing_evidence,/provider_event/);
  });
  it("shows review author state and moderation blockers without editing customer text",()=>{
    const row=reviewWorkbookRow({reviewRef:"review_1",sentiment:"negative",gate:{
      authorState:"exact_text_author_confirmed",state:"hold_for_review",
      requiredDisclosures:[],blockers:["negative_review_suppression_not_allowed"]}});
    assert.equal(row.sentiment,"negative");
    assert.match(row.blockers,/negative_review_suppression_not_allowed/);
    assert.ok(!("review_text" in row));
  });
});
