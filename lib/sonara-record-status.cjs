"use strict";

// Changing the one field on a record whose whole purpose is to change.
//
// Twenty-seven owner record pages let a business create records and read them
// back. **None of them let anybody change one.** Eleven declare a `status`
// select in their create form — draft, sent, accepted, confirmed, received —
// and every one of those values was fixed at the moment the record was typed
// in.
//
// That is not a missing convenience. Three places in this product tell somebody
// to do a thing this product does not offer:
//
//   lib/sonara-quote-conversion.cjs, refusing to make an invoice:
//     "Mark it accepted once the customer says yes, and it can become an
//      invoice."
//   The public booking page, to a stranger who just booked:
//     "A request is not an appointment until the business accepts it."
//   lib/sonara-booking-notice.cjs, to the business:
//     "Not confirmed until you accept it."
//
// The first one matters most, because quote → invoice is gated on `accepted`
// and nothing could reach it. Invoices, the payments recorded against them, the
// settlement, the receivables page and the invoice-paid notification are all
// downstream of a status change that could not be made.
//
// ## Why the options come from the page and not from here
//
// Each table has its own `check` constraint and its own vocabulary: a purchase
// order goes `partially_received`, a booking goes `no_show`, a quote goes
// `declined`. The create form already declares exactly those, and the database
// enforces them. A second list here would be a third copy, and the one most
// likely to drift — so this reads the page's own declaration and validates
// against it. A status the form would not offer is a status this refuses.
//
// ## What it deliberately does not do
//
// **It does not decide whether a transition makes sense.** Nothing here refuses
// `paid` → `draft`, and that is a decision rather than an omission: a business
// correcting a mistake is the ordinary case, and a workflow engine that has to
// be argued with is how people end up keeping the real records somewhere else.
// The database's own constraint is the boundary; this stops anything outside it
// and stays out of the way inside it.
//
// **It does not touch money.** Marking an invoice `paid` here changes a label.
// It writes no payment, and `lib/sonara-invoice-settlement.cjs` still computes
// what is owed from `customer_invoice_payments` alone — so the receivables page
// keeps telling the truth whatever the label says. The two are independent on
// purpose, and it is worth saying out loud rather than discovering later.

/** The status field a page declares, or null when it declares none. */
function statusFieldFor(page) {
  const fields = page?.form?.fields;
  if (!Array.isArray(fields)) return null;
  const field = fields.find((entry) => entry?.name === "status" && entry?.type === "select");
  if (!field || !Array.isArray(field.options) || field.options.length < 2) return null;
  return field;
}

/** Whether this page has a status somebody could change. */
function hasStatus(page) {
  return statusFieldFor(page) !== null;
}

/** The values this page's status may take. Always a fresh array. */
function statusOptionsFor(page) {
  const field = statusFieldFor(page);
  return field ? [...field.options] : [];
}

/**
 * Whether a requested status is one this page allows.
 *
 * Returns `{ ok }` or `{ ok: false, code, detail }`. The detail is written for
 * the person who pressed the button: a status the database rejects surfaces as
 * a check-constraint violation nobody outside the route can read, which is the
 * error this exists to turn into a sentence.
 */
function validateStatus(page, requested) {
  const options = statusOptionsFor(page);
  if (!options.length) return { ok: false, code: "no_status_field", detail: "This kind of record does not have a status." };
  const wanted = String(requested ?? "");
  if (!wanted) return { ok: false, code: "status_required", detail: "Choose a status first." };
  if (!options.includes(wanted)) {
    return {
      ok: false,
      code: "unknown_status",
      // No article in front of the title: these are plural ("Quotes",
      // "Customers"), so "A quotes can be..." is what the first draft said.
      detail: `${page.title || "These records"} can be ${options.join(", ")}. Not ${wanted}.`
    };
  }
  return { ok: true, status: wanted };
}

/**
 * What to say after a change, given what it was and what it is now.
 *
 * Three outcomes rather than two. Choosing the status a record already has is
 * not a failure and not a change, and reporting it as either is a small lie —
 * the first makes somebody hunt for a problem that is not there, the second
 * tells them something happened when nothing did.
 */
function describeChange(from, to) {
  const before = String(from || "").trim();
  const after = String(to || "").trim();
  if (!after) return "Nothing was changed.";
  const readable = (value) => value.replaceAll("_", " ");
  if (before === after) return `This was already ${readable(after)}, so nothing changed.`;
  if (!before) return `Status set to ${readable(after)}.`;
  return `Status changed from ${readable(before)} to ${readable(after)}.`;
}

module.exports = { statusFieldFor, hasStatus, statusOptionsFor, validateStatus, describeChange };
