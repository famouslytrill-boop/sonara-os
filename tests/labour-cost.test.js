"use strict";

// What a day's staffing cost, and every way it is not knowable.
//
// The arithmetic is four lines. Everything else in lib/sonara-labour-cost.cjs
// is refusals, and the refusals are what this file is for: a labour figure is a
// number a business prices against, and the obvious version of this join
// produces one that is confidently short in four different ways.

const assert = require("node:assert/strict");
const { hoursWorked, rateOn, labourCostForDay, labourGapSentence } = require("../lib/sonara-labour-cost.cjs");

const shift = (employeeId, from, to, breakMinutes = 0) => ({
  employee_id: employeeId,
  clock_in_at: from ? `2026-08-01T${from}:00:00Z` : null,
  clock_out_at: to ? `2026-08-01T${to}:00:00Z` : null,
  break_minutes: breakMinutes
});
const rate = (employeeId, amountCents, extra = {}) => ({
  employee_id: employeeId,
  amount_cents: amountCents,
  rate_type: "hourly",
  effective_from: "2026-01-01",
  status: "active",
  ...extra
});
const forDay = (entries, rates) => labourCostForDay({ entries, rates, businessDate: "2026-08-01" });

describe("hours worked", () => {
  it("takes the break off the shift", () => {
    assert.equal(hoursWorked(shift("e1", "09", "17")), 8);
    assert.equal(hoursWorked(shift("e1", "09", "17", 30)), 7.5);
  });

  it("returns nothing for a shift that has not ended", () => {
    assert.equal(hoursWorked(shift("e1", "09", null)), null);
    assert.equal(hoursWorked({}), null);
  });

  // Each of these would otherwise produce a negative or nonsensical figure that
  // then subtracts from the day's labour cost.
  it("refuses hours that do not add up", () => {
    assert.equal(hoursWorked(shift("e1", "17", "09")), null, "clocking out before clocking in");
    assert.equal(hoursWorked(shift("e1", "09", "09")), null, "a shift of no length");
    assert.equal(hoursWorked(shift("e1", "09", "10", 90)), null, "a break longer than the shift");
    assert.equal(hoursWorked({ clock_in_at: "not a date", clock_out_at: "also not" }), null);
  });

  it("treats a missing break as no break, not as bad data", () => {
    assert.equal(hoursWorked({ ...shift("e1", "09", "17"), break_minutes: null }), 8);
  });
});

describe("which rate applied", () => {
  it("picks the one covering the date", () => {
    const rates = [rate("e1", 1200, { effective_from: "2026-01-01", effective_to: "2026-06-30" }), rate("e1", 1500, { effective_from: "2026-07-01" })];
    assert.equal(rateOn(rates, "e1", "2026-08-01").amount_cents, 1500);
    assert.equal(rateOn(rates, "e1", "2026-03-01").amount_cents, 1200);
  });

  it("prefers the later rate when two cover the same day", () => {
    const rates = [rate("e1", 1200, { effective_from: "2026-01-01" }), rate("e1", 1500, { effective_from: "2026-07-01" })];
    assert.equal(rateOn(rates, "e1", "2026-08-01").amount_cents, 1500, "a rise recorded later must win");
  });

  it("finds nothing for the wrong person, an inactive rate, or a date before it starts", () => {
    assert.equal(rateOn([rate("e1", 1500)], "e2", "2026-08-01"), null);
    assert.equal(rateOn([rate("e1", 1500, { status: "archived" })], "e1", "2026-08-01"), null);
    assert.equal(rateOn([rate("e1", 1500, { effective_from: "2026-09-01" })], "e1", "2026-08-01"), null);
    assert.equal(rateOn([rate("e1", 1500, { effective_to: "2026-07-31" })], "e1", "2026-08-01"), null);
    assert.equal(rateOn([rate("e1", 1500)], "e1", ""), null);
  });
});

