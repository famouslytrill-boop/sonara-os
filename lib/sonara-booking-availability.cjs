"use strict";

// Which appointment times a stranger may actually pick.
//
// Pure, and separate from anything that reads a database or writes a booking,
// because this is the part where being subtly wrong is invisible. A slot list
// that is too generous double-books a business in front of its own customer. A
// slot list that is too mean silently loses work, and nobody ever reports the
// appointment they could not make.
//
// The rules, in the order they are applied.
//
// **Opening hours are wall-clock times in the business's own zone.** "09:00" is
// a different instant in Auckland and in Lisbon, and a business in a zone with
// daylight saving is open at 09:00 local on both sides of the change. Intl does
// the zone arithmetic here, the same way lib/sonara-agent-schedule.cjs does it,
// so this file carries no table of offsets to go stale.
//
// **A slot must fit the service, not just start inside opening hours.** A
// ninety-minute service starting half an hour before closing is not bookable.
// The check is on the whole span, which is why duration is required.
//
// **An existing booking blocks every slot it overlaps.** Overlap is
// `start < otherEnd && end > otherStart` -- strict on both sides, so a booking
// ending at 10:00 does not block one starting at 10:00. Cancelled and no-show
// bookings do not block anything, because the business is free at that time.
//
// **Nothing before the lead time, nothing past the horizon.**
//
// What this deliberately does not do: it does not say *why* a slot is taken.
// The public page renders only what is free. A stranger who could see which
// slots are booked could read a competitor's diary, and "unavailable" and "Mrs
// Patel, 10:30, boiler service" are the same fact at different resolutions.

const DAY_MS = 86400000;
const MINUTE_MS = 60000;

// Sunday first, matching JavaScript's getDay and the opening_hours column.
const WEEKDAY_INDEX = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });

const WEEKDAY_NAMES = Object.freeze([
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
]);

// Guardrails matching the CHECK constraints in
// supabase/migrations/20260820060000_public_booking_pages.sql. Duplicated here
// on purpose: a row written before those constraints existed, or by something
// other than this application, still has to produce a sane page rather than a
// year of slots computed on every request by a stranger.
const MIN_SLOT_MINUTES = 5;
const MAX_SLOT_MINUTES = 240;
const MAX_HORIZON_DAYS = 90;
const MAX_SLOTS = 2000;

function knownZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: String(timeZone || "UTC") });
    return String(timeZone || "UTC");
  } catch {
    // An unusable zone is not a reason to fall back to the server's clock and
    // offer somebody an appointment at the wrong time of day. It is a reason to
    // say the page cannot be built.
    return null;
  }
}

// The wall-clock fields of an instant, in a named zone.
function localParts(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, weekday: "short"
  }).formatToParts(instant);
  const read = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")) % 24,
    minute: Number(read("minute")),
    second: Number(read("second")),
    weekday: WEEKDAY_INDEX[read("weekday")] ?? null
  };
}

// The instant at which a given wall-clock time occurs in a given zone.
//
// There is no standard API for this, so it is solved by iteration: guess that
// the wall time is UTC, read back what that instant actually looks like in the
// zone, and correct by the difference. Two rounds converge everywhere, because
// the correction after the first is at most the change in offset across one
// offset shift, and no zone shifts twice within a few hours.
//
// The daylight-saving edges are the reason this returns null rather than a
// number sometimes. On the spring-forward morning, 02:30 does not exist; the
// correction lands on a different wall time than the one asked for, and an
// appointment offered at a time that does not exist is worse than one not
// offered. It is checked rather than assumed: the result is read back and
// compared.
function instantFor({ year, month, day, hour, minute }, timeZone) {
  const wantedAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = wantedAsUtc;
  for (let round = 0; round < 2; round += 1) {
    const seen = localParts(new Date(guess), timeZone);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second, 0);
    // How far the wall time this instant actually shows is from the wall time
    // asked for. Comparing against `guess` instead would compare against the
    // zone's offset, which never reaches zero and walks the answer away by an
    // hour on every round.
    const drift = seenAsUtc - wantedAsUtc;
    if (drift === 0) break;
    guess -= drift;
  }
  const check = localParts(new Date(guess), timeZone);
  if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour || check.minute !== minute) {
    // The wall time does not exist in this zone on this date, or it exists
    // twice and the round trip landed on the other one.
    return null;
  }
  return guess;
}

