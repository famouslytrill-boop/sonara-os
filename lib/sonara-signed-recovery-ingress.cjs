// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createSignedRecoveryRegistry } = require("./sonara-signed-recovery-observation.cjs");
const { ingestAuthenticatedRecoveryEvidence } = require("./sonara-recovery-incident-ingress.cjs");

// Server-side composition only. No HTTP route, environment secret, activation,
// provider call, timer or queue poll is created here.
// The request body must arrive from a TLS-protected internal sensor ingress as
// an unmodified Buffer; the verifier authenticates those exact same bytes.
async function ingestSignedRecoveryEnvelope(envelope, {
  enabled = false, getKey, claimNonce, lookup, scheduler, nowMs = Date.now()
} = {}) {
  if (enabled !== true) return Object.freeze({
    status: "disabled", reason: "recovery_not_enabled"
  });
  if (!envelope || !Buffer.isBuffer(envelope.rawBody) ||
      typeof getKey !== "function" || typeof claimNonce !== "function" ||
      typeof lookup !== "function" ||
      !scheduler || typeof scheduler.schedule !== "function") {
    return Object.freeze({ status: "escalated", reason: "signed_ingress_adapters_missing" });
  }
  // Parse and verify one immutable transport snapshot. Even a privileged
  // callback cannot swap headers/body between parsing and HMAC validation.
  let event, signedEnvelope;
  try {
    if (envelope.rawBody.length < 2 || envelope.rawBody.length > 4096) throw Error("body_size");
    signedEnvelope = Object.freeze({
      sensorId: envelope.sensorId, timestampMs: envelope.timestampMs,
      nonce: envelope.nonce, signature: envelope.signature,
      rawBody: Buffer.from(envelope.rawBody)
    });
    event = JSON.parse(signedEnvelope.rawBody.toString("utf8"));
  } catch {
    return Object.freeze({ status: "escalated", reason: "malformed_signed_observation" });
  }
  const registry = createSignedRecoveryRegistry({
    envelope: signedEnvelope, getKey, claimNonce, lookup, nowMs
  });
  return ingestAuthenticatedRecoveryEvidence(event, {
    enabled: true, registry, scheduler, nowMs
  });
}
module.exports = { ingestSignedRecoveryEnvelope };
