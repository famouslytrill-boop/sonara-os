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
    const repository = createEventOutboxRepository({
      getSupabaseServerConfig: CONFIG,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return response({ status: 201, body: [{ id: "outbox_1", organization_id: "00000000-0000-0000-0000-000000000111" }] });
      }
    });

    const item = event();
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
