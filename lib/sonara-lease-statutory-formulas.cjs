// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Research-grounded draft calculators. NOT legal advice or a determination of
// compliance, refund amount, payable interest, or lease enforceability.
// All decision inputs must come from independently verified owner/property
// evidence and current qualified jurisdiction-specific legal review.
const REG_M_THRESHOLD_2026_CENTS = 7340000n; // CFPB 12 CFR 1013.2(e) for Jan-Dec 2026
const OHIO_STATUTORY_RATE_NUMERATOR = 5n;
const HUNDRED = 100n;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function nonnegativeMoney(input, label) {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0) {
    throw new Error("invalid_" + label);
  }
  return BigInt(input);
}
function centsWithinSafe(n) {
  if (n < 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("minor_units_overflow");
  }
  return Number(n);
}

// Ohio Revised Code 5321.16(A): interest on the portion of a deposit above
// the GREATER of $50 and one month's periodic rent when the tenant remains in
// possession six months or longer; 5% per annum, computed and paid annually.
// This outputs an *annualized informational estimate*, NOT accrued/due interest.
// It deliberately does not guess rent frequency conversion, pro-ration of
// partial years, intervening rent changes, deposit changes or legal exceptions.
function ohioDepositAnnualInterestBasis({
  propertyState, propertyLocationVerified, securityDepositCents,
  oneMonthsPeriodicRentCents, possessionAtLeastSixMonths,
  monthlyRentAmountVerified, currentRuleReviewRecorded
} = {}) {
  const blockers = [];
  if (propertyState !== "OH" || propertyLocationVerified !== true) blockers.push("ohio_property_not_verified");
  if (monthlyRentAmountVerified !== true) blockers.push("monthly_rent_basis_unverified");
  if (currentRuleReviewRecorded !== true) blockers.push("current_rule_review_missing");
  let deposit, monthRent;
  try {
    deposit = nonnegativeMoney(securityDepositCents, "security_deposit_cents");
    monthRent = nonnegativeMoney(oneMonthsPeriodicRentCents, "one_months_periodic_rent_cents");
  } catch {
    blockers.push("invalid_money_input");
  }
  if (typeof possessionAtLeastSixMonths !== "boolean") blockers.push("possession_duration_unverified");
  if (blockers.length > 0) return Object.freeze({
    status: "blocked_pending_review", blockers: Object.freeze(blockers),
    thresholdCents: null, excessDepositCents: null,
    indicativeAnnualInterestCents: null, actuallyDueCents: null,
    paymentAuthorized: false, statutoryInterpretationCertified: false
  });
  const threshold = monthRent > 5000n ? monthRent : 5000n;
  const excess = deposit > threshold ? deposit - threshold : 0n;
  // Half-up to cents, *only* for annual informational projection. Counsel/
  // accounting must approve interest computation and any payment to tenants.
  const annualInterest = possessionAtLeastSixMonths
    ? (excess * OHIO_STATUTORY_RATE_NUMERATOR + HUNDRED / 2n) / HUNDRED : 0n;
  return Object.freeze({
    status: "draft_annual_basis_only", blockers: Object.freeze([]),
    thresholdCents: centsWithinSafe(threshold),
    excessDepositCents: centsWithinSafe(excess),
    indicativeAnnualInterestCents: centsWithinSafe(annualInterest),
    possessionQualificationSupplied: possessionAtLeastSixMonths,
    actuallyDueCents: null, paymentAuthorized: false,
    annualPaymentAndProRationNeedReview: true, statutoryInterpretationCertified: false
  });
}

