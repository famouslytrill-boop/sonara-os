// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assessReleaseGovernance: assess, verifyReleaseGovernance: verify } =
  require("../scripts/verify-production-environment-governance.cjs");

const SHA = "a".repeat(40);
const branch = { name: "main", protected: true, commit: { sha: SHA } };
const environment = {
  name: "production",
  can_admins_bypass: false,
  protection_rules: [{
    type: "required_reviewers",
    prevent_self_review: true,
    reviewers: [{ type: "User", reviewer: { login: "a-reviewer" } }]
  }],
  deployment_branch_policy: { protected_branches: true, custom_branch_policies: false }
};
const base = { branch, environment, exactSha: SHA };

describe("production GitHub governance must be independently enforced", () => {
  it("accepts only a protected exact-head branch and reviewed environment", () => {
    assert.equal(assess(base).ok, true);
    assert.equal(assess(base).code, "production_governance_verified");
    assert.equal(assess({ ...base, branch: { ...branch, protected: false } }).ok, false);
    assert.ok(assess({ ...base, exactSha: "b".repeat(40) }).missing.includes(
      "head_commit_changed_or_unverified"));
    assert.equal(assess({ ...base, branch: { ...branch, name: "feature" } }).ok, false);
  });

  it("rejects missing or illusory human approval and administrative bypass", () => {
    assert.ok(assess({ ...base, environment: { ...environment,
      protection_rules: [] } }).missing.includes("production_required_reviewers_missing"));
    assert.equal(assess({ ...base, environment: { ...environment,
      protection_rules: [{ ...environment.protection_rules[0], reviewers: [] }] } }).ok, false);
    assert.equal(assess({ ...base, environment: { ...environment,
      protection_rules: [{ ...environment.protection_rules[0], prevent_self_review: false }] } }).ok, false);
    assert.ok(assess({ ...base, environment: { ...environment, can_admins_bypass: true } })
      .missing.includes("production_admin_bypass_not_disabled_or_unverified"));
    assert.equal(assess({ ...base, environment: { ...environment, can_admins_bypass: undefined } }).ok, false);
  });

  it("requires the production environment to accept protected branches only", () => {
    assert.equal(assess({ ...base, environment: { ...environment,
      deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }
    } }).ok, false);
    assert.equal(assess({ ...base, environment: {
      ...environment, deployment_branch_policy: null
    } }).ok, false);
  });

  it("refuses missing, incomplete or unverifiable GitHub release context", async () => {
    const missing = await verify({ repo: "famouslytrill-boop/sonara-os", exactSha: SHA, token: "" });
    assert.equal(missing.code, "release_context_missing");
    const down = await verify({
      repo: "famouslytrill-boop/sonara-os", exactSha: SHA, token: "fake",
      get: async () => { throw new Error("do not include credentials in output"); }
    });
    assert.equal(down.code, "github_release_metadata_unavailable");
  });

  it("requires BOTH GitHub read responses and never writes through the GitHub API", async () => {
    const urls = [];
    const result = await verify({
      repo: "famouslytrill-boop/sonara-os", exactSha: SHA, token: "fake",
      get: async (url, init) => {
        urls.push(url);
        assert.equal(init.method, "GET");
        return { ok: true, json: async () => url.endsWith("/branches/main") ? branch : environment };
      }
    });
    assert.equal(result.ok, true);
    assert.deepEqual(urls, [
      "https://api.github.com/repos/famouslytrill-boop/sonara-os/branches/main",
      "https://api.github.com/repos/famouslytrill-boop/sonara-os/environments/production"
    ]);
  });

  it("refuses an unsuccessful environment query without treating it as no review needed", async () => {
    const result = await verify({
      repo: "famouslytrill-boop/sonara-os", exactSha: SHA, token: "fake",
      get: async (url) => url.endsWith("/branches/main")
        ? { ok: true, json: async () => branch } : { ok: false, status: 403 }
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "github_release_metadata_unavailable");
  });

  it("runs the governance check before production credentials and any migrations", () => {
    const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows",
      "controlled-production-deploy.yml"), "utf8");
    const gate = workflow.indexOf("Require approved production environment governance");
    assert.ok(gate > workflow.indexOf("Require exact-SHA post-merge green matrix"));
    assert.ok(gate < workflow.indexOf("Require protected production credentials"));
    assert.ok(gate < workflow.indexOf("Apply production database migrations"));
    assert.match(workflow, /node scripts\/verify-production-environment-governance\.cjs/);
    assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  });
});
