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
  const issues = new Set();
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
  const match = input.headSha.toLowerCase();
  for (const c of checks) {
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
    timestampProvenance: "caller_supplied_unverified",
    checkCounts: Object.freeze(counts), workflowCount: workflows.length,
    workflowQueue: Object.freeze({ queued: queuedWorkflows, olderThanThreshold: agedQueuedWorkflows,
      unfinished: unfinishedWorkflows, failed: failedWorkflows }),
    jobCounts: Object.freeze({ total: jobs.length, queued: queuedJobs, runnerAssigned: jobsWithRunner,
      started: observedStartedJobs, olderThanThresholdWithoutAssignment: oldQueuedJobs,
      unfinished: unfinishedJobs, failed: failedJobs }),
    issueCodes, diagnosis: issueCodes.length ? "release_evidence_blocked" : "required_gate_scope_unverified",
    runnerCauseDetermined: false, requiredChecksPolicyVerified: false,
    exactHeadReleaseGreen: false, productionAuthorized: false,
    nextGate: oldQueuedJobs
      ? "Repository administrator: inspect Actions runner provisioning, account usage/billing, permissions, concurrency and GitHub Support for a stuck queue. Do not bypass checks."
      : "Inspect required-check scope, runner assignment, billing/permissions and full exact-head execution. Do not treat this snapshot as release approval."
  });
}
module.exports = Object.freeze({ analyzeActionsQueueSnapshot });
