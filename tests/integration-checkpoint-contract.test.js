"use strict";

const assert = require("node:assert/strict");
const {
  INTEGRATION_CHECKPOINT_CONTRACT_VERSION,
  CURSOR_TYPES,
  INTEGRATION_SYNC_CURSOR_STORAGE_CONTRACT,
  checkpointIdentityKey,
  createIntegrationCheckpoint,
  advanceIntegrationCheckpoint,
  getIntegrationCheckpointArchitecture
} = require("../lib/sonara-integration-checkpoint-contract.cjs");

const BASE = Object.freeze({
  organizationId: "11111111-1111-4111-8111-111111111111",
  connectionId: "22222222-2222-4222-8222-222222222222",
  providerKey: "google_search_console",
  streamKey: "search_analytics",
  cursorType: "opaque",
  cursorValue: "provider-cursor-do-not-parse",
  watermarkAt: "2026-09-22T00:00:00Z",
  checkpointVersion: 3,
  backfillState: "running",
  schemaFingerprint: "search-analytics-v1",
  metadata: { pageSize: 250, source: "provider" },
  recordedAt: "2026-09-23T04:00:00Z"
});

describe("SONARA canonical integration checkpoints", () => {
  it("keeps the persistence target explicit without pretending the migration exists", () => {
    const architecture = getIntegrationCheckpointArchitecture();
    assert.equal(architecture.version, INTEGRATION_CHECKPOINT_CONTRACT_VERSION);
    assert.equal(architecture.runtimeAuthority, "none");
    assert.equal(architecture.storage.intendedTable, "integration_sync_cursors");
    assert.equal(architecture.storage.migrationRequired, true);
    assert.equal(INTEGRATION_SYNC_CURSOR_STORAGE_CONTRACT.directBrowserWrite, false);
    assert.ok(architecture.invariants.some((rule) => /opaque/i.test(rule)));
  });

  it("creates a tenant, connection, provider and stream scoped checkpoint", () => {
    const checkpoint = createIntegrationCheckpoint(BASE);
    assert.equal(checkpoint.organizationId, BASE.organizationId);
    assert.equal(checkpoint.connectionId, BASE.connectionId);
    assert.equal(checkpoint.providerKey, BASE.providerKey);
    assert.equal(checkpoint.streamKey, BASE.streamKey);
    assert.equal(checkpoint.cursorValue, "provider-cursor-do-not-parse");
    assert.equal(checkpoint.recordedAt, "2026-09-23T04:00:00.000Z");
    assert.ok(CURSOR_TYPES.includes(checkpoint.cursorType));
  });

  it("builds a deterministic identity key", () => {
    assert.equal(
      checkpointIdentityKey(BASE),
      "11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:google_search_console:search_analytics"
    );
  });

  it("advances exactly one checkpoint version and preserves opaque cursor semantics", () => {
    const next = advanceIntegrationCheckpoint(BASE, {
      expectedVersion: 3,
      cursorValue: "next-provider-cursor",
      watermarkAt: "2026-09-23T00:00:00Z",
      backfillState: "complete",
      recordedAt: "2026-09-23T04:05:00Z"
    });
    assert.equal(next.checkpointVersion, 4);
    assert.equal(next.cursorValue, "next-provider-cursor");
    assert.equal(next.backfillState, "complete");
    assert.equal(next.watermarkAt, "2026-09-23T00:00:00.000Z");
  });

  it("refuses stale writers", () => {
    assert.throws(
      () => advanceIntegrationCheckpoint(BASE, {
        expectedVersion: 2,
        recordedAt: "2026-09-23T04:05:00Z"
      }),
      /version conflict/
    );
  });

  it("refuses identity drift instead of silently moving a cursor between tenants or streams", () => {
    assert.throws(
      () => advanceIntegrationCheckpoint(BASE, {
        connectionId: "33333333-3333-4333-8333-333333333333",
        recordedAt: "2026-09-23T04:05:00Z"
      }),
      /identity is immutable/
    );
    assert.throws(
      () => advanceIntegrationCheckpoint(BASE, {
        streamKey: "different_stream",
        recordedAt: "2026-09-23T04:05:00Z"
      }),
      /identity is immutable/
    );
  });

  it("refuses watermarks that move backwards", () => {
    assert.throws(
      () => advanceIntegrationCheckpoint(BASE, {
        watermarkAt: "2026-09-21T23:59:59Z",
        recordedAt: "2026-09-23T04:05:00Z"
      }),
      /cannot move backwards/
    );
  });

  it("does not reopen a completed backfill in place", () => {
    const complete = createIntegrationCheckpoint({ ...BASE, backfillState: "complete" });
    assert.throws(
      () => advanceIntegrationCheckpoint(complete, {
        backfillState: "running",
        recordedAt: "2026-09-23T04:05:00Z"
      }),
      /cannot move from complete to running/
    );
  });

  it("rejects secret-looking metadata", () => {
    assert.throws(
      () => createIntegrationCheckpoint({
        ...BASE,
        metadata: { nested: { access_token: "do-not-store-this" } }
      }),
      /secret material/
    );
  });

  it("requires explicit recorded time so persistence evidence is reproducible", () => {
    assert.throws(
      () => createIntegrationCheckpoint({ ...BASE, recordedAt: undefined }),
      /recordedAt is required/
    );
  });
});
