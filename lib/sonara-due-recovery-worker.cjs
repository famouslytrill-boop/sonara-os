// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Only call from an explicitly approved, authenticated server worker. There is
// no polling, timer, route, deployment or automatic activation in this module.
// Database claimDue atomically transitions queued->started before this returns.
// Any crash after that point remains started and requires operator review.
async function runOneDueRecovery({
  enabled = false, worker, authorize, perform, verify, nowMs = Date.now(),
  clock = () => Date.now(), isPaused
} = {}) {
  if (enabled !== true) return { status: "disabled", reason: "worker_not_activated" };
  if (!worker || typeof worker.claimDue !== "function" ||
      typeof worker.complete !== "function" ||
      typeof authorize !== "function" || typeof perform !== "function" ||
      typeof verify !== "function" || typeof clock !== "function" ||
      typeof isPaused !== "function") {
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
  if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(job.deadlineAtMs) ||
      nowMs >= job.deadlineAtMs - 1000) {
    return (await close("failed"))
      ? { status: "escalated", reason: "deadline_expired_after_claim" }
      : { status: "escalated", reason: "deadline_and_terminal_audit_failed" };
  }
  let effectAttempted = false;
  try {
    const auth = await authorize(context);
    if (!auth || auth.authorized !== true || auth.tenantVerified !== true ||
        auth.idempotencyVerified !== true || auth.fencingVerified !== true ||
        auth.operationRetryable !== true) {
      return (await close("unverified"))
        ? { status: "escalated", reason: "current_authority_not_proven" }
        : { status: "escalated", reason: "authorization_and_terminal_audit_failed" };
    }
    // Authorization can take time. Read a fresh server clock before making
    // any external effect, rather than trusting the initial deadline snapshot.
    const freshNow = clock();
    if (!Number.isSafeInteger(freshNow) || freshNow >= context.deadlineAtMs - 1000) {
      return (await close("unverified"))
        ? { status: "escalated", reason: "deadline_expired_during_authorization" }
        : { status: "escalated", reason: "pre_effect_deadline_audit_failed" };
    }
    // The operator's live kill switch is rechecked after authorization.
    // It must be backed by authoritative control-plane state when activated.
    if (await isPaused(context) !== false) {
      return (await close("unverified"))
        ? { status: "escalated", reason: "recovery_paused" }
        : { status: "escalated", reason: "pause_and_terminal_audit_failed" };
    }
    // Pause checks may themselves block; the deadline is re-evaluated
    // immediately before the provider adapter, not just before isPaused().
    const afterPauseMs = clock();
    if (!Number.isSafeInteger(afterPauseMs) ||
        afterPauseMs >= context.deadlineAtMs - 1000) {
      return (await close("unverified"))
        ? { status: "escalated", reason: "deadline_expired_during_pause_check" }
        : { status: "escalated", reason: "pre_effect_deadline_audit_failed" };
    }
    // No catch-and-repeat: external effects may succeed even when the response
    // is lost. Client handlers MUST use provider idempotency and fencing.
    effectAttempted = true;
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
    // A failure before the effect is not a provider-outcome ambiguity.
    // Either way, the started claim remains non-reclaimable automatically.
    return (await close(effectAttempted ? "failed" : "unverified"))
      ? { status: "escalated", reason: effectAttempted ? "external_outcome_ambiguous" : "pre_effect_evidence_unavailable" }
      : { status: "escalated", reason: "external_outcome_and_audit_ambiguous" };
  }
}
module.exports = { runOneDueRecovery };
