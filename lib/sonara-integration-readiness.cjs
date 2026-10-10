// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const crypto = require("node:crypto");
const {
  createPlatformJobWorkerRepository,
  computeBackoffMs
} = require("./sonara-platform-job-worker.cjs");

const INTEGRATION_JOB_TYPE = "provider_readiness_probe";
const PLATFORM_JOB_TYPE = "integration.provider_readiness_probe";

function platformJobTypeForOrganization(organizationId) {
  return `${PLATFORM_JOB_TYPE}:${requiredUuid(organizationId, "organizationId")}`;
}
const DEFAULT_WORKER_ID = "sonara-integration-readiness";
const DEFAULT_MAX_ATTEMPTS = 3;
const PROVIDER_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/;

function readIntegrationReadinessActivationConfig(getEnv = (name) => process.env[name]) {
  const enabled = String(getEnv("SONARA_INTEGRATION_READINESS_WORKER_ENABLED") || "").trim().toLowerCase() === "true";
  const organizationId = String(getEnv("SONARA_INTEGRATION_READINESS_CANARY_ORG_ID") || "").trim();
  if (!enabled) {
    return Object.freeze({
      ok: true,
      enabled: false,
      allowed: false,
      organizationId: null,
      reason: "flag_disabled"
    });
  }
  if (!isUuid(organizationId)) {
    return Object.freeze({
      ok: false,
      enabled: true,
      allowed: false,
      organizationId: null,
      reason: "canary_org_required"
    });
  }
  return Object.freeze({
    ok: true,
    enabled: true,
    allowed: true,
    organizationId,
    reason: "canary_enabled"
  });
}

