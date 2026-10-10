// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A small, deterministic decision and execution boundary. Importing this
// module has no side effects. It never edits source, schemas, permissions,
// payments, or deployment configuration. Live execution requires an explicit
// operator-provided durable claim ledger and action adapters.

const MAX_OBSERVATION_AGE_MS = 120_000;
const MAX_CLOCK_SKEW_MS = 5_000;
const MAX_AUTOMATIC_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 30_000;
const REPAIR_COOLDOWN_MS = 300_000;
const SAFE_ACTIONS = Object.freeze([
  "retry_idempotent",
  "requeue_expired_lease",
  "open_optional_circuit",
  "pause_optional_lane"
]);
const SIGNAL_ACTIONS = Object.freeze({
  "provider.timeout": "retry_idempotent",
  "provider.rate_limited": "retry_idempotent",
  "worker.lease_expired": "requeue_expired_lease",
  "provider.optional_unavailable": "open_optional_circuit",
  "queue.optional_overload": "pause_optional_lane"
});
const BLOCKED_DOMAINS = Object.freeze([
  "billing", "payments", "refunds", "payouts", "entitlements",
  "security", "identity", "auth", "permissions", "database",
  "migrations", "deployment", "publication", "legal", "regulated"
]);

function boundedIdentifier(value) {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function deny(reason) {
  return Object.freeze({ decision: "escalate", action: null, reason });
}

// FNV-1a: stable across replicas, unlike Math.random(). This is load spreading,
// not security or an idempotency token. Clamp jitter to [0.5,1] of backoff.
function stableJitter(identifier) {
  let hash = 2166136261;
  for (let i = 0; i < identifier.length; i += 1) {
    hash = Math.imul(hash ^ identifier.charCodeAt(i), 16777619) >>> 0;
  }
  return 0.5 + (hash / 4294967295) * 0.5;
}

function retryDelayMs(operationId, attempt, retryAfterMs = 0) {
  const exponential = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** Math.max(0, attempt));
  return Math.max(Math.ceil(exponential * stableJitter(operationId)), retryAfterMs);
}

/**
 * Plan a repair from independently measured, typed incident evidence.
 * No raw error messages are interpreted or echoed. "Automatic" here means
 * eligible for a separately configured executor, not authorized by the event.
 */
function planRemediation(incident, { nowMs = Date.now() } = {}) {
  if (!incident || typeof incident !== "object" || Array.isArray(incident)) return deny("invalid_incident");
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) return deny("invalid_clock");
  if (!boundedIdentifier(incident.incidentId) || !boundedIdentifier(incident.resourceId)) return deny("stable_identity_required");
  if (incident.scope !== "process" && incident.scope !== "organization") return deny("scope_required");
  if (incident.scope === "organization" && !boundedIdentifier(incident.organizationId)) return deny("tenant_required");
  if (incident.scope === "process" && incident.organizationId != null) return deny("mixed_scope");
  if (!Number.isSafeInteger(incident.observedAtMs) || incident.observedAtMs < 0 ||
      incident.observedAtMs > nowMs + MAX_CLOCK_SKEW_MS ||
      nowMs - incident.observedAtMs > MAX_OBSERVATION_AGE_MS) return deny("observation_stale_or_invalid");
  if (incident.sensitive !== false || incident.authorizedScope !== true) return deny("authority_not_proven");
  if (typeof incident.domain !== "string" || BLOCKED_DOMAINS.includes(incident.domain) ||
      !["worker", "optional_provider", "optional_queue"].includes(incident.domain)) return deny("domain_not_authorized");
  const action = SIGNAL_ACTIONS[incident.signal];
  if (!action || !SAFE_ACTIONS.includes(action)) return deny("unknown_or_sensitive_signal");

  let delayMs = 0;
  if (action === "retry_idempotent" || action === "requeue_expired_lease") {
    if (incident.verifiedIdempotency !== true || !boundedIdentifier(incident.operationId)) return deny("idempotency_not_proven");
    if (!nonnegativeInteger(incident.attempt) || incident.attempt >= MAX_AUTOMATIC_ATTEMPTS) return deny("retry_ceiling_reached");
    if (action === "retry_idempotent") {
      if (incident.domain !== "optional_provider" || !Number.isSafeInteger(incident.deadlineAtMs)) return deny("retry_contract_missing");
      if (incident.retryAfterMs !== undefined && (!nonnegativeInteger(incident.retryAfterMs) || incident.retryAfterMs > MAX_RETRY_DELAY_MS)) return deny("retry_after_outside_budget");
      delayMs = retryDelayMs(incident.operationId, incident.attempt, incident.retryAfterMs || 0);
      if (nowMs + delayMs + 1_000 >= incident.deadlineAtMs) return deny("deadline_exceeded");
    } else {
      if (incident.domain !== "worker" || !nonnegativeInteger(incident.leaseVersion) ||
          !Number.isSafeInteger(incident.leaseExpiresAtMs) || incident.leaseExpiresAtMs >= nowMs) return deny("expired_fenced_lease_required");
    }
  } else if (action === "open_optional_circuit") {
    if (incident.domain !== "optional_provider" || incident.optionalDependency !== true) return deny("optional_dependency_required");
  } else if (action === "pause_optional_lane") {
    if (incident.domain !== "optional_queue" || incident.optionalLane !== true ||
        !nonnegativeInteger(incident.queueDepth) || !nonnegativeInteger(incident.queueLimit) ||
        incident.queueLimit === 0 || incident.queueDepth < incident.queueLimit) return deny("overload_not_proven");
  }

  // Resource key, not event UUID, is the cooldown identity. A noisy monitor
  // cannot evade the budget by inventing a fresh incident ID every poll.
  const resourceKey = JSON.stringify([incident.scope, incident.scope === "organization" ? incident.organizationId : "global",
    action, incident.resourceId]);
  return Object.freeze({
    decision: "eligible", action, reason: "bounded_runtime_recovery",
    incidentId: incident.incidentId, resourceId: incident.resourceId,
    organizationId: incident.scope === "organization" ? incident.organizationId : null,
    scope: incident.scope, resourceKey, delayMs,
    operationId: incident.operationId || null,
    leaseVersion: action === "requeue_expired_lease" ? incident.leaseVersion : null,
    cooldownMs: REPAIR_COOLDOWN_MS
  });
}

