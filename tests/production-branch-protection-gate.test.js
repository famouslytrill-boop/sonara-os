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

  it("keeps production secrets out of job scope and exposes them only to named steps", () => {
    const dryRun = fs.readFileSync(
      path.join(__dirname, "..", ".github", "workflows", "controlled-production-deploy-dry-run.yml"),
      "utf8"
    );

    for (const [label, source] of [["production", workflow], ["dry-run", dryRun]]) {
      const jobs = source.indexOf("jobs:");
      const steps = source.indexOf("\n    steps:", jobs);
      assert.ok(jobs >= 0 && steps > jobs, `${label} workflow must have a job and steps`);
      const jobHeader = source.slice(jobs, steps);
      assert.doesNotMatch(
        jobHeader,
        /\$\{\{\s*secrets\./,
        `${label} job-level env must not expose production secrets to every action`
      );
    }

    assert.match(workflow, /- name: Verify production project identity[\s\S]*?SUPABASE_ACCESS_TOKEN: \$\{\{ secrets\.SUPABASE_ACCESS_TOKEN \}\}/);
    assert.match(workflow, /- name: Deploy validated source to Vercel production[\s\S]*?VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
    assert.match(dryRun, /- name: Link and preview production database migrations[\s\S]*?SUPABASE_DB_PASSWORD: \$\{\{ secrets\.SUPABASE_DB_PASSWORD \}\}/);
    assert.match(dryRun, /- name: Pull production environment for read-only configuration verification[\s\S]*?VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  });

  it("never exposes production secrets to the pull-request dry-run job", () => {
    const dryRun = fs.readFileSync(
      path.join(__dirname, "..", ".github", "workflows", "controlled-production-deploy-dry-run.yml"),
      "utf8"
    );
    const liveStart = dryRun.indexOf("production-readonly-verification:");
    assert.ok(liveStart > 0, "trusted main-only production verification job must exist");

    const candidate = dryRun.slice(0, liveStart);
    const live = dryRun.slice(liveStart);
    assert.doesNotMatch(candidate, /\$\{\{\s*secrets\./);
    assert.doesNotMatch(candidate, /environment:\s*production/);
    assert.match(candidate, /name:\s*production-deploy-dry-run/);

    assert.match(live, /github\.event_name == 'workflow_dispatch'/);
    assert.match(live, /github\.ref == 'refs\/heads\/main'/);
    assert.match(live, /environment:\s*production/);
    assert.match(live, /SUPABASE_ACCESS_TOKEN:\s*\$\{\{ secrets\.SUPABASE_ACCESS_TOKEN \}\}/);
    assert.match(live, /VERCEL_TOKEN:\s*\$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  });

  it("keeps the production secrets and deploy steps after the branch gate", () => {
    assert.ok(workflow.indexOf("- name: Require exact-SHA post-merge green matrix")
      < workflow.indexOf("- name: Require protected production credentials"));
    assert.ok(workflow.indexOf("- name: Require exact-SHA post-merge green matrix")
      < workflow.indexOf("- uses: supabase/setup-cli@"));
  });
});
