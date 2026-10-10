// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MINIMUM_REQUIRED_CHECKS, assessReleaseGovernance: assess, verifyReleaseGovernance: verify } =
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
const branchRules = [
  { type: "pull_request", parameters: {
    required_approving_review_count: 1,
    dismiss_stale_reviews_on_push: true,
    require_last_push_approval: true,
    required_review_thread_resolution: true
  } },
  { type: "non_fast_forward" },
  { type: "deletion" },
  { type: "required_status_checks", parameters: {
    strict_required_status_checks_policy: true,
    required_status_checks: MINIMUM_REQUIRED_CHECKS.map(context => ({ context }))
  } }
];
const base = { branch, environment, branchRules, exactSha: SHA };

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

  it("refuses protection labels without active enforceable PR reviews and immutable branch rules", () => {
    const withoutRules = assess({ ...base, branchRules: undefined });
    assert.ok(withoutRules.missing.includes("active_main_rules_unverified"));
    assert.equal(assess({ ...base, branchRules: [] }).ok, false);
    assert.ok(assess({ ...base, branchRules: branchRules.filter(r => r.type !== "pull_request") })
      .missing.includes("independent_main_pr_review_unverified"));
    const weakReview = { ...branchRules[0],
      parameters: { ...branchRules[0].parameters, required_approving_review_count: 0 } };
    assert.ok(assess({ ...base, branchRules: [weakReview, ...branchRules.slice(1)] })
      .missing.includes("independent_main_pr_review_unverified"));
    const noLastPush = { ...branchRules[0],
      parameters: { ...branchRules[0].parameters, require_last_push_approval: false } };
    assert.equal(assess({ ...base, branchRules: [noLastPush, ...branchRules.slice(1)] }).ok, false);
    const noFreshReview = { ...branchRules[0],
      parameters: { ...branchRules[0].parameters, dismiss_stale_reviews_on_push: false } };
    assert.equal(assess({ ...base, branchRules: [noFreshReview, ...branchRules.slice(1)] }).ok, false);
    assert.ok(assess({ ...base, branchRules: branchRules.filter(r => r.type !== "non_fast_forward") })
      .missing.includes("main_force_push_protection_unverified"));
    assert.ok(assess({ ...base, branchRules: branchRules.filter(r => r.type !== "deletion") })
      .missing.includes("main_deletion_protection_unverified"));
  });

  it("requires strict exact-head checks with established check-run context names", () => {
    const checks = branchRules[3];
    for (const context of MINIMUM_REQUIRED_CHECKS) {
      const result = assess({ ...base, branchRules: [
        ...branchRules.slice(0, 3),
        { ...checks, parameters: {
          ...checks.parameters,
          required_status_checks: checks.parameters.required_status_checks
            .filter(check => check.context !== context)
        } }
      ] });
      assert.ok(result.missing.includes("required_check_missing:" + context));
    }
    assert.equal(assess({ ...base, branchRules: [
      ...branchRules.slice(0, 3),
      { ...checks, parameters: { ...checks.parameters,
        strict_required_status_checks_policy: false } }
    ] }).ok, false);
    assert.equal(assess({ ...base, branchRules: [
      ...branchRules.slice(0, 3), { type: "required_status_checks", parameters: {} }
    ] }).ok, false);
    assert.equal(assess({ ...base, branchRules: [
      ...branchRules.slice(0, 3), { type: "required_status_checks", parameters: {
        strict_required_status_checks_policy: true,
        required_status_checks: [{ context: "SONARA Industries CI" }]
      } }
    ] }).ok, false);
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

  it("requires all three GitHub read responses and never writes through the GitHub API", async () => {
    const urls = [];
    const result = await verify({
      repo: "famouslytrill-boop/sonara-os", exactSha: SHA, token: "fake",
      get: async (url, init) => {
        urls.push(url);
        assert.equal(init.method, "GET");
        return { ok: true, json: async () =>
          url.endsWith("/branches/main") ? branch :
          url.includes("/rules/branches/main") ? branchRules : environment };
      }
    });
    assert.equal(result.ok, true);
    assert.deepEqual(urls, [
      "https://api.github.com/repos/famouslytrill-boop/sonara-os/branches/main",
      "https://api.github.com/repos/famouslytrill-boop/sonara-os/rules/branches/main?per_page=100",
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

  it("refuses unavailable effective branch rules instead of trusting protected=true", async () => {
    const result = await verify({
      repo: "famouslytrill-boop/sonara-os", exactSha: SHA, token: "fake",
      get: async url => url.endsWith("/branches/main")
        ? { ok: true, json: async () => branch }
        : url.includes("/rules/branches/main")
          ? { ok: false, status: 403 }
          : { ok: true, json: async () => environment }
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "github_release_metadata_unavailable");
  });

  it("keeps provider credentials out of job-wide scope and unrelated CI steps", () => {
    const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows",
      "controlled-production-deploy.yml"), "utf8");
    const begin = workflow.indexOf("  validate-migrate-deploy:");
    const stepsAt = workflow.indexOf("\n    steps:", begin);
    assert.ok(begin >= 0 && stepsAt > begin);
    const jobHeader = workflow.slice(begin, stepsAt);
    const secrets = ["VERCEL_TOKEN", "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"];
    for (const key of secrets) {
      assert.doesNotMatch(jobHeader, new RegExp("^      " + key + ":", "m"));
    }

    const expected = {
      "Require protected production credentials":
        ["VERCEL_TOKEN", "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"],
      "Verify production project identity": ["SUPABASE_ACCESS_TOKEN"],
      "Link and preview production database migrations":
        ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"],
      "Pull production environment for configuration verification": ["VERCEL_TOKEN"],
      "Synchronize verified Stripe runtime secret to Vercel production": ["VERCEL_TOKEN"],
      "Record pre-migration rollback checkpoint":
        ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"],
      "Apply production database migrations": ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"],
      "Deploy validated source to Vercel production": ["VERCEL_TOKEN"]
    };
    const matches = [...workflow.matchAll(/^      - name: (.+)$/gm)];
    const seen = new Set();
    for (let i = 0; i < matches.length; i++) {
      const name = matches[i][1];
      const section = workflow.slice(matches[i].index,
        i + 1 < matches.length ? matches[i + 1].index : workflow.length);
      const envHeader = /^        env:\n((?:          [A-Za-z_]+: .*\n)*)/m.exec(section);
      const scoped = envHeader ? envHeader[1] : "";
      const permitted = expected[name] || [];
      for (const key of secrets) {
        const actual = new RegExp("^          " + key + ":", "m").test(scoped);
        assert.equal(actual, permitted.includes(key), name + " / " + key);
        if (actual) {
          assert.ok(scoped.includes(key + ": " + "$" + "{{ secrets." + key + " }}"));
        }
      }
      if (permitted.length) seen.add(name);
    }
    assert.deepEqual([...seen].sort(), Object.keys(expected).sort());
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
