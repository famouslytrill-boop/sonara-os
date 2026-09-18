// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { randomUUID, createHash } = require("node:crypto");

const GENERATION_JOB_STATES = Object.freeze([
  "planned",
  "submitted",
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "expired"
]);

const TERMINAL_GENERATION_JOB_STATES = Object.freeze([
  "succeeded",
  "failed",
  "canceled",
  "expired"
]);

const LEGAL_GENERATION_JOB_TRANSITIONS = Object.freeze({
  planned: Object.freeze(["submitted", "canceled", "failed", "expired"]),
  submitted: Object.freeze(["queued", "running", "canceled", "failed", "expired"]),
  queued: Object.freeze(["running", "canceled", "failed", "expired"]),
  running: Object.freeze(["succeeded", "canceled", "failed", "expired"]),
  succeeded: Object.freeze([]),
  failed: Object.freeze([]),
  canceled: Object.freeze([]),
  expired: Object.freeze([])
});

class GenerationJobRepositoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GenerationJobRepositoryError";
    this.code = code;
  }
}

class InMemoryGenerationJobRepository {
  constructor(options = {}) {
    this.clock = options.clock || (() => new Date());
    this.idFactory = options.idFactory || (() => randomUUID());
    this.jobs = new Map();
    this.idempotencyIndex = new Map();
  }

  createOrGetByIdempotency(input = {}) {
    const tenantId = requiredString(input.tenantId, "tenantId");
    const requestId = requiredString(input.requestId, "requestId");
    const idempotencyKey = requiredString(input.idempotencyKey, "idempotencyKey");
    const indexKey = scopedKey(tenantId, idempotencyKey);
    const existingId = this.idempotencyIndex.get(indexKey);
    if (existingId) {
      return { created: false, job: this.getById(tenantId, existingId) };
    }

    const now = iso(this.clock());
    const jobId = input.jobId ? requiredString(input.jobId, "jobId") : `gen_${this.idFactory()}`;
    const job = {
      schema: "sonara.generation.persisted-job.v1",
      id: jobId,
      tenantId,
      requestId,
      idempotencyKey,
      state: "planned",
      version: 1,
      createdAt: now,
      updatedAt: now,
      deadlineAt: optionalIso(input.deadlineAt),
      adapterKey: nullableString(input.adapterKey),
      modality: nullableString(input.modality),
      operation: nullableString(input.operation),
      inputReferences: normalizeReferences(input.inputReferences),
      inputDigests: normalizeDigests(input.inputDigests),
      providerLocator: null,
      artifacts: [],
      error: null,
      cost: null,
      audit: [auditEvent(1, "job.created", now, { requestId })]
    };

    this.jobs.set(jobKey(tenantId, jobId), job);
    this.idempotencyIndex.set(indexKey, jobId);
    return { created: true, job: clone(job) };
  }

  getById(tenantId, jobId) {
    const key = jobKey(requiredString(tenantId, "tenantId"), requiredString(jobId, "jobId"));
    const job = this.jobs.get(key);
    return job ? clone(job) : null;
  }

  transition(input = {}) {
    const job = this.#getMutable(input.tenantId, input.jobId);
    const expectedVersion = requiredVersion(input.expectedVersion);
    assertVersion(job, expectedVersion);

    const nextState = requiredState(input.toState);
    if (TERMINAL_GENERATION_JOB_STATES.includes(job.state)) {
      throw new GenerationJobRepositoryError("terminal_state_immutable", `Generation job is already terminal in ${job.state}.`);
    }
    if (!LEGAL_GENERATION_JOB_TRANSITIONS[job.state].includes(nextState)) {
      throw new GenerationJobRepositoryError("illegal_transition", `Illegal generation transition ${job.state} -> ${nextState}.`);
    }
    if (nextState === "succeeded" && job.artifacts.length === 0) {
      throw new GenerationJobRepositoryError("durable_artifact_required", "A durable artifact must be recorded before a generation job can succeed.");
    }

    const previousState = job.state;
    const now = iso(input.at || this.clock());
    job.state = nextState;
    job.version += 1;
    job.updatedAt = now;
    job.audit.push(auditEvent(job.audit.length + 1, "job.transitioned", now, {
      from: previousState,
      to: nextState,
      reason: sanitizeToken(input.reason)
    }));
    return clone(job);
  }

