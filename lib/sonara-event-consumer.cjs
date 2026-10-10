// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const crypto = require("node:crypto");
const { DELIVERY_POLICY } = require("./sonara-event-driven-agent-contract.cjs");
const { nextRetry } = require("./sonara-delivery-retry-policy.cjs");
const { emitEvent: defaultEmitEvent } = require("./sonara-structured-log.cjs");

const CANARY_KIND = "agent.work.completed";
const CANARY_PRODUCER_PREFIX = "sonara-event-consumer-canary";
const CANARY_ACTION = "consumer_canary";
const DEFAULT_CONSUMER = "sonara-event-consumer";
const CLAIM_LEASE_MS = 5 * 60 * 1000;
const HANDLER_TIMEOUT_MS = 30 * 1000;
const LEASE_SETTLEMENT_RESERVE_MS = 10 * 1000;
const BACKOFF_BASE_MS = 5 * 1000;
const BACKOFF_MAX_MS = 5 * 60 * 1000;

const CONSUMER_SLO = Object.freeze({
  deliveryRatioTarget: 0.99,
  deadLetterRatioMax: 0.01,
  p95HandlerDurationMsMax: 10_000
});

const CANARY_ACTIVATION_GATE = Object.freeze({
  minSamples: 20,
  deliveryRatioTarget: 1,
  retryRatioMax: 0,
  deadLetterRatioMax: 0,
  p95HandlerDurationMsMax: 5_000
});

function readEventConsumerActivationConfig(getEnv = (name) => process.env[name]) {
  const enabled = String(getEnv("SONARA_EVENT_CONSUMER_ENABLED") || "").trim().toLowerCase() === "true";
  const organizationId = String(getEnv("SONARA_EVENT_CONSUMER_CANARY_ORG_ID") || "").trim();

  if (!enabled) {
    return { ok: true, enabled: false, organizationId: null, mode: "canary" };
  }
  if (!isUuid(organizationId)) {
    return { ok: false, enabled: true, organizationId: null, mode: "canary", code: "canary_org_required" };
  }
  return { ok: true, enabled: true, organizationId, mode: "canary" };
}

