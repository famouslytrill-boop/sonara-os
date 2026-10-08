// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

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
