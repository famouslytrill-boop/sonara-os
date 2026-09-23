// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Canonical cursor/checkpoint semantics for incremental connector reads.
//
// This module deliberately does not persist anything by itself. It defines the
// state SONARA must persist once the reviewed integration_sync_cursors migration
// exists. Provider cursors are opaque to the platform; only the owning adapter
// may interpret them.

const INTEGRATION_CHECKPOINT_CONTRACT_VERSION = "1.0.0";
const INTEGRATION_CHECKPOINT_RESEARCH_DATE = "2026-09-23";

const CURSOR_TYPES = Object.freeze(["opaque", "timestamp", "sequence", "composite"]);
const BACKFILL_STATES = Object.freeze(["not_started", "running", "complete"]);

const BACKFILL_TRANSITIONS = Object.freeze({
  not_started: Object.freeze(new Set(["not_started", "running", "complete"])),
  running: Object.freeze(new Set(["running", "complete"])),
  complete: Object.freeze(new Set(["complete"]))
});

const SECRET_KEY = /(^|[_-])(secret|token|password|passwd|api[_-]?key|authorization|credential|private[_-]?key)([_-]|$)/i;
const MAX_CURSOR_LENGTH = 8192;
const MAX_METADATA_BYTES = 32768;

const INTEGRATION_SYNC_CURSOR_STORAGE_CONTRACT = Object.freeze({
  intendedTable: "integration_sync_cursors",
  migrationRequired: true,
  sourceOfTruth: "PostgreSQL",
  uniqueness: Object.freeze(["organization_id", "connection_id", "stream_key"]),
  requiredColumns: Object.freeze([
    "organization_id",
    "connection_id",
    "provider_key",
    "stream_key",
    "cursor_type",
    "cursor_value",
    "watermark_at",
    "checkpoint_version",
    "backfill_state",
    "schema_fingerprint",
    "metadata",
    "created_at",
    "updated_at"
  ]),
  directBrowserWrite: false,
  serviceRoleWrite: true,
  memberRead: "optional_after_product_review"
});

function requiredString(value, field) {
  const text = String(value == null ? "" : value).trim();
  if (!text) throw new TypeError(`${field} is required`);
  return text;
}

function optionalString(value, field, maximum = MAX_CURSOR_LENGTH) {
  if (value == null) return null;
  const text = String(value);
  if (text.length > maximum) throw new RangeError(`${field} exceeds ${maximum} characters`);
  return text || null;
}

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new TypeError(`${field} must be a non-negative integer`);
  }
  return number;
}

function isoTimestamp(value, field, { optional = true } = {}) {
  if (value == null || value === "") {
    if (optional) return null;
    throw new TypeError(`${field} is required`);
  }
  const text = String(value);
  const time = Date.parse(text);
  if (!Number.isFinite(time)) throw new TypeError(`${field} must be an ISO timestamp`);
  return new Date(time).toISOString();
}

function assertNoSecretKeys(value, path = "metadata") {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretKeys(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) {
      throw new TypeError(`${path}.${key} looks like secret material and cannot be checkpoint metadata`);
    }
    assertNoSecretKeys(nested, `${path}.${key}`);
  }
}

function normalizeMetadata(value) {
  if (value == null) return {};
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError("metadata must be an object");
  }
  assertNoSecretKeys(value);
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, "utf8") > MAX_METADATA_BYTES) {
    throw new RangeError(`metadata exceeds ${MAX_METADATA_BYTES} bytes`);
  }
  return JSON.parse(json);
}

function normalizeCursorType(value) {
  const type = requiredString(value || "opaque", "cursorType");
  if (!CURSOR_TYPES.includes(type)) {
    throw new TypeError(`cursorType must be one of: ${CURSOR_TYPES.join(", ")}`);
  }
  return type;
}

function normalizeBackfillState(value) {
  const state = requiredString(value || "not_started", "backfillState");
  if (!BACKFILL_STATES.includes(state)) {
    throw new TypeError(`backfillState must be one of: ${BACKFILL_STATES.join(", ")}`);
  }
  return state;
}

function checkpointIdentity(input = {}) {
  return Object.freeze({
    organizationId: requiredString(input.organizationId, "organizationId"),
    connectionId: requiredString(input.connectionId, "connectionId"),
    providerKey: requiredString(input.providerKey, "providerKey"),
    streamKey: requiredString(input.streamKey, "streamKey")
  });
}

