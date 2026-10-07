// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Exact-cent arithmetic for informational quote and operating scenarios.
// Not invoices, tax returns, bank balances, credit decisions, custody records,
// GAAP statements, legally computed interest, or financial advice.
// All inputs MUST come from independently verified, approved business records.

const MAX = BigInt(Number.MAX_SAFE_INTEGER);
function minor(value, field, zeroAllowed = true) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 ||
      (!zeroAllowed && value === 0)) throw new Error("invalid_" + field);
  return BigInt(value);
}
function safe(value) {
  if (value < 0n || value > MAX) throw new Error("amount_exceeds_safe_minor_units");
  return Number(value);
}
function requireUsd(currency) {
  if (currency !== "USD") throw new Error("currency_specific_precision_review_required");
}

// Clearly split refundable security deposits from charges. Full price is
// visible before a checkout; taxes are supplied by a reviewed tax engine,
// NOT invented by these formulas.
function draftCustomerQuote({ lines, discountCents = 0, requiredFeesCents = 0,
  estimatedTaxCents = 0, refundableDepositCents = 0, currency = "USD",
  taxStatus = "unverified"
} = {}) {
  requireUsd(currency);
  if (!Array.isArray(lines) || !lines.length) throw new Error("quote_lines_required");
  let subtotal = 0n;
  for (const line of lines) {
    if (!line || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("invalid_line_quantity");
    }
    subtotal += minor(line.unitCents, "unit_cents") * BigInt(line.quantity);
    if (subtotal > MAX) throw new Error("amount_exceeds_safe_minor_units");
  }
  const discount = minor(discountCents, "discount_cents");
  const fees = minor(requiredFeesCents, "required_fees_cents");
  const tax = minor(estimatedTaxCents, "estimated_tax_cents");
  const deposit = minor(refundableDepositCents, "refundable_deposit_cents");
  if (discount > subtotal) throw new Error("discount_exceeds_subtotal");
  const pretaxNonDeposit = subtotal - discount + fees;
  const total = pretaxNonDeposit + tax + deposit;
  if (taxStatus !== "verified_by_configured_tax_provider" && tax > 0n) {
    throw new Error("estimated_tax_must_be_disclosed_not_charged");
  }
  const out = Object.freeze({
    state: "draft_unposted", paymentAuthorized: false, taxAccuracyCertified: false,
    currency, lineSubtotalCents: safe(subtotal), discountCents: safe(discount),
    requiredFeesCents: safe(fees), taxCents: safe(tax),
    refundableDepositCents: safe(deposit),
    nonDepositPreTaxChargesCents: safe(pretaxNonDeposit),
    totalDueCents: safe(total),
    depositIsRevenue: false,
    taxEvidenceRequired: tax > 0n,
    caveat: "Not a paid receipt. Taxes, refundable deposits and fees have distinct accounting obligations."
  });
  return out;
}

// Mathematical ceiling; not a refund authorization. A refund may require
// rights review, original payment verification, owner approval and provider
// account/transaction linkage. Never reduce a disputed balance to zero.
function proposedRefundCeiling({ receivedCents, previouslyRefundedCents,
  proposedRefundCents, currency = "USD" } = {}) {
  requireUsd(currency);
  const received = minor(receivedCents, "received_cents");
  const refunded = minor(previouslyRefundedCents, "previously_refunded_cents");
  const proposed = minor(proposedRefundCents, "proposed_refund_cents");
  if (refunded > received) throw new Error("recorded_refunds_exceed_receipts");
  const remaining = received - refunded;
  return Object.freeze({
    state: proposed <= remaining ? "arithmetically_within_observed_receipts" : "blocked_over_refund",
    remainingUnrefundedCents: safe(remaining),
    proposedRefundCents: safe(proposed),
    executionAuthorized: false, providerBalanceVerified: false,
    regulatoryEligibilityVerified: false
  });
}

// Break-even math for business owners / SONARA founder scenarios.
// Every input is an assumption; margins can change with actual taxes, refunds,
// third-party fees, credits, losses, churn and service delivery. No ROI promises.
function modelMonthlyUnitEconomics({ priceCents, variableCostCents,
  providerCostCents, fraudRefundReserveCents, monthlyFixedCostCents,
  currency = "USD" } = {}) {
  requireUsd(currency);
  const price = minor(priceCents, "price_cents");
  const variable = minor(variableCostCents, "variable_cost_cents");
  const provider = minor(providerCostCents, "provider_cost_cents");
  const reserve = minor(fraudRefundReserveCents, "fraud_refund_reserve_cents");
  const fixed = minor(monthlyFixedCostCents, "monthly_fixed_cost_cents");
  const contribution = price - variable - provider - reserve;
  const customersNeeded = contribution <= 0n ? null : (fixed + contribution - 1n) / contribution;
  if (customersNeeded !== null && customersNeeded > MAX) throw new Error("amount_exceeds_safe_minor_units");
  if (contribution < -MAX || contribution > MAX) throw new Error("amount_exceeds_safe_minor_units");
  return Object.freeze({
    classification: "scenario_assumptions_only", currency,
    contributionPerCustomerCents: Number(contribution),
    fixedCostCents: safe(fixed),
    minimumCustomersToCoverFixedCost: customersNeeded === null ? null : Number(customersNeeded),
    estimatedProfitForZeroCustomersCents: -Number(fixed),
    cannotBreakEvenAtThisPrice: contribution <= 0n,
    guaranteedRevenue: false, taxationAndProviderReconciliationExcluded: true
  });
}
module.exports = { draftCustomerQuote, proposedRefundCeiling, modelMonthlyUnitEconomics };