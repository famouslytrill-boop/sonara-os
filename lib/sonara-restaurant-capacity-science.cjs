// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic, read-only previews for hospitality operations. Caller MUST
// authorize the tenant and supply a complete, tenant-scoped snapshot. No
// reservation, shift, payroll, notification, or POS mutation occurs here.
const MAX_RECORDS = 500;
const MAX_CENTS = 100_000_000_000;
const FREE_STATUSES = new Set(["cancelled", "no_show", "archived"]);
const UTC_WITH_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/i;

function integer(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function invalid(code) {
  return { ok: false, code, previewOnly: true };
}

function instant(value) {
  if (typeof value !== "string" || !UTC_WITH_OFFSET.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function roundedDivide(numerator, denominator) {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

/**
 * Forecast role coverage independently per arrival interval, not by an
 * all-day average that hides peaks. Throughput is explicitly supplied by the
 * operator; no claim is made that it is a safe or legally required ratio.
 */
function planServiceCoverage(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0 || intervals.length > 96) {
    return invalid("invalid_intervals");
  }
  const seen = new Set();
  const result = [];
  for (const slot of intervals) {
    if (!slot || typeof slot.id !== "string" || !slot.id.trim() || slot.id.length > 100 || seen.has(slot.id)) {
      return invalid("invalid_interval_id");
    }
    seen.add(slot.id);
    if (!integer(slot.expectedCovers, 0, 100_000)
      || !integer(slot.durationMinutes, 1, 1440)
      || !integer(slot.coversPerWorkerHour, 1, 1000)
      || !integer(slot.minimumWorkers, 0, 10_000)
      || (slot.availableWorkers !== undefined && !integer(slot.availableWorkers, 0, 10_000))) {
      return invalid("invalid_coverage_input");
    }
    const workerCapacity = slot.durationMinutes * slot.coversPerWorkerHour;
    const workloadWorkers = Math.ceil((slot.expectedCovers * 60) / workerCapacity);
    const neededWorkers = Math.max(slot.minimumWorkers, workloadWorkers);
    const shortfall = slot.availableWorkers === undefined ? null : Math.max(0, neededWorkers - slot.availableWorkers);
    result.push({ id: slot.id, neededWorkers, workloadWorkers,
      availableWorkers: slot.availableWorkers ?? null, shortfall,
      reviewRequired: shortfall === null || shortfall > 0 });
  }
  return { ok: true, previewOnly: true, intervals: result,
    basis: "Operator-entered peak interval covers and covers-per-worker-hour; not an automatically approved staffing schedule." };
}

/**
 * Cost in cents. This is an estimate, NOT payroll: overtime multipliers and
 * employer burden must be supplied rather than guessed from location/role.
 */
function estimateShiftLabor({ projectedSalesCents, targetLaborBasisPoints, shifts } = {}) {
  if (!integer(projectedSalesCents, 0, MAX_CENTS)
    || !integer(targetLaborBasisPoints, 0, 10000)
    || !Array.isArray(shifts) || shifts.length === 0 || shifts.length > MAX_RECORDS) return invalid("invalid_labor_input");
  let directWagesCents = 0;
  let estimatedBurdenCents = 0;
  let missingBurdenInputs = false;
  for (const shift of shifts) {
    if (!shift || !integer(shift.hourlyRateCents, 0, 1_000_000)
      || !integer(shift.regularMinutes, 0, 10080)
      || !integer(shift.overtimeMinutes, 0, 10080)) return invalid("invalid_shift");
    if (shift.overtimeMinutes > 0 && !integer(shift.overtimeMultiplierBasisPoints, 10000, 30000)) {
      return invalid("overtime_multiplier_required");
    }
    if (shift.employerBurdenBasisPoints !== undefined
      && !integer(shift.employerBurdenBasisPoints, 0, 20000)) return invalid("invalid_burden");
    const overtimeRate = shift.overtimeMinutes > 0 ? shift.overtimeMultiplierBasisPoints : 10000;
    const wages = roundedDivide(shift.regularMinutes * shift.hourlyRateCents, 60)
      + roundedDivide(shift.overtimeMinutes * shift.hourlyRateCents * overtimeRate, 600000);
    const burden = roundedDivide(wages * (shift.employerBurdenBasisPoints ?? 0), 10000);
    if (shift.employerBurdenBasisPoints === undefined) missingBurdenInputs = true;
    directWagesCents += wages;
    estimatedBurdenCents += burden;
    if (!Number.isSafeInteger(directWagesCents + estimatedBurdenCents)
      || directWagesCents + estimatedBurdenCents > MAX_CENTS) return invalid("labor_total_exceeds_limit");
  }
  const totalEstimatedLaborCents = directWagesCents + estimatedBurdenCents;
  const targetBudgetCents = roundedDivide(projectedSalesCents * targetLaborBasisPoints, 10000);
  const estimatedLaborBasisPoints = projectedSalesCents === 0 ? null
    : roundedDivide(totalEstimatedLaborCents * 10000, projectedSalesCents);
  return { ok: true, previewOnly: true, directWagesCents, estimatedBurdenCents,
    totalEstimatedLaborCents, targetBudgetCents,
    differenceToBudgetCents: targetBudgetCents - totalEstimatedLaborCents,
    estimatedLaborBasisPoints,
    overTarget: totalEstimatedLaborCents > targetBudgetCents,
    fullyBurdened: !missingBurdenInputs,
    basis: "Planning estimate only. Verify jurisdictional overtime, tip-credit, breaks, collective agreements, taxes, and actual payroll with qualified review." };
}

/**
 * Rank POSSIBLE table assignments, never commit a booking. Any unknown or
 * malformed reservation for a table blocks that table. Transactional recheck
 * and unique resource holds remain mandatory on the write path.
 */
function rankSeatingOptions({ partySize, startsAt, durationMinutes, tables, reservations, serverLoads, snapshotComplete } = {}) {
  const start = instant(startsAt);
  if (snapshotComplete !== true) return invalid("incomplete_seating_snapshot");
  if (!integer(partySize, 1, 100) || start === null || !integer(durationMinutes, 15, 360)
    || !Array.isArray(tables) || !Array.isArray(reservations) || !Array.isArray(serverLoads)
    || tables.length > MAX_RECORDS || reservations.length > MAX_RECORDS || serverLoads.length > MAX_RECORDS) {
    return invalid("invalid_seating_input");
  }
  const end = start + durationMinutes * 60000;
  const serverMap = new Map();
  for (const server of serverLoads) {
    if (!server || typeof server.id !== "string" || !server.id.trim() || serverMap.has(server.id)
      || !integer(server.activeCovers, 0, 1000)
      || !integer(server.maximumCovers, 0, 1000)
      || typeof server.available !== "boolean") return invalid("unverified_server_load");
    serverMap.set(server.id, server);
  }
  const seen = new Set();
  const eligible = [];
  for (const table of tables) {
    if (!table || typeof table.id !== "string" || !table.id.trim() || seen.has(table.id)
      || !integer(table.capacity, 1, 100) || typeof table.serverId !== "string") {
      return invalid("unverified_table_configuration");
    }
    seen.add(table.id);
    if (table.status !== "available" || table.capacity < partySize) continue;
    const server = serverMap.get(table.serverId);
    if (!server || !server.available || server.activeCovers + partySize > server.maximumCovers) continue;
    let held = false;
    for (const booking of reservations) {
      if (!booking || typeof booking.tableId !== "string" || !seenString(booking.status)) {
        return invalid("unverified_reservation_snapshot");
      }
      if (booking.tableId !== table.id || FREE_STATUSES.has(booking.status)) continue;
      const bookingStart = instant(booking.startsAt);
      const bookingEnd = instant(booking.endsAt);
      if (bookingStart === null || bookingEnd === null || bookingEnd <= bookingStart
        || (bookingStart < end && start < bookingEnd)) { held = true; break; }
    }
    if (held) continue;
    eligible.push({ tableId: table.id, serverId: table.serverId,
      unusedSeats: table.capacity - partySize, serverCoversBefore: server.activeCovers });
  }
  eligible.sort((a, b) => a.unusedSeats - b.unusedSeats
    || a.serverCoversBefore - b.serverCoversBefore
    || a.tableId.localeCompare(b.tableId));
  return { ok: true, previewOnly: true, choices: eligible,
    state: eligible.length ? "available_for_review" : "no_verified_option",
    basis: "Uses supplied available tables, overlapping booking holds and server cover limits; must be rechecked atomically before seating or confirming." };
}

function seenString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = { planServiceCoverage, estimateShiftLabor, rankSeatingOptions };