function createEventConsumerWorker({
  repository,
  handlers = {},
  emitEvent = defaultEmitEvent,
  now = () => new Date(),
  claimIdFactory = () => crypto.randomUUID(),
  handlerTimeoutMs = HANDLER_TIMEOUT_MS,
  maxAttempts = DELIVERY_POLICY.maxDeliveryAttempts,
  backoffBaseMs = BACKOFF_BASE_MS,
  backoffMaxMs = BACKOFF_MAX_MS
} = {}) {
  if (!repository || typeof repository.claimNextFiltered !== "function" || typeof repository.settle !== "function") {
    throw new TypeError("repository.claimNextFiltered and repository.settle are required");
  }
  // A worker must time out well before the database's fixed five-minute
  // claim lease expires. Otherwise another worker can reclaim the same
  // event while the original handler still runs. This reserve is only a
  // defensive budget; actual provider calls still need idempotency and
  // authority-verified completion receipts.
  if (!Number.isSafeInteger(handlerTimeoutMs) || handlerTimeoutMs < 1
    || handlerTimeoutMs >= CLAIM_LEASE_MS - LEASE_SETTLEMENT_RESERVE_MS) {
    throw new RangeError("handlerTimeoutMs must be a positive integer below the claim lease safety budget");
  }

  async function runOnce({
    enabled = false,
    organizationId,
    consumer = DEFAULT_CONSUMER,
    kinds,
    producers
  } = {}) {
    if (!enabled) return { ok: true, status: "disabled", sample: null };

    const scope = requiredString(organizationId, "organizationId");
    const consumerName = requiredString(consumer, "consumer");
    const eventKinds = requiredList(kinds, "kinds");
    const eventProducers = requiredList(producers, "producers");
    const claimOwner = buildClaimOwner(consumerName, claimIdFactory());
    const claimTime = now();

    const claim = await safelyCallRepository(() => repository.claimNextFiltered({
      organizationId: scope,
      consumer: claimOwner,
      kinds: eventKinds,
      producers: eventProducers,
      now: claimTime.toISOString()
    }), "claim_request_failed");

    if (!claim?.ok) {
      emitConsumerEvent(emitEvent, {
        organizationId: scope,
        outcome: "failed",
        reason: claim?.code || "claim_failed",
        detail: { consumer: consumerName }
      });
      return { ok: false, status: "claim_failed", code: claim?.code || "claim_failed", sample: null };
    }
    if (!claim.row) return { ok: true, status: "idle", sample: null };

    const row = claim.row;
    // Claim RPC uses a server-side service credential. A faulty SQL filter
    // must not become authority to handle another tenant's event, or an
    // unrelated producer's work. Refuse without handler/settlement side effects.
    if (row.organization_id !== scope || !eventKinds.includes(row.kind) || !eventProducers.includes(row.producer)) {
      emitConsumerEvent(emitEvent, {
        organizationId: scope,
        outcome: "failed",
        reason: "claim_scope_mismatch",
        detail: { consumer: consumerName }
      });
      return { ok: false, status: "claim_scope_mismatch", code: "claim_scope_mismatch", sample: null };
    }
    const handler = handlers[row.kind];
    const startedAt = now();
    const queueAgeMs = elapsedMs(row.created_at, startedAt);
    const attemptCount = boundedPositiveInt(row.attempt_count, 1);
    let handlerOutcome;
    let handlerError = null;

    if (typeof handler !== "function") {
      handlerOutcome = { ok: false, code: "handler_missing", retryable: false };
    } else {
      try {
        handlerOutcome = await withTimeout(
          Promise.resolve(handler({
            organizationId: scope,
            eventId: row.event_id,
            eventOutboxId: row.id,
            idempotencyKey: row.idempotency_key,
            correlationId: row.correlation_id,
            kind: row.kind,
            action: row.action,
            producer: row.producer,
            payload: row.payload,
            attemptCount
          })),
          handlerTimeoutMs
        );
        // A missing/ambiguous result is not evidence of completed work.
        // Only an explicit { ok: true } can settle a durable message as
        // delivered. An invalid response is permanently quarantined instead
        // of retried blindly: a handler might already have performed an
        // irreversible provider operation before returning the wrong shape.
        if (!handlerOutcome || typeof handlerOutcome !== "object"
          || Array.isArray(handlerOutcome) || typeof handlerOutcome.ok !== "boolean") {
          handlerOutcome = { ok: false, code: "handler_result_invalid", retryable: false };
        }
      } catch (error) {
        handlerError = error;
        handlerOutcome = {
          ok: false,
          code: safeErrorCode(error),
          // A timeout does not stop an in-flight handler. The side effect may
          // already have happened or may finish after this catch. Automatic
          // replay is unsafe even when the provider error appears transient:
          // quarantine and reconcile the authoritative provider receipt.
          // Unknown errors are not known-safe retries. Require an explicit
          // retryable:true classification from the approved handler; timeouts
          // remain non-retryable even if a generic client marks them retryable.
          retryable: error?.code !== "handler_timeout" && error?.retryable === true
        };
      }
    }

    const finishedAt = now();
    const handlerDurationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

    if (handlerOutcome.ok) {
      const settled = await safelyCallRepository(() => repository.settle({
        organizationId: scope,
        eventOutboxId: row.id,
        consumer: claimOwner,
        outcome: "delivered",
        now: finishedAt.toISOString()
      }), "settle_request_failed");
      if (!settled?.ok) {
        emitConsumerEvent(emitEvent, {
          organizationId: scope,
          outcome: "failed",
          reason: settled?.code || "settle_failed",
          correlationId: row.correlation_id,
          capability: row.kind,
          detail: { attempt_count: attemptCount, queue_age_ms: queueAgeMs, handler_duration_ms: handlerDurationMs }
        });
        return {
          ok: false,
          status: "settlement_failed",
          code: settled?.code || "settle_failed",
          sample: sample("settlement_failed", attemptCount, queueAgeMs, handlerDurationMs, row.id)
        };
      }

      emitConsumerEvent(emitEvent, {
        organizationId: scope,
        outcome: "ok",
        correlationId: row.correlation_id,
        capability: row.kind,
        detail: { attempt_count: attemptCount, queue_age_ms: queueAgeMs, handler_duration_ms: handlerDurationMs }
      });
      return {
        ok: true,
        status: "delivered",
        row: settled.row,
        sample: sample("delivered", attemptCount, queueAgeMs, handlerDurationMs, row.id)
      };
    }

    const code = safeErrorCode(handlerError || handlerOutcome);
    // At-least-once delivery does not make external side effects safe to
    // repeat. Only explicitly classified transient failures may be replayed.
    const permanent = handlerOutcome.retryable !== true;
    const exhausted = attemptCount >= maxAttempts;
    // Only handlers that provide bounded provider metadata use the new policy.
    // Existing synthetic canary handlers retain their exact previous backoff,
    // so the activation gate cannot be silently changed by this integration.
    const retryPlan = retryPlanForOutcome(handlerOutcome, attemptCount, finishedAt);
    const policyTerminal = retryPlan && retryPlan.status !== "scheduled";
    const outcome = permanent || exhausted || policyTerminal ? "dead_lettered" : "retry";
    let backoffMs = 0;
    let nextAvailableAt = null;
    if (outcome === "retry") {
      backoffMs = retryPlan
        ? retryPlan.delaySeconds * 1000
        : computeBackoffMs(attemptCount, { baseMs: backoffBaseMs, maxMs: backoffMaxMs });
      nextAvailableAt = retryPlan
        ? retryPlan.dueAt
        : new Date(finishedAt.getTime() + backoffMs).toISOString();
    }
    // Never log a raw Retry-After header, exception body or notification text.
    const settlementCode = policyTerminal ? retryPlan.reason : code;

    const settled = await safelyCallRepository(() => repository.settle({
      organizationId: scope,
      eventOutboxId: row.id,
      consumer: claimOwner,
      outcome,
      errorCode: settlementCode,
      nextAvailableAt,
      now: finishedAt.toISOString()
    }), "settle_request_failed");

    if (!settled?.ok) {
      emitConsumerEvent(emitEvent, {
        organizationId: scope,
        outcome: "failed",
        reason: settled?.code || "settle_failed",
        correlationId: row.correlation_id,
        capability: row.kind,
        detail: { attempt_count: attemptCount, queue_age_ms: queueAgeMs, handler_duration_ms: handlerDurationMs }
      });
      return {
        ok: false,
        status: "settlement_failed",
        code: settled?.code || "settle_failed",
        sample: sample("settlement_failed", attemptCount, queueAgeMs, handlerDurationMs, row.id)
      };
    }

    emitConsumerEvent(emitEvent, {
      organizationId: scope,
      outcome: outcome === "retry" ? "degraded" : "failed",
      reason: settlementCode,
      correlationId: row.correlation_id,
      capability: row.kind,
      detail: {
        attempt_count: attemptCount,
        queue_age_ms: queueAgeMs,
        handler_duration_ms: handlerDurationMs,
        backoff_ms: backoffMs,
        settlement: outcome
      }
    });

    return {
      ok: outcome === "retry",
      status: outcome,
      code: settlementCode,
      nextAvailableAt,
      row: settled.row,
      sample: sample(outcome, attemptCount, queueAgeMs, handlerDurationMs, row.id)
    };
  }

  return Object.freeze({ runOnce });
}

