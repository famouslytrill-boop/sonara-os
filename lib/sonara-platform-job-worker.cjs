// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const PLATFORM_JOBS_TABLE = "platform_jobs";
const PLATFORM_JOB_EVENTS_TABLE = "platform_job_events";
const CLAIM_FUNCTION = "claim_platform_job";
const ENQUEUE_FUNCTION = "enqueue_platform_job";
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_BACKOFF_MS = 5 * 1000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

function createPlatformJobWorkerRepository({
  getSupabaseServerConfig,
  fetchImpl = fetch,
  now = () => new Date()
} = {}) {
  if (typeof getSupabaseServerConfig !== "function") throw new TypeError("getSupabaseServerConfig is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");

  async function enqueue({
    jobType,
    idempotencyKey,
    input = {},
    priority = 5,
    maxAttempts = 3
  } = {}) {
    const type = requiredString(jobType, "jobType", 120);
    const key = requiredString(idempotencyKey, "idempotencyKey", 300);
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return failure("setup_required");

    const response = await request(config, fetchImpl, `/rpc/${ENQUEUE_FUNCTION}`, {
      method: "POST",
      body: JSON.stringify({
        p_job_type: type,
        p_idempotency_key: key,
        p_input: safeObject(input),
        p_priority: boundedInteger(priority, 0, 100, 5),
        p_max_attempts: boundedInteger(maxAttempts, 1, 10, 3)
      })
    });
    if (!response.ok) return failure("enqueue_failed", response.status);
    const body = await response.json().catch(() => null);
    const row = firstRow(body);
    return row ? { ok: true, row } : failure("enqueue_empty");
  }

  async function recoverStale({
    jobType,
    leaseMs = DEFAULT_LEASE_MS,
    limit = 20,
    beforeRecover = null
  } = {}) {
    const type = requiredString(jobType, "jobType", 120);
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return failure("setup_required");

    const cutoff = new Date(now().getTime() - boundedInteger(leaseMs, 30_000, 30 * 60_000, DEFAULT_LEASE_MS)).toISOString();
    const query =
      `?select=id,job_type,status,locked_at,locked_by,attempts,max_attempts,input` +
      `&job_type=eq.${encodeURIComponent(type)}` +
      `&status=eq.processing` +
      `&locked_at=lt.${encodeURIComponent(cutoff)}` +
      `&order=locked_at.asc&limit=${boundedInteger(limit, 1, 100, 20)}`;
    const response = await request(config, fetchImpl, `/${PLATFORM_JOBS_TABLE}${query}`, { method: "GET" });
    if (!response.ok) return failure("recovery_read_failed", response.status);
    const rows = await response.json().catch(() => []);
    if (!Array.isArray(rows)) return failure("recovery_read_invalid");

    let recovered = 0;
    let skipped = 0;
    for (const row of rows) {
      const id = String(row?.id || "").trim();
      const lockedBy = String(row?.locked_by || "").trim();
      const lockedAt = String(row?.locked_at || "").trim();
      if (!id || !lockedBy || !lockedAt) {
        skipped += 1;
        continue;
      }
      const path =
        `/${PLATFORM_JOBS_TABLE}?id=eq.${encodeURIComponent(id)}` +
        `&job_type=eq.${encodeURIComponent(type)}` +
        `&status=eq.processing` +
        `&locked_by=eq.${encodeURIComponent(lockedBy)}` +
        `&locked_at=eq.${encodeURIComponent(lockedAt)}`;
      const attempts = boundedInteger(row.attempts, 0, 1000, 0);
      const maxAttempts = boundedInteger(row.max_attempts, 1, 1000, 1);
      const exhausted = attempts >= maxAttempts;
      if (beforeRecover != null) {
        if (typeof beforeRecover !== "function") throw new TypeError("beforeRecover must be a function");
        let reconciled;
        try {
          reconciled = await beforeRecover({ job: row, exhausted, reason: "lease_expired" });
        } catch {
          reconciled = { ok: false };
        }
        if (!reconciled || reconciled.ok !== true) {
          skipped += 1;
          continue;
        }
      }
      const stamp = now().toISOString();
      const released = await request(config, fetchImpl, path, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(exhausted
          ? {
              status: "failed",
              error: "lease_expired",
              last_error: "lease_expired",
              completed_at: stamp,
              dead_lettered_at: stamp,
              locked_at: null,
              locked_by: null
            }
          : {
              status: "retryable",
              next_attempt_at: stamp,
              locked_at: null,
              locked_by: null,
              last_error: "lease_expired"
            })
      });
      const changed = released.ok ? firstRow(await released.json().catch(() => [])) : null;
      if (!changed) {
        skipped += 1;
        continue;
      }
      recovered += 1;
      await recordEvent(config, fetchImpl, {
        jobId: id,
        eventType: exhausted ? "dead_lettered" : "recovered",
        attempt: attempts,
        metadata: { reason: "lease_expired" }
      });
    }
    return { ok: true, recovered, skipped };
  }

  async function claim({ workerId, jobType } = {}) {
    const worker = requiredString(workerId, "workerId", 160);
    const type = requiredString(jobType, "jobType", 120);
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return failure("setup_required");

    const response = await request(config, fetchImpl, `/rpc/${CLAIM_FUNCTION}`, {
      method: "POST",
      body: JSON.stringify({ p_worker_id: worker, p_job_type: type })
    });
    if (!response.ok) return failure("claim_failed", response.status);
    const body = await response.json().catch(() => null);
    const row = firstRow(body);
    if (!row) return { ok: true, row: null, eventRecorded: true };

    const event = await recordEvent(config, fetchImpl, {
      jobId: row.id,
      eventType: "claimed",
      attempt: boundedInteger(row.attempts, 0, 1000, 0),
      metadata: { worker: worker.slice(0, 120) }
    });
    return { ok: true, row, eventRecorded: event.ok };
  }

  async function settle({
    job,
    workerId,
    outcome,
    output = {},
    errorCode = null,
    nextAttemptAt = null
  } = {}) {
    const id = requiredString(job?.id, "job.id", 80);
    const type = requiredString(job?.job_type, "job.job_type", 120);
    const worker = requiredString(workerId, "workerId", 160);
    if (!["completed", "retry", "failed"].includes(outcome)) {
      throw new TypeError("outcome must be completed, retry, or failed");
    }
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return failure("setup_required");

    const stamp = now().toISOString();
    const code = errorCode == null ? null : safeCode(errorCode);
    const patch = outcome === "completed"
      ? {
          status: "completed",
          output: safeObject(output),
          error: null,
          last_error: null,
          completed_at: stamp,
          locked_at: null,
          locked_by: null
        }
      : outcome === "retry"
        ? {
            status: "retryable",
            error: code,
            last_error: code,
            next_attempt_at: validIso(nextAttemptAt) ? nextAttemptAt : stamp,
            locked_at: null,
            locked_by: null
          }
        : {
            status: "failed",
            error: code,
            last_error: code,
            completed_at: stamp,
            dead_lettered_at: stamp,
            locked_at: null,
            locked_by: null
          };

    const path =
      `/${PLATFORM_JOBS_TABLE}?id=eq.${encodeURIComponent(id)}` +
      `&job_type=eq.${encodeURIComponent(type)}` +
      `&status=eq.processing` +
      `&locked_by=eq.${encodeURIComponent(worker)}`;
    const response = await request(config, fetchImpl, path, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch)
    });
    if (!response.ok) return failure("settle_failed", response.status);
    const row = firstRow(await response.json().catch(() => []));
    if (!row) return failure("claim_lost");

    const eventType = outcome === "completed"
      ? "succeeded"
      : outcome === "retry"
        ? "retry_scheduled"
        : "dead_lettered";
    const event = await recordEvent(config, fetchImpl, {
      jobId: id,
      eventType,
      attempt: boundedInteger(job?.attempts, 0, 1000, 0),
      metadata: code ? { error_code: code } : {}
    });
    return { ok: true, row, eventRecorded: event.ok };
  }

  return { enqueue, recoverStale, claim, settle };
}

