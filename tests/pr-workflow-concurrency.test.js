"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PR_SUPERSESSION_WORKFLOWS = [
  "android-twa-packaging.yml",
  "action-pin-runtime-health.yml",
  "external-repository-health.yml",
  "native-migration-replay.yml",
  "node-runtime-compatibility.yml",
  "dependency-scan.yml",
  "docker-image.yml",
  "sonara-industries-ci.yml",
  "diagnose-generation-release-gates.yml"
];

describe("pull-request verification workflow concurrency", () => {
  it("cancels superseded work only within the same verification workflow and pull request", () => {
    for (const name of PR_SUPERSESSION_WORKFLOWS) {
      const source = fs.readFileSync(path.join(ROOT, ".github", "workflows", name), "utf8");
      assert.match(
        source,
        /group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.run_id \}\}/,
        `${name} does not isolate concurrency by workflow and PR`
      );
      assert.match(
        source,
        /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/,
        `${name} can no longer cancel only superseded PR verification`
      );
    }
  });

  it("does not apply PR supersession cancellation to the real production deploy", () => {
    const source = fs.readFileSync(
      path.join(ROOT, ".github", "workflows", "controlled-production-deploy.yml"),
      "utf8"
    );
    assert.match(source, /group: sonara-controlled-production/);
    assert.match(source, /cancel-in-progress: false/);
    assert.doesNotMatch(source, /github\.event\.pull_request\.number/);
  });
});