// Repository adapters may reject or synchronously throw (network transport,
// malformed responses, injected faults). Neither a claim nor a settlement
// exception proves anything about durable queue state. Return a stable,
// non-sensitive code and let the existing failure path emit structured
// evidence; never expose exception.message, which can contain provider URLs
// and credentials. A failed settlement must not blindly repeat side effects.
async function safelyCallRepository(operation, code) {
  try {
    return await operation();
  } catch {
    return { ok: false, code, row: null };
  }
}

/**
 * Maps an internal handler's provider delay / expiry hints to an auditable
 * retry decision. No provider call or background timer happens here.
 *
 * The Web Push sender returns retryAfterSeconds and retryAfterStatus. Handlers
 * may forward those fields when they return { ok:false, retryable:true }.
 * A provider hold too far into the future or a message past its useful expiry
 * becomes a dead letter for operator review rather than a premature retry.
 */
function retryPlanForOutcome(handlerOutcome, attemptCount, finishedAt) {
  if (!handlerOutcome || typeof handlerOutcome !== "object") return null;
  if (handlerOutcome.retryAfterStatus === "too_far") {
    return { status: "operator_review", reason: "provider_delay_exceeds_policy" };
  }

  const hasDelay = handlerOutcome.retryAfterSeconds !== null &&
    handlerOutcome.retryAfterSeconds !== undefined;
  const hasExpiry = handlerOutcome.expiresAtMs !== null &&
    handlerOutcome.expiresAtMs !== undefined;
  if (!hasDelay && !hasExpiry) return null;

  if (hasDelay && (!Number.isSafeInteger(handlerOutcome.retryAfterSeconds) ||
      handlerOutcome.retryAfterSeconds < 0)) {
    return { status: "invalid", reason: "invalid_provider_retry_delay" };
  }
  if (hasExpiry && (!Number.isFinite(handlerOutcome.expiresAtMs) ||
      handlerOutcome.expiresAtMs < 0)) {
    return { status: "invalid", reason: "invalid_expiry" };
  }

  return nextRetry({
    attempt: attemptCount,
    retryAfter: hasDelay ? String(handlerOutcome.retryAfterSeconds) : null,
    expiresAtMs: hasExpiry ? handlerOutcome.expiresAtMs : null,
    nowMs: finishedAt.getTime(),
    jitter: 0.5
  });
}

