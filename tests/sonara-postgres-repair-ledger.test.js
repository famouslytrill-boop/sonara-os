"use strict";
const assert = require("node:assert/strict");
const { createPostgresRepairLedger } = require("../lib/sonara-postgres-repair-ledger.cjs");
const { executeRemediation } = require("../lib/sonara-self-healing-supervisor.cjs");

const NOW = 1_800_000_000_000;
const ORG = "11111111-1111-4111-8111-111111111111";
const TOKEN = "22222222-2222-4222-8222-222222222222";
const INCIDENT = Object.freeze({
  incidentId: "incident-1", resourceId: "optional-email", scope: "organization",
  organizationId: ORG, observedAtMs: NOW, sensitive: false, authorizedScope: true,
  domain: "optional_provider", signal: "provider.optional_unavailable", optionalDependency: true, verifiedIdempotency: true,
  operationId: "operation-1", attempt: 0, deadlineAtMs: NOW + 45_000
});

describe("SONARA PostgreSQL durable repair boundary", () => {
  it("requires a protected RPC and validates the typed response", async () => {
    assert.throws(() => createPostgresRepairLedger(), /protected service-role/);
    const rpc = async () => ({ data: [{ claimed: true, claim_token: TOKEN, fencing_token: 3 }], error: null });
    const { ledger } = createPostgresRepairLedger({ rpc });
    const claim = await ledger.claim({ resourceKey: JSON.stringify(["organization", ORG, "retry_idempotent", "email"]),
      organizationId: ORG, action: "retry_idempotent", incidentId: "inc1", cooldownMs: 300000 });
    assert.deepEqual(claim, { claimed: true, claimToken: TOKEN, fencingToken: 3 });
  });

  it("denies malformed scope and policy inputs before invoking RPC", async () => {
    let calls = 0;
    const { ledger } = createPostgresRepairLedger({ rpc: async () => { calls++; return {data: []}; } });
    for (const args of [
      { action: "arbitrary", organizationId: ORG },
      { action: "retry_idempotent", organizationId: "tenant-42" },
      { action: "retry_idempotent", organizationId: ORG, cooldownMs: 10 },
    ]) {
      await assert.rejects(ledger.claim({ resourceKey: "key", incidentId: "inc", cooldownMs: 300000, ...args }));
    }
    assert.equal(calls, 0);
  });

  it("does not confuse a database outage or malformed row with duplicate suppression", async () => {
    const options = { resourceKey: "key", incidentId: "inc", organizationId: ORG,
      action: "retry_idempotent", cooldownMs: 300000 };
    for (const response of [{ error: { message: "failure" } }, { data: [{ claimed: true }] }, { data: [] }]) {
      const { ledger } = createPostgresRepairLedger({ rpc: async () => response });
      await assert.rejects(ledger.claim(options));
    }
    const { ledger } = createPostgresRepairLedger({ rpc: async () => ({ data: [{ claimed: false }] }) });
    assert.deepEqual(await ledger.claim(options), { claimed: false });
  });

  it("fences audit transitions with the correct claim token", async () => {
    const messages = [];
    const { audit } = createPostgresRepairLedger({ rpc: async (name, args) => {
      messages.push({ name, args });
      return { data: true };
    } });
    assert.equal(await audit({ resourceKey: "key", claimToken: TOKEN, state: "claimed" }), true);
    assert.equal(messages[0].name, "sonara_record_autonomic_repair");
    assert.equal(messages[0].args.p_claim_token, TOKEN);
    assert.equal(await audit({ resourceKey: "key", claimToken: "fake", state: "verified" }), false);
    assert.equal(await audit({ resourceKey: "key", claimToken: TOKEN, state: "secret_reset" }), false);
    assert.equal(messages.length, 1);
  });

  it("the supervisor gives the fencing token to action and independent verification", async () => {
    const events = [];
    const { ledger, audit } = createPostgresRepairLedger({rpc: async (name) => {
      if (name === "sonara_claim_autonomic_repair") return {data: [{claimed: true, claim_token: TOKEN, fencing_token: 7}]};
      return {data: true};
    }});
    const result = await executeRemediation(INCIDENT, {enabled: true, nowMs: NOW, ledger, audit,
      handlers: { open_optional_circuit: async (ctx) => { events.push([ctx.claimToken, ctx.fencingToken]); } },
      verify: async (ctx) => ({ healthy: ctx.fencingToken === 7, scopeVerified: ctx.organizationId === ORG }) });
    assert.equal(result.status, "recovered");
    assert.deepEqual(events, [[TOKEN, 7]]);
  });

  it("invalid winning claim tokens are escalated before any side effect", async () => {
    let executions = 0;
    const result = await executeRemediation(INCIDENT, {enabled: true, nowMs:NOW,
      ledger: { claim: async () => ({ claimed:true, claimToken:"invalid", fencingToken: 1 }) },
      audit: async () => true, handlers: { open_optional_circuit: async () => { executions++; } },
      verify: async () => ({ healthy:true, scopeVerified:true }) });
    assert.equal(result.reason, "invalid_durable_claim");
    assert.equal(executions, 0);
  });
});
