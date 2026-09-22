// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const crypto = require("node:crypto");
const { DELIVERY_POLICY } = require("./sonara-event-driven-agent-contract.cjs");
const { emitEvent: defaultEmitEvent } = require("./sonara-structured-log.cjs");

const CANARY_KIND = "agent.work.completed";
const CANARY_PRODUCER_PREFIX = "sonara-event-consumer-canary";
const CANARY_ACTION = "check_data_quality";
const DEFAULT_CONSUMER = "sonara-event-consumer";
const CLAIM_LEASE_MS = 5 * 60 * 1000;
const HANDLER_TIMEOUT_MS = 30 * 1000;
const ABORT_GRACE_MS = 5 * 1000;
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
  abortGraceMs = ABORT_GRACE_MS,
  maxAttempts = DELIVERY_POLICY.maxDeliveryAttempts,
  backoffBaseMs = BACKOFF_BASE_MS,
  backoffMaxMs = BACKOFF_MAX_MS
} = {}) {
  if (!repository || typeof repository.claimNextFiltered !== "function" || typeof repository.settle !== "function") {
    throw new TypeError("repository.claimNextFiltered and repository.settle are required");
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

    const claim = await repository.claimNextFiltered({
      organizationId: scope,
      consumer: claimOwner,
      kinds: eventKinds,
      producers: eventProducers,
      now: claimTime.toISOString()
    });

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
    const handler = handlers[row.kind];
    const startedAt = now();
    const queueAgeMs = elapsedMs(row.created_at, startedAt);
    const attemptCount = boundedPositiveInt(row.attempt_count, 1);

    // The first production consumer lane is intentionally low-risk-only.
    // Owner-review work needs a separate capability that resolves canonical
    // approval evidence before dispatch. Until that exists, a sensitive event
    // is terminally refused before any handler can observe its payload.
    const authority = String(row.authority || "").trim();
    if (authority !== "low_risk") {
      const code = authority === "owner_review" ? "owner_review_not_supported" : "event_authority_invalid";
      const finishedAt = now();
      const handlerDurationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
      const settled = await repository.settle({
        organizationId: scope,
        eventOutboxId: row.id,
        consumer: claimOwner,
        outcome: "dead_lettered",
        errorCode: code,
        nextAvailableAt: null,
        now: finishedAt.toISOString()
      });

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
          sample: sample("settlement_failed", attemptCount, queueAgeMs, handlerDurationMs)
        };
      }

      emitConsumerEvent(emitEvent, {
        organizationId: scope,
        outcome: "refused",
        reason: code,
        correlationId: row.correlation_id,
        capability: row.kind,
        detail: {
          attempt_count: attemptCount,
          queue_age_ms: queueAgeMs,
          handler_duration_ms: handlerDurationMs,
          settlement: "dead_lettered"
        }
      });
      return {
        ok: false,
        status: "dead_lettered",
        code,
        row: settled.row,
        sample: sample("dead_lettered", attemptCount, queueAgeMs, handlerDurationMs)
      };
    }

    let handlerOutcome;
    let handlerError = null;

    if (typeof handler !== "function") {
      handlerOutcome = { ok: false, code: "handler_missing", retryable: false };
    } else {
      try {
        handlerOutcome = await invokeHandlerWithCancellation(handler, {
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
        }, {
          timeoutMs: handlerTimeoutMs,
          abortGraceMs
        });
        if (!handlerOutcome || handlerOutcome.ok !== false) handlerOutcome = { ok: true };
      } catch (error) {
        handlerError = error;
        handlerOutcome = {
          ok: false,
          code: safeErrorCode(error),
          retryable: error?.retryable !== false
        };
      }
    }

    const finishedAt = now();
    const handlerDurationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

    if (handlerOutcome.ok) {
      const settled = await repository.settle({
        organizationId: scope,
        eventOutboxId: row.id,
        consumer: claimOwner,
        outcome: "delivered",
        now: finishedAt.toISOString()
      });
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
          sample: sample("settlement_failed", attemptCount, queueAgeMs, handlerDurationMs)
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
        sample: sample("delivered", attemptCount, queueAgeMs, handlerDurationMs)
      };
    }

    const code = safeErrorCode(handlerError || handlerOutcome);
    const permanent = handlerOutcome.retryable === false;
    const exhausted = attemptCount >= maxAttempts;
    const outcome = permanent || exhausted ? "dead_lettered" : "retry";
    const backoffMs = outcome === "retry"
      ? computeBackoffMs(attemptCount, { baseMs: backoffBaseMs, maxMs: backoffMaxMs })
      : 0;
    const nextAvailableAt = outcome === "retry"
      ? new Date(finishedAt.getTime() + backoffMs).toISOString()
      : null;

    const settled = await repository.settle({
      organizationId: scope,
      eventOutboxId: row.id,
      consumer: claimOwner,
      outcome,
      errorCode: code,
      nextAvailableAt,
      now: finishedAt.toISOString()
    });

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
        sample: sample("settlement_failed", attemptCount, queueAgeMs, handlerDurationMs)
      };
    }

    emitConsumerEvent(emitEvent, {
      organizationId: scope,
      outcome: outcome === "retry" ? "degraded" : "failed",
      reason: code,
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
      code,
      nextAvailableAt,
      row: settled.row,
      sample: sample(outcome, attemptCount, queueAgeMs, handlerDurationMs)
    };
  }

  return Object.freeze({ runOnce });
}

