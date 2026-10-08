// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A successful GitHub workflow is not sufficient release evidence when one of
// its security/database jobs was skipped, neutral, duplicated or not returned.
// The production workflow calls this BEFORE installing dependencies, reading
// protected provider credentials, running migrations, or deploying.
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^[a-f0-9]{40}$/i;
const NODES = [22, 24, 26];
const POSTGRES = [16, 17, 18];

const REQUIRED_JOBS = Object.freeze({
  "SONARA Industries CI": Object.freeze(["sonara-industries", "supabase-preview"]),
  "Docker Image CI": Object.freeze(["build"]),
  "Node Runtime Compatibility": Object.freeze([
    "Node 24 blocking compatibility", "Node 26 blocking compatibility"
  ]),
  "Native migration replay": Object.freeze(
    NODES.flatMap(node => POSTGRES.map(pg => "Node " + node + " / PostgreSQL " + pg + " replay"))
  ),
  "Engineering Intelligence and Security Evidence": Object.freeze([
    "Architecture, SAST, tenant isolation, and release evidence"
  ]),
  "dependency-scan": Object.freeze([
    "frontend-dependencies", "backend-dependencies", "agentkit"
  ]),
  // A successful Browser Quality workflow is not proof that three actual
  // engine jobs executed. Verify all three on a manual exact-main release run.
  "Browser Quality": Object.freeze([
    "Playwright chromium", "Playwright firefox", "Playwright webkit"
  ])
});
const OPTIONAL_SKIPPED = Object.freeze({
  "Node Runtime Compatibility": Object.freeze([
    "Node 27 forward compatibility (manual, non-blocking)"
  ])
});
// Job success alone may conceal skipped conditional STEPS. In particular the
// Docker job succeeds when Dockerfile is absent unless these exact steps ran.
const REQUIRED_STEPS = Object.freeze({
  "SONARA Industries CI": Object.freeze({
    "sonara-industries": Object.freeze(["Run tests", "Verify database and storage contracts"])
  }),
  "Docker Image CI": Object.freeze({
    "build": Object.freeze(["Build the Docker image", "Smoke test the built image"])
  }),
  "Node Runtime Compatibility": Object.freeze({
    "Node 24 blocking compatibility": Object.freeze(["Test", "Build"]),
    "Node 26 blocking compatibility": Object.freeze(["Test", "Build"])
  }),
  "Native migration replay": Object.freeze({
    "*": Object.freeze(["Replay the candidate migration history"])
  }),
  "Browser Quality": Object.freeze({
    "*": Object.freeze(["Run browser contract", "Upload browser evidence"])
  })
});
const REQUIRED_WORKFLOW_NAMES = Object.freeze(Object.keys(REQUIRED_JOBS));
// GitHub workflow display names are not unique security identities. Bind
// release evidence to the reviewed source workflow file as well.
const REQUIRED_WORKFLOW_FILES = Object.freeze({
  "SONARA Industries CI": ".github/workflows/sonara-industries-ci.yml",
  "Docker Image CI": ".github/workflows/docker-image.yml",
  "Node Runtime Compatibility": ".github/workflows/node-runtime-compatibility.yml",
  "Native migration replay": ".github/workflows/native-migration-replay.yml",
  "Engineering Intelligence and Security Evidence": ".github/workflows/engineering-intelligence-security.yml",
  "dependency-scan": ".github/workflows/dependency-scan.yml",
  "Browser Quality": ".github/workflows/browser-quality.yml"
});
function requiredRunEvent(name) {
  return name === "Browser Quality" ? "workflow_dispatch" : "push";
}
function expectedWorkflowSource(run, name) {
  const file = REQUIRED_WORKFLOW_FILES[name];
  return Boolean(file) && (run?.path === file || run?.path === file + "@main");
}


