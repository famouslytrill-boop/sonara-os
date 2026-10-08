// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What the customers a campaign brought in have actually paid.
//
// A campaign's return was worked out from growth_conversions alone, and every
// row there is typed in by hand. Meanwhile the same business invoices the
// customers its campaigns find and records what they pay, and three columns
// already say which campaign found whom: growth_leads.campaign_id (the campaign
// that brought the person in), growth_leads.customer_id (the customer they
// became), and customer_invoices.customer_id with its payments. Nothing joined
// them, so a campaign whose customers had paid thousands showed whatever
// somebody had remembered to record.
//
// The rules, each a way this figure could claim more than happened.
//
// The first two cannot be triggered through the product as it stands, and that
// was checked rather than assumed (8 October 2026): the only writer of
// growth_leads.customer_id is the conversion route in
// routes/growth-studio-control-routes.cjs, which creates a new customer from
// the lead and refuses when one with that email exists. So a customer never
// predates their lead and two leads never share one. The rules hold for rows
// that arrive any other way -- an import, a database edit, or the "link the
// lead to them" step that refusal already asks the owner for and nothing yet
// performs. When that step is built, these are what keep this page honest.
//
//   - The first campaign wins. A customer who came in through two campaigns is
//     counted under the earlier one only, so two campaign pages never both
//     claim one payment. This is the `first_touch` model growth_conversions
//     already names. A tie on the timestamp goes to the lower campaign id, so
//     exactly one campaign has it.
//   - Counted from the day they came in. What somebody paid before this
//     campaign found them is not this campaign's. The day is the lead's UTC
//     date and a payment's received_on is the date the owner recorded, so a
//     payment made on the same evening in a timezone behind UTC can fall
//     outside. That is the side to err on for a figure that says what a
//     campaign earned.
//   - A payment's currency is its invoice's. Per currency, never across them.
//   - Signed. A correction recorded as a negative payment reduces the total,
//     as it does on the invoice (lib/sonara-invoice-settlement.cjs).
//   - A row that cannot be read -- no amount, no date, an invoice with no
//     currency -- is counted apart and adds nothing. A failed read, or one too
//     large to be sure which campaign found a customer first, withholds the
//     whole figure rather than reporting what happened to come back.
//   - Not added to recorded conversions. The same sale may be in both, and a
//     sum would count it twice. The page shows the two side by side.
//
// Pure: the route reads the rows and hands them here with their read outcomes.

const settlement = require("./sonara-invoice-settlement.cjs");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (value) => (typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null);

// More customers than this from one campaign are read in part, and every
// figure built on them is marked as a lower bound.
const MAX_CUSTOMERS = 500;

// An invoice is owed against only while it is out with the customer. A draft
// has not been sent, and void, written off and paid have been decided.
const OPEN_INVOICE = "sent";

function currencyOf(value) {
  const code = String(value || "").trim().toLowerCase();
  return /^[a-z]{3}$/.test(code) ? code : null;
}

