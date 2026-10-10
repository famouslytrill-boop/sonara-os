"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const WORKFLOWS = [
  "event-consumer-readiness.yml",
  "open-source-security-scans.yml",
  "lighthouse-quality.yml",
  "engineering-intelligence-security.yml",
  "controlled-production-deploy-dry-run.yml",
  "sonara-industries-ci.yml",
  "diagnose-generation-release-gates.yml",
  "browser-quality.yml",
  "native-migration-replay.yml",
  "docker-image.yml",
  "dependency-scan.yml",
  "node-runtime-compatibility.yml",
  "sonara-validation.yml",
  "reliability-performance-smoke.yml"
];
const EXACT_REF = "ref: ${{ github.event.pull_request.head.sha || github.sha }}";

function checkoutWindows(source) {
  const lines = source.split("\n");
  const windows = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/uses:\s*actions\/checkout@/.test(lines[index])) continue;
    windows.push(lines.slice(index, index + 9).join("\n"));
  }
  return windows;
}

describe("release workflows test the commit they approve", () => {
  for (const filename of WORKFLOWS) {
    it(`${filename} checks out the pull request head, not GitHub's synthetic merge commit`, () => {
      const source = fs.readFileSync(path.join(ROOT, ".github", "workflows", filename), "utf8");
      const windows = checkoutWindows(source);
      assert.ok(windows.length > 0, `${filename} has no actions/checkout step`);

      const primary = windows.filter((block) => !/\n\s*repository:\s*\S+/.test(block));
      assert.ok(primary.length > 0, `${filename} has no first-party checkout step`);

      for (const block of primary) {
        assert.ok(
          block.includes(EXACT_REF),
          `${filename} has a first-party checkout that can test the pull-request merge ref instead of the exact head SHA`
        );
      }
    });
  }

  it("does not mistake separately pinned tool repositories for SONARA checkouts", () => {
    const source = fs.readFileSync(
      path.join(ROOT, ".github", "workflows", "engineering-intelligence-security.yml"),
      "utf8"
    );
    const external = checkoutWindows(source).find((block) => /repository:\s*tt-a1i\/archify/.test(block));
    assert.ok(external, "the pinned Archify checkout disappeared");
    assert.match(external, /ref:\s*a07fa1d5b2a10cbea110c5a2be2817397a301cdc/);
    assert.doesNotMatch(external, /github\.event\.pull_request\.head\.sha/);
  });
});
