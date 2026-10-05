"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const {
  SCREENSHOT_TOOL_RADAR_BATCH19,
  NON_REPOSITORY_REFERENCES_BATCH19,
  CONFIRMED_EXISTING_RECORDS_BATCH19,
  ARCHITECTURE_EXTENSIONS_BATCH19,
  getScreenshotToolReadinessBatch19
} = require("../lib/sonara-screenshot-tool-radar-batch19.cjs");
const { SKILL_STRATEGIES } = require("../lib/sonara-agent-skill-strategies.cjs");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");

describe("Batch 19 screenshot skill and business research", () => {
  it("records verified repositories with current source evidence and no execution authority", () => {
    const readiness = getScreenshotToolReadinessBatch19();
    assert.equal(readiness.batch, 19);
    assert.equal(readiness.repositoryCount, 17);
    assert.equal(readiness.verifiedCount, 17);
    assert.equal(readiness.nonRepositoryReferenceCount, 15);
    assert.equal(readiness.confirmedExistingRecordCount, 8);
    assert.equal(readiness.architectureExtensionCount, 6);
    assert.equal(readiness.productionExecutionCount, 0);

    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH19.every((item) => item.repositoryVerified));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH19.every((item) => item.sourceEvidence.length >= 2));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH19.every((item) => item.checkedOn === "2026-09-27"));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH19.every((item) => item.configurationStatus === "cataloged_disabled"));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH19.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH19.every((item) => item.enabledInProduction === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH19.every((item) => item.canExecute === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH19.every((item) => item.humanReviewRequired === true));
  });

  it("preserves repository-specific license, data and safety boundaries", () => {
    const byKey = new Map(SCREENSHOT_TOOL_RADAR_BATCH19.map((item) => [item.key, item]));
    assert.match(byKey.get("reactive_resume").sourceCorrection, /moved/i);
    assert.match(byKey.get("openwork").license, /MIT outside ee\//);
    assert.match(byKey.get("openwork").license, /FSL-1\.1-MIT/);
    assert.equal(byKey.get("openwork").reciprocalLicense, false);
    assert.equal(byKey.get("openwork").licenseRisk, "high");
    assert.match(byKey.get("cap_screen_recording").license, /AGPL-3\.0/);
    assert.match(byKey.get("cap_screen_recording").license, /MIT.*crate families/);
    assert.match(byKey.get("openmaic").license, /LGPL-3\.0-or-later/);
    assert.match(byKey.get("qwen_image_resource_catalog").license, /NONE DECLARED/);
    assert.match(byKey.get("qwen_image_resource_catalog").license, /Qwen Research License/);
    assert.equal(byKey.get("qwen_image_resource_catalog").licenseRisk, "high");
    assert.match(byKey.get("microduck_robotics").license, /Apache-2\.0/);
    assert.match(byKey.get("roboflow_trackers").license, /Apache-2\.0/);
    assert.match(byKey.get("rockyvoice_agent_skill").safety.join(" "), /copyrighted fictional character/);
    assert.equal(byKey.get("antigravity_manager").license, "CC-BY-NC-SA-4.0; non-commercial and share-alike terms");
    assert.match(byKey.get("skillware").blockedUses.join(" "), /skill metadata grant/i);
    assert.match(byKey.get("scientific_agent_skills").license, /individual skill licenses vary/i);
    assert.match(byKey.get("gods_eye_view").blockedUses.join(" "), /surveillance/i);
    assert.match(byKey.get("career_ops").blockedUses.join(" "), /hiring/i);
    assert.equal(byKey.get("window_sweaters").license, "GPL-3.0");
  });

  it("keeps ambiguous screenshots unresolved and previously reviewed sources deduplicated", () => {
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH19.every((item) => !Object.hasOwn(item, "repository")));
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH19.every((item) => !Object.hasOwn(item, "license")));
    const references = new Set(NON_REPOSITORY_REFERENCES_BATCH19.map((item) => item.key));
    assert.ok(references.has("unresolved_orca_agent_workspace_owner"));
    assert.ok(references.has("unresolved_omni_voice_studio_owner"));
    assert.ok(references.has("unresolved_deepseek_harness_source"));
    assert.ok(references.has("oracle_always_free_promo"));

    const existing = new Set(CONFIRMED_EXISTING_RECORDS_BATCH19.map((item) => item.repository));
    for (const repository of [
      "tt-a1i/archify",
      "excalidraw/excalidraw",
      "quickemu-project/quickemu",
      "calesthio/OpenMontage",
      "qdrant/qdrant",
      "opencv/opencv",
      "mrdoob/three.js",
      "storybookjs/storybook"
    ]) assert.ok(existing.has(repository), `missing duplicate reconciliation for ${repository}`);
  });

  it("adds agent-skill assurance to the shared strategy catalog without granting authority", () => {
    const strategy = SKILL_STRATEGIES.find((item) => item.key === "reusable_agent_skill_contracts");
    assert.ok(strategy);
    assert.ok(strategy.steps.some((step) => /typed inputs\/outputs/i.test(step)));
    assert.ok(strategy.steps.some((step) => /license/i.test(step)));
    assert.ok(strategy.boundaries.some((boundary) => /never grants/i.test(boundary)));
    assert.equal(strategy.canExecuteFromRecord, false);
    assert.equal(strategy.humanReviewRequired, true);

    const decisions = SKILL_STRATEGIES.find((item) => item.key === "typed_business_decisions");
    assert.ok(decisions);
    assert.ok(decisions.steps.some((step) => /deterministic code/i.test(step)));
    assert.ok(decisions.boundaries.some((boundary) => /not proof/i.test(boundary)));
    assert.ok(decisions.boundaries.some((boundary) => /employment/i.test(boundary)));
  });

  it("includes the new and prior current research batches in platform convergence", () => {
    const convergence = getUnifiedBatchConvergence();
    assert.equal(convergence.latestBatch, 25);
    assert.equal(convergence.latestBatch, 24);
    assert.equal(convergence.counts.batches, convergence.batchSummaries.length);
    assert.ok(convergence.batchSummaries.some((item) => item.batch === 18));
    assert.ok(convergence.batchSummaries.some((item) => item.batch === 19));
    assert.ok(convergence.batchSummaries.some((item) => item.batch === 20));
    assert.ok(convergence.repositories.some((item) => item.repository === "ARPAHLS/skillware" && item.seenInBatches.includes(19)));
    assert.equal(convergence.counts.productionExecutionAdded, 0);
  });

  it("publishes Batch 19 records and architecture only through governed non-executing routes", async () => {
    const catalog = await request(app).get("/api/ecosystem/requested-repositories").set("Accept", "application/json");
    assert.equal(catalog.status, 200);
    const repositories = new Set(catalog.body.repositories.map((item) => item.key));
    for (const item of SCREENSHOT_TOOL_RADAR_BATCH19) assert.ok(repositories.has(item.key), item.key);

    const refs = new Set(catalog.body.nonRepositoryReferences.map((item) => item.key));
    for (const item of NON_REPOSITORY_REFERENCES_BATCH19) assert.ok(refs.has(item.key), item.key);

    const intake = await request(app).get("/research-lab/latest-screenshot-intake");
    assert.equal(intake.status, 200);
    assert.match(intake.text, /skill contract and assurance/i);
    assert.match(intake.text, /0 latest-intake repositories are enabled/i);

    const strategies = await request(app).get("/api/ecosystem/agent-skill-strategies").set("Accept", "application/json");
    assert.equal(strategies.status, 200);
    assert.ok(strategies.body.strategies.some((item) => item.key === "reusable_agent_skill_contracts"));
    assert.ok(strategies.body.strategies.some((item) => item.key === "typed_business_decisions"));
    assert.ok(ARCHITECTURE_EXTENSIONS_BATCH19.some((item) => item.key === "public_data_provenance_and_uncertainty"));
  });
});
