"use strict";

// A week of shifts, laid out in the business's own time zone, with the hours
// nobody is covering.
//
// Pure. No clock, no database, no writes -- the week and the zone are passed
// in, so a test can drive it across a daylight-saving weekend without waiting
// for one.
//
// ## Why this is not just a nicer list
//
// /business-builder/owner/schedules already lists shifts. What it cannot answer
// is the question the public booking page created: **a slot is only offered
// when somebody is rostered for the whole of it**, so a business that switched
// staffing on and then left a Tuesday empty has a booking page quietly showing
// that Tuesday as unavailable. It does not read as closed. It reads as full.
//
// So the coverage half is the point. `gaps` is the hours a business says it is
// open with nobody rostered, which is the difference between "nothing is
// available" and "nobody has filled in the rota".
//
// ## Three things the arithmetic has to get right
//
// **A day is not always 24 hours.** The end of a local day is 00:00 the next
// morning, found by asking the zone -- not by adding 86400000. On the Sunday
// the clocks go forward a day is 23 hours, and a week built by adding days is
// an hour out for the rest of it.
//
// **A shift can span two local days.** 23:00 to 02:00 is three hours of work
// and appears on both days, clipped to each and marked as continuing, so the
// hours are counted once and neither day pretends the shift began at midnight.
//
// **Two people at once is one hour of opening covered, not two.** Coverage is a
// union of intervals; staffed hours are a sum. Conflating them tells a business
// with two people on Monday that it has covered Tuesday.

const { knownZone, localParts, instantFor, WEEKDAY_NAMES, normaliseOpeningHours } = require("./sonara-booking-availability.cjs");

const MINUTE_MS = 60000;
const DAY_MS = 86400000;

// An ISO day that is a real day.
//
// The shape test is not enough on its own: Date.UTC rolls over, so "2026-13-40"
// is a well-formed string that silently becomes 9 February 2027 and lays out a
// week eight months from the one that was asked for. The parts are read back
// and compared, which is the same check instantFor makes for the same reason.
function isoDayParts(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  if (Number.isNaN(instant.getTime())) return null;
  if (instant.getUTCFullYear() !== year || instant.getUTCMonth() + 1 !== month || instant.getUTCDate() !== day) return null;
  return { year, month, day, anchor: instant.getTime() };
}

// The instant a local calendar day begins.
//
// Midnight exists in almost every zone on almost every date, and in the handful
// where a spring-forward lands on it the day begins at the first minute that
// does exist. Returning null instead would drop a whole day out of the week
// once a year in Havana and Santiago -- the kind of bug nobody reports because
// nobody there is reading this in English.
function startOfLocalDay({ year, month, day }, timeZone) {
  for (let minute = 0; minute < 240; minute += 15) {
    const instant = instantFor({ year, month, day, hour: Math.floor(minute / 60), minute: minute % 60 }, timeZone);
    if (instant !== null) return instant;
  }
  return null;
}

// The seven local dates of a week, starting from a given ISO day.
function weekDates(weekStartsOn, timeZone) {
  const start = isoDayParts(weekStartsOn);
  if (!start) return null;
  const dates = [];
  for (let offset = 0; offset < 7; offset += 1) {
    // Stepped from noon UTC rather than midnight, then read back in the zone.
    // Noon is far enough from either edge that a one-hour shift cannot move the
    // date, which stepping from midnight can.
    dates.push(localParts(new Date(start.anchor + offset * DAY_MS), timeZone));
  }
  return dates;
}

function finiteInstant(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

// Merge overlapping or touching intervals into the smallest set covering the
// same time. This is what makes two people on at once one hour of cover.
function mergeIntervals(intervals) {
  const sorted = [...intervals].filter((one) => one.end > one.start).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
      continue;
    }
    merged.push({ start: interval.start, end: interval.end });
  }
  return merged;
}

// What is left of `wanted` after `covered` is taken out of it.
function subtractIntervals(wanted, covered) {
  const gaps = [];
  for (const need of wanted) {
    let cursor = need.start;
    for (const have of covered) {
      if (have.end <= cursor || have.start >= need.end) continue;
      if (have.start > cursor) gaps.push({ start: cursor, end: Math.min(have.start, need.end) });
      cursor = Math.max(cursor, have.end);
      if (cursor >= need.end) break;
    }
    if (cursor < need.end) gaps.push({ start: cursor, end: need.end });
  }
  return gaps.filter((gap) => gap.end > gap.start);
}

