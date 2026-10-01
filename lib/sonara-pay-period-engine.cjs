// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Turning clocked time into what somebody is owed.
//
// `employee_time_entries` has had a clock-in and clock-out since migration 019.
// `employee_wage_rates`, `employee_pay_periods` and `employee_pay_statements`
// have existed just as long and **had no reader at all** -- no route, no
// library, nothing. The reason is in
// supabase/migrations/20261001120000_payroll_keys_on_the_employee_table_with_a_product.sql:
// the time entries key on `business_employee_profiles` and the three payroll
// tables keyed on `employee_profiles`, a table no route queries. The chain could
// not be joined, so none of it was built.
//
// This is the arithmetic half, and it is only arithmetic. No model call, no
// provider, no metered API, nothing that costs the owner anything per pay run --
// the same constraint lib/sonara-record-checks.cjs works under, for the same
// reason.
//
// ## What it will not do
//
// It does not file taxes, does not compute statutory withholding, and does not
// decide overtime law. `deductions` and `additions` are lists the owner supplies
// and this applies; it does not invent one. A payroll engine that guessed a tax
// rule would be the worst possible place in this product for a confident wrong
// answer, so every money figure out of here is traceable to a row the owner can
// see.
//
// It also does not map between the two employee tables. Given a time entry whose
// employee has no wage rate on the canonical column, it reports that employee as
// unrated rather than reaching for a row on the historical column and hoping the
// ids correspond. Nobody declared that correspondence.
//
// ## Absent is not zero
//
// The fourth shape in .claude/skills/checks-that-cannot-lie, and the one that
// matters most here. `Number(null)` is `0` and finite, which is how twenty-three
// columns once read unpriced services as free. A missing clock-out is not a
// zero-length shift, a missing rate is not an unpaid employee, and an empty
// deductions list is not the same as a deductions read that failed. Every
// function below carries the outcome rather than a bare number.

const MINUTES_PER_HOUR = 60;

// Two decimal places on hours, which is what a pay statement shows and what
// `employee_pay_statements.hours_worked` is declared `numeric` to hold. Rounding
// once, here, rather than at each display: two screens rounding the same figure
// differently is how a statement and its own total stop agreeing.
const HOURS_DECIMALS = 2;

// The time-entry states whose hours belong in a pay run. `open` is somebody still
// clocked in, `rejected` and `void` were ruled out, and `paid` is already on a
// statement -- counting any of them would pay for time twice or pay for time
// nobody approved.
const PAYABLE_ENTRY_STATUSES = Object.freeze(["submitted", "approved"]);

// Rate kinds this engine can compute from clocked hours. `salary`,
// `piece_rate`, `commission` and `tip_pool` are all real and all need an input
// this engine is not given, so each is reported as needing the owner rather than
// multiplied by hours as if it were an hourly rate -- which is what would happen
// if the pay_type were ignored.
const HOURLY_PAY_TYPES = Object.freeze(["hourly"]);

function round(value, decimals) {
  const factor = 10 ** decimals;
  // Math.round on a scaled value, not toFixed: toFixed returns a string and
  // reintroduces the parse this is trying to avoid.
  return Math.round(value * factor) / factor;
}

/**
 * Minutes between a clock-in and a clock-out, minus the recorded break.
 *
 * Returns `{ ok, minutes, code }`. A missing or unparseable timestamp, a
 * clock-out before its clock-in, or a break longer than the shift are each a
 * distinct refusal code rather than a zero.
 */
function entryMinutes(entry) {
  const inAt = Date.parse(String(entry?.clock_in_at || ""));
  const outAt = Date.parse(String(entry?.clock_out_at || ""));

  if (!Number.isFinite(inAt)) return { ok: false, minutes: 0, code: "no_clock_in" };
  // Still clocked in. Not zero hours -- unknown hours, and a pay run that
  // silently paid zero for an open shift would be wrong in the direction
  // nobody checks.
  if (!Number.isFinite(outAt)) return { ok: false, minutes: 0, code: "still_clocked_in" };
  if (outAt < inAt) return { ok: false, minutes: 0, code: "clock_out_before_clock_in" };

  const worked = (outAt - inAt) / 1000 / 60;
  const breakMinutes = Number.isFinite(Number(entry?.break_minutes)) ? Number(entry.break_minutes) : 0;
  if (breakMinutes < 0) return { ok: false, minutes: 0, code: "negative_break" };
  if (breakMinutes > worked) return { ok: false, minutes: 0, code: "break_longer_than_shift" };

  return { ok: true, minutes: worked - breakMinutes, code: "ok" };
}

