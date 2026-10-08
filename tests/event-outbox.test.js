"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createAgentEvent, EVENT_TOPICS } = require("../lib/sonara-event-driven-agent-contract.cjs");
const {
  OUTBOX_TABLE,
  CLAIM_FUNCTION,
  SETTLE_FUNCTION,
  createEventOutboxRepository,
  createRunEventPublisher
} = require("../lib/sonara-event-outbox.cjs");
const { createRunner } = require("../lib/sonara-agent-runner.cjs");

const CONFIG = () => ({ ok: true, url: "https://example.supabase.co", serviceRoleKey: "test-service-role-key" });

function response({ ok = true, status = 200, body = [] } = {}) {
  return { ok, status, json: async () => body };
}

function event(overrides = {}) {
  return createAgentEvent({
    organizationId: "00000000-0000-0000-0000-000000000111",
    actorId: "owner_1",
    producer: "test-worker",
    topic: EVENT_TOPICS.COMMANDS,
    kind: "agent.command.requested",
    action: "prepare_report",
    payload: { reportId: "report_1" },
    provenance: { sourceType: "test", sourceId: "report_1", userProvided: false, licensedOrOwned: true },
    ...overrides
  });
}

describe("durable event outbox", () => {
  it("writes a validated, tenant-scoped event with its idempotency key", async () => {
    const calls = [];
    const item = event();
    const repository = createEventOutboxRepository({
      getSupabaseServerConfig: CONFIG,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return response({ status: 201, body: [{ id: "outbox_1", organization_id: item.organizationId, idempotency_key: item.idempotencyKey }] });
      }
    });

    const result = await repository.enqueue(item);
    assert.equal(result.ok, true);
    assert.equal(result.created, true);
    assert.match(calls[0].url, new RegExp(`/rest/v1/${OUTBOX_TABLE}\\?on_conflict=organization_id,idempotency_key$`));
    const row = JSON.parse(calls[0].init.body);
    assert.equal(row.organization_id, item.organizationId);
    assert.equal(row.idempotency_key, item.idempotencyKey);
    assert.equal(row.event_id, item.eventId);
    assert.equal(row.payload.reportId, "report_1");
    assert.equal(row.payload.api_key, undefined);
  });

  it("proves an ignored duplicate is from the same organization before reporting success", async () => {
    const calls = [];
    const item = event();
    const repository = createEventOutboxRepository({
      getSupabaseServerConfig: CONFIG,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        if (calls.length === 1) return response({ status: 201, body: [] });
        return response({ body: [{ id: "outbox_existing", organization_id: item.organizationId, idempotency_key: item.idempotencyKey }] });
      }
    });

    const result = await repository.enqueue(item);
    assert.equal(result.ok, true);
    assert.equal(result.created, false);
    assert.match(calls[1].url, /select=id,organization_id,idempotency_key/);
    assert.match(calls[1].url, new RegExp(`organization_id=eq\\.${item.organizationId}`));
    assert.match(calls[1].url, new RegExp(`idempotency_key=eq\\.${item.idempotencyKey}`));
  });

  it("claims through the atomic worker RPC and says when no event is ready", async () => {
    const calls = [];
    const repository = createEventOutboxRepository({
      getSupabaseServerConfig: CONFIG,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return response({ body: [] });
      }
    });
    const result = await repository.claimNext({ organizationId: "00000000-0000-0000-0000-000000000111", consumer: "briefing-worker" });
    assert.equal(result.ok, true);
    assert.equal(result.row, null);
    assert.match(calls[0].url, new RegExp(`/rest/v1/rpc/${CLAIM_FUNCTION}$`));
    assert.equal(JSON.parse(calls[0].init.body).p_consumer, "briefing-worker");
  });

  it("does not call an empty settlement a delivery", async () => {
    const repository = createEventOutboxRepository({
      getSupabaseServerConfig: CONFIG,
      fetchImpl: async (url) => {
        assert.match(url, new RegExp(`/rest/v1/rpc/${SETTLE_FUNCTION}$`));
        return response({ body: [] });
      }
    });
    const result = await repository.settle({
      organizationId: "00000000-0000-0000-0000-000000000111",
      eventOutboxId: "00000000-0000-0000-0000-000000000222",
      consumer: "briefing-worker",
      outcome: "delivered"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "claim_lost");
  });

  it("publishes compact run evidence without copying a handler result or error text", async () => {
    const events = [];
    const publish = createRunEventPublisher({
      organizationId: "00000000-0000-0000-0000-000000000111",
      actorId: "owner_1",
      repository: { enqueue: async (item) => { events.push(item); return { ok: true, created: true }; } }
    });
    const runner = createRunner({
      handlers: { prepare_report: async () => ({ customerEmail: "customer@example.com", rawDraft: "do not copy this" }) },
      publishEvent: publish
    });
    const run = await runner.run({ action: { id: "action_1", action_type: "prepare_report" } });
    assert.equal(run.status, "completed");
    assert.equal(events.length, 1);
    assert.equal(events[0].kind, "agent.work.completed");
    assert.deepEqual(events[0].payload, { actionId: "action_1", status: "completed", classification: "self_serve" });
    assert.equal(Object.hasOwn(events[0].payload, "result"), false);
    assert.equal(Object.hasOwn(events[0].payload, "reason"), false);
  });

  it("does not rewrite a completed customer operation when outbox publication is unavailable", async () => {
    const runner = createRunner({
      handlers: { prepare_report: async () => ({ reportId: "report_1" }) },
      publishEvent: async () => { throw new Error("outbox unreachable"); }
    });
    const run = await runner.run({ action: { id: "action_1", action_type: "prepare_report" } });
    assert.equal(run.status, "completed");
    assert.deepEqual(run.result, { reportId: "report_1" });
  });

  it("keeps the database outbox and evaluation evidence closed to browser roles", () => {
    const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260917090000_durable_event_outbox_and_ai_evaluation_store.sql"), "utf8");
    for (const table of ["event_outbox", "event_delivery_attempts", "llm_observations", "agent_evaluation_runs"]) {
      assert.match(migration, new RegExp(`create table if not exists public\\.${table}`, "i"));
      assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
    assert.match(migration, /raw_prompt_stored boolean not null default false check \(raw_prompt_stored = false\)/i);
    assert.match(migration, /production_input boolean not null default false check \(production_input = false\)/i);
    assert.match(migration, /for update skip locked/i);
    assert.match(migration, /revoke all on function public\.claim_sonara_event_outbox/i);
  });
});

