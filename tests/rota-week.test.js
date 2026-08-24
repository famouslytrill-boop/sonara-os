"use strict";

// A week of shifts, and the three ways a rota view misleads.
//
// **It shows cover that is not there.** Two people on Monday is not Tuesday
// covered, and an unreadable shift dropped in silence is cover a business
// believes it has. This matters more than it did: the public booking page only
// offers a slot when somebody is rostered for the whole of it, so a business
// that left a Tuesday empty has a page quietly showing that Tuesday as
// unavailable -- which does not read as closed, it reads as full.
//
// **It loses an hour twice a year.** A week built by adding 24 hours seven
// times drifts after a clock change, and a day is 23 or 25 hours on those
// Sundays.
//
// **It cuts a night shift in half.** 23:00 to 02:00 is three hours across two
// local days, not a shift starting at midnight.
//
// Everything is pure: the week and the zone are passed in, so none of this
// depends on the day the test runs.

const assert = require("node:assert/strict");
const {
  mergeIntervals,
  subtractIntervals,
  peakConcurrent,
  layOutWeek,
  weekStartFor,
  shiftWeek,
  hoursAndMinutes,
  startOfLocalDay,
  isoDayParts
} = require("../lib/sonara-rota-week.cjs");

const ALEX = "11111111-0000-4000-8000-00000000aaaa";
const SAM = "22222222-0000-4000-8000-00000000bbbb";
const NAMES = new Map([[ALEX, "Alex"], [SAM, "Sam"]]);

// Monday 1 June 2026, British Summer Time, so London is an hour ahead of UTC.
const WEEK = "2026-06-01";

function shift(employeeId, startsAt, endsAt, overrides = {}) {
  return { id: `${employeeId}-${startsAt}`, employee_id: employeeId, starts_at: startsAt, ends_at: endsAt, status: "scheduled", ...overrides };
}

function layOut(shifts, overrides = {}) {
  return layOutWeek({ shifts, weekStartsOn: WEEK, timeZone: "Europe/London", names: NAMES, ...overrides });
}

