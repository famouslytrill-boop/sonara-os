"use strict";

// Money already promised, in both directions, laid out by when it is due.
//
// This is the arithmetic that `docs/market/2026-08-11-TRADES-AI-TOOL-STACK.md`
// records as tool six of twelve -- Float or Bauwise, from $49 a month. It runs
// over rows the business already owns, so it costs the customer nothing and
// needs no model behind it.
//
// **It is not a forecast, and the naming is deliberate.** A forecast predicts
// revenue that has not been promised yet. This adds up what has: invoices the
// business has sent, and bills it has received. Extrapolating a trend from
// those would be inventing the most consequential number on the screen, and an
// owner deciding whether payroll clears would have no way to tell the invented
// part from the counted part. So nothing here is extrapolated.
//
// Three rules follow from that, and each is a thing this could have got wrong.
//
// A row with no due date is **excluded and reported**, never dropped. An
// invoice that cannot be placed in time is real money that this view cannot
// schedule, and silently omitting it makes every total below look complete
// while being short by an unknown amount.
//
// There is **no closing balance**. This does not know the bank balance -- no
// table holds it -- so it reports movement only. A "position" computed from an
// opening balance of zero would read as the money the business has, which is a
// different and much more dangerous number.
//
// An **unreadable table is not an empty one**. If either side fails to load,
// the caller is told which one, and no total is presented as whole.

// Buckets in days from today. `overdue` is everything already past.
const PERIODS = Object.freeze([
  Object.freeze({ key: "overdue", label: "Already overdue", from: -Infinity, to: -1 }),
  Object.freeze({ key: "week", label: "Next 7 days", from: 0, to: 7 }),
  Object.freeze({ key: "month", label: "8 to 30 days", from: 8, to: 30 }),
  Object.freeze({ key: "sixty", label: "31 to 60 days", from: 31, to: 60 }),
  Object.freeze({ key: "ninety", label: "61 to 90 days", from: 61, to: 90 }),
  Object.freeze({ key: "later", label: "More than 90 days out", from: 91, to: Infinity })
]);

// What each side reads. Kept here rather than at the call site so the columns
// and the arithmetic that depends on them cannot drift apart.
const SOURCES = Object.freeze({
  incoming: Object.freeze({
    table: "customer_invoices",
    columns: ["id", "invoice_number", "due_on", "total_cents", "status"],
    dateColumn: "due_on",
    // Only a sent invoice is money anybody has been asked for. A draft is not
    // owed, and counting it would inflate the one side an owner most wants to
    // believe.
    counts: (row) => String(row?.status || "").toLowerCase() === "sent"
  }),
  outgoing: Object.freeze({
    table: "vendor_invoices",
    columns: ["id", "invoice_number", "due_date", "total_cents", "payment_status"],
    dateColumn: "due_date",
    counts: (row) => {
      const status = String(row?.payment_status || "").toLowerCase();
      return status !== "paid" && status !== "void" && status !== "refunded";
    }
  }),
  // Payments received reduce what an invoice still brings in. Without these the
  // incoming side would count a fully paid invoice at its full value for as
  // long as somebody left its status on "sent".
  received: Object.freeze({
    table: "customer_invoice_payments",
    columns: ["id", "invoice_id", "amount_cents"]
  })
});

function selectFor(key) {
  const source = SOURCES[key];
  if (!source) throw new TypeError(`no cash-position source named ${key}`);
  return source.columns.join(",");
}

function cents(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

// Whole days from today, in UTC. Comparing timestamps directly would put an
// invoice due later today into "overdue" purely because of the clock.
function daysUntil(value, now = Date.now()) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const due = Date.parse(String(value).slice(0, 10));
  if (!Number.isFinite(due)) return null;
  const today = Date.parse(new Date(now).toISOString().slice(0, 10));
  return Math.round((due - today) / 86400000);
}

function periodFor(days) {
  if (days === null) return null;
  return PERIODS.find((period) => days >= period.from && days <= period.to) || null;
}

// Sum payments per invoice so the incoming side can be net of what has arrived.
function paidByInvoice(rows) {
  const totals = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const invoiceId = row?.invoice_id;
    const amount = cents(row?.amount_cents);
    if (!invoiceId || amount === null) continue;
    totals.set(invoiceId, (totals.get(invoiceId) || 0) + amount);
  }
  return totals;
}

/**
 * Build the view.
 *
 * `incoming`, `outgoing` and `received` are each { ok, rows }. `ok: false`
 * means the read failed, which is reported rather than counted as zero.
 */
function build({ incoming, outgoing, received, now = Date.now() } = {}) {
  const unavailable = [];
  if (!incoming?.ok) unavailable.push("money owed to you");
  if (!outgoing?.ok) unavailable.push("bills you owe");
  // A failed payments read is different in kind: the incoming rows are still
  // readable, they are just not reduced by what has been paid. Overstating
  // money coming in is the wrong direction to be wrong in, so this counts as
  // unavailable too rather than quietly reporting gross as net.
  if (!received?.ok) unavailable.push("payments received");

  const periods = new Map(PERIODS.map((period) => [period.key, { ...period, incomingCents: 0, outgoingCents: 0, incomingCount: 0, outgoingCount: 0 }]));
  const undated = { incomingCount: 0, incomingCents: 0, outgoingCount: 0, outgoingCents: 0 };

  const paid = paidByInvoice(received?.ok ? received.rows : []);

  for (const row of incoming?.ok && Array.isArray(incoming.rows) ? incoming.rows : []) {
    if (!SOURCES.incoming.counts(row)) continue;
    const total = cents(row?.total_cents);
    if (total === null) continue;
    const outstanding = Math.max(0, total - (paid.get(row?.id) || 0));
    if (outstanding === 0) continue;

    const period = periodFor(daysUntil(row?.due_on, now));
    if (!period) {
      undated.incomingCount += 1;
      undated.incomingCents += outstanding;
      continue;
    }
    const bucket = periods.get(period.key);
    bucket.incomingCents += outstanding;
    bucket.incomingCount += 1;
  }

  for (const row of outgoing?.ok && Array.isArray(outgoing.rows) ? outgoing.rows : []) {
    if (!SOURCES.outgoing.counts(row)) continue;
    const total = cents(row?.total_cents);
    if (total === null) continue;

    const period = periodFor(daysUntil(row?.due_date, now));
    if (!period) {
      undated.outgoingCount += 1;
      undated.outgoingCents += total;
      continue;
    }
    const bucket = periods.get(period.key);
    bucket.outgoingCents += total;
    bucket.outgoingCount += 1;
  }

  const rows = PERIODS.map((period) => {
    const bucket = periods.get(period.key);
    return { ...bucket, netCents: bucket.incomingCents - bucket.outgoingCents };
  });

  const totalIncoming = rows.reduce((sum, row) => sum + row.incomingCents, 0);
  const totalOutgoing = rows.reduce((sum, row) => sum + row.outgoingCents, 0);

  return {
    // complete is the flag a caller must check before presenting any total as
    // the whole picture. Both an unreadable table and an undated row make it
    // false, because both mean money exists that these figures do not include.
    complete: unavailable.length === 0 && undated.incomingCount === 0 && undated.outgoingCount === 0,
    unavailable,
    undated,
    rows,
    totalIncoming,
    totalOutgoing,
    netCents: totalIncoming - totalOutgoing
  };
}

module.exports = { PERIODS, SOURCES, selectFor, daysUntil, periodFor, paidByInvoice, build };