function createIntegrationReadinessService({
  getSupabaseServerConfig,
  platformJobs,
  fetchImpl = fetch,
  now = () => new Date(),
  idFactory = () => crypto.randomUUID()
} = {}) {
  if (typeof getSupabaseServerConfig !== "function") throw new TypeError("getSupabaseServerConfig is required");
  if (!platformJobs || typeof platformJobs.enqueue !== "function") throw new TypeError("platformJobs.enqueue is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");

  function newRequestId() {
    const id = idFactory();
    if (!isUuid(id)) throw new TypeError("idFactory must return a UUID");
    return id;
  }

  async function list({ organizationId, limit = 20 } = {}) {
    const scope = requiredUuid(organizationId, "organizationId");
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return { ok: false, code: "setup_required", providers: [], connections: [], jobs: [] };

    const max = boundedInteger(limit, 1, 50, 20);
    const [providersResponse, connectionsResponse, jobsResponse] = await Promise.all([
      request(config, fetchImpl,
        "/integration_providers?select=provider_key,name,category,connection_mode,status&order=name.asc&limit=100",
        { method: "GET" }
      ),
      request(config, fetchImpl,
        "/business_integration_connections?select=provider_key,connection_mode,connection_status,last_checked_at,updated_at" +
          `&organization_id=eq.${encodeURIComponent(scope)}&order=updated_at.desc&limit=100`,
        { method: "GET" }
      ),
      request(config, fetchImpl,
        "/integration_jobs?select=id,provider_key,job_type,status,output_data,error_message,created_at,updated_at" +
          `&organization_id=eq.${encodeURIComponent(scope)}` +
          `&job_type=eq.${encodeURIComponent(INTEGRATION_JOB_TYPE)}` +
          `&order=created_at.desc&limit=${max}`,
        { method: "GET" }
      )
    ]);
    if (!providersResponse.ok || !connectionsResponse.ok || !jobsResponse.ok) {
      return { ok: false, code: "integration_state_unreadable", providers: [], connections: [], jobs: [] };
    }
    const providers = array(await providersResponse.json().catch(() => []))
      .map(providerSummary)
      .filter(Boolean);
    const connections = summarizeConnections(array(await connectionsResponse.json().catch(() => [])));
    const jobs = array(await jobsResponse.json().catch(() => []))
      .map(jobSummary)
      .filter(Boolean);
    return { ok: true, providers, connections, jobs };
  }

  async function enqueueProbe({
    organizationId,
    userId,
    providerKey,
    requestId
  } = {}) {
    const scope = requiredUuid(organizationId, "organizationId");
    const actor = userId == null ? null : requiredUuid(userId, "userId");
    const provider = normalizeProviderKey(providerKey);
    const id = requiredUuid(requestId, "requestId");
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return { ok: false, code: "setup_required" };

    const providerRead = await request(config, fetchImpl,
      `/integration_providers?select=provider_key,name,category,connection_mode,status&provider_key=eq.${encodeURIComponent(provider)}&limit=1`,
      { method: "GET" }
    );
    if (!providerRead.ok) return { ok: false, code: "provider_unreadable" };
    const providerRow = first(array(await providerRead.json().catch(() => [])));
    if (!providerRow) return { ok: false, code: "provider_not_found" };

    const visibleRow = {
      id,
      organization_id: scope,
      provider_key: provider,
      job_type: INTEGRATION_JOB_TYPE,
      status: "queued",
      input_data: { source: "account_integrations" },
      output_data: {},
      error_message: null,
      created_by: actor
    };
    const inserted = await request(config, fetchImpl,
      "/integration_jobs?on_conflict=id",
      {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify(visibleRow)
      }
    );
    if (!inserted.ok) return { ok: false, code: "integration_job_unwritable" };
    let saved = first(array(await inserted.json().catch(() => [])));
    let created = Boolean(saved);

    if (!saved) {
      const existing = await request(config, fetchImpl,
        "/integration_jobs?select=id,organization_id,provider_key,job_type,status" +
          `&id=eq.${encodeURIComponent(id)}` +
          `&organization_id=eq.${encodeURIComponent(scope)}&limit=1`,
        { method: "GET" }
      );
      if (!existing.ok) return { ok: false, code: "integration_job_dedupe_unreadable" };
      saved = first(array(await existing.json().catch(() => [])));
      if (!saved || saved.provider_key !== provider || saved.job_type !== INTEGRATION_JOB_TYPE) {
        return { ok: false, code: "integration_job_dedupe_mismatch" };
      }
    }

    const queued = await platformJobs.enqueue({
      jobType: platformJobTypeForOrganization(scope),
      idempotencyKey: `integration-readiness:${scope}:${id}`,
      input: {
        organizationId: scope,
        integrationJobId: id,
        providerKey: provider
      },
      priority: 5,
      maxAttempts: DEFAULT_MAX_ATTEMPTS
    });

    if (!queued.ok) {
      await patchIntegrationJob(config, fetchImpl, {
        organizationId: scope,
        integrationJobId: id,
        expectedStatuses: ["queued"],
        patch: { status: "manual_required", error_message: "worker_queue_unavailable" }
      });
      return {
        ok: false,
        code: "worker_queue_unavailable",
        integrationJobId: id,
        created
      };
    }

    return {
      ok: true,
      status: saved.status || "queued",
      integrationJobId: id,
      platformJobId: queued.row?.id || null,
      created
    };
  }

  async function executeProbe({ organizationId, integrationJobId, providerKey } = {}) {
    const scope = requiredUuid(organizationId, "organizationId");
    const id = requiredUuid(integrationJobId, "integrationJobId");
    const provider = normalizeProviderKey(providerKey);
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) throw workerError("setup_required", true);

    const loaded = await request(config, fetchImpl,
      "/integration_jobs?select=id,organization_id,provider_key,job_type,status,output_data" +
        `&id=eq.${encodeURIComponent(id)}` +
        `&organization_id=eq.${encodeURIComponent(scope)}` +
        `&provider_key=eq.${encodeURIComponent(provider)}` +
        `&job_type=eq.${encodeURIComponent(INTEGRATION_JOB_TYPE)}&limit=1`,
      { method: "GET" }
    );
    if (!loaded.ok) throw workerError("integration_job_unreadable", true);
    const job = first(array(await loaded.json().catch(() => [])));
    if (!job) throw workerError("integration_job_missing", false);
    if (job.status === "completed") {
      return { ok: true, idempotent: true, receipt: safeReceipt(job.output_data) };
    }
    if (!["queued", "running"].includes(job.status)) {
      throw workerError(`integration_job_not_runnable_${safeCode(job.status)}`, false);
    }

    const started = await patchIntegrationJob(config, fetchImpl, {
      organizationId: scope,
      integrationJobId: id,
      expectedStatuses: ["queued", "running"],
      patch: { status: "running", error_message: null }
    });
    if (!started.ok) throw workerError("integration_job_claim_lost", true);

    const [providerResponse, connectionResponse] = await Promise.all([
      request(config, fetchImpl,
        `/integration_providers?select=provider_key,name,category,connection_mode,status&provider_key=eq.${encodeURIComponent(provider)}&limit=1`,
        { method: "GET" }
      ),
      request(config, fetchImpl,
        "/business_integration_connections?select=provider_key,connection_mode,connection_status,last_checked_at,updated_at" +
          `&organization_id=eq.${encodeURIComponent(scope)}` +
          `&provider_key=eq.${encodeURIComponent(provider)}` +
          "&order=updated_at.desc&limit=100",
        { method: "GET" }
      )
    ]);
    if (!providerResponse.ok || !connectionResponse.ok) {
      throw workerError("provider_state_unreadable", true);
    }

    const providerRow = first(array(await providerResponse.json().catch(() => [])));
    const connectionRows = array(await connectionResponse.json().catch(() => []));
    const receipt = buildReadinessReceipt({
      providerKey: provider,
      provider: providerRow,
      connections: connectionRows,
      checkedAt: now().toISOString()
    });

    const completed = await patchIntegrationJob(config, fetchImpl, {
      organizationId: scope,
      integrationJobId: id,
      expectedStatuses: ["running"],
      patch: {
        status: "completed",
        output_data: receipt,
        error_message: null
      }
    });
    if (!completed.ok) throw workerError("integration_job_completion_lost", true);
    return { ok: true, idempotent: false, receipt };
  }

  async function markRetry({ organizationId, integrationJobId, errorCode } = {}) {
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return { ok: false, code: "setup_required" };
    return patchIntegrationJob(config, fetchImpl, {
      organizationId: requiredUuid(organizationId, "organizationId"),
      integrationJobId: requiredUuid(integrationJobId, "integrationJobId"),
      expectedStatuses: ["running"],
      patch: { status: "queued", error_message: safeCode(errorCode) }
    });
  }

  async function markFailed({ organizationId, integrationJobId, errorCode } = {}) {
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return { ok: false, code: "setup_required" };
    return patchIntegrationJob(config, fetchImpl, {
      organizationId: requiredUuid(organizationId, "organizationId"),
      integrationJobId: requiredUuid(integrationJobId, "integrationJobId"),
      expectedStatuses: ["queued", "running"],
      patch: { status: "failed", error_message: safeCode(errorCode) }
    });
  }

  return Object.freeze({ newRequestId, list, enqueueProbe, executeProbe, markRetry, markFailed });
}

