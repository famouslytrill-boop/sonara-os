// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const {
  RULESET_VERSION, reviewTicket, contentPublicationPreflight,
  legalDocumentDraftGate, unauthorizedAutonomyGate
} = require("../lib/sonara-content-compliance-engine.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const FOREIGN = "22222222-2222-4222-8222-222222222222";
const validCase = (o = {}) => ({
  kind: "nonconsensual_intimate_image_notice", organizationId: ORG,
  authenticatedOrganizationId: ORG,
  receivedAt: "2026-10-07T05:00:00Z", now: "2026-10-07T06:00:00Z",
  sourceRef: "notice_1", ...o
});
const validAsset = (o = {}) => ({
  organizationId: ORG, authenticatedOrganizationId: ORG,
  inputClass: "ai_generated", sha256: "a".repeat(64),
  rightsEvidenceRecorded: true, modelTermsReviewed: true, modelIdentifier: "model_abc",
  ...o
});
const validDraft = (o = {}) => ({
  organizationId: ORG, authenticatedOrganizationId: ORG,
  documentKind: "saas_terms", jurisdictionEvidenceRecorded: true,
  currentRuleVersionApproved: true, counselScopeVerified: true,
  customerActorAuthorityVerified: true, disclosureReady: true, ...o
});
describe("deterministic legal and content review gates", () => {
  it("records an explicit ruleset version", () => {
    assert.equal(RULESET_VERSION, "2026-10-07.1");
  });
  it("treats nonconsensual-intimate-image notices as urgent human review", () => {
    const out = reviewTicket(validCase());
    assert.equal(out.priority, "urgent");
    assert.equal(out.state, "human_review_required");
    assert.equal(out.deadlineUtc, null);
    assert.equal(out.platformRemovalExecuted, false);
  });
  it("does not apply statutory deadline before covered-platform and valid-notice findings", () => {
    for (const updates of [
      { tidaCoveredPlatformDetermined: true },
      { tidaNoticeValidConfirmed: true },
      { evidenceIndependentlyVerified: true }
    ]) {
      assert.equal(reviewTicket(validCase(updates)).deadlineUtc, null);
    }
  });
  it("calculates 48h from confirmed valid receipt, not report upload time", () => {
    const out = reviewTicket(validCase({
      tidaCoveredPlatformDetermined: true,
      tidaNoticeValidConfirmed: true, evidenceIndependentlyVerified: true,
      validNoticeReceivedAt: "2026-10-07T05:30:00Z"
    }));
    assert.equal(out.deadlineUtc, "2026-10-09T05:30:00.000Z");
    assert.equal(out.deadlineBasis, "validated_tida_48h");
    assert.equal(out.legalObligationDetermined, false);
  });
  it("rejects forged future validation timestamps", () => {
    const out = reviewTicket(validCase({
      tidaCoveredPlatformDetermined: true,
      tidaNoticeValidConfirmed: true, evidenceIndependentlyVerified: true,
      validNoticeReceivedAt: "2026-10-09T05:30:00Z"
    }));
    assert.ok(out.blockers.includes("valid_tida_notice_receipt_timestamp_unverified"));
    assert.equal(out.deadlineUtc, null);
  });
  it("blocks cross-tenant abuse report access", () => {
    assert.ok(reviewTicket(validCase({authenticatedOrganizationId: FOREIGN}))
      .blockers.includes("tenant_scope_unverified"));
  });
  it("ignores arbitrary user severity flags", () => {
    const result = reviewTicket(validCase({
      kind: "other", clientReportedSeverity: "critical"
    }));
    assert.equal(result.priority, "normal");
    assert.equal(result.arbitrarySeverityIgnored, true);
  });
  it("rejects invalid and future intake timestamps", () => {
    for (const time of ["tomorrow", "2026-10-10T00:00:00Z", ""]) {
      assert.ok(reviewTicket(validCase({receivedAt:time})).blockers.includes("invalid_or_future_event_time"));
    }
  });
  it("routes AI creation to review, not proof of copyright or publishing", () => {
    const out = contentPublicationPreflight(validAsset({proposedAction: "publish",
      safetyHumanReviewerRecorded:true,provenanceSignerVerified:true}));
    assert.equal(out.reviewState,"review_ready");
    assert.equal(out.publicationAuthorized,false);
    assert.equal(out.c2paSignatureCreated,false);
    assert.equal(out.copyrightOwnershipCertified,false);
    assert.equal(out.aiGeneratedDisclosureSuggested,true);
  });
  it("does not publish an asset merely because a model generated it", () => {
    const out = contentPublicationPreflight(validAsset({
      proposedAction:"publish",safetyHumanReviewerRecorded:false
    }));
    assert.ok(out.blockers.includes("publication_human_review_required"));
  });
  it("holds disputed content for rights/safety review", () => {
    const out = contentPublicationPreflight(validAsset({
      unresolvedAbuseOrCopyrightReport:true, rightsEvidenceRecorded:false
    }));
    assert.ok(out.blockers.includes("pending_abuse_or_copyright_review"));
    assert.ok(out.blockers.includes("rights_provenance_not_documented"));
  });
  it("needs separate consent for third-party voice or likeness", () => {
    const out = contentPublicationPreflight(validAsset({
      externalLikenessOrVoice:true, likenessConsentEvidenceRecorded:false
    }));
    assert.ok(out.blockers.includes("likeness_consent_unverified"));
  });
  it("does not accept AI generation without model/source record", () => {
    const out = contentPublicationPreflight(validAsset({modelIdentifier:null}));
    assert.ok(out.blockers.includes("model_provenance_or_terms_unverified"));
  });
  it("blocks cross-tenant publication requests", () => {
    assert.ok(contentPublicationPreflight(validAsset({authenticatedOrganizationId:FOREIGN}))
      .blockers.includes("tenant_scope_unverified"));
  });
  it("only proposes legal drafts even with every evidence input", () => {
    const out = legalDocumentDraftGate(validDraft());
    assert.equal(out.status, "draft_review_ready");
    assert.equal(out.signatureCaptured, false);
    assert.equal(out.bindingEffectClaimed, false);
  });
  it("blocks attempted legal execution from the draft gate", () => {
    const out = legalDocumentDraftGate(validDraft({action:"sign"}));
    assert.ok(out.blockers.includes("binding_legal_action_not_authorized"));
    assert.equal(out.signatureCaptured, false);
  });
  it("rejects missing jurisdiction and counsel evidence", () => {
    const out = legalDocumentDraftGate(validDraft({
      jurisdictionEvidenceRecorded:false, counselScopeVerified:false
    }));
    assert.ok(out.blockers.includes("jurisdiction_unverified"));
    assert.ok(out.blockers.includes("legal_reviewer_scope_missing"));
  });
  it("blocks any autonomy for lease signing, custody, tenant denial or legal advice", () => {
    for (const operation of ["legal_advice", "lease_execution", "tenant_rejection", "release_customer_funds"]) {
      assert.equal(unauthorizedAutonomyGate(operation).allowed, false);
    }
  });
});
