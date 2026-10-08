// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  REQUIRED_JOBS,
  REQUIRED_WORKFLOW_FILES,
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
      name, id, path: REQUIRED_WORKFLOW_FILES[name],
      head_sha: sha, head_branch: "main", event: "push", status: "completed",
      conclusion: "success", created_at: "2026-10-08T18:00:00Z"
    });
    jobsByRunId[id] = {
      total_count: jobNames.length,
      jobs: jobNames.map(jobName => ({
        name: jobName, run_id: id, head_sha: sha, head_branch: "main",
        status: "completed", conclusion: "success",
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

  it("rejects a same-name workflow defined in a different file", () => {
    const evidence = buildEvidence();
    const first = evidence.workflowRuns[0];
    first.path = ".github/workflows/fake-release-check.yml";
    assert.ok(assess(evidence).failures.includes(first.name + ":workflow_missing"));
  });

  it("ignores newer same-name lookalike workflows instead of using their results", () => {
    const evidence = buildEvidence();
    const legitimate = evidence.workflowRuns[0];
    evidence.workflowRuns.push({
      ...legitimate, id: 99999, path: ".github/workflows/lookalike.yml",
      created_at: "2026-10-09T00:00:00Z", conclusion: "failure"
    });
    assert.equal(assess(evidence).ok, true);
  });

  it("refuses push runs from another branch even when the SHA and workflow name match", () => {
    const offBranch = buildEvidence();
    const first = offBranch.workflowRuns[0];
    first.head_branch = "feature/release-bypass";
    const result = assess(offBranch);
    assert.ok(result.failures.includes(first.name + ":workflow_missing"));
  });

  it("uses the matching main run, never the newer unrelated-branch run", () => {
    const record = buildEvidence();
    const legit = record.workflowRuns[0];
    record.workflowRuns.push({
      ...legit, id: 50000, head_branch: "staging",
      created_at: "2026-10-08T23:00:00Z", conclusion: "failure"
    });
    assert.equal(assess(record).ok, true);
  });

  it("rejects jobs whose branch or commit does not match current protected main", () => {
    const wrongRef = buildEvidence();
    const first = wrongRef.workflowRuns[0];
    wrongRef.jobsByRunId[first.id].jobs[0].head_branch = "feature/release-bypass";
    assert.ok(assess(wrongRef).failures.includes(first.name + ":job_identity_mismatch"));

    const wrongSha = buildEvidence();
    const other = wrongSha.workflowRuns[0];
    wrongSha.jobsByRunId[other.id].jobs[0].head_sha = "b".repeat(40);
    assert.ok(assess(wrongSha).failures.includes(other.name + ":job_identity_mismatch"));
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
      name: ignored, run_id: run.id, head_sha: sha, head_branch: "main",
      status: "completed", conclusion: "skipped"
    });
    v.jobsByRunId[run.id].total_count++;
    assert.equal(assess(v).ok, true);
    v.jobsByRunId[run.id].jobs.push({
      name: "unknown critical job", run_id: run.id, head_sha: sha, head_branch: "main",
      status: "completed", conclusion: "skipped"
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
