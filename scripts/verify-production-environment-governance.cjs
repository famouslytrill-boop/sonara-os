// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Read-only environment policy gate. GitHub reviewers must be configured by
// the repository owner/admin; this script NEVER writes settings or deploys.
// An unavailable API or missing reviewer settings is NOT a passing release.
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^[a-f0-9]{40}$/i;

// Minimum exact job contexts confirmed by inspecting SONARA's GitHub Actions
// jobs. The full release matrix is separately enforced before this gate.
const MINIMUM_REQUIRED_CHECKS = Object.freeze([
  "sonara-industries",
  "Node 24 blocking compatibility",
  "Node 26 blocking compatibility",
  "Node 24 / PostgreSQL 16 replay",
  "scanners",
  "Architecture, SAST, tenant isolation, and release evidence"
]);

function assessReleaseGovernance({ branch, environment, branchRules, exactSha } = {}) {
  const missing = [];
  if (!branch || branch.name !== "main" || branch.protected !== true) {
    missing.push("main_branch_not_protected");
  }
  if (!SHA.test(String(exactSha || "")) ||
      branch?.commit?.sha !== exactSha) {
    missing.push("head_commit_changed_or_unverified");
  }
  // branch.protected=true is insufficient: a branch can be marked protected
  // without enforced independent review, all mandatory checks, or rewrite denial.
  // GitHub returns only active effective rules for /rules/branches/main.
  if (!Array.isArray(branchRules)) {
    missing.push("active_main_rules_unverified");
  } else {
    const has = (name) => branchRules.some(rule => rule?.type === name);
    const reviews = branchRules.some(rule =>
      rule?.type === "pull_request" &&
      Number.isSafeInteger(rule.parameters?.required_approving_review_count) &&
      rule.parameters.required_approving_review_count >= 1 &&
      rule.parameters.dismiss_stale_reviews_on_push === true &&
      rule.parameters.require_last_push_approval === true);
    if (!reviews) missing.push("independent_main_pr_review_unverified");
    if (!has("non_fast_forward")) missing.push("main_force_push_protection_unverified");
    if (!has("deletion")) missing.push("main_deletion_protection_unverified");
    const strictContexts = new Set(
      branchRules.filter(rule => rule?.type === "required_status_checks" &&
        rule.parameters?.strict_required_status_checks_policy === true)
        .flatMap(rule => Array.isArray(rule.parameters.required_status_checks)
          ? rule.parameters.required_status_checks : [])
        .map(check => check?.context).filter(context => typeof context === "string")
    );
    for (const context of MINIMUM_REQUIRED_CHECKS) {
      if (!strictContexts.has(context)) missing.push("required_check_missing:" + context);
    }
  }
  if (!environment || environment.name !== "production") {
    missing.push("production_environment_unverified");
  }
  const rules = Array.isArray(environment?.protection_rules)
    ? environment.protection_rules : [];
  const review = rules.find(rule => rule?.type === "required_reviewers");
  if (!review || !Array.isArray(review.reviewers) || review.reviewers.length < 1) {
    missing.push("production_required_reviewers_missing");
  }
  if (review?.prevent_self_review !== true) {
    missing.push("production_self_review_not_disabled");
  }
  if (environment?.can_admins_bypass !== false) {
    missing.push("production_admin_bypass_not_disabled_or_unverified");
  }
  if (environment?.deployment_branch_policy?.protected_branches !== true ||
      environment?.deployment_branch_policy?.custom_branch_policies !== false) {
    missing.push("production_not_restricted_to_protected_branches");
  }
  return Object.freeze({
    ok: missing.length === 0,
    code: missing.length ? "production_governance_not_enforced" : "production_governance_verified",
    missing: Object.freeze(missing)
  });
}

async function verifyReleaseGovernance({
  repo = process.env.GITHUB_REPOSITORY,
  exactSha = process.env.GITHUB_SHA,
  token = process.env.GITHUB_TOKEN,
  get = globalThis.fetch
} = {}) {
  if (!REPO.test(String(repo || "")) || !SHA.test(String(exactSha || "")) ||
      typeof token !== "string" || !token.trim() || typeof get !== "function") {
    return { ok: false, code: "release_context_missing", missing: ["release_context_missing"] };
  }
  async function read(endpoint) {
    const response = await get("https://api.github.com/repos/" + repo + endpoint, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28"
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error("github_read_failed_status_" + response.status);
    return response.json();
  }
  try {
    // Do not print the token or raw response in failure logs.
    const branch = await read("/branches/main");
    const branchRules = await read("/rules/branches/main?per_page=100");
    const environment = await read("/environments/production");
    return assessReleaseGovernance({ branch, branchRules, environment, exactSha });
  } catch {
    return {
      ok: false, code: "github_release_metadata_unavailable",
      missing: ["github_release_metadata_unavailable"]
    };
  }
}

if (require.main === module) {
  verifyReleaseGovernance().then(result => {
    if (!result.ok) {
      console.error("Production release blocked by GitHub governance: " +
        result.missing.join(", "));
      process.exitCode = 1;
    } else {
      console.log("Production GitHub branch and environment reviewer policy verified for current SHA.");
    }
  }).catch(() => {
    console.error("Production release blocked: governance verification failed.");
    process.exitCode = 1;
  });
}

module.exports = { MINIMUM_REQUIRED_CHECKS, assessReleaseGovernance, verifyReleaseGovernance };