// Isolated namespace for additional PostgREST receipt-integrity regressions.
(() => {
const assert = require("node:assert/strict");
const { createAgentEvent, EVENT_TOPICS } = require("../lib/sonara-event-driven-agent-contract.cjs");
const { createEventOutboxRepository } = require("../lib/sonara-event-outbox.cjs");

const ORG = "00000000-0000-4000-8000-000000000111";
const OTHER = "00000000-0000-4000-8000-000000000222";
const ID = "00000000-0000-4000-8000-000000000333";
const CLAIM = "worker#test-1";
const KIND = "agent.command.requested";
const PRODUCER = "test-producer";

function event() {
  return createAgentEvent({
    organizationId: ORG,
    actorId: "test-actor",
    producer: PRODUCER,
    topic: EVENT_TOPICS.COMMANDS,
    kind: KIND,
    action: "prepare_report"
  });
}

function apiResponse(body, { error = false } = {}) {
  return { ok: true, status: 200, json: async () => {
    if (error) throw new Error("malformed provider JSON");
    return body;
  } };
}

function repo(fetchImpl) {
  return createEventOutboxRepository({
    getSupabaseServerConfig: () => ({ ok: true, url: "https://example.supabase.co", serviceRoleKey: "test-local-only" }),
    fetchImpl
  });
}

function claimed(overrides = {}) {
  return {
    id: ID, organization_id: ORG, state: "claimed", claimed_by: CLAIM,
    kind: KIND, producer: PRODUCER,
    ...overrides
  };
}

function settled(outcome = "delivered", overrides = {}) {
  return { ...claimed(), state: outcome === "retry" ? "ready" : outcome, ...overrides };
}

describe("event outbox PostgREST response integrity", () => {
  it("accepts only a newly inserted row matching the tenant and idempotency key", async () => {
    const item = event();
    const result = await repo(async () => apiResponse([{
      id: ID, organization_id: ORG, idempotency_key: item.idempotencyKey
    }])).enqueue(item);
    assert.equal(result.ok, true);
    assert.equal(result.created, true);
  });

  for (const [label, fields] of [
    ["wrong tenant", { organization_id: OTHER }],
    ["wrong idempotency key", { idempotency_key: "different" }],
    ["missing id", { id: "" }]
  ]) {
    it(`rejects a successful enqueue response with ${label}`, async () => {
      const item = event();
      const result = await repo(async () => apiResponse([{
        id: ID, organization_id: ORG, idempotency_key: item.idempotencyKey, ...fields
      }])).enqueue(item);
      assert.equal(result.ok, false);
      assert.equal(result.code, "enqueue_identity_mismatch");
      assert.equal(result.row, null);
    });
  }

  it("refuses malformed enqueue JSON rather than interpreting it as a duplicate", async () => {
    let requests = 0;
    const result = await repo(async () => {
      requests += 1;
      return apiResponse(null, { error: true });
    }).enqueue(event());
    assert.equal(result.ok, false);
    assert.equal(result.code, "enqueue_response_invalid");
    assert.equal(requests, 1);
  });

  it("verifies a genuine ignored duplicate with a second tenant-key scoped read", async () => {
    const item = event();
    let requests = 0;
    const result = await repo(async () => {
      requests += 1;
      return apiResponse(requests === 1 ? [] : [{
        id: ID, organization_id: item.organizationId, idempotency_key: item.idempotencyKey
      }]);
    }).enqueue(item);
    assert.equal(result.ok, true);
    assert.equal(result.created, false);
    assert.equal(requests, 2);
  });

  it("refuses a cross-tenant row returned by a scoped duplicate lookup", async () => {
    const item = event();
    let requests = 0;
    const result = await repo(async () => apiResponse(++requests === 1 ? [] : [{
      id: ID, organization_id: OTHER, idempotency_key: item.idempotencyKey
    }])).enqueue(item);
    assert.equal(result.ok, false);
    assert.equal(result.code, "dedupe_identity_mismatch");
  });

  it("refuses malformed or ambiguous duplicate lookup responses", async () => {
    const item = event();
    for (const body of [{ unexpected: true }, [claimed(), claimed()]]) {
      let requests = 0;
      const result = await repo(async () => apiResponse(++requests === 1 ? [] : body)).enqueue(item);
      assert.equal(result.ok, false);
      assert.equal(result.code, "dedupe_response_invalid");
    }
  });

  it("treats an actual empty claim array as idle", async () => {
    const result = await repo(async () => apiResponse([])).claimNext({ organizationId: ORG, consumer: CLAIM });
    assert.equal(result.ok, true);
    assert.equal(result.row, null);
  });

  it("does not treat malformed HTTP 200 claim responses as idle", async () => {
    for (const body of [null, { state: "claimed" }, [claimed(), claimed()]]) {
      const result = await repo(async () => apiResponse(body)).claimNext({ organizationId: ORG, consumer: CLAIM });
      assert.equal(result.ok, false);
      assert.equal(result.code, "claim_response_invalid");
    }
    const rejected = await repo(async () => apiResponse(null, { error: true }))
      .claimNextFiltered({ organizationId: ORG, consumer: CLAIM, kinds: [KIND], producers: [PRODUCER] });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, "claim_response_invalid");
  });

  it("accepts an actual matching claimed row", async () => {
    const result = await repo(async () => apiResponse([claimed()])).claimNextFiltered({
      organizationId: ORG, consumer: CLAIM, kinds: [KIND], producers: [PRODUCER]
    });
    assert.equal(result.ok, true);
    assert.equal(result.row.id, ID);
  });

  for (const [label, patch] of [
    ["wrong tenant", { organization_id: OTHER }],
    ["wrong kind", { kind: "media.job.requested" }],
    ["wrong producer", { producer: "unapproved" }],
    ["not claimed", { state: "ready" }],
    ["wrong claim owner", { claimed_by: "stale-worker-token" }],
    ["missing claim owner", { claimed_by: null }],
    ["missing id", { id: null }]
  ]) {
    it(`rejects a filtered claim with ${label}`, async () => {
      const result = await repo(async () => apiResponse([claimed(patch)])).claimNextFiltered({
        organizationId: ORG, consumer: CLAIM, kinds: [KIND], producers: [PRODUCER]
      });
      assert.equal(result.ok, false);
      assert.equal(result.code, "claim_identity_mismatch");
      assert.equal(result.row, null);
    });
  }

  it("requires the returned lease owner for the unfiltered claim RPC too", async () => {
    for (const claimedBy of ["other-worker-token", null, "", undefined]) {
      const result = await repo(async () => apiResponse([claimed({ claimed_by: claimedBy })]))
        .claimNext({ organizationId: ORG, consumer: CLAIM });
      assert.equal(result.ok, false);
      assert.equal(result.code, "claim_identity_mismatch");
      assert.equal(result.row, null);
    }
    const accepted = await repo(async () => apiResponse([claimed()]))
      .claimNext({ organizationId: ORG, consumer: CLAIM });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.row.claimed_by, CLAIM);
  });

  it("does not trust a different invocation's claim even within the same tenant", async () => {
    const responseOwner = "worker#first";
    const nextOwner = "worker#second";
    const result = await repo(async () => apiResponse([claimed({ claimed_by: responseOwner })]))
      .claimNextFiltered({
        organizationId: ORG, consumer: nextOwner, kinds: [KIND], producers: [PRODUCER]
      });
    assert.equal(result.ok, false);
    assert.equal(result.code, "claim_identity_mismatch");
    assert.equal(result.row, null);
  });

  it("rejects settlement of another tenant, outbox row or incorrect state", async () => {
    for (const patch of [
      { organization_id: OTHER }, { id: "other-id" }, { state: "ready" }
    ]) {
      const result = await repo(async () => apiResponse([settled("delivered", patch)])).settle({
        organizationId: ORG, eventOutboxId: ID, consumer: CLAIM, outcome: "delivered"
      });
      assert.equal(result.ok, false);
      assert.equal(result.code, "settle_identity_mismatch");
    }
  });

  it("accepts matching delivered and retry settlement receipts", async () => {
    for (const outcome of ["delivered", "retry", "dead_lettered"]) {
      const result = await repo(async () => apiResponse([settled(outcome)])).settle({
        organizationId: ORG, eventOutboxId: ID, consumer: CLAIM, outcome
      });
      assert.equal(result.ok, true);
      assert.equal(result.row.id, ID);
    }
  });

  it("preserves the claim-lost result for an actual empty settlement array", async () => {
    const result = await repo(async () => apiResponse([])).settle({
      organizationId: ORG, eventOutboxId: ID, consumer: CLAIM, outcome: "delivered"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "claim_lost");
  });

  it("reports malformed settlement receipts without pretending claim ownership", async () => {
    const result = await repo(async () => apiResponse(null, { error: true })).settle({
      organizationId: ORG, eventOutboxId: ID, consumer: CLAIM, outcome: "delivered"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "settle_response_invalid");
  });
});

})();
