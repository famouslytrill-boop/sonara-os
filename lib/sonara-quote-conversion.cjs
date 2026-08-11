"use strict";

// Turning a won quote into an invoice.
//
// `quotes` had a table, row level security and no page, and
// `customer_invoices.quote_id` was a column nothing ever wrote. The step
// between "they said yes" and "they have been billed" was the one a trades
// owner does at 10pm, retyping figures they already agreed.
//
// This is the owner acting, not an agent. lib/sonara-agent-authority.cjs
// governs what an agent may do without a person; a person pressing a button
// they can see is the person. Routing this through the runner would classify
// the owner's own click as an unrecognised agent action and refuse it, which
// would be the gate misfiring rather than working.
//
// Two rules, and both exist because getting them wrong bills somebody twice.

// Only a quote the customer accepted becomes an invoice. Sending a bill for
// work nobody agreed to is a worse error than not sending one, and "sent" is
// not "accepted" -- it is the state where the answer is still outstanding.
const CONVERTIBLE = Object.freeze(["accepted"]);

function reasonNotConvertible(quote, existingInvoices) {
  if (!quote || !quote.id) return "That quote is not one of yours.";

  const status = String(quote.status || "").toLowerCase();
  if (!CONVERTIBLE.includes(status)) {
    return status === "sent"
      ? "This quote has been sent and not accepted yet. Mark it accepted once the customer says yes, and it can become an invoice."
      : `A quote has to be accepted before it becomes an invoice. This one is ${status || "not set"}.`;
  }

  if (!quote.customer_id) {
    return "This quote is not attached to a customer, so an invoice from it would have nobody to go to. Set the customer on the quote first.";
  }

  const amount = Number(quote.amount_cents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "This quote has no amount, so there is nothing to bill. Add the amount to the quote first.";
  }

  // The check that matters. Without it, pressing the button twice -- or a
  // double submit, or a refresh -- bills the customer twice for one job, and
  // the second invoice looks exactly as legitimate as the first.
  const already = (Array.isArray(existingInvoices) ? existingInvoices : []).find((row) => row?.quote_id === quote.id);
  if (already) {
    return `This quote has already been invoiced as ${already.invoice_number || "an invoice"}. Open it rather than raising a second one.`;
  }

  return null;
}

/**
 * The invoice row a quote becomes.
 *
 * Deliberately a draft. Converting records that the work was agreed; deciding
 * it is ready to send is a separate judgement, and one an owner should make
 * looking at the invoice rather than as a side effect of pressing convert.
 *
 * No due date is set. Payment terms are not recorded anywhere in this product,
 * so any date here would be invented -- and an invented due date is worse than
 * none, because `customer_invoices_overdue` would then chase a deadline nobody
 * agreed to. The sent-without-due-date check catches the gap instead.
 */
function invoiceFromQuote(quote, { organizationId, userId = null, today = new Date() } = {}) {
  if (!organizationId) throw new TypeError("converting a quote requires an organizationId");

  return {
    organization_id: organizationId,
    customer_id: quote.customer_id,
    quote_id: quote.id,
    issued_on: today.toISOString().slice(0, 10),
    subtotal_cents: Number(quote.amount_cents),
    total_cents: Number(quote.amount_cents),
    status: "draft",
    notes: `From quote: ${String(quote.title || "").trim() || "untitled"}`,
    created_by: userId
  };
}

// The single line the invoice starts with, so it is not a total with nothing
// behind it. The owner can replace it with real lines afterwards.
function lineFromQuote(quote, { organizationId } = {}) {
  if (!organizationId) throw new TypeError("converting a quote requires an organizationId");
  return {
    organization_id: organizationId,
    description: String(quote.title || "").trim() || "Work as quoted",
    quantity: 1,
    unit_price_cents: Number(quote.amount_cents),
    line_total_cents: Number(quote.amount_cents)
  };
}

module.exports = { CONVERTIBLE, reasonNotConvertible, invoiceFromQuote, lineFromQuote };
