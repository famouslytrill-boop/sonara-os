// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A merchant pricing simulation and nonprofit acknowledgment review.
// These are neither payment execution nor investment, banking, accounting,
// tax-deduction or legal-advice determinations. Never infer absent fees as zero.
const MAX = 1000000000000;
const integer = (n, min, max) => typeof n === "number" &&
  Number.isSafeInteger(n) && n >= min && n <= max;
const bounded = (n) => n <= BigInt(MAX) && n >= -BigInt(MAX);
const invalid = (issues) => ({
  ok: false, state: "invalid_inputs", issues,
  paymentAuthorized: false, receiptIssued: false, transferredFunds: false
});

// The provider minimum, fixed fee, rate, and fee settlement currency must
// come from a verified live account configuration before any checkout.
// This only models owner-entered figures; it never authorizes a charge.
function simulateMicrotransaction(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid(["invalid_input"]);
  const issues = [];
  if (input.currency !== "USD") issues.push("currency_precision_review_required");
  if (!integer(input.priceCents, 0, MAX)) issues.push("invalid_price");
  if (!integer(input.quantity, 1, 1000000)) issues.push("invalid_quantity");
  if (!integer(input.providerMinimumCents, 1, MAX)) issues.push("provider_minimum_required");
  if (!integer(input.processorFixedFeeCents, 0, MAX)) issues.push("processor_fixed_fee_required");
  if (!integer(input.processorRateBasisPoints, 0, 10000)) issues.push("processor_rate_required");
  if (!integer(input.deliveryCostPerUnitCents, 0, MAX)) issues.push("delivery_cost_required");
  if (!integer(input.riskReservePerUnitCents, 0, MAX)) issues.push("risk_reserve_required");
  if (issues.length) return invalid(issues);

  const price = BigInt(input.priceCents);
  const variableFee = (price * BigInt(input.processorRateBasisPoints) + 9999n) / 10000n;
  const processingFee = BigInt(input.processorFixedFeeCents) + variableFee;
  const net = price - processingFee - BigInt(input.deliveryCostPerUnitCents) -
    BigInt(input.riskReservePerUnitCents);
  const gross = price * BigInt(input.quantity);
  const totalProcessing = processingFee * BigInt(input.quantity);
  const netAggregate = net * BigInt(input.quantity);
  if (![net, gross, totalProcessing, netAggregate].every(bounded)) {
    return invalid(["scenario_exceeds_safe_amount_limit"]);
  }

  const minimumMet = input.priceCents >= input.providerMinimumCents;
  const profitableUnderAssumptions = net > 0n;
  const reviewIssues = [];
  if (!minimumMet) reviewIssues.push("below_assumed_provider_minimum");
  if (!profitableUnderAssumptions) reviewIssues.push("non_positive_contribution");
  reviewIssues.push("account_specific_provider_fees_unverified", "refunds_taxes_and_settlement_excluded");
  return {
    ok: true, state: "draft_scenario_only", currency: "USD",
    unitPriceCents: input.priceCents, assumedProviderMinimumCents: input.providerMinimumCents,
    minimumMetUnderAssumptions: minimumMet,
    processorFeePerUnitCents: Number(processingFee),
    contributionPerUnitCents: Number(net),
    estimatedVolume: input.quantity,
    grossScenarioCents: Number(gross),
    aggregateProcessorFeeCents: Number(totalProcessing),
    aggregateContributionCents: Number(netAggregate),
    profitableUnderAssumptions,
    reviewIssues,
    feeRateRounding: "conservative_ceil_each_charge",
    providerTermsVerified: false, paymentAuthorized: false,
    paymentCollected: false, settledFundsVerified: false, receiptIssued: false
  };
}

// IRS thresholds are US-specific decision-support flags, not an opinion that
// an entity is eligible for deductible gifts. The benefit is the organization
// owner's good-faith estimate and MUST be reviewed before external disclosures.
function reviewNonprofitContribution(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid(["invalid_input"]);
  const issues = [];
  if (input.currency !== "USD") issues.push("currency_precision_review_required");
  if (!integer(input.amountCents, 1, MAX)) issues.push("invalid_contribution_amount");
  if (!integer(input.estimatedBenefitValueCents, 0, MAX)) issues.push("benefit_value_required");
  if (issues.length) return invalid(issues);
  if (input.estimatedBenefitValueCents > input.amountCents) {
    return invalid(["benefit_exceeds_amount_manual_classification_required"]);
  }

  const benefit = input.estimatedBenefitValueCents;
  const hasBenefit = benefit > 0;
  const thresholds = {
    donorAcknowledgmentForAtLeast250USD: input.amountCents >= 25000,
    organizationQuidProQuoDisclosureForOver75USD: hasBenefit && input.amountCents > 7500
  };
  const reviewIssues = [
    "tax_exempt_status_unverified",
    "donor_and_transaction_identity_unverified",
    "goods_services_classification_requires_review"
  ];
  if (hasBenefit) reviewIssues.push("good_faith_benefit_value_requires_review");
  if (input.restrictedPurpose === true) reviewIssues.push("restricted_fund_allocation_requires_review");
  return {
    ok: true, state: "draft_compliance_flags_only", currency: "USD",
    amountCents: input.amountCents, estimatedBenefitValueCents: benefit,
    arithmeticAmountAboveBenefitCents: input.amountCents - benefit,
    hasGoodsOrServicesBenefit: hasBenefit, thresholds, reviewIssues,
    taxDeductibleAmountDetermined: false, charitableStatusVerified: false,
    writtenAcknowledgmentIssued: false, disclosureIssued: false,
    donorContacted: false, fundsTransferred: false, receiptIssued: false
  };
}

module.exports = { simulateMicrotransaction, reviewNonprofitContribution };
