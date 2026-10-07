// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure governance/evidence evaluators. They do not sign contracts, publish terms,
// charge a customer, cancel a subscription, or make a legal conclusion.
const SHA256 = /^[a-f0-9]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION = /^[A-Za-z0-9._:-]{1,80}$/;
const LOCALE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const INTERVALS = new Set(["weekly", "monthly", "quarterly", "annual", "custom"]);
const VACATED_RULE_MARKER = "ftc_2024_click_to_cancel_amendments";

function instant(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function validTenant(organizationId, serverOrganizationId) {
  return UUID.test(organizationId || "") && organizationId === serverOrganizationId;
}

function termsAcceptanceGate({
  organizationId,
  serverOrganizationId,
  termsVersion,
  termsHash,
  displayedHash,
  acceptedHash,
  displayedAt,
  acceptedAt,
  actorAuthenticated = false,
  actorAuthorizedForOrganization = false,
  affirmativeAction = false,
  precheckedControl = false,
  materialTermsPresented = false,
  receiptStored = false,
  durableCopyAvailable = false,
  locale = "en-US",
  electronicRecordsConsentRequired = false,
  esignAffirmativeConsent = false,
  paperOptionDisclosed = false,
  withdrawalMethodDisclosed = false,
  hardwareSoftwareRequirementsDisclosed = false,
  electronicAccessDemonstrated = false
} = {}) {
  const blockers = [];
  if (!validTenant(organizationId, serverOrganizationId)) blockers.push("tenant_scope_unverified");
  if (!VERSION.test(termsVersion || "")) blockers.push("terms_version_invalid");
  if (!SHA256.test(termsHash || "") || !SHA256.test(displayedHash || "") ||
      !SHA256.test(acceptedHash || "")) blockers.push("terms_snapshot_hash_invalid");
  if (termsHash !== displayedHash || termsHash !== acceptedHash)
    blockers.push("accepted_terms_do_not_match_displayed_snapshot");
  if (!LOCALE.test(locale || "")) blockers.push("terms_locale_invalid");

  const shown = instant(displayedAt);
  const accepted = instant(acceptedAt);
  if (shown === null || accepted === null || accepted < shown)
    blockers.push("terms_acceptance_timeline_invalid");

  if (actorAuthenticated !== true) blockers.push("accepting_actor_not_authenticated");
  if (actorAuthorizedForOrganization !== true) blockers.push("accepting_actor_authority_unverified");
  if (affirmativeAction !== true) blockers.push("affirmative_acceptance_missing");
  if (precheckedControl === true) blockers.push("prechecked_acceptance_not_allowed");
  if (materialTermsPresented !== true) blockers.push("material_terms_presentation_unverified");
  if (receiptStored !== true) blockers.push("acceptance_receipt_not_stored");
  if (durableCopyAvailable !== true) blockers.push("durable_terms_copy_unavailable");

  if (electronicRecordsConsentRequired === true) {
    if (esignAffirmativeConsent !== true) blockers.push("esign_affirmative_consent_missing");
    if (paperOptionDisclosed !== true) blockers.push("paper_record_option_not_disclosed");
    if (withdrawalMethodDisclosed !== true) blockers.push("esign_withdrawal_method_not_disclosed");
    if (hardwareSoftwareRequirementsDisclosed !== true)
      blockers.push("hardware_software_requirements_not_disclosed");
    if (electronicAccessDemonstrated !== true)
      blockers.push("electronic_access_capability_not_demonstrated");
  }

  return Object.freeze({
    state: blockers.length ? "acceptance_blocked" : "acceptance_evidence_ready",
    blockers: Object.freeze([...new Set(blockers)]),
    legalValidityCertified: false,
    contractExecuted: false,
    signatureCreated: false,
    publicationAuthorized: false
  });
}

function subscriptionConsentEvidenceGate({
  priceCents,
  interval,
  trialEndsAt = null,
  consentAt,
  priceDisplayed = false,
  intervalDisplayed = false,
  recurringNatureDisplayed = false,
  trialConversionDisplayed = false,
  cancellationMethodDisplayed = false,
  cancellationMethodOperationallyTested = false,
  expressConsent = false,
  receiptStored = false,
  noDarkPatternAttested = false,
  federalAuthorityAssumed = null
} = {}) {
  const blockers = [];
  if (!Number.isSafeInteger(priceCents) || priceCents < 0)
    blockers.push("subscription_price_invalid");
  if (!INTERVALS.has(interval)) blockers.push("subscription_interval_invalid");
  if (instant(consentAt) === null) blockers.push("subscription_consent_timestamp_invalid");
  if (priceDisplayed !== true) blockers.push("subscription_price_not_presented");
  if (intervalDisplayed !== true) blockers.push("subscription_interval_not_presented");
  if (recurringNatureDisplayed !== true) blockers.push("recurring_nature_not_presented");
  if (trialEndsAt !== null) {
    const end = instant(trialEndsAt);
    const consent = instant(consentAt);
    if (end === null || consent === null || end <= consent) blockers.push("trial_end_invalid");
    if (trialConversionDisplayed !== true) blockers.push("trial_conversion_terms_not_presented");
  }
  if (cancellationMethodDisplayed !== true) blockers.push("cancellation_method_not_presented");
  if (cancellationMethodOperationallyTested !== true)
    blockers.push("cancellation_method_not_operationally_verified");
  if (expressConsent !== true) blockers.push("express_subscription_consent_missing");
  if (receiptStored !== true) blockers.push("subscription_consent_receipt_not_stored");
  if (noDarkPatternAttested !== true) blockers.push("deceptive_or_obstructive_flow_review_missing");

  // The 2024 FTC "click-to-cancel" amendments were vacated by the Eighth Circuit
  // in July 2025. Current authority must come from a versioned jurisdiction
  // registry, not a stale hard-coded rule.
  if (federalAuthorityAssumed === VACATED_RULE_MARKER)
    blockers.push("vacated_rule_must_not_be_used_as_current_authority");

  return Object.freeze({
    state: blockers.length ? "subscription_evidence_blocked" : "subscription_evidence_ready",
    blockers: Object.freeze([...new Set(blockers)]),
    customerCharged: false,
    cancellationExecuted: false,
    legalComplianceCertified: false,
    currentLawMustComeFromVersionedRegistry: true
  });
}

function legalPolicyPublicationGate({
  policySnapshotHash,
  boardApprovedHash,
  sourceRegistryHash,
  sourcesVerifiedCurrent = false,
  jurisdictionSet = [],
  reviewBoardState,
  ownerApproved = false,
  counselReviewRequired = false,
  counselReviewed = false,
  rollbackCopyStored = false,
  effectiveAt
} = {}) {
  const blockers = [];
  if (!SHA256.test(policySnapshotHash || "") || !SHA256.test(boardApprovedHash || ""))
    blockers.push("policy_snapshot_hash_invalid");
  if (policySnapshotHash !== boardApprovedHash)
    blockers.push("review_board_approved_different_policy_snapshot");
  if (!SHA256.test(sourceRegistryHash || "")) blockers.push("source_registry_hash_invalid");
  if (sourcesVerifiedCurrent !== true) blockers.push("legal_sources_not_currently_verified");
  if (!Array.isArray(jurisdictionSet) || jurisdictionSet.length === 0 ||
      jurisdictionSet.some(x => typeof x !== "string" || !x.trim()))
    blockers.push("jurisdiction_scope_missing");
  if (reviewBoardState !== "approval_evidence_ready") blockers.push("review_board_evidence_missing");
  if (ownerApproved !== true) blockers.push("owner_policy_approval_missing");
  if (counselReviewRequired === true && counselReviewed !== true)
    blockers.push("required_counsel_review_missing");
  if (rollbackCopyStored !== true) blockers.push("prior_policy_rollback_copy_missing");
  if (instant(effectiveAt) === null) blockers.push("policy_effective_time_invalid");

  return Object.freeze({
    state: blockers.length ? "policy_publication_blocked" : "policy_release_evidence_ready",
    blockers: Object.freeze([...new Set(blockers)]),
    policyPublished: false,
    legalValidityCertified: false,
    counselReviewed: counselReviewed === true
  });
}

module.exports = {
  VACATED_RULE_MARKER,
  termsAcceptanceGate,
  subscriptionConsentEvidenceGate,
  legalPolicyPublicationGate
};
