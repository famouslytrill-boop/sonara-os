"use strict";

// What is actually still owed on an invoice.
//
// The product has known the total since customer_invoices landed and has never
// known the balance. `/shared/:token` renders an invoice with its total and its
// status, so a business that has taken a deposit shows its customer the whole
// figure again -- and the customer either pays twice or, much more likely,
// stops trusting the paperwork.
//
// lib/sonara-chase-drafts.cjs already subtracts payments, and deliberately does
// two things this must not:
//
//   Math.max(0, total - paid)   -- an overpayment reads as settled, which is
//                                  right when deciding whether to chase and
//                                  wrong on a statement somebody is owed money
//                                  against.
//   paidByInvoice.get(id) || 0  -- a payments table nobody could read looks
//                                  identical to an invoice nobody has paid.
//
// Both are correct there and neither is correct here, which is why this is a
// separate module rather than a shared helper with a flag.
//
// ## Why it is not "pay this invoice"
//
// That was the ask, and it is not built, for two reasons that are worth writing
// down where the next person will find them.
//
// **There is no Stripe Connect in this application.** No connected-account
// model, no `on_behalf_of`, no `transfer_data`, no table holding a business's
// Stripe account -- the only integration is SONARA's own subscription billing.
// A pay button would therefore take a small business's customer's money into
// SONARA's account with no mechanism to pay it out. That is money custody, not
// a missing endpoint, and it needs a Connect platform account the owner has to
// enable before a line of it can be written.
//
// **The shared invoice already tells its reader not to.** Its footnote says to
// pay the way they agreed with the business and never from a link, because a
// forwarded invoice with a pay button is exactly the shape of a payment-
// redirection fraud. That advice only works if it is always true: a product
// where some shared invoices have a pay button and some do not has taught its
// customers that a pay button on an invoice link is normal.
//
// So this computes and shows the balance, which is the half that is honest
// today and the half any payment integration would need underneath.

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Statuses in the order a person would read them, and each one distinct from
// the others in what it licenses a page to say.
//
//   unknown    -- the payments could not be read. Says nothing about the balance.
//   unpriced   -- the invoice has no total. Nothing can be owed against it.
//   outstanding-- nothing has been paid
//   part_paid  -- some has
//   paid       -- exactly settled
//   overpaid   -- more came in than was charged, and somebody is owed a refund
const STATUSES = Object.freeze(["unknown", "unpriced", "outstanding", "part_paid", "paid", "overpaid"]);

/**
 * Add up the payments recorded against one invoice.
 *
 * `payments` is the rows for THIS invoice. A row whose amount cannot be read is
 * counted as unreadable rather than as zero -- a payment of an unknown amount
 * is not a payment of nothing, and treating it as nothing would show a customer
 * a balance that is too high.
 */
function totalPaid(payments) {
  let cents = 0;
  let unreadable = 0;
  for (const payment of Array.isArray(payments) ? payments : []) {
    const amount = finiteNumber(payment?.amount_cents);
    if (amount === null) { unreadable += 1; continue; }
    cents += amount;
  }
  return { cents, unreadable };
}

/**
 * What is still owed, and how confident that figure is.
 *
 * `paymentsRead` must be false when the payments could not be fetched. It is a
 * required decision rather than something inferred from an empty list, because
 * "no payments" and "no answer" arrive at this function looking identical and
 * only the caller knows which happened.
 */
function settle({ invoice = {}, payments = [], paymentsRead = true } = {}) {
  const currency = String(invoice?.currency || "usd");
  const totalCents = finiteNumber(invoice?.total_cents);

  if (!paymentsRead) {
    return {
      status: "unknown", currency, totalCents,
      paidCents: null, outstandingCents: null, overpaidCents: null,
      certain: false,
      // Written for a customer, not an operator. "Error reading payments" tells
      // them nothing they can act on; this tells them the number they are
      // looking at may already be settled.
      note: "We could not check what has already been paid, so this may not be what is still owed."
    };
  }

  const { cents: paidCents, unreadable } = totalPaid(payments);

  if (totalCents === null) {
    return {
      status: "unpriced", currency, totalCents: null,
      paidCents, outstandingCents: null, overpaidCents: null,
      certain: unreadable === 0,
      note: "This invoice has no total on it, so nothing can be worked out as owed."
    };
  }

  const difference = totalCents - paidCents;
  const outstandingCents = Math.max(0, difference);
  // Kept rather than clamped away. Money taken twice is a refund somebody owes,
  // and an invoice that renders as "paid" is how it stays unnoticed.
  const overpaidCents = difference < 0 ? -difference : 0;

  let status;
  if (overpaidCents > 0) status = "overpaid";
  else if (outstandingCents === 0) status = "paid";
  else if (paidCents > 0) status = "part_paid";
  else status = "outstanding";

  return {
    status, currency, totalCents, paidCents, outstandingCents, overpaidCents,
    // One payment with an unreadable amount makes every figure here a lower
    // bound on what has been paid, which is an upper bound on what is owed.
    certain: unreadable === 0,
    note: unreadable > 0
      ? `${unreadable} payment${unreadable === 1 ? " has" : "s have"} no amount recorded, so what is owed may be less than this.`
      : null
  };
}

/**
 * Group payment rows by the invoice they belong to.
 *
 * Rows with no invoice_id are returned separately rather than dropped: a
 * payment attached to nothing is money the business has that no invoice knows
 * about, and silently ignoring it is how a reconciliation goes wrong.
 */
function byInvoice(payments) {
  const map = new Map();
  const unattached = [];
  for (const payment of Array.isArray(payments) ? payments : []) {
    const invoiceId = payment?.invoice_id || null;
    if (!invoiceId) { unattached.push(payment); continue; }
    if (!map.has(invoiceId)) map.set(invoiceId, []);
    map.get(invoiceId).push(payment);
  }
  return { map, unattached };
}

// The sentence a customer reads on a shared invoice, and an owner reads on the
// receivables page. Deliberately never says "paid in full" for a status this is
// not sure about.
function describe(settlement, money) {
  const amount = (cents) => (typeof money === "function" ? money(cents, settlement.currency) : String(cents));
  switch (settlement.status) {
    case "unknown": return "Still owed: we could not check.";
    case "unpriced": return "This invoice has no total on it.";
    case "paid": return settlement.certain ? "Paid in full." : `Recorded payments cover the total, though ${settlement.note}`;
    case "overpaid": return `Overpaid by ${amount(settlement.overpaidCents)}. The business owes this back.`;
    case "part_paid": return `${amount(settlement.paidCents)} received, ${amount(settlement.outstandingCents)} still owed.`;
    default: return `${amount(settlement.outstandingCents)} still owed. Nothing has been recorded against it yet.`;
  }
}

module.exports = { STATUSES, totalPaid, settle, byInvoice, describe };
