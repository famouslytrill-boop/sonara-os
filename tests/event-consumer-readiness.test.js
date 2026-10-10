"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  CLAIM_FILTERED_FUNCTION,
  createEventOutboxRepository
} = require("../lib/sonara-event-outbox.cjs");
const {
  CANARY_ACTIVATION_GATE,
  CANARY_KIND,
  CANARY_PRODUCER_PREFIX,
  createEventConsumerWorker,
  computeBackoffMs,
  evaluateCanaryActivation,
  readEventConsumerActivationConfig
} = require("../lib/sonara-event-consumer.cjs");
const { evaluateEventConsumerCanaryGate } = require("../lib/sonara-event-consumer-gate.cjs");

const ORG = "00000000-0000-4000-8000-000000000111";

function response({ ok = true, status = 200, body = [] } = {}) {
  return { ok, status, json: async () => body };
}

function row(overrides = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000222",
    organization_id: ORG,
    event_id: "event-1",
    idempotency_key: "evt_deterministic",
    correlation_id: "corr-1",
    kind: CANARY_KIND,
    action: "consumer_canary",
    producer: `${CANARY_PRODUCER_PREFIX}:run-1`,
    payload: { canary: true },
    state: "claimed",
    attempt_count: 1,
    created_at: "2026-09-17T20:00:00.000Z",
    claimed_at: "2026-09-17T20:00:01.000Z",
    ...overrides
  };
}

function sequenceNow(values) {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]);
}

