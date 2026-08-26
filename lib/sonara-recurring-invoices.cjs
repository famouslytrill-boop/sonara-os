"use strict";

// When the next invoice on a standing arrangement is due, and what goes on it.
//
// Pure. No clock of its own, no database, no writes -- `now` is passed in on
// every call, because the whole value of this module is that a test can drive
// it across a leap day without waiting four years.
//
// ## The trap this exists for
//
// "The 31st of every month" is the classic wrong answer in two directions at
// once, and both are silent.
//
// Advance a date by one month and February clamps it to the 28th. Advance
// *that* by one month and you get 28 March, then 28 April -- a monthly invoice
// that has quietly walked three days earlier and will never come back. The
// customer's contract says the 31st and the paperwork says the 28th.
//
// So the **anchor** is stored, never the clamped result. Every issue date is
// computed from the anchor day against the target month, and a month too short
// to hold it issues on its last day and the month after returns to the anchor.
// lib/sonara-agent-schedule.cjs dodges this by capping day_of_month at 28,
// which is right for a weekly digest and wrong for money: businesses really do
// bill on the last day of the month.
//
// ## What it will not do
//
// **It will not catch up.** A schedule that went unrun for three months
// produces one invoice, dated when it was due, not three. Catching up is how a
// quiet outage becomes three invoices landing on a customer at once, and there
// is no way for software to know which of the three were already settled by
// hand.
//
// **It will not issue twice in a period.** The next date is computed from the
// last one issued, so a tick every hour still produces one invoice a month.
// This is the property that keeps a scheduler from becoming a loop with a
// billing address.
//
// **It will not send anything.** Everything it produces is a draft. An invoice
// leaving for a customer is the business's decision, and
// lib/sonara-record-checks.cjs already reports drafts that have been sitting --
// so a draft nobody sends is visible rather than lost.

const CADENCES = Object.freeze(["weekly", "fortnightly", "monthly", "quarterly", "yearly"]);

// How many months each cadence advances. Weekly and fortnightly are days, and
// are kept apart below because a week is not "a quarter of a month".
const MONTH_STEP = Object.freeze({ monthly: 1, quarterly: 3, yearly: 12 });
const DAY_STEP = Object.freeze({ weekly: 7, fortnightly: 14 });

function daysInMonth(year, month) {
  // month is 1-12. Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The date an anchor day falls on in a given month.
 *
 * `anchorDay` may be 1-31, or the string "last". A month too short to hold the
 * anchor yields its last day -- and because the anchor is what is stored, the
 * next long month returns to it rather than staying clamped.
 */
function dateInMonth(year, month, anchorDay) {
  const length = daysInMonth(year, month);
  if (anchorDay === "last") return new Date(Date.UTC(year, month - 1, length));
  const day = Number(anchorDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, Math.min(day, length)));
}