function computeBackoffMs(attemptCount, { baseMs = BACKOFF_BASE_MS, maxMs = BACKOFF_MAX_MS } = {}) {
  const attempt = Math.max(1, Number.parseInt(attemptCount, 10) || 1);
  const base = Math.max(1, Number.parseInt(baseMs, 10) || BACKOFF_BASE_MS);
  const max = Math.max(base, Number.parseInt(maxMs, 10) || BACKOFF_MAX_MS);
  return Math.min(max, base * (2 ** Math.max(0, attempt - 1)));
}

function summarizeConsumerSamples(samples = []) {
  const usable = samples.filter((item) => item && typeof item === "object");
  const total = usable.length;
  const count = (status) => usable.filter((item) => item.status === status).length;
  const durations = usable
    .map((item) => Number(item.handlerDurationMs))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const delivered = count("delivered");
  const retry = count("retry");
  const deadLettered = count("dead_lettered");

  return Object.freeze({
    total,
    delivered,
    retry,
    deadLettered,
    settlementFailed: count("settlement_failed"),
    deliveryRatio: total ? delivered / total : 0,
    retryRatio: total ? retry / total : 0,
    deadLetterRatio: total ? deadLettered / total : 0,
    p95HandlerDurationMs: percentile(durations, 0.95)
  });
}

function evaluateCanaryActivation(samples = [], gate = CANARY_ACTIVATION_GATE) {
  const metrics = summarizeConsumerSamples(samples);
  const checks = Object.freeze({
    enoughSamples: metrics.total >= gate.minSamples,
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

async function invokeHandlerWithCancellation(handler, event, {
  timeoutMs = HANDLER_TIMEOUT_MS,
  abortGraceMs = ABORT_GRACE_MS
} = {}) {
  const timeout = Math.max(1, Number.parseInt(timeoutMs, 10) || HANDLER_TIMEOUT_MS);
  const grace = Math.max(1, Number.parseInt(abortGraceMs, 10) || ABORT_GRACE_MS);
  const controller = new AbortController();
  const execution = Promise.resolve().then(() => handler({
    ...event,
    signal: controller.signal,
    deadlineAt: new Date(Date.now() + timeout).toISOString()
  }));
  const observed = execution.then(
    (value) => ({ type: "settled", ok: true, value }),
    (error) => ({ type: "settled", ok: false, error })
  );

  let timeoutTimer;
  const first = await Promise.race([
    observed,
    new Promise((resolve) => {
      timeoutTimer = setTimeout(() => resolve({ type: "timeout" }), timeout);
      if (typeof timeoutTimer.unref === "function") timeoutTimer.unref();
    })
  ]);
  clearTimeout(timeoutTimer);

  if (first.type === "settled") {
    if (first.ok) return first.value;
    throw first.error;
  }

  const timeoutError = new Error("event consumer handler timed out");
  timeoutError.code = "handler_timeout";
  timeoutError.retryable = true;
  controller.abort(timeoutError);

  let graceTimer;
  const afterAbort = await Promise.race([
    observed,
    new Promise((resolve) => {
      graceTimer = setTimeout(() => resolve({ type: "abort_unconfirmed" }), grace);
      if (typeof graceTimer.unref === "function") graceTimer.unref();
    })
  ]);
  clearTimeout(graceTimer);

  // A handler that finishes successfully after the abort signal has still
  // completed its side effect. Marking that work delivered is safer than
  // retrying it and manufacturing a duplicate.
  if (afterAbort.type === "settled" && afterAbort.ok) return afterAbort.value;

  if (afterAbort.type === "settled") throw timeoutError;

  // The handler ignored cancellation. Do not put the event back on the ready
  // queue: the normal failure path treats retryable=false as a terminal
  // dead-letter, so a second worker cannot overlap this still-running handler.
  const unconfirmed = new Error("event consumer handler did not stop after cancellation");
  unconfirmed.code = "handler_abort_unconfirmed";
  unconfirmed.retryable = false;
  throw unconfirmed;
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

function sample(status, attemptCount, queueAgeMs, handlerDurationMs) {
  return Object.freeze({ status, attemptCount, queueAgeMs, handlerDurationMs });
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
  ABORT_GRACE_MS,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  CONSUMER_SLO,
  CANARY_ACTIVATION_GATE,
  readEventConsumerActivationConfig,
  createEventConsumerWorker,
  computeBackoffMs,
  summarizeConsumerSamples,
  evaluateCanaryActivation,
  buildClaimOwner
};