describe("a week of shifts", () => {
  describe("the interval arithmetic underneath", () => {
    it("merges two people on at once into one stretch of cover", () => {
      assert.deepEqual(mergeIntervals([{ start: 0, end: 100 }, { start: 50, end: 150 }]), [{ start: 0, end: 150 }]);
    });

    it("joins two shifts that touch, and keeps two that do not", () => {
      assert.deepEqual(mergeIntervals([{ start: 0, end: 100 }, { start: 100, end: 200 }]), [{ start: 0, end: 200 }]);
      assert.equal(mergeIntervals([{ start: 0, end: 100 }, { start: 101, end: 200 }]).length, 2);
    });

    it("drops an interval that ends before it starts rather than reversing it", () => {
      assert.deepEqual(mergeIntervals([{ start: 100, end: 50 }]), []);
    });

    it("finds the hole in the middle of a covered stretch", () => {
      assert.deepEqual(
        subtractIntervals([{ start: 0, end: 300 }], [{ start: 0, end: 100 }, { start: 200, end: 300 }]),
        [{ start: 100, end: 200 }]
      );
    });

    it("reports the whole want when nothing covers it, and nothing when it is covered", () => {
      assert.deepEqual(subtractIntervals([{ start: 0, end: 100 }], []), [{ start: 0, end: 100 }]);
      assert.deepEqual(subtractIntervals([{ start: 0, end: 100 }], [{ start: 0, end: 100 }]), []);
      assert.deepEqual(subtractIntervals([{ start: 10, end: 90 }], [{ start: 0, end: 100 }]), []);
    });

    it("counts how many are on at once, not how many shifts there are", () => {
      assert.equal(peakConcurrent([{ start: 0, end: 100 }, { start: 200, end: 300 }]), 1, "two shifts back to back is one person at a time");
      assert.equal(peakConcurrent([{ start: 0, end: 100 }, { start: 50, end: 150 }]), 2);
      assert.equal(peakConcurrent([{ start: 0, end: 100 }, { start: 100, end: 200 }]), 1,
        "somebody finishing at five and somebody starting at five are never both at work");
    });
  });

  describe("reading a week start", () => {
    it("refuses a date that only looks like one", () => {
      // Date.UTC rolls over, so this well-formed string silently becomes
      // 9 February 2027 and lays out a week eight months away.
      assert.equal(isoDayParts("2026-13-40"), null);
      assert.equal(isoDayParts("2026-02-30"), null, "February never has thirty days");
      assert.notEqual(isoDayParts("2028-02-29"), null, "and a real leap day is still a date");
    });
  });

  describe("laying out the days", () => {
    it("puts a shift on its own day, at its local time", () => {
      // 08:00 UTC is 09:00 in London in June.
      const week = layOut([shift(ALEX, "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z")]);
      assert.equal(week.ok, true);
      assert.equal(week.days.length, 7);
      const monday = week.days.find((day) => day.date === "2026-06-01");
      assert.equal(monday.weekday, "Monday");
      assert.equal(monday.shifts.length, 1);
      assert.equal(monday.shifts[0].from, "09:00");
      assert.equal(monday.shifts[0].to, "17:00");
      assert.equal(monday.shifts[0].who, "Alex");
      assert.equal(monday.staffedMinutes, 480);
    });

    it("splits a night shift across the two days it is worked on", () => {
      // 22:00 to 01:00 UTC is 23:00 Monday to 02:00 Tuesday in London.
      const week = layOut([shift(ALEX, "2026-06-01T22:00:00Z", "2026-06-02T01:00:00Z")]);
      const monday = week.days.find((day) => day.date === "2026-06-01");
      const tuesday = week.days.find((day) => day.date === "2026-06-02");

      assert.equal(monday.shifts.length, 1);
      assert.equal(monday.shifts[0].from, "23:00");
      assert.equal(monday.shifts[0].to, "24:00", "a shift running to midnight must not read as ending at 00:00");
      assert.equal(monday.shifts[0].continuesIntoNext, true);

      assert.equal(tuesday.shifts.length, 1);
      assert.equal(tuesday.shifts[0].from, "00:00");
      assert.equal(tuesday.shifts[0].to, "02:00");
      assert.equal(tuesday.shifts[0].continuesFromPrevious, true);

      assert.equal(week.staffedMinutes, 180, "a night shift was counted twice or cut in half");
    });

    it("counts people on at once per day", () => {
      const week = layOut([
        shift(ALEX, "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z"),
        shift(SAM, "2026-06-01T12:00:00Z", "2026-06-01T20:00:00Z"),
        shift(SAM, "2026-06-02T08:00:00Z", "2026-06-02T16:00:00Z")
      ]);
      assert.equal(week.days.find((day) => day.date === "2026-06-01").peopleOnAtOnce, 2);
      assert.equal(week.days.find((day) => day.date === "2026-06-02").peopleOnAtOnce, 1);
      assert.equal(week.people, 2);
    });

    it("leaves out a cancelled shift and counts one it cannot read", () => {
      const week = layOut([
        shift(ALEX, "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z", { status: "cancelled" }),
        shift(SAM, "2026-06-01T08:00:00Z", null),
        shift(SAM, "2026-06-02T08:00:00Z", "2026-06-02T07:00:00Z")
      ]);
      assert.equal(week.staffedMinutes, 0);
      // A shift with no end is not somebody working for ever, and one ending
      // before it starts is not negative work -- but both were entered by
      // somebody, so a week that drops them shows less cover than is believed.
      assert.equal(week.unreadable, 2, "an unreadable shift was dropped in silence");
    });

    it("does not count a status it does not recognise", () => {
      const week = layOut([shift(ALEX, "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z", { status: "maybe_swapping" })]);
      assert.equal(week.staffedMinutes, 0, "an unrecognised status was drawn as cover the booking page would then sell");
    });

    it("shows an empty day as empty rather than leaving it out", () => {
      const week = layOut([shift(ALEX, "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z")]);
      const sunday = week.days.find((day) => day.date === "2026-06-07");
      assert.ok(sunday, "a day with nobody on it was dropped from the week");
      assert.deepEqual(sunday.shifts, []);
      assert.equal(sunday.staffedMinutes, 0);
    });
  });

  describe("across a clock change", () => {
    it("keeps seven days and the right dates through a spring forward", () => {
      // The UK goes forward at 01:00 on Sunday 29 March 2026.
      const week = layOutWeek({ shifts: [], weekStartsOn: "2026-03-23", timeZone: "Europe/London" });
      assert.equal(week.ok, true);
      assert.deepEqual(week.days.map((day) => day.date), [
        "2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"
      ], "a week built by adding 24 hours drifts a date after the clocks change");
    });

    it("keeps a shift at its local hours on both sides of the change", () => {
      const before = layOutWeek({
        weekStartsOn: "2026-03-23", timeZone: "Europe/London", names: NAMES,
        shifts: [shift(ALEX, "2026-03-27T09:00:00Z", "2026-03-27T17:00:00Z")]
      });
      assert.equal(before.days.find((day) => day.date === "2026-03-27").shifts[0].from, "09:00", "GMT: 09:00 UTC is 09:00 local");

      const after = layOutWeek({
        weekStartsOn: "2026-03-30", timeZone: "Europe/London", names: NAMES,
        shifts: [shift(ALEX, "2026-03-30T08:00:00Z", "2026-03-30T16:00:00Z")]
      });
      assert.equal(after.days[0].shifts[0].from, "09:00", "BST: 08:00 UTC is 09:00 local");
    });

    it("keeps seven days through an autumn back, when a day is 25 hours", () => {
      // The UK goes back at 02:00 on Sunday 25 October 2026.
      const week = layOutWeek({ shifts: [], weekStartsOn: "2026-10-19", timeZone: "Europe/London" });
      assert.deepEqual(week.days.map((day) => day.date).slice(-1), ["2026-10-25"]);
      assert.equal(week.days.length, 7);
    });

    it("keeps the last hour of a 25-hour day, which adding 24 hours loses", () => {
      // The UK goes back at 02:00 on Sunday 25 October 2026, so that local day
      // is 25 hours: it starts at 23:00Z on the 24th and ends at 00:00Z on the
      // 26th. A day ended by adding 86400000 stops an hour early and drops this
      // shift out of the week entirely.
      const week = layOutWeek({
        weekStartsOn: "2026-10-19", timeZone: "Europe/London", names: NAMES,
        shifts: [shift(ALEX, "2026-10-25T23:00:00Z", "2026-10-26T00:00:00Z")]
      });
      const sunday = week.days.find((day) => day.date === "2026-10-25");
      assert.equal(sunday.shifts.length, 1, "the last hour of a 25-hour day was dropped");
      assert.equal(sunday.shifts[0].from, "23:00");
      assert.equal(sunday.shifts[0].to, "24:00");
      assert.equal(week.staffedMinutes, 60);
    });

    it("finds the start of a day whose midnight does not exist", () => {
      // Havana springs forward at midnight, so 00:00 never happens that night.
      assert.notEqual(startOfLocalDay({ year: 2026, month: 3, day: 8 }, "America/Havana"), null,
        "a whole day was dropped out of the week");
    });
  });

  describe("the hours nobody is on", () => {
    // Open 09:00-17:00 Monday to Friday, in the booking page's Sunday-first shape.
    const OPEN = [
      null,
      { open: "09:00", close: "17:00" },
      { open: "09:00", close: "17:00" },
      { open: "09:00", close: "17:00" },
      { open: "09:00", close: "17:00" },
      { open: "09:00", close: "17:00" },
      null
    ];

    it("reports nothing missing when the day is covered", () => {
      const week = layOut([shift(ALEX, "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z")], { openingHours: OPEN });
      assert.deepEqual(week.days.find((day) => day.date === "2026-06-01").gaps, []);
    });

    it("names the hole in the middle of a day", () => {
      const week = layOut([
        shift(ALEX, "2026-06-01T08:00:00Z", "2026-06-01T11:00:00Z"),
        shift(ALEX, "2026-06-01T13:00:00Z", "2026-06-01T16:00:00Z")
      ], { openingHours: OPEN });
      assert.deepEqual(week.days.find((day) => day.date === "2026-06-01").gaps, [{ from: "12:00", to: "14:00", minutes: 120 }]);
    });

    it("reports a whole open day with nobody on it", () => {
      // The case that matters: the booking page shows that Tuesday as
      // unavailable and the business believes it is busy.
      const week = layOut([shift(ALEX, "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z")], { openingHours: OPEN });
      assert.deepEqual(week.days.find((day) => day.date === "2026-06-02").gaps, [{ from: "09:00", to: "17:00", minutes: 480 }]);
      assert.ok(week.gaps.some((gap) => gap.date === "2026-06-02"), "the week's gap list did not carry the day");
    });

    it("counts two people at once as one hour covered, and two hours worked", () => {
      // The two figures pull in opposite directions on purpose. Coverage is a
      // union -- two people on the morning does not cover the afternoon. Hours
      // worked is a sum -- the business paid for both of them.
      //
      // A note on what this does and does not prove: subtractIntervals is
      // already overlap-tolerant, so removing the merge does not change `gaps`
      // here. Merging is normalisation at that call site, not correctness. What
      // the union genuinely decides is peopleOnAtOnce, which is asserted.
      const week = layOut([
        shift(ALEX, "2026-06-01T08:00:00Z", "2026-06-01T12:00:00Z"),
        shift(SAM, "2026-06-01T08:00:00Z", "2026-06-01T12:00:00Z")
      ], { openingHours: OPEN });
      const monday = week.days.find((day) => day.date === "2026-06-01");
      assert.deepEqual(monday.gaps, [{ from: "13:00", to: "17:00", minutes: 240 }],
        "two people on the morning was counted as covering the afternoon");
      assert.equal(monday.staffedMinutes, 480, "the hours worked are a sum, and both were paid");
      assert.equal(monday.peopleOnAtOnce, 2);
    });

    it("says nothing about gaps at all when the business has not said when it is open", () => {
      // An empty list here reads as "fully covered", which is a claim nothing
      // checked.
      const week = layOut([shift(ALEX, "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z")]);
      assert.equal(week.gaps, null);
      assert.equal(week.days[0].gaps, null);
    });

    it("has no gaps on a day the business is shut", () => {
      const week = layOut([], { openingHours: OPEN });
      assert.deepEqual(week.days.find((day) => day.date === "2026-06-07").gaps, [], "a closed Sunday was reported as uncovered");
    });
  });

  describe("when it cannot lay one out", () => {
    it("refuses a zone the server does not know rather than using its own", () => {
      const week = layOutWeek({ shifts: [], weekStartsOn: WEEK, timeZone: "Middle/Earth" });
      assert.equal(week.ok, false);
      assert.match(week.reason, /time zone/i);
    });

    it("refuses a week start that is not a date", () => {
      for (const start of ["", "next monday", "2026-13-40", "2026-02-30", null]) {
        assert.equal(layOutWeek({ shifts: [], weekStartsOn: start, timeZone: "Europe/London" }).ok, false, `accepted ${JSON.stringify(start)}`);
      }
      assert.equal(layOutWeek({ shifts: [], weekStartsOn: WEEK, timeZone: "Europe/London" }).ok, true,
        "and it accepts a real one, or every assertion above passes by refusing everything");
    });
  });

  describe("moving between weeks", () => {
    it("finds the Monday on or before a date", () => {
      assert.equal(weekStartFor(new Date("2026-06-03T12:00:00Z"), "Europe/London"), "2026-06-01");
      assert.equal(weekStartFor(new Date("2026-06-01T12:00:00Z"), "Europe/London"), "2026-06-01", "a Monday is its own week start");
      assert.equal(weekStartFor(new Date("2026-06-07T12:00:00Z"), "Europe/London"), "2026-06-01", "Sunday belongs to the week that began six days earlier");
    });

    it("steps a week forward and back, including across a clock change", () => {
      assert.equal(shiftWeek("2026-06-01", 1, "Europe/London"), "2026-06-08");
      assert.equal(shiftWeek("2026-06-08", -1, "Europe/London"), "2026-06-01");
      assert.equal(shiftWeek("2026-03-23", 1, "Europe/London"), "2026-03-30", "the week after the clocks change is still a Monday");
      assert.equal(shiftWeek("2026-10-19", 1, "Europe/London"), "2026-10-26", "and so is the week after they go back");
    });

    it("refuses to step from something that is not a week", () => {
      assert.equal(shiftWeek("soon", 1, "Europe/London"), null);
      assert.equal(shiftWeek("2026-13-40", 1, "Europe/London"), null);
    });
  });

  describe("saying it in words", () => {
    it("reads hours and minutes the way somebody would say them", () => {
      assert.equal(hoursAndMinutes(480), "8h");
      assert.equal(hoursAndMinutes(510), "8h 30m");
      assert.equal(hoursAndMinutes(45), "45m");
      assert.equal(hoursAndMinutes(0), "0m");
    });
  });
});
