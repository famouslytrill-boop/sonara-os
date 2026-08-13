"use strict";

// What a day's staffing cost, and everything that stops it being knowable.
//
// The inputs are two tables that were never joined. employee_time_entries has
// clock-in, clock-out and a break; employee_wage_rates has an amount, a kind
// and the dates it applies between. Neither has a page's worth of validation
// behind it, so most of this file is about what to refuse.
//
// The refusals are the point. A labour figure is a number a business prices
// against, and every branch below is a way the obvious version produces one
// that is confidently short:
//
//   * a shift still clocked in has no end, so its hours are unknown -- not zero
//   * a salaried person cannot be divided into a day by multiplying hours
//   * an employee with no rate on that date costs an unknown amount, not £0
//   * a break longer than the shift is bad data, not negative work
//
// Each one is counted and named rather than dropped, because a figure missing
// three people reads exactly like a complete one.

const { finiteNumber } = require("./sonara-numbers.cjs");

const MILLISECONDS_PER_HOUR = 3600000;

// Only an hourly rate can be attributed to a day by multiplying hours. Salary,
// commission and stipend are real rate types in the schema and none of them
// divides into a single day's trading without a convention nobody has set.
const COSTABLE_RATE_TYPE = "hourly";

function hoursWorked(entry) {
  const start = Date.parse(entry?.clock_in_at || "");
  const end = Date.parse(entry?.clock_out_at || "");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end <= start) return null;
  const breakMinutes = finiteNumber(entry?.break_minutes) ?? 0;
  const hours = (end - start) / MILLISECONDS_PER_HOUR - breakMinutes / 60;
  // A break longer than the shift is a data problem, not negative work.
  return hours > 0 ? hours : null;
}

// The rate in force for this person on this date. effective_to may be absent,
// which means it still applies.
function rateOn(rates, employeeId, isoDate) {
  const day = String(isoDate || "").slice(0, 10);
  if (!day) return null;
  const candidates = (rates || []).filter((rate) => {
    if (rate.employee_id !== employeeId) return false;
    if (String(rate.status || "active") !== "active") return false;
    const from = String(rate.effective_from || "").slice(0, 10);
    const to = String(rate.effective_to || "").slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
  if (!candidates.length) return null;
  // The latest applicable one, so a rise recorded later wins over the rate it
  // replaced when both cover the date.
  return candidates.sort((a, b) => String(b.effective_from || "").localeCompare(String(a.effective_from || "")))[0];
}

// Returns what is known, what is not, and why. `costCents` is only the people
// it could cost; `unknown` says how many it could not and for what reason, and
// a caller that ignores it is reporting a short figure as a complete one.
function labourCostForDay({ entries, rates, businessDate }) {
  const known = { costCents: 0, hours: 0, people: 0 };
  const unknown = { stillClockedIn: 0, noRate: 0, notHourly: 0, unusableHours: 0 };

  for (const entry of entries || []) {
    const hours = hoursWorked(entry);
    if (hours === null) {
      if (entry?.clock_in_at && !entry?.clock_out_at) unknown.stillClockedIn += 1;
      else unknown.unusableHours += 1;
      continue;
    }
    const rate = rateOn(rates, entry.employee_id, businessDate);
    if (!rate) {
      unknown.noRate += 1;
      continue;
    }
    if (String(rate.rate_type || COSTABLE_RATE_TYPE) !== COSTABLE_RATE_TYPE) {
      unknown.notHourly += 1;
      continue;
    }
    const amount = finiteNumber(rate.amount_cents);
    if (amount === null) {
      unknown.noRate += 1;
      continue;
    }
    known.costCents += Math.round(hours * amount);
    known.hours += hours;
    known.people += 1;
  }

  const missing = unknown.stillClockedIn + unknown.noRate + unknown.notHourly + unknown.unusableHours;
  return { ...known, unknown, missing, complete: missing === 0 };
}

// The sentence a customer reads about what the figure leaves out. Empty when
// nothing is missing, so a caller can append it unconditionally.
function labourGapSentence(result) {
  if (!result || result.complete) return "";
  const parts = [];
  if (result.unknown.stillClockedIn) parts.push(`${result.unknown.stillClockedIn} still clocked in`);
  if (result.unknown.noRate) parts.push(`${result.unknown.noRate} with no pay rate recorded for that date`);
  if (result.unknown.notHourly) parts.push(`${result.unknown.notHourly} not paid by the hour`);
  if (result.unknown.unusableHours) parts.push(`${result.unknown.unusableHours} whose hours do not add up`);
  const last = parts.pop();
  const list = parts.length ? `${parts.join(", ")} and ${last}` : last;
  return `This leaves out ${list}.`;
}

module.exports = { hoursWorked, rateOn, labourCostForDay, labourGapSentence, COSTABLE_RATE_TYPE };