function computeBackoffMs(attempt, { baseMs = DEFAULT_BACKOFF_MS, maxMs = MAX_BACKOFF_MS } = {}) {
  const current = boundedInteger(attempt, 1, 100, 1);
  const base = boundedInteger(baseMs, 1, 60_000, DEFAULT_BACKOFF_MS);
  const max = boundedInteger(maxMs, base, 30 * 60_000, MAX_BACKOFF_MS);
  return Math.min(max, base * (2 ** Math.max(0, current - 1)));
}

async function recordEvent(config, fetchImpl, { jobId, eventType, attempt, metadata = {} }) {
  const response = await request(config, fetchImpl, `/${PLATFORM_JOB_EVENTS_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      job_id: jobId,
      event_type: eventType,
      attempt: boundedInteger(attempt, 0, 1000, 0),
      metadata: safeObject(metadata)
    })
  });
  return { ok: Boolean(response.ok), status: response.status };
}

function getConfig(getSupabaseServerConfig) {
  const source = getSupabaseServerConfig();
  const url = String(source?.url || "").trim().replace(/\/+$/, "");
  const key = String(source?.serviceRoleKey || "").trim();
  return source?.ok && url && key ? { ok: true, url, serviceRoleKey: key } : { ok: false };
}

async function request(config, fetchImpl, path, init = {}) {
  try {
    return await fetchImpl(`${config.url}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers || {})
      }
    });
  } catch {
    return { ok: false, status: 0, json: async () => [] };
  }
}

function firstRow(body) {
  if (Array.isArray(body)) return body[0] || null;
  if (body && typeof body === "object" && body.id) return body;
  return null;
}

function safeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const json = JSON.stringify(value);
  if (json.length > 20_000) throw new TypeError("job payload exceeds 20 KB");
  return JSON.parse(json);
}

function safeCode(value) {
  const clean = String(value || "worker_failed").toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (clean || "worker_failed").slice(0, 120);
}

function boundedInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function requiredString(value, name, max) {
  const clean = String(value || "").trim();
  if (!clean || clean.length > max) throw new TypeError(`${name} is required and must be <= ${max} characters`);
  return clean;
}

function validIso(value) {
  const raw = String(value || "");
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed);
}

function failure(code, status = null) {
  return { ok: false, code, status, row: null };
}

module.exports = {
  PLATFORM_JOBS_TABLE,
  PLATFORM_JOB_EVENTS_TABLE,
  CLAIM_FUNCTION,
  ENQUEUE_FUNCTION,
  DEFAULT_LEASE_MS,
  DEFAULT_BACKOFF_MS,
  MAX_BACKOFF_MS,
  createPlatformJobWorkerRepository,
  computeBackoffMs
};
