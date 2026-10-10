// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Phase 1, offline-only proof of private media output. This module cannot spawn
// ffmpeg, read a file, launch a worker, persist an asset or publish content.
// A matching file signature is NOT a decoder, malware scan, copyright check,
// worker attestation, or authorization to expose customer data.
const { createHash, timingSafeEqual } = require("node:crypto");
const { buildPlatformEvent } = require("./sonara-platform-kernel.cjs");
const { MEDIA_PROCESSING_VERSION } = require("./sonara-media-processing-contract.cjs");

const RENDER_PROOF_VERSION = "1.0.0";
// An evidence event may only be created from a receipt actually minted by the
// local verifier, not from caller-supplied JSON with invented hash/status fields.
const mintedReceipts = new WeakSet();
const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const ABSOLUTE_MAX_OUTPUT_BYTES = 160 * 1024 * 1024;

const OUTPUT_FORMATS = Object.freeze({
  "image/png": Object.freeze({ extension: ".png", minimumBytes: 33 }),
  "image/jpeg": Object.freeze({ extension: ".jpg", minimumBytes: 12 }),
  "audio/wav": Object.freeze({ extension: ".wav", minimumBytes: 44 }),
  "video/mp4": Object.freeze({ extension: ".mp4", minimumBytes: 16 })
});
const OPERATION_MIME = Object.freeze({
  thumbnail_preview: Object.freeze({ image: ["image/png", "image/jpeg"], video: ["image/png", "image/jpeg"] }),
  waveform_preview: Object.freeze({ audio: ["image/png"] }),
  normalize_audio_preview: Object.freeze({ audio: ["audio/wav"] }),
  transcode_preview: Object.freeze({ audio: ["audio/wav"], video: ["video/mp4"] })
});

