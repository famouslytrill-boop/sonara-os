// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");
const {
  SCREENSHOT_TOOL_RADAR_BATCH20,
  NON_REPOSITORY_REFERENCES_BATCH20,
  CONFIRMED_EXISTING_RECORDS_BATCH20,
  ARCHITECTURE_EXTENSIONS_BATCH20,
  getScreenshotToolReadinessBatch20
} = require("../lib/sonara-screenshot-tool-radar-batch20.cjs");
const { SKILL_STRATEGIES } = require("../lib/sonara-agent-skill-strategies.cjs");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");

describe("Batch 20 screenshot research and workflow integration", () => {
  it("records source-checked repositories as disabled, non-executing research", () => {
    const readiness = getScreenshotToolReadinessBatch20();
    assert.equal(readiness.batch, 20);
    assert.equal(readiness.repositoryCount, 5);
    assert.equal(readiness.verifiedCount, 5);
    assert.equal(readiness.nonRepositoryReferenceCount, 15);
    assert.equal(readiness.confirmedExistingRecordCount, 8);
    assert.equal(readiness.architectureExtensionCount, 9);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH20.every((item) => item.sourceEvidence.length >= 3));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH20.every((item) => item.checkedOn === "2026-09-28"));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH20.every((item) => item.configurationStatus === "cataloged_disabled"));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH20.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH20.every((item) => item.enabledInProduction === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH20.every((item) => item.canExecute === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH20.every((item) => item.humanReviewRequired === true));
  });

  it("preserves individual license, model, media and trademark boundaries", () => {
    const records = new Map(SCREENSHOT_TOOL_RADAR_BATCH20.map((item) => [item.key, item]));
    assert.match(records.get("aha_3d_real2sim").license, /Apache-2\.0/);
    assert.match(records.get("aha_3d_real2sim").license, /separate terms/);
    assert.match(records.get("frontend_ui_design_agents").license, /MIT/);
    assert.match(records.get("strata_local_inference").license, /MIT.*separate licenses/);
    assert.match(records.get("invokeai_creative_engine").license, /Apache-2\.0.*model-specific/);
    assert.match(records.get("logo_design_skill_reference").license, /trademarks.*excluded/);
    assert.match(records.get("logo_design_skill_reference").blockedUses.join(" "), /copying or tracing/);
    assert.match(records.get("invokeai_creative_engine").safety.join(" "), /latest version/);
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH20.every((item) => !Object.hasOwn(item, "repository")));
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH20.every((item) => !Object.hasOwn(item, "license")));
  });

  it("reconciles repeat screenshots and keeps ambiguous sources unresolved", () => {
    const repositories = new Set(CONFIRMED_EXISTING_RECORDS_BATCH20.map((item) => item.repository));
    for (const repository of [
      "paperless-ngx/paperless-ngx",
      "remotion-dev/remotion",
      "CristianOlivera1/openvid",
      "tt-a1i/archify",
      "calesthio/OpenMontage",
      "saragordic/window-sweaters",
      "bilawalsidhu/gods-eye-view",
      "reactive-resume/reactive-resume"
    ]) assert.ok(repositories.has(repository), `missing duplicate reconciliation for ${repository}`);
    const references = new Map(NON_REPOSITORY_REFERENCES_BATCH20.map((item) => [item.key, item]));
    assert.match(references.get("wolfcut_video_editor_owner_resolution").status, /unresolved/);
    assert.match(references.get("engineering_skills_and_reverse_skill_shortlist").status, /unresolved/);
    assert.match(references.get("agentic_framework_star_shortlist").reason, /not evidence of fit/);
  });

  it("adds bounded product-workflow guidance to the shared agent strategy", () => {
    const strategy = SKILL_STRATEGIES.find((item) => item.key === "governed_product_workflow_design");
    assert.ok(strategy);
    assert.ok(strategy.steps.some((step) => /route.*data owner/i.test(step)));
    assert.ok(strategy.steps.some((step) => /idempotency/i.test(step)));
    assert.ok(strategy.steps.some((step) => /formula.*paused/i.test(step)));
    assert.ok(strategy.boundaries.some((boundary) => /diagram or screenshot is not/i.test(boundary)));
    assert.equal(strategy.canExecuteFromRecord, false);
    assert.equal(strategy.humanReviewRequired, true);

    const skillPath = path.join(__dirname, "../.claude/skills/designing-governed-product-workflows/SKILL.md");
    const skill = fs.readFileSync(skillPath, "utf8");
    assert.match(skill, /Map the complete path/);
    assert.match(skill, /Formula processing remains paused/);
    assert.match(skill, /idempotency key/);
    assert.match(skill, /loading/i);
    assert.match(skill, /empty/i);
    assert.match(skill, /error/i);
    assert.match(skill, /retry/i);
  });

  it("reaches Research Lab, founder readiness, and batch convergence without execution", async () => {
    const catalog = await request(app).get("/api/ecosystem/requested-repositories").set("Accept", "application/json");
    assert.equal(catalog.status, 200);
    const repositoryKeys = new Set(catalog.body.repositories.map((item) => item.key));
    for (const record of SCREENSHOT_TOOL_RADAR_BATCH20) assert.ok(repositoryKeys.has(record.key), record.key);
    const referenceKeys = new Set(catalog.body.nonRepositoryReferences.map((item) => item.key));
    for (const record of NON_REPOSITORY_REFERENCES_BATCH20) assert.ok(referenceKeys.has(record.key), record.key);
    const confirmedKeys = new Set(catalog.body.confirmedExistingRecords.map((item) => item.key));
    for (const record of CONFIRMED_EXISTING_RECORDS_BATCH20) assert.ok(confirmedKeys.has(record.key), record.key);
    assert.ok(catalog.body.screenshotResearchCount >= SCREENSHOT_TOOL_RADAR_BATCH20.length);

    const latest = await request(app).get("/research-lab/latest-screenshot-intake");
    assert.equal(latest.status, 200);
    assert.match(latest.text, /through Batch 22/i);
    assert.match(latest.text, /Formula processing remains paused/i);
    assert.match(latest.text, /0 latest-intake repositories are enabled/i);
    for (const extension of ARCHITECTURE_EXTENSIONS_BATCH20) assert.match(latest.text, new RegExp(extension.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

    const readiness = await request(app).get("/api/admin/requested-repositories/readiness").set("Accept", "application/json");
    assert.ok([200, 401, 503].includes(readiness.status));
    if (readiness.status === 200) {
      assert.ok(readiness.body.repositories.some((item) => item.key === "strata_local_inference"));
      assert.equal(readiness.body.productionExecutionCount, 0);
    }

    const strategies = await request(app).get("/api/ecosystem/agent-skill-strategies").set("Accept", "application/json");
    assert.equal(strategies.status, 200);
    assert.ok(strategies.body.strategies.some((item) => item.key === "governed_product_workflow_design"));

    const convergence = getUnifiedBatchConvergence();
    assert.equal(convergence.latestBatch, 22);
    assert.ok(convergence.batchSummaries.some((item) => item.batch === 20 && item.repositoryRecords === 5));
    assert.ok(convergence.repositories.some((item) => item.repository === "invoke-ai/InvokeAI" && item.seenInBatches.includes(20)));
    assert.equal(convergence.counts.productionExecutionAdded, 0);
  });
});
