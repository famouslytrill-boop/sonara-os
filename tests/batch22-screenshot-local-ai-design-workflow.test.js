// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const batch = require("../lib/sonara-screenshot-tool-radar-batch22.cjs");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");

describe("Batch 22 screenshot research", () => {
  it("records the five identified upstreams as disabled and non-executing", () => {
    const readiness = batch.getScreenshotToolReadinessBatch22();
    assert.equal(readiness.batch, 22);
    assert.equal(readiness.screenshotCount, 30);
    assert.equal(readiness.repositoryCount, 5);
    assert.equal(readiness.verifiedCount, 5);
    assert.equal(readiness.nonRepositoryReferenceCount, 23);
    assert.equal(readiness.architectureExtensionCount, 6);
    assert.equal(readiness.productionExecutionCount, 0);
    for (const record of readiness.repositories) {
      assert.ok(record.sourceEvidence.length >= 3, record.key);
      assert.equal(record.configurationStatus, "cataloged_disabled", record.key);
      assert.equal(record.runtimeStatus, "not_executed", record.key);
      assert.equal(record.enabledInProduction, false, record.key);
      assert.equal(record.canExecute, false, record.key);
      assert.equal(record.humanReviewRequired, true, record.key);
    }
    const h3 = readiness.repositories.find((record) => record.key === "ruashots_open_h3_ir");
    assert.match(h3.license, /United States/);
    const agentglass = readiness.repositories.find((record) => record.key === "sirallap_agentglass_local_agent_console");
    assert.match(agentglass.license, /CC BY 4\.0/);
  });

  it("publishes the batch in catalog, public research page and convergence", async () => {
    const catalog = await request(app).get("/api/ecosystem/requested-repositories").set("Accept", "application/json");
    assert.equal(catalog.status, 200);
    const keys = new Set(catalog.body.repositories.map((record) => record.key));
    for (const record of batch.SCREENSHOT_TOOL_RADAR_BATCH22) assert.ok(keys.has(record.key), record.key);
    const refs = new Set(catalog.body.nonRepositoryReferences.map((record) => record.key));
    for (const record of batch.NON_REPOSITORY_REFERENCES_BATCH22) assert.ok(refs.has(record.key), record.key);
    assert.equal(catalog.body.repositories.filter((record) => record.enabledInProduction).length, 0);
    const latest = await request(app).get("/research-lab/latest-screenshot-intake");
    assert.equal(latest.status, 200);
    assert.match(latest.text, /through Batch 22/i);
    const convergence = getUnifiedBatchConvergence();
    assert.equal(convergence.latestBatch, 22);
    assert.ok(convergence.batchSummaries.some((item) => item.batch === 22 && item.repositoryRecords === 5));
    assert.equal(convergence.counts.productionExecutionAdded, 0);
  });
});
