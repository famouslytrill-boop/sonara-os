"use strict";

// What a customer may show somebody who is not in their workspace.
//
// Four things are shareable: a saved tool result, a quote, an invoice, and an
// appointment. Each is something a business sends to one person outside the
// workspace, and until there was a link for it each left this product as a
// screenshot or not at all.
//
// ## One table, not a column on four
//
// The first version of this put share_token and shared_at on module_outputs.
// That was right for one shareable type and wrong for four: four places to
// revoke from, four indexes, and a /shared/:token route that has to guess which
// table a token belongs to. `shared_links` replaced it in migration
// 20260819070000, which also dropped those columns.
//
// ## The rule the whole design turns on
//
// module_outputs and the three record tables are read with the service-role key,
// which bypasses row level security. The organization_id filter in the query is
// therefore the entire tenant boundary -- and a public page has no organization
// to filter by, because anybody may open it.
//
// The resolution order is what makes that safe. A token finds exactly one
// shared_links row; that row names both the resource AND the organization it
// belongs to; and the resource is then fetched filtered on both. So the public
// page never chooses an organization -- it is told one by the row the customer
// created when they pressed Share. A page that took the organization from the
// request would be a page that could be told the wrong one.
//
// ## What never travels
//
// Per type, the columns a public page may select are written down and the
// columns it may not are written down beside them. Two rules run through all
// four:
//
//   * **No contact details, ever.** Not the customer's email, not their phone,
//     not the employee's name. A link gets forwarded, and the person who
//     forwards it is not deciding to publish somebody else's phone number.
//   * **No internal note, no metadata, no created_by.** `notes` on an invoice is
//     where a business writes things about a customer, not for them.

const crypto = require("node:crypto");

// 24 random bytes, base64url: 32 characters of [A-Za-z0-9_-], 192 bits.
// The link is the only credential -- there is no second check behind it, because
// the point is that somebody with no account can open it -- so it has to be
// unguessable rather than merely unlikely. A sequential id or a time-derived
// uuid would both fail that.
const SHARE_TOKEN_BYTES = 24;
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const SHARED_LINKS_TABLE = "shared_links";

function mintShareToken() {
  return crypto.randomBytes(SHARE_TOKEN_BYTES).toString("base64url");
}

// Checked before the token reaches a query. The length is fixed rather than
// bounded: a pattern accepting any length accepts the empty string, and
// `token=eq.` matches every row whose token is empty -- the same shape of
// mistake as an organization filter with nothing after the `eq.`.
function isShareToken(value) {
  return typeof value === "string" && SHARE_TOKEN_PATTERN.test(value);
}

function sharePath(token) {
  return isShareToken(token) ? `/shared/${token}` : null;
}

