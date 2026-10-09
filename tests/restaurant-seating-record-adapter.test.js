// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { previewSeatingFromRecords } = require("../lib/sonara-restaurant-seating-record-adapter.cjs");

function fixture(overrides = {}) {
  const organizationId = "org-1";
  const t = (id, server, capacity = 4) => ({ id, organization_id: organizationId, status: "active",
    metadata: { bookable: true, resource_type: "table", capacity, seating_server_id: server } });
  const e = (id) => ({ id, organization_id: organizationId, active_covers: 0, maximum_covers: 12, available: true });
  return {
    organizationId,
    evidence: { tenantAuthorized: true, queryOrganizationId: organizationId,
      resourcesComplete: true, bookingsComplete: true, serversComplete: true,
      truncated: false, fetchedAtUtc: "2026-10-10T12:00:00Z" },
    nowUtc: "2026-10-10T12:00:10Z", partySize: 3,
    startsAt: "2026-10-10T12:15:00Z", durationMinutes: 90,
    resourceRows: [t("A", "server1"), t("B", "server2", 6)],
    serverRows: [e("server1"), e("server2")],
    bookingRows: [],
    ...overrides
  };
}
const hold = (ids, status = "confirmed", time = "2026-10-10T12:30:00Z") => ({
  id: "booking1", organization_id: "org-1", status,
  starts_at: time, ends_at: "2026-10-10T13:30:00Z",
  metadata: { resource_ids: ids }
});

describe("canonical restaurant seating source adapter", () => {
  it("produces read-only ranked choices for complete tenant records", () => {
    const r = previewSeatingFromRecords(fixture());
    assert.equal(r.ok, true);
    assert.deepEqual(r.choices.map(x => x.tableId), ["A", "B"]);
    assert.equal(r.canBookWithoutRecheck, false);
    assert.equal(r.previewOnly, true);
    assert.equal(r.organizationId, "org-1");
  });
  it("blocks missing tenant membership and a source scoped to another organization", () => {
    assert.equal(previewSeatingFromRecords(fixture({ evidence: { ...fixture().evidence,
      tenantAuthorized: false } })).code, "seating_source_unverified");
    assert.equal(previewSeatingFromRecords(fixture({ evidence: { ...fixture().evidence,
      queryOrganizationId: "org-2" } })).code, "seating_source_unverified");
  });
  it("does not treat truncated, unknown, or failed reads as empty tables", () => {
    const evidence = fixture().evidence;
    for (const change of [{ bookingsComplete: false }, { truncated: true }, { truncated: undefined },
      { serversComplete: false }, { resourcesComplete: false }]) {
      assert.equal(previewSeatingFromRecords(fixture({ evidence: { ...evidence, ...change } })).code,
        "seating_source_unverified");
    }
  });
  it("rejects stale, future, and unzoned snapshot timestamps", () => {
    assert.equal(previewSeatingFromRecords(fixture({ nowUtc: "2026-10-10T12:03:30Z" })).code,
      "seating_snapshot_stale_or_invalid");
    assert.equal(previewSeatingFromRecords(fixture({ nowUtc: "2026-10-10T11:59:30Z" })).code,
      "seating_snapshot_stale_or_invalid");
    assert.equal(previewSeatingFromRecords(fixture({ nowUtc: "2026-10-10T12:00:10" })).code,
      "seating_snapshot_stale_or_invalid");
  });
  it("rejects a foreign-tenant row even if the query claims a tenant filter", () => {
    const original = fixture();
    assert.equal(previewSeatingFromRecords(fixture({
      resourceRows: [{ ...original.resourceRows[0], organization_id: "org-2" }]
    })).code, "seating_tenant_or_read_incomplete");
    assert.equal(previewSeatingFromRecords(fixture({
      bookingRows: [{ ...hold(["A"]), organization_id: "org-2" }]
    })).code, "seating_tenant_or_read_incomplete");
    assert.equal(previewSeatingFromRecords(fixture({
      serverRows: [{ ...original.serverRows[0], organization_id: "org-2" }]
    })).code, "seating_tenant_or_read_incomplete");
  });
  it("blocks the affected table when a confirmed hold overlaps", () => {
    const r = previewSeatingFromRecords(fixture({ bookingRows: [hold(["A"])] }));
    assert.deepEqual(r.choices.map(x => x.tableId), ["B"]);
    assert.equal(r.blockingBookingCount, 1);
  });
  it("blocks all members of a multi-resource hold", () => {
    const r = previewSeatingFromRecords(fixture({ bookingRows: [hold(["A", "B"])] }));
    assert.equal(r.state, "no_verified_option");
    assert.equal(r.blockingBookingCount, 2);
  });
  it("does not block a canceled reservation or waiting-list inquiry", () => {
    const cancelled = previewSeatingFromRecords(fixture({ bookingRows: [hold(["A"], "cancelled")] }));
    assert.equal(cancelled.choices.length, 2);
    const waiting = previewSeatingFromRecords(fixture({ bookingRows: [{
      id: "wait-1", organization_id: "org-1", status: "requested",
      metadata: { waitlist: true, waitlist_state: "waiting" }
    }] }));
    assert.equal(waiting.choices.length, 2);
  });
  it("requires every active booking to name known resources; missing ones are never assumed free", () => {
    assert.equal(previewSeatingFromRecords(fixture({ bookingRows: [hold(["missing"])] })).code,
      "unmapped_active_booking");
    assert.equal(previewSeatingFromRecords(fixture({ bookingRows: [{ ...hold(["A"]),
      metadata: {} }] })).code, "unmapped_active_booking");
  });
  it("rejects an incorrectly mapped table server", () => {
    const original = fixture();
    assert.equal(previewSeatingFromRecords(fixture({ serverRows: [original.serverRows[0]] })).code,
      "unmapped_table_server");
  });
  it("requires valid configured integer table capacity and verified cover load", () => {
    const original = fixture();
    assert.equal(previewSeatingFromRecords(fixture({
      resourceRows: [{ ...original.resourceRows[0], metadata: { ...original.resourceRows[0].metadata,
        capacity: "4" } }]
    })).code, "unverified_table_configuration");
    assert.equal(previewSeatingFromRecords(fixture({
      serverRows: [{ ...original.serverRows[0], active_covers: 13 }]
    })).code, "unverified_server_load");
  });
  it("has stable results for repeated snapshots and does not mutate input records", () => {
    const input = fixture({ bookingRows: [hold(["A"])] });
    const serialized = JSON.stringify(input);
    const a = previewSeatingFromRecords(input);
    const b = previewSeatingFromRecords(input);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(input), serialized);
  });
});
