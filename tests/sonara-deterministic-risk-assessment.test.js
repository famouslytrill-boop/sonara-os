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

const {
  VACATED_RULE_MARKER,
  termsAcceptanceGate,
  subscriptionConsentEvidenceGate,
  legalPolicyPublicationGate
}=require("../lib/sonara-terms-and-policy-governance.cjs");
const {
  licenseIntakeGate,
  distributionLicenseGate,
  aiAssetRightsGate
}=require("../lib/sonara-license-compliance.cjs");
const {
  evidenceWeightedCoverage,
  polygonDoubleArea,
  rectangleOverlapBps,
  withinRadiusSquared,
  spatialSecurityGate
}=require("../lib/sonara-security-geometry-formulas.cjs");

describe("legal/license/security/geometry convergence",()=>{
  const ORG="11111111-1111-4111-8111-111111111111";
  const H="a".repeat(64), S="b".repeat(64);
  it("binds accepted terms to the exact displayed snapshot",()=>{
    const out=termsAcceptanceGate({
      organizationId:ORG,serverOrganizationId:ORG,termsVersion:"2026.10.07",
      termsHash:H,displayedHash:H,acceptedHash:H,
      displayedAt:"2026-10-07T12:00:00Z",acceptedAt:"2026-10-07T12:01:00Z",
      actorAuthenticated:true,actorAuthorizedForOrganization:true,affirmativeAction:true,
      materialTermsPresented:true,receiptStored:true,durableCopyAvailable:true
    });
    assert.equal(out.state,"acceptance_evidence_ready");
    const changed=termsAcceptanceGate({
      organizationId:ORG,serverOrganizationId:ORG,termsVersion:"2026.10.07",
      termsHash:H,displayedHash:H,acceptedHash:S,
      displayedAt:"2026-10-07T12:00:00Z",acceptedAt:"2026-10-07T12:01:00Z",
      actorAuthenticated:true,actorAuthorizedForOrganization:true,affirmativeAction:true,
      materialTermsPresented:true,receiptStored:true,durableCopyAvailable:true
    });
    assert.ok(changed.blockers.includes("accepted_terms_do_not_match_displayed_snapshot"));
  });
  it("requires the E-SIGN evidence set only when the transaction requires it",()=>{
    const out=termsAcceptanceGate({
      organizationId:ORG,serverOrganizationId:ORG,termsVersion:"v1",
      termsHash:H,displayedHash:H,acceptedHash:H,
      displayedAt:"2026-10-07T12:00:00Z",acceptedAt:"2026-10-07T12:01:00Z",
      actorAuthenticated:true,actorAuthorizedForOrganization:true,affirmativeAction:true,
      materialTermsPresented:true,receiptStored:true,durableCopyAvailable:true,
      electronicRecordsConsentRequired:true,esignAffirmativeConsent:true,
      paperOptionDisclosed:true,withdrawalMethodDisclosed:true,
      hardwareSoftwareRequirementsDisclosed:true,electronicAccessDemonstrated:true
    });
    assert.equal(out.state,"acceptance_evidence_ready");
  });
  it("refuses to treat the vacated 2024 FTC amendments as current authority",()=>{
    const out=subscriptionConsentEvidenceGate({
      priceCents:2900,interval:"monthly",consentAt:"2026-10-07T12:00:00Z",
      priceDisplayed:true,intervalDisplayed:true,recurringNatureDisplayed:true,
      cancellationMethodDisplayed:true,cancellationMethodOperationallyTested:true,
      expressConsent:true,receiptStored:true,noDarkPatternAttested:true,
      federalAuthorityAssumed:VACATED_RULE_MARKER
    });
    assert.ok(out.blockers.includes("vacated_rule_must_not_be_used_as_current_authority"));
    assert.equal(out.customerCharged,false);
  });
  it("binds legal-policy release evidence to the same board-approved snapshot",()=>{
    const out=legalPolicyPublicationGate({
      policySnapshotHash:H,boardApprovedHash:H,sourceRegistryHash:S,
      sourcesVerifiedCurrent:true,jurisdictionSet:["US","OH"],
      reviewBoardState:"approval_evidence_ready",ownerApproved:true,
      rollbackCopyStored:true,effectiveAt:"2026-10-08T00:00:00Z"
    });
    assert.equal(out.state,"policy_release_evidence_ready");
    assert.equal(out.policyPublished,false);
  });
  it("requires SPDX and obligation evidence for open-source intake",()=>{
    const good=licenseIntakeGate({
      componentName:"example",versionOrDigest:"1.2.3",rightsBasis:"open_source",
      spdxId:"MIT",spdxRegistryVerified:true,licenseTextOrCanonicalUrlRecorded:true,
      reciprocalObligationsReviewed:true,sourceDisclosureObligationReviewed:true,
      patentTermsReviewed:true,commercialUseReviewed:true,modificationReviewed:true,
      redistributionReviewed:true
    });
    assert.equal(good.state,"license_intake_evidence_ready");
    const bad=licenseIntakeGate({
      componentName:"example",versionOrDigest:"1.2.3",rightsBasis:"open_source",
      spdxId:"MIT",commercialUseReviewed:true,modificationReviewed:true,redistributionReviewed:true
    });
    assert.ok(bad.blockers.includes("spdx_registry_match_unverified"));
  });
  it("requires SBOM/notices and fulfilled component obligations before distribution evidence is ready",()=>{
    const out=distributionLicenseGate({
      releaseArtifactHash:H,
      components:[{intakeState:"license_intake_evidence_ready",distributionReviewed:true,obligationsFulfilled:true}],
      sbomGenerated:true,noticesBundleGenerated:true,reciprocalBoundaryVerified:true,
      sourceOfferPlanReviewed:true,customerFacingAttributionReady:true
    });
    assert.equal(out.state,"distribution_license_evidence_ready");
    assert.equal(out.releaseAuthorized,false);
  });
  it("does not treat prompts alone as human authorship evidence",()=>{
    const out=aiAssetRightsGate({
      assetHash:H,inputRightsEvidenceRecorded:true,modelOrProviderTermsReviewed:true,
      modelIdentifier:"provider:model",copyrightClaimRequested:true,
      humanExpressiveContributionRecorded:false,customerPublicationApproved:true
    });
    assert.ok(out.blockers.includes("human_authorship_evidence_missing_for_copyright_claim"));
    assert.equal(out.promptsAloneTreatedAsHumanAuthorship,false);
  });
  it("calculates weighted evidence coverage without claiming probability or certification",()=>{
    const out=evidenceWeightedCoverage([
      {key:"tenant-isolation",weight:5,verified:true,current:true},
      {key:"restore",weight:5,verified:false,current:false}
    ]);
    assert.equal(out.basisPoints,5000);
    assert.deepEqual(out.blockers,["restore"]);
    assert.equal(out.certificationClaimed,false);
  });
  it("uses exact integer shoelace and overlap geometry",()=>{
    let out=polygonDoubleArea([{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}]);
    assert.equal(out.doubleAreaUnits2,"24");
    assert.equal(out.wholeAreaUnits2,"12");
    out=rectangleOverlapBps(
      {minX:0,minY:0,maxX:10,maxY:10},
      {minX:5,minY:0,maxX:15,maxY:10}
    );
    assert.equal(out.overlapOfSmallerBasisPoints,5000);
  });
  it("uses squared radius math and never turns a spatial match into privileged authorization",()=>{
    const radius=withinRadiusSquared({point:{x:3,y:4},center:{x:0,y:0},radiusUnits:5});
    assert.equal(radius.insideOrOnBoundary,true);
    assert.equal(radius.distanceSquaredUnits2,"25");
    const out=spatialSecurityGate({
      geometryMatch:true,coordinateSource:"provider_verified",
      coordinateIntegrityVerified:true,accuracyMeters:2,maxAccuracyMeters:5,
      serverPolicyApproved:true,userPermissionGranted:true,privilegedAction:true
    });
    assert.ok(out.blockers.includes("spatial_signal_cannot_authorize_privileged_action"));
    assert.equal(out.authorizationGranted,false);
  });
});