  recordProviderLocator(input = {}) {
    const job = this.#getMutable(input.tenantId, input.jobId);
    assertVersion(job, requiredVersion(input.expectedVersion));
    assertNonTerminal(job, "Provider locator cannot change after terminal state.");

    const now = iso(input.at || this.clock());
    job.providerLocator = {
      adapterKey: requiredString(input.adapterKey || job.adapterKey, "adapterKey"),
      providerRequestId: requiredString(input.providerRequestId, "providerRequestId")
    };
    job.version += 1;
    job.updatedAt = now;
    job.audit.push(auditEvent(job.audit.length + 1, "provider.locator_recorded", now, {
      adapterKey: job.providerLocator.adapterKey,
      providerRequestIdDigest: digest(job.providerLocator.providerRequestId)
    }));
    return clone(job);
  }

  recordArtifact(input = {}) {
    const job = this.#getMutable(input.tenantId, input.jobId);
    assertVersion(job, requiredVersion(input.expectedVersion));
    assertNonTerminal(job, "Artifacts cannot change after terminal state.");

    const artifact = {
      artifactId: requiredString(input.artifactId, "artifactId"),
      storageRef: requiredString(input.storageRef, "storageRef"),
      sha256: requiredSha256(input.sha256),
      mediaType: requiredString(input.mediaType, "mediaType"),
      durable: input.durable === true,
      provenance: normalizeProvenance(input.provenance)
    };
    if (!artifact.durable) {
      throw new GenerationJobRepositoryError("artifact_not_durable", "Generation artifacts must be durable before being recorded for downstream use.");
    }

    const now = iso(input.at || this.clock());
    if (!job.artifacts.some((entry) => entry.artifactId === artifact.artifactId)) {
      job.artifacts.push(artifact);
      job.version += 1;
      job.updatedAt = now;
      job.audit.push(auditEvent(job.audit.length + 1, "artifact.recorded", now, {
        artifactId: artifact.artifactId,
        sha256: artifact.sha256
      }));
    }
    return clone(job);
  }

  recordError(input = {}) {
    const job = this.#getMutable(input.tenantId, input.jobId);
    assertVersion(job, requiredVersion(input.expectedVersion));
    assertNonTerminal(job, "Error metadata cannot change after terminal state.");

    const now = iso(input.at || this.clock());
    job.error = {
      code: sanitizeToken(input.code) || "generation_error",
      category: sanitizeToken(input.category) || "unknown",
      retryable: input.retryable === true
    };
    job.version += 1;
    job.updatedAt = now;
    job.audit.push(auditEvent(job.audit.length + 1, "job.error_recorded", now, job.error));
    return clone(job);
  }

  recordCost(input = {}) {
    const job = this.#getMutable(input.tenantId, input.jobId);
    assertVersion(job, requiredVersion(input.expectedVersion));
    assertNonTerminal(job, "Cost metadata cannot change after terminal state.");

    const amountMinor = nonNegativeInteger(input.amountMinor, "amountMinor");
    const now = iso(input.at || this.clock());
    job.cost = {
      amountMinor,
      currency: requiredString(input.currency || "USD", "currency").toUpperCase(),
      final: input.final === true,
      source: sanitizeToken(input.source) || "adapter"
    };
    job.version += 1;
    job.updatedAt = now;
    job.audit.push(auditEvent(job.audit.length + 1, "job.cost_recorded", now, job.cost));
    return clone(job);
  }

