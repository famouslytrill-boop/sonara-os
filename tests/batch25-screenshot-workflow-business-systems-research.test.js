// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const batch = require("../lib/sonara-screenshot-tool-radar-batch25.cjs");

describe("Batch 25 screenshot research", () => {
  it("records all 19 screenshots without granting production execution", () => {
    const readiness = batch.getScreenshotToolReadinessBatch25();

    assert.equal(readiness.batch, 25);
    assert.equal(readiness.screenshotCount, 19);
    assert.equal(readiness.repositoryCount, 1);
    assert.equal(readiness.verifiedCount, 1);
    assert.equal(readiness.confirmedExistingRecordCount, 4);
    assert.equal(readiness.nonRepositoryReferenceCount, 14);
    assert.equal(readiness.architectureExtensionCount, 10);
    assert.equal(readiness.productionExecutionCount, 0);

    assert.ok(readiness.repositories.every((item) => item.configurationStatus === "cataloged_disabled"));
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.enabledInProduction === false));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
    assert.ok(readiness.repositories.every((item) => item.humanReviewRequired === true));
  });

  it("source-verifies headcount and corrects the screenshot's specialist wording", () => {
    const [headcount] = batch.SCREENSHOT_TOOL_RADAR_BATCH25;

    assert.equal(headcount.repository, "cbrock84/headcount");
    assert.equal(headcount.license, "MIT");
    assert.match(headcount.safety.join(" "), /16 departments and 172 skills/i);
    assert.match(headcount.blockedUses.join(" "), /bulk-installing all departments/i);
    assert.match(headcount.nextStep, /routing precision/i);
  });

  it("reconciles already-governed n8n, Munder Difflin, TradingView, and PaddleOCR records", () => {
    assert.deepEqual(
      batch.CONFIRMED_EXISTING_RECORDS_BATCH25.map((item) => item.key),
      [
        "n8n_existing",
        "munder_difflin_existing",
        "tradingview_ai_chart_copilot_existing",
        "paddleocr_existing"
      ]
    );

    const n8n = batch.CONFIRMED_EXISTING_RECORDS_BATCH25.find((item) => item.key === "n8n_existing");
    assert.match(n8n.note, /not activated/i);

    const trading = batch.CONFIRMED_EXISTING_RECORDS_BATCH25.find((item) => item.key === "tradingview_ai_chart_copilot_existing");
    assert.match(trading.note, /No brokerage, investment, or autonomous trading action/i);
  });

  it("keeps health-oriented, educational, and marketing screenshots as bounded references", () => {
    const sensitive = batch.NON_REPOSITORY_REFERENCES_BATCH25.find((item) => item.key === "sensitive_metric_mobile_dashboard_reference");
    const php = batch.NON_REPOSITORY_REFERENCES_BATCH25.find((item) => item.key === "php_fundamentals_learning_reference");
    const monetization = batch.NON_REPOSITORY_REFERENCES_BATCH25.find((item) => item.key === "business_content_prompt_library_reference");

    assert.equal(sensitive.status, "sensitive_domain_ui_reference_only");
    assert.match(sensitive.boundary, /must not infer diagnosis, treatment, or regulated medical capability/i);
    assert.match(php.boundary, /runtime is not changed to PHP/i);
    assert.match(monetization.boundary, /No income guarantee/i);
  });

  it("captures the highest-value control-plane and deterministic workflow patterns", () => {
    const controlPlane = batch.NON_REPOSITORY_REFERENCES_BATCH25.find((item) => item.key === "enterprise_agent_control_plane_reference");
    const workflow = batch.NON_REPOSITORY_REFERENCES_BATCH25.find((item) => item.key === "workflow_from_idea_reference");
    const social = batch.NON_REPOSITORY_REFERENCES_BATCH25.find((item) => item.key === "social_analytics_dashboard_reference");

    assert.equal(controlPlane.status, "architecture_reference_high_value");
    assert.match(controlPlane.sonaraUse, /bounded agent execution/i);
    assert.match(workflow.observedTheme, /guardrails -> human review -> output -> feedback/i);
    assert.match(social.boundary, /Do not fabricate metrics/i);
  });

  it("defines clean-room contracts without silently changing runtime authority", () => {
    const extensions = batch.ARCHITECTURE_EXTENSIONS_BATCH25;

    const trust = extensions.find((item) => item.key === "agent_trust_control_plane_contract");
    const booking = extensions.find((item) => item.key === "rental_inventory_booking_contract");
    const growth = extensions.find((item) => item.key === "growth_social_metric_provenance_contract");
    const specialist = extensions.find((item) => item.key === "department_specialist_agent_contract");

    assert.match(trust.implementation, /identity\/tenant permissions/i);
    assert.match(trust.implementation, /human approval/i);
    assert.match(booking.implementation, /Prevent overlapping confirmed reservations transactionally/i);
    assert.match(growth.implementation, /source timestamp/i);
    assert.match(specialist.implementation, /Reject cycles, conflicting writers/i);
  });
});
