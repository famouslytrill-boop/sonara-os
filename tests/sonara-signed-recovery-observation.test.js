"use strict";
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { verifySignedRecoveryObservation, createSignedRecoveryRegistry } =
  require("../lib/sonara-signed-recovery-observation.cjs");
const { admitTrustedIncident } = require("../lib/sonara-trusted-incident-admission.cjs");

const NOW = 1800000000000;
const ORG = "11111111-1111-4111-8111-111111111111";
const KEY = Buffer.alloc(32, 0xa7); // local fixture only; not a live credential
const OBSERVATION = Object.freeze({
  incidentId: "incident-1", resourceId: "optional-mail", sensorId: "sensor-A",
  signal: "provider.timeout", observedAtMs: NOW - 1000, organizationId: ORG
});
const REGISTERED = Object.freeze({
  sensorId: "sensor-A", scope: "organization", organizationId: ORG,
  domain: "optional_provider", sensitive: false, authorizedScope: true,
  verifiedIdempotency: true, operationId: "op-1", attempt: 0,
  deadlineAtMs: NOW + 60000
});
function envelope(observation = OBSERVATION, {
  timestampMs = NOW, nonce = "c".repeat(32), key = KEY
} = {}) {
  const rawBody = Buffer.from(JSON.stringify(observation), "utf8");
  const signature = createHmac("sha256", key)
    .update(Buffer.concat([
      Buffer.from("sonara-recovery-v1\n", "utf8"),
      Buffer.from(observation.sensorId + "\n" + timestampMs + "\n" + nonce + "\n"),
      rawBody
    ])).digest("hex");
  return { rawBody, sensorId: observation.sensorId, timestampMs, nonce, signature };
}
const opts = (overrides = {}) => ({
  getKey: async () => KEY, claimNonce: async () => true, nowMs: NOW,
  ...overrides
});
describe("SONARA server-only HMAC-signed recovery observation", () => {
  it("validates original bytes and returns only a frozen signed identity", async () => {
    const proof = await verifySignedRecoveryObservation(envelope(), opts());
    assert.equal(proof.authenticated, true);
    assert.equal(proof.sensorId, "sensor-A");
    assert.equal(proof.organizationId, ORG);
    assert.ok(Object.isFrozen(proof.observation));
  });
  it("rejects unsigned or modified payloads before claiming a nonce", async () => {
    let claimed = 0;
    const check = opts({ claimNonce: async () => { claimed++; return true; } });
    const signed = envelope();
    assert.equal((await verifySignedRecoveryObservation({ ...signed, signature: "0".repeat(64) }, check)).authenticated, false);
    const tampered = { ...signed, rawBody: Buffer.from(signed.rawBody) };
    tampered.rawBody[10] ^= 1;
    assert.equal((await verifySignedRecoveryObservation(tampered, check)).authenticated, false);
    assert.equal(claimed, 0);
  });
  it("replay protection requires one durable atomic nonce claim", async () => {
    const used = new Set();
    const o = opts({ claimNonce: async ({sensorId,nonce,ttlMs}) => {
      assert.equal(ttlMs, 250000);
      const token = sensorId + ":" + nonce;
      if (used.has(token)) return false;
      used.add(token); return true;
    }});
    assert.equal((await verifySignedRecoveryObservation(envelope(), o)).authenticated, true);
    assert.equal((await verifySignedRecoveryObservation(envelope(), o)).authenticated, false);
  });
  it("rejects stale and future timestamps, oversized bodies and re-encoded strings", async () => {
    const stale = envelope(OBSERVATION, { timestampMs: NOW - 121000 });
    const future = envelope(OBSERVATION, { timestampMs: NOW + 6000 });
    assert.equal((await verifySignedRecoveryObservation(stale, opts())).authenticated, false);
    assert.equal((await verifySignedRecoveryObservation(future, opts())).authenticated, false);
    const good = envelope();
    assert.equal((await verifySignedRecoveryObservation({ ...good, rawBody: good.rawBody.toString("utf8") }, opts())).authenticated, false);
    assert.equal((await verifySignedRecoveryObservation({ ...good, rawBody: Buffer.alloc(4100) }, opts())).authenticated, false);
  });
  it("rejects unavailable nonce store, key store and short secrets", async () => {
    assert.equal((await verifySignedRecoveryObservation(envelope(), opts({ claimNonce: async () => { throw Error("offline"); } }))).authenticated, false);
    assert.equal((await verifySignedRecoveryObservation(envelope(), opts({ getKey: async () => { throw Error("offline"); } }))).authenticated, false);
    assert.equal((await verifySignedRecoveryObservation(envelope(), opts({ getKey: async () => Buffer.alloc(12) }))).authenticated, false);
  });
  it("rejects a signature from another sensor key", async () => {
    assert.equal((await verifySignedRecoveryObservation(envelope(OBSERVATION, {key: Buffer.alloc(32, 0xcc)}), opts())).authenticated, false);
  });
  it("binds candidate to signed event rather than unsigned caller fields", async () => {
    const registry = createSignedRecoveryRegistry({
      envelope: envelope(), ...opts(), lookup: async () => REGISTERED
    });
    assert.equal((await registry.verifyObservation({ ...OBSERVATION, signal: "security.admin_reset" })).authenticated, false);
  });
  it("checks trusted tenant registry after valid signed authentication", async () => {
    const registry = createSignedRecoveryRegistry({
      envelope: envelope(), ...opts(), lookup: async () => REGISTERED
    });
    const a = await admitTrustedIncident({...OBSERVATION}, {registry, nowMs: NOW});
    assert.equal(a.admitted, true);
    assert.equal(a.incident.organizationId, ORG);
    assert.equal(a.plan.action, "retry_idempotent");
  });
  it("rejects wrong tenant even after cryptographic verification", async () => {
    const registry = createSignedRecoveryRegistry({
      envelope: envelope(), ...opts(),
      lookup: async () => ({...REGISTERED, organizationId: "22222222-2222-4222-8222-222222222222"})
    });
    const a = await admitTrustedIncident({...OBSERVATION}, {registry, nowMs:NOW});
    assert.equal(a.admitted, false);
    assert.equal(a.reason, "untrusted_monitor_or_scope");
  });
  it("does not accept authority fields added to the signed payload", async () => {
    const signed = envelope({...OBSERVATION, authorizedScope:true, sensitive:false});
    assert.equal((await verifySignedRecoveryObservation(signed, opts())).authenticated, false);
  });
});