// "09:00" -> 540. Anything else -> null, and null is never 0: a malformed
// opening time must close the day, not open it at midnight.
function minutesFromClock(value) {
  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function clockFromMinutes(total) {
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// One day's opening ranges, normalised. A day may carry a single range or a
// list of them; both shapes are read, and anything unrecognised closes the day.
//
// Closed is the safe direction for every malformed value here. Opening a
// business at a time it did not ask for puts a stranger on its doorstep.
function rangesForDay(entry) {
  const list = Array.isArray(entry) ? entry : [entry];
  const ranges = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const open = minutesFromClock(item.open);
    const close = minutesFromClock(item.close);
    if (open === null || close === null) continue;
    // A range that ends before it starts, or at the moment it starts, is not a
    // range. Overnight opening is not supported and is not silently reinterpreted.
    if (close <= open) continue;
    ranges.push({ open, close });
  }
  return ranges.sort((a, b) => a.open - b.open);
}

// The seven-entry opening_hours value, normalised to seven days of ranges.
// A value that is not seven entries long is not stretched or padded -- the days
// it does not describe are closed.
function normaliseOpeningHours(value) {
  const source = Array.isArray(value) ? value : [];
  return WEEKDAY_NAMES.map((_, index) => rangesForDay(source[index]));
}

function isOpenAnyDay(openingHours) {
  return normaliseOpeningHours(openingHours).some((ranges) => ranges.length > 0);
}

// A booking that stops a slot being offered.
//
// The status vocabulary is the CHECK constraint on business_bookings
// (requested, confirmed, completed, cancelled, no_show, archived). Cancelled,
// no-show and archived free the time; the rest hold it. A status this does not
// recognise holds the time, because an unrecognised status is not known to be
// free -- and offering a slot that is actually taken is the failure that
// reaches two people at once.
const FREEING_STATUSES = Object.freeze(new Set(["cancelled", "no_show", "archived"]));

function blockingSpans(bookings, { defaultMinutes = 30 } = {}) {
  const spans = [];
  for (const booking of Array.isArray(bookings) ? bookings : []) {
    if (!booking) continue;
    if (FREEING_STATUSES.has(String(booking.status || "").toLowerCase())) continue;
    const start = Date.parse(booking.starts_at || "");
    if (!Number.isFinite(start)) continue;
    const parsedEnd = Date.parse(booking.ends_at || "");
    // A booking with no end is not a booking of zero length. Zero would block
    // nothing and the time would be offered to somebody else.
    const end = Number.isFinite(parsedEnd) && parsedEnd > start ? parsedEnd : start + defaultMinutes * MINUTE_MS;
    spans.push({ start, end });
  }
  return spans.sort((a, b) => a.start - b.start);
}

function overlaps(start, end, spans) {
  for (const span of spans) {
    if (start < span.end && end > span.start) return true;
  }
  return false;
}

function clampInt(value, low, high, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(high, Math.max(low, parsed));
}

/**
 * The times somebody may book, grouped by day.
 *
 * Returns `{ ok, reason, days, slots, timeZone, ... }`. `ok: false` always
 * carries a reason a person can read, because "no times available" and "this
 * page is misconfigured" look identical to a visitor and are different problems
 * for the business.
 *
 * `bookings` are the organisation's existing appointments over the window; an
 * empty list and an unread list are different, and the caller is responsible
 * for not passing an unread one -- see the note in the route.
 */
function availableSlots({
  page = {},
  durationMinutes,
  bookings = [],
  now = Date.now()
} = {}) {
  const timeZone = knownZone(page.time_zone);
  if (!timeZone) {
    return { ok: false, reason: "This booking page does not have a working time zone set, so the times it would show could be wrong.", days: [], slots: 0 };
  }

  const duration = Number.parseInt(String(durationMinutes ?? ""), 10);
  if (!Number.isInteger(duration) || duration <= 0) {
    return { ok: false, reason: "This service does not say how long it takes, so no appointment length can be offered for it.", days: [], slots: 0, timeZone };
  }
  if (duration > MAX_SLOT_MINUTES * 8) {
    return { ok: false, reason: "This service is recorded as longer than a working day, so it cannot be booked from a page like this.", days: [], slots: 0, timeZone };
  }

  const openingHours = normaliseOpeningHours(page.opening_hours);
  if (!openingHours.some((ranges) => ranges.length > 0)) {
    return { ok: false, reason: "This business has not set any opening hours yet.", days: [], slots: 0, timeZone };
  }

  const slotMinutes = clampInt(page.slot_minutes, MIN_SLOT_MINUTES, MAX_SLOT_MINUTES, 30);
  const leadHours = clampInt(page.lead_time_hours, 0, 720, 12);
  const horizonDays = clampInt(page.horizon_days, 1, MAX_HORIZON_DAYS, 21);

  const earliest = now + leadHours * 60 * MINUTE_MS;
  const latest = now + horizonDays * DAY_MS;
  const spans = blockingSpans(bookings, { defaultMinutes: slotMinutes });

  const days = [];
  let slots = 0;
  let truncated = false;

  // Walk calendar days in the business's own zone. Stepping by 24 hours from a
  // fixed instant and reading the local date each time is correct across
  // daylight saving in a way that adding 24 hours to a local date is not: the
  // local date is re-read every iteration rather than assumed.
  //
  // One extra day is walked, because the horizon is an instant and the last
  // local day it falls inside is only partly covered by it.
  for (let offset = 0; offset <= horizonDays + 1; offset += 1) {
    const cursor = new Date(now + offset * DAY_MS);
    const local = localParts(cursor, timeZone);
    if (local.weekday === null) continue;
    const ranges = openingHours[local.weekday];
    if (!ranges.length) continue;

    const times = [];
    for (const range of ranges) {
      for (let minute = range.open; minute + duration <= range.close; minute += slotMinutes) {
        const start = instantFor({ year: local.year, month: local.month, day: local.day, hour: Math.floor(minute / 60), minute: minute % 60 }, timeZone);
        // A wall time that does not exist on this date -- the spring-forward
        // hour -- is skipped rather than offered.
        if (start === null) continue;
        const end = start + duration * MINUTE_MS;
        if (start < earliest) continue;
        if (start > latest) continue;
        if (overlaps(start, end, spans)) continue;
        if (slots >= MAX_SLOTS) { truncated = true; break; }
        times.push({
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          localTime: clockFromMinutes(minute)
        });
        slots += 1;
      }
      if (truncated) break;
    }
    if (times.length) {
      days.push({
        date: `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`,
        weekday: WEEKDAY_NAMES[local.weekday],
        times
      });
    }
    if (truncated) break;
  }

  if (!days.length) {
    return {
      ok: true,
      // True and specific. "No availability" on a page whose owner opens on
      // Tuesdays reads as a broken page; saying the window is full says which
      // thing happened.
      reason: `Nothing is free in the next ${horizonDays} day${horizonDays === 1 ? "" : "s"}.`,
      days: [],
      slots: 0,
      timeZone, slotMinutes, leadHours, horizonDays, truncated: false
    };
  }

  return { ok: true, reason: null, days, slots, timeZone, slotMinutes, leadHours, horizonDays, truncated };
}

/**
 * Is this exact time still bookable?
 *
 * Called again when the form is submitted, against a fresh read. The list a
 * visitor is looking at was computed when the page loaded and somebody else may
 * have taken the slot since -- checking only at render time is the double-book.
 *
 * Deliberately re-derives everything rather than trusting the submitted time:
 * the start must be one this page would have offered, not merely one that
 * happens to be free. Otherwise a hand-made request books 03:00 on a Sunday.
 */
function isBookable({ page = {}, durationMinutes, bookings = [], startsAt, now = Date.now() } = {}) {
  const start = Date.parse(startsAt || "");
  if (!Number.isFinite(start)) return { ok: false, reason: "That is not a time." };

  const result = availableSlots({ page, durationMinutes, bookings, now });
  if (!result.ok) return { ok: false, reason: result.reason };

  const wanted = new Date(start).toISOString();
  for (const day of result.days) {
    for (const time of day.times) {
      if (time.startsAt === wanted) return { ok: true, reason: null, startsAt: time.startsAt, endsAt: time.endsAt };
    }
  }
  return { ok: false, reason: "That time has just been taken, or is no longer offered. Please choose another." };
}

module.exports = {
  WEEKDAY_NAMES,
  FREEING_STATUSES,
  MAX_SLOTS,
  knownZone,
  localParts,
  instantFor,
  minutesFromClock,
  clockFromMinutes,
  rangesForDay,
  normaliseOpeningHours,
  isOpenAnyDay,
  blockingSpans,
  overlaps,
  availableSlots,
  isBookable
};