function createIntegrationReadinessWorker({
  service,
  platformJobs,
  now = () => new Date(),
  workerIdFactory = () => crypto.randomUUID()
} = {}) {
  if (!service || typeof service.executeProbe !== "function") throw new TypeError("service.executeProbe is required");
  if (!platformJobs || typeof platformJobs.claim !== "function" || typeof platformJobs.settle !== "function") {
    throw new TypeError("platformJobs claim/settle are required");
  }

  async function runOnce({
    enabled = false,
    organizationId,
    workerName = DEFAULT_WORKER_ID
  } = {}) {
    if (!enabled) return { ok: true, status: "disabled", sample: null };
    const scope = requiredUuid(organizationId, "organizationId");
    const workerId = `${requiredString(workerName, "workerName", 100)}#${requiredString(workerIdFactory(), "workerId", 80)}`;

    const scopedJobType = platformJobTypeForOrganization(scope);
    const recovered = await platformJobs.recoverStale({ jobType: scopedJobType });
    if (!recovered.ok) return { ok: false, status: "recovery_failed", code: recovered.code };

    const claimed = await platformJobs.claim({ workerId, jobType: scopedJobType });
    if (!claimed.ok) return { ok: false, status: "claim_failed", code: claimed.code };
    if (!claimed.row) return { ok: true, status: "idle", recovered: recovered.recovered || 0 };

    const row = claimed.row;
    const input = row.input && typeof row.input === "object" && !Array.isArray(row.input) ? row.input : {};
    const inputScope = String(input.organizationId || "");
    const integrationJobId = String(input.integrationJobId || "");
    const providerKey = String(input.providerKey || "");
    const attempt = boundedInteger(row.attempts, 1, 100, 1);
    const maxAttempts = boundedInteger(row.max_attempts, 1, 10, DEFAULT_MAX_ATTEMPTS);

    if (inputScope !== scope || !isUuid(integrationJobId) || !PROVIDER_KEY_PATTERN.test(providerKey)) {
      if (isUuid(integrationJobId) && inputScope === scope) {
        await service.markFailed({
          organizationId: scope,
          integrationJobId,
          errorCode: "worker_input_invalid"
        });
      }
      const settled = await platformJobs.settle({
        job: row,
        workerId,
        outcome: "failed",
        errorCode: "worker_input_invalid"
      });
      return {
        ok: false,
        status: settled.ok ? "failed" : "settlement_failed",
        code: settled.ok ? "worker_input_invalid" : settled.code
      };
    }

    try {
      const result = await service.executeProbe({
        organizationId: scope,
        integrationJobId,
        providerKey
      });
      const settled = await platformJobs.settle({
        job: row,
        workerId,
        outcome: "completed",
        output: {
          integrationJobId,
          readiness: result.receipt?.readiness || "unknown"
        }
      });
      if (!settled.ok) return { ok: false, status: "settlement_failed", code: settled.code };
      return {
        ok: true,
        status: "completed",
        integrationJobId,
        readiness: result.receipt?.readiness || "unknown",
        idempotent: result.idempotent === true,
        eventRecorded: settled.eventRecorded === true
      };
    } catch (error) {
      const code = safeCode(error?.code || "readiness_probe_failed");
      const retryable = error?.retryable !== false && attempt < maxAttempts;
      if (retryable) {
        const nextAttemptAt = new Date(now().getTime() + computeBackoffMs(attempt)).toISOString();
        await service.markRetry({ organizationId: scope, integrationJobId, errorCode: code });
        const settled = await platformJobs.settle({
          job: row,
          workerId,
          outcome: "retry",
          errorCode: code,
          nextAttemptAt
        });
        return {
          ok: settled.ok,
          status: settled.ok ? "retry" : "settlement_failed",
          code: settled.ok ? code : settled.code,
          nextAttemptAt
        };
      }

      await service.markFailed({ organizationId: scope, integrationJobId, errorCode: code });
      const settled = await platformJobs.settle({
        job: row,
        workerId,
        outcome: "failed",
        errorCode: code
      });
      return {
        ok: false,
        status: settled.ok ? "failed" : "settlement_failed",
        code: settled.ok ? code : settled.code
      };
    }
  }

  return Object.freeze({ runOnce });
}