/**
 * The rate in force on a date, from an employee's rate rows.
 *
 * `effective_from` is required by the schema and `effective_to` is nullable,
 * meaning open-ended. Rows are filtered to `status: "active"` and the latest
 * `effective_from` that is not after the date wins -- so a raise dated inside a
 * pay period applies from its own date, and an archived rate never applies.
 */
function rateOn(rates, isoDate) {
  const on = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(on)) return { ok: false, code: "unreadable_date" };

  const candidates = (Array.isArray(rates) ? rates : [])
    .filter((rate) => String(rate?.status || "") === "active")
    .filter((rate) => {
      const from = Date.parse(`${String(rate?.effective_from || "")}T00:00:00Z`);
      if (!Number.isFinite(from) || from > on) return false;
      const to = rate?.effective_to ? Date.parse(`${String(rate.effective_to)}T00:00:00Z`) : null;
      return to === null || !Number.isFinite(to) ? true : to >= on;
    })
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)));

  if (!candidates.length) return { ok: false, code: "no_rate_in_force" };

  const rate = candidates[0];
  const payType = String(rate.pay_type || "");
  if (!HOURLY_PAY_TYPES.includes(payType)) {
    // Reported, not multiplied. A salary or a commission times hours is a
    // number with no meaning, and it would look exactly like a correct one.
    return { ok: false, code: "pay_type_needs_the_owner", payType, rateCents: Number(rate.rate_cents) || 0 };
  }

  const rateCents = Number(rate.rate_cents);
  if (!Number.isFinite(rateCents)) return { ok: false, code: "unreadable_rate" };
  if (rateCents < 0) return { ok: false, code: "negative_rate" };

  return { ok: true, code: "ok", payType, rateCents, currency: String(rate.currency || "usd") };
}

/**
 * Sum a deductions or additions list.
 *
 * Each item is `{ label, amount_cents }`. An item whose amount is not a finite
 * number is counted as a problem rather than as zero: a typo in a deduction
 * must not quietly become "no deduction", which pays somebody too much and
 * reads as a clean run.
 */
function sumAdjustments(items) {
  const list = Array.isArray(items) ? items : [];
  let cents = 0;
  const unreadable = [];
  for (const item of list) {
    const amount = Number(item?.amount_cents);
    if (!Number.isFinite(amount)) {
      unreadable.push(String(item?.label || "(unlabelled)"));
      continue;
    }
    cents += Math.trunc(amount);
  }
  return { ok: unreadable.length === 0, cents, unreadable };
}

/**
 * One employee's statement for one period.
 *
 * Takes the employee's payable time entries, their rate rows, and the period.
 * Returns a draft statement plus the reason for every entry it could not use --
 * which is the part that makes this safe to show an owner: "14 hours" with three
 * entries silently dropped is worse than "14 hours, and here are the three I
 * could not read".
 */