function assessExactShaJobMatrix({ exactSha, branch, workflowRuns, jobsByRunId } = {}) {
  const failures = [];
  if (!SHA.test(String(exactSha || ""))) failures.push("invalid_release_sha");
  if (branch?.name !== "main" || branch?.protected !== true) {
    failures.push("main_branch_not_protected");
  }
  if (branch?.commit?.sha !== exactSha) failures.push("release_sha_not_current_main");
  if (!Array.isArray(workflowRuns)) failures.push("workflow_runs_missing");
  if (!jobsByRunId || typeof jobsByRunId !== "object") failures.push("job_evidence_missing");
  if (failures.length) return { ok: false, failures };

  for (const name of REQUIRED_WORKFLOW_NAMES) {
    const runs = workflowRuns
      .filter(run => run?.name === name && run?.head_sha === exactSha &&
        run?.head_branch === "main" && run?.event === requiredRunEvent(name) &&
        expectedWorkflowSource(run, name))
      .sort((a, b) => {
        const date = String(b.created_at || "").localeCompare(String(a.created_at || ""));
        return date || Number(b.run_attempt || 0) - Number(a.run_attempt || 0);
      });
    const run = runs[0];
    if (!run || !Number.isSafeInteger(run.id) || run.id <= 0) {
      failures.push(name + ":workflow_missing");
      continue;
    }
    if (run.status !== "completed" || run.conclusion !== "success") {
      failures.push(name + ":workflow_not_successful");
      continue;
    }
    const batch = jobsByRunId[run.id];
    if (!batch || !Array.isArray(batch.jobs) || !Number.isInteger(batch.total_count) ||
        batch.total_count !== batch.jobs.length || batch.jobs.length === 0) {
      failures.push(name + ":job_evidence_incomplete");
      continue;
    }
    const counts = new Map();
    for (const job of batch.jobs) {
      // Require the job itself to attest the same exact main commit. A
      // successful job on another ref cannot stand in for this release.
      if (!job || typeof job.name !== "string" || job.run_id !== run.id ||
          job.head_sha !== exactSha || job.head_branch !== "main") {
        failures.push(name + ":job_identity_mismatch");
        continue;
      }
      counts.set(job.name, (counts.get(job.name) || 0) + 1);
      if (job.status !== "completed" ||
          (job.conclusion !== "success" && !(
            job.conclusion === "skipped" && (OPTIONAL_SKIPPED[name] || []).includes(job.name)
          ))) {
        failures.push(name + ":job_not_successful:" + job.name);
      }
      const necessary = REQUIRED_STEPS[name]?.[job.name] ||
        REQUIRED_STEPS[name]?.["*"] || [];
      for (const stepName of necessary) {
        const matching = Array.isArray(job.steps)
          ? job.steps.filter(step => step?.name === stepName) : [];
        if (matching.length !== 1 || matching[0].status !== "completed" ||
            matching[0].conclusion !== "success") {
          failures.push(name + ":required_step_missing_or_unsuccessful:" + job.name + ":" + stepName);
        }
      }
    }
    for (const required of REQUIRED_JOBS[name]) {
      if (counts.get(required) !== 1) failures.push(name + ":required_job_missing_or_duplicated:" + required);
    }
    for (const [jobName, count] of counts) {
      if (count !== 1) failures.push(name + ":duplicate_job:" + jobName);
    }
  }
  return { ok: failures.length === 0, failures };
}

async function verifyExactShaJobMatrix({
  repo = process.env.GITHUB_REPOSITORY,
  exactSha = process.env.GITHUB_SHA,
  token = process.env.GITHUB_TOKEN,
  get = globalThis.fetch
} = {}) {
  if (!REPO.test(String(repo || "")) || !SHA.test(String(exactSha || "")) ||
      !token || typeof get !== "function") {
    return { ok: false, failures: ["release_context_missing"] };
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
    if (!response?.ok) throw new Error("github_api_not_readable");
    return response.json();
  }
  try {
    const branch = await read("/branches/main");
    if (branch?.protected !== true || branch?.commit?.sha !== exactSha) {
      return assessExactShaJobMatrix({ exactSha, branch, workflowRuns: [], jobsByRunId: {} });
    }
    const listing = await read("/actions/runs?head_sha=" + exactSha + "&branch=main&per_page=100");
    if (!Array.isArray(listing.workflow_runs) ||
        !Number.isInteger(listing.total_count) ||
        listing.total_count > listing.workflow_runs.length) {
      return { ok: false, failures: ["workflow_evidence_incomplete"] };
    }
    const selected = [];
    for (const name of REQUIRED_WORKFLOW_NAMES) {
      const runs = listing.workflow_runs
        .filter(run => run?.name === name && run?.head_sha === exactSha &&
        run?.head_branch === "main" && run?.event === requiredRunEvent(name) &&
        expectedWorkflowSource(run, name))
        .sort((a, b) => {
          const date = String(b.created_at || "").localeCompare(String(a.created_at || ""));
          return date || Number(b.run_attempt || 0) - Number(a.run_attempt || 0);
        });
      if (runs[0]) selected.push(runs[0]);
    }
    // Fetch only selected runs, not unrelated workflow jobs. A truncated
    // response or non-2xx cannot be reinterpreted as "no failed jobs".
    const jobsByRunId = {};
    for (const run of selected) {
      if (!Number.isSafeInteger(run.id) || run.id <= 0) continue;
      jobsByRunId[run.id] = await read("/actions/runs/" + run.id + "/jobs?per_page=100&filter=latest");
    }
    return assessExactShaJobMatrix({
      exactSha, branch, workflowRuns: listing.workflow_runs, jobsByRunId
    });
  } catch {
    return { ok: false, failures: ["github_job_evidence_unavailable"] };
  }
}

if (require.main === module) {
  verifyExactShaJobMatrix().then(result => {
    if (!result.ok) {
      console.error("Production release blocked by exact-SHA job attestation: " +
        result.failures.join("; "));
      process.exitCode = 1;
    } else {
      console.log("All mandatory jobs executed successfully at current protected main SHA.");
    }
  }).catch(() => {
    console.error("Production release blocked: exact-SHA job attestation error.");
    process.exitCode = 1;
  });
}

module.exports = {
  REQUIRED_JOBS,
  OPTIONAL_SKIPPED,
  REQUIRED_STEPS,
  REQUIRED_WORKFLOW_NAMES,
  REQUIRED_WORKFLOW_FILES,
  assessExactShaJobMatrix,
  verifyExactShaJobMatrix
};
