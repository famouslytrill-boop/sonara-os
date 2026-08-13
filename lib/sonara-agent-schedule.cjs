"use strict";

// Whether a customer's schedule is due, worked out in their own time zone.
//
// Pure, and separate from anything that runs work, because "is this due?" is
// the part that is easy to get subtly wrong and impossible to notice: a
// schedule that fires twice looks like an eager product, and one that never
// fires looks like nothing at all.
//
// Three rules the arithmetic follows.
//
// **The customer's local hour, not the server's.** "Every Monday at 9" is a
// different instant in Auckland and in Lisbon. The zone is stored beside the
// hour and applied here, so a business is never woken at what the platform
// thinks is morning.
//
// **Never twice in one period.** `last_run_at` is compared against the period
// the current moment falls in, so a tick every fifteen minutes still produces
// one run a day. This is the property that keeps a scheduler from becoming a
// loop.
//
// **A missed period is not made up.** If nothing ticked for three days, the
// daily schedule runs once, now -- not three times. Catching up is what turns a
// quiet outage into a burst of work nobody asked for at the moment service
// returns.

const CADENCES = Object.freeze(["daily", "weekly", "monthly"]);

// The wall-clock fields of an instant, in a named zone. Intl does the zone
// arithmetic, so this carries no table of offsets to go stale.
function localParts(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
    weekday: "short"
  }).formatToParts(instant);
  const read = (type) => parts.find((part) => part.type === type)?.value || "";
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")) % 24,
    weekday: weekdays[read("weekday")] ?? null
  };
}

function knownZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: String(timeZone || "UTC") });
    return String(timeZone || "UTC");
  } catch {
    // An unusable zone is not a reason to run at the server's idea of the hour.
    // It is a reason to say the schedule cannot be evaluated.
    return null;
  }
}

// A stable name for the period an instant falls in, in the customer's zone.
// Two instants in the same period share a key, which is the whole mechanism
// behind "never twice".
function periodKey(cadence, parts) {
  if (cadence === "daily") return `${parts.year}-${parts.month}-${parts.day}`;
  if (cadence === "monthly") return `${parts.year}-${parts.month}`;
  // Weekly is keyed on the date of the run rather than an ISO week number,
  // because the schedule names one weekday and can only match one day in seven.
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Is this schedule due at `now`?
 *
 * Returns a reason either way. A scheduler that answers only true or false
 * gives an owner nothing to read when their weekly review did not arrive.
 */
function isDue(schedule, now = new Date()) {
  if (!schedule || schedule.enabled === false) return { due: false, reason: "This schedule is switched off." };
  const cadence = String(schedule.cadence || "");
  if (!CADENCES.includes(cadence)) return { due: false, reason: `"${cadence}" is not a cadence this understands.` };

  const zone = knownZone(schedule.time_zone);
  if (!zone) return { due: false, reason: `The time zone on this schedule (${schedule.time_zone}) is not one this server recognises, so when it should run cannot be worked out.` };

  const parts = localParts(now, zone);
  const hour = Number(schedule.hour_of_day);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { due: false, reason: "The hour on this schedule is not a real hour." };

  // Before the hour it asked for.
  if (parts.hour < hour) return { due: false, reason: `Not yet: it runs at ${String(hour).padStart(2, "0")}:00 and it is ${String(parts.hour).padStart(2, "0")}:00 there.` };

  if (cadence === "weekly") {
    const wanted = Number(schedule.day_of_week);
    if (!Number.isInteger(wanted) || wanted < 0 || wanted > 6) return { due: false, reason: "This weekly schedule does not name a day." };
    if (parts.weekday !== wanted) return { due: false, reason: "Not its day of the week." };
  }

  if (cadence === "monthly") {
    const wanted = Number(schedule.day_of_month);
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > 28) return { due: false, reason: "This monthly schedule does not name a day of the month." };
    if (parts.day !== wanted) return { due: false, reason: "Not its day of the month." };
  }

  // Already run in this period. A tick every fifteen minutes must still produce
  // one run.
  const last = schedule.last_run_at ? new Date(schedule.last_run_at) : null;
  if (last && !Number.isNaN(last.getTime())) {
    if (periodKey(cadence, localParts(last, zone)) === periodKey(cadence, parts)) {
      return { due: false, reason: "It has already run in this period." };
    }
  }

  return { due: true, reason: "Due now." };
}

// What the customer reads on their own schedule page.
function describe(schedule) {
  const hour = `${String(Number(schedule?.hour_of_day) || 0).padStart(2, "0")}:00`;
  const zone = schedule?.time_zone || "UTC";
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (schedule?.cadence === "daily") return `Every day at ${hour} ${zone}`;
  if (schedule?.cadence === "weekly") return `Every ${days[Number(schedule.day_of_week)] || "week"} at ${hour} ${zone}`;
  if (schedule?.cadence === "monthly") return `On day ${Number(schedule.day_of_month) || 1} of each month at ${hour} ${zone}`;
  return `At ${hour} ${zone}`;
}

module.exports = { CADENCES, isDue, describe, periodKey, localParts, knownZone };