function shareUrl(origin, token) {
  const path = sharePath(token);
  return path ? `${String(origin || "").replace(/\/+$/, "")}${path}` : null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

// Money is stored in integer cents everywhere in this repository, and rendering
// it means dividing by a hundred exactly once, at the edge. `finiteNumber`
// exists because Number(null) is 0, and a nil price rendered as $0.00 tells
// somebody their invoice is free.
function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(cents, currency = "usd") {
  const amount = finiteNumber(cents);
  if (amount === null) return null;
  const symbol = { usd: "$", gbp: "£", eur: "€", cad: "CA$", aud: "A$" }[String(currency || "usd").toLowerCase()];
  const rendered = (amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${symbol}${rendered}` : `${rendered} ${String(currency).toUpperCase()}`;
}

function formatDay(value) {
  if (!value) return null;
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function formatDayAndTime(value) {
  if (!value) return null;
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return null;
  // UTC, and said so on the page. Rendering a server's idea of local time at
  // somebody in another country is worse than an unambiguous label.
  return `${when.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}, `
    + `${when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

function humanLabel(key) {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

// ---------------------------------------------------------------------------
// The four shareable types
// ---------------------------------------------------------------------------

const MAX_SHARED_LINES = 12;
const MAX_SHARED_VALUE_LENGTH = 400;

// A saved tool result. Free-form JSON per tool, so the flat short values are
// shown and anything nested is skipped -- printing [object Object] at somebody
// is worse than omitting a line.
function presentableLines(outputPayload) {
  return Object.entries(outputPayload && typeof outputPayload === "object" ? outputPayload : {})
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .map(([key, value]) => ({ label: humanLabel(key), value: String(value).trim() }))
    .filter((line) => line.value && line.value.length <= MAX_SHARED_VALUE_LENGTH)
    .slice(0, MAX_SHARED_LINES);
}

function moduleOutputView(row) {
  const supplied = row?.output_payload?.title || row?.output_payload?.heading;
  const title = typeof supplied === "string" && supplied.trim() && supplied.length <= 120
    ? supplied.trim()
    : humanLabel(String(row?.module_key || "").trim()) || "A saved result";
  return {
    kind: "result",
    title,
    subtitle: formatDay(row?.created_at) ? `Worked out on ${formatDay(row.created_at)}` : null,
    lines: presentableLines(row?.output_payload),
    footnote: "Worked out with the free SONARA One tools, and published by the person who made it."
  };
}

function quoteView(row) {
  const amount = money(row?.amount_cents);
  return {
    kind: "quote",
    title: String(row?.title || "").trim() || "Quote",
    subtitle: formatDay(row?.created_at) ? `Prepared on ${formatDay(row.created_at)}` : null,
    lines: [
      // "Not set" rather than $0.00. An unpriced quote is not a free one, and
      // Number(null) is 0 -- which is how twenty-three columns once read as free.
      { label: "Amount", value: amount || "Not set" },
      { label: "Status", value: humanLabel(row?.status || "draft") }
    ],
    footnote: "A quote is an offer, not a bill. Nothing is owed until it is accepted and invoiced."
  };
}

function invoiceView(row, lines = []) {
  const currency = row?.currency || "usd";
  const detail = [];
  if (row?.invoice_number) detail.push({ label: "Invoice", value: String(row.invoice_number) });
  if (formatDay(row?.issued_on)) detail.push({ label: "Issued", value: formatDay(row.issued_on) });
  if (formatDay(row?.due_on)) detail.push({ label: "Due", value: formatDay(row.due_on) });
  const subtotal = money(row?.subtotal_cents, currency);
  const tax = money(row?.tax_cents, currency);
  const total = money(row?.total_cents, currency);
  if (subtotal) detail.push({ label: "Subtotal", value: subtotal });
  if (tax && finiteNumber(row?.tax_cents) > 0) detail.push({ label: "Tax", value: tax });
  detail.push({ label: "Total", value: total || "Not set" });
  detail.push({ label: "Status", value: humanLabel(row?.status || "draft") });
  return {
    kind: "invoice",
    title: row?.invoice_number ? `Invoice ${row.invoice_number}` : "Invoice",
    subtitle: formatDay(row?.issued_on) ? `Issued ${formatDay(row.issued_on)}` : null,
    lines: detail,
    // Stored line totals rather than recomputed, matching the reasoning written
    // into migration 20260811234500: a line total is what the business decided
    // to charge, and recomputing it would overwrite a discount they applied.
    items: (Array.isArray(lines) ? lines : []).map((line) => ({
      description: String(line?.description || "").trim() || "Item",
      quantity: finiteNumber(line?.quantity),
      unitPrice: money(line?.unit_price_cents, currency),
      total: money(line?.line_total_cents, currency)
    })),
    footnote: "This is a copy of an invoice, shown for reference. Pay it the way you agreed with the business that sent it -- never from a link."
  };
}

function bookingView(row) {
  const starts = formatDayAndTime(row?.starts_at);
  const ends = formatDayAndTime(row?.ends_at);
  const lines = [];
  lines.push({ label: "When", value: starts || "Not set" });
  if (ends && starts) lines.push({ label: "Until", value: ends });
  lines.push({ label: "Status", value: humanLabel(row?.status || "requested") });
  return {
    kind: "appointment",
    title: "Your appointment",
    subtitle: starts,
    lines,
    footnote: "Times are shown in UTC. Check with the business if you are not sure what that is where you are."
  };
}

// Per type: which table, which columns a public page may select, which it may
// never, and how the row becomes a page.
//
// The forbidden list is not decoration. It is what
// tests/a-shared-link-is-a-link-not-a-leak.test.js asserts the select against,
// so widening a select without deciding to fails the build rather than shipping.
const SHAREABLE = Object.freeze({
  module_output: Object.freeze({
    table: "module_outputs",
    noun: "result",
    columns: Object.freeze(["id", "module_key", "product_key", "output_payload", "created_at"]),
    forbidden: Object.freeze(["input_payload", "user_id"]),
    view: moduleOutputView
  }),
  quote: Object.freeze({
    table: "quotes",
    noun: "quote",
    columns: Object.freeze(["id", "title", "amount_cents", "status", "created_at"]),
    forbidden: Object.freeze(["customer_id", "created_by", "metadata"]),
    view: quoteView
  }),
  customer_invoice: Object.freeze({
    table: "customer_invoices",
    noun: "invoice",
    columns: Object.freeze(["id", "invoice_number", "issued_on", "due_on", "subtotal_cents", "tax_cents", "total_cents", "currency", "status"]),
    // `notes` is where a business writes things about a customer, not for them.
    forbidden: Object.freeze(["notes", "customer_id", "quote_id", "created_by", "metadata"]),
    lines: Object.freeze({
      table: "customer_invoice_lines",
      foreignKey: "invoice_id",
      columns: Object.freeze(["description", "quantity", "unit_price_cents", "line_total_cents"]),
      forbidden: Object.freeze(["metadata", "service_id"])
    }),
    view: invoiceView
  }),
  business_booking: Object.freeze({
    table: "business_bookings",
    noun: "appointment",
    columns: Object.freeze(["id", "starts_at", "ends_at", "status"]),
    // Every contact column is forbidden, including the customer's own. A link
    // gets forwarded, and whoever forwards it is not deciding to publish a phone
    // number. The person who booked already knows their own name.
    forbidden: Object.freeze(["customer_name", "customer_email", "customer_phone", "notes", "assigned_employee_id", "customer_id", "metadata"]),
    view: bookingView
  })
});

const SHAREABLE_TYPES = Object.freeze(Object.keys(SHAREABLE));

// Columns no shared page of any type may select. The per-type lists above are
// specific; these are the ones that would be a mistake anywhere.
const NEVER_SHARED_COLUMNS = Object.freeze(["organization_id", "metadata", "created_by", "user_id"]);

function shareableFor(resourceType) {
  return Object.prototype.hasOwnProperty.call(SHAREABLE, String(resourceType)) ? SHAREABLE[resourceType] : null;
}

/**
 * Everything a shared page renders, from a link row and the resource it names.
 * Returned as data rather than markup so a test can assert what is in it
 * without searching HTML for the absence of a thing.
 */
function sharedView({ resourceType, row, lines = [], organizationName = "" } = {}) {
  const shareable = shareableFor(resourceType);
  if (!shareable || !row || typeof row !== "object") return null;
  const view = shareable.view(row, lines);
  return {
    ...view,
    noun: shareable.noun,
    // The business that published it, taken from the link row's organization --
    // never from anything in the request.
    from: String(organizationName || "").trim() || null
  };
}

module.exports = {
  MAX_SHARED_LINES,
  MAX_SHARED_VALUE_LENGTH,
  NEVER_SHARED_COLUMNS,
  SHAREABLE,
  SHAREABLE_TYPES,
  SHARED_LINKS_TABLE,
  SHARE_TOKEN_PATTERN,
  finiteNumber,
  formatDay,
  formatDayAndTime,
  humanLabel,
  isShareToken,
  isUuid,
  mintShareToken,
  money,
  presentableLines,
  sharePath,
  shareUrl,
  shareableFor,
  sharedView
};
