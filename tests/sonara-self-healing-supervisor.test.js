"use strict";

const assert = require("node:assert/strict");
const {
  SAFE_ACTIONS, planRemediation, measureServiceHealth,
  retryDelayMs, executeRemediation
} = require("../lib/sonara-self-healing-supervisor.cjs");

const NOW = 1_800_000_000_000;
const BASE = Object.freeze({
  incidentId: "inc-123", resourceId: "provider-mail", scope: "organization",
  organizationId: "tenant-42", observedAtMs: NOW - 1_000,
  sensitive: false, authorizedScope: true,
  signal: "provider.timeout", domain: "optional_provider", verifiedIdempotency: true,
  operationId: "op-789", attempt: 0, deadlineAtMs: NOW + 60_000
});
const plan = (overrides = {}) => planRemediation({ ...BASE, ...overrides }, { nowMs: NOW });
const GOOD_CLAIM = Object.freeze({ claimed: true, claimToken: "11111111-1111-4111-8111-111111111111", fencingToken: 1 });
const run = (overrides, adapters = {}) => executeRemediation({ ...BASE, signal: "provider.optional_unavailable", optionalDependency: true, ...overrides }, { nowMs: NOW, ...adapters });

describe("SONARA bounded self-healing supervisor", () => {
  it("classifies known transient operations deterministically without changing anything", () => {
    const first = plan();
    assert.equal(first.decision, "eligible");
    assert.equal(first.action, "retry_idempotent");
    assert.deepEqual(first, plan());
    assert.ok(first.delayMs > 0 && first.delayMs <= 30_000);
    assert.deepEqual(SAFE_ACTIONS, ["retry_idempotent", "requeue_expired_lease", "open_optional_circuit", "pause_optional_lane"]);
  });

  it("fails closed for unknown errors, authority gaps and security/payment/schema errors", () => {
    const cases = [
      { signal: "unknown" }, { signal: "database.schema_drift", domain: "database" },
      { domain: "payments" }, { domain: "security" }, { sensitive: true },
      { sensitive: undefined }, { authorizedScope: false }, { authorizedScope: undefined },
      { scope: "organization", organizationId: null },
      { scope: "process", organizationId: "tenant-42" },
      { resourceId: "", incidentId: "" }, { domain: "other" }
    ];
    for (const input of cases) assert.equal(plan(input).decision, "escalate", JSON.stringify(input));
  });

  it("refuses stale, future-dated and malformed observations", () => {
    for (const observedAtMs of [NOW - 120_001, NOW + 5_001, "bad", NaN]) {
      assert.equal(plan({ observedAtMs }).reason, "observation_stale_or_invalid");
    }
  });

  it("does not retry unproven or exhausted operations or cross a deadline", () => {
    assert.equal(plan({ verifiedIdempotency: false }).reason, "idempotency_not_proven");
    assert.equal(plan({ operationId: "" }).reason, "idempotency_not_proven");
    assert.equal(plan({ attempt: 3 }).reason, "retry_ceiling_reached");
    assert.equal(plan({ attempt: -1 }).reason, "retry_ceiling_reached");
    assert.equal(plan({ retryAfterMs: 31_000 }).reason, "retry_after_outside_budget");
    assert.equal(plan({ deadlineAtMs: NOW + 500 }).reason, "deadline_exceeded");
    assert.equal(retryDelayMs("op-789", 2), retryDelayMs("op-789", 2));
    assert.ok(retryDelayMs("op-789", 2, 6000) >= 6000);
  });

  it("requires a confirmed expired and fenced worker lease", () => {
    const lease = { signal: "worker.lease_expired", domain: "worker", leaseExpiresAtMs: NOW - 10, leaseVersion: 2 };
    assert.equal(plan(lease).action, "requeue_expired_lease");
    assert.equal(plan({ ...lease, leaseExpiresAtMs: NOW + 1 }).reason, "expired_fenced_lease_required");
    assert.equal(plan({ ...lease, leaseVersion: undefined }).reason, "expired_fenced_lease_required");
  });

  it("isolates optional providers and optional queues only with objective evidence", () => {
    const circuit = { signal: "provider.optional_unavailable", optionalDependency: true };
    assert.equal(plan(circuit).action, "open_optional_circuit");
    assert.equal(plan({ ...circuit, optionalDependency: false }).decision, "escalate");
    const queue = { signal: "queue.optional_overload", domain: "optional_queue", optionalLane: true, queueDepth: 101, queueLimit: 100 };
    assert.equal(plan(queue).action, "pause_optional_lane");
    assert.equal(plan({ ...queue, queueDepth: 99 }).decision, "escalate");
  });

  it("reports latency and SLO burn only with enough valid samples", () => {
    assert.equal(measureServiceHealth([{ ok: true, latencyMs: 4 }]).status, "insufficient_evidence");
    const samples = Array.from({ length: 100 }, (_, i) => ({ ok: i !== 99, latencyMs: i + 1 }));
    const health = measureServiceHealth(samples);
    assert.equal(health.p95Ms, 95);
    assert.equal(health.p99Ms, 99);
    assert.equal(health.errorRate, 0.01);
    assert.ok(Math.abs(health.burnRate - 10) < 1e-8);
    assert.equal(measureServiceHealth([{ ok: 1, latencyMs: 2 }]).status, "invalid_sample");
  });

  it("cannot perform any repair unless enabled with durable adapters", async () => {
    let calls = 0;
    const disabled = await run({}, { handlers: { retry_idempotent: () => { calls++; } } });
    assert.equal(disabled.status, "disabled");
    assert.equal((await run({}, { enabled: true })).reason, "durable_adapters_missing");
    assert.equal(calls, 0);
  });

  it("claims one resource once, audits before acting, and verifies independently", async () => {
    const order = [];
    const claims = new Set();
    const adapters = {
      enabled: true,
      ledger: { claim: async ({ resourceKey }) => {
        order.push("claim");
        if (claims.has(resourceKey)) return { claimed: false };
        claims.add(resourceKey);
        return GOOD_CLAIM;
      } },
      audit: async ({ state }) => { order.push("audit:" + state); return true; },
      handlers: { open_optional_circuit: async () => { order.push("repair"); } },
      verify: async () => { order.push("verify"); return { healthy: true, scopeVerified: true }; }
    };
    assert.equal((await run({}, adapters)).status, "recovered");
    assert.deepEqual(order, ["claim", "audit:claimed", "repair", "verify", "audit:verified"]);
    assert.equal((await run({ incidentId: "new-incident" }, adapters)).status, "suppressed");
    assert.equal(order.filter((x) => x === "repair").length, 1);
  });

  it("never executes after a failed pre-action audit", async () => {
    let executions = 0;
    const result = await run({}, {
      enabled: true, ledger: { claim: async () => GOOD_CLAIM },
      audit: async () => false,
      handlers: { open_optional_circuit: async () => { executions++; } },
      verify: async () => ({ healthy: true, scopeVerified: true })
    });
    assert.equal(result.reason, "pre_action_audit_failed");
    assert.equal(executions, 0);
  });

  it("escalates failed actions, missing verification and verification exceptions", async () => {
    const base = {
      enabled: true, ledger: { claim: async () => GOOD_CLAIM },
      audit: async () => true,
      handlers: { open_optional_circuit: async () => undefined }
    };
    assert.equal((await run({}, { ...base, verify: async () => ({ healthy: true }) })).reason, "recovery_not_verified");
    assert.equal((await run({}, { ...base, verify: async () => { throw Error("secret"); } })).reason, "execution_or_verification_failed");
    assert.equal((await run({}, { ...base, handlers: { open_optional_circuit: async () => { throw Error("token=private"); } }, verify: async () => ({ healthy: true, scopeVerified: true }) })).reason, "execution_or_verification_failed");
  });
});

// Exercises the actual diagnostic executable with the structured HTTP records
// the server produces; no production credential, network, or live host needed.
describe("SONARA offline runtime diagnostician", () => {
  it("summarizes 5xx availability and latency without echoing secrets or tenants", () => {
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const { execFileSync } = require("node:child_process");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-diagnostics-"));
    const file = path.join(dir, "http.jsonl");
    try {
      const rows = Array.from({ length: 40 }, (_, i) => ({
        event: "http.request", organization: "super-secret-tenant", detail: {
          status: i === 39 ? 503 : i === 0 ? 404 : 200,
          duration_ms: i + 1, apiKey: "sk_test_never_echo"
        }
      }));
      fs.writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
      const stdout = execFileSync(process.execPath, ["scripts/diagnose-runtime-evidence.mjs", "--input", file], {
        cwd: path.resolve(__dirname, ".."), encoding: "utf8"
      });
      assert.doesNotMatch(stdout, /super-secret-tenant|sk_test_never_echo/);
      const report = JSON.parse(stdout);
      assert.equal(report.health.status, "measured");
      assert.equal(report.health.failures, 1);
      assert.equal(report.health.p95Ms, 38);
      assert.equal(report.completeEvidence, true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
