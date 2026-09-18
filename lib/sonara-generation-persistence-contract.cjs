// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  GENERATION_JOB_STATES,
  LEGAL_GENERATION_JOB_TRANSITIONS
} = require("./sonara-generation-job-repository.cjs");

const GENERATION_PERSISTENCE_MIGRATION = "20260916032000_generation_lifecycle_persistence.sql";

const GENERATION_PERSISTENCE_TABLES = Object.freeze({
  jobs: "generation_jobs",
  attempts: "generation_attempts",
  artifacts: "generation_artifacts",
  callbacks: "generation_callback_events",
  costs: "generation_cost_events",
  audit: "generation_audit_events"
});

const SENSITIVE_DETAIL_TOKENS = Object.freeze([
  "prompt",
  "content",
  "media",
  "input",
  "secret",
  "token",
  "authorization",
  "credential",
  "password",
  "providerresponse",
  "payload",
  "body"
]);

class GenerationPersistenceContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GenerationPersistenceContractError";
    this.code = code;
  }
}

function buildGenerationJobRow(input = {}) {
  const organizationId = organizationScope(input);
  return {
    organization_id: organizationId,
    requested_by: nullableString(input.requestedBy),
    request_id: requiredString(input.requestId, "requestId"),
    idempotency_key: requiredString(input.idempotencyKey, "idempotencyKey"),
    state: "planned",
    version: 1,
    adapter_key: nullableString(input.adapterKey),
    modality: nullableString(input.modality),
    operation: nullableString(input.operation),
    input_references: normalizeReferences(input.inputReferences),
    input_digests: normalizeDigests(input.inputDigests),
    deadline_at: optionalIso(input.deadlineAt)
  };
}

function buildGenerationAttemptRow(input = {}) {
  const state = input.state === undefined ? "planned" : requiredState(input.state);
  return {
    organization_id: organizationScope(input),
    job_id: requiredString(input.jobId, "jobId"),
    attempt_number: positiveInteger(input.attemptNumber, "attemptNumber"),
    adapter_key: requiredString(input.adapterKey, "adapterKey"),
    provider_request_id: nullableString(input.providerRequestId),
    state,
    error_code: safeToken(input.errorCode),
    error_category: safeToken(input.errorCategory),
    error_retryable: input.errorRetryable === true,
    started_at: optionalIso(input.startedAt),
    finished_at: optionalIso(input.finishedAt)
  };
}

function buildGenerationArtifactRow(input = {}) {
  if (input.durable !== true) {
    throw new GenerationPersistenceContractError(
      "artifact_not_durable",
      "Generation artifacts must be durable before persistence."
    );
  }
  return {
    organization_id: organizationScope(input),
    job_id: requiredString(input.jobId, "jobId"),
    attempt_id: nullableString(input.attemptId),
    storage_ref: requiredString(input.storageRef, "storageRef"),
    sha256: requiredSha256(input.sha256),
    media_type: requiredString(input.mediaType, "mediaType"),
    byte_size: optionalNonNegativeInteger(input.byteSize, "byteSize"),
    provenance: normalizeProvenance(input.provenance)
  };
}

function buildGenerationCallbackEventRow(input = {}) {
  return {
    organization_id: organizationScope(input),
    job_id: requiredString(input.jobId, "jobId"),
    attempt_id: nullableString(input.attemptId),
    provider_key: requiredString(input.providerKey, "providerKey"),
    provider_event_id: requiredString(input.providerEventId, "providerEventId"),
    auth_verified: input.authVerified === true,
    payload_digest: requiredSha256(input.payloadDigest),
    replay_status: callbackStatus(input.replayStatus)
  };
}

function buildGenerationCostEventRow(input = {}) {
  const costType = String(input.costType || "").trim();
  if (!["estimated", "authorized", "final"].includes(costType)) {
    throw new GenerationPersistenceContractError("invalid_cost_type", "costType must be estimated, authorized, or final.");
  }
  const currency = requiredString(input.currency || "USD", "currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new GenerationPersistenceContractError("invalid_currency", "currency must be a three-letter uppercase code.");
  }
  return {
    organization_id: organizationScope(input),
    job_id: requiredString(input.jobId, "jobId"),
    attempt_id: nullableString(input.attemptId),
    cost_type: costType,
    amount_minor: nonNegativeInteger(input.amountMinor, "amountMinor"),
    currency,
    source: requiredString(input.source, "source")
  };
}

