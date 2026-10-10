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
      jobs: [{ status: "completed", runner_name: "Hosted Agent", started_at: "2026-10-09T22:01:00Z" }],
      workflowRuns: [{ head_sha: headSha, status: "completed" }]
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
  it("does not disclose raw job fields or tokens in the generated summary", () => {
    const result = analyzeActionsQueueSnapshot(base({ jobs: [{ status: "queued", secret: "never_echo_me", created_at: "2026-10-09T22:00:00Z" }] }));
    assert.ok(!JSON.stringify(result).includes("never_echo_me"));
    assert.equal(result.productionAuthorized, false);
  });
});