function statementFor({ businessEmployeeId, entries, rates, period, deductions, additions } = {}) {
  const problems = [];
  const usable = [];

  const payable = (Array.isArray(entries) ? entries : []).filter((entry) =>
    PAYABLE_ENTRY_STATUSES.includes(String(entry?.status || ""))
  );

  for (const entry of payable) {
    const minutes = entryMinutes(entry);
    if (!minutes.ok) {
      problems.push({ entryId: entry?.id || null, code: minutes.code });
      continue;
    }
    // The rate in force on the day the shift started, not on the pay date. A
    // raise dated mid-period pays the old rate for the shifts before it.
    const day = String(entry.clock_in_at).slice(0, 10);
    const rate = rateOn(rates, day);
    if (!rate.ok) {
      problems.push({ entryId: entry?.id || null, code: rate.code, payType: rate.payType });
      continue;
    }
    usable.push({ minutes: minutes.minutes, rateCents: rate.rateCents, currency: rate.currency });
  }

  const minutesTotal = usable.reduce((total, item) => total + item.minutes, 0);
  const hours = round(minutesTotal / MINUTES_PER_HOUR, HOURS_DECIMALS);

  // Cents accumulated per entry and truncated once at the end. Rounding each
  // entry to the cent and then summing drifts, and drift in a pay statement is
  // the kind of error somebody notices on their own payslip.
  const grossCents = Math.round(
    usable.reduce((total, item) => total + (item.minutes / MINUTES_PER_HOUR) * item.rateCents, 0)
  );

  const deduction = sumAdjustments(deductions);
  const addition = sumAdjustments(additions);
  if (!deduction.ok) problems.push({ entryId: null, code: "unreadable_deduction", labels: deduction.unreadable });
  if (!addition.ok) problems.push({ entryId: null, code: "unreadable_addition", labels: addition.unreadable });

  const netCents = grossCents - deduction.cents + addition.cents;
  const currency = usable.find((item) => item.currency)?.currency || "usd";

  return {
    // `ok` means every payable entry was turned into money. It is NOT "there was
    // nothing wrong": a period with no entries at all is ok:true with zero
    // hours, and `countedEntries` is how a caller tells those apart.
    ok: problems.length === 0,
    businessEmployeeId: businessEmployeeId || null,
    payPeriodId: period?.id || null,
    hoursWorked: hours,
    grossPayCents: grossCents,
    deductionCents: deduction.cents,
    additionCents: addition.cents,
    // Net can legitimately be negative when deductions exceed a short period's
    // gross. Reported rather than clamped: clamping at zero would hide an
    // over-deduction, which is a thing an owner has to see.
    netPayCents: netCents,
    currency,
    countedEntries: usable.length,
    payableEntries: payable.length,
    problems
  };
}

/**
 * A whole pay run: every employee with time in the period.
 *
 * `byEmployee` is a Map or plain object of businessEmployeeId -> { entries,
 * rates, deductions, additions }. The result carries per-employee statements and
 * a run-level summary, and `ok` is false if any statement has a problem -- a pay
 * run that is right for nine people out of ten is not a pay run that is right.
 */
function payRun({ period, byEmployee } = {}) {
  const source = byEmployee instanceof Map ? byEmployee : new Map(Object.entries(byEmployee || {}));
  const statements = [];
  for (const [businessEmployeeId, input] of source) {
    statements.push(
      statementFor({
        businessEmployeeId,
        entries: input?.entries,
        rates: input?.rates,
        period,
        deductions: input?.deductions,
        additions: input?.additions
      })
    );
  }

  const totalGross = statements.reduce((total, item) => total + item.grossPayCents, 0);
  const totalNet = statements.reduce((total, item) => total + item.netPayCents, 0);
  const totalHours = round(statements.reduce((total, item) => total + item.hoursWorked, 0), HOURS_DECIMALS);

  return {
    ok: statements.every((item) => item.ok),
    payPeriodId: period?.id || null,
    periodStart: period?.period_start || null,
    periodEnd: period?.period_end || null,
    employees: statements.length,
    totalHours,
    totalGrossCents: totalGross,
    totalNetCents: totalNet,
    statements,
    // Flattened so a page can say "three things need you" without walking every
    // statement, and so a caller cannot report a clean run by only reading `ok`
    // on the statements it happened to render.
    problems: statements.flatMap((item) =>
      item.problems.map((problem) => ({ businessEmployeeId: item.businessEmployeeId, ...problem }))
    )
  };
}

/**
 * Whether a period may be computed at all.
 *
 * The schema allows any two dates and any status. A run against a period that is
 * already `paid` would draft second statements for time already paid, which is
 * the one mistake in here that moves money twice.
 */
function periodIsRunnable(period) {
  const start = Date.parse(`${String(period?.period_start || "")}T00:00:00Z`);
  const end = Date.parse(`${String(period?.period_end || "")}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { ok: false, code: "unreadable_period_dates" };
  if (end < start) return { ok: false, code: "period_ends_before_it_starts" };

  const status = String(period?.status || "");
  if (status === "paid") return { ok: false, code: "period_already_paid" };
  if (status === "archived") return { ok: false, code: "period_archived" };
  if (!["open", "review", "approved"].includes(status)) return { ok: false, code: "unknown_period_status" };

  return { ok: true, code: "ok" };
}

module.exports = {
  MINUTES_PER_HOUR,
  HOURS_DECIMALS,
  PAYABLE_ENTRY_STATUSES,
  HOURLY_PAY_TYPES,
  entryMinutes,
  rateOn,
  sumAdjustments,
  statementFor,
  payRun,
  periodIsRunnable
};
