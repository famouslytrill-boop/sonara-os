"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const { readOpenSourceTools } = require("../lib/sonara-open-source-registry.cjs");

const {
  SCREENSHOT_TOOL_RADAR_BATCH18,
  NON_REPOSITORY_REFERENCES_BATCH18,
  CONFIRMED_EXISTING_RECORDS_BATCH18,
  ARCHITECTURE_EXTENSIONS_BATCH18,
  getScreenshotToolReadinessBatch18
} = require("../lib/sonara-screenshot-tool-radar-batch18.cjs");

describe("Batch 18 screenshot agent/infrastructure convergence", () => {
  it("records five verified repositories as non-executing research", () => {
    const readiness = getScreenshotToolReadinessBatch18();
    assert.equal(readiness.batch, 18);
    assert.equal(readiness.repositoryCount, 5);
    assert.equal(readiness.verifiedCount, 5);
    assert.equal(readiness.nonRepositoryReferenceCount, 10);
    assert.equal(readiness.confirmedExistingRecordCount, 2);
    assert.equal(readiness.architectureExtensionCount, 10);
    assert.equal(readiness.productionExecutionCount, 0);

    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH18.every((item) => item.repositoryVerified === true));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH18.every((item) => item.enabledInProduction === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH18.every((item) => item.canExecute === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH18.every((item) => item.humanReviewRequired === true));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH18.every((item) => item.safety.length > 0));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH18.every((item) => item.blockedUses.length > 0));
  });

  it("preserves upstream licence and placement boundaries", () => {
    const byKey = new Map(SCREENSHOT_TOOL_RADAR_BATCH18.map((item) => [item.key, item]));

    assert.equal(byKey.get("nanobot").license, "MIT");
    assert.equal(byKey.get("seekdb").license, "Apache-2.0");
    assert.equal(byKey.get("floci").license, "MIT");
    assert.match(byKey.get("weknora").license, /^MIT/);
    assert.equal(byKey.get("openexecutive").license, "Apache-2.0");

    assert.match(byKey.get("seekdb").placement, /production authority/i);
    assert.match(byKey.get("floci").placement, /never production/i);
    assert.match(byKey.get("openexecutive").blockedUses.join(" "), /self-approve/i);
  });

  it("does not duplicate OpenShorts or Twenty", () => {
    assert.deepEqual(
      CONFIRMED_EXISTING_RECORDS_BATCH18.map((item) => item.repository),
      ["mutonby/openshorts", "twentyhq/twenty"]
    );
    assert.ok(!SCREENSHOT_TOOL_RADAR_BATCH18.some((item) => item.repository === "mutonby/openshorts"));
    assert.ok(!SCREENSHOT_TOOL_RADAR_BATCH18.some((item) => item.repository === "twentyhq/twenty"));
  });

  it("reconciles Twenty's verified mixed licence without treating its AGPL core as permissive", () => {
    const twenty = readOpenSourceTools().find((item) => item.slug === "twenty-crm-open-salesforce-alternative");
    assert.ok(twenty);
    assert.equal(twenty.commercialUseStatus, "allowed_after_review");
    assert.equal(twenty.integrationStatus, "optional_adapter_after_review");
    assert.equal(twenty.reciprocalLicense, true);
    assert.match(twenty.license, /AGPL-3\.0/);
    assert.match(twenty.license, /Enterprise-marked files/i);
    assert.match(twenty.license, /Application Exception/i);
    assert.match(twenty.category.join(" "), /AGPL application exception|published API\/SDK integration/i);
    assert.match(twenty.notes, /published Application Interfaces/i);
    assert.match(twenty.safetyBoundaries.join(" "), /AGPL-covered Twenty core/i);
  });

  it("treats social diagrams and official design articles as references, not executable sources", () => {
    assert.equal(NON_REPOSITORY_REFERENCES_BATCH18.length, 10);
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH18.every((item) => !Object.hasOwn(item, "repository")));
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH18.every((item) => !Object.hasOwn(item, "license")));
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH18.some((item) => item.key === "meta_muse_product_design"));
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH18.some((item) => item.key === "gpt6_astra_infographic"));
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH18.some((item) => item.key === "platform_system_design_cards"));
  });

  it("publishes bounded production-agent architecture contracts", () => {
    assert.equal(ARCHITECTURE_EXTENSIONS_BATCH18.length, 10);
    const keys = new Set(ARCHITECTURE_EXTENSIONS_BATCH18.map((item) => item.key));
    for (const key of [
      "agent_topology_selection_contract",
      "independent_verifier_gate",
      "production_agent_loop_contract",
      "grounded_rag_quality_contract",
      "agent_memory_state_contract",
      "model_gateway_control_contract",
      "workflow_durability_contract",
      "agent_observability_eval_contract",
      "personal_agent_progressive_authority",
      "local_first_execution_boundary"
    ]) {
      assert.ok(keys.has(key), "missing architecture extension: " + key);
    }
  });

  it("exposes every Batch 18 repository and reference through the governed catalog", async () => {
    const response = await request(app)
      .get("/api/ecosystem/requested-repositories")
      .set("Accept", "application/json");

    assert.equal(response.status, 200);
    const repoKeys = new Set(response.body.repositories.map((item) => item.key));
    for (const item of SCREENSHOT_TOOL_RADAR_BATCH18) {
      assert.ok(repoKeys.has(item.key), "missing Batch 18 repository: " + item.key);
    }

    const refKeys = new Set(response.body.nonRepositoryReferences.map((item) => item.key));
    for (const item of NON_REPOSITORY_REFERENCES_BATCH18) {
      assert.ok(refKeys.has(item.key), "missing Batch 18 reference: " + item.key);
    }

    const confirmed = new Set(response.body.confirmedExistingRecords.map((item) => item.key));
    for (const item of CONFIRMED_EXISTING_RECORDS_BATCH18) {
      assert.ok(confirmed.has(item.key), "missing Batch 18 confirmed record: " + item.key);
    }
  });

  it("keeps research records from granting runtime authority", async () => {
    const response = await request(app)
      .get("/api/ecosystem/readiness")
      .set("Accept", "application/json");

    assert.equal(response.status, 200);
    for (const key of ["nanobot", "seekdb", "floci", "weknora", "openexecutive"]) {
      const item = response.body.repositories.find((record) => record.key === key);
      assert.ok(item, "missing readiness record: " + key);
      assert.equal(item.enabledInProduction, false);
      assert.equal(item.canExecute, false);
      assert.equal(item.humanReviewRequired, true);
    }
  });
});