function toIsoDay(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function parseDay(value) {
  const text = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The next date this schedule should issue on, strictly after `after`.
 *
 * `after` is the last issue date, or the start date when nothing has issued.
 * Returns null with a reason when the schedule cannot be read, because a
 * schedule that silently produces no date looks exactly like one that is not
 * due yet.
 */
function nextIssueDate(schedule, { after = null } = {}) {
  const cadence = String(schedule?.cadence || "");
  if (!CADENCES.includes(cadence)) return { date: null, reason: `"${cadence}" is not a cadence this understands.` };

  const start = parseDay(schedule?.starts_on);
  if (!start) return { date: null, reason: "This arrangement has no start date, so nothing can be worked out from it." };

  const ends = schedule?.ends_on ? parseDay(schedule.ends_on) : null;
  const last = after ? parseDay(after) : (schedule?.last_issued_on ? parseDay(schedule.last_issued_on) : null);

  // Nothing has been issued: the first one is the start date itself.
  if (!last) {
    if (ends && start > ends) return { date: null, reason: "This arrangement ended before it began." };
    return { date: toIsoDay(start), reason: "The first invoice on this arrangement." };
  }

  let next;
  if (DAY_STEP[cadence]) {
    next = new Date(last.getTime() + DAY_STEP[cadence] * 86400000);
  } else {
    // The anchor, not the last issued day. This is the whole point: taking the
    // day off `last` is how a monthly bill walks backwards out of February and
    // never returns.
    const anchor = schedule?.anchor_day ?? start.getUTCDate();
    const step = MONTH_STEP[cadence];
    const month = last.getUTCMonth() + 1 + step;
    const year = last.getUTCFullYear() + Math.floor((month - 1) / 12);
    const wrapped = ((month - 1) % 12) + 1;
    next = dateInMonth(year, wrapped, anchor);
    if (!next) return { date: null, reason: `"${schedule?.anchor_day}" is not a day of the month.` };
  }

  if (ends && next > ends) return { date: null, reason: "This arrangement has finished." };
  return { date: toIsoDay(next), reason: "Due on this date." };
}

/**
 * Should this schedule produce an invoice now?
 *
 * Deliberately answers with a reason either way. A page that says only yes or
 * no gives a business nothing to read when the invoice they expected did not
 * appear.
 */
function isDue(schedule, { now = new Date() } = {}) {
  if (!schedule || schedule.enabled === false) return { due: false, reason: "This arrangement is switched off." };
  if (!schedule.customer_id) return { due: false, reason: "This arrangement is not attached to a customer, so an invoice would have nobody to go to." };

  const { date, reason } = nextIssueDate(schedule);
  if (!date) return { due: false, reason };

  const today = toIsoDay(now instanceof Date ? now : new Date(now));
  if (!today) return { due: false, reason: "The current date could not be read." };
  if (date > today) return { due: false, reason: `Not yet: the next one is dated ${date}.` };

  // Dated the day it was actually due, not today.
  //
  // A schedule that ran three days late still bills for the period it was for,
  // and the due date is counted from the issue date, so a late run does not
  // quietly give the customer three extra days. What it does NOT do is issue
  // the two periods in between -- see the note at the top.
  return { due: true, reason: `Due since ${date}.`, issueOn: date };
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The invoice a due schedule produces, and its lines.
 *
 * Returns `{ ok, invoice, lines, reason }`. Every total is computed from the
 * lines rather than copied from the schedule, so a schedule whose lines were
 * edited cannot issue an invoice whose total disagrees with what is on it --
 * which is the one arithmetic error a customer always spots.
 */
function buildInvoice({ schedule, issueOn, lines = [], invoiceNumber = null } = {}) {
  if (!issueOn) return { ok: false, reason: "No issue date was worked out for this arrangement.", invoice: null, lines: [] };

  const priced = [];
  for (const line of Array.isArray(lines) ? lines : []) {
    const quantity = finiteNumber(line?.quantity);
    const unit = finiteNumber(line?.unit_price_cents);
    // A line this cannot price is not a free line. Dropping it would issue an
    // invoice for less than the arrangement says, which nobody queries.
    if (quantity === null || unit === null) {
      return { ok: false, reason: `"${String(line?.description || "A line")}" has no quantity or no price, so the total cannot be worked out.`, invoice: null, lines: [] };
    }
    priced.push({
      description: String(line?.description || "").trim() || "Item",
      quantity,
      unit_price_cents: unit,
      line_total_cents: Math.round(quantity * unit),
      service_id: line?.service_id || null
    });
  }

  if (!priced.length) return { ok: false, reason: "This arrangement has nothing on it to bill for.", invoice: null, lines: [] };

  const subtotal = priced.reduce((sum, line) => sum + line.line_total_cents, 0);
  const taxRate = finiteNumber(schedule?.tax_rate_basis_points) ?? 0;
  const tax = Math.round((subtotal * taxRate) / 10000);

  const termDays = finiteNumber(schedule?.payment_terms_days);
  const issued = parseDay(issueOn);
  const due = issued && termDays !== null
    ? toIsoDay(new Date(issued.getTime() + termDays * 86400000))
    : null;

  return {
    ok: true,
    reason: null,
    invoice: {
      customer_id: schedule.customer_id,
      invoice_number: invoiceNumber,
      issued_on: issueOn,
      // Null rather than the issue date when no terms are set. An invoice due
      // the day it is issued is a different arrangement from one with no terms,
      // and lib/sonara-record-checks.cjs reports a sent invoice with no due
      // date rather than letting it drop out of every chase list.
      due_on: due,
      subtotal_cents: subtotal,
      tax_cents: tax,
      total_cents: subtotal + tax,
      currency: String(schedule?.currency || "usd"),
      // Always a draft. An invoice leaving for a customer is the business's
      // decision, and a draft that sits is already reported by the record checks.
      status: "draft"
    },
    lines: priced
  };
}

// What a business reads on its own arrangements page.
function describe(schedule) {
  const cadence = String(schedule?.cadence || "");
  const anchor = schedule?.anchor_day === "last" ? "the last day" : `day ${schedule?.anchor_day ?? "?"}`;
  if (cadence === "weekly") return "Every week";
  if (cadence === "fortnightly") return "Every two weeks";
  if (cadence === "monthly") return `Monthly, on ${anchor}`;
  if (cadence === "quarterly") return `Every three months, on ${anchor}`;
  if (cadence === "yearly") return `Once a year, on ${anchor}`;
  return "On no schedule this understands";
}

module.exports = {
  CADENCES, MONTH_STEP, DAY_STEP,
  daysInMonth, dateInMonth, toIsoDay, parseDay,
  nextIssueDate, isDue, buildInvoice, describe
};
