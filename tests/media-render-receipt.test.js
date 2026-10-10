// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { makeMelodyScore, renderScoreWav } = require("../lib/sonara-deterministic-media.cjs");
const { createMediaProcessingPlan } = require("../lib/sonara-media-processing-contract.cjs");
const { verifyMediaPreviewOutput, buildMediaPreviewProofEvent } = require("../lib/sonara-media-render-receipt.cjs");

const base = {
  organizationId: "org-1",
  actorUserId: "user-1",
  operation: "normalize_audio_preview",
  inputAssetId: "source-1",
  outputAssetId: "preview-1",
  sourceStorageKey: "org-1/private/song.wav",
  outputStorageKey: "org-1/previews/song.wav",
  contentType: "audio/wav",
  inputBytes: 250000,
  idempotencyKey: "media-output-proof-1"
};
const audio = renderScoreWav(makeMelodyScore({ notes: "C4 E4 G4 C5", bpm: 120 }));
const proof = (plan, values = {}) => verifyMediaPreviewOutput({
  plan, bytes: audio, contentType: "audio/wav", ...values
});

describe("isolated media rendering receipt contract", () => {
  it("checks a real SONARA-generated WAV buffer and returns identical deterministic evidence", () => {
    const plan = createMediaProcessingPlan(base);
    const first = proof(plan);
    const second = proof(plan);
    assert.deepEqual(first, second);
    assert.equal(first.outputSha256, createHash("sha256").update(audio).digest("hex"));
    assert.equal(first.status, "header_and_checksum_verified_only");
    assert.equal(first.fullDecodeVerified, false);
    assert.equal(first.rightsVerified, false);
    assert.equal(first.workerActivated, false);
    assert.equal(first.published, false);
  });

  it("emits metadata-only proof without declaring the render or rights complete", () => {
    const plan = createMediaProcessingPlan(base);
    const receipt = proof(plan);
    const event = buildMediaPreviewProofEvent(plan, receipt);
    assert.equal(event.organization_id, "org-1");
    assert.equal(event.event_name, "media.preview.output_checked");
    assert.equal(event.metadata.fullDecodeVerified, false);
    assert.equal(event.metadata.workerExecutionAttested, false);
    assert.equal(JSON.stringify(event).includes(audio.toString("base64")), false);
    assert.equal(JSON.stringify(event).includes(base.sourceStorageKey), false);
  });

  it("fails closed for a different tenant or a tenant-prefix confusion attack", () => {
    for (const sourceStorageKey of [
      "org-2/private/song.wav",
      "org-1-alt/private/song.wav",
      "org-1/../org-2/song.wav",
      "org-1//private/song.wav",
      "org-1/%2e%2e/private.wav",
      "org-1\\private\\song.wav"
    ]) {
      assert.throws(() => createMediaProcessingPlan({ ...base, sourceStorageKey }), /tenant-scoped storage key/);
    }
    assert.throws(() => createMediaProcessingPlan({ ...base, outputStorageKey: "org-2/previews/song.wav" }), /tenant-scoped storage key/);
  });

  it("refuses forged plan isolation or identity even with convincing-looking media bytes", () => {
    const safe = createMediaProcessingPlan(base);
    const badTenant = { ...safe, organizationId: "org-2" };
    assert.throws(() => proof(badTenant), /matching tenant/);
    const badPublish = { ...safe, isolation: { ...safe.isolation, publishAllowed: true } };
    assert.throws(() => proof(badPublish), /cannot widen isolation/);
    const badKey = { ...safe, output: { ...safe.output, storageKey: "org-2/previews/song.wav" } };
    assert.throws(() => proof(badKey), /tenant-scoped private preview/);
    const copySource = { ...safe, output: { ...safe.output, assetId: safe.input.assetId } };
    assert.throws(() => proof(copySource), /distinct tenant-scoped/);
  });

  it("refuses MIME spoofing, file extension mismatches, damaged headers and oversized output", () => {
    const plan = createMediaProcessingPlan(base);
    assert.throws(() => proof(plan, { contentType: "video/mp4" }), /incompatible/);
    assert.throws(() => proof(plan, { bytes: Buffer.from(audio.subarray(0, 24)) }), /bounded/);
    assert.throws(() => proof(plan, { bytes: Buffer.concat([Buffer.from("JUNK"), audio.subarray(4)]) }), /signature mismatch/);
    assert.throws(() => proof(plan, { maxOutputBytes: 1 }), /bounded/);
    assert.throws(() => proof(plan, { maxOutputBytes: 200 * 1024 * 1024 }), /maximum/);
    assert.throws(() => proof(createMediaProcessingPlan({ ...base, outputStorageKey: "org-1/previews/song.mp4" })), /extension/);
  });

  it("compares expected hashes and sizes without trusting claimed provider response metadata", () => {
    const plan = createMediaProcessingPlan(base);
    assert.throws(() => proof(plan, { expectedBytes: audio.length + 1 }), /byte count mismatch/);
    assert.throws(() => proof(plan, { expectedSha256: "1".repeat(64) }), /checksum mismatch/);
    assert.throws(() => proof(plan, { expectedSha256: "bad" }), /64-character digest/);
    assert.equal(proof(plan, { expectedBytes: audio.length,
      expectedSha256: createHash("sha256").update(audio).digest("hex") }).outputBytes, audio.length);
  });

  it("refuses to use inspection-only plans or forged completion evidence", () => {
    const safe = createMediaProcessingPlan(base);
    const inspected = createMediaProcessingPlan({ ...base, operation: "inspect" });
    assert.throws(() => proof(inspected), /not supported/);
    const receipt = proof(safe);
    assert.throws(() => buildMediaPreviewProofEvent(safe, { ...receipt, published: true }), /does not match/);
    assert.throws(() => buildMediaPreviewProofEvent(safe, { ...receipt }), /not issued/);
    assert.throws(() => buildMediaPreviewProofEvent(
      createMediaProcessingPlan({ ...base, organizationId: "org-2", sourceStorageKey: "org-2/private/song.wav",
        outputStorageKey: "org-2/previews/song.wav" }), receipt
    ), /does not match/);
  });
});
