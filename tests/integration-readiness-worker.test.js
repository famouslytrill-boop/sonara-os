"use strict";

const assert = require("node:assert/strict");
const {
  INTEGRATION_JOB_TYPE,
  PLATFORM_JOB_TYPE,
  platformJobTypeForOrganization,
  readIntegrationReadinessActivationConfig,
  createIntegrationReadinessService,
  createIntegrationReadinessWorker,
  buildReadinessReceipt
} = require("../lib/sonara-integration-readiness.cjs");

const ORG = "00000000-0000-4000-8000-000000000111";
const USER = "00000000-0000-4000-8000-000000000222";
const REQUEST = "00000000-0000-4000-8000-000000000333";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; }
  };
}

describe("integration readiness worker", () => {
  it("is disabled by default and requires an explicit canary organization", () => {
    assert.deepEqual(
      readIntegrationReadinessActivationConfig(() => undefined),
      { ok: true, enabled: false, allowed: false, organizationId: null, reason: "flag_disabled" }
    );
    const bad = readIntegrationReadinessActivationConfig((name) =>
      name === "SONARA_INTEGRATION_READINESS_WORKER_ENABLED" ? "true" : "not-a-uuid"
    );
    assert.equal(bad.ok, false);
    assert.equal(bad.reason, "canary_org_required");

    const good = readIntegrationReadinessActivationConfig((name) => ({
      SONARA_INTEGRATION_READINESS_WORKER_ENABLED: "true",
      SONARA_INTEGRATION_READINESS_CANARY_ORG_ID: ORG
    })[name]);
    assert.equal(good.allowed, true);
    assert.equal(good.organizationId, ORG);
  });

  it("builds a readiness receipt from safe status fields only", () => {
    const receipt = buildReadinessReceipt({
      providerKey: "google_search_console",
      provider: {
        status: "active",
        connection_mode: "oauth",
        secret: "must-not-pass"
      },
      connections: [
        {
          provider_key: "google_search_console",
          connection_status: "setup_required",
          connection_mode: "oauth",
          last_checked_at: "2026-10-09T19:00:00.000Z",
          credential_reference: "secret-ref",
          settings: { token: "secret" }
        },
        {
          provider_key: "google_search_console",
          connection_status: "connected",
          connection_mode: "oauth",
          last_checked_at: "2026-10-09T20:00:00.000Z",
          credential_reference: "another-secret-ref"
        }
      ],
      checkedAt: "2026-10-09T20:01:00.000Z"
    });
    assert.equal(receipt.readiness, "connected");
    assert.equal(receipt.connection_count, 2);
    assert.equal(receipt.connection_status, "connected");
    assert.equal(receipt.last_checked_at, "2026-10-09T20:00:00.000Z");
    const serialized = JSON.stringify(receipt);
    assert.doesNotMatch(serialized, /secret|credential_reference|settings|token/i);
  });

  it("lists only non-secret provider and connection fields", async () => {
    const urls = [];
    const service = createIntegrationReadinessService({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example", serviceRoleKey: "service" }),
      platformJobs: { enqueue: async () => ({ ok: true, row: { id: "p" } }) },
      fetchImpl: async (url) => {
        urls.push(url);
        if (url.includes("/integration_providers?")) return response(200, []);
        if (url.includes("/business_integration_connections?")) return response(200, []);
        if (url.includes("/integration_jobs?")) return response(200, []);
        throw new Error(`unexpected ${url}`);
      }
    });
    const result = await service.list({ organizationId: ORG });
    assert.equal(result.ok, true);
    const combined = urls.join("\n");
    assert.doesNotMatch(combined, /credential_reference|settings|auth_reference/i);
    assert.match(combined, /organization_id=eq\./);
  });

  it("creates one visible readiness job and one idempotent platform job", async () => {
    const calls = [];
    const platformCalls = [];
    const service = createIntegrationReadinessService({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example", serviceRoleKey: "service" }),
      platformJobs: {
        enqueue: async (input) => {
          platformCalls.push(input);
          return { ok: true, row: { id: "platform-1" } };
        }
      },
      fetchImpl: async (url, init) => {
        calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
        if (url.includes("/integration_providers?")) {
          return response(200, [{ provider_key: "google_search_console", name: "GSC", category: "analytics", connection_mode: "oauth", status: "active" }]);
        }
        if (url.includes("/integration_jobs?on_conflict=id")) {
          return response(201, [{ id: REQUEST, status: "queued", provider_key: "google_search_console", job_type: INTEGRATION_JOB_TYPE }]);
        }
        throw new Error(`unexpected ${url}`);
      }
    });
    const result = await service.enqueueProbe({
      organizationId: ORG,
      userId: USER,
      providerKey: "google_search_console",
      requestId: REQUEST
    });
    assert.equal(result.ok, true);
    assert.equal(result.integrationJobId, REQUEST);
    assert.equal(platformCalls.length, 1);
    assert.equal(platformCalls[0].jobType, platformJobTypeForOrganization(ORG));
    assert.equal(platformCalls[0].idempotencyKey, `integration-readiness:${ORG}:${REQUEST}`);
    const visible = calls.find((call) => call.url.includes("/integration_jobs?on_conflict=id"));
    assert.equal(visible.body.status, "queued");
    assert.equal(visible.body.organization_id, ORG);
  });

  it("falls back to manual_required when durable enqueue is unavailable", async () => {
    let patched = null;
    const service = createIntegrationReadinessService({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example", serviceRoleKey: "service" }),
      platformJobs: { enqueue: async () => ({ ok: false, code: "enqueue_failed" }) },
      fetchImpl: async (url, init) => {
        if (url.includes("/integration_providers?")) return response(200, [{ provider_key: "google_search_console" }]);
        if (url.includes("/integration_jobs?on_conflict=id")) return response(201, [{ id: REQUEST, status: "queued" }]);
        if (url.includes("/integration_jobs?select=id,status")) {
          patched = JSON.parse(init.body);
          return response(200, [{ id: REQUEST, status: "manual_required" }]);
        }
        throw new Error(`unexpected ${url}`);
      }
    });
    const result = await service.enqueueProbe({
      organizationId: ORG,
      userId: USER,
      providerKey: "google_search_console",
      requestId: REQUEST
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "worker_queue_unavailable");
    assert.equal(patched.status, "manual_required");
    assert.equal(patched.error_message, "worker_queue_unavailable");
  });

  it("executes a zero-side-effect readiness probe without reading credentials/settings", async () => {
    const urls = [];
    const patches = [];
    const service = createIntegrationReadinessService({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example", serviceRoleKey: "service" }),
      platformJobs: { enqueue: async () => ({ ok: true, row: {} }) },
      now: () => new Date("2026-10-09T20:00:00.000Z"),
      fetchImpl: async (url, init) => {
        urls.push(url);
        const method = init.method || "GET";
        if (url.includes("/integration_jobs?select=id,organization_id") && method === "GET") {
          return response(200, [{ id: REQUEST, organization_id: ORG, provider_key: "google_search_console", job_type: INTEGRATION_JOB_TYPE, status: "queued", output_data: {} }]);
        }
        if (url.includes("/integration_jobs?select=id,status") && method === "PATCH") {
          patches.push(JSON.parse(init.body));
          return response(200, [{ id: REQUEST, status: JSON.parse(init.body).status }]);
        }
        if (url.includes("/integration_providers?")) {
          return response(200, [{ provider_key: "google_search_console", status: "active", connection_mode: "oauth" }]);
        }
        if (url.includes("/business_integration_connections?")) {
          return response(200, []);
        }
        throw new Error(`unexpected ${method} ${url}`);
      }
    });
    const result = await service.executeProbe({
      organizationId: ORG,
      integrationJobId: REQUEST,
      providerKey: "google_search_console"
    });
    assert.equal(result.ok, true);
    assert.equal(result.receipt.readiness, "setup_required");
    assert.deepEqual(patches.map((patch) => patch.status), ["running", "completed"]);
    const combined = urls.join("\n");
    assert.doesNotMatch(combined, /credential_reference|settings|auth_reference/i);
  });

  it("does not claim anything while the worker is disabled", async () => {
    let claims = 0;
    const worker = createIntegrationReadinessWorker({
      service: { executeProbe: async () => ({ ok: true, receipt: {} }) },
      platformJobs: {
        recoverStale: async () => ({ ok: true, recovered: 0 }),
        claim: async () => { claims += 1; return { ok: true, row: null }; },
        settle: async () => ({ ok: true })
      }
    });
    const result = await worker.runOnce({ enabled: false });
    assert.equal(result.status, "disabled");
    assert.equal(claims, 0);
  });

  it("asks the durable queue only for the canary organization's job type", async () => {
    const claims = [];
    const recoveries = [];
    const worker = createIntegrationReadinessWorker({
      service: { executeProbe: async () => ({ ok: true, receipt: {} }) },
      platformJobs: {
        recoverStale: async (input) => { recoveries.push(input); return { ok: true, recovered: 0 }; },
        claim: async (input) => { claims.push(input); return { ok: true, row: null }; },
        settle: async () => ({ ok: true })
      },
      workerIdFactory: () => "instance-1"
    });
    const result = await worker.runOnce({ enabled: true, organizationId: ORG });
    assert.equal(result.status, "idle");
    assert.equal(recoveries[0].jobType, platformJobTypeForOrganization(ORG));
    assert.equal(claims[0].jobType, platformJobTypeForOrganization(ORG));
    assert.notEqual(claims[0].jobType, PLATFORM_JOB_TYPE);
  });

  it("refuses a claimed job whose tenant payload does not match the canary", async () => {
    const settlements = [];
    const worker = createIntegrationReadinessWorker({
      service: {
        executeProbe: async () => { throw new Error("must not execute"); },
        markFailed: async () => ({ ok: true })
      },
      platformJobs: {
        recoverStale: async () => ({ ok: true, recovered: 0 }),
        claim: async () => ({
          ok: true,
          row: {
            id: "platform-1",
            job_type: PLATFORM_JOB_TYPE,
            attempts: 1,
            max_attempts: 3,
            input: { organizationId: "00000000-0000-4000-8000-000000000999", integrationJobId: REQUEST, providerKey: "google_search_console" }
          }
        }),
        settle: async (input) => { settlements.push(input); return { ok: true, eventRecorded: true }; }
      },
      workerIdFactory: () => "instance-1"
    });
    const result = await worker.runOnce({ enabled: true, organizationId: ORG });
    assert.equal(result.ok, false);
    assert.equal(result.code, "worker_input_invalid");
    assert.equal(settlements[0].outcome, "failed");
  });

  it("does not release a stale durable lease until the visible job is reconciled", async () => {
    let beforeRecover = null;
    const worker = createIntegrationReadinessWorker({
      service: {
        executeProbe: async () => ({ ok: true, receipt: {} }),
        markFailed: async () => ({ ok: false, code: "visible_update_failed" }),
        markRetry: async () => ({ ok: false, code: "visible_update_failed" })
      },
      platformJobs: {
        recoverStale: async (input) => {
          beforeRecover = input.beforeRecover;
          const result = await input.beforeRecover({
            job: {
              input: { organizationId: ORG, integrationJobId: REQUEST, providerKey: "google_search_console" }
            },
            exhausted: false
          });
          return { ok: true, recovered: result.ok ? 1 : 0, skipped: result.ok ? 0 : 1 };
        },
        claim: async () => ({ ok: true, row: null }),
        settle: async () => ({ ok: true })
      },
      workerIdFactory: () => "instance-1"
    });
    const result = await worker.runOnce({ enabled: true, organizationId: ORG });
    assert.equal(typeof beforeRecover, "function");
    assert.equal(result.status, "idle");
    assert.equal(result.recovered, 0);
  });

  it("keeps the durable claim processing when retry status cannot be written visibly", async () => {
    let settlements = 0;
    const worker = createIntegrationReadinessWorker({
      service: {
        executeProbe: async () => {
          const error = new Error("temporary");
          error.code = "provider_state_unreadable";
          error.retryable = true;
          throw error;
        },
        markRetry: async () => ({ ok: false, code: "integration_job_update_failed" }),
        markFailed: async () => ({ ok: true })
      },
      platformJobs: {
        recoverStale: async () => ({ ok: true, recovered: 0 }),
        claim: async () => ({
          ok: true,
          row: {
            id: "platform-1",
            job_type: platformJobTypeForOrganization(ORG),
            attempts: 1,
            max_attempts: 3,
            input: { organizationId: ORG, integrationJobId: REQUEST, providerKey: "google_search_console" }
          }
        }),
        settle: async () => { settlements += 1; return { ok: true }; }
      },
      workerIdFactory: () => "instance-1"
    });
    const result = await worker.runOnce({ enabled: true, organizationId: ORG });
    assert.equal(result.ok, false);
    assert.equal(result.status, "visible_status_update_failed");
    assert.equal(settlements, 0);
  });

  it("does not dead-letter the durable claim when terminal visible status cannot be written", async () => {
    let settlements = 0;
    const worker = createIntegrationReadinessWorker({
      service: {
        executeProbe: async () => {
          const error = new Error("terminal");
          error.code = "integration_job_missing";
          error.retryable = false;
          throw error;
        },
        markRetry: async () => ({ ok: true }),
        markFailed: async () => ({ ok: false, code: "integration_job_update_failed" })
      },
      platformJobs: {
        recoverStale: async () => ({ ok: true, recovered: 0 }),
        claim: async () => ({
          ok: true,
          row: {
            id: "platform-1",
            job_type: platformJobTypeForOrganization(ORG),
            attempts: 1,
            max_attempts: 3,
            input: { organizationId: ORG, integrationJobId: REQUEST, providerKey: "google_search_console" }
          }
        }),
        settle: async () => { settlements += 1; return { ok: true }; }
      },
      workerIdFactory: () => "instance-1"
    });
    const result = await worker.runOnce({ enabled: true, organizationId: ORG });
    assert.equal(result.ok, false);
    assert.equal(result.status, "visible_status_update_failed");
    assert.equal(settlements, 0);
  });

  it("settles a successful readiness probe and exposes no provider secret payload", async () => {
    const settlements = [];
    const worker = createIntegrationReadinessWorker({
      service: {
        executeProbe: async () => ({ ok: true, idempotent: false, receipt: { readiness: "setup_required" } }),
        markFailed: async () => ({ ok: true }),
        markRetry: async () => ({ ok: true })
      },
      platformJobs: {
        recoverStale: async () => ({ ok: true, recovered: 0 }),
        claim: async () => ({
          ok: true,
          row: {
            id: "platform-1",
            job_type: PLATFORM_JOB_TYPE,
            attempts: 1,
            max_attempts: 3,
            input: { organizationId: ORG, integrationJobId: REQUEST, providerKey: "google_search_console" }
          }
        }),
        settle: async (input) => { settlements.push(input); return { ok: true, eventRecorded: true }; }
      },
      workerIdFactory: () => "instance-1"
    });
    const result = await worker.runOnce({ enabled: true, organizationId: ORG });
    assert.equal(result.ok, true);
    assert.equal(result.status, "completed");
    assert.deepEqual(settlements[0].output, { integrationJobId: REQUEST, readiness: "setup_required" });
  });
});
