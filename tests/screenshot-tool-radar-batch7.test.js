"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SCREENSHOT_TOOL_RADAR_BATCH7,
  NON_REPOSITORY_REFERENCES_BATCH7,
  getScreenshotToolReadinessBatch7
} = require("../lib/sonara-screenshot-tool-radar-batch7.cjs");

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