function buildReadinessReceipt({ providerKey, provider, connections = [], checkedAt }) {
  const providerStatus = safeCode(provider?.status || "missing");
  const summary = summarizeProviderConnections(providerKey, connections);
  const readiness = providerStatus !== "active"
    ? "provider_unavailable"
    : summary.connection_status === "connected"
      ? "connected"
      : summary.connection_status === "error"
        ? "connection_error"
        : "setup_required";
  return Object.freeze({
    schemaVersion: 1,
    kind: "provider_readiness_probe",
    provider_key: providerKey,
    provider_status: providerStatus,
    provider_connection_mode: safeCode(provider?.connection_mode || "unknown"),
    connection_present: summary.connection_count > 0,
    connection_count: summary.connection_count,
    connection_mode: summary.connection_mode,
    connection_status: summary.connection_status,
    last_checked_at: summary.last_checked_at,
    checked_at: checkedAt,
    readiness
  });
}

function summarizeConnections(rows) {
  const byProvider = new Map();
  for (const row of rows) {
    const key = String(row?.provider_key || "").trim();
    if (!PROVIDER_KEY_PATTERN.test(key)) continue;
    if (!byProvider.has(key)) byProvider.set(key, []);
    byProvider.get(key).push(row);
  }
  return [...byProvider.entries()]
    .map(([providerKey, providerRows]) => summarizeProviderConnections(providerKey, providerRows))
    .sort((a, b) => a.provider_key.localeCompare(b.provider_key));
}

function summarizeProviderConnections(providerKey, rows) {
  const safeRows = array(rows).filter((row) => String(row?.provider_key || "").trim() === providerKey);
  const statuses = safeRows.map((row) => safeCode(row?.connection_status || "setup_required"));
  const modes = [...new Set(safeRows.map((row) => safeCode(row?.connection_mode || "manual")))];
  const connectionStatus = statuses.includes("connected")
    ? "connected"
    : statuses.includes("error")
      ? "error"
      : statuses.includes("setup_required")
        ? "setup_required"
        : statuses.includes("disabled")
          ? "disabled"
          : "not_connected";
  const validChecks = safeRows
    .map((row) => row?.last_checked_at)
    .filter(validIso)
    .sort();
  return {
    provider_key: providerKey,
    connection_count: safeRows.length,
    connection_mode: modes.length === 0 ? "none" : modes.length === 1 ? modes[0] : "mixed",
    connection_status: connectionStatus,
    last_checked_at: validChecks.length ? validChecks[validChecks.length - 1] : null
  };
}