  appendAuditEvent(input = {}) {
    const job = this.#getMutable(input.tenantId, input.jobId);
    assertVersion(job, requiredVersion(input.expectedVersion));
    const now = iso(input.at || this.clock());
    job.version += 1;
    job.updatedAt = now;
    job.audit.push(auditEvent(
      job.audit.length + 1,
      requiredString(input.type, "type"),
      now,
      normalizeAuditDetails(input.details)
    ));
    return clone(job);
  }

  #getMutable(tenantId, jobId) {
    const key = jobKey(requiredString(tenantId, "tenantId"), requiredString(jobId, "jobId"));
    const job = this.jobs.get(key);
    if (!job) {
      throw new GenerationJobRepositoryError("job_not_found", "Generation job not found in tenant scope.");
    }
    return job;
  }
}

function assertVersion(job, expectedVersion) {
  if (job.version !== expectedVersion) {
    throw new GenerationJobRepositoryError(
      "stale_version",
      `Generation job version ${expectedVersion} is stale; current version is ${job.version}.`
    );
  }
}

function assertNonTerminal(job, message) {
  if (TERMINAL_GENERATION_JOB_STATES.includes(job.state)) {
    throw new GenerationJobRepositoryError("terminal_state_immutable", message);
  }
}

function auditEvent(sequence, type, at, details) {
  return Object.freeze({ sequence, type, at, details: clone(details || {}) });
}

function normalizeReferences(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => ({
    ref: requiredString(entry?.ref, "inputReference.ref"),
    mediaType: nullableString(entry?.mediaType)
  }));
}

function normalizeDigests(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => ({
    algorithm: "sha256",
    digest: requiredSha256(entry?.digest)
  }));
}

function normalizeProvenance(value = {}) {
  return {
    adapterKey: nullableString(value.adapterKey),
    modelRef: nullableString(value.modelRef),
    sourceJobId: nullableString(value.sourceJobId),
    rightsAttestationRef: nullableString(value.rightsAttestationRef)
  };
}

function normalizeAuditDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const safe = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveAuditKey(key)) continue;
    if (["string", "number", "boolean"].includes(typeof entry) || entry === null) {
      safe[key] = entry;
    }
  }
  return safe;
}

function isSensitiveAuditKey(key) {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  return ["prompt", "content", "media", "input", "secret", "token", "authorization", "credential", "password"]
    .some((sensitive) => normalized.includes(sensitive));
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new GenerationJobRepositoryError("invalid_argument", `${name} must be a non-empty string.`);
  }
  return value.trim();
}

function nullableString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredState(value) {
  if (!GENERATION_JOB_STATES.includes(value)) {
    throw new GenerationJobRepositoryError("invalid_state", `Unknown generation job state: ${value}.`);
  }
  return value;
}

function requiredVersion(value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new GenerationJobRepositoryError("invalid_version", "expectedVersion must be a positive integer.");
  }
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new GenerationJobRepositoryError("invalid_argument", `${name} must be a non-negative integer.`);
  }
  return value;
}

function requiredSha256(value) {
  const candidate = requiredString(value, "sha256").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(candidate)) {
    throw new GenerationJobRepositoryError("invalid_digest", "sha256 must be a 64-character hexadecimal digest.");
  }
  return candidate;
}

function sanitizeToken(value) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, 120).replace(/[^a-zA-Z0-9_.:-]/g, "_") || null;
}

function optionalIso(value) {
  if (value === undefined || value === null || value === "") return null;
  return iso(value);
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new GenerationJobRepositoryError("invalid_date", "Expected a valid date value.");
  }
  return date.toISOString();
}

function digest(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function scopedKey(tenantId, value) {
  return `${tenantId}\u0000${value}`;
}

function jobKey(tenantId, jobId) {
  return `${tenantId}\u0000${jobId}`;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

module.exports = {
  GENERATION_JOB_STATES,
  TERMINAL_GENERATION_JOB_STATES,
  LEGAL_GENERATION_JOB_TRANSITIONS,
  GenerationJobRepositoryError,
  InMemoryGenerationJobRepository
};
