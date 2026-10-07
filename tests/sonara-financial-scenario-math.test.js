// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { draftCustomerQuote, proposedRefundCeiling, modelMonthlyUnitEconomics } =
  require("../lib/sonara-financial-scenario-math.cjs");

describe("SONARA cent-precise draft customer finance calculations", () => {
  it("separates deposits, required fees, taxes and pre-tax non-deposit charges", () => {
    const q = draftCustomerQuote({
      lines: [{ quantity: 2, unitCents: 5500 }], discountCents: 1000,
      requiredFeesCents: 500, estimatedTaxCents: 800,
      refundableDepositCents: 3000, taxStatus: "verified_by_configured_tax_provider"
    });
    assert.equal(q.lineSubtotalCents, 11000);
    assert.equal(q.nonDepositPreTaxChargesCents, 10500);
    assert.equal(q.totalDueCents, 14300);
    assert.equal(q.refundableDepositCents, 3000);
    assert.equal(q.depositIsRevenue, false);
    assert.equal(q.paymentAuthorized, false);
    assert.equal(q.taxAccuracyCertified, false);
  });
  it("prevents displaying unverified tax as chargeable certainty", () => {
    assert.throws(() => draftCustomerQuote({
      lines: [{ quantity: 1, unitCents: 500 }], estimatedTaxCents: 40
    }), /estimated_tax_must_be_disclosed_not_charged/);
  });
  it("rejects negative, fractional, currency-mismatched and empty quotes", () => {
    assert.throws(() => draftCustomerQuote({ lines: [] }), /quote_lines_required/);
    assert.throws(() => draftCustomerQuote({
      lines: [{ unitCents: 120, quantity: 1.5 }]
    }), /invalid_line_quantity/);
    assert.throws(() => draftCustomerQuote({
      lines: [{ unitCents: -120, quantity: 1 }]
    }), /invalid_unit_cents/);
    assert.throws(() => draftCustomerQuote({
      lines: [{ unitCents: 120, quantity: 1 }], currency: "JPY"
    }), /currency_specific_precision_review_required/);
  });
  it("refuses to discount more than the subtotal or overflow integer arithmetic", () => {
    assert.throws(() => draftCustomerQuote({
      lines: [{ quantity: 1, unitCents: 100 }], discountCents: 200
    }), /discount_exceeds_subtotal/);
    assert.throws(() => draftCustomerQuote({
      lines: [{ quantity: 2, unitCents: Number.MAX_SAFE_INTEGER }]
    }), /amount_exceeds_safe_minor_units/);
    assert.throws(() => draftCustomerQuote({
      lines: [{ quantity: 1, unitCents: Number.MAX_SAFE_INTEGER }], requiredFeesCents: 1
    }), /amount_exceeds_safe_minor_units/);
  });
  it("checks refund ceiling without authorizing a refund", () => {
    const position = proposedRefundCeiling({
      receivedCents: 10000, previouslyRefundedCents: 3000, proposedRefundCents: 7000
    });
    assert.equal(position.remainingUnrefundedCents, 7000);
    assert.equal(position.state, "arithmetically_within_observed_receipts");
    assert.equal(position.executionAuthorized, false);
    assert.equal(position.providerBalanceVerified, false);
    assert.equal(proposedRefundCeiling({
      receivedCents: 10000, previouslyRefundedCents: 3000, proposedRefundCents: 7001
    }).state, "blocked_over_refund");
  });
  it("flags when recorded cumulative refunds already exceed receipts", () => {
    assert.throws(() => proposedRefundCeiling({
      receivedCents: 1, previouslyRefundedCents: 2, proposedRefundCents: 0
    }), /recorded_refunds_exceed_receipts/);
  });
  it("computes business break-even ceiling from explicit monthly assumptions", () => {
    const s = modelMonthlyUnitEconomics({
      priceCents: 2900, variableCostCents: 500,
      providerCostCents: 200, fraudRefundReserveCents: 200,
      monthlyFixedCostCents: 100000
    });
    assert.equal(s.contributionPerCustomerCents, 2000);
    assert.equal(s.minimumCustomersToCoverFixedCost, 50);
    assert.equal(s.cannotBreakEvenAtThisPrice, false);
    assert.equal(s.guaranteedRevenue, false);
  });
  it("correctly rounds break-even customer counts up to whole customers", () => {
    const s = modelMonthlyUnitEconomics({
      priceCents: 1000, variableCostCents: 200,
      providerCostCents: 0, fraudRefundReserveCents: 0,
      monthlyFixedCostCents: 2001
    });
    assert.equal(s.minimumCustomersToCoverFixedCost, 3);
  });
  it("makes an impossible or zero-contribution price explicitly non-break-even", () => {
    const s = modelMonthlyUnitEconomics({
      priceCents: 500, variableCostCents: 600,
      providerCostCents: 20, fraudRefundReserveCents: 100,
      monthlyFixedCostCents: 100
    });
    assert.equal(s.contributionPerCustomerCents, -220);
    assert.equal(s.minimumCustomersToCoverFixedCost, null);
    assert.equal(s.cannotBreakEvenAtThisPrice, true);
  });
  it("never claims that mathematical projections equal bank balances or earnings", () => {
    const q = draftCustomerQuote({ lines: [{ quantity: 1, unitCents: 1000 }] });
    const s = modelMonthlyUnitEconomics({
      priceCents: 1000, variableCostCents: 100,
      providerCostCents: 100, fraudRefundReserveCents: 100,
      monthlyFixedCostCents: 0
    });
    assert.equal(q.state, "draft_unposted");
    assert.equal(s.classification, "scenario_assumptions_only");
    assert.equal(s.taxationAndProviderReconciliationExcluded, true);
  });
});