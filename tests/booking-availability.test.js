"use strict";

// The arithmetic behind a public booking page.
//
// Two ways this can be wrong, and only one of them is ever reported. A slot
// list that is too generous double-books a business in front of its own
// customer, and somebody complains. A slot list that is too mean silently loses
// work -- nobody ever writes in about the appointment they could not make. So
// the mean direction is tested as hard as the generous one.
//
// Everything here is pure: no clock, no network, no database. `now` is passed
// in on every call, because a test that depends on the hour it runs at is a
// test that fails on a Sunday for reasons nobody can reproduce.

const assert = require("node:assert/strict");
const {
  WEEKDAY_NAMES,
  shiftSpans,
  freeStaffFor,
  blockingSpans: blockingSpansForStaff,
  knownZone,
  localParts,
  instantFor,
  minutesFromClock,
  rangesForDay,
  normaliseOpeningHours,
  blockingSpans,
  availableSlots,
  isBookable
} = require("../lib/sonara-booking-availability.cjs");

// Sunday first, and a business open 09:00-17:00 on weekdays only.
const WEEKDAYS_9_TO_5 = [
  null,
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  null
];

function page(overrides = {}) {
  return {
    time_zone: "Europe/London",
    opening_hours: WEEKDAYS_9_TO_5,
    slot_minutes: 30,
    lead_time_hours: 0,
    horizon_days: 7,
    ...overrides
  };
}

// A Monday, 00:00 UTC, well inside British Summer Time.
const MONDAY = Date.parse("2026-06-01T00:00:00Z");

