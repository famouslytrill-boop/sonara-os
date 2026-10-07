// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Non-executing, fail-closed regulatory preflight. This is a checklist engine,
// not a legal opinion, authorization server, license, or compliance certificate.
// All inputs must come from authenticated, tenant-scoped server reads.
// A passing DRAFT preflight never authorizes signing, denial, payments or eviction.
const CLASSES = Object.freeze([
  "residential_property", "commercial_property", "short_term_lodging",
  "vehicle_lease", "equipment_lease", "equipment_rental", "digital_content_license"
]);
const STOPPED_ACTIONS = Object.freeze([
  "sign", "publish", "accept_payment", "refund", "screen", "deny",
  "terminate", "evict", "repossess", "grant_license", "transfer_deposit"
]);
const DAY = 86400000;
function dateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}
function addDays(date, days) {
  const time = dateOnly(date);
  return time === null ? null : new Date(time + days * DAY).toISOString().slice(0, 10);
}
function isColumbusOhio(location) {
  return location?.verifiedByAuthority === true && location?.country === "US" &&
    location?.state === "OH" && location?.municipality === "Columbus";
}
function isOhio(location) {
  return location?.verifiedByAuthority === true && location?.country === "US" && location?.state === "OH";
}
function riskPreflight({
  transactionClass, location, action = "draft", asOf,
  actor = {}, policy = {}, terms = {}, screening = {}, rights = {}
} = {}) {
  const blockers = [];
  const advisory = [];
  const requireEvidence = (ok, code) => { if (!ok) blockers.push(code); };
  const reviewed = policy?.reviewerRole === "qualified_counsel" &&
    policy?.decision === "approved_for_scope" && policy?.transactionClass === transactionClass &&
    dateOnly(policy?.reviewedOn) !== null && dateOnly(policy?.expiresOn) !== null &&
    dateOnly(policy.reviewedOn) <= dateOnly(asOf) && dateOnly(policy.expiresOn) >= dateOnly(asOf);

  requireEvidence(CLASSES.includes(transactionClass), "unknown_transaction_class");
  requireEvidence(dateOnly(asOf) !== null, "as_of_date_invalid");
  requireEvidence(location?.verifiedByAuthority === true && !!location?.country && !!location?.state, "jurisdiction_unverified");
  requireEvidence(actor?.authorityVerified === true && !!actor?.authorizationReference, "actor_authority_missing");
  requireEvidence(reviewed, "qualified_legal_scope_review_missing_or_expired");
  requireEvidence(terms?.versionApproved === true && !!terms?.termsVersion, "terms_unreviewed");
  requireEvidence(Number.isSafeInteger(terms?.requiredChargesCents) && terms.requiredChargesCents >= 0,
    "required_charges_not_disclosed");
  if (action !== "draft") requireEvidence(false, "non_draft_action_requires_separate_server_authorization");
  if (STOPPED_ACTIONS.includes(action)) advisory.push("owner_approval_and_runtime_evidence_required");

  if (transactionClass === "residential_property") {
    requireEvidence(terms?.fairHousingReview === true, "fair_housing_review_missing");
    if (screening?.usesConsumerReport) {
      requireEvidence(screening?.permissiblePurposeVerified === true, "fcra_permissible_purpose_missing");
      requireEvidence(screening?.consumerReportingAgencyReviewed === true, "screening_vendor_review_missing");
      if (screening?.proposedAdverseAction) {
        requireEvidence(screening?.noticeWorkflowReviewed === true, "fcra_adverse_action_notice_review_missing");
        advisory.push("never_auto_reject_application");
      }
    }
    if (isOhio(location)) {
      advisory.push("ohio_5321_16_deposit_interest_and_return_deduction_review");
      if (terms?.securityDepositCents > 0) {
        requireEvidence(terms?.depositLedgerEnabled === true, "deposit_ledger_missing");
      }
    }
    if (isColumbusOhio(location)) {
      advisory.push("columbus_4551_05_receipts_and_4551_06_third_party_tender_review");
      advisory.push("columbus_4551_071_rent_first_payment_allocation");
      requireEvidence(screening?.sourceOfIncomeNeutral === true, "columbus_source_of_income_review_missing");
      // Columbus Chapter 4515: registration window for 2027 calendar year is
      // October 1 - December 31, 2026, with statutory exemptions.
      if (dateOnly(asOf) !== null && dateOnly(asOf) >= dateOnly("2026-10-01")) {
        advisory.push("columbus_4515_rental_registry_initial_window_2026_10_01_to_2026_12_31");
        requireEvidence(terms?.registryApplicabilityReviewed === true, "columbus_rental_registry_scope_unreviewed");
        if (dateOnly(asOf) >= dateOnly("2027-01-01") && terms?.registryExempt !== true) {
          requireEvidence(terms?.registrationVerified === true, "columbus_rental_registry_registration_unverified");
        }
      }
      if (terms?.securityDepositCents > 0) {
        requireEvidence(Number.isSafeInteger(actor?.rentalUnits) && actor.rentalUnits >= 0,
          "columbus_renter_choice_unit_count_missing");
        if (actor?.rentalUnits >= 5) {
          requireEvidence(terms?.writtenDepositAlternativesDelivered === true &&
            Array.isArray(terms?.depositInstallmentOptions) &&
            terms.depositInstallmentOptions.includes(3) && terms.depositInstallmentOptions.includes(6),
            "columbus_renter_choice_notice_or_options_missing");
        }
      }
      if (terms?.newMonthlyRentCents > 0 && terms?.oldMonthlyRentCents > 0 &&
          Number.isSafeInteger(terms.newMonthlyRentCents) && Number.isSafeInteger(terms.oldMonthlyRentCents) &&
          BigInt(terms.newMonthlyRentCents) * 10n > BigInt(terms.oldMonthlyRentCents) * 11n) {
        advisory.push("columbus_4551_071_60_day_notice_clause_review_for_covered_leases");
      }
    }
  } else if (transactionClass === "vehicle_lease" || transactionClass === "equipment_lease") {
    advisory.push("ohio_1310_article_2a_and_hybrid_lease_classification_review_if_applicable");
    if (terms?.consumerPurpose === true) {
      requireEvidence(terms?.regulationMReviewed === true, "consumer_leasing_regulation_m_review_missing");
    }
  } else if (transactionClass === "short_term_lodging") {
    requireEvidence(terms?.shortTermPermitVerified === true, "short_term_lodging_permit_unverified");
    requireEvidence(terms?.taxCollectionReviewed === true, "lodging_tax_review_missing");
  } else if (transactionClass === "digital_content_license") {
    requireEvidence(rights?.chainOfTitleReviewed === true && rights?.grantScopeVerified === true,
      "media_license_rights_unverified");
    requireEvidence(rights?.sellerIdentityVerified === true, "seller_identity_unverified");
    advisory.push("copyright_dmca_takedown_repeat_infringer_and_revocation_process_review");
  }
  // No pricing cartel, automated screening denial or unilateral legal acts.
  return Object.freeze({
    readyForDraftReview: blockers.length === 0 && action === "draft",
    state: blockers.length ? "blocked_pending_review" : "draft_review_ready",
    actionAuthorized: false, complianceClaim: false,
    blockers: Object.freeze(blockers), advisory: Object.freeze(advisory),
    transactionClass: CLASSES.includes(transactionClass) ? transactionClass : "unknown",
    evaluatedAsOf: dateOnly(asOf) === null ? null : asOf
  });
}

// Ohio Rev. Code 5321.16 deposit-return task reminder, not an autopayment or
// verdict on recoverability, interest, forwarding address, or damages.
function ohioDepositDeadline({ terminationDate, possessionReturnedDate } = {}) {
  const end = dateOnly(terminationDate);
  const possession = dateOnly(possessionReturnedDate);
  if (end === null || possession === null) return { known: false, dueDate: null, reviewRequired: true };
  const later = new Date(Math.max(end, possession)).toISOString().slice(0, 10);
  return { known: true, dueDate: addDays(later, 30), reviewRequired: true };
}
module.exports = {
  CLASSES, STOPPED_ACTIONS, riskPreflight, ohioDepositDeadline, isColumbusOhio
};
