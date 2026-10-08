// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Custom SONARA-owned monitor transport, NOT GitHub/Stripe/third-party webhook
// parsing. Accept Node IncomingMessage.rawHeaders rather than normalized
// headers: normalized maps can hide duplicate conflicting security headers.
// This module does not start an HTTP listener, read secrets or schedule work.
const NAMES = Object.freeze({
  sensorId: "x-sonara-sensor-id",
  timestampMs: "x-sonara-timestamp-ms",
  nonce: "x-sonara-nonce",
  signature: "x-sonara-signature"
});
const REQUIRED = new Set(Object.values(NAMES));
function deny() {
  return Object.freeze({ ok: false, reason: "invalid_signed_transport" });
}
function parseSignedRecoveryTransport(rawBody, rawHeaders) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length < 2 || rawBody.length > 4096 ||
      !Array.isArray(rawHeaders) || rawHeaders.length === 0 ||
      rawHeaders.length > 128 || rawHeaders.length % 2 !== 0) return deny();
  const found = new Map();
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const name = rawHeaders[i], value = rawHeaders[i + 1];
    if (typeof name !== "string" || typeof value !== "string" ||
        name.length > 128 || value.length > 256 ||
        !/^[A-Za-z0-9-]+$/.test(name)) return deny();
    const normalized = name.toLowerCase();
    if (normalized.startsWith("x-sonara-") && !REQUIRED.has(normalized)) return deny();
    if (!REQUIRED.has(normalized)) continue;
    // Reject duplicate headers (even when original casing differs), folded
    // values, control characters and comma-coalesced duplicate values.
    if (found.has(normalized) || !value || /[,\r\n\0\t ]/.test(value)) return deny();
    found.set(normalized, value);
  }
  if (found.size !== REQUIRED.size) return deny();
  const sensorId = found.get(NAMES.sensorId);
  const stamp = found.get(NAMES.timestampMs);
  const nonce = found.get(NAMES.nonce);
  const signature = found.get(NAMES.signature);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(sensorId) ||
      !/^[1-9][0-9]{0,15}$/.test(stamp) ||
      !/^[0-9a-f]{32}$/.test(nonce) ||
      !/^[0-9a-f]{64}$/.test(signature)) return deny();
  const timestampMs = Number(stamp);
  if (!Number.isSafeInteger(timestampMs) || timestampMs <= 0) return deny();
  return Object.freeze({
    ok: true,
    envelope: Object.freeze({
      sensorId, timestampMs, nonce, signature,
      rawBody: Buffer.from(rawBody)
    })
  });
}
module.exports = { parseSignedRecoveryTransport };
