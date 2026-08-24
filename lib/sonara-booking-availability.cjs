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
// **A person can only be in one place.** A business with two sites and one
// booking page was offering a slot at the shop to somebody rostered at the
// depot: `employee_schedules.location_id` and
// `business_service_catalog.location_id` have both existed since migration 013
// and availability read neither. A service that names a location is now offered
// only where somebody is rostered *at that location*. A service that names none
// is unchanged, which is every single-site business.
//
// **A business with staff has more than one of each slot.** When the page is set
// to assign staff, a time is offered if somebody is rostered for the whole of it
// and not already booked -- so two plumbers sell two of every hour, and one
// plumber's appointment no longer closes the other's afternoon. When it is not,
// the business is one diary, which is right for a sole trader and is the
// default. This is asked rather than inferred; see the migration for why.
//
// What this deliberately does not do: it does not say *why* a slot is taken.
// The public page renders only what is free. A stranger who could see which
// slots are booked could read a competitor's diary, and "unavailable" and "Mrs
// Patel, 10:30, boiler service" are the same fact at different resolutions. It
// does not name the rostered person on the page either, for the same reason --
// the assignment is recorded on the booking and shown to the business.

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
    // Who it is for, when anybody knows. A booking with no assignee blocks the
    // whole business even in staffed mode -- see everyoneIsBusy below; it is
    // work somebody has to do and nothing records who.
    spans.push({ start, end, employeeId: booking.assigned_employee_id || null });
  }
  return spans.sort((a, b) => a.start - b.start);
}

function overlaps(start, end, spans) {
  for (const span of spans) {
    if (start < span.end && end > span.start) return true;
  }
  return false;
}

// A shift that means somebody is actually at work.
//
// employee_schedules.status is a CHECK constraint on the table
// (scheduled, confirmed, completed, cancelled, missed). Cancelled and missed
// are not somebody at work. A status this does not recognise is NOT counted as
// a shift, which is the opposite of how an unrecognised booking status is
// treated -- and deliberately so. Both choices fail towards offering fewer
// slots, because the cost of offering one that is not really there is two
// people expecting the same hour.
const WORKING_STATUSES = Object.freeze(new Set(["scheduled", "confirmed", "completed"]));

function shiftSpans(shifts) {
  const spans = [];
  for (const shift of Array.isArray(shifts) ? shifts : []) {
    if (!shift) continue;
    if (!WORKING_STATUSES.has(String(shift.status || "").toLowerCase())) continue;
    const employeeId = shift.employee_id || null;
    // A shift belonging to nobody cannot make anybody available.
    if (!employeeId) continue;
    const start = Date.parse(shift.starts_at || "");
    const end = Date.parse(shift.ends_at || "");
    // Both ends are required here, unlike a booking. A booking with no end is
    // still an appointment somebody is at; a shift with no end is not a claim
    // that somebody works for ever, and treating it as one would roster a
    // person across every slot the page can offer.
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    spans.push({ start, end, employeeId, locationId: shift.location_id || null });
  }
  return spans.sort((a, b) => a.start - b.start);
}

// Is this shift somewhere the service can be done?
//
// A service with no location is done anywhere -- which is every single-site
// business, and the reason this changes nothing for them.
//
// A service with a location needs a shift at that location. A shift with **no**
// location does not count towards it, and that is the load-bearing choice: a
// business that has started naming locations on services and not on shifts sees
// less availability rather than somebody sent to the wrong site. It fails the
// same way every other decision in this file does, and the caller is told how
// many shifts were skipped for it so the drop is explicable rather than
// mysterious.
function shiftServesLocation(shift, serviceLocationId) {
  if (!serviceLocationId) return true;
  return shift.locationId === serviceLocationId;
}

// Does this span sit wholly inside one shift?
//
// Wholly, not partly. Somebody who leaves at five cannot take a ninety-minute
// job starting at half past four, and a page that offers it has sold an
// appointment that ends after the person doing it has gone home. Two adjacent
// shifts are not merged into one: they may be two different days.
function coveredBy(start, end, spans) {
  for (const span of spans) {
    if (span.start <= start && span.end >= end) return true;
  }
  return false;
}

// A booking nobody is named on stops everybody, because nothing records who is
// doing it. This is the state a business is in the moment it switches staffing
// on, when every existing appointment predates the idea of an assignee, and
// treating those as blocking nobody would double-book every one of them.
function everyoneIsBusy(start, end, spans) {
  for (const span of spans) {
    if (span.employeeId) continue;
    if (start < span.end && end > span.start) return true;
  }
  return false;
}

/**
 * Who could take this appointment.
 *
 * Returns the ids of everyone rostered for the whole span and not already
 * booked across any part of it. An empty list means the time is not on offer,
 * and the caller must not read it as "anybody".
 */
