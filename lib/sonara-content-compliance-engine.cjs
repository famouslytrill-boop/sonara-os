// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic / draft-only content and legal workflow policy. It evaluates
// evidence and routes cases to human reviewers. It NEVER determines legal
// compliance, performs takedowns, signs contracts, or automatically publishes.
// Every "verified" input must be re-derived server-side from tenant-scoped,
// authenticated evidence, not caller booleans or an AI model's assertions.
const RULESET_VERSION = "2026-10-07.1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const INPUT_CLASSES = Object.freeze([
  "human_authored", "ai_assisted", "ai_generated", "mixed_human_ai"
]);
const CASE_KINDS = Object.freeze([
  "nonconsensual_intimate_image_notice", "copyright_claim", "impersonation",
  "fraudulent_payment_link", "unlicensed_appearance_or_voice",
  "customer_data_exposure", "rental_discrimination_report",
  "subscription_billing_complaint", "other"
]);
const NEVER_AUTOMATE = Object.freeze([
  "legal_advice", "final_legal_opinion", "lease_execution", "tenant_rejection",
  "release_customer_funds", "punitive_content_decision", "copyright_ownership_certification"
]);
const HOUR_MS = 3600000;
function utc(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}
function scoped(organizationId, authenticatedOrganizationId) {
  return typeof organizationId === "string" && UUID.test(organizationId) &&
    organizationId === authenticatedOrganizationId;
}
function reviewTicket({
  kind, organizationId, authenticatedOrganizationId, receivedAt,
  now, sourceRef, clientReportedSeverity, evidenceIndependentlyVerified = false,
  tidaCoveredPlatformDetermined = false, tidaNoticeValidConfirmed = false,
  validNoticeReceivedAt
} = {}) {
  const blockers = [];
  if (!scoped(organizationId, authenticatedOrganizationId)) blockers.push("tenant_scope_unverified");
  if (!CASE_KINDS.includes(kind)) blockers.push("unknown_case_type");
  const started = utc(receivedAt);
  const current = utc(now);
  if (started === null || current === null || started > current) blockers.push("invalid_or_future_event_time");
  if (typeof sourceRef !== "string" || !/^[A-Za-z0-9._:-]{3,160}$/.test(sourceRef)) blockers.push("event_source_reference_invalid");
  const urgent = kind === "nonconsensual_intimate_image_notice" ||
    kind === "customer_data_exposure" || kind === "rental_discrimination_report";
  const category = kind === "nonconsensual_intimate_image_notice" ? "tida_candidate" :
    kind === "copyright_claim" ? "copyright_notice" : urgent ? "sensitive_customer_harm" : "general";
  const arbitrarySeverityIgnored = clientReportedSeverity !== undefined;
  let deadlineUtc = null;
  let deadlineBasis = null;
  if (kind === "nonconsensual_intimate_image_notice" &&
      tidaCoveredPlatformDetermined === true && tidaNoticeValidConfirmed === true &&
      evidenceIndependentlyVerified === true) {
    const notice = utc(validNoticeReceivedAt);
    if (notice === null || started === null || notice < started ||
        current === null || notice > current) {
      blockers.push("valid_tida_notice_receipt_timestamp_unverified");
    } else {
      // TAKE IT DOWN Act §3: 48 hours from receipt of a valid request.
      // Applicability and validity must be determined by authorized reviewers.
      deadlineUtc = new Date(notice + 48 * HOUR_MS).toISOString();
      deadlineBasis = "validated_tida_48h";
    }
  }
  return Object.freeze({
    rulesetVersion: RULESET_VERSION,
    state: blockers.length ? "requires_intake_correction" : "human_review_required",
    blockers: Object.freeze(blockers),
    priority: urgent ? "urgent" : "normal",
    category, arbitrarySeverityIgnored,
    deadlineUtc, deadlineBasis,
    recommendedInternalReviewHours: urgent ? 4 : 24, // internal target, NOT law
    platformRemovalExecuted: false, contentDisabled: false,
    legalObligationDetermined: false, signedNoticeVerified: false
  });
}
function contentPublicationPreflight({
  organizationId, authenticatedOrganizationId,
  inputClass, sha256, rightsEvidenceRecorded = false,
  modelTermsReviewed = false, modelIdentifier,
  externalLikenessOrVoice = false, likenessConsentEvidenceRecorded = false,
  unresolvedAbuseOrCopyrightReport = false,
  safetyHumanReviewerRecorded = false,
  provenanceSignerVerified = false,
  proposedAction = "draft"
} = {}) {
  const blockers = [];
  if (!scoped(organizationId, authenticatedOrganizationId)) blockers.push("tenant_scope_unverified");
  if (!INPUT_CLASSES.includes(inputClass)) blockers.push("unknown_media_provenance");
  if (!SHA256.test(sha256 || "")) blockers.push("asset_hash_unverified");
  const generated = inputClass === "ai_generated" || inputClass === "ai_assisted" || inputClass === "mixed_human_ai";
  if (!rightsEvidenceRecorded) blockers.push("rights_provenance_not_documented");
  if (generated && (!modelTermsReviewed || typeof modelIdentifier !== "string" ||
      !/^[A-Za-z0-9._:-]{3,160}$/.test(modelIdentifier))) blockers.push("model_provenance_or_terms_unverified");
  if (externalLikenessOrVoice && !likenessConsentEvidenceRecorded) blockers.push("likeness_consent_unverified");
  if (unresolvedAbuseOrCopyrightReport) blockers.push("pending_abuse_or_copyright_review");
  if (proposedAction !== "draft" && proposedAction !== "review" && proposedAction !== "publish") blockers.push("unsupported_publication_action");
  if (proposedAction === "publish") {
    if (!safetyHumanReviewerRecorded) blockers.push("publication_human_review_required");
    if (!provenanceSignerVerified) blockers.push("trusted_provenance_not_established");
    // Evidence gating may support a future approved executor. This evaluator
    // never publishes; the actual action requires an authenticated server-only
    // endpoint and durable human-approval workflow.
  }
  return Object.freeze({
    rulesetVersion: RULESET_VERSION, inputClass,
    reviewState: blockers.length ? "hold_for_review" : "review_ready",
    blockers: Object.freeze(blockers),
    hashType: "sha256", copyrightOwnershipCertified: false,
    c2paSignatureCreated: false, contentProvenanceVerified: false,
    publicationAuthorized: false, aiGeneratedDisclosureSuggested: generated,
    humanRightsAndSafetyReviewRequired: true
  });
}
function legalDocumentDraftGate({
  organizationId, authenticatedOrganizationId,
  documentKind, jurisdictionEvidenceRecorded = false,
  currentRuleVersionApproved = false,
  counselScopeVerified = false, customerActorAuthorityVerified = false,
  disclosureReady = false, action = "draft"
} = {}) {
  const blockers = [];
  if (!scoped(organizationId, authenticatedOrganizationId)) blockers.push("tenant_scope_unverified");
  if (!["saas_terms", "creator_license", "commercial_lease", "residential_lease",
    "equipment_lease", "privacy_disclosure", "customer_invoice"].includes(documentKind)) blockers.push("unknown_document_kind");
  if (!jurisdictionEvidenceRecorded) blockers.push("jurisdiction_unverified");
  if (!currentRuleVersionApproved) blockers.push("legal_rule_version_unreviewed");
  if (!customerActorAuthorityVerified) blockers.push("actor_authority_unverified");
  if (!disclosureReady) blockers.push("mandatory_disclosures_not_checked");
  if (!counselScopeVerified) blockers.push("legal_reviewer_scope_missing");
  if (action !== "draft") blockers.push("binding_legal_action_not_authorized");
  return Object.freeze({
    rulesetVersion: RULESET_VERSION,
    status: blockers.length ? "blocked_pending_review" : "draft_review_ready",
    blockers: Object.freeze(blockers),
    bindingEffectClaimed: false, signatureCaptured: false,
    legalAdviceProvided: false, automaticLegalCompliance: false
  });
}
function unauthorizedAutonomyGate(operation) {
  return Object.freeze({
    operation, allowed: false, reason: NEVER_AUTOMATE.includes(operation) ?
      "requires_lawful_human_authority_and_separate_execution_plane" :
      "no_execution_authority_in_deterministic_review_engine"
  });
}
module.exports = {
  RULESET_VERSION, CASE_KINDS, INPUT_CLASSES,
  reviewTicket, contentPublicationPreflight, legalDocumentDraftGate,
  unauthorizedAutonomyGate
};
