// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  REQUIRED_JOBS,
  OPTIONAL_SKIPPED,
  REQUIRED_STEPS,
  assessExactShaJobMatrix: assess,
  verifyExactShaJobMatrix: verify
} = require("../scripts/verify-exact-sha-release-jobs.cjs");

const sha = "a".repeat(40);
const repo = "famouslytrill-boop/sonara-os";
const branch = { name: "main", protected: true, commit: { sha } };

function buildEvidence() {
  const workflowRuns = [], jobsByRunId = {};
  let runId = 100;
  for (const [name, jobNames] of Object.entries(REQUIRED_JOBS)) {
    const id = ++runId;
    workflowRuns.push({
      name, id, head_sha: sha, event: "push", status: "completed",
      conclusion: "success", created_at: "2026-10-08T18:00:00Z"
    });
    jobsByRunId[id] = {
      total_count: jobNames.length,
      jobs: jobNames.map(jobName => ({
        name: jobName, run_id: id, status: "completed", conclusion: "success",
        steps: (REQUIRED_STEPS[name]?.[jobName] || REQUIRED_STEPS[name]?.["*"] || [])
          .map(stepName => ({ name: stepName, status: "completed", conclusion: "success" }))
      }))
    };
  }
  return { exactSha: sha, branch, workflowRuns, jobsByRunId };
}

