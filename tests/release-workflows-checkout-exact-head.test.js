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

function workflowSteps(source) {
  const lines = source.split("\n");
  const steps = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)-\s+(?:name:|uses:)/);
    if (!match) continue;
    const indent = match[1].length;
    let end = index + 1;
    while (end < lines.length) {
      const sibling = lines[end].match(/^(\s*)-\s+/);
      if (sibling && sibling[1].length === indent) break;
      end += 1;
    }
    steps.push(lines.slice(index, end).join("\n"));
    index = end - 1;
  }
  return steps;
}

function checkoutSteps(source) {
  return workflowSteps(source).filter((step) => /uses:\s*actions\/checkout@/.test(step));
}

describe("release workflows test the commit they approve", () => {
  for (const filename of WORKFLOWS) {
    it(`${filename} checks out the pull request head, not GitHub's synthetic merge commit`, () => {
      const source = fs.readFileSync(path.join(ROOT, ".github", "workflows", filename), "utf8");
      const windows = checkoutSteps(source);
      assert.ok(windows.length > 0, `${filename} has no actions/checkout step`);

      const primary = windows.filter((block) => !/\n\s*repository:\s*\S+/.test(block));
      assert.ok(primary.length > 0, `${filename} has no first-party checkout step`);

      for (const block of primary) {
        assert.ok(
          block.includes(EXACT_REF),
          `${filename} has a first-party checkout that can test the pull-request merge ref instead of the exact head SHA`
        );
      }

      const misplaced = workflowSteps(source).filter(
        (step) => step.includes(EXACT_REF) && !/uses:\s*actions\/checkout@/.test(step)
      );
      assert.deepEqual(
        misplaced,
        [],
        `${filename} attaches the exact-head ref to a non-checkout action`
      );
    });
  }

  it("records evidence against the checked-out commit rather than pull-request merge GITHUB_SHA", () => {
    const engineering = fs.readFileSync(
      path.join(ROOT, ".github", "workflows", "engineering-intelligence-security.yml"),
      "utf8"
    );
    assert.doesNotMatch(engineering, /--commit-sha "\$\{GITHUB_SHA\}"/);
    assert.doesNotMatch(engineering, /--commit "\$\{GITHUB_SHA\}"/);
    assert.match(engineering, /exact_head="\$\(git rev-parse HEAD\)"/);

    const scans = fs.readFileSync(
      path.join(ROOT, ".github", "workflows", "open-source-security-scans.yml"),
      "utf8"
    );
    assert.doesNotMatch(scans, /exactHead:\s*process\.env\.GITHUB_SHA/);
    assert.match(scans, /EXACT_HEAD="\$\(git rev-parse HEAD\)"/);

    const replay = fs.readFileSync(
      path.join(ROOT, ".github", "workflows", "native-migration-replay.yml"),
      "utf8"
    );
    assert.match(
      replay,
      /native-migration-replay-node-\$\{\{ matrix\.node \}\}-postgres-\$\{\{ matrix\.postgres \}\}-\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/
    );
  });

  it("does not mistake separately pinned tool repositories for SONARA checkouts", () => {
    const source = fs.readFileSync(
      path.join(ROOT, ".github", "workflows", "engineering-intelligence-security.yml"),
      "utf8"
    );
    const external = checkoutSteps(source).find((block) => /repository:\s*tt-a1i\/archify/.test(block));
    assert.ok(external, "the pinned Archify checkout disappeared");
    assert.match(external, /ref:\s*a07fa1d5b2a10cbea110c5a2be2817397a301cdc/);
    assert.doesNotMatch(external, /github\.event\.pull_request\.head\.sha/);
  });
});
