// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Purchase order + accepted receipts + supplier invoice: pure arithmetic only.
// The API must load all records from authoritative organization-scoped tables.
// This module cannot verify source provenance, confer authority, post stock,
// approve invoices, initiate payment, or contact any supplier.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(value, name) {
  if (typeof value !== "string" || !UUID.test(value)) throw new TypeError(name + "_invalid");
  return value.toLowerCase();
}
function integer(value, name, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new RangeError(name + "_invalid");
  }
  return value;
}
function currency(value) {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) throw new TypeError("currency_invalid");
  return value;
}
function unit(value) {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value)) {
    throw new TypeError("unit_invalid");
  }
  return value.trim().toUpperCase();
}
function list(value, name, max = 1000) {
  if (!Array.isArray(value) || !value.length || value.length > max) throw new RangeError(name + "_invalid");
  return value;
}
function cents(value, name) { return integer(value, name); }

// Money must not pass through floating-point multiplication. Qty is in
// thousandths of the inventory line's *declared* unit (1.000 => 1000).
// Round each invoiced line half up to the nearest minor currency unit.
// The calling integration must separately ensure the currency supports
// the assumed cents scale; the current function is NOT suitable for JPY etc.
function extendedCents(quantityMilli, unitCostCents) {
  integer(quantityMilli, "quantity_milli");
  cents(unitCostCents, "unit_cost_cents");
  const exact = BigInt(quantityMilli) * BigInt(unitCostCents);
  const rounded = (exact + 500n) / 1000n;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("line_total_overflow");
  return Number(rounded);
}
function sumSafe(numbers, field) {
  const sum = numbers.reduce((n, value) => n + BigInt(value), 0n);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(field + "_overflow");
  return Number(sum);
}
function assessThreeWayMatch({ organizationId, purchaseOrder, receipts, supplierInvoice, priorInvoiceAllocations }) {
  const tenant = uuid(organizationId, "organization_id");
  if (!purchaseOrder || !supplierInvoice) throw new TypeError("documents_required");
  const poId = uuid(purchaseOrder.id, "purchase_order_id");
  const invoiceId = uuid(supplierInvoice.id, "supplier_invoice_id");
  const vendorId = uuid(purchaseOrder.vendorId, "vendor_id");
  if (uuid(purchaseOrder.organizationId, "po_organization_id") !== tenant
      || uuid(supplierInvoice.organizationId, "invoice_organization_id") !== tenant) {
    throw new TypeError("organization_mismatch");
  }
  if (uuid(supplierInvoice.vendorId, "invoice_vendor_id") !== vendorId) {
    throw new TypeError("vendor_mismatch");
  }
  if (uuid(supplierInvoice.purchaseOrderId, "invoice_purchase_order_id") !== poId) {
    throw new TypeError("purchase_order_mismatch");
  }
  const cur = currency(purchaseOrder.currency);
  if (currency(supplierInvoice.currency) !== cur) throw new TypeError("currency_mismatch");
  // One cent-based implementation must not pretend to handle all ISO currencies.
  if (!["USD", "CAD", "EUR", "GBP", "AUD"].includes(cur)) {
    throw new TypeError("unsupported_currency_minor_units");
  }
  const ordered = new Map();
  for (const item of list(purchaseOrder.lines, "purchase_order_lines")) {
    if (uuid(item.organizationId, "order_line_organization_id") !== tenant) throw new TypeError("organization_mismatch");
    const id = uuid(item.id, "purchase_order_line_id");
    if (ordered.has(id)) throw new TypeError("duplicate_purchase_order_line");
    ordered.set(id, {
      quantityMilli: integer(item.quantityMilli, "ordered_quantity_milli", true),
      unitCostCents: cents(item.unitCostCents, "agreed_unit_cost_cents"),
      unit: unit(item.unit)
    });
  }
  if (!Array.isArray(receipts) || receipts.length > 10000) throw new RangeError("receipt_rows_invalid");
  const receiptsByLine = new Map();
  const receiptIds = new Set();
  for (const r of receipts) {
    if (uuid(r.organizationId, "receipt_organization_id") !== tenant ||
        uuid(r.purchaseOrderId, "receipt_purchase_order_id") !== poId) {
      throw new TypeError("receipt_scope_mismatch");
    }
    const id = uuid(r.id, "receipt_id");
    if (receiptIds.has(id)) throw new TypeError("duplicate_receipt_evidence");
    receiptIds.add(id);
    const lineId = uuid(r.purchaseOrderLineId, "receipt_purchase_order_line_id");
    const ref = ordered.get(lineId);
    if (!ref || unit(r.unit) !== ref.unit) throw new TypeError("receipt_line_unit_mismatch");
    const accepted = integer(r.acceptedQuantityMilli, "accepted_quantity_milli");
    const rejected = integer(r.rejectedQuantityMilli, "rejected_quantity_milli");
    if (accepted === 0 && rejected === 0) throw new TypeError("empty_receipt");
    const current = receiptsByLine.get(lineId) || { accepted: 0n, rejected: 0n };
    current.accepted += BigInt(accepted);
    current.rejected += BigInt(rejected);
    if (current.accepted + current.rejected > BigInt(ref.quantityMilli)) {
      throw new RangeError("receipts_exceed_ordered");
    }
    receiptsByLine.set(lineId, current);
  }
  // The server must supply the complete prior committed invoice allocation
  // history for this PO. Omission is NOT equivalent to an empty history.
  if (!Array.isArray(priorInvoiceAllocations) || priorInvoiceAllocations.length > 10000) {
    throw new TypeError("prior_invoice_allocation_history_required");
  }
  const alreadyInvoicedByLine = new Map();
  const priorAllocationIds = new Set();
  for (const previous of priorInvoiceAllocations) {
    if (uuid(previous.organizationId, "prior_organization_id") !== tenant ||
        uuid(previous.purchaseOrderId, "prior_purchase_order_id") !== poId ||
        uuid(previous.vendorId, "prior_vendor_id") !== vendorId) {
      throw new TypeError("prior_invoice_scope_mismatch");
    }
    const previousInvoiceId = uuid(previous.invoiceId, "prior_invoice_id");
    const allocationId = uuid(previous.invoiceLineId, "prior_invoice_line_id");
    if (previousInvoiceId === invoiceId) throw new TypeError("current_invoice_already_allocated");
    if (priorAllocationIds.has(allocationId)) throw new TypeError("duplicate_prior_invoice_line");
    priorAllocationIds.add(allocationId);
    if (!["approved", "scheduled", "paid"].includes(previous.status)) {
      throw new TypeError("prior_invoice_status_invalid");
    }
    const lineId = uuid(previous.purchaseOrderLineId, "prior_purchase_order_line_id");
    const related = ordered.get(lineId);
    if (!related || unit(previous.unit) !== related.unit) throw new TypeError("prior_invoice_line_unit_mismatch");
    const quantity = integer(previous.quantityMilli, "prior_invoice_quantity_milli", true);
    const prior = (alreadyInvoicedByLine.get(lineId) || 0n) + BigInt(quantity);
    if (prior > BigInt(related.quantityMilli)) throw new RangeError("prior_invoice_exceeds_ordered");
    alreadyInvoicedByLine.set(lineId, prior);
  }
  const reasons = [];
  if (purchaseOrder.approvalStatus !== "approved" ||
      !Number.isSafeInteger(purchaseOrder.approvalVersion) ||
      purchaseOrder.approvalVersion < 2 ||
      !UUID.test(String(purchaseOrder.approvalDecidedBy || "")) ||
      typeof purchaseOrder.approvalDecidedAt !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(purchaseOrder.approvalDecidedAt)) {
    reasons.push("purchase_order_not_approved");
  }
  if (!["sent","partially_received","received"].includes(purchaseOrder.status)) reasons.push("purchase_order_not_issued");
  if (supplierInvoice.paymentStatus !== "unpaid") reasons.push("invoice_payment_state_not_unpaid");
  const invoiceLineIds = new Set();
  const computedLineTotals = [];
  const findings = [];
  for (const item of list(supplierInvoice.lines, "supplier_invoice_lines")) {
    if (uuid(item.organizationId, "invoice_line_organization_id") !== tenant) {
      throw new TypeError("organization_mismatch");
    }
    const id = uuid(item.purchaseOrderLineId, "invoice_line_purchase_order_line_id");
    if (invoiceLineIds.has(id)) throw new TypeError("duplicate_invoice_po_line");
    invoiceLineIds.add(id);
    const line = ordered.get(id);
    if (!line || unit(item.unit) !== line.unit) throw new TypeError("invoice_line_unit_mismatch");
    const quantityMilli = integer(item.quantityMilli, "invoice_quantity_milli", true);
    const unitCostCents = cents(item.unitCostCents, "invoice_unit_cost_cents");
    const declaredCents = cents(item.lineTotalCents, "invoice_line_total_cents");
    const computedCents = extendedCents(quantityMilli, unitCostCents);
    const received = receiptsByLine.get(id)?.accepted ?? 0n;
    const lineReasons = [];
    if (BigInt(quantityMilli) > received) lineReasons.push("invoice_exceeds_accepted_receipts");
    const previouslyCommitted = alreadyInvoicedByLine.get(id) || 0n;
    if (BigInt(quantityMilli) + previouslyCommitted > received) {
      lineReasons.push("invoice_exceeds_unbilled_receipts");
    }
    if (quantityMilli > line.quantityMilli) lineReasons.push("invoice_exceeds_ordered_quantity");
    if (unitCostCents > line.unitCostCents) lineReasons.push("price_exceeds_purchase_order");
    if (declaredCents !== computedCents) lineReasons.push("line_total_mismatch");
    if (lineReasons.length) reasons.push(...lineReasons);
    computedLineTotals.push(computedCents);
    findings.push(Object.freeze({
      purchaseOrderLineId: id,
      invoicedQuantityMilli: quantityMilli,
      acceptedQuantityMilli: received <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(received) : null,
      lineTotalCents: computedCents,
      issues: Object.freeze(lineReasons)
    }));
  }
  const computedSubtotalCents = sumSafe(computedLineTotals, "subtotal");
  const declaredSubtotalCents = cents(supplierInvoice.subtotalCents, "subtotal_cents");
  const taxCents = cents(supplierInvoice.taxCents, "tax_cents");
  const shippingCents = cents(supplierInvoice.shippingCents, "shipping_cents");
  const totalCents = cents(supplierInvoice.totalCents, "total_cents");
  if (computedSubtotalCents !== declaredSubtotalCents) reasons.push("invoice_subtotal_mismatch");
  if (sumSafe([declaredSubtotalCents, taxCents, shippingCents], "total") !== totalCents) {
    reasons.push("invoice_total_mismatch");
  }
  if (taxCents > 0 || shippingCents > 0) reasons.push("tax_shipping_require_independent_review");
  const issues = Object.freeze([...new Set(reasons)]);
  return Object.freeze({
    organizationId: tenant, purchaseOrderId: poId, invoiceId,
    currency: cur, computedSubtotalCents,
    totalCents, issues, lines: Object.freeze(findings),
    status: issues.length ? "hold_for_review" : "ready_for_human_review",
    state: "proposal_only", authorizesPayment: false,
    requiresTrustedRecords: true, requiresCompletePriorInvoiceHistory: true, requiresHumanApproval: true
  });
}
module.exports = Object.freeze({ assessThreeWayMatch, extendedCents });
