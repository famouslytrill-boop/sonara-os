// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const {
  normalizeActivityEvent,
  activityEventDefinition,
  metricEventTypes
} = require("../lib/sonara-activity-taxonomy.cjs");

describe("activity event taxonomy", () => {
  it("marks only declared milestones as metric eligible", () => {
    assert.equal(activityEventDefinition("account.organization_created").milestone, "workspace_activation");
    assert.equal(activityEventDefinition("creator_studio.output_downloaded").firstValue, true);
    assert.equal(activityEventDefinition("growth_studio.conversion_recorded").firstValue, true);
    assert.equal(activityEventDefinition("business_builder.checklist_updated").metricEligible, false);
    assert.ok(metricEventTypes().includes("billing.purchase_completed"));
  });

  it("keeps known event metadata narrow and adds measurement context", () => {
    const result = normalizeActivityEvent("business_builder.intake_created", {
      intake_request_id: "11111111-1111-4111-8111-111111111111",
      service_interest: "This must not become analytics free text",
      random_field: "also dropped"
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.eventData, {
      intake_request_id: "11111111-1111-4111-8111-111111111111",
      measurement: {
        schema_version: 1,
        product_area: "business_builder",
        milestone: "workflow_started",
        metric_eligible: true,
        first_value: false
      }
    });
  });

  it("refuses sensitive metadata rather than logging it", () => {
    assert.deepEqual(
      normalizeActivityEvent("account.organization_created", { product_path: "business-builder", email: "person@example.com" }),
      { ok: false, code: "sensitive_activity_metadata" }
    );
    assert.deepEqual(
      normalizeActivityEvent("sonara.formula_result_saved", { formula_key: "margin", nested: { api_key: "secret" } }),
      { ok: false, code: "sensitive_activity_metadata" }
    );
  });

  it("records unknown operational events without letting them become metrics", () => {
    const result = normalizeActivityEvent("future.feature_used", { record_id: "abc", password: undefined });
    assert.equal(result.ok, false, "a sensitive-key name is rejected even when its value is undefined");

    const safe = normalizeActivityEvent("future.feature_used", { record_id: "abc" });
    assert.equal(safe.ok, true);
    assert.equal(safe.eventData.measurement.metric_eligible, false);
    assert.equal(safe.eventData.measurement.first_value, false);
    const unregisteredPayload = normalizeActivityEvent("future.feature_used", {
      record_id: "abc",
      note: "customer wrote this free-form note",
      amount: 900
    });
    assert.deepEqual(Object.keys(unregisteredPayload.eventData), ["measurement"]);
    assert.equal(unregisteredPayload.eventData.measurement.metric_eligible, false);
  });

  it("validates count and enum fields for measured outcome events", () => {
    const sent = normalizeActivityEvent("growth_studio.campaign_sent", {
      campaign_id: "22222222-2222-4222-8222-222222222222",
      sent: 21,
      failed: -1,
      skipped: 3
    });
    assert.equal(sent.eventData.sent, 21);
    assert.equal(Object.hasOwn(sent.eventData, "failed"), false);
    assert.equal(sent.eventData.skipped, 3);

    const conversion = normalizeActivityEvent("growth_studio.conversion_recorded", {
      conversion_id: "33333333-3333-4333-8333-333333333333",
      conversion_type: "purchase",
      attribution_model: "last_touch",
      attribution_confidence: "high"
    });
    assert.equal(conversion.eventData.measurement.first_value, true);
    assert.equal(conversion.eventData.attribution_confidence, "high");
  });
});
