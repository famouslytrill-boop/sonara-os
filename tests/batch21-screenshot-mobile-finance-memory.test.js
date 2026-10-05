// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const {
  SCREENSHOT_TOOL_RADAR_BATCH21,
  NON_REPOSITORY_REFERENCES_BATCH21,
  CONFIRMED_EXISTING_RECORDS_BATCH21,
  DEDUPLICATED_REFERENCES_BATCH21,
  ARCHITECTURE_EXTENSIONS_BATCH21,
  getScreenshotToolReadinessBatch21
} = require("../lib/sonara-screenshot-tool-radar-batch21.cjs");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");

describe("Batch 21 screenshot research and integration", () => {
  it("records every verified repository as disabled and non-executing", () => {
    const readiness = getScreenshotToolReadinessBatch21();
    assert.equal(readiness.batch, 21);
    assert.equal(readiness.repositoryCount, 5);
    assert.equal(readiness.verifiedCount, 5);
    assert.equal(readiness.nonRepositoryReferenceCount, 16);
    assert.equal(readiness.confirmedExistingRecordCount, 3);
    assert.equal(readiness.deduplicatedReferenceCount, 2);
    assert.equal(readiness.architectureExtensionCount, 6);
    assert.equal(readiness.productionExecutionCount, 0);

    for (const item of SCREENSHOT_TOOL_RADAR_BATCH21) {
      assert.ok(item.sourceEvidence.length >= 3, item.key);
      assert.equal(item.checkedOn, "2026-09-30", item.key);
      assert.equal(item.configurationStatus, "cataloged_disabled", item.key);
      assert.equal(item.runtimeStatus, "not_executed", item.key);
      assert.equal(item.enabledInProduction, false, item.key);
      assert.equal(item.canExecute, false, item.key);
      assert.equal(item.humanReviewRequired, true, item.key);
    }
  });

  it("preserves license absence and contradictions shown by primary sources", () => {
    const readiness = getScreenshotToolReadinessBatch21();
    const records = new Map(SCREENSHOT_TOOL_RADAR_BATCH21.map((item) => [item.repository, item]));
    assert.match(records.get("Paymenter/Paymenter").license, /MIT/);
    assert.ok(records.get("Paymenter/Paymenter").sourceEvidence.some((url) => url.endsWith("/SECURITY.md")));
    assert.match(records.get("1j01/jspaint").license, /LICENSE\.txt/);
    assert.match(records.get("1j01/jspaint").blockedUses.join(" "), /Microsoft Paint branding/);
    assert.match(records.get("ossu/computer-science").license, /linked courseware.*own terms/);

    for (const repository of [
      "AgentsLoop/awesome-opus-5.5-games",
      "slowmist/Blockchain-dark-forest-selfguard-handbook"
    ]) {
      const item = records.get(repository);
      assert.match(item.license, /NONE DECLARED/);
      assert.equal(item.licenseRisk, "high");
      assert.equal(item.integrationStatus, "reference_only_no_license");
    }

    assert.match(records.get("AgentsLoop/awesome-opus-5.5-games").safety.join(" "), /843.*570.*872.*598.*300/);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH21.every((item) => !Object.hasOwn(item, "repository")));
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH21.every((item) => !Object.hasOwn(item, "license")));
  });

  it("reconciles existing repositories and repeated screenshot frames", () => {
    assert.deepEqual(
      new Set(CONFIRMED_EXISTING_RECORDS_BATCH21.map((item) => item.repository)),
      new Set([
        "KevinXu02/aha-3d",
        "mustafakendiguzel/claude-code-ui-agents",
        "kaankiziltug/logo-design-skill"
      ])
    );
    assert.equal(DEDUPLICATED_REFERENCES_BATCH21.length, 2);
    assert.match(DEDUPLICATED_REFERENCES_BATCH21.map((item) => item.label).join(" "), /Claude business-operator.*Second screenshot frame/);
  });

  it("defines source-backed operational contracts without turning mockups into live capability", () => {
    const byKey = new Map(ARCHITECTURE_EXTENSIONS_BATCH21.map((item) => [item.key, item]));
    assert.match(byKey.get("ledger_backed_financial_dashboard_contract").implementation, /reconciled/);
    assert.match(byKey.get("agent_memory_provenance_and_forgetting_contract").implementation, /deletion across derived indexes/);
    assert.match(byKey.get("email_triage_approval_and_durability_contract").implementation, /require preview and approval before send/);
    assert.match(byKey.get("operator_dashboard_metric_evidence_contract").implementation, /never seed promotional example totals/);
    assert.match(byKey.get("developer_command_cheatsheet_safety_contract").implementation, /exact head/);
  });

  it("publishes the batch to the Research Lab, founder readiness, and convergence", async () => {
    const catalog = await request(app)
      .get("/api/ecosystem/requested-repositories")
      .set("Accept", "application/json");
    assert.equal(catalog.status, 200);
    const repositoryKeys = new Set(catalog.body.repositories.map((item) => item.key));
    for (const record of SCREENSHOT_TOOL_RADAR_BATCH21) assert.ok(repositoryKeys.has(record.key), record.key);

    const referenceKeys = new Set(catalog.body.nonRepositoryReferences.map((item) => item.key));
    for (const record of NON_REPOSITORY_REFERENCES_BATCH21) assert.ok(referenceKeys.has(record.key), record.key);

    const confirmations = new Set(catalog.body.confirmedExistingRecords.map((item) => item.key));
    for (const record of CONFIRMED_EXISTING_RECORDS_BATCH21) assert.ok(confirmations.has(record.key), record.key);

    const latest = await request(app).get("/research-lab/latest-screenshot-intake");
    assert.equal(latest.status, 200);
    assert.match(latest.text, /through Batch 23/i);
    assert.match(latest.text, /0 latest-intake repositories are enabled/i);

    const readiness = await request(app)
      .get("/api/admin/requested-repositories/readiness")
      .set("Accept", "application/json");
    // The operator readiness endpoint was removed on 1 October 2026, so 404 is
    // the expected answer and the body block below no longer runs. Kept as an
    // absence assertion rather than dropped.
    assert.ok([200, 401, 404, 503].includes(readiness.status));
    assert.notEqual(readiness.status, 200, "the removed operator readiness endpoint answered an unauthenticated caller");
    if (readiness.status === 200) {
      assert.equal(readiness.body.productionExecutionCount, 0);
      assert.ok(readiness.body.repositories.some((item) => item.key === "paymenter_hosting_billing"));
    }

    const convergence = getUnifiedBatchConvergence();
    assert.equal(convergence.latestBatch, 25);
    assert.ok(convergence.batchSummaries.some((item) => item.batch === 21 && item.repositoryRecords === 5));
    assert.ok(convergence.repositories.some((item) => item.repository === "1j01/jspaint" && item.seenInBatches.includes(21)));
    assert.equal(convergence.counts.productionExecutionAdded, 0);
  });
});