describe("event consumer activation readiness", () => {
  it("is disabled by default and refuses an enabled canary without an explicit tenant UUID", () => {
    const disabled = readEventConsumerActivationConfig(() => undefined);
    assert.deepEqual(disabled, { ok: true, enabled: false, organizationId: null, mode: "canary" });

    const missing = readEventConsumerActivationConfig((name) => name === "SONARA_EVENT_CONSUMER_ENABLED" ? "true" : "");
    assert.equal(missing.ok, false);
    assert.equal(missing.code, "canary_org_required");

    const enabled = readEventConsumerActivationConfig((name) => {
      if (name === "SONARA_EVENT_CONSUMER_ENABLED") return "true";
      if (name === "SONARA_EVENT_CONSUMER_CANARY_ORG_ID") return ORG;
      return "";
    });
    assert.equal(enabled.ok, true);
    assert.equal(enabled.enabled, true);
    assert.equal(enabled.organizationId, ORG);
  });

  it("routes activation through the canonical runtime capability gate", async () => {
    const disabled = await evaluateEventConsumerCanaryGate({ env: {} });
    assert.equal(disabled.ok, true);
    assert.equal(disabled.allowed, false);
    assert.equal(disabled.reason, "flag_disabled");

    const invalid = await evaluateEventConsumerCanaryGate({
      env: { SONARA_EVENT_CONSUMER_ENABLED: "true" }
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.allowed, false);
    assert.equal(invalid.reason, "canary_org_required");

    const allowed = await evaluateEventConsumerCanaryGate({
      env: {
        NODE_ENV: "test",
        SONARA_EVENT_CONSUMER_ENABLED: "true",
        SONARA_EVENT_CONSUMER_CANARY_ORG_ID: ORG
      }
    });
    assert.equal(allowed.ok, true);
    assert.equal(allowed.allowed, true);
    assert.equal(allowed.organizationId, ORG);
    assert.equal(allowed.reason, "enabled");
  });

  it("does not touch the queue while the feature flag is off", async () => {
    let claims = 0;
    const worker = createEventConsumerWorker({
      repository: {
        claimNextFiltered: async () => { claims += 1; return { ok: true, row: null }; },
        settle: async () => ({ ok: true })
      },
      emitEvent: () => undefined
    });

    const result = await worker.runOnce({
      enabled: false,
      organizationId: ORG,
      kinds: [CANARY_KIND],
      producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
    });

    assert.equal(result.status, "disabled");
    assert.equal(claims, 0);
  });

  it("claims through the filtered RPC with tenant, kind, producer, and a unique claim owner", async () => {
    const calls = [];
    const repository = createEventOutboxRepository({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://example.supabase.co", serviceRoleKey: "test-service-role" }),
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return response({ body: [row()] });
      }
    });

    const result = await repository.claimNextFiltered({
      organizationId: ORG,
      consumer: "consumer#instance-1",
      kinds: [CANARY_KIND],
      producers: [`${CANARY_PRODUCER_PREFIX}:run-1`],
      now: "2026-09-17T20:00:01.000Z"
    });

    assert.equal(result.ok, true);
    assert.match(calls[0].url, new RegExp(`/rest/v1/rpc/${CLAIM_FILTERED_FUNCTION}$`));
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.p_organization_id, ORG);
    assert.equal(body.p_consumer, "consumer#instance-1");
    assert.deepEqual(body.p_kinds, [CANARY_KIND]);
    assert.deepEqual(body.p_producers, [`${CANARY_PRODUCER_PREFIX}:run-1`]);
  });

  it("delivers once, passes the producer idempotency key to the handler, and settles with the same claim token", async () => {
    const claims = [];
    const settlements = [];
    const handled = [];
    const logs = [];
    const repository = {
      claimNextFiltered: async (input) => {
        claims.push(input);
        return { ok: true, row: row() };
      },
      settle: async (input) => {
        settlements.push(input);
        return { ok: true, row: { ...row(), state: input.outcome } };
      }
    };
    const worker = createEventConsumerWorker({
      repository,
      handlers: {
        [CANARY_KIND]: async (event) => {
          handled.push(event);
          return { ok: true };
        }
      },
      emitEvent: (event) => logs.push(event),
      claimIdFactory: () => "claim-one",
      now: sequenceNow([
        "2026-09-17T20:00:01.000Z",
        "2026-09-17T20:00:01.010Z",
        "2026-09-17T20:00:01.110Z"
      ])
    });

    const producer = `${CANARY_PRODUCER_PREFIX}:run-1`;
    const result = await worker.runOnce({
      enabled: true,
      organizationId: ORG,
      consumer: "canary",
      kinds: [CANARY_KIND],
      producers: [producer]
    });

    assert.equal(result.status, "delivered");
    assert.equal(handled.length, 1);
    assert.equal(handled[0].idempotencyKey, "evt_deterministic");
    assert.equal(claims[0].consumer, "canary#claim-one");
    assert.deepEqual(claims[0].producers, [producer]);
    assert.equal(settlements[0].consumer, claims[0].consumer);
    assert.equal(settlements[0].outcome, "delivered");
    assert.equal(logs[0].event, "event.consumer");
    assert.equal(logs[0].outcome, "ok");
  });

  it("contains both synchronous and async queue-claim exceptions without leaking provider secrets", async () => {
    for (const claimNextFiltered of [
      () => { throw new Error("https://host.invalid?key=secret_do_not_log"); },
      async () => { throw new Error("https://host.invalid?key=secret_do_not_log"); }
    ]) {
      const events = [];
      let settlements = 0;
      let handled = 0;
      const worker = createEventConsumerWorker({
        repository: {
          claimNextFiltered,
          settle: async () => { settlements += 1; return { ok: true, row: {} }; }
        },
        handlers: { [CANARY_KIND]: async () => { handled += 1; return { ok: true }; } },
        emitEvent: (entry) => events.push(entry)
      });
      const result = await worker.runOnce({
        enabled: true, organizationId: ORG,
        kinds: [CANARY_KIND],
        producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
      });
      assert.equal(result.ok, false);
      assert.equal(result.status, "claim_failed");
      assert.equal(result.code, "claim_request_failed");
      assert.equal(result.sample, null);
      assert.equal(handled, 0);
      assert.equal(settlements, 0);
      assert.equal(events[0]?.reason, "claim_request_failed");
      assert.equal(JSON.stringify({ result, events }).includes("secret_do_not_log"), false);
    }
  });

  it("contains thrown settlement exceptions after success and retryable failure without duplicate execution", async () => {
    for (const [output, expectedCode] of [
      [{ ok: true }, "settle_request_failed"],
      [{ ok: false, code: "temporary_outage", retryable: true }, "settle_request_failed"]
    ]) {
      for (const settle of [
        () => { throw new Error("https://host.invalid?token=secret_do_not_log"); },
        async () => { throw new Error("https://host.invalid?token=secret_do_not_log"); }
      ]) {
        const events = [];
        let handled = 0;
        const worker = createEventConsumerWorker({
          repository: { claimNextFiltered: async () => ({ ok: true, row: row() }), settle },
          handlers: { [CANARY_KIND]: async () => { handled += 1; return output; } },
          emitEvent: (entry) => events.push(entry),
          now: () => new Date("2026-09-17T20:00:02.000Z")
        });
        const result = await worker.runOnce({
          enabled: true, organizationId: ORG,
          kinds: [CANARY_KIND],
          producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
        });
        assert.equal(result.ok, false);
        assert.equal(result.status, "settlement_failed");
        assert.equal(result.code, expectedCode);
        assert.equal(result.sample.status, "settlement_failed");
        assert.equal(result.sample.eventOutboxId, row().id);
        assert.equal(handled, 1);
        assert.equal(events[0]?.reason, expectedCode);
        assert.equal(JSON.stringify({ result, events }).includes("secret_do_not_log"), false);
      }
    }
  });

  it("never settles ambiguous handler responses as delivered", async () => {
    for (const returned of [undefined, null, false, 1, "ok", [], {}, { ok: 1 }, { ok: "true" }]) {
      const settlements = [];
      const logs = [];
      const worker = createEventConsumerWorker({
        repository: {
          claimNextFiltered: async () => ({ ok: true, row: row() }),
          settle: async (input) => {
            settlements.push(input);
            return { ok: true, row: { ...row(), state: input.outcome } };
          }
        },
        handlers: { [CANARY_KIND]: async () => returned },
        emitEvent: (event) => logs.push(event),
        now: () => new Date("2026-09-17T20:00:02.000Z")
      });

      const result = await worker.runOnce({
        enabled: true, organizationId: ORG, consumer: "canary",
        kinds: [CANARY_KIND], producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
      });
      assert.equal(result.status, "dead_lettered", String(returned));
      assert.equal(result.ok, false);
      assert.equal(result.code, "handler_result_invalid");
      assert.equal(settlements.length, 1);
      assert.equal(settlements[0].outcome, "dead_lettered");
      assert.equal(settlements[0].errorCode, "handler_result_invalid");
      assert.equal(settlements[0].nextAvailableAt, null);
      assert.equal(logs[0]?.reason, "handler_result_invalid");
    }
  });

  it("preserves explicit handler success and retryable rejection contracts", async () => {
    for (const output of [{ ok: true }, { ok: false, code: "upstream_timeout", retryable: true }]) {
      const settlements = [];
      const worker = createEventConsumerWorker({
        repository: {
          claimNextFiltered: async () => ({ ok: true, row: row() }),
          settle: async (input) => {
            settlements.push(input);
            return { ok: true, row: { ...row(), state: input.outcome } };
          }
        },
        handlers: { [CANARY_KIND]: async () => output },
        emitEvent: () => undefined,
        now: () => new Date("2026-09-17T20:00:02.000Z")
      });
      const result = await worker.runOnce({
        enabled: true, organizationId: ORG, consumer: "canary",
        kinds: [CANARY_KIND], producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
      });
      assert.equal(result.status, output.ok ? "delivered" : "retry");
      assert.equal(settlements[0].outcome, output.ok ? "delivered" : "retry");
    }
  });

  it("uses a different claim owner for concurrent invocations of the same logical consumer", async () => {
    const owners = [];
    let claimIndex = 0;
    const claimIds = ["claim-a", "claim-b"];
    const rows = [row({ id: "00000000-0000-4000-8000-000000000223" }), row({ id: "00000000-0000-4000-8000-000000000224" })];
    const repository = {
      claimNextFiltered: async (input) => {
        owners.push(input.consumer);
        return { ok: true, row: rows[claimIndex++] };
      },
      settle: async () => ({ ok: true, row: {} })
    };
    const worker = createEventConsumerWorker({
      repository,
      handlers: { [CANARY_KIND]: async () => ({ ok: true }) },
      emitEvent: () => undefined,
      claimIdFactory: () => claimIds.shift(),
      now: () => new Date("2026-09-17T20:00:02.000Z")
    });

    await Promise.all([
      worker.runOnce({ enabled: true, organizationId: ORG, consumer: "same-consumer", kinds: [CANARY_KIND], producers: [`${CANARY_PRODUCER_PREFIX}:run-1`] }),
      worker.runOnce({ enabled: true, organizationId: ORG, consumer: "same-consumer", kinds: [CANARY_KIND], producers: [`${CANARY_PRODUCER_PREFIX}:run-1`] })
    ]);

    assert.equal(new Set(owners).size, 2);
    assert.deepEqual(owners.sort(), ["same-consumer#claim-a", "same-consumer#claim-b"]);
  });

  it("quarantines a timed-out handler rather than automatically replaying an uncertain side effect", async () => {
    const settlements = [];
    const events = [];
    let handlerFinished = false;
    const worker = createEventConsumerWorker({
      repository: {
        claimNextFiltered: async () => ({ ok: true, row: row() }),
        settle: async (input) => {
          settlements.push(input);
          return { ok: true, row: { ...row(), state: input.outcome } };
        }
      },
      handlers: {
        [CANARY_KIND]: async () => {
          // The underlying handler deliberately outlives the timeout.
          // A timed-out Promise.race does NOT cancel this operation.
          await new Promise((resolve) => setTimeout(resolve, 30));
          handlerFinished = true;
          return { ok: true };
        }
      },
      handlerTimeoutMs: 5,
      emitEvent: (event) => events.push(event),
      now: () => new Date("2026-09-17T20:00:02.000Z")
    });

    const result = await worker.runOnce({
      enabled: true, organizationId: ORG, consumer: "canary",
      kinds: [CANARY_KIND], producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
    });
    assert.equal(handlerFinished, false);
    assert.equal(result.ok, false);
    assert.equal(result.status, "dead_lettered");
    assert.equal(result.code, "handler_timeout");
    assert.equal(result.nextAvailableAt, null);
    assert.equal(settlements.length, 1);
    assert.equal(settlements[0].outcome, "dead_lettered");
    assert.equal(settlements[0].errorCode, "handler_timeout");
    assert.equal(settlements[0].nextAvailableAt, null);
    assert.equal(events[0]?.reason, "handler_timeout");

    // Demonstrate the important limitation: quarantine prevents an automatic
    // retry; it cannot undo an in-flight provider or handler side effect.
    await new Promise((resolve) => setTimeout(resolve, 45));
    assert.equal(handlerFinished, true);
  });

  it("refuses handler timeouts that would overlap the five-minute claim lease", () => {
    const repository = {
      claimNextFiltered: async () => ({ ok: true, row: null }),
      settle: async () => ({ ok: true, row: {} })
    };
    const options = { repository, emitEvent: () => undefined };
    assert.doesNotThrow(() => createEventConsumerWorker({ ...options, handlerTimeoutMs: 30_000 }));
    for (const handlerTimeoutMs of [0, -1, "30000", Number.NaN, Infinity, 290_000, 300_000]) {
      assert.throws(
        () => createEventConsumerWorker({ ...options, handlerTimeoutMs }),
        /claim lease safety budget/,
        `Unexpected timeout accepted: ${String(handlerTimeoutMs)}`
      );
    }
  });

  it("does not replay unclassified errors or result failures as though retry-safe", async () => {
    const failures = [
      async () => ({ ok: false, code: "unclassified_provider_response" }),
      async () => { throw Object.assign(new Error("unknown provider status"), { code: "unclassified_failure" }); }
    ];
    for (const run of failures) {
      const settlements = [];
      const worker = createEventConsumerWorker({
        repository: {
          claimNextFiltered: async () => ({ ok: true, row: row() }),
          settle: async (input) => {
            settlements.push(input);
            return { ok: true, row: { ...row(), state: input.outcome } };
          }
        },
        handlers: { [CANARY_KIND]: run },
        emitEvent: () => undefined,
        now: () => new Date("2026-09-17T20:00:02.000Z")
      });
      const result = await worker.runOnce({
        enabled: true, organizationId: ORG,
        kinds: [CANARY_KIND], producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
      });
      assert.equal(result.ok, false);
      assert.equal(result.status, "dead_lettered");
      assert.equal(result.nextAvailableAt, null);
      assert.equal(settlements[0].outcome, "dead_lettered");
    }
  });

  it("retries only explicitly classified transient errors from both handler return and throw paths", async () => {
    const retries = [
      async () => ({ ok: false, code: "temporary_provider_issue", retryable: true }),
      async () => {
        const error = new Error("temporary_provider_issue");
        error.code = "temporary_provider_issue";
        error.retryable = true;
        throw error;
      }
    ];
    for (const run of retries) {
      const settlements = [];
      const worker = createEventConsumerWorker({
        repository: {
          claimNextFiltered: async () => ({ ok: true, row: row() }),
          settle: async (input) => {
            settlements.push(input);
            return { ok: true, row: { ...row(), state: input.outcome } };
          }
        },
        handlers: { [CANARY_KIND]: run },
        emitEvent: () => undefined,
        now: () => new Date("2026-09-17T20:00:02.000Z")
      });
      const result = await worker.runOnce({
        enabled: true, organizationId: ORG,
        kinds: [CANARY_KIND], producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
      });
      assert.equal(result.status, "retry");
      assert.equal(settlements[0].outcome, "retry");
      assert.equal(settlements[0].errorCode, "temporary_provider_issue");
      assert.ok(result.nextAvailableAt);
    }
  });

  it("backs off exponentially and retries before the delivery-attempt ceiling", async () => {
    const settlements = [];
    const worker = createEventConsumerWorker({
      repository: {
        claimNextFiltered: async () => ({ ok: true, row: row({ attempt_count: 2 }) }),
        settle: async (input) => {
          settlements.push(input);
          return { ok: true, row: {} };
        }
      },
      handlers: {
        [CANARY_KIND]: async () => ({ ok: false, code: "temporary_provider_failure", retryable: true })
      },
      emitEvent: () => undefined,
      claimIdFactory: () => "claim-retry",
      now: sequenceNow([
        "2026-09-17T20:00:02.000Z",
        "2026-09-17T20:00:02.000Z",
        "2026-09-17T20:00:02.250Z"
      ])
    });

    const result = await worker.runOnce({
      enabled: true,
      organizationId: ORG,
      consumer: "canary",
      kinds: [CANARY_KIND],
      producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
    });

    assert.equal(result.status, "retry");
    assert.equal(computeBackoffMs(2), 10_000);
    assert.equal(settlements[0].outcome, "retry");
    assert.equal(settlements[0].errorCode, "temporary_provider_failure");
    assert.equal(settlements[0].nextAvailableAt, "2026-09-17T20:00:12.250Z");
  });

  it("dead-letters retryable work when the fifth attempt fails", async () => {
    const settlements = [];
    const worker = createEventConsumerWorker({
      repository: {
        claimNextFiltered: async () => ({ ok: true, row: row({ attempt_count: 5 }) }),
        settle: async (input) => {
          settlements.push(input);
          return { ok: true, row: {} };
        }
      },
      handlers: {
        [CANARY_KIND]: async () => {
          const error = new Error("do not persist this message");
          error.code = "provider_unavailable";
          throw error;
        }
      },
      emitEvent: () => undefined,
      claimIdFactory: () => "claim-dead-letter",
      now: () => new Date("2026-09-17T20:00:03.000Z")
    });

    const result = await worker.runOnce({
      enabled: true,
      organizationId: ORG,
      consumer: "canary",
      kinds: [CANARY_KIND],
      producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
    });

    assert.equal(result.status, "dead_lettered");
    assert.equal(settlements[0].outcome, "dead_lettered");
    assert.equal(settlements[0].errorCode, "provider_unavailable");
    assert.equal(settlements[0].nextAvailableAt, null);
  });

  it("does not call a successful handler twice when settlement fails; the lease must expire before a new claim", async () => {
    let handled = 0;
    const worker = createEventConsumerWorker({
      repository: {
        claimNextFiltered: async () => ({ ok: true, row: row() }),
        settle: async () => ({ ok: false, code: "claim_lost" })
      },
      handlers: {
        [CANARY_KIND]: async () => {
          handled += 1;
          return { ok: true };
        }
      },
      emitEvent: () => undefined,
      claimIdFactory: () => "claim-lost",
      now: () => new Date("2026-09-17T20:00:04.000Z")
    });

    const result = await worker.runOnce({
      enabled: true,
      organizationId: ORG,
      consumer: "canary",
      kinds: [CANARY_KIND],
      producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
    });

    assert.equal(result.status, "settlement_failed");
    assert.equal(handled, 1);
  });

  it("makes the activation gate measurable instead of treating a green process exit as proof", () => {
    const good = Array.from({ length: CANARY_ACTIVATION_GATE.minSamples }, (_, index) => ({
      status: "delivered",
      eventOutboxId: `canary-row-${index + 1}`,
      attemptCount: 1,
      queueAgeMs: 100,
      handlerDurationMs: 25
    }));
    const expectedEventOutboxIds = good.map((item) => item.eventOutboxId);
    const passed = evaluateCanaryActivation(good, CANARY_ACTIVATION_GATE, { expectedEventOutboxIds });
    assert.equal(passed.ok, true);
    assert.equal(passed.metrics.deliveryRatio, 1);
    assert.equal(passed.metrics.deadLetterRatio, 0);
    assert.equal(passed.metrics.uniqueDelivered, expectedEventOutboxIds.length);

    const withRetry = good.slice();
    withRetry[0] = { ...withRetry[0], status: "retry" };
    const failed = evaluateCanaryActivation(withRetry, CANARY_ACTIVATION_GATE, { expectedEventOutboxIds });
    assert.equal(failed.ok, false);
    assert.equal(failed.checks.retryRatio, false);
  });

  it("refuses a green canary when the expected enqueue identities were not supplied", () => {
    const delivered = Array.from({ length: 20 }, (_, i) => ({
      status: "delivered", eventOutboxId: `row-${i}`, attemptCount: 1,
      queueAgeMs: 10, handlerDurationMs: 20
    }));
    const result = evaluateCanaryActivation(delivered);
    assert.equal(result.ok, false);
    assert.equal(result.checks.expectedDelivery, false);
  });

  it("rejects duplicated, missing or substituted delivery IDs despite 100% delivered statuses", () => {
    const delivered = Array.from({ length: 20 }, (_, i) => ({
      status: "delivered", eventOutboxId: `row-${i}`, attemptCount: 1,
      queueAgeMs: 10, handlerDurationMs: 20
    }));
    const expectedEventOutboxIds = delivered.map((item) => item.eventOutboxId);
    const duplicate = delivered.map((item, i) => i === 19 ? { ...item, eventOutboxId: "row-0" } : item);
    const missing = delivered.map((item, i) => i === 19 ? null : item);
    const substituted = delivered.map((item, i) => i === 19 ? { ...item, eventOutboxId: "unrelated-row" } : item);
    assert.equal(evaluateCanaryActivation(duplicate, CANARY_ACTIVATION_GATE, { expectedEventOutboxIds }).ok, false);
    assert.equal(evaluateCanaryActivation(missing, CANARY_ACTIVATION_GATE, { expectedEventOutboxIds }).ok, false);
    assert.equal(evaluateCanaryActivation(substituted, CANARY_ACTIVATION_GATE, { expectedEventOutboxIds }).ok, false);
    assert.equal(evaluateCanaryActivation(duplicate, CANARY_ACTIVATION_GATE, { expectedEventOutboxIds }).checks.sampleIntegrity, false);
  });

  it("rejects missing/invalid latency and repeat attempts instead of counting 0ms and false reliability", () => {
    const delivered = Array.from({ length: 20 }, (_, i) => ({
      status: "delivered", eventOutboxId: `row-${i}`, attemptCount: 1,
      queueAgeMs: 10, handlerDurationMs: 20
    }));
    const expectedEventOutboxIds = delivered.map((item) => item.eventOutboxId);
    for (const patch of [
      { handlerDurationMs: null },
      { handlerDurationMs: -1 },
      { handlerDurationMs: "0" },
      { queueAgeMs: null },
      { attemptCount: 2 }
    ]) {
      const corrupt = delivered.map((item, i) => i === 0 ? { ...item, ...patch } : item);
      const result = evaluateCanaryActivation(corrupt, CANARY_ACTIVATION_GATE, { expectedEventOutboxIds });
      assert.equal(result.ok, false, JSON.stringify(patch));
    }
    const allMissing = delivered.map((item) => ({ ...item, handlerDurationMs: null }));
    const missingResult = evaluateCanaryActivation(allMissing, CANARY_ACTIVATION_GATE, { expectedEventOutboxIds });
    assert.equal(missingResult.metrics.p95HandlerDurationMs, null);
  });

  it("refuses a mismatched claimed tenant, kind or producer before any handler or settle call", async () => {
    const mismatches = [
      { organization_id: "00000000-0000-4000-8000-000000000999" },
      { kind: "media.job.requested" },
      { producer: "unapproved-producer" }
    ];
    for (const wrong of mismatches) {
      let handled = 0;
      let settled = 0;
      const events = [];
      const worker = createEventConsumerWorker({
        repository: {
          claimNextFiltered: async () => ({ ok: true, row: row(wrong) }),
          settle: async () => { settled += 1; return { ok: true, row: {} }; }
        },
        handlers: { [CANARY_KIND]: async () => { handled += 1; return { ok: true }; } },
        emitEvent: (event) => events.push(event)
      });
      const result = await worker.runOnce({
        enabled: true, organizationId: ORG, kinds: [CANARY_KIND],
        producers: [`${CANARY_PRODUCER_PREFIX}:run-1`]
      });
      assert.equal(result.status, "claim_scope_mismatch");
      assert.equal(result.ok, false);
      assert.equal(result.sample, null);
      assert.equal(handled, 0);
      assert.equal(settled, 0);
      assert.equal(events[0]?.reason, "claim_scope_mismatch");
    }
  });

  it("requires the CLI canary to compare fresh enqueues to delivered identities", () => {
    const source = fs.readFileSync(path.join(__dirname, "../scripts/run-event-consumer-canary.mjs"), "utf8");
    assert.match(source, /result\.created !== true/);
    assert.match(source, /new Set\(expectedEventOutboxIds\)\.size !== SAMPLE_COUNT/);
    assert.match(source, /evaluateCanaryActivation\(results\.map\(\(result\) => result\?\.sample \?\? null\), CANARY_ACTIVATION_GATE, \{ expectedEventOutboxIds \}\)/);
  });

  it("adds an atomic filtered claim with stale-lease recovery and no browser-role execute grant", () => {
    const migration = fs.readFileSync(
      path.join(__dirname, "../supabase/migrations/20260917200000_event_consumer_activation_readiness.sql"),
      "utf8"
    );

    assert.match(migration, /claim_sonara_event_outbox_filtered/i);
    assert.match(migration, /organization_id = p_organization_id/i);
    assert.match(migration, /kind = any\(p_kinds\)/i);
    assert.match(migration, /producer = any\(p_producers\)/i);
    assert.match(migration, /for update skip locked/i);
    assert.match(migration, /claimed_at <= p_now - interval '5 minutes'/i);
    assert.match(migration, /revoke all on function public\.claim_sonara_event_outbox_filtered[\s\S]*from public, anon, authenticated/i);
    assert.match(migration, /grant execute on function public\.claim_sonara_event_outbox_filtered[\s\S]*to service_role/i);
  });
});