describe("the labour cost of a day", () => {
  it("multiplies the hours by the rate", () => {
    const result = forDay([shift("e1", "09", "17", 30)], [rate("e1", 1500)]);
    assert.equal(result.costCents, 11250, "7.5 hours at 1500 is 11250");
    assert.equal(result.hours, 7.5);
    assert.equal(result.people, 1);
    assert.equal(result.complete, true);
    assert.equal(labourGapSentence(result), "", "nothing is missing, so nothing is said");
  });

  it("adds up everybody who can be costed", () => {
    const result = forDay(
      [shift("e1", "09", "17"), shift("e2", "12", "20")],
      [rate("e1", 1500), rate("e2", 1200)]
    );
    assert.equal(result.costCents, 8 * 1500 + 8 * 1200);
    assert.equal(result.people, 2);
    assert.equal(result.complete, true);
  });

  // The four refusals, each named to the customer rather than folded in as zero.
  it("counts a shift still clocked in as unknown, not as no hours", () => {
    const result = forDay([shift("e1", "09", null)], [rate("e1", 1500)]);
    assert.equal(result.costCents, 0);
    assert.equal(result.people, 0);
    assert.equal(result.unknown.stillClockedIn, 1);
    assert.equal(result.complete, false);
    assert.match(labourGapSentence(result), /1 still clocked in/);
  });

  it("counts somebody with no rate as unknown, not as free", () => {
    const result = forDay([shift("e1", "09", "17"), shift("e2", "09", "13")], [rate("e1", 1500)]);
    assert.equal(result.costCents, 8 * 1500, "the person with a rate is still costed");
    assert.equal(result.unknown.noRate, 1);
    assert.match(labourGapSentence(result), /1 with no pay rate recorded for that date/);
  });

  it("will not divide a salary into a day by multiplying hours", () => {
    const result = forDay([shift("e1", "09", "17")], [rate("e1", 400000, { rate_type: "salary" })]);
    assert.equal(result.costCents, 0, "8 x 400000 would have been a labour cost of thirty-two thousand pounds");
    assert.equal(result.unknown.notHourly, 1);
    assert.match(labourGapSentence(result), /1 not paid by the hour/);
  });

  it("counts a rate with no amount as unknown rather than as zero", () => {
    const result = forDay([shift("e1", "09", "17")], [rate("e1", null)]);
    assert.equal(result.costCents, 0);
    assert.equal(result.unknown.noRate, 1);
  });

  it("names every gap at once when there are several", () => {
    // e4 has usable hours and no rate; e5 clocks out before clocking in. The
    // first draft of this used one person for both and got neither, because
    // the hours check runs before the rate lookup -- so the "no rate" case was
    // never reached and the assertion for it failed.
    const result = forDay(
      [shift("e1", "09", "17"), shift("e2", "09", null), shift("e3", "09", "17"), shift("e4", "09", "13"), shift("e5", "17", "09")],
      [rate("e1", 1500), rate("e3", 400000, { rate_type: "salary" })]
    );
    assert.equal(result.people, 1);
    assert.equal(result.missing, 4);
    const sentence = labourGapSentence(result);
    assert.match(sentence, /1 still clocked in/);
    assert.match(sentence, /1 with no pay rate/);
    assert.match(sentence, /1 not paid by the hour/);
    assert.match(sentence, /1 whose hours do not add up/);
    assert.match(sentence, / and /, "a list of gaps reads as a sentence rather than a comma run");
  });

  it("says nothing about gaps when a day is fully costed", () => {
    const result = forDay([shift("e1", "09", "17")], [rate("e1", 1500)]);
    assert.equal(labourGapSentence(result), "");
    assert.equal(labourGapSentence(null), "");
  });

  it("survives a day with no entries at all", () => {
    const result = forDay([], []);
    assert.deepEqual({ cost: result.costCents, people: result.people, complete: result.complete }, { cost: 0, people: 0, complete: true });
    assert.equal(labourCostForDay({}).people, 0, "an absent list is not a crash");
  });
});
