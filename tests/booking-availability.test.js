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

  it("names seven weekdays, Sunday first, matching the stored column", () => {
    assert.equal(WEEKDAY_NAMES.length, 7);
    assert.equal(WEEKDAY_NAMES[0], "Sunday");
    assert.equal(WEEKDAY_NAMES[6], "Saturday");
  });
});
