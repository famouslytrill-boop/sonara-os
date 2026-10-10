// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// No network, credentials, workflow triggers, storage writes or production actions.
// All timestamps and check/job lists are caller-supplied, not independently verified.
const SHA = /^[0-9a-f]{40}$/i;
const allowedStates = new Set(["queued", "in_progress", "completed", "pending", "waiting", "requested"]);
function dateMs(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || !/(?:Z|[+-]\d\d:\d\d)$/.test(value)) {
    throw new TypeError(`${label} must be an offset-aware ISO timestamp`);
  }
  return Date.parse(value);
}
function entryArray(value, label, maximum) {
  if (!Array.isArray(value) || value.length > maximum) throw new TypeError(`${label} must be an array of at most ${maximum}`);
  for (const item of value) if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new TypeError(`${label} contains an invalid entry`);
  }
  return value;
}
// These additional inputs are optional repository-level samples. They are
// diagnostic context, not release gates or a complete picture of GitHub's queue.
function summarizeRepositoryLoad(counts, recentRuns) {
  if (counts == null && recentRuns == null) return null;
  if (counts != null) {
    if (!counts || typeof counts !== "object" || Array.isArray(counts) ||
      Object.keys(counts).some((key) => !["queued", "inProgress"].includes(key)) ||
      !Number.isSafeInteger(counts.queued) || counts.queued < 0 || counts.queued > 10000000 ||
      !Number.isSafeInteger(counts.inProgress) || counts.inProgress < 0 || counts.inProgress > 10000000) {
      throw new TypeError("repositoryRunCounts requires bounded queued and inProgress integers");
    }
  }
  const sample = recentRuns == null ? [] : entryArray(recentRuns, "recentRuns", 200);
  const heads = new Map();
  let sampleCancelled = 0;
  let sampleQueued = 0;
  for (const run of sample) {
    if (typeof run.head_sha !== "string" || !SHA.test(run.head_sha)) {
      throw new TypeError("recentRuns require an exact head_sha");
    }
    if (typeof run.status !== "string") throw new TypeError("recentRuns require status");
    if (run.conclusion === "cancelled") sampleCancelled++;
    if (run.status === "queued") sampleQueued++;
    const sha = run.head_sha.toLowerCase();
    heads.set(sha, (heads.get(sha) || 0) + 1);
  }
  return Object.freeze({
    counts: counts == null ? null : Object.freeze({ queued: counts.queued, inProgress: counts.inProgress }),
    queuedToRunningRatio: counts == null || !counts.inProgress
      ? null : Math.round((counts.queued / counts.inProgress) * 100) / 100,
    recentSample: Object.freeze({ size: sample.length, distinctCommitHeads: heads.size,
      cancelled: sampleCancelled, queued: sampleQueued,
      mostRunsForSingleHead: heads.size ? Math.max(...heads.values()) : 0 }),
    evidenceScope: "caller_supplied_repository_counts_and_nonexhaustive_recent_sample",
    repositoryQueueCauseDetermined: false
  });
}

