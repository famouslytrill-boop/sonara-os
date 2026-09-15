"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SCREENSHOT_TOOL_RADAR_BATCH7,
  NON_REPOSITORY_REFERENCES_BATCH7,
  getScreenshotToolReadinessBatch7
} = require("../lib/sonara-screenshot-tool-radar-batch7.cjs");
const {
  CAPABILITY_BATCH8,
  DESIGN_BATCH9,
  getCapabilityDesignReadiness
} = require("../lib/sonara-capability-design-batches.cjs");

describe("seventh screenshot tool research batch", () => {
  it("keeps every supplied repository non-executing and human-reviewed", () => {
    const readiness = getScreenshotToolReadinessBatch7();
    assert.equal(readiness.repositoryCount, SCREENSHOT_TOOL_RADAR_BATCH7.length);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.enabledInProduction === false));
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
    assert.ok(readiness.repositories.every((item) => item.humanReviewRequired));
  });

  it("retains explicit boundaries for sensitive and reciprocal-license projects", () => {
    for (const key of ["hackagent", "rengine", "torbot", "hiring_agent", "fleetbase", "gpty"]) {
      const item = SCREENSHOT_TOOL_RADAR_BATCH7.find((candidate) => candidate.key === key);
      assert.ok(item, `missing ${key}`);
      assert.match(item.blockedUses.join(" "), /unauthorized|consequential|production execution/i);
      assert.equal(item.enabledInProduction, false);
    }
    for (const key of ["fluxer", "convertx", "gpty", "rengine", "torbot"]) {
      const item = SCREENSHOT_TOOL_RADAR_BATCH7.find((candidate) => candidate.key === key);
      assert.match(item.license, /AGPL|GPL/);
      assert.equal(item.integrationStatus, "research_only");
    }
  });

  it("keeps screenshot claims without authoritative upstreams out of the executable repository list", () => {
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH7.length >= 15);
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH7.every((item) => !Object.hasOwn(item, "repository")));
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH7.every((item) => item.safety.length > 0));
  });

  it("wires Batches 5 through 7 into the aggregate catalog and counts", () => {
    const route = fs.readFileSync(path.join(__dirname, "../routes/sonara-requested-repositories-routes.cjs"), "utf8");
    for (const batch of [5, 6, 7]) {
      assert.match(route, new RegExp(`getScreenshotToolReadinessBatch${batch}`));
      assert.match(route, new RegExp(`screenshotBatch${batch}\\.repositories`));
      assert.match(route, new RegExp(`screenshotBatch${batch}\\.repositoryCount`));
    }
    assert.match(route, /getNonRepositoryReferencesBatch7/);
  });
});

describe("Batch 8 capability truth and Batch 9 design convergence", () => {
  it("keeps the follow-on batches descriptive rather than executable", () => {
    const readiness = getCapabilityDesignReadiness();
    assert.equal(readiness.batch8Count, CAPABILITY_BATCH8.length);
    assert.equal(readiness.batch9Count, DESIGN_BATCH9.length);
    assert.equal(readiness.productionExecutionAdded, 0);
    assert.equal(CAPABILITY_BATCH8.length, 8);
    assert.equal(DESIGN_BATCH9.length, 8);
    assert.ok(CAPABILITY_BATCH8.every((item) => item.enabledByThisBatch === false));
    assert.ok(CAPABILITY_BATCH8.every((item) => item.canExecuteFromThisRecord === false));
    assert.ok(DESIGN_BATCH9.every((item) => item.enabledByThisBatch === false));
    assert.ok(DESIGN_BATCH9.every((item) => item.canExecuteFromThisRecord === false));
  });

  it("gives every capability claim source evidence and a runtime boundary", () => {
    const keys = CAPABILITY_BATCH8.map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const item of CAPABILITY_BATCH8) {
      assert.ok(item.capabilities.length > 0, `${item.key} has no capability claim`);
      assert.ok(item.evidence.length > 0, `${item.key} has no evidence`);
      assert.ok(item.boundaries.length > 0, `${item.key} has no boundary`);
      assert.ok(item.humanReviewRequired, `${item.key} is missing human review`);
    }

    assert.equal(CAPABILITY_BATCH8.find((item) => item.key === "sonara_one_platform")?.capabilityStatus, "available_core");
    assert.equal(CAPABILITY_BATCH8.find((item) => item.key === "business_builder_operations")?.capabilityStatus, "available_with_setup");
    assert.equal(CAPABILITY_BATCH8.find((item) => item.key === "creator_studio_production")?.capabilityStatus, "available_with_setup");
    assert.equal(CAPABILITY_BATCH8.find((item) => item.key === "growth_studio_campaigns")?.capabilityStatus, "available_with_setup");
  });

  it("does not turn Claude or ChatGPT compatibility into provider authority", () => {
    const claude = CAPABILITY_BATCH8.find((item) => item.key === "claude_skill_workflow");
    const chatgpt = CAPABILITY_BATCH8.find((item) => item.key === "chatgpt_plugin_workflow");
    assert.equal(claude.externalStatus, "compatible_workflow_not_customer_runtime");
    assert.equal(chatgpt.externalStatus, "not_connected_by_this_batch");
    assert.match(claude.boundaries.join(" "), /cannot bypass release gates|broader authority/i);
    assert.match(chatgpt.boundaries.join(" "), /not packaged.*production ChatGPT plugin|authorization/i);
    assert.match(chatgpt.boundaries.join(" "), /providerCalled=false/i);
  });

  it("makes the current v3 identity authoritative and leaves known correctness work visible", () => {
    const keys = DESIGN_BATCH9.map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
    const identity = DESIGN_BATCH9.find((item) => item.key === "v3_identity_authority");
    const booking = DESIGN_BATCH9.find((item) => item.key === "booking_calendar_revision_sequence");
    assert.equal(identity.status, "active");
    assert.match(identity.rule, /SONARA One.*v3/i);
    assert.match(identity.rule, /legacy Prism Wave.*compatibility/i);
    assert.equal(booking.status, "fix_required");
    assert.match(booking.rule, /monotonically advance.*SEQUENCE/i);
    assert.match(booking.rule, /does not identify a writer/i);
  });

  it("wires capability/design convergence into founder readiness without inflating repository counts", () => {
    const route = fs.readFileSync(path.join(__dirname, "../routes/sonara-requested-repositories-routes.cjs"), "utf8");
    assert.match(route, /getCapabilityDesignReadiness/);
    assert.match(route, /capabilityBatch8: convergence\.capabilities/);
    assert.match(route, /designBatch9: convergence\.designs/);
    assert.match(route, /convergenceProductionExecutionAdded: convergence\.productionExecutionAdded/);
    assert.doesNotMatch(route, /screenshotResearchCount[^\n]+were verified/i);
  });
});
