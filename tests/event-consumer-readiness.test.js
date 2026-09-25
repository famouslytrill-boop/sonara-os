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
    const good = Array.from({ length: CANARY_ACTIVATION_GATE.minSamples }, () => ({
      status: "delivered",
      attemptCount: 1,
      queueAgeMs: 100,
      handlerDurationMs: 25
    }));
    const passed = evaluateCanaryActivation(good);
    assert.equal(passed.ok, true);
    assert.equal(passed.metrics.deliveryRatio, 1);
    assert.equal(passed.metrics.deadLetterRatio, 0);

    const withRetry = good.slice();
    withRetry[0] = { ...withRetry[0], status: "retry" };
    const failed = evaluateCanaryActivation(withRetry);
    assert.equal(failed.ok, false);
    assert.equal(failed.checks.retryRatio, false);
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
