// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Read-only environment policy gate. GitHub reviewers must be configured by
// the repository owner/admin; this script NEVER writes settings or deploys.
// An unavailable API or missing reviewer settings is NOT a passing release.
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^[a-f0-9]{40}$/i;

function assessReleaseGovernance({ branch, environment, exactSha } = {}) {
  const missing = [];
  if (!branch || branch.name !== "main" || branch.protected !== true) {
    missing.push("main_branch_not_protected");
  }
  if (!SHA.test(String(exactSha || "")) ||
      branch?.commit?.sha !== exactSha) {
    missing.push("head_commit_changed_or_unverified");
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
    const environment = await read("/environments/production");
    return assessReleaseGovernance({ branch, environment, exactSha });
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

module.exports = { assessReleaseGovernance, verifyReleaseGovernance };
