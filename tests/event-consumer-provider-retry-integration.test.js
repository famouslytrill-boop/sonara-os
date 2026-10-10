// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const {
  CANARY_KIND,
  createEventConsumerWorker,
  retryPlanForOutcome
} = require("../lib/sonara-event-consumer.cjs");

const ORG = "00000000-0000-4000-8000-000000000111";
const BASE = "2026-10-09T02:00:00.000Z";
const START = Date.parse(BASE);

function runCase(outcome, { attemptCount = 2, enabled = true } = {}) {
  const settlements = [];
  const logs = [];
  let claims = 0;
  const worker = createEventConsumerWorker({
    repository: {
      claimNextFiltered: async () => {
        claims += 1;
        return {
          ok: true,
          row: {
            id: "outbox-1",
            organization_id: ORG,
            event_id: "event-1",
            idempotency_key: "evt_unique",
            correlation_id: "corr-1",
            kind: CANARY_KIND,
            action: "consumer_canary",
            producer: "sonara-event-consumer-canary:retry-bridge",
            payload: { canary: true },
            attempt_count: attemptCount,
            created_at: BASE
          }
        };
      },
      settle: async (params) => {
        settlements.push(params);
        return { ok: true, row: { state: params.outcome } };
      }
    },
    handlers: { [CANARY_KIND]: async () => outcome },
    emitEvent: (record) => logs.push(record),
    claimIdFactory: () => "deterministic-claim",
    now: () => new Date(BASE)
  });
  return worker.runOnce({
    enabled,
    organizationId: ORG,
    kinds: [CANARY_KIND],
    producers: ["sonara-event-consumer-canary:retry-bridge"]
  }).then((result) => ({ result, settlements, logs, claims }));
}

describe("provider delay integration with the existing event consumer", () => {
  it("leaves the synthetic canary's legacy deterministic backoff untouched", async () => {
    const { result, settlements } = await runCase({
      ok: false, code: "temporary", retryable: true
    });
    assert.equal(result.status, "retry");
    assert.equal(settlements[0].nextAvailableAt, "2026-10-09T02:00:10.000Z");
  });

  it("honors a 120-second push provider hold rather than retrying after ten seconds", async () => {
    const { result, settlements, logs } = await runCase({
      ok: false, code: "retry_later", retryable: true,
      retryAfterStatus: "ok", retryAfterSeconds: 120
    });
    assert.equal(result.status, "retry");
    assert.equal(result.code, "retry_later");
    assert.equal(result.nextAvailableAt, "2026-10-09T02:02:00.000Z");
    assert.equal(settlements[0].nextAvailableAt, result.nextAvailableAt);
    assert.equal(settlements[0].organizationId, ORG);
    assert.match(settlements[0].consumer, /#deterministic-claim$/);
    assert.equal(logs[0].detail.backoff_ms, 120000);
  });

  it("dead-letters when a useful notification expires before the provider will accept it", async () => {
    const { result, settlements } = await runCase({
      ok: false, code: "retry_later", retryable: true,
      retryAfterSeconds: 120, expiresAtMs: START + 30000
    });
    assert.equal(result.status, "dead_lettered");
    assert.equal(result.code, "would_outlive_message");
    assert.equal(settlements[0].nextAvailableAt, null);
  });

  it("holds overlarge provider instructions for operator review", async () => {
    const { result, settlements } = await runCase({
      ok: false, code: "retry_later", retryable: true,
      retryAfterStatus: "too_far", retryAfterSeconds: null
    });
    assert.equal(result.status, "dead_lettered");
    assert.equal(result.code, "provider_delay_exceeds_policy");
    assert.equal(settlements[0].errorCode, "provider_delay_exceeds_policy");
  });

  it("refuses malformed handler delay metadata instead of silently retrying early", async () => {
    const { result } = await runCase({
      ok: false, code: "retry_later", retryable: true,
      retryAfterSeconds: "120; injected"
    });
    assert.equal(result.status, "dead_lettered");
    assert.equal(result.code, "invalid_provider_retry_delay");
  });

  it("keeps a disabled consumer completely detached from the queue", async () => {
    const { result, claims, settlements } = await runCase({
      ok: false, code: "retry_later"
    }, { enabled: false });
    assert.equal(result.status, "disabled");
    assert.equal(claims, 0);
    assert.deepEqual(settlements, []);
  });

  it("never gives an expired message a second chance, even without provider metadata", () => {
    const policy = retryPlanForOutcome({ expiresAtMs: START - 1 }, 1, new Date(BASE));
    assert.equal(policy.status, "expired");
    assert.equal(policy.reason, "message_expired");
  });

  for (const [label, foreignRow] of [
    ["foreign tenant", { organization_id: "00000000-0000-4000-8000-000000000999" }],
    ["unexpected event kind", { kind: "agent.work.failed" }],
    ["unexpected producer", { producer: "foreign-worker" }]
  ]) {
    it("refuses a claimed row from an " + label + " without dispatching side effects", async () => {
      let called = 0;
      let settled = 0;
      const worker = createEventConsumerWorker({
        repository: {
          claimNextFiltered: async () => ({ ok: true, row: {
            id: "outbox-foreign", event_id: "event-foreign",
            organization_id: ORG, idempotency_key: "evt_foreign",
            correlation_id: "corr-foreign",
            kind: CANARY_KIND,
            producer: "sonara-event-consumer-canary:retry-bridge",
            attempt_count: 1, created_at: BASE,
            ...foreignRow
          }}),
          settle: async () => { settled += 1; return { ok: true, row: {} }; }
        },
        handlers: {
          [CANARY_KIND]: async () => { called += 1; return { ok: true }; }
        },
        emitEvent: () => {},
        claimIdFactory: () => "claim-foreign",
        now: () => new Date(BASE)
      });
      const result = await worker.runOnce({
        enabled: true,
        organizationId: ORG,
        kinds: [CANARY_KIND],
        producers: ["sonara-event-consumer-canary:retry-bridge"]
      });
      assert.equal(result.status, "claim_scope_mismatch");
      assert.equal(result.code, "claim_scope_mismatch");
      assert.equal(called, 0);
      assert.equal(settled, 0);
    });
  }

  it("cannot extend retryability beyond the existing five-attempt safety cap", async () => {
    const { result } = await runCase({
      ok: false, code: "retry_later", retryable: true,
      retryAfterSeconds: 120
    }, { attemptCount: 5 });
    assert.equal(result.status, "dead_lettered");
  });
});
