// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { assessThreeWayMatch, extendedCents } = require("../lib/sonara-procurement-three-way-match.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PO = "33333333-3333-4333-8333-333333333333";
const LINE = "44444444-4444-4444-8444-444444444444";
const INVOICE = "55555555-5555-4555-8555-555555555555";
const VENDOR = "66666666-6666-4666-8666-666666666666";
const ACTOR = "77777777-7777-4777-8777-777777777777";
const RECEIPT = "88888888-8888-4888-8888-888888888888";
const RECEIPT_B = "99999999-9999-4999-8999-999999999999";
function sample() {
  return {
    organizationId: ORG,
    purchaseOrder: {
      id: PO, organizationId: ORG, vendorId: VENDOR, currency: "USD",
      status: "partially_received", approvalStatus: "approved",
      approvalVersion: 2, approvalDecidedBy: ACTOR, approvalDecidedAt: "2026-10-09T05:00:00Z",
      lines: [{ id: LINE, organizationId: ORG, quantityMilli: 10000, unitCostCents: 250, unit: "each" }]
    },
    priorInvoiceAllocations: [],
    receipts: [{
      id: RECEIPT, organizationId: ORG, purchaseOrderId: PO,
      purchaseOrderLineId: LINE, unit: "each",
      acceptedQuantityMilli: 7000, rejectedQuantityMilli: 1000
    }],
    supplierInvoice: {
      id: INVOICE, organizationId: ORG, vendorId: VENDOR,
      purchaseOrderId: PO, currency: "USD", paymentStatus: "unpaid",
      lines: [{
        organizationId: ORG, purchaseOrderLineId: LINE, unit: "each",
        quantityMilli: 7000, unitCostCents: 250, lineTotalCents: 1750
      }],
      subtotalCents: 1750, taxCents: 0, shippingCents: 0, totalCents: 1750
    }
  };
}
describe("Deterministic three-way PO / accepted receipt / supplier invoice matching", () => {
  it("allows an exact partial invoice for accepted goods to proceed to HUMAN review only", () => {
    const result = assessThreeWayMatch(sample());
    assert.equal(result.status, "ready_for_human_review");
    assert.equal(result.computedSubtotalCents, 1750);
    assert.deepEqual(result.issues, []);
    assert.equal(result.state, "proposal_only");
    assert.equal(result.authorizesPayment, false);
    assert.equal(result.requiresHumanApproval, true);
    assert.ok(Object.isFrozen(result));
  });
  it("never counts rejected goods as billable received inventory", () => {
    const data = sample();
    data.supplierInvoice.lines[0].quantityMilli = 8000;
    data.supplierInvoice.lines[0].lineTotalCents = 2000;
    data.supplierInvoice.subtotalCents = 2000;
    data.supplierInvoice.totalCents = 2000;
    const result = assessThreeWayMatch(data);
    assert.equal(result.status, "hold_for_review");
    assert.ok(result.issues.includes("invoice_exceeds_accepted_receipts"));
    assert.equal(result.lines[0].acceptedQuantityMilli, 7000);
  });
  it("holds supplier price increases, but permits a verified discount", () => {
    const data = sample();
    data.supplierInvoice.lines[0].unitCostCents = 300;
    data.supplierInvoice.lines[0].lineTotalCents = 2100;
    data.supplierInvoice.subtotalCents = 2100;
    data.supplierInvoice.totalCents = 2100;
    assert.ok(assessThreeWayMatch(data).issues.includes("price_exceeds_purchase_order"));
    data.supplierInvoice.lines[0].unitCostCents = 200;
    data.supplierInvoice.lines[0].lineTotalCents = 1400;
    data.supplierInvoice.subtotalCents = 1400;
    data.supplierInvoice.totalCents = 1400;
    assert.deepEqual(assessThreeWayMatch(data).issues, []);
  });
  it("holds invoice line arithmetic tampering and subtotal mismatches", () => {
    const data = sample();
    data.supplierInvoice.lines[0].lineTotalCents = 1751;
    data.supplierInvoice.subtotalCents = 1751;
    data.supplierInvoice.totalCents = 1751;
    const result = assessThreeWayMatch(data);
    assert.ok(result.issues.includes("line_total_mismatch"));
    assert.ok(result.issues.includes("invoice_subtotal_mismatch"));
  });
  it("holds tax and shipping for independent review even if arithmetic is correct", () => {
    const data = sample();
    data.supplierInvoice.taxCents = 100;
    data.supplierInvoice.shippingCents = 50;
    data.supplierInvoice.totalCents = 1900;
    assert.ok(assessThreeWayMatch(data).issues.includes("tax_shipping_require_independent_review"));
    data.supplierInvoice.totalCents = 1901;
    assert.ok(assessThreeWayMatch(data).issues.includes("invoice_total_mismatch"));
  });
  it("rejects cross-tenant PO, invoice, receipt and invoice-line evidence", () => {
    for (const edit of [
      (x) => x.purchaseOrder.organizationId = OTHER,
      (x) => x.supplierInvoice.organizationId = OTHER,
      (x) => x.receipts[0].organizationId = OTHER,
      (x) => x.supplierInvoice.lines[0].organizationId = OTHER
    ]) { const data = sample(); edit(data); assert.throws(() => assessThreeWayMatch(data), /(organization_mismatch|receipt_scope_mismatch)/); }
  });
  it("rejects wrong supplier, PO and foreign currencies rather than converting them silently", () => {
    const data = sample();
    data.supplierInvoice.vendorId = OTHER;
    assert.throws(() => assessThreeWayMatch(data), /vendor_mismatch/);
    data.supplierInvoice.vendorId = VENDOR;
    data.supplierInvoice.purchaseOrderId = OTHER;
    assert.throws(() => assessThreeWayMatch(data), /purchase_order_mismatch/);
    data.supplierInvoice.purchaseOrderId = PO;
    delete data.supplierInvoice.purchaseOrderId;
    assert.throws(() => assessThreeWayMatch(data), /invoice_purchase_order_id_invalid/);
    data.supplierInvoice.purchaseOrderId = PO;
    data.supplierInvoice.currency = "EUR";
    assert.throws(() => assessThreeWayMatch(data), /currency_mismatch/);
    data.purchaseOrder.currency = "JPY";
    data.supplierInvoice.currency = "JPY";
    assert.throws(() => assessThreeWayMatch(data), /unsupported_currency_minor_units/);
  });
  it("blocks unapproved POs and already paid supplier invoices", () => {
    const data = sample();
    data.purchaseOrder.approvalDecidedBy = null;
    data.supplierInvoice.paymentStatus = "paid";
    const result = assessThreeWayMatch(data);
    assert.ok(result.issues.includes("purchase_order_not_approved"));
    assert.ok(result.issues.includes("invoice_payment_state_not_unpaid"));
  });
  it("detects duplicate receipt IDs and duplicate invoicing of the same PO line", () => {
    const data = sample();
    data.receipts.push({ ...data.receipts[0] });
    assert.throws(() => assessThreeWayMatch(data), /duplicate_receipt_evidence/);
    data.receipts.pop();
    data.supplierInvoice.lines.push({ ...data.supplierInvoice.lines[0] });
    assert.throws(() => assessThreeWayMatch(data), /duplicate_invoice_po_line/);
  });
  it("aggregates multiple nonduplicated partial receipts for the same approved line", () => {
    const data = sample();
    data.receipts[0].acceptedQuantityMilli = 3000;
    data.receipts.push({ ...data.receipts[0], id: RECEIPT_B, acceptedQuantityMilli: 4000, rejectedQuantityMilli: 2000 });
    const result = assessThreeWayMatch(data);
    assert.equal(result.status, "ready_for_human_review");
    assert.equal(result.lines[0].acceptedQuantityMilli, 7000);
  });
  it("refuses over-received purchase orders before any invoice approval analysis", () => {
    const data = sample();
    data.receipts.push({ ...data.receipts[0], id: RECEIPT_B, acceptedQuantityMilli: 3000 });
    assert.throws(() => assessThreeWayMatch(data), /receipts_exceed_ordered/);
  });
  it("holds a second invoice when earlier committed invoices consume the accepted stock", () => {
    const data = sample();
    data.priorInvoiceAllocations.push({
      organizationId: ORG, purchaseOrderId: PO, vendorId: VENDOR,
      invoiceId: OTHER, invoiceLineId: RECEIPT_B, purchaseOrderLineId: LINE,
      unit: "each", quantityMilli: 5000, status: "approved"
    });
    const result = assessThreeWayMatch(data);
    assert.equal(result.status, "hold_for_review");
    assert.ok(result.issues.includes("invoice_exceeds_unbilled_receipts"));
    data.supplierInvoice.lines[0].quantityMilli = 2000;
    data.supplierInvoice.lines[0].lineTotalCents = 500;
    data.supplierInvoice.subtotalCents = 500;
    data.supplierInvoice.totalCents = 500;
    assert.equal(assessThreeWayMatch(data).status, "ready_for_human_review");
  });
  it("rejects omitted prior invoice history, duplicate allocations and already committed current invoices", () => {
    const data = sample();
    delete data.priorInvoiceAllocations;
    assert.throws(() => assessThreeWayMatch(data), /prior_invoice_allocation_history_required/);
    data.priorInvoiceAllocations = [{
      organizationId: ORG, purchaseOrderId: PO, vendorId: VENDOR,
      invoiceId: OTHER, invoiceLineId: RECEIPT_B, purchaseOrderLineId: LINE,
      unit: "each", quantityMilli: 1000, status: "paid"
    }];
    data.priorInvoiceAllocations.push({...data.priorInvoiceAllocations[0]});
    assert.throws(() => assessThreeWayMatch(data), /duplicate_prior_invoice_line/);
    data.priorInvoiceAllocations.pop();
    data.priorInvoiceAllocations[0].invoiceId = INVOICE;
    assert.throws(() => assessThreeWayMatch(data), /current_invoice_already_allocated/);
  });
  it("refuses cross-organization prior allocations even when their invoice totals match", () => {
    const data = sample();
    data.priorInvoiceAllocations.push({
      organizationId: OTHER, purchaseOrderId: PO, vendorId: VENDOR,
      invoiceId: OTHER, invoiceLineId: RECEIPT_B, purchaseOrderLineId: LINE,
      unit: "each", quantityMilli: 1000, status: "approved"
    });
    assert.throws(() => assessThreeWayMatch(data), /prior_invoice_scope_mismatch/);
  });
  it("uses exact integer monetary arithmetic with half-up fractional rounding", () => {
    assert.equal(extendedCents(1000, 250), 250);
    assert.equal(extendedCents(333, 200), 67);
    assert.equal(extendedCents(250, 2), 1);
    assert.equal(extendedCents(250, 1), 0);
    assert.throws(() => extendedCents(1.1, 100), /quantity_milli_invalid/);
    assert.throws(() => extendedCents(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), /line_total_overflow/);
  });
  it("rejects invalid or oversized untrusted document collections", () => {
    const data = sample();
    data.supplierInvoice.lines = [];
    assert.throws(() => assessThreeWayMatch(data), /supplier_invoice_lines_invalid/);
    data.supplierInvoice.lines = sample().supplierInvoice.lines;
    data.receipts = "not verified records";
    assert.throws(() => assessThreeWayMatch(data), /receipt_rows_invalid/);
  });
});
