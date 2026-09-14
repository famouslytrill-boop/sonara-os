"use strict";

const assert = require("node:assert/strict");
const { summarizeBusinessOperations } = require("../lib/sonara-business-analytics.cjs");
const { buildMapSnapshot, pointFromEvent } = require("../lib/sonara-location-map.cjs");
const { validateWorkflow } = require("../lib/sonara-workflow-planner.cjs");
const { planMediaWorkflow, buildGenerationJobs, workflowTemplates } = require("../lib/sonara-creator-media-workflows.cjs");

describe("operations analytics", () => {
  const start = "2026-09-01T00:00:00.000Z";
  const end = "2026-10-01T00:00:00.000Z";

  it("calculates bookings labor payments inventory and consented location events without inventing unreadable values", () => {
    const summary = summarizeBusinessOperations({
      periodStart: start,
      periodEnd: end,
      bookings: [
        { status: "completed", starts_at: "2026-09-10T10:00:00Z", ends_at: "2026-09-10T11:00:00Z" },
        { status: "no_show", starts_at: "2026-09-11T10:00:00Z", ends_at: "2026-09-11T10:30:00Z" },
        { status: "completed", starts_at: "not-a-date", ends_at: "2026-09-12T11:00:00Z" }
      ],
      timeEntries: [
        { clock_in_at: "2026-09-12T08:00:00Z", clock_out_at: "2026-09-12T16:30:00Z", break_minutes: 30 },
        { clock_in_at: "2026-09-13T08:00:00Z", clock_out_at: null }
      ],
      payments: [
        { created_at: "2026-09-10T12:00:00Z", status: "paid", amount_cents: 12500 },
        { created_at: "2026-09-11T12:00:00Z", status: "pending", amount_cents: 3000 }
      ],
      inventoryItems: [
        { quantity: 2, cost_cents: 500, reorder_level: 3 },
        { quantity: 10, cost_cents: 250, reorder_level: 2 }
      ],
      locationEvents: [
        { event_type: "check_in", captured_at: "2026-09-12T08:01:00Z" },
        { event_type: "position_update", captured_at: "2026-09-12T09:01:00Z" }
      ]
    });

    assert.equal(summary.ok, true);
    assert.equal(summary.bookings.total, 2);
    assert.equal(summary.bookings.completed, 1);
    assert.equal(summary.bookings.noShow, 1);
    assert.equal(summary.bookings.unreadable, 1);
    assert.equal(summary.bookings.averageDurationMinutes, 45);
    assert.equal(summary.labor.minutes, 480);
    assert.equal(summary.labor.hours, 8);
    assert.equal(summary.labor.openEntries, 1);
    assert.equal(summary.payments.collectedCents, 12500);
    assert.equal(summary.payments.otherCount, 1);
    assert.equal(summary.inventory.valueCents, 3500);
    assert.equal(summary.inventory.reorderRiskCount, 1);
    assert.equal(summary.location.checkIns, 1);
    assert.equal(summary.location.routeUpdates, 1);
    assert.equal(summary.coverage.location, "consented_events_only");
  });

  it("refuses an inverted reporting period", () => {
    assert.deepEqual(
      summarizeBusinessOperations({ periodStart: end, periodEnd: start }),
      { ok: false, code: "invalid_period" }
    );
  });
});

describe("privacy-safe mapping", () => {
  it("never upgrades approximate or masked points to precise coordinates", () => {
    const approximate = pointFromEvent({ latitude: 39.9611755, longitude: -82.9987942, privacy_mode: "approximate" });
    const masked = pointFromEvent({ latitude: 39.9611755, longitude: -82.9987942, privacy_mode: "masked" });
    const precise = pointFromEvent({ latitude: 39.9611755, longitude: -82.9987942, privacy_mode: "precise", accuracy_meters: 8 });

    assert.deepEqual(approximate, {
      latitude: 39.96,
      longitude: -83,
      privacyMode: "approximate",
      eventType: "position_update",
      capturedAt: null,
      accuracyMeters: null
    });
    assert.equal(masked.latitude, 40);
    assert.equal(masked.longitude, -83);
    assert.equal(masked.accuracyMeters, null);
    assert.equal(precise.latitude, 39.96118);
    assert.equal(precise.longitude, -82.99879);
    assert.equal(precise.accuracyMeters, 8);
  });

  it("summarizes only valid stored points and states the background-tracking policy", () => {
    const map = buildMapSnapshot([
      { latitude: 39.96, longitude: -83.0, privacy_mode: "precise", captured_at: "2026-09-10T10:00:00Z" },
      { latitude: 39.97, longitude: -82.99, privacy_mode: "precise", captured_at: "2026-09-10T11:00:00Z" },
      { latitude: 500, longitude: 500, privacy_mode: "precise", captured_at: "2026-09-10T12:00:00Z" }
    ]);
    assert.equal(map.pointCount, 2);
    assert.equal(map.unreadable, 1);
    assert.ok(map.distanceMeters > 0);
    assert.equal(map.privacy.backgroundTracking, false);
    assert.equal(map.privacy.precisionNeverUpgraded, true);
  });
});

describe("automation workflow planner", () => {
  it("keeps safe internal work automatic but forces customer messaging behind approval", () => {
    const safe = validateWorkflow({
      name: "Low stock task",
      trigger: "inventory_low",
      autonomy: "safe_automatic",
      steps: [{ action: "create_task" }, { action: "notify_owner" }]
    });
    assert.equal(safe.ok, true);
    assert.equal(safe.workflow.approvalRequired, false);

    const risky = validateWorkflow({
      name: "Waitlist opening",
      trigger: "waitlist_opening",
      autonomy: "safe_automatic",
      steps: [{ action: "prepare_booking_offer" }, { action: "notify_customer" }]
    });
    assert.equal(risky.ok, true);
    assert.equal(risky.workflow.effectiveAutonomy, "approval_required");
    assert.equal(risky.workflow.approvalRequired, true);
    assert.equal(risky.workflow.arbitraryCodeAllowed, false);
  });

  it("rejects arbitrary or unknown actions", () => {
    const result = validateWorkflow({ name: "No code", trigger: "manual", steps: [{ action: "eval_javascript" }] });
    assert.equal(result.ok, false);
    assert.equal(result.code, "unsupported_action");
  });
});

describe("creator music and video workflows", () => {
  it("builds truthful plans and does not pretend provider work is already complete", () => {
    const planned = planMediaWorkflow({
      name: "Social video pack",
      medium: "video",
      steps: ["transcode_video", "caption_video", "generate_thumbnails", "social_export_plan"]
    });
    assert.equal(planned.ok, true);
    assert.equal(planned.plan.externalWorkRequired, true);
    assert.equal(planned.plan.status, "setup_or_worker_required");
    assert.equal(planned.plan.publishesAutomatically, false);
  });

  it("maps only generation-capable steps into existing creator generation job intents", () => {
    const planned = planMediaWorkflow({
      name: "Music video",
      medium: "mixed",
      steps: ["analyze_audio", "render_template", "caption_video", "package_release"]
    });
    assert.equal(planned.ok, true);
    const intents = buildGenerationJobs(planned.plan);
    assert.deepEqual(intents, [{
      capability: "scene_orchestration",
      provider_key: "auto",
      status: "planned",
      parameters: {},
      requires_approval: true
    }]);
    assert.ok(workflowTemplates().length >= 4);
  });
});
