"use strict";

// A standing arrangement, and the two ways a recurring bill goes wrong quietly.
//
// **It walks.** Advance 31 January by a month and February clamps it to the
// 28th. Advance that by a month and you get 28 March, then 28 April -- a
// monthly invoice that has moved three days earlier and will never come back.
// The contract says the 31st and the paperwork says the 28th, and nobody
// notices for a year.
//
// **It catches up.** A schedule that went unrun for three months issues three
// invoices at once the moment service returns, at a customer who may have
// settled two of them by hand. There is no way for software to know which.
//
// Both are silent. Neither throws, neither logs, and both are only ever found
// by a customer reading their own statement.

const assert = require("node:assert/strict");
const {
  CADENCES,
  daysInMonth,
  dateInMonth,
  nextIssueDate,
  isDue,
  buildInvoice,
  describe: describeSchedule
} = require("../lib/sonara-recurring-invoices.cjs");

const CUSTOMER = "c1c1c1c1-0000-4000-8000-00000000001c";

function monthly(overrides = {}) {
  return {
    customer_id: CUSTOMER, enabled: true, cadence: "monthly",
    starts_on: "2026-01-31", anchor_day: 31,
    payment_terms_days: 14, currency: "gbp",
    ...overrides
  };
}

describe("a standing arrangement", () => {
  it("names every cadence it accepts, so none is outside these tests", () => {
    assert.deepEqual([...CADENCES].sort(), ["fortnightly", "monthly", "quarterly", "weekly", "yearly"].sort());
  });

  describe("the calendar underneath", () => {
    it("knows how long each month is, including February in a leap year", () => {
      assert.equal(daysInMonth(2026, 1), 31);
      assert.equal(daysInMonth(2026, 2), 28);
      assert.equal(daysInMonth(2028, 2), 29, "2028 is a leap year");
      assert.equal(daysInMonth(2100, 2), 28, "2100 is not, despite dividing by four");
      assert.equal(daysInMonth(2000, 2), 29, "2000 is, despite dividing by one hundred");
    });

    it("puts an anchor on the last day of a month too short to hold it", () => {
      assert.equal(dateInMonth(2026, 2, 31).toISOString().slice(0, 10), "2026-02-28");
      assert.equal(dateInMonth(2028, 2, 31).toISOString().slice(0, 10), "2028-02-29");
      assert.equal(dateInMonth(2026, 4, 31).toISOString().slice(0, 10), "2026-04-30");
    });

    it("understands an arrangement anchored to the last day, whatever that is", () => {
      assert.equal(dateInMonth(2026, 2, "last").toISOString().slice(0, 10), "2026-02-28");
      assert.equal(dateInMonth(2026, 3, "last").toISOString().slice(0, 10), "2026-03-31");
    });

    it("refuses a day that is not one", () => {
      for (const day of [0, 32, -1, null, "the third Tuesday"]) {
        assert.equal(dateInMonth(2026, 3, day), null, `accepted ${JSON.stringify(day)}`);
      }
    });
  });

  describe("working out the next date", () => {
    it("issues the first one on the start date", () => {
      assert.equal(nextIssueDate(monthly()).date, "2026-01-31");
    });

    it("does not walk out of February and stay there", () => {
      // The whole reason this module exists. Each step is computed from the
      // anchor against the target month, never from the clamped result.
      const schedule = monthly();
      assert.equal(nextIssueDate(schedule, { after: "2026-01-31" }).date, "2026-02-28");
      assert.equal(nextIssueDate(schedule, { after: "2026-02-28" }).date, "2026-03-31",
        "the anchor was taken from the clamped date, so this bill has moved three days earlier for ever");
      assert.equal(nextIssueDate(schedule, { after: "2026-03-31" }).date, "2026-04-30");
      assert.equal(nextIssueDate(schedule, { after: "2026-04-30" }).date, "2026-05-31");
    });

    it("crosses a year end", () => {
      assert.equal(nextIssueDate(monthly({ anchor_day: 15 }), { after: "2026-12-15" }).date, "2027-01-15");
    });

    it("steps three months for a quarterly arrangement, and twelve for a yearly one", () => {
      assert.equal(nextIssueDate(monthly({ cadence: "quarterly", anchor_day: 15 }), { after: "2026-11-15" }).date, "2027-02-15");
      assert.equal(nextIssueDate(monthly({ cadence: "yearly", anchor_day: 29, starts_on: "2028-02-29" }), { after: "2028-02-29" }).date, "2029-02-28",
        "a yearly bill anchored on a leap day must land on the last day of February in an ordinary year");
    });

    it("steps in days for weekly and fortnightly, which are not fractions of a month", () => {
      assert.equal(nextIssueDate(monthly({ cadence: "weekly" }), { after: "2026-01-31" }).date, "2026-02-07");
      assert.equal(nextIssueDate(monthly({ cadence: "fortnightly" }), { after: "2026-01-31" }).date, "2026-02-14");
    });

    it("stops at the end date rather than billing past it", () => {
      const schedule = monthly({ anchor_day: 15, starts_on: "2026-01-15", ends_on: "2026-03-01" });
      assert.equal(nextIssueDate(schedule, { after: "2026-02-15" }).date, null);
      assert.match(nextIssueDate(schedule, { after: "2026-02-15" }).reason, /finished/);
    });

    it("says why it produced no date, rather than looking like 'not due yet'", () => {
      for (const [schedule, pattern] of [
        [monthly({ cadence: "fortnight-ish" }), /not a cadence/],
        [monthly({ starts_on: null }), /no start date/],
        [monthly({ starts_on: "not-a-date" }), /no start date/]
      ]) {
        const result = nextIssueDate(schedule);
        assert.equal(result.date, null);
        assert.match(result.reason, pattern);
      }
    });
  });

  describe("deciding whether to issue one now", () => {
    it("issues when the date has arrived", () => {
      const result = isDue(monthly({ last_issued_on: "2026-01-31" }), { now: new Date("2026-03-05T09:00:00Z") });
      assert.equal(result.due, true);
      assert.equal(result.issueOn, "2026-02-28", "a late run must bill for the period it was for, not for today");
    });

    it("does not issue before the date", () => {
      const result = isDue(monthly({ last_issued_on: "2026-01-31" }), { now: new Date("2026-02-10T09:00:00Z") });
      assert.equal(result.due, false);
      assert.match(result.reason, /Not yet/);
    });

    it("issues once, not once per period missed", () => {
      // Three months unrun. One invoice, dated when it was due -- not three
      // landing on a customer who may have settled two of them by hand.
      const schedule = monthly({ last_issued_on: "2026-01-31" });
      const first = isDue(schedule, { now: new Date("2026-05-20T09:00:00Z") });
      assert.equal(first.due, true);
      assert.equal(first.issueOn, "2026-02-28");
      // After it runs, the next one is the following period and not a backlog.
      const after = isDue({ ...schedule, last_issued_on: first.issueOn }, { now: new Date("2026-05-20T09:00:00Z") });
      assert.equal(after.issueOn, "2026-03-31");
    });

    it("does not issue twice in the same period however often it is asked", () => {
      const schedule = monthly({ last_issued_on: "2026-02-28" });
      for (const hour of ["2026-02-28T01:00:00Z", "2026-02-28T13:00:00Z", "2026-03-01T00:00:00Z"]) {
        assert.equal(isDue(schedule, { now: new Date(hour) }).due, false, `issued again at ${hour}`);
      }
      assert.equal(isDue(schedule, { now: new Date("2026-03-31T09:00:00Z") }).due, true,
        "and it does issue when the next period arrives, or every assertion above passes by never issuing");
    });

    it("refuses an arrangement with no customer on it", () => {
      const result = isDue(monthly({ customer_id: null }), { now: new Date("2026-06-01T09:00:00Z") });
      assert.equal(result.due, false);
      assert.match(result.reason, /nobody to go to/);
    });

    it("respects being switched off", () => {
      assert.equal(isDue(monthly({ enabled: false }), { now: new Date("2026-06-01T09:00:00Z") }).due, false);
    });
  });

  describe("the invoice it produces", () => {
    const LINES = [
      { description: "Monthly retainer", quantity: 1, unit_price_cents: 120000 },
      { description: "Out of hours", quantity: 2, unit_price_cents: 7500 }
    ];

    it("totals from the lines rather than from the arrangement", () => {
      // The one arithmetic error a customer always spots.
      const { ok, invoice, lines } = buildInvoice({ schedule: monthly(), issueOn: "2026-02-28", lines: LINES });
      assert.equal(ok, true);
      assert.equal(lines[0].line_total_cents, 120000);
      assert.equal(lines[1].line_total_cents, 15000);
      assert.equal(invoice.subtotal_cents, 135000);
      assert.equal(invoice.total_cents, 135000);
    });

    it("adds tax at the rate on the arrangement", () => {
      const { invoice } = buildInvoice({ schedule: monthly({ tax_rate_basis_points: 2000 }), issueOn: "2026-02-28", lines: LINES });
      assert.equal(invoice.tax_cents, 27000);
      assert.equal(invoice.total_cents, 162000);
    });

    it("counts the due date from the issue date, so a late run gives no extra days", () => {
      const { invoice } = buildInvoice({ schedule: monthly(), issueOn: "2026-02-28", lines: LINES });
      assert.equal(invoice.issued_on, "2026-02-28");
      assert.equal(invoice.due_on, "2026-03-14");
    });

    it("leaves the due date empty when no terms are set, rather than making it due today", () => {
      const { invoice } = buildInvoice({ schedule: monthly({ payment_terms_days: null }), issueOn: "2026-02-28", lines: LINES });
      assert.equal(invoice.due_on, null, "an invoice due the day it is issued is a different arrangement from one with no terms");
    });

    it("always produces a draft", () => {
      const { invoice } = buildInvoice({ schedule: monthly(), issueOn: "2026-02-28", lines: LINES });
      assert.equal(invoice.status, "draft", "an invoice left for a customer without the business deciding to send it");
    });

    it("refuses rather than billing for less than the arrangement says", () => {
      // A line it cannot price is not a free line. Dropping it issues an
      // invoice that is too small, which nobody ever queries.
      const { ok, reason, invoice } = buildInvoice({
        schedule: monthly(), issueOn: "2026-02-28",
        lines: [...LINES, { description: "Materials", quantity: 3, unit_price_cents: null }]
      });
      assert.equal(ok, false);
      assert.equal(invoice, null);
      assert.match(reason, /Materials/);
    });

    it("refuses an arrangement with nothing on it", () => {
      const { ok, reason } = buildInvoice({ schedule: monthly(), issueOn: "2026-02-28", lines: [] });
      assert.equal(ok, false);
      assert.match(reason, /nothing on it to bill/);
    });

    it("keeps a zero-priced line rather than treating it as unpriced", () => {
      const { ok, invoice } = buildInvoice({
        schedule: monthly(), issueOn: "2026-02-28",
        lines: [{ description: "Included visit", quantity: 1, unit_price_cents: 0 }]
      });
      assert.equal(ok, true, "a line the business chose to include at no charge is not a missing price");
      assert.equal(invoice.total_cents, 0);
    });
  });

  describe("what the business reads", () => {
    it("says when it runs, in words", () => {
      assert.equal(describeSchedule(monthly()), "Monthly, on day 31");
      assert.equal(describeSchedule(monthly({ anchor_day: "last" })), "Monthly, on the last day");
      assert.equal(describeSchedule(monthly({ cadence: "fortnightly" })), "Every two weeks");
    });

    it("says plainly when it cannot read the cadence", () => {
      assert.match(describeSchedule(monthly({ cadence: "sometimes" })), /no schedule this understands/);
    });
  });
});
