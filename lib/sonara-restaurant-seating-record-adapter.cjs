// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure adapter for a future SERVER-ONLY seating preview route. It does not
// obtain or prove authorization: the privileged caller must resolve tenant
// membership, fetch every source with that tenant filter, and construct the
// evidence only after successful, complete reads. Never accept evidence from
// an HTTP body. It creates no database holds and sends no provider requests.
const { rankSeatingOptions } = require("./sonara-restaurant-capacity-science.cjs");
const MAX_ROWS = 500;
const MAX_AGE_MS = 120000;
const FREE_STATUSES = new Set(["cancelled", "no_show", "archived"]);
const BOOKING_STATUSES = new Set(["requested", "confirmed", "completed", "cancelled", "no_show", "archived"]);
const UTC_TIME = /(?:Z|[+-]\d{2}:\d{2})$/i;

const failed = (code) => ({ ok: false, code, previewOnly: true });
const validId = (value) => typeof value === "string" && value.length >= 1 && value.length <= 160 && value.trim() === value;
const integer = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
function time(value) {
  if (typeof value !== "string" || !UTC_TIME.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
function inTenant(rows, id) {
  return Array.isArray(rows) && rows.length <= MAX_ROWS
    && rows.every((row) => row && row.organization_id === id);
}

/**
 * Convert existing business_assets / business_bookings rows into the seating
 * planner's exact contract. Only accepts all-source, same-tenant snapshots.
 * The extra 'servers' input is an explicitly verified server-cover snapshot:
 * employee schedules alone do NOT establish real-time cover load.
 */
function previewSeatingFromRecords({
  organizationId, evidence, resourceRows, bookingRows, serverRows,
  partySize, startsAt, durationMinutes, nowUtc
} = {}) {
  if (!validId(organizationId) || !evidence || evidence.tenantAuthorized !== true
    || evidence.queryOrganizationId !== organizationId || evidence.resourcesComplete !== true
    || evidence.bookingsComplete !== true || evidence.serversComplete !== true
    || evidence.truncated === true) return failed("seating_source_unverified");
  const fetchedAt = time(evidence.fetchedAtUtc), now = time(nowUtc);
  if (fetchedAt === null || now === null || fetchedAt > now + 10000 || now - fetchedAt > MAX_AGE_MS) {
    return failed("seating_snapshot_stale_or_invalid");
  }
  if (!inTenant(resourceRows, organizationId) || !inTenant(bookingRows, organizationId)
    || !inTenant(serverRows, organizationId)) return failed("seating_tenant_or_read_incomplete");

  const tables = [], resourceIds = new Set(), tableIds = new Set();
  for (const row of resourceRows) {
    if (!validId(row.id) || resourceIds.has(row.id)) return failed("unverified_resource");
    resourceIds.add(row.id);
    const meta = row.metadata;
    if (meta?.bookable !== true || meta?.resource_type !== "table") continue;
    if (!integer(meta.capacity, 1, 100) || !validId(meta.seating_server_id)
      || typeof row.status !== "string") return failed("unverified_table_configuration");
    tableIds.add(row.id);
    tables.push({ id: row.id, capacity: meta.capacity,
      status: row.status === "active" ? "available" : "unavailable",
      serverId: meta.seating_server_id });
  }

  const servers = [], serverIds = new Set();
  for (const row of serverRows) {
    if (!validId(row.id) || serverIds.has(row.id)
      || !integer(row.active_covers, 0, 1000)
      || !integer(row.maximum_covers, 0, 1000)
      || row.active_covers > row.maximum_covers
      || typeof row.available !== "boolean") return failed("unverified_server_load");
    serverIds.add(row.id);
    servers.push({ id: row.id, activeCovers: row.active_covers,
      maximumCovers: row.maximum_covers, available: row.available });
  }
  if (tables.some((table) => !serverIds.has(table.serverId))) return failed("unmapped_table_server");

  const reservations = [];
  for (const row of bookingRows) {
    if (!validId(row.id) || !BOOKING_STATUSES.has(row.status)) return failed("unverified_booking");
    // A waitlist request is NOT a resource hold until marked as booked.
    if (row.metadata?.waitlist === true && row.metadata?.waitlist_state !== "booked") continue;
    if (FREE_STATUSES.has(row.status)) continue;
    const ids = row.metadata?.resource_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 16
      || ids.some((id) => !validId(id) || !resourceIds.has(id))
      || new Set(ids).size !== ids.length) return failed("unmapped_active_booking");
    if (time(row.starts_at) === null || time(row.ends_at) === null
      || time(row.ends_at) <= time(row.starts_at)) return failed("unverified_booking_time");
    for (const id of ids) {
      if (tableIds.has(id)) reservations.push({ tableId: id,
        startsAt: row.starts_at, endsAt: row.ends_at, status: row.status });
    }
    if (reservations.length > MAX_ROWS) return failed("seating_reservations_over_limit");
  }

  const preview = rankSeatingOptions({
    partySize, startsAt, durationMinutes, tables, reservations,
    serverLoads: servers, snapshotComplete: true
  });
  if (!preview.ok) return preview;
  return { ...preview, organizationId, snapshotFetchedAtUtc: evidence.fetchedAtUtc,
    resourceCount: tables.length, blockingBookingCount: reservations.length,
    canBookWithoutRecheck: false,
    disclosure: "Read-only proposal from tenant-scoped snapshots. Availability is not a hold; an authorized atomic database recheck must occur before confirming." };
}

module.exports = { previewSeatingFromRecords };
