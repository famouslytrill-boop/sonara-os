// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { admitTrustedIncident } = require("./sonara-trusted-incident-admission.cjs");
const { enqueueBoundedRetry } = require("./sonara-recovery-scheduling.cjs");

// This is the ONLY composition boundary for future signed monitor ingestion.
// It never calls a provider or runs workers; it schedules safe, due-gated
// intentions only after trusted observation authentication and registry lookup.
async function ingestAuthenticatedRecoveryEvidence(event, {
  enabled = false, registry, scheduler, nowMs = Date.now()
} = {}) {
  if (enabled !== true) return Object.freeze({ status: "disabled", reason: "recovery_not_enabled" });
  if (!registry || typeof registry.lookup !== "function" ||
      typeof registry.verifyObservation !== "function" ||
      !scheduler || typeof scheduler.schedule !== "function") {
    return Object.freeze({ status: "escalated", reason: "trusted_adapters_missing" });
  }
  const admitted = await admitTrustedIncident(event, { registry, nowMs });
  if (admitted.admitted !== true) {
    return Object.freeze({ status: "escalated", reason: admitted.reason });
  }
  if (admitted.plan.action !== "retry_idempotent") {
    return Object.freeze({ status: "escalated", reason: "non_retry_runbook_requires_manual_review" });
  }
  // Registry-owned idempotency and tenant metadata are passed to the durable
  // scheduler; untrusted incident fields cannot assert repair authority.
  const result = await enqueueBoundedRetry(admitted.incident, { enabled: true, scheduler, nowMs });
  return Object.freeze(result);
}
module.exports = { ingestAuthenticatedRecoveryEvidence };