function computeBackoffMs(attemptCount, { baseMs = BACKOFF_BASE_MS, maxMs = BACKOFF_MAX_MS } = {}) {
  const attempt = Math.max(1, Number.parseInt(attemptCount, 10) || 1);
  const base = Math.max(1, Number.parseInt(baseMs, 10) || BACKOFF_BASE_MS);
  const max = Math.max(base, Number.parseInt(maxMs, 10) || BACKOFF_MAX_MS);
  return Math.min(max, base * (2 ** Math.max(0, attempt - 1)));
}

// Never discard a missing sample: claim failures and idle/duplicate results
// are observations, not successful deliveries. Null must never coerce to 0ms.
function validCanarySample(item) {
  return item !== null
    && typeof item === "object"
    && !Array.isArray(item)
    && ["delivered", "retry", "dead_lettered", "settlement_failed"].includes(item.status)
    && typeof item.eventOutboxId === "string"
    && item.eventOutboxId.trim().length > 0
    && Number.isSafeInteger(item.attemptCount) && item.attemptCount >= 1
    && typeof item.queueAgeMs === "number" && Number.isFinite(item.queueAgeMs) && item.queueAgeMs >= 0
    && typeof item.handlerDurationMs === "number" && Number.isFinite(item.handlerDurationMs) && item.handlerDurationMs >= 0;
}

function summarizeConsumerSamples(samples = []) {
  const observed = Array.isArray(samples) ? samples : [];
  const total = observed.length;
  const usable = observed.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  const valid = usable.filter(validCanarySample);
  const count = (status) => usable.filter((item) => item.status === status).length;
  const durations = valid
    .filter((item) => item.status === "delivered")
    .map((item) => item.handlerDurationMs)
    .sort((a, b) => a - b);
  const delivered = count("delivered");
  const retry = count("retry");
  const deadLettered = count("dead_lettered");
  const deliveredIds = valid.filter((item) => item.status === "delivered").map((item) => item.eventOutboxId);
  return Object.freeze({
    total,
    validSamples: valid.length,
    invalidSamples: total - valid.length,
    delivered,
    uniqueDelivered: new Set(deliveredIds).size,
    multiAttemptCount: valid.filter((item) => item.attemptCount > 1).length,
    retry,
    deadLettered,
    settlementFailed: count("settlement_failed"),
    deliveryRatio: total ? delivered / total : 0,
    retryRatio: total ? retry / total : 0,
    deadLetterRatio: total ? deadLettered / total : 0,
    p95HandlerDurationMs: percentile(durations, 0.95)
  });
}

