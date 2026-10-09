// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHmac, timingSafeEqual } = require("node:crypto");

// Server-only custom SONARA sensor protocol. Do not use for Stripe, GitHub or
// third-party webhooks: those publishers have their own signature standards.
// No listener, token, secret, or in-memory nonce cache is initialized here.
const PREFIX = Buffer.from("sonara-recovery-v1\n", "utf8");
const SENSOR_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/i;
const MAX_BODY_BYTES = 4096;
const MAX_AGE_MS = 120000;
const MAX_FUTURE_MS = 5000;
const NONCE_TTL_MS = 2 * (MAX_AGE_MS + MAX_FUTURE_MS);
const OBSERVATION_FIELDS = Object.freeze([
  "incidentId", "resourceId", "sensorId", "signal", "observedAtMs", "organizationId"
]);

function signedBytes(sensorId, timestampMs, nonce, rawBody) {
  return Buffer.concat([
    PREFIX,
    Buffer.from(sensorId + "\n" + String(timestampMs) + "\n" + nonce + "\n", "utf8"),
    rawBody
  ]);
}

function invalid() {
  return Object.freeze({ authenticated: false });
}

// Input envelope is prepared by a server handler with the original unmodified
// request bytes and header values. getKey must fetch a per-sensor secret from
// server-only storage; claimNonce MUST be a durable atomic insert-on-conflict
// with expiry >= NONCE_TTL_MS. It must not be an in-memory Set or Redis cache
// whose connection errors default to success.
async function verifySignedRecoveryObservation(envelope, {
  getKey, claimNonce, nowMs = Date.now()
} = {}) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) ||
      typeof getKey !== "function" || typeof claimNonce !== "function" ||
      !Number.isSafeInteger(nowMs)) return invalid();

  // Read security metadata exactly once. Accessor-backed request wrappers may
  // return different values on successive reads, even without an await.
  let sensorId, timestampMs, nonce, signature, rawBody;
  try {
    sensorId = envelope.sensorId;
    timestampMs = envelope.timestampMs;
    nonce = envelope.nonce;
    signature = envelope.signature;
    const inputBody = envelope.rawBody;
    if (!Buffer.isBuffer(inputBody) || inputBody.length < 2 ||
        inputBody.length > MAX_BODY_BYTES) return invalid();
    rawBody = Buffer.from(inputBody);
  } catch {
    return invalid();
  }
  if (!SENSOR_ID.test(sensorId || "") ||
      !Number.isSafeInteger(timestampMs) ||
      nowMs - timestampMs > MAX_AGE_MS ||
      timestampMs - nowMs > MAX_FUTURE_MS ||
      !HEX32.test(nonce || "") ||
      !HEX64.test(signature || "")) return invalid();

  let observation;
  try {
    observation = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return invalid();
  }
  if (!observation || typeof observation !== "object" || Array.isArray(observation) ||
      Object.keys(observation).length !== OBSERVATION_FIELDS.length ||
      !OBSERVATION_FIELDS.every((field) => Object.hasOwn(observation, field)) ||
      observation.sensorId !== sensorId ||
      !SENSOR_ID.test(observation.sensorId) ||
      !SENSOR_ID.test(observation.resourceId || "") ||
      !SENSOR_ID.test(observation.incidentId || "") ||
      !UUID.test(observation.organizationId || "") ||
      typeof observation.signal !== "string" ||
      !SENSOR_ID.test(observation.signal) ||
      !Number.isSafeInteger(observation.observedAtMs) ||
      Math.abs(observation.observedAtMs - timestampMs) > MAX_FUTURE_MS) {
    return invalid();
  }

  // Check the MAC on the EXACT raw bytes. Never stringify parsed JSON to
  // reconstruct it. Any key lookup error, bad MAC or replay-store failure
  // denies admission without leaking secrets, payload or claimed identity.
  try {
    const key = await getKey(sensorId);
    if (!Buffer.isBuffer(key) || key.length < 32) return invalid();
    const actual = Buffer.from(signature, "hex");
    const expected = createHmac("sha256", key)
      .update(signedBytes(sensorId, timestampMs,
        nonce, rawBody)).digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return invalid();
    const claimed = await claimNonce({
      sensorId, nonce: nonce.toLowerCase(),
      timestampMs, ttlMs: NONCE_TTL_MS
    });
    if (claimed !== true) return invalid();
  } catch {
    return invalid();
  }
  return Object.freeze({
    authenticated: true, sensorId: observation.sensorId,
    resourceId: observation.resourceId, organizationId: observation.organizationId,
    observation: Object.freeze(observation)
  });
}

// Bridges the signed raw-body boundary to the existing trusted admission
// interface. lookup is a separate server-owned authority source: a sensor's
// signed organization ID is NOT sufficient to authorize a tenant operation.
function createSignedRecoveryRegistry({
  envelope, getKey, claimNonce, lookup, nowMs = Date.now()
} = {}) {
  if (typeof lookup !== "function") throw TypeError("server_registry_required");
  return Object.freeze({
    lookup,
    async verifyObservation(candidate) {
      const proof = await verifySignedRecoveryObservation(envelope, { getKey, claimNonce, nowMs });
      if (proof.authenticated !== true ||
          !candidate || typeof candidate !== "object" || Array.isArray(candidate) ||
          Object.keys(candidate).length !== OBSERVATION_FIELDS.length ||
          !OBSERVATION_FIELDS.every((field) => candidate[field] === proof.observation[field])) {
        return invalid();
      }
      return Object.freeze({
        authenticated: true, sensorId: proof.sensorId, resourceId: proof.resourceId,
        organizationId: proof.organizationId
      });
    }
  });
}

module.exports = {
  createSignedRecoveryRegistry, verifySignedRecoveryObservation,
  MAX_AGE_MS, MAX_FUTURE_MS, NONCE_TTL_MS
};
