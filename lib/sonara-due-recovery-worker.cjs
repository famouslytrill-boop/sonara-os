// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Only call from an explicitly approved, authenticated server worker. There is
// no polling, timer, route, deployment or automatic activation in this module.
// Database claimDue atomically transitions queued->started before this returns.
// Any crash after that point remains started and requires operator review.
async function runOneDueRecovery({
  enabled = false, worker, authorize, perform, verify, nowMs = Date.now()
} = {}) {
  if (enabled !== true) return { status: "disabled", reason: "worker_not_activated" };
  if (!worker || typeof worker.claimDue !== "function" ||
      typeof worker.complete !== "function" ||
      typeof authorize !== "function" || typeof perform !== "function" ||
      typeof verify !== "function") {
    return { status: "escalated", reason: "worker_dependencies_missing" };
  }
  let job;
  try { job = await worker.claimDue(); }
  catch { return { status: "escalated", reason: "due_claim_unavailable" }; }
  if (!job) return { status: "idle", reason: "no_due_work" };

  // These identities come from the committed database claim, not a webhook.
  const context = Object.freeze({
    jobId: job.jobId, claimToken: job.claimToken,
    fencingToken: job.fencingToken, resourceKey: job.resourceKey,
    organizationId: job.organizationId, operationId: job.operationId,
    attempt: job.attempt, deadlineAtMs: job.deadlineAtMs
  });
  async function close(outcome) {
    try { return (await worker.complete({jobId: context.jobId,
      claimToken: context.claimToken, outcome})) === true; }
    catch { return false; }
  }
  if (!Number.isSafeInteger(nowMs) || nowMs >= job.deadlineAtMs - 1000) {
    return (await close("failed"))
      ? { status: "escalated", reason: "deadline_expired_after_claim" }
      : { status: "escalated", reason: "deadline_and_terminal_audit_failed" };
  }
  try {
    const auth = await authorize(context);
    if (!auth || auth.authorized !== true || auth.tenantVerified !== true ||
        auth.idempotencyVerified !== true || auth.fencingVerified !== true ||
        auth.operationRetryable !== true) {
      return (await close("unverified"))
        ? { status: "escalated", reason: "current_authority_not_proven" }
        : { status: "escalated", reason: "authorization_and_terminal_audit_failed" };
    }
    // No catch-and-repeat: external effects may succeed even when the response
    // is lost. Client handlers MUST use provider idempotency and fencing.
    await perform(context);
    const measured = await verify(context);
    const healthy = measured?.healthy === true &&
      measured?.tenantVerified === true &&
      measured?.operationVerified === true;
    if (!(await close(healthy ? "verified" : "unverified"))) {
      return { status: "escalated", reason: "terminal_audit_failed" };
    }
    return healthy
      ? { status: "recovered", reason: "independent_check_passed" }
      : { status: "escalated", reason: "post_action_evidence_missing" };
  } catch {
    return (await close("failed"))
      ? { status: "escalated", reason: "external_outcome_ambiguous" }
      : { status: "escalated", reason: "external_outcome_and_audit_ambiguous" };
  }
}
module.exports = { runOneDueRecovery };