function buildGenerationAuditEventRow(input = {}) {
  const actorType = String(input.actorType || "system").trim();
  if (!["system", "user", "provider", "worker"].includes(actorType)) {
    throw new GenerationPersistenceContractError("invalid_actor_type", "actorType is not supported.");
  }
  return {
    organization_id: organizationScope(input),
    job_id: requiredString(input.jobId, "jobId"),
    attempt_id: nullableString(input.attemptId),
    event_type: requiredString(input.eventType, "eventType"),
    actor_type: actorType,
    actor_ref: nullableString(input.actorRef),
    details: sanitizeDetails(input.details)
  };
}

function buildGenerationJobTransitionPatch(input = {}) {
  const currentState = requiredState(input.currentState);
  const nextState = requiredState(input.nextState);
  const expectedVersion = positiveInteger(input.expectedVersion, "expectedVersion");
  if (!LEGAL_GENERATION_JOB_TRANSITIONS[currentState].includes(nextState)) {
    throw new GenerationPersistenceContractError(
      "illegal_transition",
      `Illegal generation transition ${currentState} -> ${nextState}.`
    );
  }
  return {
    state: nextState,
    version: expectedVersion + 1,
    expectedVersion
  };
}

function getGenerationPersistenceArchitecture() {
  return {
    ok: true,
    mode: "durable_provider_neutral_generation_control_plane",
    migration: GENERATION_PERSISTENCE_MIGRATION,
    tables: { ...GENERATION_PERSISTENCE_TABLES },
    tenantColumn: "organization_id",
    stateMachine: {
      states: [...GENERATION_JOB_STATES],
      transitions: Object.fromEntries(
        Object.entries(LEGAL_GENERATION_JOB_TRANSITIONS).map(([state, transitions]) => [state, [...transitions]])
      ),
      compareAndSwapVersion: true,
      terminalStateMutation: false,
      durableArtifactBeforeSuccess: true
    },
    dataBoundary: {
      rawPromptPersisted: false,
      rawMediaPersisted: false,
      credentialsPersisted: false,
      callbackPayloadPersisted: false,
      referencesAndDigestsOnly: true
    },
    executionAuthority: {
      providersEnabled: 0,
      externalNetworkEnabled: false,
      externalSpendEnabled: false,
      publishEnabled: false,
      sendEnabled: false,
      billingEnabled: false
    }
  };
}

function organizationScope(input) {
  return requiredString(input.organizationId || input.tenantId, "organizationId");
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
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    adapterKey: nullableString(input.adapterKey),
    modelRef: nullableString(input.modelRef),
    sourceJobId: nullableString(input.sourceJobId),
    rightsAttestationRef: nullableString(input.rightsAttestationRef)
  };
}

function sanitizeDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const safe = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (SENSITIVE_DETAIL_TOKENS.some((token) => normalized.includes(token))) continue;
    if (["string", "number", "boolean"].includes(typeof entry) || entry === null) {
      safe[key] = typeof entry === "string" ? entry.slice(0, 500) : entry;
    }
  }
  return safe;
}

function callbackStatus(value) {
  const status = String(value || "received").trim();
  if (!["received", "applied", "duplicate", "rejected", "failed"].includes(status)) {
    throw new GenerationPersistenceContractError("invalid_callback_status", "replayStatus is not supported.");
  }
  return status;
}

function requiredState(value) {
  if (!GENERATION_JOB_STATES.includes(value)) {
    throw new GenerationPersistenceContractError("invalid_state", `Unknown generation job state: ${value}.`);
  }
  return value;
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new GenerationPersistenceContractError("invalid_argument", `${name} must be a non-empty string.`);
  }
  return value.trim();
}

function nullableString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeToken(value) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, 120).replace(/[^a-zA-Z0-9_.:-]/g, "_") || null;
}

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new GenerationPersistenceContractError("invalid_argument", `${name} must be a positive integer.`);
  }
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new GenerationPersistenceContractError("invalid_argument", `${name} must be a non-negative integer.`);
  }
  return value;
}

function optionalNonNegativeInteger(value, name) {
  if (value === undefined || value === null) return null;
  return nonNegativeInteger(value, name);
}

function requiredSha256(value) {
  const candidate = requiredString(value, "sha256").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(candidate)) {
    throw new GenerationPersistenceContractError("invalid_digest", "Expected a 64-character hexadecimal SHA-256 digest.");
  }
  return candidate;
}

function optionalIso(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new GenerationPersistenceContractError("invalid_date", "Expected a valid date value.");
  }
  return date.toISOString();
}

module.exports = {
  GENERATION_PERSISTENCE_MIGRATION,
  GENERATION_PERSISTENCE_TABLES,
  GenerationPersistenceContractError,
  buildGenerationJobRow,
  buildGenerationAttemptRow,
  buildGenerationArtifactRow,
  buildGenerationCallbackEventRow,
  buildGenerationCostEventRow,
  buildGenerationAuditEventRow,
  buildGenerationJobTransitionPatch,
  getGenerationPersistenceArchitecture
};
