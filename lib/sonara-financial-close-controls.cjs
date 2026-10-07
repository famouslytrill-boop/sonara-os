// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Independent finance-review controls for cash movements and connected account
// exposure. PREVIEW ONLY: these functions neither connect to banks nor post a
// journal, change payouts, transfer funds or approve a legal obligation.
// Both source arrays must be independently retrieved and bound to the named
// business by reviewed server-side adapters before evaluation.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCT = /^acct_[A-Za-z0-9]{8,}$/;
const PAYOUT = /^po_[A-Za-z0-9]{8,}$/;
function validMinor(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function exact(value) { return typeof value === "string" && /^[A-Za-z0-9._:-]{3,160}$/.test(value); }

// Compare completed processor payouts with independently posted bank deposits.
// A bank deposit's reference must be linked independently to one processor
// payout. Equal *amounts alone* never establish ownership or payment completion.
function payoutTieout({
  organizationId, connectedAccountId, currency = "USD",
  processorPayouts, bankDeposits, processorWindowComplete,
  bankWindowComplete, processorReadVerified, bankReadVerified,
  bankOwnershipVerified, statementPeriodId
} = {}) {
  const issues = [];
  const issue = (code) => { if (!issues.includes(code)) issues.push(code); };
  if (!UUID.test(organizationId || "")) issue("tenant_identity_unverified");
  if (!ACCT.test(connectedAccountId || "")) issue("connected_account_unverified");
  if (currency !== "USD") issue("currency_precision_requires_review");
  if (!exact(statementPeriodId)) issue("statement_period_unverified");
  if (processorWindowComplete !== true || bankWindowComplete !== true ||
      processorReadVerified !== true || bankReadVerified !== true ||
      bankOwnershipVerified !== true ||
      !Array.isArray(processorPayouts) || !Array.isArray(bankDeposits)) {
    return Object.freeze({
      status: "incomplete_evidence", issues: Object.freeze([...issues, "verified_independent_full_windows_required"]),
      matchedPayouts: 0, matchedGrossCents: null,
      actualCustodyVerified: false, paymentInitiated: false, financeApprovalRequired: true
    });
  }
  const expected = new Map();
  for (const p of processorPayouts) {
    if (!p || !PAYOUT.test(p.payoutId || "") || expected.has(p.payoutId)) {
      issue("invalid_or_duplicate_provider_payout"); continue;
    }
    if (p.organizationId !== organizationId || p.connectedAccountId !== connectedAccountId ||
        p.currency !== currency || p.statementPeriodId !== statementPeriodId ||
        !validMinor(p.amountCents) || p.status !== "paid") {
      issue("provider_payout_unsettled_or_scope_mismatch"); continue;
    }
    expected.set(p.payoutId, p);
  }
  const seenBankRefs = new Set();
  const bankByPayout = new Map();
  for (const b of bankDeposits) {
    if (!b || !exact(b.bankTransactionId) || seenBankRefs.has(b.bankTransactionId)) {
      issue("invalid_or_duplicate_bank_credit"); continue;
    }
    seenBankRefs.add(b.bankTransactionId);
    if (b.organizationId !== organizationId || b.statementPeriodId !== statementPeriodId ||
        !validMinor(b.amountCents) || b.currency !== currency || b.status !== "posted") {
      issue("bank_credit_unposted_or_scope_mismatch"); continue;
    }
    if (!PAYOUT.test(b.verifiedLinkedPayoutId || "") || bankByPayout.has(b.verifiedLinkedPayoutId)) {
      issue("bank_credit_missing_unique_verified_payout_link"); continue;
    }
    bankByPayout.set(b.verifiedLinkedPayoutId, b);
  }
  let total = 0n;
  for (const [id, p] of expected) {
    const b = bankByPayout.get(id);
    if (!b) { issue("processor_payout_not_found_in_bank_window"); continue; }
    if (p.amountCents !== b.amountCents) issue("payout_bank_amount_mismatch");
    else total += BigInt(p.amountCents);
  }
  for (const id of bankByPayout.keys()) {
    if (!expected.has(id)) issue("bank_credit_without_known_processor_payout");
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) issue("unsafe_total_minor_units");
  const matched = issues.length === 0;
  return Object.freeze({
    status: matched ? "records_match_finance_review_required" : "reconciliation_exception",
    issues: Object.freeze(issues),
    matchedPayouts: matched ? expected.size : null,
    matchedGrossCents: matched ? Number(total) : null,
    actualCustodyVerified: false, paymentInitiated: false,
    financeApprovalRequired: true,
    note: "Matched externally supplied payout and bank-deposit records; does not by itself prove a platform account balance or accounting completeness."
  });
}

// Stripe loss liability depends on the actual connected-account configuration.
// Neither 'direct charge' nor 'standard connected account' is legal clearance.
function connectLossExposureDraft({
  connectedAccountId, providerAccountDetailsReadOnServer,
  lossesCollector, feesCollector, negativeBalanceCents,
  outstandingDisputesCents, financeReviewerConfirmed
} = {}) {
  const blockers = [];
  if (!ACCT.test(connectedAccountId || "")) blockers.push("connected_account_unverified");
  if (providerAccountDetailsReadOnServer !== true) blockers.push("live_provider_account_details_required");
  if (!["application", "stripe"].includes(lossesCollector)) blockers.push("loss_responsibility_unknown");
  if (!["application", "stripe"].includes(feesCollector)) blockers.push("fee_responsibility_unknown");
  if (typeof negativeBalanceCents !== "number" || !Number.isSafeInteger(negativeBalanceCents) ||
      negativeBalanceCents < 0) blockers.push("negative_balance_unverified");
  if (typeof outstandingDisputesCents !== "number" || !Number.isSafeInteger(outstandingDisputesCents) ||
      outstandingDisputesCents < 0) blockers.push("outstanding_dispute_balance_unverified");
  if (financeReviewerConfirmed !== true) blockers.push("finance_owner_review_missing");
  return Object.freeze({
    status: blockers.length ? "blocked_pending_review" : "reviewable_exposure_snapshot",
    blockers: Object.freeze(blockers),
    connectedAccountNegativeBalanceRiskBearer: lossesCollector === "application" ? "sonara_platform"
      : lossesCollector === "stripe" ? "stripe_under_actual_contract" : "unknown",
    platformReserveExposurePossible: lossesCollector !== "stripe",
    ownerReviewed: financeReviewerConfirmed === true,
    totalPotentialLiabilityCents: null, legalLiabilityDetermined: false,
    negativeBalanceAmountKnown: blockers.includes("negative_balance_unverified") ? null : negativeBalanceCents,
    paymentPermission: false, accountConfigurationChanged: false
  });
}

// A proposed bank/payee change requires an independently evidenced second
// reviewer, not the requester acting as their own approver. Do not allow an AI
// agent to approve a change it proposed or to forge an authentication event.
function payeeChangeTwoPersonDraft({
  organizationId, requestedBy, reviewedBy, requestRef,
  currentAccountRef, proposedAccountRef,
  reviewerAuthenticatedIndependently, verifiedOriginalContactChannel,
  recipientIdentityReconfirmed, reviewedAt, changeWindowExpiresAt
} = {}) {
  const blockers = [];
  const need = (ok, why) => { if (!ok) blockers.push(why); };
  need(UUID.test(organizationId || ""), "organization_unverified");
  need(UUID.test(requestedBy || "") && UUID.test(reviewedBy || "") &&
    requestedBy !== reviewedBy, "independent_reviewer_required");
  need(exact(requestRef), "change_request_reference_missing");
  need(exact(currentAccountRef) && exact(proposedAccountRef) &&
    currentAccountRef !== proposedAccountRef, "different_verified_destination_required");
  need(reviewerAuthenticatedIndependently === true, "independent_step_up_missing");
  need(verifiedOriginalContactChannel === true && recipientIdentityReconfirmed === true,
    "out_of_band_payee_confirmation_missing");
  const timestamp = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v)) &&
    v.endsWith("Z") ? Date.parse(v) : null;
  const reviewed = timestamp(reviewedAt), expires = timestamp(changeWindowExpiresAt);
  need(reviewed !== null && expires !== null && reviewed < expires &&
    expires - reviewed <= 86400000, "time_bounded_review_missing");
  return Object.freeze({
    status: blockers.length ? "blocked_pending_review" : "second_person_review_recorded",
    blockers: Object.freeze(blockers), destinationUpdated: false,
    paymentAuthorized: false, legalClearanceClaim: false
  });
}

module.exports = { payoutTieout, connectLossExposureDraft, payeeChangeTwoPersonDraft };