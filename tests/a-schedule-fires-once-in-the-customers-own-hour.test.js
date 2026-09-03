"use strict";

// `lib/sonara-agent-schedule.cjs` decides whether a customer's scheduled work
// runs. It is reached from an hourly production cron -- `vercel.json` declares
// `/api/agents/schedule/tick` on `0 * * * *` -- and from
// `sonara-recurring-invoices` and `sonara-booking-availability`.
//
// Measured with Node's built-in V8 coverage over the whole suite, it was the
// lowest-covered runtime file in the repository: **3 of 59 lines, 5.1%**. The
// three were the `require` and the two top-level constants. No test file named
// it. Every function below ran in production and none of them ran here.
//
// Its own header states three properties. Each is a way of being subtly wrong
// that nobody would notice from the outside -- "a schedule that fires twice
// looks like an eager product, and one that never fires looks like nothing at
// all" -- so each gets a test named after it rather than a test named after the
// function it happens to live in.

const assert = require("node:assert/strict");
const schedule = require("../lib/sonara-agent-schedule.cjs");
const { isDue, describe: describeSchedule, periodKey, localParts, knownZone, CADENCES } = schedule;

// 09:00 UTC on Monday 2 March 2026. Chosen because it is a Monday, so the
// weekly cases have a real weekday to agree or disagree with.
const MONDAY_0900_UTC = new Date("2026-03-02T09:00:00Z");

const daily = (over = {}) => ({ cadence: "daily", hour_of_day: 9, time_zone: "UTC", enabled: true, ...over });

