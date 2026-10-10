"use strict";
const assert = require("node:assert/strict");
const { analyzeActionsQueueSnapshot } = require("../lib/sonara-actions-queue-diagnostic.cjs");
const headSha = "a".repeat(40);
const base = (more = {}) => ({
  headSha, observedAt: "2026-10-09T22:30:00Z",
  checkRuns: [{ head_sha: headSha, status: "queued", conclusion: null }],
  workflowRuns: [{ head_sha: headSha, status: "queued" }],
  jobs: [{ status: "queued", created_at: "2026-10-09T22:00:00Z", runner_name: null, started_at: null }],
  ...more
});

describe("SONARA read-only Actions queue diagnostics", () => {
  it("detects queued checks and unassigned aged jobs without claiming an outage cause", () => {
    const result = analyzeActionsQueueSnapshot(base());
    assert.equal(result.jobCounts.olderThanThresholdWithoutAssignment, 1);
    assert.ok(result.issueCodes.includes("unfinished_execution"));
    assert.ok(result.issueCodes.includes("unassigned_queue_age_threshold_exceeded"));
    assert.equal(result.runnerCauseDetermined, false);
    assert.equal(result.exactHeadReleaseGreen, false);
    assert.equal(result.productionAuthorized, false);
  });
  it("rejects snapshots at the wrong commit", () => {
    const result = analyzeActionsQueueSnapshot(base({ checkRuns: [{ head_sha: "b".repeat(40), status: "completed", conclusion: "success" }] }));
    assert.ok(result.issueCodes.includes("head_mismatch_or_missing"));
  });
  it("does not interpret all-success snapshots as authorized production", () => {
    const result = analyzeActionsQueueSnapshot(base({
      checkRuns: [{ head_sha: headSha, status: "completed", conclusion: "success" }],
      jobs: [{ status: "completed", conclusion: "success", runner_name: "Hosted Agent", started_at: "2026-10-09T22:01:00Z" }],
      workflowRuns: [{ head_sha: headSha, status: "completed", conclusion: "success" }]
    }));
    assert.equal(result.diagnosis, "required_gate_scope_unverified");
    assert.equal(result.requiredChecksPolicyVerified, false);
    assert.equal(result.exactHeadReleaseGreen, false);
  });
  it("treats skipped-only and empty snapshots as insufficient", () => {
    const skipped = analyzeActionsQueueSnapshot(base({ checkRuns: [{ head_sha: headSha, status: "completed", conclusion: "skipped" }] }));
    assert.ok(skipped.issueCodes.includes("skipped_only_not_proof"));
    const absent = analyzeActionsQueueSnapshot(base({ checkRuns: [], jobs: [], workflowRuns: [] }));
    assert.ok(absent.issueCodes.includes("missing_check_evidence"));
    assert.ok(absent.issueCodes.includes("missing_job_evidence"));
  });
  it("distinguishes a failing job from one that never ran", () => {
    const result = analyzeActionsQueueSnapshot(base({
      checkRuns: [{ head_sha: headSha, status: "completed", conclusion: "failure" }],
      jobs: [{ status: "completed", runner_name: "Runner A", started_at: "2026-10-09T22:03:00Z" }]
    }));
    assert.ok(result.issueCodes.includes("failed_checks"));
    assert.equal(result.jobCounts.olderThanThresholdWithoutAssignment, 0);
  });
  it("rejects future observations and malformed bounds", () => {
    assert.throws(() => analyzeActionsQueueSnapshot(base({ headSha: "bad" })), /headSha/);
    assert.throws(() => analyzeActionsQueueSnapshot(base({ observedAt: "2026-10-09" })), /ISO timestamp/);
    assert.throws(() => analyzeActionsQueueSnapshot(base({ queueAgeThresholdMinutes: 0 })), /queueAgeThreshold/);
    assert.throws(() => analyzeActionsQueueSnapshot(base({ jobs: [null] })), /invalid entry/);
    const future = analyzeActionsQueueSnapshot(base({ jobs: [{ status: "queued", created_at: "2026-10-09T23:00:00Z" }] }));
    assert.ok(future.issueCodes.includes("future_created_at"));
  });
  it("uses workflow creation time without inventing a per-job queue timestamp", () => {
    const result = analyzeActionsQueueSnapshot(base({
      jobs: [{ status: "queued", runner_name: null, started_at: null }],
      workflowRuns: [{ head_sha: headSha, status: "queued", created_at: "2026-10-09T22:00:00Z" }]
    }));
    assert.equal(result.jobCounts.olderThanThresholdWithoutAssignment, 0);
    assert.equal(result.workflowQueue.olderThanThreshold, 1);
    assert.ok(result.issueCodes.includes("workflow_queue_age_threshold_exceeded"));
    assert.equal(result.runnerCauseDetermined, false);
  });
  it("rejects future workflow timestamps instead of inferring aged queues", () => {
    const result = analyzeActionsQueueSnapshot(base({
      workflowRuns: [{ head_sha: headSha, status: "queued", created_at: "2026-10-09T23:00:00Z" }]
    }));
    assert.ok(result.issueCodes.includes("future_created_at"));
    assert.equal(result.workflowQueue.olderThanThreshold, 0);
  });
  it("recognizes failed workflow even if an unrelated check succeeded", () => {
    const result = analyzeActionsQueueSnapshot(base({
      checkRuns: [{ head_sha: headSha, status: "completed", conclusion: "success" }],
      workflowRuns: [{ head_sha: headSha, status: "completed", conclusion: "failure" }],
      jobs: [{ status: "completed", conclusion: "success", runner_name: "Hosted Runner" }]
    }));
    assert.ok(result.issueCodes.includes("failed_workflows"));
    assert.equal(result.workflowQueue.failed, 1);
    assert.equal(result.productionAuthorized, false);
  });
  it("recognizes failed job even if workflow and check results look green", () => {
    const result = analyzeActionsQueueSnapshot(base({
      checkRuns: [{ head_sha: headSha, status: "completed", conclusion: "success" }],
      workflowRuns: [{ head_sha: headSha, status: "completed", conclusion: "success" }],
      jobs: [{ status: "completed", conclusion: "timed_out", runner_name: "Runner" }]
    }));
    assert.ok(result.issueCodes.includes("failed_jobs"));
    assert.equal(result.jobCounts.failed, 1);
  });
  it("detects waiting and requested states as unfinished release evidence", () => {
    const result = analyzeActionsQueueSnapshot(base({
      checkRuns: [{ head_sha: headSha, status: "waiting", conclusion: null }],
      workflowRuns: [{ head_sha: headSha, status: "requested" }],
      jobs: [{ status: "waiting" }]
    }));
    assert.ok(result.issueCodes.includes("unfinished_execution"));
    assert.equal(result.checkCounts.queued, 1);
    assert.equal(result.jobCounts.unfinished, 1);
    assert.equal(result.workflowQueue.unfinished, 1);
    assert.ok(!result.issueCodes.includes("unknown_check_status"));
  });
  it("identifies absent workflow evidence and unknown completed results", () => {
    const empty = analyzeActionsQueueSnapshot(base({ workflowRuns: [] }));
    assert.ok(empty.issueCodes.includes("missing_workflow_evidence"));
    const incomplete = analyzeActionsQueueSnapshot(base({
      workflowRuns: [{ head_sha: headSha, status: "completed" }],
      jobs: [{ status: "completed" }]
    }));
    assert.ok(incomplete.issueCodes.includes("unknown_workflow_conclusion"));
    assert.ok(incomplete.issueCodes.includes("unknown_job_conclusion"));
  });
  it("marks GitHub stale or startup-failure conclusions as failed", () => {
    const result = analyzeActionsQueueSnapshot(base({
      checkRuns: [{ head_sha: headSha, status: "completed", conclusion: "stale" }],
      workflowRuns: [{ head_sha: headSha, status: "completed", conclusion: "startup_failure" }],
      jobs: [{ status: "completed", conclusion: "cancelled" }]
    }));
    assert.ok(result.issueCodes.includes("failed_checks"));
    assert.ok(result.issueCodes.includes("failed_workflows"));
    assert.ok(result.issueCodes.includes("failed_jobs"));
  });
  it("reports repository-level queue counts separately from exact-head gates", () => {
    const result = analyzeActionsQueueSnapshot(base({
      checkRuns: [{ head_sha: headSha, status: "completed", conclusion: "success" }],
      workflowRuns: [{ head_sha: headSha, status: "completed", conclusion: "success" }],
      jobs: [{ status: "completed", conclusion: "success" }],
      repositoryRunCounts: { queued: 706, inProgress: 4 }
    }));
    assert.deepEqual(result.issueCodes, []);
    assert.equal(result.repositoryLoad.counts.queued, 706);
    assert.equal(result.repositoryLoad.queuedToRunningRatio, 176.5);
    assert.equal(result.repositoryLoad.repositoryQueueCauseDetermined, false);
    assert.equal(result.exactHeadReleaseGreen, false);
  });
  it("summarizes workflow-trigger volume by exact commit from a bounded recent sample", () => {
    const result = analyzeActionsQueueSnapshot(base({ recentRuns: [
      { head_sha: headSha, status: "queued", conclusion: null, token: "private-1" },
      { head_sha: headSha, status: "completed", conclusion: "cancelled", token: "private-2" },
      { head_sha: "b".repeat(40), status: "queued", conclusion: null }
    ] }));
    assert.deepEqual(result.repositoryLoad.recentSample, {
      size: 3, distinctCommitHeads: 2, cancelled: 1, queued: 2, mostRunsForSingleHead: 2
    });
    assert.equal(JSON.stringify(result).includes("private-"), false);
    assert.equal(result.repositoryLoad.repositoryQueueCauseDetermined, false);
  });
  it("rejects malformed repository totals or unbounded/invalid recent samples", () => {
    assert.throws(() => analyzeActionsQueueSnapshot(base({ repositoryRunCounts: { queued: -1, inProgress: 0 } })), /repositoryRunCounts/);
    assert.throws(() => analyzeActionsQueueSnapshot(base({ repositoryRunCounts: { queued: 4, inProgress: 1, billed: "secret" } })), /repositoryRunCounts/);
    assert.throws(() => analyzeActionsQueueSnapshot(base({ recentRuns: Array(201).fill({ head_sha: headSha, status: "queued" }) })), /recentRuns/);
    assert.throws(() => analyzeActionsQueueSnapshot(base({ recentRuns: [{ head_sha: "short", status: "queued" }] })), /head_sha/);
    const zero = analyzeActionsQueueSnapshot(base({ repositoryRunCounts: { queued: 200, inProgress: 0 } }));
    assert.equal(zero.repositoryLoad.queuedToRunningRatio, null);
  });
  it("links job IDs to workflow run IDs and flags partial multi-run coverage", () => {
    const result = analyzeActionsQueueSnapshot(base({
      workflowRuns: [
        { id: 101, head_sha: headSha, status: "completed", conclusion: "success" },
        { id: 102, head_sha: headSha, status: "completed", conclusion: "success" }
      ],
      jobs: [{ run_id: 101, status: "completed", conclusion: "success" }]
    }));
    assert.ok(result.issueCodes.includes("workflow_job_coverage_partial"));
    assert.equal(result.jobLinkage.workflowIdsObserved, 2);
    assert.equal(result.jobLinkage.jobRunIdsObserved, 1);
    assert.equal(result.jobLinkage.everyWorkflowIdRepresentedInSample, false);
  });
  it("detects jobs from another workflow and from another head", () => {
    const result = analyzeActionsQueueSnapshot(base({
      workflowRuns: [{ id: 101, head_sha: headSha, status: "completed", conclusion: "success" }],
      jobs: [{ run_id: 999, head_sha: "b".repeat(40), status: "completed", conclusion: "success" }]
    }));
    assert.ok(result.issueCodes.includes("job_run_id_not_in_workflow_snapshot"));
    assert.ok(result.issueCodes.includes("job_head_sha_mismatch"));
    assert.equal(result.jobLinkage.unmatchedRunId, 1);
  });
  it("treats missing job run IDs as unverified when workflow IDs exist", () => {
    const result = analyzeActionsQueueSnapshot(base({
      workflowRuns: [{ id: 101, head_sha: headSha, status: "completed", conclusion: "success" }],
      jobs: [{ status: "completed", conclusion: "success" }]
    }));
    assert.ok(result.issueCodes.includes("job_run_id_unverified"));
    assert.equal(result.jobLinkage.everyWorkflowIdRepresentedInSample, false);
  });
  it("can verify complete sampled job associations but never release", () => {
    const result = analyzeActionsQueueSnapshot(base({
      checkRuns: [{ head_sha: headSha, status: "completed", conclusion: "success" }],
      workflowRuns: [{ id: 101, head_sha: headSha, status: "completed", conclusion: "success" }],
      jobs: [{ run_id: 101, head_sha: headSha, status: "completed", conclusion: "success" }]
    }));
    assert.deepEqual(result.issueCodes, []);
    assert.equal(result.jobLinkage.everyWorkflowIdRepresentedInSample, true);
    assert.equal(result.jobLinkage.completeJobInventoryVerified, false);
    assert.equal(result.requiredChecksPolicyVerified, false);
    assert.equal(result.exactHeadReleaseGreen, false);
    assert.equal(result.productionAuthorized, false);
  });
  it("does not disclose raw job fields or tokens in the generated summary", () => {
    const result = analyzeActionsQueueSnapshot(base({ jobs: [{ status: "queued", secret: "never_echo_me", created_at: "2026-10-09T22:00:00Z" }] }));
    assert.ok(!JSON.stringify(result).includes("never_echo_me"));
    assert.equal(result.productionAuthorized, false);
  });
});