describe("immutable release SHA requires complete job-level evidence", () => {
  it("accepts all six completed workflows only when every required job passed", () => {
    assert.deepEqual(assess(buildEvidence()), { ok: true, failures: [] });
  });

  it("blocks a green workflow with a skipped required database replay job", () => {
    const v = buildEvidence();
    const run = v.workflowRuns.find(x => x.name === "Native migration replay");
    v.jobsByRunId[run.id].jobs[0].conclusion = "skipped";
    assert.ok(assess(v).failures.some(x => x.includes("job_not_successful")));
  });

  it("blocks absent or duplicate matrix jobs even if run concludes success", () => {
    const v = buildEvidence();
    const run = v.workflowRuns.find(x => x.name === "Node Runtime Compatibility");
    v.jobsByRunId[run.id].jobs.pop();
    v.jobsByRunId[run.id].total_count--;
    assert.ok(assess(v).failures.some(x => x.includes("required_job_missing_or_duplicated")));
    const d = buildEvidence();
    const pair = d.workflowRuns.find(x => x.name === "Node Runtime Compatibility");
    d.jobsByRunId[pair.id].jobs.push(d.jobsByRunId[pair.id].jobs[0]);
    d.jobsByRunId[pair.id].total_count++;
    assert.ok(assess(d).failures.some(x => x.includes("duplicate_job")));
  });

  it("rejects a green Docker job that skipped its build or smoke step", () => {
    const v = buildEvidence();
    const run = v.workflowRuns.find(x => x.name === "Docker Image CI");
    v.jobsByRunId[run.id].jobs[0].steps[0].conclusion = "skipped";
    assert.ok(assess(v).failures.some(x => x.includes("required_step_missing_or_unsuccessful")));
    const w = buildEvidence();
    const r = w.workflowRuns.find(x => x.name === "Native migration replay");
    w.jobsByRunId[r.id].jobs[0].steps = [];
    assert.ok(assess(w).failures.some(x => x.includes("required_step_missing_or_unsuccessful")));
  });

  it("permits only the named optional Node 27 skip; no other skip is allowed", () => {
    const v = buildEvidence();
    const run = v.workflowRuns.find(x => x.name === "Node Runtime Compatibility");
    const ignored = OPTIONAL_SKIPPED["Node Runtime Compatibility"][0];
    v.jobsByRunId[run.id].jobs.push({
      name: ignored, run_id: run.id, status: "completed", conclusion: "skipped"
    });
    v.jobsByRunId[run.id].total_count++;
    assert.equal(assess(v).ok, true);
    v.jobsByRunId[run.id].jobs.push({
      name: "unknown critical job", run_id: run.id, status: "completed", conclusion: "skipped"
    });
    v.jobsByRunId[run.id].total_count++;
    assert.equal(assess(v).ok, false);
  });

  it("blocks incomplete pagination, wrong run IDs, and stale job evidence", () => {
    const v = buildEvidence();
    const run = v.workflowRuns[0];
    v.jobsByRunId[run.id].total_count++;
    assert.ok(assess(v).failures.includes(run.name + ":job_evidence_incomplete"));
    const w = buildEvidence();
    const first = w.workflowRuns[0];
    w.jobsByRunId[first.id].jobs[0].run_id = 999;
    assert.ok(assess(w).failures.includes(first.name + ":job_identity_mismatch"));
    const x = buildEvidence();
    x.workflowRuns[0].head_sha = "b".repeat(40);
    assert.equal(assess(x).ok, false);
  });

  it("refuses unprotected/stale main and any unverified workflow state", () => {
    const v = buildEvidence();
    assert.ok(assess({ ...v, branch: { ...branch, protected: false } })
      .failures.includes("main_branch_not_protected"));
    assert.ok(assess({ ...v, exactSha: "b".repeat(40) })
      .failures.includes("release_sha_not_current_main"));
    v.workflowRuns[0].conclusion = "neutral";
    assert.ok(assess(v).failures.some(x => x.includes("workflow_not_successful")));
  });

  it("reads only GitHub metadata; missing responses and server errors fail closed", async () => {
    const v = buildEvidence(), urls = [];
    const get = async (url, init) => {
      urls.push(url);
      assert.equal(init.method, "GET");
      assert.ok(!url.includes("fake-token"), "never put the token in a URL");
      const endpoint = url.split("/repos/" + repo)[1];
      if (endpoint === "/branches/main") return { ok: true, json: async () => branch };
      if (endpoint.startsWith("/actions/runs?")) {
        return { ok: true, json: async () => ({
          workflow_runs: v.workflowRuns, total_count: v.workflowRuns.length
        }) };
      }
      const id = Number(endpoint.match(/\/actions\/runs\/(\d+)\/jobs/)[1]);
      return { ok: true, json: async () => v.jobsByRunId[id] };
    };
    const good = await verify({ repo, exactSha: sha, token: "fake-token", get });
    assert.equal(good.ok, true);
    assert.equal(urls.length, Object.keys(REQUIRED_JOBS).length + 2);
    const noNetwork = await verify({
      repo, exactSha: sha, token: "fake-token", get: async () => { throw new Error("network down"); }
    });
    assert.deepEqual(noNetwork.failures, ["github_job_evidence_unavailable"]);
    const badRequest = await verify({ repo, exactSha: sha, token: "", get });
    assert.deepEqual(badRequest.failures, ["release_context_missing"]);
  });

  it("never puts production credentials in a job-wide environment", () => {
    const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows",
      "controlled-production-deploy.yml"), "utf8");
    const job = workflow.slice(workflow.indexOf("  validate-migrate-deploy:"),
      workflow.indexOf("\n    steps:", workflow.indexOf("  validate-migrate-deploy:")));
    assert.ok(job.includes("    env:"));
    assert.doesNotMatch(job, /secrets\.[A-Za-z_]+/,
      "job-level env exposes secrets to every action, test and build");
  });

  it("injects each production credential only into its reviewed consuming steps", () => {
    const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows",
      "controlled-production-deploy.yml"), "utf8");
    const allowed = {
      VERCEL_TOKEN: ["Require protected production credentials",
        "Pull production environment for configuration verification",
        "Synchronize verified Stripe runtime secret to Vercel production",
        "Deploy validated source to Vercel production"],
      SUPABASE_ACCESS_TOKEN: ["Require protected production credentials",
        "Verify production project identity",
        "Link and preview production database migrations",
        "Record pre-migration rollback checkpoint",
        "Apply production database migrations"],
      SUPABASE_PROJECT_ID: ["Require protected production credentials",
        "Verify production project identity",
        "Link and preview production database migrations",
        "Record pre-migration rollback checkpoint",
        "Apply production database migrations"],
      SUPABASE_DB_PASSWORD: ["Require protected production credentials",
        "Link and preview production database migrations",
        "Record pre-migration rollback checkpoint",
        "Apply production database migrations"]
    };
    const blocks = workflow.split(/\n(?=      - name: )/)
      .filter(block => block.startsWith("      - name: "));
    for (const [credential, expected] of Object.entries(allowed)) {
      const consuming = blocks.filter(block => {
        const blockEnv = block.match(/\n        env:\n((?:          [^\n]*\n)+)/);
        return Boolean(blockEnv && blockEnv[1].includes(credential + ":"));
      }).map(block => block.split("\n")[0].slice("      - name: ".length));
      assert.deepEqual(consuming.sort(), expected.slice().sort(),
        `${credential} was exposed to an unapproved step or omitted from its consumer`);
      for (const block of blocks.filter(block => expected.some(name =>
        block.startsWith("      - name: " + name + "\n")))) {
        assert.ok(block.includes(credential + ": ${{ secrets." + credential + " }}"),
          credential + " must originate from the protected secrets context");
      }
    }
    const gate = workflow.indexOf("      - name: Require mandatory exact-SHA job attestations");
    const secretStep = workflow.indexOf("      - name: Require protected production credentials");
    assert.ok(gate >= 0 && secretStep > gate, "release attestation must precede credential access");
  });

  it("is ordered after the exact-SHA run gate but before environment and secrets", () => {
    const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows",
      "controlled-production-deploy.yml"), "utf8");
    const i = workflow.indexOf("Require exact-SHA post-merge green matrix");
    const j = workflow.indexOf("Require mandatory exact-SHA job attestations");
    const k = workflow.indexOf("Require approved production environment governance");
    const l = workflow.indexOf("Require protected production credentials");
    assert.ok(i >= 0 && j > i && k > j && l > k);
    assert.match(workflow, /node scripts\/verify-exact-sha-release-jobs\.cjs/);
    assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  });
});
