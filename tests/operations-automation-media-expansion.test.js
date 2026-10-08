"use strict";

const assert = require("node:assert/strict");
const { summarizeBusinessOperations } = require("../lib/sonara-business-analytics.cjs");
const { buildMapSnapshot, pointFromEvent } = require("../lib/sonara-location-map.cjs");
const { INDUSTRY_PACKS, templates: businessTemplates, validateWorkflow } = require("../lib/sonara-workflow-planner.cjs");
const registerOperationsExpansionRoutes = require("../routes/sonara-operations-expansion-routes.cjs");
const { planMediaWorkflow, buildGenerationJobs, workflowTemplates } = require("../lib/sonara-creator-media-workflows.cjs");

describe("operations analytics", () => {
  const start = "2026-09-01T00:00:00.000Z";
  const end = "2026-10-01T00:00:00.000Z";

  it("calculates bookings labor money received inventory and consented location events without inventing unreadable values", () => {
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
      // Money from where the product records it, in two currencies, with a
      // dispute and a payment whose invoice currency could not be read.
      invoicePayments: [
        { received_on: "2026-09-10", amount_cents: 12500, currency: "usd" },
        { received_on: "2026-09-11", amount_cents: 3000, currency: "gbp" },
        { received_on: "2026-09-11", amount_cents: 999, currency: null }
      ],
      shopOrders: [
        { paid_at: "2026-09-12T12:00:00Z", payment_state: "paid", amount_paid_cents: 4000, refunded_cents: 0, currency: "usd" },
        { paid_at: "2026-09-12T13:00:00Z", payment_state: "refunded", amount_paid_cents: 2000, refunded_cents: 500, currency: "gbp" },
        { paid_at: "2026-09-12T14:00:00Z", payment_state: "disputed", amount_paid_cents: 7000, refunded_cents: 0, currency: "usd" },
        { paid_at: null, payment_state: "unpaid", amount_paid_cents: null, currency: "usd" }
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
    // Per currency and never summed across them: there is no exchange rate here.
    assert.deepEqual(summary.money.byCurrency, [
      { currency: "gbp", invoiceCents: 3000, invoicePayments: 1, shopNetCents: 1500, shopOrders: 1, totalCents: 4500 },
      { currency: "usd", invoiceCents: 12500, invoicePayments: 1, shopNetCents: 4000, shopOrders: 1, totalCents: 16500 }
    ]);
    assert.equal(summary.money.disputedShopOrders, 1, "a disputed order was counted as received");
    assert.equal(summary.money.unreadable, 1, "a payment with no currency was guessed into a total");
    assert.equal(summary.payments, undefined, "the summary still reports the table nothing writes");
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


describe("cross-industry workflow templates", () => {
  it("covers all 17 requested operating sectors without duplicate keys", () => {
    const expected = [
      "restaurant", "food_truck", "trades", "trucking", "cleaning", "retail",
      "rentals", "venues", "manufacturing", "real_estate", "professional_services",
      "delivery", "salon", "ecommerce", "nonprofit", "construction", "facilities"
    ];
    assert.deepEqual(INDUSTRY_PACKS.map((pack) => pack.industry).sort(), expected.sort());
    const every = businessTemplates();
    assert.equal(new Set(every.map((pack) => pack.key)).size, every.length);
    assert.ok(every.length >= INDUSTRY_PACKS.length + 2);
  });

  it("uses the real shared workflow validator for every industry, not a fake executable workflow", () => {
    for (const pack of INDUSTRY_PACKS) {
      assert.equal(pack.launchState, "template_only", pack.key);
      assert.ok(pack.requiredRecords.length, pack.key);
      assert.ok(pack.disclosure.length > 15, pack.key);
      const validated = validateWorkflow(pack);
      assert.equal(validated.ok, true, pack.key);
      assert.equal(validated.workflow.arbitraryCodeAllowed, false, pack.key);
      assert.ok(validated.workflow.steps.every((step) => step.action && step.approval), pack.key);
      const listed = businessTemplates().find((row) => row.key === pack.key);
      assert.equal(listed.valid, true, pack.key);
      assert.equal(listed.approvalRequired, validated.workflow.approvalRequired, pack.key);
      assert.equal(listed.product, "business_builder", pack.key);
    }
  });

  it("enforces per-workflow owner approval for customer contact and leaves automatic tasks internally scoped", () => {
    const customerContact = INDUSTRY_PACKS.filter((pack) =>
      pack.steps.some((step) => ["notify_customer", "enqueue_email"].includes(step.action)));
    assert.ok(customerContact.length >= 4);
    for (const pack of customerContact) {
      assert.equal(validateWorkflow(pack).workflow.effectiveAutonomy, "approval_required", pack.key);
      assert.equal(validateWorkflow({ ...pack, autonomy: "safe_automatic" }).workflow.approvalRequired, true, pack.key);
    }
    const rest = INDUSTRY_PACKS.filter((pack) => !customerContact.includes(pack));
    for (const pack of rest) {
      assert.equal(validateWorkflow(pack).workflow.approvalRequired, false, pack.key);
      assert.ok(pack.steps.every((step) => !["charge_payment", "mutate_booking", "sync_provider"].includes(step.action)));
    }
  });

  it("serves cross-industry templates through the existing authenticated Business Builder API", () => {
    const gets = new Map();
    const app = {
      get(path, ...handlers) { gets.set(path, handlers); },
      post() {}
    };
    const ownerGate = (_req, _res, next) => next();
    registerOperationsExpansionRoutes(app, {
      requireBusinessManager: ownerGate,
      getCustomerPrimaryOrganization: async () => ({ ok: false }),
      getSupabaseServerConfig: () => ({ ok: false }),
      supabaseHeaders: () => ({}),
      layout: () => "",
      linkAction: () => "",
      escapeHtml: (value) => String(value)
    });
    const handlers = gets.get("/api/business/automations/templates");
    assert.equal(handlers[0], ownerGate, "the route must still require an authorized business manager");
    let response;
    handlers[1]({}, {
      status(status) { assert.equal(status, 200); return this; },
      json(body) { response = body; return this; }
    });
    assert.ok(response.ok);
    assert.equal(response.arbitraryCodeAllowed, false);
    assert.equal(response.templates.filter((pack) => pack.launchState === "template_only").length, 17);
    assert.equal(response.templates.every((pack) => pack.valid === true), true);
  });

  it("rejects invented actions, arbitrary code, and extra steps even for industry templates", () => {
    const sample = INDUSTRY_PACKS[0];
    assert.equal(validateWorkflow({ ...sample, steps: [{ action: "pay_vendor" }] }).code, "unsupported_action");
    assert.equal(validateWorkflow({ ...sample, steps: [{ action: "run_shell_command" }] }).code, "unsupported_action");
    const risky = validateWorkflow({ ...sample, autonomy: "safe_automatic",
      steps: [{ action: "charge_payment", config: { approval: "safe_automatic", amount: 1 } }] });
    assert.equal(risky.ok, true);
    assert.equal(risky.workflow.approvalRequired, true);
    assert.equal(risky.workflow.arbitraryCodeAllowed, false);
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
