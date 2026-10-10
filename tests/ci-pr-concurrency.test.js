"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const FILES = [
  "sonara-industries-ci.yml",
  "native-migration-replay.yml",
  "node-runtime-compatibility.yml",
  "dependency-scan.yml",
  "docker-image.yml",
  "diagnose-generation-release-gates.yml"
];
describe("PR CI concurrency controls", () => {
  for (const filename of FILES) {
    it(filename + " supersedes only the same workflow and PR", () => {
      const source = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", filename), "utf8");
      assert.equal((source.match(/^concurrency:$/gm) || []).length, 1);
      assert.equal((source.match(/^jobs:$/gm) || []).length, 1);
      assert.ok(source.split("\n").includes(
        "  group: \${{ github.workflow }}-\${{ github.event.pull_request.number || github.run_id }}"));
      assert.ok(source.split("\n").includes(
        "  cancel-in-progress: \${{ github.event_name == 'pull_request' }}"));
      assert.ok(source.indexOf("\nconcurrency:") < source.indexOf("\njobs:"));
    });
  }
});