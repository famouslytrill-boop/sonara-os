// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const {
  REG_M_THRESHOLD_2026_CENTS, ohioDepositAnnualInterestBasis,
  regulationMApplicabilityDraft, tenantScreeningNoticeEvidence
} = require("../lib/sonara-lease-statutory-formulas.cjs");
const org = "11111111-1111-4111-8111-111111111111";
const applicant = "22222222-2222-4222-8222-222222222222";
const reviewer = "33333333-3333-4333-8333-333333333333";
function ohio(override = {}) {
  return ohioDepositAnnualInterestBasis({
    propertyState: "OH", propertyLocationVerified: true,
    securityDepositCents: 120000, oneMonthsPeriodicRentCents: 100000,
    monthlyRentAmountVerified: true, possessionAtLeastSixMonths: true,
    currentRuleReviewRecorded: true, ...override
  });
}
function consumerLease(override = {}) {
  return regulationMApplicabilityDraft({
    calendarYear: 2026, naturalPerson: true, householdPurpose: true,
    personalProperty: true, termMonths: 12,
    totalContractualObligationCents: 3000000,
    termsDurationVerified: true, totalObligationVerified: true,
    ...override
  });
}
function reportNotice(override = {}) {
  return tenantScreeningNoticeEvidence({
    organizationId: org, applicantId: applicant,
    usesConsumerReport: true, adverseAction: "higher_deposit_required",
    humanReviewerId: reviewer, consumerReportPermissiblePurposeVerified: true,
    reportVendor: { name: "Example CRA", address: "Example HQ mailing address", phone: "614-555-0100" },
    notice: {
      craDidNotMakeDecisionDisclosed: true,
      rightToDisputeExplained: true, freeCopyWithin60DaysExplained: true,
      templateVersion: "reviewed-v1", humanReviewed: true,
      deliveryMethod: "paper"
    },
    ...override
  });
}
describe("Ohio draft security deposit annual interest basis", () => {
  it("uses greater of $50 and one month's periodic rent", () => {
    const result = ohio();
    assert.equal(result.status, "draft_annual_basis_only");
    assert.equal(result.thresholdCents, 100000);
    assert.equal(result.excessDepositCents, 20000);
    assert.equal(result.indicativeAnnualInterestCents, 1000);
    assert.equal(result.actuallyDueCents, null);
    assert.equal(result.paymentAuthorized, false);
  });
  it("uses $50 floor for low monthly rent", () => {
    const result = ohio({ securityDepositCents: 12000, oneMonthsPeriodicRentCents: 4000 });
    assert.equal(result.thresholdCents, 5000);
    assert.equal(result.excessDepositCents, 7000);
    assert.equal(result.indicativeAnnualInterestCents, 350);
  });
  it("shows zero excess when deposit is under the threshold", () => {
    const result = ohio({ securityDepositCents: 20000 });
    assert.equal(result.indicativeAnnualInterestCents, 0);
    assert.equal(result.excessDepositCents, 0);
  });
  it("requires a verified six-month occupancy qualification", () => {
    assert.equal(ohio({ possessionAtLeastSixMonths: false }).indicativeAnnualInterestCents, 0);
    assert.ok(ohio({ possessionAtLeastSixMonths: "yes" }).blockers.includes("possession_duration_unverified"));
  });
  it("blocks unverified jurisdiction, rent or missing statutory review", () => {
    const result = ohio({ propertyLocationVerified: false, currentRuleReviewRecorded: false });
    assert.ok(result.blockers.includes("ohio_property_not_verified"));
    assert.ok(result.blockers.includes("current_rule_review_missing"));
    assert.equal(result.indicativeAnnualInterestCents, null);
  });
  it("rejects floating money, overflow risk and signed negatives", () => {
    for (const securityDepositCents of [-1, 1.23, "12000"]) {
      assert.ok(ohio({ securityDepositCents }).blockers.includes("invalid_money_input"));
    }
  });
});
describe("2026 CFPB Regulation M consumer personal-property lease applicability", () => {
  it("uses current $73,400 threshold and term longer than four months", () => {
    assert.equal(Number(REG_M_THRESHOLD_2026_CENTS), 7340000);
    const response = consumerLease({ totalContractualObligationCents: 7340000 });
    assert.equal(response.likelyWithinRegulationMDefinition, true);
    assert.equal(response.disclosureApproved, false);
  });
  it("does not automatically apply Regulation M to a 4-month rental", () => {
    const result = consumerLease({ termMonths: 4 });
    assert.equal(result.likelyWithinRegulationMDefinition, false);
    assert.equal(result.legalExemptionProven, false);
  });
  it("flags obligations above 2026's threshold for independent review", () => {
    const result = consumerLease({ totalContractualObligationCents: 7340001 });
    assert.equal(result.likelyWithinRegulationMDefinition, false);
    assert.equal(result.requiresQualifiedLegalReview, true);
  });
  it("does not confuse business-purpose leases with household leases", () => {
    const result = consumerLease({ householdPurpose: false });
    assert.equal(result.likelyWithinRegulationMDefinition, false);
  });
  it("blocks unsupported years until the official threshold is reviewed", () => {
    const result = consumerLease({ calendarYear: 2027 });
    assert.ok(result.blockers.includes("regulation_m_threshold_year_requires_update"));
    assert.equal(result.thresholdCents, null);
  });
  it("blocks missing contractual obligation and purpose evidence", () => {
    const result = consumerLease({ totalObligationVerified: false, householdPurpose: null });
    assert.ok(result.blockers.includes("total_contractual_obligation_unverified"));
    assert.ok(result.blockers.includes("purpose_or_person_classification_unverified"));
  });
});
describe("FTC report-influenced housing adverse action", () => {
  it("treats higher required deposits as report-influenced adverse action", () => {
    const result = reportNotice();
    assert.equal(result.status, "draft_notice_evidence_ready");
    assert.equal(result.requiresFCRANoticeWhenReportInfluences, true);
    assert.equal(result.noticeSent, false);
    assert.equal(result.adverseActionAuthorized, false);
  });
  it("requires required CRA and consumer dispute/free-report rights details", () => {
    const result = reportNotice({ notice: { templateVersion: "v1", humanReviewed: true, deliveryMethod: "paper" } });
    assert.ok(result.blockers.includes("cra_non_decisionmaker_disclosure_missing"));
    assert.ok(result.blockers.includes("consumer_dispute_right_missing"));
    assert.ok(result.blockers.includes("free_report_60_day_right_missing"));
  });
  it("blocks bypassing permissible-purpose and CRA contact requirements", () => {
    const result = reportNotice({ consumerReportPermissiblePurposeVerified: false, reportVendor: {} });
    assert.ok(result.blockers.includes("fcra_permissible_purpose_missing"));
    assert.ok(result.blockers.includes("consumer_reporting_agency_contact_missing"));
  });
  it("never presumes a consumer report was unused when the influence flag is omitted", () => {
    const result = reportNotice({ usesConsumerReport: undefined });
    assert.ok(result.blockers.includes("consumer_report_influence_unverified"));
    assert.equal(result.adverseActionAuthorized, false);
  });
});
