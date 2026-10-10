// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { planRemediation } = require("./sonara-self-healing-supervisor.cjs");

// The enqueue step has no provider adapter by design. Scheduling is NOT
// permission to perform a side effect. A future worker requires an atomic,
// database-verified due claim plus fresh tenant/operation authorization.
async function enqueueBoundedRetry(incident, {
  enabled = false, nowMs = Date.now(), scheduler
} = {}) {
  const plan = planRemediation(incident, { nowMs });
  if (plan.decision !== "eligible") return { status: "escalated", reason: plan.reason };
  if (plan.action !== "retry_idempotent") return { status: "escalated", reason: "not_a_delayed_retry" };
  if (enabled !== true) return { status: "disabled", reason: "runtime_automation_not_enabled" };
  if (!scheduler || typeof scheduler.schedule !== "function") {
    return { status: "escalated", reason: "durable_retry_scheduler_missing" };
  }
  const notBeforeMs = nowMs + plan.delayMs;
  if (!Number.isSafeInteger(notBeforeMs) || notBeforeMs + 1000 >= incident.deadlineAtMs) {
    return { status: "escalated", reason: "deadline_exceeded" };
  }
  const job = Object.freeze({
    // Deliberately omit prompt, email, provider credentials and customer data.
    resourceKey: plan.resourceKey, incidentId: plan.incidentId,
    organizationId: plan.organizationId, operationId: plan.operationId,
    attempt: incident.attempt,
    action: plan.action, notBeforeMs, deadlineAtMs: incident.deadlineAtMs,
    // Stable identity enables atomic deduplication across monitor replicas.
    dedupeKey: JSON.stringify([plan.resourceKey, plan.operationId, incident.attempt])
  });
  try {
    const outcome = await scheduler.schedule(job);
    if (outcome?.persisted === true && outcome?.notBeforeMs === notBeforeMs) {
      return { status: "scheduled", reason: "durable_retry_intent_accepted", notBeforeMs };
    }
    if (outcome?.duplicate === true) return { status: "suppressed", reason: "retry_already_scheduled" };
    return { status: "escalated", reason: "schedule_not_confirmed" };
  } catch {
    return { status: "escalated", reason: "scheduler_unavailable" };
  }
}
module.exports = { enqueueBoundedRetry };
