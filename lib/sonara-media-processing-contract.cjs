// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createExecutionEnvelope, buildPlatformEvent } = require("./sonara-platform-kernel.cjs");

const MEDIA_PROCESSING_VERSION = "1.0.0";
const MEDIA_OPERATIONS = Object.freeze([
  "inspect",
  "thumbnail_preview",
  "waveform_preview",
  "transcode_preview",
  "normalize_audio_preview"
]);
const DEFAULT_MAX_INPUT_BYTES = 512 * 1024 * 1024;

function requiredString(value, field) {
  const text = String(value == null ? "" : value).trim();
  if (!text) throw new TypeError(`${field} is required`);
  return text;
}

function nonNegativeInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new TypeError(`${field} must be a non-negative integer`);
  return number;
}

function mediaFamily(contentType) {
  const value = requiredString(contentType, "contentType").toLowerCase();
  if (value.startsWith("image/")) return "image";
  if (value.startsWith("audio/")) return "audio";
  if (value.startsWith("video/")) return "video";
  throw new TypeError("contentType must be image, audio, or video media");
}

function operationForFamily(operation, family) {
  const name = requiredString(operation, "operation");
  if (!MEDIA_OPERATIONS.includes(name)) throw new TypeError(`unsupported media operation: ${name}`);
  if (name === "thumbnail_preview" && family === "audio") {
    throw new TypeError("thumbnail_preview requires image or video input");
  }
  if ((name === "waveform_preview" || name === "normalize_audio_preview") && family !== "audio") {
    throw new TypeError(`${name} requires audio input`);
  }
  if (name === "transcode_preview" && family === "image") {
    throw new TypeError("transcode_preview requires audio or video input");
  }
  return name;
}

function createMediaProcessingPlan(input = {}) {
  const organizationId = requiredString(input.organizationId, "organizationId");
  const actorUserId = requiredString(input.actorUserId, "actorUserId");
  const inputAssetId = requiredString(input.inputAssetId, "inputAssetId");
  const outputAssetId = requiredString(input.outputAssetId, "outputAssetId");
  const sourceStorageKey = requiredString(input.sourceStorageKey, "sourceStorageKey");
  const outputStorageKey = requiredString(input.outputStorageKey, "outputStorageKey");
  const contentType = requiredString(input.contentType, "contentType");
  const family = mediaFamily(contentType);
  const operation = operationForFamily(input.operation, family);
  const inputBytes = nonNegativeInteger(input.inputBytes, "inputBytes");
  const maxInputBytes = nonNegativeInteger(input.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES, "maxInputBytes");
  const idempotencyKey = requiredString(input.idempotencyKey, "idempotencyKey");

  if (maxInputBytes < 1) throw new TypeError("maxInputBytes must be greater than zero");
  if (inputBytes > maxInputBytes) throw new Error("media input exceeds the configured processing limit");
  if (inputAssetId === outputAssetId) throw new Error("media processing must write a new output asset");
  if (sourceStorageKey === outputStorageKey) throw new Error("media processing must not overwrite its input object");

  const envelope = createExecutionEnvelope({
    organizationId,
    actorUserId,
    workflowKey: input.workflowKey || "creator_media_preview",
    actionType: input.actionType || "draft_content",
    idempotencyKey,
    correlationId: input.correlationId || idempotencyKey,
    resourceType: "media_asset",
    resourceId: inputAssetId,
    metadata: {
      contract: MEDIA_PROCESSING_VERSION,
      operation,
      family,
      outputAssetId
    }
  });

  return Object.freeze({
    contractVersion: MEDIA_PROCESSING_VERSION,
    envelope,
    organizationId,
    actorUserId,
    operation,
    family,
    input: Object.freeze({
      assetId: inputAssetId,
      storageKey: sourceStorageKey,
      contentType,
      bytes: inputBytes,
      mount: "read_only"
    }),
    output: Object.freeze({
      assetId: outputAssetId,
      storageKey: outputStorageKey,
      visibility: "private",
      lifecycle: "preview"
    }),
    isolation: Object.freeze({
      networkAccess: false,
      externalProviderCalls: false,
      publishAllowed: false,
      destructiveWritesAllowed: false,
      customerDataExportAllowed: false,
      workerActivation: "disabled_by_default"
    })
  });
}

function buildMediaProcessingEvidenceEvent(plan, outcome = {}) {
  if (!plan || plan.contractVersion !== MEDIA_PROCESSING_VERSION) {
    throw new TypeError("a media processing plan is required");
  }
  const status = requiredString(outcome.status, "status");
  if (!["succeeded", "failed", "cancelled"].includes(status)) throw new TypeError("status is invalid");

  return buildPlatformEvent(plan.envelope, "media.preview.completed", {
    metadata: {
      contract: MEDIA_PROCESSING_VERSION,
      operation: plan.operation,
      family: plan.family,
      status,
      inputAssetId: plan.input.assetId,
      outputAssetId: plan.output.assetId,
      outputVisibility: plan.output.visibility
    }
  });
}

module.exports = {
  MEDIA_PROCESSING_VERSION,
  MEDIA_OPERATIONS,
  DEFAULT_MAX_INPUT_BYTES,
  createMediaProcessingPlan,
  buildMediaProcessingEvidenceEvent,
  mediaFamily
};
