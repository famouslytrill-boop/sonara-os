"use strict";
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { verifySignedRecoveryObservation } = require("../lib/sonara-signed-recovery-observation.cjs");
const { ingestSignedRecoveryEnvelope } = require("../lib/sonara-signed-recovery-ingress.cjs");

const NOW = 1800000000000;
const TENANT = "11111111-1111-4111-8111-111111111111";
const KEY = Buffer.alloc(32, 0x7c);
const RAW_EVENT = Object.freeze({
  incidentId: "signed-snapshot-1", resourceId: "optional-sensor",
  sensorId: "sensor-B", signal: "provider.timeout",
  observedAtMs: NOW - 1000, organizationId: TENANT
});
const RESOURCE = Object.freeze({
  sensorId: "sensor-B", scope: "organization", organizationId: TENANT,
  authorizedScope: true, sensitive: false, domain: "optional_provider",
  verifiedIdempotency: true, operationId: "op-snapshot",
  attempt: 0, deadlineAtMs: NOW + 60000
});
function sign(event = RAW_EVENT) {
  const sensorId = event.sensorId, timestampMs = NOW, nonce = "a".repeat(32);
  const rawBody = Buffer.from(JSON.stringify(event), "utf8");
  const signature = createHmac("sha256", KEY)
    .update(Buffer.concat([
      Buffer.from("sonara-recovery-v1\n"),
      Buffer.from(sensorId + "\n" + timestampMs + "\n" + nonce + "\n"),
      rawBody
    ])).digest("hex");
  return {sensorId, timestampMs, nonce, rawBody, signature};
}

describe("SONARA signed observation immutable transport boundary", () => {
  it("uses original verified metadata even when key lookup mutates the envelope", async () => {
    const envelope = sign(), originalNonce = envelope.nonce;
    let claimed;
    const evidence = await verifySignedRecoveryObservation(envelope, {
      nowMs: NOW,
      getKey: async () => {
        envelope.sensorId = "sensor-attacker";
        envelope.timestampMs += 30000;
        envelope.nonce = "b".repeat(32);
        envelope.signature = "0".repeat(64);
        envelope.rawBody.fill(0);
        return KEY;
      },
      claimNonce: async (request) => { claimed = request; return true; }
    });
    assert.equal(evidence.authenticated, true);
    assert.equal(evidence.sensorId, RAW_EVENT.sensorId);
    assert.equal(evidence.observation.signal, RAW_EVENT.signal);
    assert.equal(claimed.sensorId, RAW_EVENT.sensorId);
    assert.equal(claimed.nonce, originalNonce);
    assert.equal(claimed.timestampMs, NOW);
  });
  it("never accepts a signature that was invalid when verification began", async () => {
    const envelope = sign(), validSignature = envelope.signature;
    envelope.signature = "0".repeat(64);
    let nonceClaims = 0;
    const result = await verifySignedRecoveryObservation(envelope, {
      nowMs: NOW,
      getKey: async () => { envelope.signature = validSignature; return KEY; },
      claimNonce: async () => { nonceClaims++; return true; }
    });
    assert.equal(result.authenticated, false);
    assert.equal(nonceClaims, 0);
  });
  it("rejects replay claim failures even with a valid frozen signature", async () => {
    const envelope = sign();
    const result = await verifySignedRecoveryObservation(envelope, {
      nowMs: NOW,
      getKey: async () => KEY,
      claimNonce: async () => {
        envelope.nonce = "c".repeat(32);
        return false;
      }
    });
    assert.equal(result.authenticated, false);
  });
  it("signs and parses the same original bytes through integrated ingress", async () => {
    const envelope = sign();
    const jobs=[];
    const result = await ingestSignedRecoveryEnvelope(envelope, {
      enabled:true, nowMs:NOW,
      getKey:async () => {
        envelope.sensorId="other-sensor";
        envelope.signature="0".repeat(64);
        envelope.rawBody.fill(0);
        return KEY;
      },
      claimNonce:async request => {
        assert.equal(request.sensorId,RAW_EVENT.sensorId);
        assert.equal(request.nonce,"a".repeat(32));
        return true;
      },
      lookup:async () => RESOURCE,
      scheduler:{schedule:async job => {
        jobs.push(job);
        return {persisted:true,notBeforeMs:job.notBeforeMs};
      }}
    });
    assert.equal(result.status, "scheduled");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].organizationId, TENANT);
  });
  it("reads each security header exactly once even with accessor-backed input", async () => {
    const signed = sign(), reads = {};
    const envelope = {};
    for (const [name, value] of Object.entries(signed)) {
      Object.defineProperty(envelope, name, {
        enumerable: true,
        get() {
          reads[name] = (reads[name] || 0) + 1;
          return reads[name] === 1 ? value : (name === "rawBody" ? Buffer.alloc(10) : "tampered");
        }
      });
    }
    const verified = await verifySignedRecoveryObservation(envelope, {
      nowMs: NOW, getKey: async () => KEY, claimNonce: async () => true
    });
    assert.equal(verified.authenticated, true);
    for (const name of Object.keys(signed)) assert.equal(reads[name], 1);
  });
  it("fails closed without touching the key store on a throwing signature getter", async () => {
    const envelope = sign();
    Object.defineProperty(envelope, "signature", {
      get() { throw Error("untrusted input"); }
    });
    let keyRequests = 0;
    const verified = await verifySignedRecoveryObservation(envelope, {
      nowMs: NOW, getKey: async () => { keyRequests++; return KEY; },
      claimNonce: async () => true
    });
    assert.equal(verified.authenticated, false);
    assert.equal(keyRequests, 0);
  });
  it("keeps disabled ingress entirely inert under tampering", async () => {
    const envelope = sign();
    let called = 0;
    const result = await ingestSignedRecoveryEnvelope(envelope, {
      enabled:false, nowMs:NOW,
      getKey:async()=>{called++;return KEY;},
      claimNonce:async()=>{called++;return true;},
      lookup:async()=>{called++;return RESOURCE;},
      scheduler:{schedule:async()=>{called++;return {persisted:true};}}
    });
    assert.equal(result.status,"disabled");
    assert.equal(called,0);
  });
});
