// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const batch = require("../lib/sonara-screenshot-tool-radar-batch26.cjs");
const request = require("supertest");
const app = require("../server");

describe("Batch 26 governed screenshot intake", () => {
  it("has 80 source leads and twenty newly verified, permanently disabled repository records", () => {
    const read = batch.getScreenshotToolReadinessBatch26();
    assert.equal(read.batch, 26);
    assert.equal(read.screenshotCount, 80);
    assert.equal(read.repositoryCount, 20);
    assert.equal(read.verifiedCount, 20);
    assert.equal(read.nonRepositoryReferenceCount, 12);
    assert.equal(read.confirmedExistingRecordCount, 7);
    assert.equal(read.architectureExtensionCount, 7);
    assert.equal(read.productionExecutionCount, 0);
    assert.ok(read.repositories.every((r) => r.canExecute === false && r.enabledInProduction === false && r.humanReviewRequired === true && r.configurationStatus === "cataloged_disabled" && r.runtimeStatus === "not_executed"));
  });
  it("rejects duplicates and requires explicit source/license evidence for every new record", () => {
    const list = batch.getPublicScreenshotToolCatalogBatch26();
    assert.equal(new Set(list.map((r) => r.repository.toLowerCase())).size, list.length);
    for (const r of list) {
      assert.match(r.repository, /^[^/]+\/[^/]+$/);
      assert.equal(r.repoUrl, `https://github.com/${r.repository}`);
      assert.ok(r.sourceEvidence.length >= 2);
      assert.ok(r.safety.length > 0 && r.blockedUses.length > 0 && r.nextStep.length > 20);
    }
    assert.ok(!list.some((r) => /tester-army\/e2e|ruashots\/open-h3-ir/.test(r.repository)));
  });
  it("preserves complex license and safety blockers rather than treating open-source as permission", () => {
    const list = batch.getPublicScreenshotToolCatalogBatch26();
    const by = (key) => list.find((r) => r.key === key);
    assert.match(by("osmantic_ods").license, /Pixel has ODS-only restricted license/);
    assert.match(by("edgeever_knowledge").license, /AGPL-3\.0/);
    assert.equal(by("edgeever_knowledge").reciprocalLicense, true);
    assert.equal(by("null_motion_license_pending").integrationStatus, "reference_only_no_license");
    assert.match(by("null_motion_license_pending").license, /NO LICENSE FILE/);
    assert.match(by("microsoft_autogen_reference").license, /MIT code LICENSE-CODE; CC-BY-4\.0 documentation/);
    assert.match(by("owasp_amass_inventory").blockedUses.join(" "), /scanning arbitrary customers/);
    assert.match(by("yolo_projects_lab").safety.join(" "), /surveillance rights/);
    assert.match(by("anyps5_emulator").blockedUses.join(" "), /copyrighted game assets/);
    assert.equal(list.filter((r) => r.reciprocalLicense).length, 5);
  });
  it("keeps unidentified screenshots unresolved and reconciles already cataloged projects", () => {
    const refs = batch.getNonRepositoryReferencesBatch26();
    const existing = batch.getConfirmedExistingRecordsBatch26();
    assert.ok(refs.some((r) => r.key === "artcraft_claim" && /unverified/.test(r.status)));
    assert.ok(refs.some((r) => r.key === "adscan_directory" && /authorized_security/.test(r.status)));
    assert.ok(existing.some((r) => r.repository === "tester-army/e2e"));
    assert.ok(existing.some((r) => r.repository === "ruashots/open-h3-ir"));
    assert.equal(batch.getScreenshotToolReadinessBatch26().repositories.filter((r) => r.canExecute).length, 0);
  });
  it("publishes clean-room architecture contracts with explicit authority limits", () => {
    const ex = batch.getArchitectureExtensionsBatch26();
    assert.match(ex.find((x) => x.key === "tenant_safe_hybrid_retrieval").implementation, /tenant permission before vector\/lexical/);
    assert.match(ex.find((x) => x.key === "human_governed_agent_repair").implementation, /owner approval before merge/);
    assert.match(ex.find((x) => x.key === "media_worker_job_receipt").implementation, /output checksum/);
  });
  it("catalog consumers receive fresh mutable copies without modifying frozen source records", () => {
    const first = batch.getPublicScreenshotToolCatalogBatch26();
    first[0].productFit.push("injected");
    first[0].safety[0] = "tampered";
    const second = batch.getPublicScreenshotToolCatalogBatch26();
    assert.ok(!second[0].productFit.includes("injected"));
    assert.notEqual(second[0].safety[0], "tampered");
  });
  it("exposes all new records, non-repository references and exact screenshot count through the live catalog API", async () => {
    const response = await request(app)
      .get("/api/ecosystem/requested-repositories")
      .set("Accept", "application/json");
    assert.equal(response.status, 200);
    const keys = new Set(response.body.repositories.map((r) => r.key));
    const records = batch.getPublicScreenshotToolCatalogBatch26();
    assert.equal(records.length, 20);
    for (const record of records) {
      assert.ok(keys.has(record.key), `Batch 26 record missing from published route: ${record.key}`);
      const actual = response.body.repositories.find((r) => r.key === record.key);
      assert.equal(actual.enabledInProduction, false);
      assert.equal(actual.canExecute, false);
    }
    const unverified = new Set(response.body.nonRepositoryReferences.map((r) => r.key));
    for (const record of batch.getNonRepositoryReferencesBatch26()) {
      assert.ok(unverified.has(record.key), `Missing unresolved reference: ${record.key}`);
    }
    assert.ok(response.body.screenshotResearchCount >= 20);
    assert.ok(response.body.confirmedExistingRecords.some((r) => r.key === "existing_h3_batch22"));
    const page = await request(app).get("/research-lab/latest-screenshot-intake");
    assert.equal(page.status, 200);
    assert.match(page.text, /Batch 26|through Batch 26/);
  });

});