function checkTenantKey(key, organizationId) {
  if (typeof key !== "string" || key.length > 1024 || /[\\%?#\u0000-\u001f\u007f]/.test(key)) return false;
  const parts = key.split("/");
  return parts.length >= 3 && parts[0] === organizationId
    && parts.slice(1).every((part) => part && part !== "." && part !== "..");
}

function checkPlan(plan) {
  if (!plan || plan.contractVersion !== MEDIA_PROCESSING_VERSION) throw new TypeError("a media processing plan is required");
  if (!OPERATION_MIME[plan.operation]?.[plan.family]) throw new TypeError("operation is not supported by this proof");
  if (typeof plan.organizationId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(plan.organizationId)) {
    throw new TypeError("invalid tenant");
  }
  if (!plan.envelope || plan.envelope.organizationId !== plan.organizationId
    || plan.envelope.actorUserId !== plan.actorUserId
    || typeof plan.envelope.idempotencyKey !== "string" || !plan.envelope.idempotencyKey.trim()) {
    throw new TypeError("media proof requires matching tenant, actor and idempotency envelope");
  }
  if (plan.input?.mount !== "read_only" || plan.output?.visibility !== "private"
    || plan.output?.lifecycle !== "preview"
    || !plan.input?.assetId || !plan.output?.assetId
    || plan.input.assetId === plan.output.assetId
    || !checkTenantKey(plan.input.storageKey, plan.organizationId)
    || !checkTenantKey(plan.output.storageKey, plan.organizationId)
    || plan.input.storageKey === plan.output.storageKey) {
    throw new TypeError("media proof requires distinct tenant-scoped private preview assets");
  }
  const iso = plan.isolation;
  if (!iso || iso.networkAccess !== false || iso.externalProviderCalls !== false
    || iso.publishAllowed !== false || iso.destructiveWritesAllowed !== false
    || iso.customerDataExportAllowed !== false || iso.workerActivation !== "disabled_by_default") {
    throw new TypeError("media proof cannot widen isolation or activate workers");
  }
  return plan;
}

function fileSignatureMatches(data, mime) {
  if (mime === "image/png") {
    return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      && data.toString("ascii", 12, 16) === "IHDR";
  }
  if (mime === "image/jpeg") {
    return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
      && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9;
  }
  if (mime === "audio/wav") {
    return data.toString("ascii", 0, 4) === "RIFF"
      && data.toString("ascii", 8, 12) === "WAVE"
      && data.readUInt32LE(4) === data.length - 8;
  }
  if (mime === "video/mp4") {
    return data.toString("ascii", 4, 8) === "ftyp"
      && data.readUInt32BE(0) >= 16 && data.readUInt32BE(0) <= data.length;
  }
  return false;
}

function mediaDigest(data) {
  return createHash("sha256").update(data).digest("hex");
}

function verifyMediaPreviewOutput({ plan, bytes, contentType, maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  expectedSha256, expectedBytes } = {}) {
  checkPlan(plan);
  if (typeof contentType !== "string" || !OUTPUT_FORMATS[contentType]) {
    throw new TypeError("unsupported output content type");
  }
  if (!OPERATION_MIME[plan.operation][plan.family].includes(contentType)) {
    throw new TypeError("output MIME is incompatible with input family or operation");
  }
  const format = OUTPUT_FORMATS[contentType];
  const key = plan.output.storageKey.toLowerCase();
  if (!key.endsWith(format.extension) && !(contentType === "image/jpeg" && key.endsWith(".jpeg"))) {
    throw new TypeError("output extension does not match declared MIME");
  }
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > ABSOLUTE_MAX_OUTPUT_BYTES) {
    throw new RangeError("output byte budget exceeds the maximum permitted limit");
  }
  if (!Buffer.isBuffer(bytes) || bytes.length < format.minimumBytes || bytes.length > maxOutputBytes) {
    throw new RangeError("output must be a bounded non-empty media Buffer");
  }
  if (expectedBytes !== undefined && (!Number.isSafeInteger(expectedBytes) || expectedBytes !== bytes.length)) {
    throw new TypeError("output byte count mismatch");
  }
  if (!fileSignatureMatches(bytes, contentType)) throw new TypeError("media signature mismatch");
  const outputSha256 = mediaDigest(bytes);
  if (expectedSha256 !== undefined) {
    if (typeof expectedSha256 !== "string" || !/^[0-9a-f]{64}$/.test(expectedSha256)) {
      throw new TypeError("expected SHA-256 must be a lowercase 64-character digest");
    }
    if (!timingSafeEqual(Buffer.from(expectedSha256, "hex"), Buffer.from(outputSha256, "hex"))) {
      throw new Error("output checksum mismatch");
    }
  }
  // Scoped, stable receipt identity. An in-memory hash is not a signed worker
  // attestation, a durable state machine, or a billing/settlement record.
  const receiptId = mediaDigest(Buffer.from(JSON.stringify([
    RENDER_PROOF_VERSION, plan.organizationId, plan.envelope.idempotencyKey,
    plan.input.assetId, plan.output.assetId, plan.operation, contentType,
    outputSha256, bytes.length
  ]), "utf8"));
  const receipt = Object.freeze({
    version: RENDER_PROOF_VERSION,
    receiptId,
    organizationId: plan.organizationId,
    actorUserId: plan.actorUserId,
    idempotencyKey: plan.envelope.idempotencyKey,
    operation: plan.operation,
    inputAssetId: plan.input.assetId,
    outputAssetId: plan.output.assetId,
    contentType,
    outputSha256,
    outputBytes: bytes.length,
    status: "header_and_checksum_verified_only",
    fullDecodeVerified: false,
    rightsVerified: false,
    malwareScanVerified: false,
    workerExecutionAttested: false,
    published: false,
    workerActivated: false
  });
  mintedReceipts.add(receipt);
  return receipt;
}

function buildMediaPreviewProofEvent(plan, receipt) {
  checkPlan(plan);
  if (!receipt || receipt.version !== RENDER_PROOF_VERSION
    || receipt.organizationId !== plan.organizationId
    || receipt.actorUserId !== plan.actorUserId
    || receipt.idempotencyKey !== plan.envelope.idempotencyKey
    || receipt.inputAssetId !== plan.input.assetId
    || receipt.outputAssetId !== plan.output.assetId || receipt.operation !== plan.operation
    || receipt.status !== "header_and_checksum_verified_only"
    || receipt.published !== false || receipt.workerActivated !== false
    || typeof receipt.outputSha256 !== "string" || !/^[a-f0-9]{64}$/.test(receipt.outputSha256)) {
    throw new TypeError("receipt does not match isolated processing plan");
  }
  if (!mintedReceipts.has(receipt)) throw new TypeError("receipt was not issued by this verifier");
  return buildPlatformEvent(plan.envelope, "media.preview.output_checked", {
    metadata: {
      version: RENDER_PROOF_VERSION,
      operation: plan.operation,
      outputAssetId: plan.output.assetId,
      mime: receipt.contentType,
      outputSha256: receipt.outputSha256,
      outputBytes: receipt.outputBytes,
      receiptId: receipt.receiptId,
      fullDecodeVerified: false,
      workerExecutionAttested: false,
      published: false
    }
  });
}

module.exports = {
  RENDER_PROOF_VERSION, DEFAULT_MAX_OUTPUT_BYTES, ABSOLUTE_MAX_OUTPUT_BYTES,
  OUTPUT_FORMATS, verifyMediaPreviewOutput, buildMediaPreviewProofEvent
};
