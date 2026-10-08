"use strict";

// Regression: a passing workflow matrix must not release from an unprotected
// main branch. GitHub branch/ruleset administration is an owner-controlled
// setting; production must fail closed until that enforcement is observable.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("production release rejects unprotected main", () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, "..", ".github", "workflows", "controlled-production-deploy.yml"),
    "utf8"
  );

  it("reads main branch metadata and denies unprotected state", () => {
    const start = workflow.indexOf("- name: Require exact-SHA post-merge green matrix");
    const end = workflow.indexOf("- uses: pnpm/action-setup@", start);
    assert.ok(start >= 0 && end > start, "release gate must run before package installation");
    const gate = workflow.slice(start, end);
    assert.match(gate, /api\.github\.com\/repos\/\$GITHUB_REPOSITORY\/branches\/main/);
    assert.match(gate, /main\?\.protected\s*!==\s*true/);
    assert.match(gate, /Production release blocked: main has no enforced GitHub branch protection/);
    const branchCheck = gate.indexOf("main?.protected !== true");
    const failure = gate.indexOf("process.exit(3);", branchCheck);
    const matrix = gate.indexOf("const states = [];", branchCheck);
    assert.ok(branchCheck >= 0 && failure > branchCheck && matrix > failure,
      "unprotected branch must fail before a passing matrix can release");
  });

  it("keeps the production secrets and deploy steps after the branch gate", () => {
    assert.ok(workflow.indexOf("- name: Require exact-SHA post-merge green matrix")
      < workflow.indexOf("- name: Require protected production credentials"));
    assert.ok(workflow.indexOf("- name: Require exact-SHA post-merge green matrix")
      < workflow.indexOf("- uses: supabase/setup-cli@"));
  });
});

describe("required CI can attest merge-queue SHA without losing main evidence", () => {
  const required = [
    "sonara-industries-ci.yml",
    "native-migration-replay.yml",
    "node-runtime-compatibility.yml",
    "docker-image.yml",
    "engineering-intelligence-security.yml",
    "dependency-scan.yml"
  ];
  for (const file of required) {
    it(file + " triggers in a merge queue and cancels only superseded PR runs", () => {
      const yaml = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", file), "utf8");
      assert.match(yaml, /\n  merge_group:\n    types: \[checks_requested\]\n    branches: \[main\]/);
      assert.match(yaml, /\n  pull_request:/, "pull request checks must still run");
      assert.match(yaml, /\nconcurrency:\n/);
      assert.ok(yaml.includes("github.event.pull_request.number || github.run_id"),
        "main, manual and merge-group runs need unique non-PR concurrency groups");
      assert.ok(yaml.includes("cancel-in-progress: " + "$" + "{{ github.event_name == 'pull_request' }}"),
        "never cancel an independent main or merge-group attestation");
      assert.doesNotMatch(yaml, /cancel-in-progress:\s*true\b/,
        "unconditional cancellation can erase exact-main-SHA evidence");
    });
  }
});