function analyzeActionsQueueSnapshot(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input) || !SHA.test(input.headSha || "")) {
    throw new TypeError("A valid exact 40-character headSha is required");
  }
  const observed = dateMs(input.observedAt, "observedAt");
  const checks = entryArray(input.checkRuns, "checkRuns", 500);
  const workflows = entryArray(input.workflowRuns, "workflowRuns", 200);
  const jobs = entryArray(input.jobs, "jobs", 2000);
  const threshold = input.queueAgeThresholdMinutes == null ? 15 : input.queueAgeThresholdMinutes;
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 1440) {
    throw new RangeError("queueAgeThresholdMinutes must be 1–1440");
  }
  const repositoryLoad = summarizeRepositoryLoad(input.repositoryRunCounts, input.recentRuns);
  const issues = new Set();
  // A pagination receipt is optional and caller-supplied. GitHub's total_count
  // must be reconciled against every fetched page before a snapshot is complete.
  const apiTotals = input.apiTotals;
  let declaredTotals = null;
  if (apiTotals != null) {
    if (!apiTotals || typeof apiTotals !== "object" || Array.isArray(apiTotals)
      || Object.keys(apiTotals).some((key) => !["checkRuns", "workflowRuns", "jobsByWorkflow"].includes(key))) {
      throw new TypeError("apiTotals accepts only checkRuns, workflowRuns, jobsByWorkflow");
    }
    for (const field of ["checkRuns", "workflowRuns"]) {
      if (!Number.isSafeInteger(apiTotals[field]) || apiTotals[field] < 0
        || apiTotals[field] > 100000) {
        throw new TypeError(`apiTotals.${field} must be a bounded total_count`);
      }
    }
    const totals = entryArray(apiTotals.jobsByWorkflow, "apiTotals.jobsByWorkflow", 200);
    declaredTotals = new Map();
    for (const item of totals) {
      if (!Number.isSafeInteger(item.runId) || item.runId < 1
        || !Number.isSafeInteger(item.totalCount) || item.totalCount < 0
        || item.totalCount > 100000
        || Object.keys(item).some((key) => !["runId", "totalCount"].includes(key))
        || declaredTotals.has(item.runId)) {
        throw new TypeError("apiTotals.jobsByWorkflow must have unique bounded runId/totalCount pairs");
      }
      declaredTotals.set(item.runId, item.totalCount);
    }
  }
  const counts = { queued: 0, inProgress: 0, success: 0, failure: 0, skipped: 0, otherCompleted: 0 };
  const failedConclusions = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"]);
  const unfinishedStates = new Set(["queued", "in_progress", "pending", "waiting", "requested"]);
  let failedWorkflows = 0;
  let failedJobs = 0;
  let unfinishedWorkflows = 0;
  let unfinishedJobs = 0;
  let oldQueuedJobs = 0;
  let jobsWithRunner = 0;
  let queuedJobs = 0;
  let queuedWorkflows = 0;
  let agedQueuedWorkflows = 0;
  let observedStartedJobs = 0;
  const workflowIds = new Set();
  const observedJobRunIds = new Set();
  const seenCheckIds = new Set();
  const seenJobIds = new Set();
  const observedJobsByRun = new Map();
  let jobRunIdMissing = 0;
  let jobRunIdUnmatched = 0;
  let jobShaMismatched = 0;
  const match = input.headSha.toLowerCase();
  for (const c of checks) {
    if (c.id != null) {
      if (!Number.isSafeInteger(c.id) || c.id < 1 || seenCheckIds.has(c.id)) {
        issues.add("invalid_or_duplicate_check_id");
      } else seenCheckIds.add(c.id);
    } else if (declaredTotals) issues.add("check_run_identity_missing");
    if (typeof c.head_sha !== "string" || c.head_sha.toLowerCase() !== match) issues.add("head_mismatch_or_missing");
    if (c.status === "completed") {
      if (c.conclusion === "success") counts.success++;
      else if (c.conclusion === "skipped") counts.skipped++;
      else if (failedConclusions.has(c.conclusion)) counts.failure++;
      else { counts.otherCompleted++; issues.add("unknown_check_conclusion"); }
    } else if (c.status === "in_progress") counts.inProgress++;
    else if (unfinishedStates.has(c.status)) counts.queued++;
    else issues.add("unknown_check_status");
  }
  for (const w of workflows) {
    if (declaredTotals && w.id == null) issues.add("workflow_id_missing");
    if (w.id != null) {
      if (!Number.isSafeInteger(w.id) || w.id < 1 || workflowIds.has(w.id)) {
        issues.add("invalid_or_duplicate_workflow_id");
      } else workflowIds.add(w.id);
    }
    if (typeof w.head_sha !== "string" || w.head_sha.toLowerCase() !== match) issues.add("head_mismatch_or_missing");
    if (!allowedStates.has(w.status)) issues.add("unknown_workflow_status");
    if (unfinishedStates.has(w.status)) unfinishedWorkflows++;
    if (w.status === "completed" && failedConclusions.has(w.conclusion)) failedWorkflows++;
    if (w.status === "completed" && !["success", "neutral", "skipped"].includes(w.conclusion)
      && !failedConclusions.has(w.conclusion)) issues.add("unknown_workflow_conclusion");
    if (w.status === "queued" || w.status === "pending") {
      queuedWorkflows++;
      if (w.created_at) {
        const created = dateMs(w.created_at, "workflow.created_at");
        if (created > observed) issues.add("future_created_at");
        else if (observed - created >= threshold * 60_000) agedQueuedWorkflows++;
      }
    }
  }
  for (const j of jobs) {
    if (j.id != null) {
      if (!Number.isSafeInteger(j.id) || j.id < 1 || seenJobIds.has(j.id)) {
        issues.add("invalid_or_duplicate_job_id");
      } else seenJobIds.add(j.id);
    } else if (declaredTotals) issues.add("job_identity_missing");
    if (j.run_id == null || !Number.isSafeInteger(j.run_id) || j.run_id < 1) {
      jobRunIdMissing++;
    } else {
      observedJobRunIds.add(j.run_id);
      observedJobsByRun.set(j.run_id, (observedJobsByRun.get(j.run_id) || 0) + 1);
      if (workflowIds.size && !workflowIds.has(j.run_id)) jobRunIdUnmatched++;
    }
    if (j.head_sha != null && (typeof j.head_sha !== "string" ||
      j.head_sha.toLowerCase() !== match)) jobShaMismatched++;
    if (!allowedStates.has(j.status)) issues.add("unknown_job_status");
    if (unfinishedStates.has(j.status)) unfinishedJobs++;
    if (j.status === "completed" && failedConclusions.has(j.conclusion)) failedJobs++;
    if (j.status === "completed" && !["success", "neutral", "skipped"].includes(j.conclusion)
      && !failedConclusions.has(j.conclusion)) issues.add("unknown_job_conclusion");
    if (typeof j.runner_name === "string" && j.runner_name.trim()) jobsWithRunner++;
    if (j.started_at) { dateMs(j.started_at, "job.started_at"); observedStartedJobs++; }
    if (j.status === "queued" || j.status === "waiting") {
      queuedJobs++;
      if (!j.started_at && !j.runner_name && j.created_at) {
        const created = dateMs(j.created_at, "job.created_at");
        if (created > observed) issues.add("future_created_at");
        else if (observed - created >= threshold * 60_000) oldQueuedJobs++;
      }
    }
  }
  let exactCountMatch = false;
  if (declaredTotals) {
    if (checks.length < apiTotals.checkRuns) issues.add("incomplete_check_run_pagination");
    if (checks.length > apiTotals.checkRuns) issues.add("check_run_total_mismatch");
    if (workflows.length < apiTotals.workflowRuns) issues.add("incomplete_workflow_run_pagination");
    if (workflows.length > apiTotals.workflowRuns) issues.add("workflow_run_total_mismatch");
    for (const id of workflowIds) {
      if (!declaredTotals.has(id)) issues.add("workflow_job_total_missing");
    }
    for (const [id, total] of declaredTotals) {
      if (!workflowIds.has(id)) issues.add("job_total_for_unknown_workflow");
      const observedCount = observedJobsByRun.get(id) || 0;
      if (observedCount < total) issues.add("incomplete_job_pagination");
      if (observedCount > total) issues.add("job_total_mismatch");
    }
    exactCountMatch = checks.length === apiTotals.checkRuns
      && workflows.length === apiTotals.workflowRuns
      && declaredTotals.size === workflowIds.size
      && [...declaredTotals].every(([id, total]) =>
        workflowIds.has(id) && (observedJobsByRun.get(id) || 0) === total);
  }
  if (jobRunIdUnmatched) issues.add("job_run_id_not_in_workflow_snapshot");
  if (jobShaMismatched) issues.add("job_head_sha_mismatch");
  // GitHub jobs have run_id. If the snapshot contains workflow IDs, job
  // linkage and coverage can be checked; otherwise never claim coverage.
  if (workflowIds.size && jobRunIdMissing) issues.add("job_run_id_unverified");
  if (workflowIds.size && observedJobRunIds.size < workflowIds.size) {
    issues.add("workflow_job_coverage_partial");
  }
  if (!checks.length) issues.add("missing_check_evidence");
  if (!workflows.length) issues.add("missing_workflow_evidence");
  if (!jobs.length) issues.add("missing_job_evidence");
  if (counts.failure) issues.add("failed_checks");
  if (failedWorkflows) issues.add("failed_workflows");
  if (failedJobs) issues.add("failed_jobs");
  if (counts.queued || counts.inProgress || unfinishedWorkflows || unfinishedJobs) issues.add("unfinished_execution");
  if (oldQueuedJobs) issues.add("unassigned_queue_age_threshold_exceeded");
  if (agedQueuedWorkflows) issues.add("workflow_queue_age_threshold_exceeded");
  if (checks.length && counts.skipped === checks.length) issues.add("skipped_only_not_proof");
  const issueCodes = Object.freeze([...issues].sort());
  return Object.freeze({
    headSha: match, observedAt: input.observedAt,
    timestampProvenance: "caller_supplied_unverified", repositoryLoad,
    checkCounts: Object.freeze(counts), workflowCount: workflows.length,
    workflowQueue: Object.freeze({ queued: queuedWorkflows, olderThanThreshold: agedQueuedWorkflows,
      unfinished: unfinishedWorkflows, failed: failedWorkflows }),
    jobCounts: Object.freeze({ total: jobs.length, queued: queuedJobs, runnerAssigned: jobsWithRunner,
      started: observedStartedJobs, olderThanThresholdWithoutAssignment: oldQueuedJobs,
      unfinished: unfinishedJobs, failed: failedJobs }),
    apiCoverage: Object.freeze({
      totalsSupplied: !!declaredTotals,
      countMatch: exactCountMatch,
      checkRunsReturned: checks.length,
      checkRunsReportedTotal: declaredTotals ? apiTotals.checkRuns : null,
      workflowRunsReturned: workflows.length,
      workflowRunsReportedTotal: declaredTotals ? apiTotals.workflowRuns : null,
      jobTotalsReportedFor: declaredTotals ? declaredTotals.size : 0,
      enumerationConsistent: exactCountMatch && checks.length > 0
        && workflows.length > 0 && jobs.length > 0 && ![
        "invalid_or_duplicate_check_id", "invalid_or_duplicate_job_id",
        "invalid_or_duplicate_workflow_id", "check_run_identity_missing",
        "workflow_id_missing", "job_identity_missing", "job_run_id_unverified",
        "job_run_id_not_in_workflow_snapshot", "job_head_sha_mismatch"
      ].some((code) => issues.has(code)),
      apiResponsesIndependentlyVerified: false
    }),
    jobLinkage: Object.freeze({ workflowIdsObserved: workflowIds.size,
      jobRunIdsObserved: observedJobRunIds.size, missingRunId: jobRunIdMissing,
      unmatchedRunId: jobRunIdUnmatched, mismatchedHeadSha: jobShaMismatched,
      everyWorkflowIdRepresentedInSample: workflowIds.size > 0 && workflowIds.size === observedJobRunIds.size
        && !jobRunIdMissing && !jobRunIdUnmatched && !jobShaMismatched,
      completeJobInventoryVerified: false }),
    issueCodes, diagnosis: issueCodes.length ? "release_evidence_blocked" : "required_gate_scope_unverified",
    runnerCauseDetermined: false, requiredChecksPolicyVerified: false,
    exactHeadReleaseGreen: false, productionAuthorized: false,
    nextGate: oldQueuedJobs
      ? "Repository administrator: inspect Actions runner provisioning, account usage/billing, permissions, concurrency and GitHub Support for a stuck queue. Do not bypass checks."
      : "Inspect required-check scope, runner assignment, billing/permissions and full exact-head execution. Do not treat this snapshot as release approval."
  });
}
module.exports = Object.freeze({ analyzeActionsQueueSnapshot });
