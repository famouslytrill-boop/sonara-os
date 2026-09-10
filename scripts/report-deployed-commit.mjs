#!/usr/bin/env node
"use strict";

// Which build is production actually serving, and how far behind is it.
//
// `production-connectivity` runs against the live site on every pull request and
// passes. What it does not say is WHICH build it just tested.
// `smoke-live-routes.mjs` can compare the deployed commit to an expected one,
// but its first line is `if (!expectedCommitSha) return;` and that value is
// supplied only by the deployment workflow. On a pull request it is empty, so
// the comparison is skipped and the smoke check reports a healthy production
// without ever naming the version it reached.
//
// On 9 September 2026 that mattered: production served 36c1b2a while `main` had
// moved 44 commits past it, because deployments were blocked on a missing
// credential. Every green production check that day was green about a build none
// of the day's work was in. Nothing reported it; it was noticed by hand.
//
// So this names it. It is a report, not a gate:
//
//   - Staleness does NOT fail. Production being behind is the owner's to fix,
//     and a pull request going red for it would be a check nobody in that pull
//     request can turn green -- which is how a red build becomes background
//     noise everybody learns to ignore.
//   - Losing the ability to TELL does fail. If /api/health stops carrying the
//     deployment block, the post-deploy gate in smoke-live-routes silently stops
//     verifying anything, and that is a real regression.
//
// Offline it skips, like `verify-stripe-env.mjs` without --require-live. Pass
// --require-live to make an unreachable site a failure.

import { execFileSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const requireLive = args.has("--require-live");
const site = (process.env.SONARA_PRODUCTION_URL || "https://sonaraindustries.com").replace(/\/$/, "");
const TIMEOUT_MS = 20000;

function git(...parameters) {
  try {
    return execFileSync("git", parameters, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

async function readHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${site}/api/health`, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    return { ok: true, payload: await response.json() };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "request failed" };
  } finally {
    clearTimeout(timer);
  }
}

const health = await readHealth();

if (!health.ok) {
  const message = `Deployed-commit report: ${site}/api/health could not be read (${health.reason}).`;
  if (!requireLive) {
    console.log(`${message} Skipping, because --require-live was not passed.`);
    process.exit(0);
  }
  console.error(`${message} --require-live was passed, so this is a failure.`);
  process.exit(1);
}

const deployment = health.payload?.deployment;
const commitSha = String(deployment?.commitSha || "").trim();

// The one thing that fails. Losing this block is not cosmetic: the post-deploy
// gate in smoke-live-routes.mjs reads exactly `payload.deployment.commitSha`, so
// if it disappears that gate stops confirming a deployment landed and says
// nothing about having stopped.
if (!deployment || !commitSha) {
  console.error(
    `Deployed-commit report failed: ${site}/api/health carries no deployment.commitSha. ` +
    "scripts/smoke-live-routes.mjs reads that exact field to confirm a deployment landed, so without it the " +
    "post-deploy gate passes without verifying anything. Restore the deployment block in the /api/health route."
  );
  process.exit(1);
}

const branch = String(deployment.branch || "unknown");
const environment = String(deployment.environment || "unknown");

// Compare against main, when this checkout can. A shallow clone -- which is what
// actions/checkout gives by default -- will not contain the deployed commit, and
// reporting "0 behind" in that case would be a confident wrong answer rather
// than an absent one.
const hasCommit = git("cat-file", "-e", `${commitSha}^{commit}`) !== null;
const mainRef = git("rev-parse", "--verify", "origin/main") ? "origin/main" : (git("rev-parse", "--verify", "main") ? "main" : null);

let drift = null;
if (hasCommit && mainRef) {
  const behind = git("rev-list", "--count", `${commitSha}..${mainRef}`);
  const ancestor = git("merge-base", "--is-ancestor", commitSha, mainRef) !== null;
  if (behind !== null) drift = { behind: Number(behind), ancestor };
}

const head = `Deployed-commit report: ${site} is serving ${commitSha.slice(0, 7)} on ${branch} (${environment}).`;

if (!drift) {
  console.log(
    `${head} How far behind ${mainRef || "main"} it is could not be worked out here -- ` +
    `${hasCommit ? "no main reference in this checkout" : "this checkout does not contain that commit, which a shallow clone will not"}. ` +
    "Not reported as up to date, because that would be a guess."
  );
  process.exit(0);
}

if (drift.behind === 0) {
  console.log(`${head} It matches ${mainRef}, so the live site is serving current main.`);
  process.exit(0);
}

console.log(
  `${head} ${mainRef} is ${drift.behind} commit(s) ahead of it` +
  `${drift.ancestor ? "" : ", and the deployed commit is not an ancestor of main at all, which means production is serving something main does not contain"}. ` +
  "Not a failure -- deploying is the owner's step -- but any check that passed against production passed against " +
  `${commitSha.slice(0, 7)}, not against the working tree, and should not be read as evidence about unreleased work.`
);
