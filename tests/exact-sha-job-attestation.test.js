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
      head_sha: sha, head_branch: "main",
      event: name === "Browser Quality" ? "workflow_dispatch" : "push",
      status: "completed",
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
  it("accepts required push jobs and the manually dispatched three-browser matrix only when every job passed", () => {
    assert.deepEqual(assess(buildEvidence()), { ok: true, failures: [] });
  });

  it("rejects a green browser workflow with a skipped WebKit, Firefox or Chromium job", () => {
    for (const browser of REQUIRED_JOBS["Browser Quality"]) {
      const proof = buildEvidence();
      const run = proof.workflowRuns.find(x => x.name === "Browser Quality");
      proof.jobsByRunId[run.id].jobs.find(job => job.name === browser).conclusion = "skipped";
      assert.ok(assess(proof).failures.some(x => x.includes("job_not_successful:" + browser)));
    }
  });

  it("rejects browser success that bypassed contract execution or evidence upload", () => {
    for (const step of ["Run browser contract", "Upload browser evidence"]) {
      const proof = buildEvidence();
      const run = proof.workflowRuns.find(x => x.name === "Browser Quality");
      const job = proof.jobsByRunId[run.id].jobs[0];
      job.steps.find(s => s.name === step).conclusion = "skipped";
      assert.ok(assess(proof).failures.some(x => x.includes("required_step_missing_or_unsuccessful")));
    }
  });

  it("refuses push or PR browser evidence and cannot reuse an older green manual run", () => {
    for (const event of ["push", "pull_request"]) {
      const wrong = buildEvidence();
      wrong.workflowRuns.find(x => x.name === "Browser Quality").event = event;
      assert.ok(assess(wrong).failures.includes("Browser Quality:workflow_missing"));
    }
    const stale = buildEvidence();
    const passed = stale.workflowRuns.find(x => x.name === "Browser Quality");
    stale.workflowRuns.push({ ...passed, id: 99991, created_at: "2026-10-09T00:00:00Z",
      conclusion: "failure" });
    assert.ok(assess(stale).failures.includes("Browser Quality:workflow_not_successful"));
  });

  it("refuses a successful browser job with the wrong SHA or branch", () => {
    const wrongSha = buildEvidence();
    const run = wrongSha.workflowRuns.find(x => x.name === "Browser Quality");
    wrongSha.jobsByRunId[run.id].jobs[0].head_sha = "b".repeat(40);
    assert.ok(assess(wrongSha).failures.includes("Browser Quality:job_identity_mismatch"));
    const wrongRef = buildEvidence();
    const refRun = wrongRef.workflowRuns.find(x => x.name === "Browser Quality");
    wrongRef.jobsByRunId[refRun.id].jobs[0].head_branch = "feature/fake";
    assert.ok(assess(wrongRef).failures.includes("Browser Quality:job_identity_mismatch"));
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
    assert.ok(urls.some(url => url.includes("&branch=main&per_page=100")));
    assert.ok(!urls.some(url => url.includes("&event=push&per_page=100")));
    const noNetwork = await verify({
      repo, exactSha: sha, token: "fake-token", get: async () => { throw new Error("network down"); }
    });
    assert.deepEqual(noNetwork.failures, ["github_job_evidence_unavailable"]);
    const badRequest = await verify({ repo, exactSha: sha, token: "", get });
    assert.deepEqual(badRequest.failures, ["release_context_missing"]);
  });

  it("requires credential-free preflight before entering the production environment", () => {
    const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows",
      "controlled-production-deploy.yml"), "utf8");
    const preStart = workflow.indexOf("  release-attestation-preflight:");
    const deployStart = workflow.indexOf("  validate-migrate-deploy:");
    assert.ok(preStart > 0 && deployStart > preStart, "preflight must precede deployment");
    const preflight = workflow.slice(preStart, deployStart);
    const deployment = workflow.slice(deployStart);
    assert.ok(preflight.includes("node scripts/verify-exact-sha-release-jobs.cjs"));
    assert.ok(preflight.includes("GITHUB_TOKEN:"));
    for (const value of ["secrets.", "environment: production", "VERCEL_TOKEN", "SUPABASE_"])
      assert.ok(!preflight.includes(value), "secret or environment leaked into preflight: " + value);
    for (const value of ["needs: release-attestation-preflight", "environment: production",
                         "secrets.VERCEL_TOKEN", "secrets.SUPABASE_ACCESS_TOKEN"])
      assert.ok(deployment.includes(value), "release dependency or secret declaration missing: " + value);
  });

  it("never provides provider credentials to the whole protected deployment job", () => {
    const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows",
      "controlled-production-deploy.yml"), "utf8");
    const start = workflow.indexOf("\n  validate-migrate-deploy:\n");
    assert.ok(start >= 0, "protected deployment job must exist");
    const firstSteps = workflow.indexOf("\n    steps:\n", start);
    assert.ok(firstSteps > start, "protected deployment steps must exist");
    const header = workflow.slice(start, firstSteps);
    assert.match(header, /\n    env:\n/, "public routing identifiers remain in job scope");
    assert.doesNotMatch(header, /secrets\.[a-z_]+/i,
      "a job-wide provider secret would leak into checkout, build, tests and dependency tools");
  });

  it("gives each production credential to exactly its required steps", () => {
    const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows",
      "controlled-production-deploy.yml"), "utf8");
    const allow = {
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
    const steps = workflow.split(/\n(?=      - name: )/)
      .filter(block => block.startsWith("      - name: "));
    for (const [credential, approved] of Object.entries(allow)) {
      const seen = steps.filter(block => {
        const stepEnv = block.match(/\n        env:\n((?:          [^\n]*\n)+)/);
        return Boolean(stepEnv && stepEnv[1].includes(credential + ":"));
      }).map(block => block.split("\n")[0].slice("      - name: ".length));
      assert.deepEqual(seen.sort(), approved.slice().sort(),
        credential + " may be used only by the reviewed steps, with no omissions");
      // An otherwise-correct allowlist does not catch an EXTRA binding in
      // an action's with: input, shell command, or a second unreviewed env.
      // Count the literal secret source across the entire workflow as well.
      const binding = "\u0024{{ secrets." + credential + " }}";
      assert.equal(workflow.split(binding).length - 1, approved.length,
        credential + " has an undeclared secret reference outside its approved step env");
      for (const step of steps.filter(block => approved.some(name =>
        block.startsWith("      - name: " + name + "\n")))) {
        assert.ok(step.includes(credential + ": ${{ secrets." + credential + " }}"),
          "Credential must come from GitHub secrets: " + credential);
      }
    }
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
