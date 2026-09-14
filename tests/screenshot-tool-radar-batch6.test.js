"use strict";

const assert = require("node:assert/strict");
const {
  SCREENSHOT_TOOL_RADAR_BATCH6,
  NON_REPOSITORY_REFERENCES_BATCH6,
  getPublicScreenshotToolCatalogBatch6,
  getScreenshotToolReadinessBatch6
} = require("../lib/sonara-screenshot-tool-radar-batch6.cjs");

const EXPECTED_KEYS = [
  "social_analyzer",
  "maybe_finance",
  "recordly",
  "aio_usb_drive",
  "i_have_adhd",
  "android_mic",
  "clash_verge_rev",
  "trading_agents",
  "diagram_design"
];

describe("sixth screenshot tool research batch", () => {
  it("catalogs every verified repository without enabling execution", () => {
    assert.deepEqual(SCREENSHOT_TOOL_RADAR_BATCH6.map((item) => item.key), EXPECTED_KEYS);
    assert.equal(SCREENSHOT_TOOL_RADAR_BATCH6.length, 9);
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH6.every((item) => item.repositoryVerified));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH6.every((item) => item.enabledInProduction === false));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH6.every((item) => item.humanReviewRequired));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH6.every((item) => item.safety.length > 0));
    assert.ok(SCREENSHOT_TOOL_RADAR_BATCH6.every((item) => item.nextStep));
  });

  it("keeps hosted OSINT outside the repository catalog", () => {
    assert.equal(NON_REPOSITORY_REFERENCES_BATCH6.length, 1);
    const revealer = NON_REPOSITORY_REFERENCES_BATCH6[0];
    assert.equal(revealer.key, "revealer_us_service_reference");
    assert.equal(revealer.status, "verified_hosted_service_reference");
    assert.ok(!Object.hasOwn(revealer, "repository"));
    assert.match(revealer.safety.join(" "), /No general people-search feature/i);
  });

  it("privacy-gates Social Analyzer and prohibits high-impact person profiling", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH6.find((candidate) => candidate.key === "social_analyzer");
    assert.equal(item.license, "AGPL-3.0");
    assert.equal(item.integrationStatus, "research_only");
    assert.match(item.blockedUses.join(" "), /unconsented person tracking/i);
    assert.match(item.blockedUses.join(" "), /high-impact eligibility decisions/i);
  });

  it("keeps TradingAgents research-only and disconnected from execution", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH6.find((candidate) => candidate.key === "trading_agents");
    assert.equal(item.license, "Apache-2.0");
    assert.equal(item.integrationStatus, "research_only");
    assert.match(item.blockedUses.join(" "), /live order execution/i);
    assert.match(item.blockedUses.join(" "), /brokerage credential handling/i);
  });

  it("does not infer Recordly redistribution rights from the screenshot badge", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH6.find((candidate) => candidate.key === "recordly");
    assert.equal(item.integrationStatus, "needs_license_review");
    assert.match(item.license, /NOASSERTION/i);
    assert.match(item.safety.join(" "), /authoritative license terms/i);
  });

  it("treats the ADHD-oriented skill strictly as an opt-in output preference", () => {
    const item = SCREENSHOT_TOOL_RADAR_BATCH6.find((candidate) => candidate.key === "i_have_adhd");
    assert.equal(item.integrationStatus, "optional_adapter_after_review");
    assert.match(item.blockedUses.join(" "), /diagnosing ADHD/i);
    assert.match(item.safety.join(" "), /user-selectable communication preference/i);
  });

  it("publishes only disabled readiness state", () => {
    const catalog = getPublicScreenshotToolCatalogBatch6();
    const readiness = getScreenshotToolReadinessBatch6();
    assert.equal(catalog.length, 9);
    assert.equal(readiness.repositoryCount, 9);
    assert.equal(readiness.nonRepositoryReferenceCount, 1);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
  });
});