function checkpointIdentityKey(input = {}) {
  const id = checkpointIdentity(input);
  return [id.organizationId, id.connectionId, id.providerKey, id.streamKey]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

function createIntegrationCheckpoint(input = {}) {
  const identity = checkpointIdentity(input);
  const cursorType = normalizeCursorType(input.cursorType);
  const checkpointVersion = positiveInteger(input.checkpointVersion ?? 0, "checkpointVersion");
  const recordedAt = isoTimestamp(input.recordedAt, "recordedAt", { optional: false });
  const watermarkAt = isoTimestamp(input.watermarkAt, "watermarkAt");
  const backfillState = normalizeBackfillState(input.backfillState);

  return Object.freeze({
    ...identity,
    cursorType,
    cursorValue: optionalString(input.cursorValue, "cursorValue"),
    watermarkAt,
    checkpointVersion,
    backfillState,
    schemaFingerprint: optionalString(input.schemaFingerprint, "schemaFingerprint", 512),
    metadata: Object.freeze(normalizeMetadata(input.metadata)),
    recordedAt
  });
}

function sameIdentity(a, b) {
  return a.organizationId === b.organizationId
    && a.connectionId === b.connectionId
    && a.providerKey === b.providerKey
    && a.streamKey === b.streamKey;
}

function assertWatermarkDoesNotMoveBackwards(previous, next) {
  if (!previous || !next) return;
  if (Date.parse(next) < Date.parse(previous)) {
    throw new RangeError("watermarkAt cannot move backwards");
  }
}

function assertBackfillTransition(previous, next) {
  if (!BACKFILL_TRANSITIONS[previous]?.has(next)) {
    throw new RangeError(`backfillState cannot move from ${previous} to ${next}`);
  }
}

function advanceIntegrationCheckpoint(currentInput = {}, nextInput = {}) {
  const current = createIntegrationCheckpoint(currentInput);
  const expectedVersion = positiveInteger(
    nextInput.expectedVersion ?? current.checkpointVersion,
    "expectedVersion"
  );
  if (expectedVersion !== current.checkpointVersion) {
    throw new Error(
      `checkpoint version conflict: expected ${expectedVersion}, current ${current.checkpointVersion}`
    );
  }

  const proposedIdentity = checkpointIdentity({
    organizationId: nextInput.organizationId ?? current.organizationId,
    connectionId: nextInput.connectionId ?? current.connectionId,
    providerKey: nextInput.providerKey ?? current.providerKey,
    streamKey: nextInput.streamKey ?? current.streamKey
  });
  if (!sameIdentity(current, proposedIdentity)) {
    throw new Error("checkpoint identity is immutable; create a new checkpoint for a different connection/provider/stream");
  }

  const watermarkAt = isoTimestamp(
    nextInput.watermarkAt === undefined ? current.watermarkAt : nextInput.watermarkAt,
    "watermarkAt"
  );
  assertWatermarkDoesNotMoveBackwards(current.watermarkAt, watermarkAt);

  const backfillState = normalizeBackfillState(
    nextInput.backfillState === undefined ? current.backfillState : nextInput.backfillState
  );
  assertBackfillTransition(current.backfillState, backfillState);

  return createIntegrationCheckpoint({
    ...proposedIdentity,
    cursorType: nextInput.cursorType ?? current.cursorType,
    cursorValue: nextInput.cursorValue === undefined ? current.cursorValue : nextInput.cursorValue,
    watermarkAt,
    checkpointVersion: current.checkpointVersion + 1,
    backfillState,
    schemaFingerprint: nextInput.schemaFingerprint === undefined
      ? current.schemaFingerprint
      : nextInput.schemaFingerprint,
    metadata: nextInput.metadata === undefined ? current.metadata : nextInput.metadata,
    recordedAt: nextInput.recordedAt
  });
}

function getIntegrationCheckpointArchitecture() {
  return Object.freeze({
    version: INTEGRATION_CHECKPOINT_CONTRACT_VERSION,
    observed: INTEGRATION_CHECKPOINT_RESEARCH_DATE,
    runtimeAuthority: "none",
    storage: INTEGRATION_SYNC_CURSOR_STORAGE_CONTRACT,
    invariants: Object.freeze([
      "provider cursors are opaque outside the provider adapter",
      "checkpoint identity is tenant + connection + provider + stream",
      "checkpoint versions advance exactly once per committed checkpoint",
      "watermarks never move backwards",
      "completed backfills never reopen in place",
      "secret material is forbidden in cursor metadata",
      "replay correctness and reconciliation remain separate from cursor persistence"
    ])
  });
}

module.exports = {
  INTEGRATION_CHECKPOINT_CONTRACT_VERSION,
  INTEGRATION_CHECKPOINT_RESEARCH_DATE,
  CURSOR_TYPES,
  BACKFILL_STATES,
  INTEGRATION_SYNC_CURSOR_STORAGE_CONTRACT,
  checkpointIdentity,
  checkpointIdentityKey,
  createIntegrationCheckpoint,
  advanceIntegrationCheckpoint,
  getIntegrationCheckpointArchitecture
};