function evaluateCanaryActivation(samples = [], gate = CANARY_ACTIVATION_GATE, { expectedEventOutboxIds = null } = {}) {
  const metrics = summarizeConsumerSamples(samples);
  const valid = (Array.isArray(samples) ? samples : []).filter(validCanarySample);
  const expected = Array.isArray(expectedEventOutboxIds) ? expectedEventOutboxIds : [];
  // Activation is a claim about this specific set of enqueued records, not
  // merely about N "delivered" status strings. Missing IDs are not evidence.
  const uniqueExpected = new Set(expected);
  const uniqueObserved = new Set(valid.filter((item) => item.status === "delivered").map((item) => item.eventOutboxId));
  const expectedValid = expected.length >= gate.minSamples
    && expected.every((id) => typeof id === "string" && id.trim().length > 0)
    && uniqueExpected.size === expected.length;
  const checks = Object.freeze({
    enoughSamples: metrics.total >= gate.minSamples,
    sampleIntegrity: metrics.invalidSamples === 0
      && metrics.total === expected.length
      && metrics.uniqueDelivered === metrics.delivered,
    expectedDelivery: expectedValid
      && uniqueObserved.size === uniqueExpected.size
      && expected.every((id) => uniqueObserved.has(id)),
    firstAttemptOnly: metrics.multiAttemptCount === 0,
    deliveryRatio: metrics.deliveryRatio >= gate.deliveryRatioTarget,
    retryRatio: metrics.retryRatio <= gate.retryRatioMax,
    deadLetterRatio: metrics.deadLetterRatio <= gate.deadLetterRatioMax,
    p95HandlerDuration: metrics.p95HandlerDurationMs !== null
      && metrics.p95HandlerDurationMs <= gate.p95HandlerDurationMsMax
  });
  return Object.freeze({
    ok: Object.values(checks).every(Boolean),
    metrics,
    checks,
    gate
  });
}

function buildClaimOwner(consumer, claimId) {
  const base = requiredString(consumer, "consumer").slice(0, 96);
  const id = requiredString(claimId, "claimId").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 48);
  return `${base}#${id}`;
}

function withTimeout(promise, timeoutMs) {
  const timeout = Math.max(1, Number.parseInt(timeoutMs, 10) || HANDLER_TIMEOUT_MS);
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error("event consumer handler timed out");
        error.code = "handler_timeout";
        reject(error);
      }, timeout);
      if (typeof timer.unref === "function") timer.unref();
    })
  ]);
}

function emitConsumerEvent(emitEvent, input) {
  if (typeof emitEvent !== "function") return;
  emitEvent({
    event: "event.consumer",
    scope: "organization",
    organizationId: input.organizationId,
    capability: input.capability || "event_outbox",
    outcome: input.outcome,
    correlationId: input.correlationId || null,
    reason: input.reason || null,
    detail: input.detail || null
  });
}

function sample(status, attemptCount, queueAgeMs, handlerDurationMs, eventOutboxId) {
  return Object.freeze({ status, attemptCount, queueAgeMs, handlerDurationMs, eventOutboxId });
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1));
  return values[index];
}

function elapsedMs(iso, end) {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, end.getTime() - start.getTime());
}

function safeErrorCode(error) {
  const code = typeof error?.code === "string" && error.code.trim()
    ? error.code.trim()
    : "handler_failed";
  return code.slice(0, 120);
}

function requiredString(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function requiredList(value, name) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${name} must contain at least one value`);
  const normalized = [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  if (!normalized.length) throw new TypeError(`${name} must contain at least one value`);
  return normalized;
}

function boundedPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

module.exports = {
  CANARY_KIND,
  CANARY_PRODUCER_PREFIX,
  CANARY_ACTION,
  DEFAULT_CONSUMER,
  CLAIM_LEASE_MS,
  HANDLER_TIMEOUT_MS,
  LEASE_SETTLEMENT_RESERVE_MS,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  CONSUMER_SLO,
  CANARY_ACTIVATION_GATE,
  readEventConsumerActivationConfig,
  createEventConsumerWorker,
  computeBackoffMs,
  retryPlanForOutcome,
  summarizeConsumerSamples,
  evaluateCanaryActivation,
  buildClaimOwner
};
