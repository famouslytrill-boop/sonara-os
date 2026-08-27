"use strict";

// The first thing in this product that actually sends a notification.
//
// `lib/sonara-web-push.cjs` could encrypt, `lib/sonara-push-subscriptions.cjs`
// could select and send, `/account/notifications` could subscribe, and
// `public/sw.js` could display -- and nothing in the application ever called
// `notify()`. A person could tick "An invoice is paid", grant permission, and
// wait for ever. That is this codebase's recurring defect in its purest form: a
// capability that is present, tested, reachable from a page, and joined to no
// event.
//
// This is the join. It runs when a payment is recorded against an invoice.
//
// ## Why a transition and not a state
//
// "The invoice is paid" is true of a settled invoice every time anybody touches
// it. Sending on the state means a business that records a correcting payment,
// or an overpayment, or a payment against an invoice that was already covered,
// gets told again that it was paid -- and a notification that repeats is a
// notification people turn off.
//
// So this computes the settlement **twice**: once over the payments as they
// stand, and once over the payments as they stood before the row that triggered
// it. A notification is sent only when those two disagree in the one direction
// that matters.
//
// That is also why it refuses when it cannot identify the new payment. Without
// the inserted row's id there is no "before", and the choice is between sending
// possibly-again and not sending. Not sending is the recoverable one: a missed
// notification is a page refresh, a duplicate is a reason to revoke permission.
//
// ## Being unable to check is not being unpaid
//
// Both reads carry their outcome rather than an array. `settle()` already
// distinguishes "no payments" from "no answer" and requires the caller to say
// which -- see `paymentsRead` there. A failed read here returns a code and
// sends nothing; it never falls through to "still owed", which is the shape
// that would silently disable this for an organization whose payments table
// went unreadable.
//
// ## What an unreadable amount does NOT do
//
// `totalPaid` skips a payment whose amount cannot be read, so `paidCents` is a
// **lower bound** on what has been received. A settlement that reads `paid` on
// a lower bound is therefore still genuinely covered, and `certain: false` is
// about how much was paid rather than about whether it was enough. So this
// sends on an uncertain settlement too -- deliberately, and stated here because
// the opposite reading looks equally reasonable and is wrong.

const { settle } = require("./sonara-invoice-settlement.cjs");
const store = require("./sonara-push-subscriptions.cjs");

const TOPIC = "invoice_paid";

// The two settlement statuses that mean the money is in. `overpaid` counts:
// somebody who has been paid too much has still been paid, and the receivables
// page is where the refund is dealt with.
const COVERED = Object.freeze(["paid", "overpaid"]);

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

/**
 * Cents to something a person reads on a lock screen.
 *
 * Intl is used when it knows the currency and the plain form when it does not,
 * rather than letting an unrecognised code throw inside a notification path.
 * A notification that fails to format is a notification nobody gets.
 */
function money(cents, currency) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return "";
  const code = String(currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${code}`;
  }
}

function invoiceName(invoice) {
  const number = String(invoice?.invoice_number || "").trim();
  return number ? `Invoice ${number}` : "An invoice";
}

/**
 * The push payload for a settled invoice.
 *
 * Exported separately from the sending so the wording can be checked without a
 * database, a push service, or a browser. The `tag` is the invoice id, so a
 * second notification about the same invoice replaces the first on the lock
 * screen rather than stacking beneath it.
 */
function paidPayload(invoice, settlement) {
  const name = invoiceName(invoice);
  const total = money(settlement.totalCents, settlement.currency);
  const body = settlement.status === "overpaid"
    // Said plainly rather than as good news. More money arrived than was
    // charged, and the business owes it back -- burying that under "paid in
    // full" is how an overpayment goes unnoticed for a quarter.
    ? `${total} was due and more than that came in. ${money(settlement.overpaidCents, settlement.currency)} is owed back.`
    : `${total} has been received in full.`;
  return {
    title: "Invoice paid",
    body: `${name}: ${body}`,
    path: `/business-builder/owner/invoices/${invoice.id}`,
    tag: `invoice-paid-${invoice.id}`
  };
}

/**
 * Read an invoice and its payments, decide whether this payment settled it, and
 * notify if it did.
 *
 * Returns `{ ok, notified, reason }` -- never throws, because it runs after a
 * payment has already been saved and a failure to notify must not turn a saved
 * payment into an error the person sees.
 *
 * `deps` is the shape `lib/sonara-push-subscriptions.cjs` wants:
 * `{ getEnv, supabaseUrl, serviceRoleHeaders }`.
 */
async function announcePayment(deps, { organizationId, invoiceId, paymentId }, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const notifyImpl = options.notify || store.notify;

  if (!organizationId) return { ok: false, notified: false, reason: "no_organization" };
  if (!isUuid(invoiceId)) return { ok: false, notified: false, reason: "no_invoice" };
  // No id for the row just written means no "before" to compare against. See
  // the header: this refuses rather than guessing.
  if (!isUuid(paymentId)) return { ok: false, notified: false, reason: "no_payment_id" };

  const scope = `organization_id=eq.${encodeURIComponent(organizationId)}`;

  async function read(path) {
    let response;
    try {
      response = await fetchImpl(`${deps.supabaseUrl}/rest/v1/${path}`, { headers: deps.serviceRoleHeaders() });
    } catch {
      return { ok: false, rows: [] };
    }
    if (!response?.ok) return { ok: false, rows: [] };
    let rows;
    try {
      rows = await response.json();
    } catch {
      return { ok: false, rows: [] };
    }
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  }

  const invoiceRead = await read(
    `customer_invoices?select=id,invoice_number,total_cents,currency&id=eq.${encodeURIComponent(invoiceId)}&${scope}&limit=1`
  );
  if (!invoiceRead.ok) return { ok: false, notified: false, reason: "invoice_unreadable" };
  const invoice = invoiceRead.rows[0];
  // An empty list here is a real answer: no invoice with that id belongs to
  // this organization. Distinct from the unreadable case above, and neither is
  // a reason to send anything.
  if (!invoice) return { ok: false, notified: false, reason: "invoice_not_found" };

  const paymentsRead = await read(
    `customer_invoice_payments?select=id,amount_cents&invoice_id=eq.${encodeURIComponent(invoiceId)}&${scope}`
  );
  if (!paymentsRead.ok) return { ok: false, notified: false, reason: "payments_unreadable" };

  const payments = paymentsRead.rows;
  if (!payments.some((row) => row.id === paymentId)) {
    // The payment was saved and is not in the list we just read. Rather than
    // treat that as "before equals after", say so: it means the two reads
    // disagree, and sending on a disagreement is guessing.
    return { ok: false, notified: false, reason: "payment_not_listed" };
  }

  const after = settle({ invoice, payments, paymentsRead: true });
  const before = settle({ invoice, payments: payments.filter((row) => row.id !== paymentId), paymentsRead: true });

  if (!COVERED.includes(after.status)) return { ok: true, notified: false, reason: "still_owed" };
  if (COVERED.includes(before.status)) return { ok: true, notified: false, reason: "already_settled" };

  const result = await notifyImpl(deps, { organizationId, topic: TOPIC, payload: paidPayload(invoice, after) }, { fetchImpl });
  if (!result?.ok) return { ok: false, notified: false, reason: result?.code || "not_sent" };
  return { ok: true, notified: true, reason: "sent", sent: result.sent, considered: result.considered, removed: result.removed };
}

module.exports = { TOPIC, COVERED, money, invoiceName, paidPayload, announcePayment };