// CFPB 12 CFR 1013.2(e) defines a covered consumer lease generally as use of
// personal property by a natural person primarily for personal/family/household
// purposes, for >4 months, with total contractual obligation not exceeding
// the indexed threshold ($73,400 during 2026).
// Outputs ONLY classification for a human legal review, not a legal exemption.
function regulationMApplicabilityDraft({
  calendarYear, naturalPerson, householdPurpose, personalProperty,
  termMonths, totalContractualObligationCents, termsDurationVerified,
  totalObligationVerified
} = {}) {
  const blockers = [];
  if (calendarYear !== 2026) blockers.push("regulation_m_threshold_year_requires_update");
  if (typeof naturalPerson !== "boolean" || typeof householdPurpose !== "boolean" ||
      typeof personalProperty !== "boolean") blockers.push("purpose_or_person_classification_unverified");
  if (termsDurationVerified !== true || !Number.isSafeInteger(termMonths) || termMonths < 0) {
    blockers.push("term_duration_unverified");
  }
  if (totalObligationVerified !== true ||
      typeof totalContractualObligationCents !== "number" ||
      !Number.isSafeInteger(totalContractualObligationCents) ||
      totalContractualObligationCents < 0) {
    blockers.push("total_contractual_obligation_unverified");
  }
  if (blockers.length) return Object.freeze({
    status: "blocked_pending_review", blockers: Object.freeze(blockers),
    likelyWithinRegulationMDefinition: null, requiresQualifiedLegalReview: true,
    disclosureApproved: false, thresholdCents: null
  });
  const potentiallyCovered = naturalPerson && householdPurpose && personalProperty &&
    termMonths > 4 && BigInt(totalContractualObligationCents) <= REG_M_THRESHOLD_2026_CENTS;
  return Object.freeze({
    status: potentiallyCovered ? "potentially_covered_require_reg_m_disclosures_review"
      : "not_within_checked_reg_m_definition_other_rules_still_apply",
    blockers: Object.freeze([]), likelyWithinRegulationMDefinition: potentiallyCovered,
    thresholdCents: Number(REG_M_THRESHOLD_2026_CENTS),
    requiresQualifiedLegalReview: true, disclosureApproved: false,
    legalExemptionProven: false
  });
}

// FTC: A consumer-report-influenced adverse housing action can include a
// rejected application, higher deposit/rent or required co-signer.
// This validates *evidence collection*, not legal adequacy or actual delivery.
const ADVERSE_ACTIONS = Object.freeze([
  "application_denied", "renewal_denied", "higher_deposit_required",
  "higher_rent_required", "cosigner_required", "other_unfavorable_terms"
]);
function tenantScreeningNoticeEvidence({
  organizationId, applicantId, usesConsumerReport,
  adverseAction, humanReviewerId, reportVendor,
  notice, consumerReportPermissiblePurposeVerified
} = {}) {
  const blockers = [];
  const requireCheck = (ok, code) => { if (!ok) blockers.push(code); };
  requireCheck(typeof organizationId === "string" && UUID.test(organizationId),
    "tenant_scope_missing");
  requireCheck(typeof applicantId === "string" && UUID.test(applicantId),
    "applicant_identity_unverified");
  requireCheck(typeof usesConsumerReport === "boolean", "consumer_report_influence_unverified");
  requireCheck(ADVERSE_ACTIONS.includes(adverseAction), "adverse_action_type_unverified");
  requireCheck(typeof humanReviewerId === "string" && UUID.test(humanReviewerId),
    "human_reviewer_missing");
  // Unknown consumer-report influence is not a free pass. For a known report,
  // require purpose before accepting screening evidence, independent of result.
  if (usesConsumerReport === true) {
    requireCheck(consumerReportPermissiblePurposeVerified === true, "fcra_permissible_purpose_missing");
    requireCheck(typeof reportVendor?.name === "string" && reportVendor.name.trim().length > 0 &&
      typeof reportVendor?.address === "string" && reportVendor.address.trim().length > 5 &&
      typeof reportVendor?.phone === "string" && reportVendor.phone.trim().length > 5,
      "consumer_reporting_agency_contact_missing");
    requireCheck(notice?.craDidNotMakeDecisionDisclosed === true, "cra_non_decisionmaker_disclosure_missing");
    requireCheck(notice?.rightToDisputeExplained === true, "consumer_dispute_right_missing");
    requireCheck(notice?.freeCopyWithin60DaysExplained === true, "free_report_60_day_right_missing");
    requireCheck(typeof notice?.templateVersion === "string" && notice.templateVersion.length > 0 &&
      notice?.humanReviewed === true, "adverse_action_notice_template_unreviewed");
    requireCheck(typeof notice?.deliveryMethod === "string" &&
      ["paper", "electronic", "oral_with_record"].includes(notice.deliveryMethod),
      "adverse_action_notice_delivery_unverified");
  }
  return Object.freeze({
    status: blockers.length ? "blocked_pending_review" : "draft_notice_evidence_ready",
    blockers: Object.freeze(blockers), requiresFCRANoticeWhenReportInfluences: usesConsumerReport === true,
    adverseActionAuthorized: false, noticeSent: false, screeningCompliant: false
  });
}

module.exports = {
  REG_M_THRESHOLD_2026_CENTS,
  ohioDepositAnnualInterestBasis,
  regulationMApplicabilityDraft,
  ADVERSE_ACTIONS,
  tenantScreeningNoticeEvidence
};