// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const {
  payoutTieout, connectLossExposureDraft, payeeChangeTwoPersonDraft
} = require("../lib/sonara-financial-close-controls.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";
const AUDITOR = "33333333-3333-4333-8333-333333333333";
const ACCOUNT = "acct_1234567890";
const PERIOD = "period:2026-10";
const payout = (override = {}) => ({
  payoutId: "po_1234567890", organizationId: ORG,
  connectedAccountId: ACCOUNT, currency: "USD",
  amountCents: 19000, status: "paid", statementPeriodId: PERIOD, ...override
});
const deposit = (override = {}) => ({
  bankTransactionId: "bank_txn_123456",
  organizationId: ORG, statementPeriodId: PERIOD, currency: "USD",
  amountCents: 19000, status: "posted",
  verifiedLinkedPayoutId: "po_1234567890", ...override
});
const tieout = (overrides = {}) => ({
  organizationId: ORG, connectedAccountId: ACCOUNT, currency: "USD",
  statementPeriodId: PERIOD,
  processorPayouts: [payout()], bankDeposits: [deposit()],
  processorWindowComplete: true, bankWindowComplete: true,
  processorReadVerified: true, bankReadVerified: true,
  bankOwnershipVerified: true, ...overrides
});
const exposure = (overrides = {}) => ({
  connectedAccountId: ACCOUNT,
  providerAccountDetailsReadOnServer: true,
  lossesCollector: "application", feesCollector: "application",
  negativeBalanceCents: 5500, outstandingDisputesCents: 1000,
  financeReviewerConfirmed: true, ...overrides
});
const payeeChange = (overrides = {}) => ({
  organizationId: ORG, requestedBy: OWNER, reviewedBy: AUDITOR,
  requestRef: "req_123", currentAccountRef: "acct_old_ref",
  proposedAccountRef: "acct_new_ref",
  reviewerAuthenticatedIndependently: true,
  verifiedOriginalContactChannel: true,
  recipientIdentityReconfirmed: true,
  reviewedAt: "2026-10-07T13:00:00Z",
  changeWindowExpiresAt: "2026-10-07T15:00:00Z",
  ...overrides
});
describe("independent payout versus bank deposit review controls", () => {
  it("matches a fully linked and complete reference while withholding custody claims", () => {
    const result = payoutTieout(tieout());
    assert.equal(result.status, "records_match_finance_review_required");
    assert.equal(result.matchedGrossCents, 19000);
    assert.equal(result.matchedPayouts, 1);
    assert.equal(result.actualCustodyVerified, false);
    assert.equal(result.paymentInitiated, false);
    assert.equal(result.financeApprovalRequired, true);
  });
  it("refuses partial processor or partial bank windows", () => {
    for (const override of [{ bankWindowComplete: false }, { processorWindowComplete: false },
      { processorReadVerified: false }, { bankReadVerified: false }]) {
      const result = payoutTieout(tieout(override));
      assert.equal(result.status, "incomplete_evidence");
      assert.equal(result.matchedGrossCents, null);
    }
  });
  it("rejects an equal-amount bank credit without an independently linked payout", () => {
    const result = payoutTieout(tieout({
      bankDeposits: [deposit({ verifiedLinkedPayoutId: undefined })]
    }));
    assert.ok(result.issues.includes("bank_credit_missing_unique_verified_payout_link"));
    assert.equal(result.matchedGrossCents, null);
  });
  it("rejects payout amount mismatch and contradictory ownership", () => {
    assert.ok(payoutTieout(tieout({ bankDeposits: [deposit({ amountCents: 18000 })] }))
      .issues.includes("payout_bank_amount_mismatch"));
    const result = payoutTieout(tieout({ processorPayouts: [payout({ organizationId: OWNER })] }));
    assert.ok(result.issues.includes("provider_payout_unsettled_or_scope_mismatch"));
  });
  it("refuses duplicate bank credits or multiple credits linked to one payout", () => {
    const duplicateBank = payoutTieout(tieout({ bankDeposits: [deposit(), deposit()] }));
    assert.ok(duplicateBank.issues.includes("invalid_or_duplicate_bank_credit"));
    const duplicateLink = payoutTieout(tieout({ bankDeposits: [deposit(), deposit({ bankTransactionId: "bank_txn_other" })] }));
    assert.ok(duplicateLink.issues.includes("bank_credit_missing_unique_verified_payout_link"));
  });
  it("distinguishes not-yet-paid processor payout from settled money", () => {
    const result = payoutTieout(tieout({ processorPayouts: [payout({ status: "pending" })] }));
    assert.ok(result.issues.includes("provider_payout_unsettled_or_scope_mismatch"));
  });
  it("treats bank credits not linked to a known payout as exceptions", () => {
    const result = payoutTieout(tieout({ processorPayouts: [] }));
    assert.ok(result.issues.includes("bank_credit_without_known_processor_payout"));
  });
  it("allows a complete verified no-activity window but never claims actual bank balance", () => {
    const result = payoutTieout(tieout({ processorPayouts: [], bankDeposits: [] }));
    assert.equal(result.matchedGrossCents, 0);
    assert.equal(result.actualCustodyVerified, false);
  });
});
describe("actual Stripe connected-account liability must be reviewed", () => {
  it("marks SONARA's risk when platform controls negative-balance responsibility", () => {
    const result = connectLossExposureDraft(exposure());
    assert.equal(result.connectedAccountNegativeBalanceRiskBearer, "sonara_platform");
    assert.equal(result.platformReserveExposurePossible, true);
    assert.equal(result.totalPotentialLiabilityCents, null);
    assert.equal(result.accountConfigurationChanged, false);
  });
  it("does not infer platform loss responsibility from direct charge alone", () => {
    const result = connectLossExposureDraft(exposure({ lossesCollector: "stripe", feesCollector: "stripe" }));
    assert.equal(result.connectedAccountNegativeBalanceRiskBearer, "stripe_under_actual_contract");
    assert.equal(result.legalLiabilityDetermined, false);
  });
  it("blocks unknown provider configuration or unavailable finance review", () => {
    const result = connectLossExposureDraft(exposure({
      lossesCollector: undefined, providerAccountDetailsReadOnServer: false,
      financeReviewerConfirmed: false
    }));
    for (const item of ["loss_responsibility_unknown", "live_provider_account_details_required", "finance_owner_review_missing"]) {
      assert.ok(result.blockers.includes(item));
    }
  });
});
describe("dual-control high-risk payee-change review", () => {
  it("requires independent reviewer and verified original contact route", () => {
    const result = payeeChangeTwoPersonDraft(payeeChange());
    assert.equal(result.status, "second_person_review_recorded");
    assert.equal(result.paymentAuthorized, false);
    assert.equal(result.destinationUpdated, false);
  });
  it("cannot authorize a person to approve their own account change", () => {
    const result = payeeChangeTwoPersonDraft(payeeChange({ reviewedBy: OWNER }));
    assert.ok(result.blockers.includes("independent_reviewer_required"));
  });
  it("blocks an email-only beneficiary redirect without out-of-band confirmation", () => {
    const result = payeeChangeTwoPersonDraft(payeeChange({ verifiedOriginalContactChannel: false }));
    assert.ok(result.blockers.includes("out_of_band_payee_confirmation_missing"));
  });
  it("rejects approval after a stale or overly generous change window", () => {
    const result = payeeChangeTwoPersonDraft(payeeChange({
      changeWindowExpiresAt: "2026-10-10T13:00:00Z"
    }));
    assert.ok(result.blockers.includes("time_bounded_review_missing"));
  });
});
