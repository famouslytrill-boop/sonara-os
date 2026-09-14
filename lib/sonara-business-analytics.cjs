"use strict";

// Pure business-operations analytics. The route layer decides which tenant rows
// may reach this function; this module only performs deterministic arithmetic.
// A failed or malformed row is counted as unreadable instead of being silently
// converted to zero. That keeps dashboards from turning missing data into good
// news.

const COLLECTED_PAYMENT_STATUSES = new Set(["paid", "succeeded", "completed", "settled"]);
const COMPLETED_BOOKING_STATUSES = new Set(["completed"]);
const CANCELLED_BOOKING_STATUSES = new Set(["cancelled"]);
const NO_SHOW_BOOKING_STATUSES = new Set(["no_show"]);

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function inWindow(value, startMs, endMs) {
  const instant = timestamp(value);
  if (instant === null) return null;
  return instant >= startMs && instant < endMs;
}

function windowFrom(input = {}) {
  const nowMs = timestamp(input.now) ?? Date.now();
  const endMs = timestamp(input.periodEnd) ?? nowMs;
  const startMs = timestamp(input.periodStart) ?? (endMs - (30 * 24 * 60 * 60 * 1000));
  if (startMs >= endMs) return null;
  return { startMs, endMs, start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

function cents(value) {
  const parsed = number(value);
  return parsed === null ? null : Math.round(parsed);
}

function bookingMinutes(row) {
  const start = timestamp(row?.starts_at);
  const end = timestamp(row?.ends_at);
  if (start === null || end === null || end < start) return null;
  return Math.round((end - start) / 60000);
}

function timeEntryMinutes(row) {
  const stored = number(row?.total_minutes);
  if (stored !== null && stored >= 0) return stored;
  const start = timestamp(row?.clock_in_at);
  const end = timestamp(row?.clock_out_at);
  if (start === null || end === null || end < start) return null;
  const breaks = Math.max(0, number(row?.break_minutes) ?? 0);
  return Math.max(0, Math.round((end - start) / 60000) - breaks);
}

function inventoryLine(row) {
  const quantity = number(row?.quantity);
  const unitCost = cents(row?.cost_cents);
  if (quantity === null || unitCost === null || quantity < 0 || unitCost < 0) return null;
  const threshold = number(row?.reorder_level ?? row?.reorder_point);
  return {
    valueCents: Math.round(quantity * unitCost),
    atRisk: threshold === null ? false : quantity <= threshold
  };
}

function summarizeBusinessOperations(input = {}) {
  const window = windowFrom(input);
  if (!window) return { ok: false, code: "invalid_period" };

  const bookings = Array.isArray(input.bookings) ? input.bookings : [];
  const timeEntries = Array.isArray(input.timeEntries) ? input.timeEntries : [];
  const inventoryItems = Array.isArray(input.inventoryItems) ? input.inventoryItems : [];
  const payments = Array.isArray(input.payments) ? input.payments : [];
  const locationEvents = Array.isArray(input.locationEvents) ? input.locationEvents : [];

  const result = {
    ok: true,
    period: { start: window.start, end: window.end },
    bookings: {
      total: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      requestedOrScheduled: 0,
      completionRate: null,
      noShowRate: null,
      averageDurationMinutes: null,
      unreadable: 0
    },
    labor: { entries: 0, minutes: 0, hours: 0, openEntries: 0, unreadable: 0 },
    payments: { collectedCents: 0, collectedCount: 0, otherCount: 0, unreadable: 0 },
    inventory: { itemCount: inventoryItems.length, valueCents: 0, reorderRiskCount: 0, unreadable: 0 },
    location: { checkIns: 0, checkOuts: 0, routeUpdates: 0, unreadable: 0 },
    coverage: {
      bookings: "complete_for_rows_read",
      labor: "complete_for_rows_read",
      payments: "complete_for_rows_read",
      inventory: "point_in_time_for_rows_read",
      location: "consented_events_only"
    }
  };

  let durationTotal = 0;
  let durationCount = 0;
  for (const row of bookings) {
    const included = inWindow(row?.starts_at ?? row?.created_at, window.startMs, window.endMs);
    if (included === null) {
      result.bookings.unreadable += 1;
      continue;
    }
    if (!included) continue;
    result.bookings.total += 1;
    const status = String(row?.status || "").toLowerCase();
    if (COMPLETED_BOOKING_STATUSES.has(status)) result.bookings.completed += 1;
    else if (CANCELLED_BOOKING_STATUSES.has(status)) result.bookings.cancelled += 1;
    else if (NO_SHOW_BOOKING_STATUSES.has(status)) result.bookings.noShow += 1;
    else result.bookings.requestedOrScheduled += 1;
    const duration = bookingMinutes(row);
    if (duration !== null) {
      durationTotal += duration;
      durationCount += 1;
    }
  }
  if (result.bookings.total > 0) {
    result.bookings.completionRate = result.bookings.completed / result.bookings.total;
    result.bookings.noShowRate = result.bookings.noShow / result.bookings.total;
  }
  if (durationCount > 0) result.bookings.averageDurationMinutes = Math.round(durationTotal / durationCount);

  for (const row of timeEntries) {
    const included = inWindow(row?.clock_in_at ?? row?.created_at, window.startMs, window.endMs);
    if (included === null) {
      result.labor.unreadable += 1;
      continue;
    }
    if (!included) continue;
    result.labor.entries += 1;
    if (!row?.clock_out_at && number(row?.total_minutes) === null) {
      result.labor.openEntries += 1;
      continue;
    }
    const minutes = timeEntryMinutes(row);
    if (minutes === null) result.labor.unreadable += 1;
    else result.labor.minutes += minutes;
  }
  result.labor.hours = Math.round((result.labor.minutes / 60) * 100) / 100;

  for (const row of payments) {
    const included = inWindow(row?.created_at, window.startMs, window.endMs);
    if (included === null) {
      result.payments.unreadable += 1;
      continue;
    }
    if (!included) continue;
    const amount = cents(row?.amount_cents);
    if (amount === null || amount < 0) {
      result.payments.unreadable += 1;
      continue;
    }
    const status = String(row?.status || "").toLowerCase();
    if (COLLECTED_PAYMENT_STATUSES.has(status)) {
      result.payments.collectedCents += amount;
      result.payments.collectedCount += 1;
    } else {
      result.payments.otherCount += 1;
    }
  }

  for (const row of inventoryItems) {
    const line = inventoryLine(row);
    if (!line) {
      result.inventory.unreadable += 1;
      continue;
    }
    result.inventory.valueCents += line.valueCents;
    if (line.atRisk) result.inventory.reorderRiskCount += 1;
  }

  for (const row of locationEvents) {
    const included = inWindow(row?.captured_at ?? row?.created_at, window.startMs, window.endMs);
    if (included === null) {
      result.location.unreadable += 1;
      continue;
    }
    if (!included) continue;
    const type = String(row?.event_type || "");
    if (type === "check_in" || type === "job_site_arrival") result.location.checkIns += 1;
    else if (type === "check_out" || type === "job_site_departure") result.location.checkOuts += 1;
    else if (["position_update", "delivery_stop", "zone_enter", "zone_exit"].includes(type)) result.location.routeUpdates += 1;
  }

  return result;
}

module.exports = {
  COLLECTED_PAYMENT_STATUSES,
  bookingMinutes,
  inventoryLine,
  summarizeBusinessOperations,
  timeEntryMinutes,
  windowFrom
};
