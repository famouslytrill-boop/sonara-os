"use strict";

const assert = require("node:assert/strict");
const {
  createPlatformJobWorkerRepository,
  computeBackoffMs
} = require("../lib/sonara-platform-job-worker.cjs");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; }
  };
}

describe("platform job worker repository", () => {
  it("uses bounded exponential backoff", () => {
    assert.equal(computeBackoffMs(1), 5000);
    assert.equal(computeBackoffMs(2), 10000);
    assert.equal(computeBackoffMs(20), 300000);
  });

  it("enqueues through the existing idempotent platform-job RPC", async () => {
    const calls = [];
    const repo = createPlatformJobWorkerRepository({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example", serviceRoleKey: "service" }),
      fetchImpl: async (url, init) => {
        calls.push({ url, init, body: JSON.parse(init.body) });
        return response(200, [{ id: "job-1", job_type: "integration.provider_readiness_probe" }]);
      }
    });
    const result = await repo.enqueue({
      jobType: "integration.provider_readiness_probe",
      idempotencyKey: "integration-readiness:org:request",
      input: { integrationJobId: "visible" },
      maxAttempts: 3
    });
    assert.equal(result.ok, true);
    assert.match(calls[0].url, /\/rest\/v1\/rpc\/enqueue_platform_job$/);
    assert.equal(calls[0].body.p_max_attempts, 3);
    assert.equal(calls[0].body.p_job_type, "integration.provider_readiness_probe");
  });

  it("recovers only the exact stale lease and records recovery evidence", async () => {
    const calls = [];
    const clock = new Date("2026-10-09T20:00:00.000Z");
    const repo = createPlatformJobWorkerRepository({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example", serviceRoleKey: "service" }),
      now: () => clock,
      fetchImpl: async (url, init) => {
        calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
        if ((init.method || "GET") === "GET") {
          return response(200, [{
            id: "job-1",
            job_type: "integration.provider_readiness_probe",
            status: "processing",
            locked_at: "2026-10-09T19:50:00.000Z",
            locked_by: "worker#old",
            attempts: 1,
            max_attempts: 3
          }]);
        }
        if (url.includes("/platform_jobs?")) {
          assert.match(url, /status=eq\.processing/);
          assert.match(url, /locked_by=eq\.worker%23old/);
          assert.match(url, /locked_at=eq\.2026-10-09T19%3A50%3A00\.000Z/);
          return response(200, [{ id: "job-1", status: "retryable" }]);
        }
        if (url.endsWith("/platform_job_events")) {
          assert.equal(JSON.parse(init.body).event_type, "recovered");
          return response(201, {});
        }
        throw new Error(`unexpected ${url}`);
      }
    });
    const result = await repo.recoverStale({ jobType: "integration.provider_readiness_probe" });
    assert.deepEqual({ ok: result.ok, recovered: result.recovered, skipped: result.skipped }, { ok: true, recovered: 1, skipped: 0 });
  });

  it("leaves a stale lease untouched when the visible record cannot be reconciled first", async () => {
    let patches = 0;
    const repo = createPlatformJobWorkerRepository({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example", serviceRoleKey: "service" }),
      now: () => new Date("2026-10-09T20:00:00.000Z"),
      fetchImpl: async (url, init) => {
        if ((init.method || "GET") === "GET") {
          return response(200, [{
            id: "job-blocked",
            job_type: "integration.provider_readiness_probe:org",
            status: "processing",
            locked_at: "2026-10-09T19:50:00.000Z",
            locked_by: "worker#old",
            attempts: 1,
            max_attempts: 3,
            input: { integrationJobId: "visible" }
          }]);
        }
        patches += 1;
        return response(500, {});
      }
    });
    const result = await repo.recoverStale({
      jobType: "integration.provider_readiness_probe:org",
      beforeRecover: async () => ({ ok: false, code: "visible_update_failed" })
    });
    assert.equal(result.ok, true);
    assert.equal(result.recovered, 0);
    assert.equal(result.skipped, 1);
    assert.equal(patches, 0, "durable lease changed before visible reconciliation succeeded");
  });

  it("dead-letters a stale lease that already consumed its final attempt", async () => {
    let terminalPatch = null;
    let terminalEvent = null;
    const repo = createPlatformJobWorkerRepository({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example", serviceRoleKey: "service" }),
      now: () => new Date("2026-10-09T20:00:00.000Z"),
      fetchImpl: async (url, init) => {
        if ((init.method || "GET") === "GET") {
          return response(200, [{
            id: "job-final",
            job_type: "integration.provider_readiness_probe:org",
            status: "processing",
            locked_at: "2026-10-09T19:50:00.000Z",
            locked_by: "worker#old",
            attempts: 3,
            max_attempts: 3
          }]);
        }
        if (url.includes("/platform_jobs?")) {
          terminalPatch = JSON.parse(init.body);
          return response(200, [{ id: "job-final", status: "failed" }]);
        }
        if (url.endsWith("/platform_job_events")) {
          terminalEvent = JSON.parse(init.body);
          return response(201, {});
        }
        throw new Error(`unexpected ${url}`);
      }
    });
    const result = await repo.recoverStale({ jobType: "integration.provider_readiness_probe:org" });
    assert.equal(result.ok, true);
    assert.equal(result.recovered, 1);
    assert.equal(terminalPatch.status, "failed");
    assert.equal(terminalPatch.dead_lettered_at, "2026-10-09T20:00:00.000Z");
    assert.equal(terminalPatch.last_error, "lease_expired");
    assert.equal(terminalEvent.event_type, "dead_lettered");
  });

  it("refuses a stale worker settlement when the fenced row no longer matches", async () => {
    const repo = createPlatformJobWorkerRepository({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example", serviceRoleKey: "service" }),
      fetchImpl: async (url) => {
        assert.match(url, /locked_by=eq\.worker%23old/);
        return response(200, []);
      }
    });
    const result = await repo.settle({
      job: { id: "job-1", job_type: "integration.provider_readiness_probe", attempts: 1 },
      workerId: "worker#old",
      outcome: "completed",
      output: { readiness: "setup_required" }
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "claim_lost");
  });

  it("clears the lease and records a terminal event after successful settlement", async () => {
    const calls = [];
    const repo = createPlatformJobWorkerRepository({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example", serviceRoleKey: "service" }),
      now: () => new Date("2026-10-09T20:00:00.000Z"),
      fetchImpl: async (url, init) => {
        calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
        if (url.includes("/platform_jobs?")) {
          assert.equal(calls.at(-1).body.status, "completed");
          assert.equal(calls.at(-1).body.locked_by, null);
          assert.equal(calls.at(-1).body.locked_at, null);
          return response(200, [{ id: "job-1", status: "completed" }]);
        }
        if (url.endsWith("/platform_job_events")) {
          assert.equal(calls.at(-1).body.event_type, "succeeded");
          return response(201, {});
        }
        throw new Error(`unexpected ${url}`);
      }
    });
    const result = await repo.settle({
      job: { id: "job-1", job_type: "integration.provider_readiness_probe", attempts: 1 },
      workerId: "worker#1",
      outcome: "completed",
      output: { integrationJobId: "visible", readiness: "setup_required" }
    });
    assert.equal(result.ok, true);
    assert.equal(result.eventRecorded, true);
  });
});
