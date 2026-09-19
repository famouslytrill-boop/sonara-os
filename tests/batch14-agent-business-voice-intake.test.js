"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  SCREENSHOT_TOOL_RADAR_BATCH14,
  CONFIRMED_EXISTING_RECORDS_BATCH14,
  NON_REPOSITORY_REFERENCES_BATCH14,
  getScreenshotToolReadinessBatch14
} = require("../lib/sonara-screenshot-tool-radar-batch14.cjs");

describe("Batch 14 agent, browser, voice and business-tool intake", () => {
  const readiness = getScreenshotToolReadinessBatch14();
  const byKey = Object.fromEntries(SCREENSHOT_TOOL_RADAR_BATCH14.map((item) => [item.key, item]));

  it("is a verified non-executing research batch", () => {
    assert.equal(readiness.batch, 14);
    assert.equal(readiness.repositoryCount, 7);
    assert.equal(readiness.verifiedCount, 7);
    assert.equal(readiness.confirmedExistingRecordCount, 2);
    assert.equal(readiness.nonRepositoryReferenceCount, 1);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.enabledInProduction === false));
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
    assert.ok(readiness.repositories.every((item) => item.humanReviewRequired === true));
  });

  it("treats a logged-in browser as delegated authority rather than generic browsing", () => {
    assert.equal(byKey.browser_hand.repository, "verygoodplugins/browser-hand");
    assert.equal(byKey.browser_hand.license, "MIT");
    assert.match(byKey.browser_hand.runtimeClass, /authenticated_browser_bridge/);
    assert.match(byKey.browser_hand.blockedUses.join(" "), /credential harvesting|unapproved purchases|production-secret/i);
    assert.match(byKey.browser_hand.safety.join(" "), /delegated account authority|human approval/i);
  });

  it("keeps security agents inside explicitly authorized lab boundaries", () => {
    assert.equal(byKey.agentic_bug_hunter.repository, "awarexone/Agentic-Bug-Hunter");
    assert.equal(byKey.pentagi.repository, "vxcontrol/pentagi");
    for (const item of [byKey.agentic_bug_hunter, byKey.pentagi]) {
      assert.match(item.placement, /security lab/i);
      assert.match(item.blockedUses.join(" "), /unauthorized/i);
      assert.equal(item.enabledInProduction, false);
    }
    assert.match(byKey.pentagi.license, /SDK.*separate.*review/i);
  });

  it("uses anti-slop as a repository-owned quality-gate reference, not external design authority", () => {
    assert.equal(byKey.anti_slop.repository, "miqdadbadjuber/anti-slop");
    assert.equal(byKey.anti_slop.license, "MIT");
    assert.match(byKey.anti_slop.capabilities.join(" "), /quality locks|PASS\/FAIL/i);
    assert.match(byKey.anti_slop.blockedUses.join(" "), /DESIGN\.md|style verdict/i);
  });

  it("keeps reciprocal device and business suites out of proprietary product paths", () => {
    assert.equal(byKey.librepods.license, "GPL-3.0");
    assert.equal(byKey.librepods.reciprocalLicense, true);
    assert.match(byKey.librepods.blockedUses.join(" "), /GPL implementation|root-only|vendor-ID/i);

    assert.match(byKey.ever_gauzy.license, /AGPL-3\.0/i);
    assert.equal(byKey.ever_gauzy.reciprocalLicense, true);
    assert.match(byKey.ever_gauzy.blockedUses.join(" "), /AGPL implementation|employee surveillance/i);
  });

  it("keeps local second-brain ideas separate from production customer memory", () => {
    assert.equal(byKey.obsidian_second_brain.repository, "eugeniughelbur/obsidian-second-brain");
    assert.equal(byKey.obsidian_second_brain.license, "MIT");
    assert.match(byKey.obsidian_second_brain.blockedUses.join(" "), /production customer memory|cross-tenant/i);
  });

  it("confirms ToolJet and VoxCPM without creating competing governed records", () => {
    assert.equal(CONFIRMED_EXISTING_RECORDS_BATCH14.length, 2);
    const confirmations = Object.fromEntries(CONFIRMED_EXISTING_RECORDS_BATCH14.map((item) => [item.key, item]));
    assert.equal(confirmations.tooljet_existing_formal_registry.agrees, true);
    assert.match(confirmations.tooljet_existing_formal_registry.registerSays, /AGPL-3\.0/);
    assert.equal(confirmations.voxcpm_existing_voice_clone_cluster.agrees, true);
    assert.match(confirmations.voxcpm_existing_voice_clone_cluster.registerSays, /consent|provenance/i);
  });

  it("keeps Google's industrial agentic engineering paper as a non-repository harness reference", () => {
    assert.equal(NON_REPOSITORY_REFERENCES_BATCH14.length, 1);
    const reference = NON_REPOSITORY_REFERENCES_BATCH14[0];
    assert.equal(reference.key, "google_industrial_agentic_engineering_2026");
    assert.equal(Object.hasOwn(reference, "repository"), false);
    assert.match(reference.observedTheme, /specification.*harness.*trajectory.*verification.*meta-debugging/i);
    assert.match(reference.nextStep, /exact-head CI|agent authority|approval receipts/i);
  });

  it("is wired into the convergence engine and research website surfaces", () => {
    const convergence = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-batch-convergence-engine.cjs"), "utf8");
    const routes = fs.readFileSync(path.join(__dirname, "..", "routes", "sonara-requested-repositories-routes.cjs"), "utf8");
    assert.match(convergence, /getScreenshotToolReadinessBatch14/);
    assert.match(convergence, /latestBatch:\s*14/);
    assert.match(routes, /getScreenshotToolReadinessBatch14/);
    assert.match(routes, /getPublicScreenshotToolCatalogBatch14/);
  });
});
