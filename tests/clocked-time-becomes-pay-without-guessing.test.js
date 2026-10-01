"use strict";

// The payroll chain had no reader. `employee_wage_rates`, `employee_pay_periods`
// and `employee_pay_statements` have existed since migration 019 and no route,
// library or test touched one of them -- because the time entries key on
// `business_employee_profiles` and those three keyed on `employee_profiles`, a
// table no route queries at all. Nothing could join a clocked hour to the rate
// it should be paid at.
//
// lib/sonara-pay-period-engine.cjs is the arithmetic. This file is the part that
// matters most about it: money arithmetic that is confidently wrong looks exactly
// like money arithmetic that is right, and a payslip is where somebody notices.
//
// Every case below is a way to be wrong that would still have produced a number.

const assert = require("node:assert/strict");

const engine = require("../lib/sonara-pay-period-engine.cjs");

const EMPLOYEE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const PERIOD = Object.freeze({
  id: "33333333-3333-4333-8333-333333333333",
  period_start: "2026-09-01",
  period_end: "2026-09-15",
  status: "open"
});

function entry(overrides = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    status: "approved",
    clock_in_at: "2026-09-02T09:00:00Z",
    clock_out_at: "2026-09-02T17:00:00Z",
    break_minutes: 30,
    ...overrides
  };
}

function rate(overrides = {}) {
  return {
    pay_type: "hourly",
    rate_cents: 2000,
    currency: "usd",
    effective_from: "2026-01-01",
    effective_to: null,
    status: "active",
    ...overrides
  };
}