async function patchIntegrationJob(config, fetchImpl, {
  organizationId,
  integrationJobId,
  expectedStatuses,
  patch
}) {
  const statuses = [...new Set(expectedStatuses.map((value) => safeCode(value)))];
  const filter = statuses.length === 1
    ? `&status=eq.${encodeURIComponent(statuses[0])}`
    : `&status=in.(${statuses.map(encodeURIComponent).join(",")})`;
  const response = await request(config, fetchImpl,
    "/integration_jobs?select=id,status" +
      `&id=eq.${encodeURIComponent(integrationJobId)}` +
      `&organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&job_type=eq.${encodeURIComponent(INTEGRATION_JOB_TYPE)}` +
      filter,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch)
    }
  );
  if (!response.ok) return { ok: false, code: "integration_job_update_failed" };
  const row = first(array(await response.json().catch(() => [])));
  return row ? { ok: true, row } : { ok: false, code: "integration_job_update_lost" };
}

function providerSummary(row) {
  const key = String(row?.provider_key || "").trim();
  if (!PROVIDER_KEY_PATTERN.test(key)) return null;
  return {
    provider_key: key,
    name: String(row?.name || key).slice(0, 160),
    category: safeCode(row?.category || "other"),
    connection_mode: safeCode(row?.connection_mode || "manual"),
    status: safeCode(row?.status || "inactive")
  };
}

function jobSummary(row) {
  const id = String(row?.id || "").trim();
  const providerKey = String(row?.provider_key || "").trim();
  if (!isUuid(id) || !PROVIDER_KEY_PATTERN.test(providerKey)) return null;
  return {
    id,
    provider_key: providerKey,
    job_type: String(row?.job_type || "").slice(0, 120),
    status: safeCode(row?.status || "unknown"),
    readiness: safeCode(row?.output_data?.readiness || "unknown"),
    error_code: row?.error_message ? safeCode(row.error_message) : null,
    created_at: validIso(row?.created_at) ? row.created_at : null,
    updated_at: validIso(row?.updated_at) ? row.updated_at : null
  };
}

function safeReceipt(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return {
    schemaVersion: Number(value.schemaVersion) === 1 ? 1 : 1,
    kind: "provider_readiness_probe",
    provider_key: normalizeProviderKey(value.provider_key),
    provider_status: safeCode(value.provider_status),
    provider_connection_mode: safeCode(value.provider_connection_mode),
    connection_present: value.connection_present === true,
    connection_count: boundedInteger(value.connection_count, 0, 1000, 0),
    connection_mode: safeCode(value.connection_mode),
    connection_status: safeCode(value.connection_status),
    last_checked_at: validIso(value.last_checked_at) ? value.last_checked_at : null,
    checked_at: validIso(value.checked_at) ? value.checked_at : null,
    readiness: safeCode(value.readiness)
  };
}

function workerError(code, retryable) {
  const error = new Error(safeCode(code));
  error.code = safeCode(code);
  error.retryable = retryable;
  return error;
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

function array(value) {
  return Array.isArray(value) ? value : [];
}

function first(value) {
  return value[0] || null;
}

function normalizeProviderKey(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (!PROVIDER_KEY_PATTERN.test(clean)) throw new TypeError("providerKey is invalid");
  return clean;
}

function requiredUuid(value, name) {
  const clean = String(value || "").trim();
  if (!isUuid(clean)) throw new TypeError(`${name} must be a UUID`);
  return clean;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function requiredString(value, name, max) {
  const clean = String(value || "").trim();
  if (!clean || clean.length > max) throw new TypeError(`${name} is required and must be <= ${max} characters`);
  return clean;
}

function boundedInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function safeCode(value) {
  const clean = String(value || "unknown").toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (clean || "unknown").slice(0, 120);
}

function validIso(value) {
  const raw = String(value || "");
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed);
}

module.exports = {
  INTEGRATION_JOB_TYPE,
  PLATFORM_JOB_TYPE,
  platformJobTypeForOrganization,
  DEFAULT_WORKER_ID,
  DEFAULT_MAX_ATTEMPTS,
  PROVIDER_KEY_PATTERN,
  readIntegrationReadinessActivationConfig,
  createIntegrationReadinessService,
  createIntegrationReadinessWorker,
  buildReadinessReceipt,
  summarizeConnections,
  isUuid
};