/**
 * Report a bounded sample of live requests. Does not invent SLO confidence
 * from one or two requests; uses nearest-rank empirical latency percentiles.
 */
function measureServiceHealth(samples, { sloTarget = 0.999, minimumSamples = 30 } = {}) {
  if (!Array.isArray(samples) || samples.length > 10_000 ||
      !Number.isFinite(sloTarget) || sloTarget <= 0 || sloTarget >= 1 ||
      !Number.isSafeInteger(minimumSamples) || minimumSamples < 1) {
    return { status: "invalid_sample" };
  }
  if (samples.some((sample) => !sample || typeof sample.ok !== "boolean" ||
      !Number.isFinite(sample.latencyMs) || sample.latencyMs < 0)) return { status: "invalid_sample" };
  if (samples.length < minimumSamples) return { status: "insufficient_evidence", sampleCount: samples.length };
  const latencies = samples.map((sample) => sample.latencyMs).sort((a, b) => a - b);
  const failures = samples.filter((sample) => !sample.ok).length;
  const failRate = failures / samples.length;
  const percentile = (fraction) => latencies[Math.ceil(latencies.length * fraction) - 1];
  return Object.freeze({
    status: "measured", sampleCount: samples.length, failures,
    successRate: 1 - failRate, errorRate: failRate,
    burnRate: failRate / (1 - sloTarget),
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99)
  });
}

/**
 * Never called on import. The production integration must provide an atomic,
 * durable resourceKey claim (e.g. Postgres conditional INSERT) and audit sink.
 * Adapters MUST validate current tenant membership, operation state, and
 * fencing token again at execution time. No generated code or SQL is run here.
 */
async function executeRemediation(incident, { enabled = false, ledger, audit, handlers, verify,
  nowMs = Date.now() } = {}) {
  const plan = planRemediation(incident, { nowMs });
  if (plan.decision !== "eligible") return { status: "escalated", reason: plan.reason, action: null };
  if (enabled !== true) return { status: "disabled", reason: "runtime_automation_not_enabled", action: plan.action };
  // Inline retries would bypass backoff and cause provider retry storms.
  // A future worker must hold a durable DB-verified due claim before execution.
  if (plan.action === "retry_idempotent") return { status: "escalated", reason: "durable_due_claim_required", action: plan.action };
  if (!ledger || typeof ledger.claim !== "function" ||
      typeof audit !== "function" || typeof verify !== "function" ||
      !handlers || typeof handlers[plan.action] !== "function") {
    return { status: "escalated", reason: "durable_adapters_missing", action: plan.action };
  }

  // All output and audit fields come from closed policy strings/typed identity.
  const context = Object.freeze({
    action: plan.action, incidentId: plan.incidentId, resourceId: plan.resourceId,
    scope: plan.scope, organizationId: plan.organizationId,
    resourceKey: plan.resourceKey, operationId: plan.operationId,
    leaseVersion: plan.leaseVersion, delayMs: plan.delayMs
  });
  let claimedContext;
  try {
    const claim = await ledger.claim({ resourceKey: plan.resourceKey,
      cooldownMs: plan.cooldownMs, organizationId: plan.organizationId,
      action: plan.action, incidentId: plan.incidentId });
    if (!claim || claim.claimed !== true) return { status: "suppressed", reason: "already_claimed_or_cooling_down", action: plan.action };
    const fencingToken = Number(claim.fencingToken);
    if (typeof claim.claimToken !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claim.claimToken) ||
        !Number.isSafeInteger(fencingToken) || fencingToken < 1) {
      return { status: "escalated", reason: "invalid_durable_claim", action: plan.action };
    }
    claimedContext = Object.freeze({ ...context, claimToken: claim.claimToken, fencingToken });
    // Fail closed: audit must be durable before any side effect occurs.
    if (await audit({ ...claimedContext, state: "claimed" }) !== true) {
      return { status: "escalated", reason: "pre_action_audit_failed", action: plan.action };
    }
    await handlers[plan.action](claimedContext);
    const evidence = await verify(claimedContext);
    const recovered = evidence && evidence.healthy === true && evidence.scopeVerified === true;
    const state = recovered ? "verified" : "unverified";
    if (await audit({ ...claimedContext, state }) !== true) {
      return { status: "escalated", reason: "post_action_audit_failed", action: plan.action };
    }
    return recovered
      ? { status: "recovered", reason: "independently_verified", action: plan.action }
      : { status: "escalated", reason: "recovery_not_verified", action: plan.action };
  } catch {
    // If an action may have run, never auto-reclaim an ambiguous attempt.
    try { if (claimedContext) await audit({ ...claimedContext, state: "failed" }); } catch { /* no unsafe second attempt */ }
    return { status: "escalated", reason: "execution_or_verification_failed", action: plan.action };
  }
}

module.exports = {
  SAFE_ACTIONS, MAX_AUTOMATIC_ATTEMPTS, MAX_OBSERVATION_AGE_MS,
  planRemediation, measureServiceHealth, retryDelayMs, executeRemediation
};
