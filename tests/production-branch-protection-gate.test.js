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

  it("reads main governance metadata and runs the fail-closed verifier before matrix evaluation", () => {
    const start = workflow.indexOf("- name: Require exact-SHA post-merge green matrix");
    const end = workflow.indexOf("- uses: pnpm/action-setup@", start);
    assert.ok(start >= 0 && end > start, "release gate must run before package installation");
    const gate = workflow.slice(start, end);

    assert.match(gate, /api\.github\.com\/repos\/\$GITHUB_REPOSITORY\/branches\/main/);
    assert.match(gate, /api\.github\.com\/repos\/\$GITHUB_REPOSITORY\/rules\/branches\/main/);
    assert.match(
      gate,
      /node scripts\/verify-release-branch-governance\.cjs main-branch\.json main main-rules\.json/
    );

    const verifier = gate.indexOf("verify-release-branch-governance.cjs");
    const matrix = gate.indexOf("const states = [];");
    assert.ok(verifier >= 0 && matrix > verifier,
      "branch governance must fail closed before a passing workflow matrix can release");
  });

  it("keeps the production secrets and deploy steps after the branch gate", () => {
    assert.ok(workflow.indexOf("- name: Require exact-SHA post-merge green matrix")
      < workflow.indexOf("- name: Require protected production credentials"));
    assert.ok(workflow.indexOf("- name: Require exact-SHA post-merge green matrix")
      < workflow.indexOf("- uses: supabase/setup-cli@"));
  });
});