// The most people on at the same moment, by sweeping the starts and ends.
function peakConcurrent(intervals) {
  const events = [];
  for (const interval of intervals) {
    if (interval.end <= interval.start) continue;
    events.push({ at: interval.start, delta: 1 });
    events.push({ at: interval.end, delta: -1 });
  }
  // Ends before starts at the same instant: somebody finishing at 17:00 and
  // somebody starting at 17:00 are never both at work.
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let running = 0;
  let peak = 0;
  for (const event of events) {
    running += event.delta;
    if (running > peak) peak = running;
  }
  return peak;
}

function clockAt(instant, timeZone) {
  const parts = localParts(new Date(instant), timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

// The statuses that mean somebody is actually expected at work. Same list, and
// the same reasoning, as availability: an unrecognised status is not counted,
// because both this and the booking page must fail towards showing less cover
// rather than more.
const WORKING_STATUSES = Object.freeze(new Set(["scheduled", "confirmed", "completed"]));

/**
 * A week of shifts, and the hours nobody is on.
 *
 * `openingHours` is the seven-entry structure the booking page stores. Pass it
 * to get `gaps`; leave it out and coverage is not computed at all rather than
 * reported as complete -- a business that has not said when it is open has no
 * gaps by definition, and printing "fully covered" would be a claim nothing
 * checked.
 */
function layOutWeek({ shifts = [], weekStartsOn, timeZone, openingHours = null, names = new Map() } = {}) {
  const zone = knownZone(timeZone);
  if (!zone) {
    return { ok: false, reason: "This business does not have a working time zone set, so a week cannot be laid out.", days: [], staffedMinutes: 0, gaps: [] };
  }

  const dates = weekDates(weekStartsOn, zone);
  if (!dates) {
    return { ok: false, reason: "That is not a week this can start from.", days: [], staffedMinutes: 0, gaps: [] };
  }

  // Every shift as an instant range, once, before any day is considered.
  const ranges = [];
  let unreadable = 0;
  for (const shift of Array.isArray(shifts) ? shifts : []) {
    if (!shift) continue;
    if (!WORKING_STATUSES.has(String(shift.status || "").toLowerCase())) continue;
    const start = finiteInstant(shift.starts_at);
    const end = finiteInstant(shift.ends_at);
    // Both ends required, as in availability. A shift with no end is not
    // somebody working for ever, and drawing it that way fills the week.
    if (start === null || end === null || end <= start) { unreadable += 1; continue; }
    ranges.push({
      start, end,
      employeeId: shift.employee_id || null,
      label: String(shift.role_label || "").trim() || null,
      id: shift.id || null
    });
  }

  const hours = openingHours ? normaliseOpeningHours(openingHours) : null;
  const days = [];
  const allGaps = [];
  let staffedMinutes = 0;

  for (const date of dates) {
    const dayStart = startOfLocalDay(date, zone);
    if (dayStart === null) continue;
    // The next local midnight, asked of the zone rather than added. A day is 23
    // or 25 hours twice a year, and a week built by adding days is an hour out
    // for the rest of it.
    const nextParts = localParts(new Date(dayStart + DAY_MS + 3 * 3600000), zone);
    const dayEnd = startOfLocalDay(nextParts, zone);
    if (dayEnd === null || dayEnd <= dayStart) continue;

    const onThisDay = [];
    for (const range of ranges) {
      if (range.end <= dayStart || range.start >= dayEnd) continue;
      const clippedStart = Math.max(range.start, dayStart);
      const clippedEnd = Math.min(range.end, dayEnd);
      onThisDay.push({
        id: range.id,
        employeeId: range.employeeId,
        who: names.get?.(range.employeeId) || null,
        label: range.label,
        start: clippedStart,
        end: clippedEnd,
        from: clockAt(clippedStart, zone),
        // A shift ending exactly at the next midnight reads as 00:00, which
        // looks like it ends before it starts. Said as 24:00 instead.
        to: clippedEnd === dayEnd ? "24:00" : clockAt(clippedEnd, zone),
        minutes: Math.round((clippedEnd - clippedStart) / MINUTE_MS),
        continuesFromPrevious: range.start < dayStart,
        continuesIntoNext: range.end > dayEnd
      });
    }
    onThisDay.sort((a, b) => a.start - b.start || String(a.who || "").localeCompare(String(b.who || "")));

    const covered = mergeIntervals(onThisDay.map((shift) => ({ start: shift.start, end: shift.end })));
    const dayStaffed = onThisDay.reduce((sum, shift) => sum + shift.minutes, 0);
    staffedMinutes += dayStaffed;

    // What the business says it is open, as instants on this day.
    let dayGaps = null;
    if (hours) {
      const wanted = [];
      for (const range of hours[date.weekday] || []) {
        const open = instantFor({ year: date.year, month: date.month, day: date.day, hour: Math.floor(range.open / 60), minute: range.open % 60 }, zone);
        const close = range.close >= 1440
          ? dayEnd
          : instantFor({ year: date.year, month: date.month, day: date.day, hour: Math.floor(range.close / 60), minute: range.close % 60 }, zone);
        // An opening time that does not exist on this date is the spring-forward
        // hour. Skipped rather than treated as covered or as a gap, because
        // neither is true of an hour that did not happen.
        if (open === null || close === null || close <= open) continue;
        wanted.push({ start: open, end: close });
      }
      dayGaps = subtractIntervals(wanted, covered).map((gap) => ({
        from: clockAt(gap.start, zone),
        to: gap.end === dayEnd ? "24:00" : clockAt(gap.end, zone),
        minutes: Math.round((gap.end - gap.start) / MINUTE_MS)
      }));
      for (const gap of dayGaps) allGaps.push({ date: `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`, ...gap });
    }

    days.push({
      date: `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`,
      weekday: WEEKDAY_NAMES[date.weekday] || "",
      shifts: onThisDay,
      staffedMinutes: dayStaffed,
      peopleOnAtOnce: peakConcurrent(onThisDay.map((shift) => ({ start: shift.start, end: shift.end }))),
      // null when the business has not said when it is open. Never [] -- an
      // empty list reads as "fully covered", which is a claim nothing checked.
      gaps: dayGaps
    });
  }

  return {
    ok: true,
    reason: null,
    timeZone: zone,
    days,
    staffedMinutes,
    people: new Set(ranges.map((range) => range.employeeId).filter(Boolean)).size,
    // Counted, not dropped. A shift this could not read is a shift somebody
    // entered, and a week that quietly leaves it out shows less cover than the
    // business believes it has.
    unreadable,
    gaps: hours ? allGaps : null
  };
}

// The Monday on or before a date, in ISO form. Weeks start on Monday here
// because a rota is a working week; the booking page's opening hours are
// indexed Sunday-first and that is a storage detail, not a display one.
function weekStartFor(date, timeZone) {
  const zone = knownZone(timeZone);
  if (!zone) return null;
  const instant = date instanceof Date ? date.getTime() : Date.parse(String(date || ""));
  if (!Number.isFinite(instant)) return null;
  const parts = localParts(new Date(instant), zone);
  // weekday is 0 for Sunday; Monday starts the week, so Sunday steps back six.
  const back = parts.weekday === 0 ? 6 : parts.weekday - 1;
  const moved = localParts(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12) - back * DAY_MS), zone);
  return `${moved.year}-${String(moved.month).padStart(2, "0")}-${String(moved.day).padStart(2, "0")}`;
}

function shiftWeek(weekStartsOn, byWeeks, timeZone) {
  const zone = knownZone(timeZone) || "UTC";
  const start = isoDayParts(weekStartsOn);
  if (!start) return null;
  const moved = localParts(new Date(start.anchor + byWeeks * 7 * DAY_MS), zone);
  return `${moved.year}-${String(moved.month).padStart(2, "0")}-${String(moved.day).padStart(2, "0")}`;
}

function hoursAndMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

module.exports = {
  WORKING_STATUSES,
  isoDayParts,
  startOfLocalDay,
  weekDates,
  mergeIntervals,
  subtractIntervals,
  peakConcurrent,
  layOutWeek,
  weekStartFor,
  shiftWeek,
  hoursAndMinutes
};
