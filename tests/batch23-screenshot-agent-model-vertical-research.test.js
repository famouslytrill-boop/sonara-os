// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const batch = require("../lib/sonara-screenshot-tool-radar-batch23.cjs");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");

describe("Batch 23 screenshot research", () => {
  it("records all 54 screenshots without granting execution authority", () => {
    const readiness = batch.getScreenshotToolReadinessBatch23();
    assert.equal(readiness.batch, 23);
    assert.equal(readiness.screenshotCount, 54);
    assert.equal(readiness.repositoryCount, 7);
    assert.equal(readiness.verifiedCount, 7);
    assert.equal(readiness.nonRepositoryReferenceCount, 19);
    assert.equal(readiness.confirmedExistingRecordCount, 5);
    assert.equal(readiness.architectureExtensionCount, 9);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.repositoryVerified));
    assert.ok(readiness.repositories.every((item) => item.configurationStatus === "cataloged_disabled"));
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.enabledInProduction === false));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
    assert.ok(readiness.repositories.every((item) => item.humanReviewRequired === true));
  });

  it("records the seven source-verified repositories with bounded placement", () => {
    assert.deepEqual(
      batch.SCREENSHOT_TOOL_RADAR_BATCH23.map((item) => item.repository),
      [
        "tester-army/e2e",
        "mobile-next/mobile-mcp",
        "walkinglabs/learn-harness-engineering",
        "sevenevesai/riso-windowseat",
        "vectorize-io/hindsight",
        "CopilotKit/OpenDots",
        "ys-ll/uniterm"
      ]
    );

    const e2e = batch.SCREENSHOT_TOOL_RADAR_BATCH23.find((item) => item.key === "tester_army_e2e");
    assert.equal(e2e.license, "Apache-2.0");
    assert.match(e2e.placement, /Playwright/i);
    assert.match(e2e.blockedUses.join(" "), /production customer accounts/i);

    const mobile = batch.SCREENSHOT_TOOL_RADAR_BATCH23.find((item) => item.key === "mobile_next_mobile_mcp");
    assert.equal(mobile.license, "Apache-2.0");
    assert.match(mobile.integrationStatus, /security_review_required/i);
    assert.match(mobile.blockedUses.join(" "), /customer-device control/i);

    const harness = batch.SCREENSHOT_TOOL_RADAR_BATCH23.find((item) => item.key === "walkinglabs_learn_harness_engineering");
    assert.equal(harness.license, "MIT");
    assert.match(harness.integrationStatus, /curated_reference/i);

    const riso = batch.SCREENSHOT_TOOL_RADAR_BATCH23.find((item) => item.key === "sevenevesai_riso_windowseat");
    assert.match(riso.license, /MIT/i);
    assert.match(riso.safety.join(" "), /embedded sounds|images|typefaces|source footage/i);

    const hindsight = batch.SCREENSHOT_TOOL_RADAR_BATCH23.find((item) => item.key === "vectorize_io_hindsight");
    assert.equal(hindsight.license, "MIT");
    assert.match(hindsight.blockedUses.join(" "), /cross-tenant memory/i);

    const openDots = batch.SCREENSHOT_TOOL_RADAR_BATCH23.find((item) => item.key === "copilotkit_opendots");
    assert.match(openDots.license, /MIT/i);
    assert.match(openDots.blockedUses.join(" "), /parallel agent operating system/i);

    const uniterm = batch.SCREENSHOT_TOOL_RADAR_BATCH23.find((item) => item.key === "ys_ll_uniterm");
    assert.match(uniterm.license, /Apache-2.0/i);
    assert.match(uniterm.blockedUses.join(" "), /unattended production shell access/i);
  });

  it("reconciles already-governed model and voice resources rather than duplicating them", () => {
    const keys = batch.CONFIRMED_EXISTING_RECORDS_BATCH23.map((item) => item.key);
    assert.deepEqual(keys, [
      "voicestudio_existing",
      "qwen_image_21_existing",
      "whisper_large_v3_turbo_existing",
      "kokoro_82m_existing",
      "flux1_schnell_existing"
    ]);
  });

  it("keeps model-hub screenshots as research metadata rather than a bulk runtime registry", () => {
    const references = batch.NON_REPOSITORY_REFERENCES_BATCH23;
    const blocked = references.find((item) => item.key === "hf_uncensored_abliterated_nsfw_and_face_swap");
    const spaces = references.find((item) => item.key === "hf_spaces_media_workflows");
    const datasets = references.find((item) => item.key === "hf_datasets_batch23");

    assert.equal(blocked.status, "blocked_from_runtime_research_only");
    assert.match(blocked.nextStep, /Do not route, download, fine-tune, host or promote/i);
    assert.match(spaces.reason, /different licenses/i);
    assert.match(datasets.nextStep, /Do not ingest/i);
  });

  it("publishes Batch 23 through the Research Lab and convergence without widening authority", async () => {
    const catalog = await request(app).get("/api/ecosystem/requested-repositories");
    assert.equal(catalog.status, 200);
    assert.ok(catalog.body.repositories.some((item) => item.repository === "tester-army/e2e"));
    assert.ok(catalog.body.repositories.some((item) => item.repository === "mobile-next/mobile-mcp"));
    assert.equal(catalog.body.repositories.filter((item) => item.enabledInProduction).length, 0);

    const latest = await request(app).get("/research-lab/latest-screenshot-intake");
    assert.equal(latest.status, 200);
    assert.match(latest.text, /through Batch 24/i);
    assert.match(latest.text, /0 latest-intake repositories are enabled/i);

    const convergence = getUnifiedBatchConvergence();
    assert.equal(convergence.latestBatch, 25);
    assert.equal(convergence.latestBatch, 24);
    assert.ok(convergence.batchSummaries.some((item) => item.batch === 23 && item.repositoryRecords === 7));
    assert.ok(convergence.repositories.some((item) => item.repository === "tester-army/e2e" && item.seenInBatches.includes(23)));
    assert.equal(convergence.counts.productionExecutionAdded, 0);
  });

  it("preserves the explicit research-to-runtime promotion gate", () => {
    const extensions = batch.ARCHITECTURE_EXTENSIONS_BATCH23;
    const modelGate = extensions.find((item) => item.key === "model_hub_promotion_gate");
    const mobileGate = extensions.find((item) => item.key === "mobile_device_automation_boundary");
    const remoteGate = extensions.find((item) => item.key === "privileged_remote_operations_contract");

    assert.match(modelGate.implementation, /exact upstream\/model card/i);
    assert.match(modelGate.implementation, /tenant-safe canary/i);
    assert.match(mobileGate.implementation, /dedicated simulators\/emulators or test devices/i);
    assert.match(remoteGate.implementation, /just-in-time scoped credentials/i);
  });
});