describe("clocked time becomes pay without guessing", () => {
  describe("hours from one entry", () => {
    it("subtracts the recorded break", () => {
      const result = engine.entryMinutes(entry());
      assert.equal(result.ok, true);
      assert.equal(result.minutes, 450, "eight hours minus a thirty-minute break is 450 minutes");
    });

    // The fourth shape, and the one that would cost somebody money. Number(null)
    // is 0 and finite, so an open shift reads as a zero-length shift unless the
    // absent case is separated from the zero case.
    it("treats a missing clock-out as unknown, never as zero hours", () => {
      const result = engine.entryMinutes(entry({ clock_out_at: null }));
      assert.equal(result.ok, false);
      assert.equal(result.code, "still_clocked_in");
      assert.equal(result.minutes, 0, "minutes are zero, but ok is false -- the caller must not read one without the other");
    });

    it("refuses a clock-out before its clock-in rather than returning negative minutes", () => {
      const result = engine.entryMinutes(entry({ clock_out_at: "2026-09-02T08:00:00Z" }));
      assert.equal(result.ok, false);
      assert.equal(result.code, "clock_out_before_clock_in");
    });

    it("refuses a break longer than the shift rather than paying negative time", () => {
      const result = engine.entryMinutes(entry({ break_minutes: 600 }));
      assert.equal(result.ok, false);
      assert.equal(result.code, "break_longer_than_shift");
    });

    it("refuses a negative break rather than adding time to the shift", () => {
      // Without this, a -60 break turns eight hours into nine and pays for it.
      const result = engine.entryMinutes(entry({ break_minutes: -60 }));
      assert.equal(result.ok, false);
      assert.equal(result.code, "negative_break");
    });

    it("treats an absent break as no break rather than as unreadable", () => {
      const result = engine.entryMinutes(entry({ break_minutes: null }));
      assert.equal(result.ok, true);
      assert.equal(result.minutes, 480, "no break recorded is a full eight hours, which is different from an unreadable break");
    });
  });

  describe("which rate is in force", () => {
    it("takes the latest rate that had started by that day", () => {
      const rates = [
        rate({ rate_cents: 2000, effective_from: "2026-01-01" }),
        rate({ rate_cents: 2500, effective_from: "2026-09-05" })
      ];
      assert.equal(engine.rateOn(rates, "2026-09-02").rateCents, 2000, "a shift before the raise pays the old rate");
      assert.equal(engine.rateOn(rates, "2026-09-06").rateCents, 2500, "a shift after it pays the new one");
    });

    it("ignores a rate that has ended", () => {
      const rates = [rate({ rate_cents: 2000, effective_from: "2026-01-01", effective_to: "2026-06-30" })];
      const result = engine.rateOn(rates, "2026-09-02");
      assert.equal(result.ok, false);
      assert.equal(result.code, "no_rate_in_force");
    });

    it("ignores an archived rate even when its dates cover the day", () => {
      const rates = [rate({ status: "archived" })];
      assert.equal(engine.rateOn(rates, "2026-09-02").ok, false);
    });

    // The case that would produce a plausible wrong number. A salary times hours
    // is arithmetic that completes and means nothing.
    it("refuses to multiply a salary or a commission by hours", () => {
      for (const payType of ["salary", "commission", "piece_rate", "tip_pool", "custom"]) {
        const result = engine.rateOn([rate({ pay_type: payType, rate_cents: 500000 })], "2026-09-02");
        assert.equal(result.ok, false, `${payType} was treated as an hourly rate`);
        assert.equal(result.code, "pay_type_needs_the_owner");
        assert.equal(result.payType, payType, "the page has to be able to say which kind it was");
      }
    });

    it("refuses a negative rate rather than subtracting pay", () => {
      assert.equal(engine.rateOn([rate({ rate_cents: -2000 })], "2026-09-02").code, "negative_rate");
    });
  });

  describe("adjustments", () => {
    it("sums a list of deductions", () => {
      const result = engine.sumAdjustments([{ label: "a", amount_cents: 1000 }, { label: "b", amount_cents: 250 }]);
      assert.equal(result.ok, true);
      assert.equal(result.cents, 1250);
    });

    // A typo in a deduction must not become "no deduction", which overpays and
    // reads as a clean run.
    it("reports an unreadable amount rather than counting it as zero", () => {
      const result = engine.sumAdjustments([{ label: "union dues", amount_cents: "ten dollars" }]);
      assert.equal(result.ok, false);
      assert.equal(result.cents, 0);
      assert.deepEqual(result.unreadable, ["union dues"]);
    });

    it("treats an absent list as no adjustments, which is different from a failed read", () => {
      const result = engine.sumAdjustments(undefined);
      assert.equal(result.ok, true);
      assert.equal(result.cents, 0);
    });
  });

  describe("one employee's statement", () => {
    it("pays hours at the rate in force and applies the adjustments", () => {
      const result = engine.statementFor({
        businessEmployeeId: EMPLOYEE,
        entries: [entry()],
        rates: [rate()],
        period: PERIOD,
        deductions: [{ label: "tax withheld", amount_cents: 1500 }],
        additions: [{ label: "tips", amount_cents: 800 }]
      });
      assert.equal(result.ok, true);
      assert.equal(result.hoursWorked, 7.5);
      assert.equal(result.grossPayCents, 15000, "7.5 hours at $20 is $150.00");
      assert.equal(result.netPayCents, 15000 - 1500 + 800);
      assert.equal(result.countedEntries, 1);
      assert.deepEqual(result.problems, []);
    });

    it("counts only entries somebody approved", () => {
      const entries = [
        entry({ id: "a", status: "approved" }),
        entry({ id: "b", status: "submitted" }),
        entry({ id: "c", status: "open" }),
        entry({ id: "d", status: "rejected" }),
        entry({ id: "e", status: "void" }),
        entry({ id: "f", status: "paid" })
      ];
      const result = engine.statementFor({ businessEmployeeId: EMPLOYEE, entries, rates: [rate()], period: PERIOD });
      assert.equal(result.payableEntries, 2, "only submitted and approved are payable");
      assert.equal(result.countedEntries, 2);
      // `paid` is the one that would pay twice, so it is named here rather than
      // left to the list above.
      assert.ok(
        !engine.PAYABLE_ENTRY_STATUSES.includes("paid"),
        "an entry already on a statement must not be counted into another one"
      );
    });

    it("reports the entries it could not use instead of quietly dropping them", () => {
      const entries = [entry({ id: "good" }), entry({ id: "open-shift", clock_out_at: null })];
      const result = engine.statementFor({ businessEmployeeId: EMPLOYEE, entries, rates: [rate()], period: PERIOD });
      assert.equal(result.ok, false, "a statement with an unusable entry is not ok");
      assert.equal(result.countedEntries, 1);
      assert.deepEqual(result.problems, [{ entryId: "open-shift", code: "still_clocked_in" }]);
    });

    // The mapping this engine refuses to invent. An employee with hours and no
    // rate on the canonical column is reported, not paid from a row on the
    // historical column that nobody said corresponds.
    it("reports an employee with hours and no rate rather than reaching for another table", () => {
      const result = engine.statementFor({ businessEmployeeId: EMPLOYEE, entries: [entry()], rates: [], period: PERIOD });
      assert.equal(result.ok, false);
      assert.equal(result.grossPayCents, 0);
      assert.equal(result.problems[0].code, "no_rate_in_force");
    });

    it("tells a period with no entries apart from a period that failed to read", () => {
      const empty = engine.statementFor({ businessEmployeeId: EMPLOYEE, entries: [], rates: [rate()], period: PERIOD });
      assert.equal(empty.ok, true, "no entries is not an error");
      assert.equal(empty.countedEntries, 0);
      assert.equal(empty.hoursWorked, 0);
      // ok:true with zero counted entries is the signature of "nothing to pay",
      // and a caller that reads only `ok` cannot tell it from a full run. That is
      // why countedEntries is on the result.
      assert.equal(empty.payableEntries, 0);
    });

    it("reports a negative net rather than clamping an over-deduction to zero", () => {
      const result = engine.statementFor({
        businessEmployeeId: EMPLOYEE,
        entries: [entry({ clock_out_at: "2026-09-02T10:00:00Z", break_minutes: 0 })],
        rates: [rate()],
        period: PERIOD,
        deductions: [{ label: "advance repayment", amount_cents: 50000 }]
      });
      assert.equal(result.grossPayCents, 2000, "one hour at $20");
      assert.ok(result.netPayCents < 0, "an over-deduction has to be visible, not clamped");
    });

    it("rounds the cent once over the period rather than per entry", () => {
      // Three 20-minute entries at $20/hour are 666.66r cents each. Rounded per
      // entry that is 2001; rounded once it is 2000. The drift is small and it is
      // the kind somebody finds on their own payslip.
      const entries = [1, 2, 3].map((n) =>
        entry({ id: `e${n}`, clock_in_at: `2026-09-0${n}T09:00:00Z`, clock_out_at: `2026-09-0${n}T09:20:00Z`, break_minutes: 0 })
      );
      const result = engine.statementFor({ businessEmployeeId: EMPLOYEE, entries, rates: [rate()], period: PERIOD });
      assert.equal(result.grossPayCents, 2000);
    });
  });

  describe("a whole pay run", () => {
    it("totals every employee and carries each one's problems up", () => {
      const result = engine.payRun({
        period: PERIOD,
        byEmployee: {
          [EMPLOYEE]: { entries: [entry()], rates: [rate()] },
          [OTHER]: { entries: [entry({ id: "no-rate" })], rates: [] }
        }
      });
      assert.equal(result.employees, 2);
      assert.equal(result.totalGrossCents, 15000, "the unrated employee contributes nothing, not a guess");
      assert.equal(result.ok, false, "a run is not ok because most of it worked");
      assert.equal(result.problems.length, 1);
      assert.equal(result.problems[0].businessEmployeeId, OTHER, "a run-level problem has to say whose it is");
    });

    it("accepts a Map as readily as an object", () => {
      const result = engine.payRun({
        period: PERIOD,
        byEmployee: new Map([[EMPLOYEE, { entries: [entry()], rates: [rate()] }]])
      });
      assert.equal(result.ok, true);
      assert.equal(result.totalHours, 7.5);
    });
  });

  describe("whether a period may be run at all", () => {
    it("allows an open, in-review or approved period", () => {
      for (const status of ["open", "review", "approved"]) {
        assert.equal(engine.periodIsRunnable({ ...PERIOD, status }).ok, true, status);
      }
    });

    // The one mistake in here that moves money twice.
    it("refuses a period that is already paid", () => {
      const result = engine.periodIsRunnable({ ...PERIOD, status: "paid" });
      assert.equal(result.ok, false);
      assert.equal(result.code, "period_already_paid");
    });

    it("refuses an archived period and an unknown status", () => {
      assert.equal(engine.periodIsRunnable({ ...PERIOD, status: "archived" }).code, "period_archived");
      assert.equal(engine.periodIsRunnable({ ...PERIOD, status: "banana" }).code, "unknown_period_status");
      // An absent status is not "open". The schema defaults it, but a row read
      // back with the column missing is a read that lost something.
      assert.equal(engine.periodIsRunnable({ ...PERIOD, status: undefined }).code, "unknown_period_status");
    });

    it("refuses a period that ends before it starts", () => {
      const result = engine.periodIsRunnable({ ...PERIOD, period_start: "2026-09-15", period_end: "2026-09-01" });
      assert.equal(result.ok, false);
      assert.equal(result.code, "period_ends_before_it_starts");
    });
  });

  describe("the migration this engine depends on", () => {
    const fs = require("node:fs");
    const path = require("node:path");

    it("keys the payroll tables on the employee table the product queries", () => {
      const file = path.join(
        __dirname,
        "../supabase/migrations/20261001120000_payroll_keys_on_the_employee_table_with_a_product.sql"
      );
      const sql = fs.readFileSync(file, "utf8");
      // employee_shifts is deliberately absent. It is a duplicate of
      // employee_schedules -- same columns, different status vocabulary -- and
      // employee_schedules is the one with a writer and a reader. Giving the
      // duplicate a working key would be the first step towards maintaining two
      // shift tables, so the migration leaves it alone and says why.
      assert.doesNotMatch(sql, /alter table public\.employee_shifts\s+add column/, "the duplicate shift table must not be given a working key");
      for (const table of ["employee_wage_rates", "employee_pay_statements"]) {
        assert.match(
          sql,
          new RegExp(`alter table public\\.${table}\\s+add column if not exists business_employee_id uuid references public\\.business_employee_profiles`),
          `${table} does not gain a key on business_employee_profiles`
        );
      }
      // Non-destructive, which is why this needed no owner approval. A drop here
      // would be a destructive data change and AGENTS.md puts those behind the
      // owner.
      assert.doesNotMatch(sql, /drop (table|column)/i, "this migration must not drop anything");
    });
  });
});