function freeStaffFor(start, end, { shifts, bookings, serviceLocationId = null }) {
  if (everyoneIsBusy(start, end, bookings)) return [];
  const free = [];
  for (const shift of shifts) {
    if (shift.start > start || shift.end < end) continue;
    if (!shiftServesLocation(shift, serviceLocationId)) continue;
    if (free.includes(shift.employeeId)) continue;
    // Deliberately not filtered by location. A person booked at the depot at
    // ten o'clock is not available at the shop at ten o'clock -- they cannot be
    // in two places, and checking only same-site bookings would sell both.
    const busy = bookings.some((span) =>
      span.employeeId === shift.employeeId && start < span.end && end > span.start);
    if (!busy) free.push(shift.employeeId);
  }
  return free;
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
  staffShifts = [],
  serviceLocationId = null,
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

  const staffed = page.assign_staff === true;
  const allShifts = staffed ? shiftSpans(staffShifts) : [];
  // Only the shifts that can do this service, where it names a place.
  const shifts = serviceLocationId
    ? allShifts.filter((shift) => shiftServesLocation(shift, serviceLocationId))
    : allShifts;
  // Rostered, but not somewhere this service happens. Counted so a business
  // that has just started naming locations can see why availability dropped,
  // rather than concluding the page is broken.
  const shiftsElsewhere = allShifts.length - shifts.length;
  if (staffed && !shifts.length) {
    // Not "no times available". A page set to assign staff with nobody rostered
    // in the window is a rota that has not been entered, and saying so is the
    // difference between a business fixing it today and a business believing it
    // is fully booked. This is also why staffing is a column rather than
    // something inferred from whether shifts exist.
    return {
      ok: true,
      // Two different gaps, and a business can only fix the one it is actually
      // in. "Nobody is rostered at all" and "nobody is rostered here" send
      // somebody to different screens.
      reason: shiftsElsewhere > 0
        ? "Nobody on the rota for this period is working where this service happens."
        : "Nobody is on the rota for this period yet, so there is no one to book with.",
      days: [], slots: 0, staffed: true, rosteredPeople: 0, shiftsElsewhere,
      timeZone, slotMinutes, leadHours, horizonDays, truncated: false
    };
  }
  const rosteredPeople = new Set(shifts.map((shift) => shift.employeeId)).size;

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

        // Two different questions, and only one of them applies.
        //
        // Unstaffed, the business is one diary and any appointment closes the
        // time. Staffed, the time is on offer while somebody rostered for the
        // whole of it is free -- so the plain overlap test would be wrong in
        // both directions at once, closing an hour a second person could work
        // and opening one nobody is rostered for.
        let free = null;
        if (staffed) {
          free = freeStaffFor(start, end, { shifts, bookings: spans, serviceLocationId });
          if (!free.length) continue;
        } else if (overlaps(start, end, spans)) {
          continue;
        }

        if (slots >= MAX_SLOTS) { truncated = true; break; }
        times.push({
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          localTime: clockFromMinutes(minute),
          // Never rendered. The page shows a time, and the booking records who
          // it went to -- a visitor who could see which of two plumbers is free
          // on a Tuesday is reading a staff rota.
          freeStaff: free
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
      staffed, rosteredPeople, shiftsElsewhere,
      timeZone, slotMinutes, leadHours, horizonDays, truncated: false
    };
  }

  return { ok: true, reason: null, days, slots, staffed, rosteredPeople, shiftsElsewhere, timeZone, slotMinutes, leadHours, horizonDays, truncated };
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
function isBookable({ page = {}, durationMinutes, bookings = [], staffShifts = [], serviceLocationId = null, startsAt, now = Date.now() } = {}) {
  const start = Date.parse(startsAt || "");
  if (!Number.isFinite(start)) return { ok: false, reason: "That is not a time." };

  const result = availableSlots({ page, durationMinutes, bookings, staffShifts, serviceLocationId, now });
  if (!result.ok) return { ok: false, reason: result.reason };

  const wanted = new Date(start).toISOString();
  for (const day of result.days) {
    for (const time of day.times) {
      if (time.startsAt !== wanted) continue;
      // The first free person, which is stable because shiftSpans sorts by
      // start and freeStaffFor keeps that order. Picking at random would give
      // two visitors submitting at once a real chance of the same person, and
      // the recheck that follows would then have to run twice.
      const assignedEmployeeId = result.staffed ? (time.freeStaff[0] || null) : null;
      // Staffed and nobody free is not a bookable time. freeStaffFor already
      // drops those, so this is the assertion that it did rather than a second
      // implementation of the rule.
      if (result.staffed && !assignedEmployeeId) break;
      return { ok: true, reason: null, startsAt: time.startsAt, endsAt: time.endsAt, assignedEmployeeId };
    }
  }
  return { ok: false, reason: "That time has just been taken, or is no longer offered. Please choose another." };
}

module.exports = {
  WEEKDAY_NAMES,
  FREEING_STATUSES,
  WORKING_STATUSES,
  shiftSpans,
  shiftServesLocation,
  coveredBy,
  everyoneIsBusy,
  freeStaffFor,
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
