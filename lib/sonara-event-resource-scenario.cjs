// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Snapshot-only event/catering equipment planner. External records here are
// untrusted scenario inputs; never claim a real venue hold, roster or booking.
const MAX_RESOURCE_UNITS = 1000000;
const MAX_RESERVATIONS = 500;
const MAX_REQUIREMENTS = 25;
const MAX_DURATION_MS = 7 * 86400000;
const int = (n, min, max) => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
const key = (n) => typeof n === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(n);
const refused = (issues) => ({
  ok: false, state: "invalid_event_scenario", issues,
  bookable: false, reservationCreated: false, contactsNotified: false
});

// Date.parse alone normalizes some impossible dates; round-trip the civil date
// independently so 2026-02-30 cannot silently become March 2.
function instant(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  if (year < 2000 || year > 2100 || !int(hour, 0, 23) || !int(minute, 0, 59) || !int(second, 0, 59)) return null;
  const civil = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(civil);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day) return null;
  if (m[7] !== "Z") {
    const offsetHours = Number(m[7].slice(1, 3));
    const offsetMinutes = Number(m[7].slice(4, 6));
    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) return null;
  }
  const timestamp = Date.parse(value);
  return Number.isSafeInteger(timestamp) ? timestamp : null;
}

function assessEventResourceScenario(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return refused(["invalid_input"]);
  const issues = [];
  const start = instant(input.startsAt), end = instant(input.endsAt);
  if (start === null || end === null || end <= start || end - start > MAX_DURATION_MS) {
    issues.push("invalid_event_time_window");
  }
  try {
    if (typeof input.timeZone !== "string" || input.timeZone.length > 80 ||
      !input.timeZone.trim()) throw Error("zone");
    new Intl.DateTimeFormat("en-US", { timeZone: input.timeZone });
  } catch { issues.push("invalid_time_zone"); }
  if (!int(input.guests, 1, 20000)) issues.push("invalid_guest_count");
  if (input.venueCapacityGuests !== null && input.venueCapacityGuests !== undefined &&
      !int(input.venueCapacityGuests, 0, 20000)) issues.push("invalid_venue_capacity");
  if (!Array.isArray(input.resources) || input.resources.length > MAX_REQUIREMENTS) {
    issues.push("resource_capacity_list_required");
  }
  if (!Array.isArray(input.requirements) || input.requirements.length > MAX_REQUIREMENTS) {
    issues.push("resource_requirements_list_required");
  }
  if (!Array.isArray(input.reservations) || input.reservations.length > MAX_RESERVATIONS) {
    issues.push("reservation_snapshot_required");
  }
  if (issues.length) return refused(issues);

  const capacities = new Map();
  for (const [index, resource] of input.resources.entries()) {
    if (!resource || !key(resource.id) || capacities.has(resource.id) ||
      (resource.capacity !== null && resource.capacity !== undefined &&
      !int(resource.capacity, 0, MAX_RESOURCE_UNITS))) {
      issues.push("invalid_or_duplicate_resource_" + index);
    } else {
      capacities.set(resource.id, resource.capacity ?? null);
    }
  }
  const demands = new Map();
  for (const [index, demand] of input.requirements.entries()) {
    if (!demand || !key(demand.resourceId) || demands.has(demand.resourceId) ||
      !int(demand.units, 1, MAX_RESOURCE_UNITS)) {
      issues.push("invalid_or_duplicate_requirement_" + index);
    } else {
      demands.set(demand.resourceId, demand.units);
    }
  }
  const events = new Map();
  const seen = new Set();
  for (const [index, row] of input.reservations.entries()) {
    if (!row || !key(row.id) || seen.has(row.id) || !key(row.resourceId) ||
      !int(row.units, 1, MAX_RESOURCE_UNITS) ||
      !["held", "confirmed", "cancelled"].includes(row.state)) {
      issues.push("invalid_reservation_" + index);
      continue;
    }
    seen.add(row.id);
    const a = instant(row.startsAt), b = instant(row.endsAt);
    if (a === null || b === null || b <= a) {
      issues.push("invalid_reservation_time_" + index);
      continue;
    }
    if (!capacities.has(row.resourceId)) {
      issues.push("reservation_for_unknown_resource_" + index);
      continue;
    }
    if (row.state === "cancelled" || start === null || end === null || a >= end || b <= start) continue;
    if (!events.has(row.resourceId)) events.set(row.resourceId, []);
    events.get(row.resourceId).push({ at: Math.max(a, start), delta: row.units });
    events.get(row.resourceId).push({ at: Math.min(b, end), delta: -row.units });
  }
  if (issues.length) return refused(issues);

  const checks = [];
  const warnings = [];
  for (const [id, needed] of demands) {
    const capacity = capacities.has(id) ? capacities.get(id) : null;
    const changes = (events.get(id) || []).sort((a, b) => a.at - b.at || a.delta - b.delta);
    let concurrent = 0, peak = 0;
    for (const change of changes) {
      concurrent += change.delta;
      peak = Math.max(peak, concurrent);
    }
    const available = capacity === null ? null : Math.max(0, capacity - peak);
    const shortageUnits = available === null ? null : Math.max(0, needed - available);
    const state = available === null ? "unknown" : shortageUnits > 0 ? "shortage" : "fits_snapshot";
    if (state !== "fits_snapshot") warnings.push(state + ":" + id);
    checks.push({ resourceId: id, neededUnits: needed, capacityUnits: capacity,
      peakReservedUnitsInSnapshot: peak, availableAtPeakUnits: available,
      shortageUnits, state });
  }
  if (input.venueCapacityGuests === null || input.venueCapacityGuests === undefined) {
    warnings.push("venue_capacity_unverified");
  } else if (input.guests > input.venueCapacityGuests) warnings.push("venue_capacity_shortage");
  if (input.resourceSnapshotComplete !== true || input.reservationSnapshotComplete !== true) {
    warnings.push("snapshot_completeness_unverified");
  }
  warnings.push("live_capacity_and_staffing_unverified", "food_safety_review_required");

  return {
    ok: true, state: "scenario_only_no_resource_hold",
    startsAt: input.startsAt, endsAt: input.endsAt, timeZone: input.timeZone,
    guests: input.guests, venueCapacityGuests: input.venueCapacityGuests ?? null,
    resourceChecks: checks, warnings,
    scenarioFitsRecordedCapacity: !checks.some((r) => r.state !== "fits_snapshot") &&
      input.venueCapacityGuests !== null && input.venueCapacityGuests !== undefined &&
      input.guests <= input.venueCapacityGuests,
    snapshotCompletenessClaimed: input.resourceSnapshotComplete === true &&
      input.reservationSnapshotComplete === true,
    realProviderReadVerified: false, bookable: false,
    reservationCreated: false, contactsNotified: false,
    ownerApprovalRecorded: false
  };
}

module.exports = { assessEventResourceScenario, instant };