function cents(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^-?\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

// The UTC date of a timestamp or a date, or null.
function dayOf(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

function instant(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** The customers to read for a campaign's leads: distinct, sorted, capped. */
function customersToRead(leadRows) {
  const ids = [...new Set((Array.isArray(leadRows) ? leadRows : []).map((row) => uuid(row?.customer_id)).filter(Boolean))].sort();
  return { ids: ids.slice(0, MAX_CUSTOMERS), truncated: ids.length > MAX_CUSTOMERS };
}

/**
 * @param {object} input
 * @param {string} input.campaignId
 * @param {{ok, rows, truncated?}} input.leads          this campaign's leads: customer_id, created_at
 * @param {{ok, rows, truncated?}} input.customerLeads  every campaign-credited lead of those customers: customer_id, campaign_id, created_at
 * @param {{ok, rows, truncated?}} input.invoices       their invoices: id, customer_id, currency, status, total_cents, issued_on, created_at
 * @param {{ok, rows, truncated?}} input.payments       payments against those invoices: invoice_id, amount_cents, received_on
 * @param {boolean} [input.customersTruncated]          more customers than were read
 */
function summarizeCampaignPayments({ campaignId, leads, customerLeads, invoices, payments, customersTruncated = false } = {}) {
  const campaign = uuid(campaignId);
  const reads = { leads, customerLeads, invoices, payments };
  if (!campaign || Object.values(reads).some((result) => !result || result.ok !== true || !Array.isArray(result.rows))) {
    return { unreadable: true };
  }
  // Which campaign found a customer first is a question about every one of
  // their leads. A list cut short may be missing the earlier one, and the
  // answer would then credit this campaign with somebody it did not find.
  if (customerLeads.truncated === true) return { unreadable: true };

  const { ids: readable } = customersToRead(leads.rows);
  const readSet = new Set(readable);

  // The day each customer came in through this campaign: their earliest lead here.
  const cameInHere = new Map();
  let unreadableCustomers = 0;
  const undatedHere = new Set();
  for (const row of leads.rows) {
    const customer = uuid(row?.customer_id);
    if (!customer || !readSet.has(customer)) continue;
    const at = instant(row?.created_at);
    if (at === null) { undatedHere.add(customer); continue; }
    if (!cameInHere.has(customer) || at < cameInHere.get(customer)) cameInHere.set(customer, at);
  }

  // The first campaign that brought each customer in, across all of them.
  const first = new Map();
  const undecidable = new Set();
  for (const row of customerLeads.rows) {
    const customer = uuid(row?.customer_id);
    const owner = uuid(row?.campaign_id);
    if (!customer || !readSet.has(customer) || !owner) continue;
    const at = instant(row?.created_at);
    if (at === null) { undecidable.add(customer); continue; }
    const seen = first.get(customer);
    if (!seen || at < seen.at || (at === seen.at && owner < seen.campaign)) first.set(customer, { at, campaign: owner });
  }

  const counted = new Map();
  let countedElsewhere = 0;
  for (const customer of readable) {
    if (undatedHere.has(customer) && !cameInHere.has(customer)) { unreadableCustomers += 1; continue; }
    if (undecidable.has(customer)) { unreadableCustomers += 1; continue; }
    const winner = first.get(customer);
    const here = cameInHere.get(customer);
    // The customer's own leads include this campaign's. Missing from them means
    // the two reads disagree, and neither answer can be trusted.
    if (!winner || here === undefined) { unreadableCustomers += 1; continue; }
    if (winner.campaign !== campaign) { countedElsewhere += 1; continue; }
    counted.set(customer, new Date(here).toISOString().slice(0, 10));
  }

  const lines = new Map();
  const line = (currency) => {
    if (!lines.has(currency)) lines.set(currency, { currency, receivedCents: 0, payments: 0, outstandingCents: 0, openInvoices: 0 });
    return lines.get(currency);
  };
  const unreadableRows = { invoices: 0, payments: 0 };

  const invoiceById = new Map();
  for (const row of invoices.rows) {
    const id = uuid(row?.id);
    const customer = uuid(row?.customer_id);
    if (!id || !customer || !counted.has(customer)) continue;
    invoiceById.set(id, row);
  }

  const paymentsByInvoice = new Map();
  let beforeTheyCameIn = 0;
  for (const row of payments.rows) {
    const invoiceId = uuid(row?.invoice_id);
    const invoice = invoiceId ? invoiceById.get(invoiceId) : undefined;
    if (!invoice) continue;
    if (!paymentsByInvoice.has(invoiceId)) paymentsByInvoice.set(invoiceId, []);
    paymentsByInvoice.get(invoiceId).push(row);
    const amount = cents(row?.amount_cents);
    const currency = currencyOf(invoice.currency);
    const received = dayOf(row?.received_on);
    if (amount === null || !currency || !received) { unreadableRows.payments += 1; continue; }
    if (received < counted.get(uuid(invoice.customer_id))) { beforeTheyCameIn += 1; continue; }
    const target = line(currency);
    target.receivedCents += amount;
    target.payments += 1;
  }

  // What is still owed on invoices sent to them since they came in. The
  // balance is the invoice's own (lib/sonara-invoice-settlement.cjs), so the
  // figure here and the one on the invoice cannot disagree.
  for (const [id, invoice] of invoiceById) {
    if (String(invoice.status || "") !== OPEN_INVOICE) continue;
    const issued = dayOf(invoice.issued_on) || dayOf(invoice.created_at);
    const currency = currencyOf(invoice.currency);
    if (!issued || !currency) { unreadableRows.invoices += 1; continue; }
    if (issued < counted.get(uuid(invoice.customer_id))) continue;
    const settled = settlement.settle({ invoice: { ...invoice, currency }, payments: paymentsByInvoice.get(id) || [], paymentsRead: true });
    if (settled.status === "unknown" || settled.status === "unpriced") { unreadableRows.invoices += 1; continue; }
    if (settled.outstandingCents > 0) {
      const target = line(currency);
      target.outstandingCents += settled.outstandingCents;
      target.openInvoices += 1;
    }
  }

  return {
    unreadable: false,
    customers: counted.size,
    countedElsewhere,
    unreadableCustomers,
    beforeTheyCameIn,
    byCurrency: [...lines.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    unreadableRows,
    // Some rows were not read. Payments are signed, so a row not read could
    // raise or lower every figure here: no bound is claimed, and no return is
    // worked out from them.
    truncated: customersTruncated === true || leads.truncated === true || invoices.truncated === true || payments.truncated === true
  };
}

module.exports = { MAX_CUSTOMERS, OPEN_INVOICE, customersToRead, summarizeCampaignPayments };