describe("the times a stranger may book", () => {
  describe("reading a time zone", () => {
    it("refuses a zone the server does not know rather than using its own clock", () => {
      assert.equal(knownZone("Middle/Earth"), null);
      assert.equal(knownZone("Pacific/Auckland"), "Pacific/Auckland");
    });

    it("reports the local wall clock, not the server's", () => {
      // 12:00 UTC on a June day is 13:00 in London (BST, +1) and midnight the
      // next morning in Auckland (NZST, +12 -- June is winter there, so it is
      // not +13). Getting this wrong in either direction is what the module
      // would do if it read the server's clock instead.
      const instant = new Date("2026-06-01T12:00:00Z");
      assert.equal(localParts(instant, "Europe/London").hour, 13);
      assert.equal(localParts(instant, "Pacific/Auckland").hour, 0);
      assert.equal(localParts(instant, "Pacific/Auckland").day, 2, "and it is already tomorrow there");
    });

    it("finds the instant a wall-clock time happens in a zone", () => {
      const utc = instantFor({ year: 2026, month: 6, day: 1, hour: 9, minute: 0 }, "Europe/London");
      assert.equal(new Date(utc).toISOString(), "2026-06-01T08:00:00.000Z", "09:00 London in June is 08:00 UTC");
    });

    it("refuses a wall-clock time that does not exist on that date", () => {
      // The UK springs forward at 01:00 on 29 March 2026: 01:30 never happens.
      assert.equal(instantFor({ year: 2026, month: 3, day: 29, hour: 1, minute: 30 }, "Europe/London"), null);
      // The half hour on either side does happen, so this is not simply
      // refusing everything that day.
      assert.notEqual(instantFor({ year: 2026, month: 3, day: 29, hour: 0, minute: 30 }, "Europe/London"), null);
      assert.notEqual(instantFor({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 }, "Europe/London"), null);
    });

    it("keeps 09:00 at 09:00 local on both sides of a clock change", () => {
      const before = instantFor({ year: 2026, month: 3, day: 27, hour: 9, minute: 0 }, "Europe/London");
      const after = instantFor({ year: 2026, month: 3, day: 30, hour: 9, minute: 0 }, "Europe/London");
      assert.equal(localParts(new Date(before), "Europe/London").hour, 9);
      assert.equal(localParts(new Date(after), "Europe/London").hour, 9);
      // And they are genuinely different offsets, or the assertion above proves
      // nothing: three days apart is 72 hours, but the clock moved an hour.
      assert.equal(after - before, 71 * 3600 * 1000);
    });
  });

  describe("reading opening hours", () => {
    it("closes the day on anything it cannot read, rather than opening at midnight", () => {
      assert.equal(minutesFromClock("09:00"), 540);
      assert.equal(minutesFromClock("9:00"), 540);
      assert.equal(minutesFromClock(""), null, "an empty time must not become 00:00");
      assert.equal(minutesFromClock("nine"), null);
      assert.equal(minutesFromClock("25:00"), null);
      assert.equal(minutesFromClock("09:60"), null);
      assert.equal(minutesFromClock(null), null);
    });

    it("drops a range that ends before it starts instead of reinterpreting it", () => {
      assert.deepEqual(rangesForDay({ open: "17:00", close: "09:00" }), []);
      assert.deepEqual(rangesForDay({ open: "09:00", close: "09:00" }), []);
      assert.deepEqual(rangesForDay({ open: "09:00", close: "17:00" }), [{ open: 540, close: 1020 }]);
    });

    it("accepts a day with two ranges and puts them in order", () => {
      const ranges = rangesForDay([{ open: "13:00", close: "17:00" }, { open: "09:00", close: "12:00" }]);
      assert.deepEqual(ranges, [{ open: 540, close: 720 }, { open: 780, close: 1020 }]);
    });

    it("closes the days a short list does not describe rather than padding them", () => {
      const hours = normaliseOpeningHours([null, { open: "09:00", close: "17:00" }]);
      assert.equal(hours.length, 7);
      assert.equal(hours[1].length, 1);
      assert.equal(hours[6].length, 0, "Saturday was not described, so it is closed");
    });
  });

  describe("what an existing booking blocks", () => {
    it("holds the time for a booking that has not been cancelled", () => {
      const spans = blockingSpans([
        { starts_at: "2026-06-01T09:00:00Z", ends_at: "2026-06-01T10:00:00Z", status: "confirmed" },
        { starts_at: "2026-06-01T11:00:00Z", ends_at: "2026-06-01T12:00:00Z", status: "requested" }
      ]);
      assert.equal(spans.length, 2);
    });

    it("frees the time for cancelled, no-show and archived bookings", () => {
      for (const status of ["cancelled", "no_show", "archived", "CANCELLED"]) {
        const spans = blockingSpans([{ starts_at: "2026-06-01T09:00:00Z", ends_at: "2026-06-01T10:00:00Z", status }]);
        assert.equal(spans.length, 0, `${status} should free the time`);
      }
    });

    it("holds the time for a status it does not recognise", () => {
      // An unrecognised status is not known to be free, and offering a slot
      // that is actually taken is the failure that reaches two people at once.
      const spans = blockingSpans([{ starts_at: "2026-06-01T09:00:00Z", ends_at: "2026-06-01T10:00:00Z", status: "rescheduled_maybe" }]);
      assert.equal(spans.length, 1);
    });

    it("gives a booking with no end a real length rather than a length of zero", () => {
      const spans = blockingSpans([{ starts_at: "2026-06-01T09:00:00Z", ends_at: null, status: "confirmed" }], { defaultMinutes: 45 });
      assert.equal(spans.length, 1);
      assert.equal(spans[0].end - spans[0].start, 45 * 60000, "a zero-length booking would block nothing and the time would be sold twice");
    });

    it("ignores a booking whose start cannot be read", () => {
      assert.equal(blockingSpans([{ starts_at: "not a time", status: "confirmed" }]).length, 0);
    });
  });

  describe("building the list", () => {
    it("offers the whole of a working day at the slot size asked for", () => {
      const result = availableSlots({ page: page(), durationMinutes: 30, bookings: [], now: MONDAY });
      assert.equal(result.ok, true);
      const monday = result.days.find((day) => day.date === "2026-06-01");
      assert.ok(monday, "Monday should be offered");
      // 09:00 to 17:00 is eight hours; a 30-minute service on a 30-minute grid
      // fits sixteen times, the last starting at 16:30.
      assert.equal(monday.times.length, 16);
      assert.equal(monday.times[0].localTime, "09:00");
      assert.equal(monday.times[15].localTime, "16:30");
    });

    it("will not start a service that cannot finish before closing", () => {
      const result = availableSlots({ page: page(), durationMinutes: 90, bookings: [], now: MONDAY });
      const monday = result.days.find((day) => day.date === "2026-06-01");
      assert.equal(monday.times.at(-1).localTime, "15:30", "a 90-minute service must finish by 17:00");
    });

    it("offers nothing on a day the business is closed", () => {
      const result = availableSlots({ page: page(), durationMinutes: 30, bookings: [], now: MONDAY });
      const weekdays = new Set(result.days.map((day) => day.weekday));
      assert.equal(weekdays.has("Saturday"), false);
      assert.equal(weekdays.has("Sunday"), false);
      assert.ok(weekdays.has("Monday"), "and it is offering something, or the assertions above pass by being empty");
    });

    it("does not offer a slot an existing booking overlaps", () => {
      const bookings = [{ starts_at: "2026-06-01T09:00:00Z", ends_at: "2026-06-01T10:00:00Z", status: "confirmed" }];
      const result = availableSlots({ page: page(), durationMinutes: 30, bookings, now: MONDAY });
      const monday = result.days.find((day) => day.date === "2026-06-01");
      const offered = monday.times.map((time) => time.localTime);
      // 09:00 UTC is 10:00 London. The booking runs 10:00-11:00 local.
      assert.equal(offered.includes("10:00"), false);
      assert.equal(offered.includes("10:30"), false);
      assert.equal(offered.includes("11:00"), true, "a booking ending at 11:00 must not block one starting at 11:00");
      assert.equal(offered.includes("09:30"), true, "a booking starting at 10:00 must not block a 30-minute slot at 09:30");
    });

    it("blocks the slot before a booking when the service would run into it", () => {
      const bookings = [{ starts_at: "2026-06-01T09:00:00Z", ends_at: "2026-06-01T10:00:00Z", status: "confirmed" }];
      const result = availableSlots({ page: page(), durationMinutes: 60, bookings, now: MONDAY });
      const offered = result.days.find((day) => day.date === "2026-06-01").times.map((time) => time.localTime);
      assert.equal(offered.includes("09:30"), false, "a 60-minute service at 09:30 would run into a 10:00 booking");
      assert.equal(offered.includes("09:00"), true);
    });

    it("offers nothing inside the lead time", () => {
      // Noon UTC on the Monday is 13:00 in London. With a two hour lead time
      // the earliest bookable slot is 15:00 local, so the morning is gone and
      // four slots are left before a 30-minute service stops fitting.
      const now = Date.parse("2026-06-01T12:00:00Z");
      const result = availableSlots({ page: page({ lead_time_hours: 2 }), durationMinutes: 30, bookings: [], now });
      const monday = result.days.find((day) => day.date === "2026-06-01");
      assert.deepEqual(monday.times.map((time) => time.localTime), ["15:00", "15:30", "16:00", "16:30"]);
    });

    it("clears the whole day when the lead time runs past closing", () => {
      const now = Date.parse("2026-06-01T12:00:00Z");
      const result = availableSlots({ page: page({ lead_time_hours: 4 }), durationMinutes: 30, bookings: [], now });
      assert.equal(result.days.some((day) => day.date === "2026-06-01"), false, "17:00 local is closing time, so nothing on Monday is far enough ahead");
      assert.ok(result.days.length > 0, "and the following days are still offered");
    });

    it("stops at the horizon rather than running on", () => {
      const short = availableSlots({ page: page({ horizon_days: 2 }), durationMinutes: 30, bookings: [], now: MONDAY });
      const long = availableSlots({ page: page({ horizon_days: 7 }), durationMinutes: 30, bookings: [], now: MONDAY });
      assert.ok(short.slots > 0);
      assert.ok(long.slots > short.slots, "a longer horizon must offer more, or the horizon is not being applied");
      assert.ok(short.days.length <= 3);
    });

    it("never offers the hour that does not exist on a spring-forward morning", () => {
      // A business open 00:00-06:00 on the Sunday the UK clocks go forward.
      // 01:00 to 01:59 local does not happen that day.
      const springForward = [
        { open: "00:00", close: "06:00" }, null, null, null, null, null, null
      ];
      const now = Date.parse("2026-03-28T00:00:00Z");
      const result = availableSlots({
        page: page({ opening_hours: springForward, horizon_days: 2 }),
        durationMinutes: 30, bookings: [], now
      });
      const sunday = result.days.find((day) => day.date === "2026-03-29");
      assert.ok(sunday, "the Sunday should still be offered -- most of it exists");
      const offered = sunday.times.map((time) => time.localTime);
      assert.equal(offered.includes("01:00"), false, "01:00 does not happen on this date");
      assert.equal(offered.includes("01:30"), false, "01:30 does not happen on this date");
      assert.equal(offered.includes("00:30"), true, "and the rest of the morning is still offered");
      assert.equal(offered.includes("02:00"), true);
    });
  });

  describe("when it cannot build a list", () => {
    it("says the zone is wrong rather than using the server's", () => {
      const result = availableSlots({ page: page({ time_zone: "Middle/Earth" }), durationMinutes: 30, now: MONDAY });
      assert.equal(result.ok, false);
      assert.match(result.reason, /time zone/i);
      assert.equal(result.days.length, 0);
    });

    it("says the service has no length rather than assuming one", () => {
      for (const duration of [null, 0, "", "soon", -30]) {
        const result = availableSlots({ page: page(), durationMinutes: duration, now: MONDAY });
        assert.equal(result.ok, false, `${JSON.stringify(duration)} must not be treated as a length`);
        assert.match(result.reason, /how long it takes/i);
      }
    });

    it("says the hours are not set rather than showing an empty week", () => {
      const result = availableSlots({ page: page({ opening_hours: [null, null, null, null, null, null, null] }), durationMinutes: 30, now: MONDAY });
      assert.equal(result.ok, false);
      assert.match(result.reason, /opening hours/i);
    });

    it("separates a full diary from a broken page", () => {
      // Open, configured, and every slot taken.
      const bookings = [{ starts_at: "2026-06-01T00:00:00Z", ends_at: "2026-06-30T00:00:00Z", status: "confirmed" }];
      const result = availableSlots({ page: page(), durationMinutes: 30, bookings, now: MONDAY });
      assert.equal(result.ok, true, "a full diary is a working page, not a broken one");
      assert.equal(result.slots, 0);
      assert.match(result.reason, /Nothing is free/);
    });
  });

  describe("checking a time again when the form comes back", () => {
    it("accepts a time the page would have offered", () => {
      const result = availableSlots({ page: page(), durationMinutes: 30, bookings: [], now: MONDAY });
      const first = result.days[0].times[0];
      const check = isBookable({ page: page(), durationMinutes: 30, bookings: [], startsAt: first.startsAt, now: MONDAY });
      assert.equal(check.ok, true);
      assert.equal(check.startsAt, first.startsAt);
      assert.equal(check.endsAt, first.endsAt);
    });

    it("refuses a time somebody else took between the page loading and the form arriving", () => {
      const result = availableSlots({ page: page(), durationMinutes: 30, bookings: [], now: MONDAY });
      const first = result.days[0].times[0];
      const takenSince = [{ starts_at: first.startsAt, ends_at: first.endsAt, status: "requested" }];
      const check = isBookable({ page: page(), durationMinutes: 30, bookings: takenSince, startsAt: first.startsAt, now: MONDAY });
      assert.equal(check.ok, false, "checking only at render time is the double-book");
      assert.match(check.reason, /just been taken|no longer offered/);
    });

    it("refuses a time the page would never have offered, even though nothing is booked then", () => {
      // 03:00 on a Sunday. The diary is empty; the business is closed.
      const check = isBookable({ page: page(), durationMinutes: 30, bookings: [], startsAt: "2026-06-07T03:00:00Z", now: MONDAY });
      assert.equal(check.ok, false, "a hand-made request must not be able to book outside opening hours");
    });

    it("refuses a start that is not off the grid but is not a time at all", () => {
      const check = isBookable({ page: page(), durationMinutes: 30, bookings: [], startsAt: "tomorrow-ish", now: MONDAY });
      assert.equal(check.ok, false);
      assert.match(check.reason, /not a time/);
    });

    it("refuses everything when the page itself cannot produce a list", () => {
      const check = isBookable({ page: page({ time_zone: "Middle/Earth" }), durationMinutes: 30, bookings: [], startsAt: "2026-06-01T09:00:00Z", now: MONDAY });
      assert.equal(check.ok, false);
      assert.match(check.reason, /time zone/i);
    });
  });

  // A business with staff has more than one of each slot.
  //
  // The page shipped without this, and the bug ran in both directions at once:
  // a firm with two plumbers was selling one of every hour, and the second
  // plumber's whole diary was unsellable because one appointment closed the
  // hour for the business. Both directions are tested, because only one of them
  // ever gets reported -- the customer who could not book never writes in.
  describe("booking a person rather than a business", () => {
    const ALEX = "11111111-0000-4000-8000-00000000aaaa";
    const SAM = "22222222-0000-4000-8000-00000000bbbb";

    // Both on the Monday, 09:00-17:00 London, which is 08:00-16:00 UTC.
    function bothOnShift() {
      return [
        { employee_id: ALEX, starts_at: "2026-06-01T08:00:00.000Z", ends_at: "2026-06-01T16:00:00.000Z", status: "scheduled" },
        { employee_id: SAM, starts_at: "2026-06-01T08:00:00.000Z", ends_at: "2026-06-01T16:00:00.000Z", status: "confirmed" }
      ];
    }

    function staffedPage(overrides = {}) {
      return page({ assign_staff: true, ...overrides });
    }

    describe("reading the rota", () => {
      it("counts a shift somebody is actually working", () => {
        assert.equal(shiftSpans(bothOnShift()).length, 2);
      });

      it("does not count a cancelled or missed shift as somebody at work", () => {
        for (const status of ["cancelled", "missed", "CANCELLED"]) {
          const spans = shiftSpans([{ employee_id: ALEX, starts_at: "2026-06-01T08:00:00.000Z", ends_at: "2026-06-01T16:00:00.000Z", status }]);
          assert.equal(spans.length, 0, `${status} rostered somebody who is not there`);
        }
      });

      it("does not count a status it does not recognise", () => {
        // The opposite of how an unrecognised booking status is treated, and
        // deliberately: both choices fail towards offering fewer slots.
        const spans = shiftSpans([{ employee_id: ALEX, starts_at: "2026-06-01T08:00:00.000Z", ends_at: "2026-06-01T16:00:00.000Z", status: "maybe_swapping" }]);
        assert.equal(spans.length, 0);
      });

      it("refuses a shift with no end rather than rostering somebody for ever", () => {
        const spans = shiftSpans([{ employee_id: ALEX, starts_at: "2026-06-01T08:00:00.000Z", ends_at: null, status: "scheduled" }]);
        assert.equal(spans.length, 0, "an open-ended shift would put one person in every slot the page can offer");
      });

      it("refuses a shift belonging to nobody", () => {
        assert.equal(shiftSpans([{ employee_id: null, starts_at: "2026-06-01T08:00:00.000Z", ends_at: "2026-06-01T16:00:00.000Z", status: "scheduled" }]).length, 0);
      });
    });

    describe("who could take an appointment", () => {
      const start = Date.parse("2026-06-01T09:00:00.000Z");
      const end = Date.parse("2026-06-01T10:00:00.000Z");

      it("names everybody rostered and free", () => {
        const free = freeStaffFor(start, end, { shifts: shiftSpans(bothOnShift()), bookings: [] });
        assert.deepEqual(free.sort(), [ALEX, SAM].sort());
      });

      it("drops the one who is already booked, and keeps the other", () => {
        const bookings = blockingSpansForStaff([
          { starts_at: "2026-06-01T09:00:00.000Z", ends_at: "2026-06-01T10:00:00.000Z", status: "confirmed", assigned_employee_id: ALEX }
        ]);
        const free = freeStaffFor(start, end, { shifts: shiftSpans(bothOnShift()), bookings });
        assert.deepEqual(free, [SAM], "one person's appointment closed the other person's hour");
      });

      it("drops somebody whose shift only partly covers the appointment", () => {
        // Leaves at 09:30. A one-hour job starting at 09:00 ends after they go.
        const shifts = shiftSpans([{ employee_id: ALEX, starts_at: "2026-06-01T08:00:00.000Z", ends_at: "2026-06-01T09:30:00.000Z", status: "scheduled" }]);
        assert.deepEqual(freeStaffFor(start, end, { shifts, bookings: [] }), [], "an appointment was offered that ends after the person doing it goes home");
      });

      it("stops everybody on a booking nobody is named on", () => {
        // The state a business is in the moment it switches staffing on: every
        // existing appointment predates the idea of an assignee.
        const bookings = blockingSpansForStaff([
          { starts_at: "2026-06-01T09:00:00.000Z", ends_at: "2026-06-01T10:00:00.000Z", status: "confirmed", assigned_employee_id: null }
        ]);
        assert.deepEqual(freeStaffFor(start, end, { shifts: shiftSpans(bothOnShift()), bookings }), [], "an unassigned appointment was double-booked onto two people");
      });
    });

    describe("the list it produces", () => {
      it("still offers the hour when one of two people is busy", () => {
        const bookings = [{ starts_at: "2026-06-01T09:00:00.000Z", ends_at: "2026-06-01T10:00:00.000Z", status: "confirmed", assigned_employee_id: ALEX }];
        const result = availableSlots({ page: staffedPage(), durationMinutes: 60, bookings, staffShifts: bothOnShift(), now: MONDAY });
        const offered = result.days.find((day) => day.date === "2026-06-01").times.map((time) => time.localTime);
        assert.ok(offered.includes("10:00"), "the second plumber's diary was unsellable");
        assert.equal(result.staffed, true);
        assert.equal(result.rosteredPeople, 2);
      });

      it("closes the hour when both people are busy", () => {
        const bookings = [
          { starts_at: "2026-06-01T09:00:00.000Z", ends_at: "2026-06-01T10:00:00.000Z", status: "confirmed", assigned_employee_id: ALEX },
          { starts_at: "2026-06-01T09:00:00.000Z", ends_at: "2026-06-01T10:00:00.000Z", status: "requested", assigned_employee_id: SAM }
        ];
        const result = availableSlots({ page: staffedPage(), durationMinutes: 60, bookings, staffShifts: bothOnShift(), now: MONDAY });
        const offered = result.days.find((day) => day.date === "2026-06-01").times.map((time) => time.localTime);
        assert.equal(offered.includes("10:00"), false, "a third appointment was sold to a firm of two");
        assert.ok(offered.length > 0, "and the rest of the day is still offered, or this passes by being empty");
      });

      it("offers only the hours somebody is rostered for", () => {
        // Alex works 09:00-12:00 London on the Monday and nobody else works.
        const shifts = [{ employee_id: ALEX, starts_at: "2026-06-01T08:00:00.000Z", ends_at: "2026-06-01T11:00:00.000Z", status: "scheduled" }];
        const result = availableSlots({ page: staffedPage(), durationMinutes: 60, bookings: [], staffShifts: shifts, now: MONDAY });
        const monday = result.days.find((day) => day.date === "2026-06-01");
        // The grid is 30 minutes, so a one-hour job starts every half hour --
        // and 11:30 is absent because it would end at 12:30, after Alex goes.
        assert.deepEqual(monday.times.map((time) => time.localTime), ["09:00", "09:30", "10:00", "10:30", "11:00"]);
        // And the days nobody works are not offered at all, which the
        // unstaffed page would have offered in full.
        assert.equal(result.days.length, 1, "days with nobody rostered were offered");
      });

      it("says nobody is on the rota rather than saying the week is full", () => {
        const result = availableSlots({ page: staffedPage(), durationMinutes: 60, bookings: [], staffShifts: [], now: MONDAY });
        assert.equal(result.ok, true, "an empty rota is a working page with a gap in its data, not a broken one");
        assert.equal(result.slots, 0);
        assert.match(result.reason, /rota/i);
        assert.equal(result.rosteredPeople, 0);
      });

      it("leaves an unstaffed page exactly as it was", () => {
        // The default, and the property that makes the migration safe: a page
        // that has not asked for staffing must not change behaviour because a
        // rota exists, or because one does not.
        const bookings = [{ starts_at: "2026-06-01T09:00:00.000Z", ends_at: "2026-06-01T10:00:00.000Z", status: "confirmed", assigned_employee_id: ALEX }];
        const withRota = availableSlots({ page: page(), durationMinutes: 60, bookings, staffShifts: bothOnShift(), now: MONDAY });
        const without = availableSlots({ page: page(), durationMinutes: 60, bookings, staffShifts: [], now: MONDAY });
        assert.deepEqual(
          withRota.days.map((day) => day.times.map((time) => time.localTime)),
          without.days.map((day) => day.times.map((time) => time.localTime)),
          "a rota changed an unstaffed page's availability"
        );
        assert.equal(withRota.staffed, false);
        const offered = withRota.days.find((day) => day.date === "2026-06-01").times.map((time) => time.localTime);
        assert.equal(offered.includes("10:00"), false, "an unstaffed page stopped treating the business as one diary");
      });

      it("never puts the rota on the page", () => {
        // freeStaff exists so the submit can name somebody. A visitor who could
        // see which of two plumbers is free on a Tuesday is reading a staff
        // rota, so the route must not render it -- asserted at the route in
        // tests/a-public-booking-page-books-one-business.test.js. Here: that
        // the field carries ids at all, so that assertion is not vacuous.
        const result = availableSlots({ page: staffedPage(), durationMinutes: 60, bookings: [], staffShifts: bothOnShift(), now: MONDAY });
        const first = result.days[0].times[0];
        assert.ok(Array.isArray(first.freeStaff) && first.freeStaff.length > 0);
      });
    });

    describe("checking it again on submit", () => {
      it("names the person the appointment goes to", () => {
        const result = availableSlots({ page: staffedPage(), durationMinutes: 60, bookings: [], staffShifts: bothOnShift(), now: MONDAY });
        const first = result.days[0].times[0];
        const check = isBookable({ page: staffedPage(), durationMinutes: 60, bookings: [], staffShifts: bothOnShift(), startsAt: first.startsAt, now: MONDAY });
        assert.equal(check.ok, true);
        assert.ok([ALEX, SAM].includes(check.assignedEmployeeId), "a staffed booking was accepted with nobody assigned to it");
      });

      it("gives the appointment to the person who is still free", () => {
        const result = availableSlots({ page: staffedPage(), durationMinutes: 60, bookings: [], staffShifts: bothOnShift(), now: MONDAY });
        const first = result.days[0].times[0];
        const takenSince = [{ starts_at: first.startsAt, ends_at: first.endsAt, status: "requested", assigned_employee_id: ALEX }];
        const check = isBookable({ page: staffedPage(), durationMinutes: 60, bookings: takenSince, staffShifts: bothOnShift(), startsAt: first.startsAt, now: MONDAY });
        assert.equal(check.ok, true, "the second person's slot was refused");
        assert.equal(check.assignedEmployeeId, SAM);
      });

      it("refuses once everybody rostered is busy", () => {
        const result = availableSlots({ page: staffedPage(), durationMinutes: 60, bookings: [], staffShifts: bothOnShift(), now: MONDAY });
        const first = result.days[0].times[0];
        const takenSince = [
          { starts_at: first.startsAt, ends_at: first.endsAt, status: "requested", assigned_employee_id: ALEX },
          { starts_at: first.startsAt, ends_at: first.endsAt, status: "confirmed", assigned_employee_id: SAM }
        ];
        const check = isBookable({ page: staffedPage(), durationMinutes: 60, bookings: takenSince, staffShifts: bothOnShift(), startsAt: first.startsAt, now: MONDAY });
        assert.equal(check.ok, false);
      });

      it("assigns nobody on an unstaffed page", () => {
        const result = availableSlots({ page: page(), durationMinutes: 60, bookings: [], now: MONDAY });
        const first = result.days[0].times[0];
        const check = isBookable({ page: page(), durationMinutes: 60, bookings: [], startsAt: first.startsAt, now: MONDAY });
        assert.equal(check.ok, true);
        assert.equal(check.assignedEmployeeId, null, "a sole trader's booking was assigned to somebody");
      });
    });
  });

  it("names seven weekdays, Sunday first, matching the stored column", () => {
    assert.equal(WEEKDAY_NAMES.length, 7);
    assert.equal(WEEKDAY_NAMES[0], "Sunday");
    assert.equal(WEEKDAY_NAMES[6], "Saturday");
  });
});
