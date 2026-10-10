// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A proposal to use the existing canonical quotes table, not a new ledger,
// invoice, reservation, or payment. User must explicitly submit its form.
// Only the summary title and total are copied: line-item provenance needs a
// separate versioned quote-detail schema before it can truthfully be persisted.
const POSTGRES_INT_MAX = 2147483647;
function draftQuoteHandoff(estimate, menuName) {
  if (!estimate?.ok || estimate.status !== "draft_owner_review_required" ||
      estimate.currency !== "USD" || estimate.charged !== false ||
      estimate.saved !== false || estimate.paymentCollected !== false ||
      estimate.venueBooked !== false) {
    return { ok: false, code: "verified_estimate_required" };
  }
  const amount = estimate.totals?.customerEstimateCents;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) ||
      amount <= 0 || amount > POSTGRES_INT_MAX) {
    return { ok: false, code: "quote_exceeds_existing_database_amount_limit" };
  }
  const label = typeof menuName === "string" ? menuName.trim().slice(0, 120) : "";
  if (!label || !estimate.menu?.length) return { ok: false, code: "menu_name_required" };
  return {
    ok: true, destination: "/api/business/quotes",
    // Canonical schema fields only. No browser-supplied organization_id,
    // created_by, ownership, approval, customer_id, or payment state.
    fields: { title: ("Catering estimate: " + label).slice(0, 200),
      amount_cents: String(amount), status: "draft" },
    note: "Saving creates a draft quote summary only. It does not save menu lines, bind a customer, accept terms, make a booking, send a message or collect payment.",
    customerApprovalRecorded: false, moneyCollected: false, bookingCreated: false
  };
}
module.exports = { draftQuoteHandoff, POSTGRES_INT_MAX };