describe("a schedule fires once, in the customer's own hour", () => {
  it("has the module it is testing", () => {
    assert.equal(typeof isDue, "function", "isDue is gone; nothing below was checked");
    assert.deepEqual([...CADENCES], ["daily", "weekly", "monthly"]);
  });

  describe("the customer's local hour, not the server's", () => {
    it("is not due in Lisbon when it is not yet nine there", () => {
      // 09:00 UTC is 09:00 in Lisbon in March (WET, UTC+0) -- due -- but the
      // same instant is 04:00 in New York.
      const answer = isDue(daily({ time_zone: "America/New_York" }), MONDAY_0900_UTC);
      assert.equal(answer.due, false);
      assert.match(answer.reason, /Not yet/, "a schedule before its hour must say so");
      assert.match(answer.reason, /04:00 there/, "the reason must quote the customer's hour, not the server's");
    });

    it("is due in Auckland at the same instant, because there it is already past nine", () => {
      // 09:00 UTC on 2 March is 22:00 the same day in Auckland (NZDT, UTC+13).
      const answer = isDue(daily({ time_zone: "Pacific/Auckland" }), MONDAY_0900_UTC);
      assert.equal(answer.due, true, "22:00 in Auckland is past a 09:00 schedule");
    });

    it("reads midnight as hour 0 rather than hour 24", () => {
      // en-GB with hour12:false reports midnight as "24" in some ICU builds,
      // which is why the module takes it modulo 24. A schedule set for 00:00
      // would otherwise never be due, because 24 < 0 is false but the period
      // key would carry the wrong day.
      const midnight = new Date("2026-03-02T00:00:00Z");
      assert.equal(localParts(midnight, "UTC").hour, 0);
      assert.equal(isDue(daily({ hour_of_day: 0 }), midnight).due, true);
    });
  });

  describe("never twice in one period", () => {
    it("does not run again in the same day after it has run", () => {
      const answer = isDue(daily({ last_run_at: "2026-03-02T09:00:00Z" }), new Date("2026-03-02T15:00:00Z"));
      assert.equal(answer.due, false);
      assert.match(answer.reason, /already run in this period/);
    });

    it("survives a tick every fifteen minutes and still produces one run a day", () => {
      // The property the header claims, run rather than reasoned about: step
      // through a whole day at 15-minute intervals, marking last_run_at exactly
      // as the caller would, and count the runs.
      let row = daily({ last_run_at: null });
      let runs = 0;
      for (let minute = 0; minute < 24 * 60; minute += 15) {
        const now = new Date(Date.UTC(2026, 2, 2, 0, minute));
        const answer = isDue(row, now);
        if (answer.due) {
          runs += 1;
          row = { ...row, last_run_at: now.toISOString() };
        }
      }
      assert.equal(runs, 1, `96 ticks in a day produced ${runs} runs; a scheduler that fires twice is the failure this guards`);
    });

    it("runs again the next day", () => {
      const answer = isDue(daily({ last_run_at: "2026-03-02T09:00:00Z" }), new Date("2026-03-03T09:00:00Z"));
      assert.equal(answer.due, true);
    });

    it("keys the period in the customer's zone, not the server's", () => {
      // 2026-03-02T23:30Z and 2026-03-03T00:30Z are the same local day in
      // New York (18:30 and 19:30 on the 2nd) and different UTC days. A run at
      // the first must suppress the second.
      const row = daily({ time_zone: "America/New_York", hour_of_day: 18, last_run_at: "2026-03-02T23:30:00Z" });
      const answer = isDue(row, new Date("2026-03-03T00:30:00Z"));
      assert.equal(answer.due, false, "these two instants are the same day where the customer is");
      assert.match(answer.reason, /already run in this period/);
    });
  });

  describe("a missed period is not made up", () => {
    it("runs once after a three-day gap, not three times", () => {
      let row = daily({ last_run_at: "2026-03-02T09:00:00Z" });
      let runs = 0;
      // Nothing ticks for three days, then the cron returns and ticks hourly.
      for (let hour = 0; hour < 6; hour += 1) {
        const now = new Date(Date.UTC(2026, 2, 5, 9 + hour));
        const answer = isDue(row, now);
        if (answer.due) {
          runs += 1;
          row = { ...row, last_run_at: now.toISOString() };
        }
      }
      assert.equal(runs, 1, `a three-day outage produced ${runs} runs on return; catching up is what turns an outage into a burst`);
    });
  });

  describe("refusing rather than guessing", () => {
    it("says a switched-off schedule is off", () => {
      const answer = isDue(daily({ enabled: false }), MONDAY_0900_UTC);
      assert.equal(answer.due, false);
      assert.match(answer.reason, /switched off/);
    });

    it("does not run at the server's hour when the zone is unusable", () => {
      // The comment in knownZone says this explicitly, and it is the one that
      // would be tempting to make lenient: falling back to the server's zone
      // means waking a business at the platform's idea of morning.
      const answer = isDue(daily({ time_zone: "Mars/Olympus_Mons" }), MONDAY_0900_UTC);
      assert.equal(answer.due, false);
      assert.match(answer.reason, /not one this server recognises/);
      assert.equal(knownZone("Mars/Olympus_Mons"), null);
    });

    it("treats a missing zone as UTC rather than as unusable", () => {
      assert.equal(knownZone(undefined), "UTC");
      assert.equal(knownZone(""), "UTC");
    });

    it("refuses an hour that is not a real hour", () => {
      for (const hour of [-1, 24, 9.5, "nine", undefined]) {
        const answer = isDue(daily({ hour_of_day: hour }), MONDAY_0900_UTC);
        assert.equal(answer.due, false, `hour ${JSON.stringify(hour)} was accepted`);
        assert.match(answer.reason, /not a real hour/);
      }
    });

    it("does not read an unanswered hour as midnight", () => {
      // Found by writing this file. `Number(null)` is 0, and so are `Number("")`
      // and `Number([])`, so the original `Number.isInteger(Number(...))` check
      // accepted all three as hour 0 -- and an hour of 0 is due at *every*
      // hour, because `parts.hour < 0` is never true. A schedule with no hour
      // recorded fired on the next tick whatever the time. `undefined` was
      // refused, so the three states were already collapsed into two
      // inconsistently.
      //
      // Not a live incident: `agent_schedules.hour_of_day` is `not null default
      // 9`, and the one insert path clamps it. This is the function refusing
      // rather than guessing, for the callers that do not come through there.
      for (const hour of [null, "", [], true, false]) {
        const answer = isDue(daily({ hour_of_day: hour }), new Date("2026-03-02T17:00:00Z"));
        assert.equal(answer.due, false, `hour ${JSON.stringify(hour)} was read as a real hour`);
        assert.match(answer.reason, /not a real hour/);
      }
    });

    it("still runs a schedule genuinely set for midnight", () => {
      // The other side of the same fix: refusing 0-by-coercion must not refuse
      // 0-by-intention.
      assert.equal(isDue(daily({ hour_of_day: 0 }), new Date("2026-03-02T17:00:00Z")).due, true);
    });

    it("refuses a cadence it does not implement", () => {
      const answer = isDue({ cadence: "hourly", hour_of_day: 9, time_zone: "UTC" }, MONDAY_0900_UTC);
      assert.equal(answer.due, false);
      assert.match(answer.reason, /is not a cadence this understands/);
    });

    it("refuses nothing at all", () => {
      assert.equal(isDue(null, MONDAY_0900_UTC).due, false);
      assert.equal(isDue(undefined, MONDAY_0900_UTC).due, false);
    });

    it("gives a reason in both directions", () => {
      // The docstring says a scheduler answering only true or false "gives an
      // owner nothing to read when their weekly review did not arrive".
      const yes = isDue(daily(), MONDAY_0900_UTC);
      const no = isDue(daily({ enabled: false }), MONDAY_0900_UTC);
      assert.equal(yes.due, true);
      assert.ok(yes.reason && yes.reason.length > 0, "a due schedule must still carry a reason");
      assert.ok(no.reason && no.reason.length > 0);
    });
  });

  describe("weekly and monthly name a day, and it is checked", () => {
    const weekly = (over = {}) => ({ cadence: "weekly", hour_of_day: 9, time_zone: "UTC", day_of_week: 1, ...over });
    const monthly = (over = {}) => ({ cadence: "monthly", hour_of_day: 9, time_zone: "UTC", day_of_month: 2, ...over });

    it("runs a weekly schedule on its own weekday", () => {
      assert.equal(isDue(weekly(), MONDAY_0900_UTC).due, true);
    });

    it("does not run a weekly schedule on another weekday", () => {
      const answer = isDue(weekly({ day_of_week: 3 }), MONDAY_0900_UTC);
      assert.equal(answer.due, false);
      assert.match(answer.reason, /Not its day of the week/);
    });

    it("refuses a weekly schedule that names no day", () => {
      // `null` and `""` are in this list for the same reason as the hour above:
      // `Number(null)` is 0, which is Sunday. `day_of_week` is nullable in the
      // schema -- `day_of_week is null or day_of_week between 0 and 6` -- so
      // the database permits a weekly row this once read as "every Sunday".
      for (const day of [undefined, null, "", [], -1, 7, "Monday"]) {
        const answer = isDue(weekly({ day_of_week: day }), MONDAY_0900_UTC);
        assert.equal(answer.due, false, `day_of_week ${day} was accepted`);
        assert.match(answer.reason, /does not name a day/);
      }
    });

    it("runs a monthly schedule on its own date", () => {
      assert.equal(isDue(monthly(), MONDAY_0900_UTC).due, true);
    });

    it("does not run a monthly schedule on another date", () => {
      const answer = isDue(monthly({ day_of_month: 17 }), MONDAY_0900_UTC);
      assert.equal(answer.due, false);
      assert.match(answer.reason, /Not its day of the month/);
    });

    it("refuses a day of the month past 28, so no month can skip it", () => {
      // 29, 30 and 31 do not exist in every month. A schedule set for the 31st
      // would silently never run in February, which is the "looks like nothing
      // at all" failure.
      for (const day of [0, 29, 31]) {
        const answer = isDue(monthly({ day_of_month: day }), MONDAY_0900_UTC);
        assert.equal(answer.due, false, `day_of_month ${day} was accepted`);
        assert.match(answer.reason, /does not name a day of the month/);
      }
    });

    it("keys a monthly period so it cannot run twice in a month or skip a year", () => {
      const march = localParts(new Date("2026-03-02T09:00:00Z"), "UTC");
      const marchLater = localParts(new Date("2026-03-20T09:00:00Z"), "UTC");
      const april = localParts(new Date("2026-04-02T09:00:00Z"), "UTC");
      const nextYear = localParts(new Date("2027-03-02T09:00:00Z"), "UTC");
      assert.equal(periodKey("monthly", march), periodKey("monthly", marchLater), "two days in one month must share a key");
      assert.notEqual(periodKey("monthly", march), periodKey("monthly", april));
      assert.notEqual(periodKey("monthly", march), periodKey("monthly", nextYear), "the same month a year later must not read as already run");
    });

    it("does not let two different dates collide into one period key", () => {
      // The key is built by joining numbers with "-", and the numbers are not
      // zero-padded. 1 November and 11 January must not produce the same string.
      const janEleventh = localParts(new Date("2026-01-11T09:00:00Z"), "UTC");
      const novFirst = localParts(new Date("2026-11-01T09:00:00Z"), "UTC");
      assert.notEqual(periodKey("daily", janEleventh), periodKey("daily", novFirst));
    });
  });

  describe("what the customer reads on their own schedule page", () => {
    it("names the day and the zone rather than an hour on its own", () => {
      assert.equal(describeSchedule({ cadence: "daily", hour_of_day: 9, time_zone: "Europe/Lisbon" }), "Every day at 09:00 Europe/Lisbon");
      assert.equal(describeSchedule({ cadence: "weekly", hour_of_day: 14, day_of_week: 1, time_zone: "UTC" }), "Every Monday at 14:00 UTC");
      assert.equal(describeSchedule({ cadence: "monthly", hour_of_day: 7, day_of_month: 3, time_zone: "UTC" }), "On day 3 of each month at 07:00 UTC");
    });

    it("writes midnight as 00:00 rather than falling back to something else", () => {
      assert.match(describeSchedule({ cadence: "daily", hour_of_day: 0, time_zone: "UTC" }), /^Every day at 00:00 /);
    });

    it("says something for a schedule it cannot describe, rather than throwing", () => {
      assert.equal(typeof describeSchedule({}), "string");
      assert.equal(typeof describeSchedule(null), "string");
    });
  });
});
