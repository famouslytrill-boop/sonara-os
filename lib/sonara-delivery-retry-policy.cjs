// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure delivery retry decisions. This module never sleeps, schedules work,
// enqueues messages, or sends notifications. A durable worker owns those
// effects after the customer/channel permission and idempotency checks.
// See RFC 9110 section 10.2.3 for the Retry-After wire format.

const MAX_ATTEMPTS = 5;
const MAX_PROVIDER_DELAY_SECONDS = 30 * 24 * 60 * 60;
const MAX_BACKOFF_SECONDS = 60 * 60;
const MIN_BACKOFF_SECONDS = 5;

function readRetryAfter(value, { nowMs = Date.now() } = {}) {
  if (value === null || value === undefined || value === "") {
    return { status: "absent", seconds: null };
  }
  if (typeof value !== "string" || !Number.isFinite(nowMs)) {
    return { status: "malformed", seconds: null };
  }
  const raw = value.trim();
  if (raw.length > 90) return { status: "malformed", seconds: null };
  let seconds;
  if (/^[0-9]+$/.test(raw)) {
    seconds = Number(raw);
  } else if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), [0-9]{2} [A-Z][a-z]{2} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$/.test(raw)) {
    const deadline = Date.parse(raw);
    if (!Number.isFinite(deadline)) return { status: "malformed", seconds: null };
    seconds = Math.max(0, Math.ceil((deadline - nowMs) / 1000));
  } else {
    return { status: "malformed", seconds: null };
  }
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    return { status: "malformed", seconds: null };
  }
  if (seconds > MAX_PROVIDER_DELAY_SECONDS) {
    // Never silently shorten a provider's refusal into an earlier retry.
    return { status: "too_far", seconds: null };
  }
  return { status: "ok", seconds };
}

// "attempt" is the count of attempts already made INCLUDING the failed send.
// Deterministic jitter comes from the caller's 0..1 entropy value so test
// scenarios and audit evidence can replay the same decision. Production workers
// should supply cryptographically random entropy for independent jobs.
function nextRetry({ attempt, retryAfter = null, nowMs = Date.now(), expiresAtMs = null, jitter = 0.5 } = {}) {
  if (!Number.isInteger(attempt) || attempt < 1 ||
      !Number.isFinite(nowMs) || !Number.isFinite(jitter) || jitter < 0 || jitter > 1) {
    return { status: "invalid", reason: "invalid_retry_input" };
  }
  if (expiresAtMs !== null && !Number.isFinite(expiresAtMs)) {
    return { status: "invalid", reason: "invalid_expiry" };
  }
  if (expiresAtMs !== null && nowMs >= expiresAtMs) {
    return { status: "expired", reason: "message_expired" };
  }
  if (attempt >= MAX_ATTEMPTS) {
    return { status: "dead_letter", reason: "attempt_limit" };
  }

  const parsed = readRetryAfter(retryAfter, { nowMs });
  if (parsed.status === "too_far") {
    return { status: "operator_review", reason: "provider_delay_exceeds_policy" };
  }
  const exponential = Math.min(MAX_BACKOFF_SECONDS, MIN_BACKOFF_SECONDS * 2 ** (attempt - 1));
  const backoff = Math.ceil(exponential * (0.5 + jitter * 0.5));
  const delaySeconds = Math.max(backoff, parsed.seconds || 0);
  const dueMs = nowMs + delaySeconds * 1000;
  if (!Number.isFinite(dueMs) || Math.abs(dueMs) > 8.64e15) return { status: "invalid", reason: "overflow" };
  if (expiresAtMs !== null && dueMs >= expiresAtMs) {
    return { status: "expired", reason: "would_outlive_message" };
  }
  return {
    status: "scheduled",
    delaySeconds,
    dueAt: new Date(dueMs).toISOString(),
    reason: parsed.status === "ok" && parsed.seconds >= backoff ? "provider_retry_after" : "bounded_backoff",
    attemptsRemaining: MAX_ATTEMPTS - attempt
  };
}

module.exports = {
  MAX_ATTEMPTS,
  MAX_PROVIDER_DELAY_SECONDS,
  MAX_BACKOFF_SECONDS,
  MIN_BACKOFF_SECONDS,
  readRetryAfter,
  nextRetry
};
