// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { planServiceCoverage, estimateShiftLabor, rankSeatingOptions } = require("../lib/sonara-restaurant-capacity-science.cjs");

const at = "2026-10-10T18:00:00-04:00";
function seating(overrides = {}) {
  return rankSeatingOptions({ snapshotComplete: true, partySize: 2, startsAt: at, durationMinutes: 90,
    tables: [{ id: "T2", capacity: 2, status: "available", serverId: "A" },
      { id: "T4", capacity: 4, status: "available", serverId: "B" }],
    reservations: [],
    serverLoads: [{ id: "A", activeCovers: 2, maximumCovers: 8, available: true },
      { id: "B", activeCovers: 0, maximumCovers: 8, available: true }], ...overrides });
}

describe("restaurant deterministic capacity previews", () => {
  it("models peak intervals instead of hiding a shortfall in daily averages", () => {
    const r = planServiceCoverage([
      { id: "dinner", expectedCovers: 50, durationMinutes: 60, coversPerWorkerHour: 10, minimumWorkers: 2, availableWorkers: 4 },
      { id: "late", expectedCovers: 2, durationMinutes: 60, coversPerWorkerHour: 10, minimumWorkers: 2, availableWorkers: 3 }
    ]);
    assert.equal(r.ok, true);
    assert.deepEqual(r.intervals.map(x => [x.neededWorkers, x.shortfall]), [[5, 1], [2, 0]]);
  });
  it("rejects missing workload facts rather than assuming zero", () => {
    assert.equal(planServiceCoverage([{ id: "rush", expectedCovers: 3, durationMinutes: 60, minimumWorkers: 1 }]).code, "invalid_coverage_input");
    assert.equal(planServiceCoverage([{ id: "same", expectedCovers: 3, durationMinutes: 30, coversPerWorkerHour: 10, minimumWorkers: 1 },
      { id: "same", expectedCovers: 3, durationMinutes: 30, coversPerWorkerHour: 10, minimumWorkers: 1 }]).code, "invalid_interval_id");
  });
  it("estimates wages, explicitly configured overtime, burden, and budget in cents", () => {
    const r = estimateShiftLabor({ projectedSalesCents: 100000, targetLaborBasisPoints: 3000,
      shifts: [{ hourlyRateCents: 2000, regularMinutes: 480, overtimeMinutes: 60,
        overtimeMultiplierBasisPoints: 15000, employerBurdenBasisPoints: 1000 }] });
    assert.equal(r.ok, true);
    assert.equal(r.directWagesCents, 19000);
    assert.equal(r.estimatedBurdenCents, 1900);
    assert.equal(r.totalEstimatedLaborCents, 20900);
    assert.equal(r.targetBudgetCents, 30000);
    assert.equal(r.differenceToBudgetCents, 9100);
    assert.equal(r.estimatedLaborBasisPoints, 2090);
    assert.equal(r.fullyBurdened, true);
    assert.equal(r.previewOnly, true);
  });
  it("refuses unconfigured overtime and labels missing burden or revenue honestly", () => {
    assert.equal(estimateShiftLabor({ projectedSalesCents: 1000, targetLaborBasisPoints: 3000,
      shifts: [{ hourlyRateCents: 2000, regularMinutes: 0, overtimeMinutes: 60 }] }).code, "overtime_multiplier_required");
    assert.equal(estimateShiftLabor({ projectedSalesCents: 1000, targetLaborBasisPoints: 3000, shifts: [] }).code, "invalid_labor_input");
    const r = estimateShiftLabor({ projectedSalesCents: 0, targetLaborBasisPoints: 3000,
      shifts: [{ hourlyRateCents: 1000, regularMinutes: 60, overtimeMinutes: 0 }] });
    assert.equal(r.estimatedLaborBasisPoints, null);
    assert.equal(r.fullyBurdened, false);
  });
  it("ranks smallest seat waste before lighter server cover load, without committing", () => {
    const r = seating();
    assert.equal(r.ok, true);
    assert.deepEqual(r.choices.map(x => x.tableId), ["T2", "T4"]);
    assert.equal(r.previewOnly, true);
  });
  it("blocks overlapping confirmed and requested holds but frees canceled reservations", () => {
    const r = seating({ reservations: [
      { tableId: "T2", startsAt: "2026-10-10T21:30:00Z", endsAt: "2026-10-10T23:00:00Z", status: "confirmed" },
      { tableId: "T4", startsAt: "2026-10-10T22:00:00Z", endsAt: "2026-10-10T23:00:00Z", status: "cancelled" }
    ] });
    assert.deepEqual(r.choices.map(x => x.tableId), ["T4"]);
  });
  it("refuses unknown reservation times for affected tables, with no invented availability", () => {
    const r = seating({ reservations: [{ tableId: "T2", startsAt: "bad", endsAt: "bad", status: "confirmed" }] });
    assert.deepEqual(r.choices.map(x => x.tableId), ["T4"]);
  });
  it("rejects incomplete snapshots, naive date stamps, unknown server load, and duplicate tables", () => {
    assert.equal(seating({ snapshotComplete: false }).code, "incomplete_seating_snapshot");
    assert.equal(seating({ startsAt: "2026-10-10T18:00:00" }).code, "invalid_seating_input");
    assert.equal(seating({ serverLoads: [] }).choices.length, 0);
    assert.equal(seating({ tables: [
      { id: "X", capacity: 2, status: "available", serverId: "A" },
      { id: "X", capacity: 4, status: "available", serverId: "B" }
    ] }).code, "unverified_table_configuration");
  });
  it("is deterministic and keeps a full table or at-capacity server unavailable", () => {
    const over = { serverLoads: [{ id: "A", activeCovers: 8, maximumCovers: 8, available: true },
      { id: "B", activeCovers: 8, maximumCovers: 8, available: true }] };
    assert.equal(seating(over).state, "no_verified_option");
    assert.deepEqual(seating(), seating());
  });
});
