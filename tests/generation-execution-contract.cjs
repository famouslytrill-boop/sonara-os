"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  RESEARCHED_EXECUTION_ALTERNATIVES,
  getGenerationExecutionArchitecture,
  selectExecutionAlternatives,
  buildGenerationJobContract
} = require("../lib/sonara-generation-execution-contract.cjs");
const {
  validateGenerationAdapterManifest,
  validateGenerationAdapter,
  buildGenerationAdapterArchitecture
} = require("../lib/sonara-generation-adapter-contract.cjs");
const {
  InMemoryGenerationJobRepository,
  GenerationJobRepositoryError
} = require("../lib/sonara-generation-job-repository.cjs");
const {
  IN_MEMORY_GENERATION_ADAPTER_MANIFEST,
  InMemoryGenerationAdapter
} = require("../lib/sonara-in-memory-generation-adapter.cjs");
const {
  GENERATION_PERSISTENCE_MIGRATION,
  GENERATION_PERSISTENCE_TABLES,
  GenerationPersistenceContractError,
  buildGenerationJobRow,
  buildGenerationArtifactRow,
  buildGenerationCallbackEventRow,
  buildGenerationCostEventRow,
  buildGenerationAuditEventRow,
  buildGenerationJobTransitionPatch,
  getGenerationPersistenceArchitecture
} = require("../lib/sonara-generation-persistence-contract.cjs");

function options(overrides = {}) {
  return {
    pathwayOptions: {
      providerCatalog: [
        {
          key: "open_source_media_worker",
          label: "SONARA Open Media Worker",
          adapterMode: "canonical_worker_http",
          integrationStatus: "adapter_available",
          capabilities: ["text_to_video", "image_generation", "text_to_music"],
          readiness: { configured: true, status: "configured" }
        }
      ],
      hostedTextState: {
        local_rules: { enabled: true, status: "ready" },
        openai: { enabled: false, status: "disabled" },
        anthropic: { enabled: false, status: "disabled" }
      }
    },
    configuredAlternativeKeys: [],
    approvedAlternativeKeys: [],
    ...overrides
  };
}

describe("generation execution contracts", () => {
  it("catalogs distinct browser, local, private-worker, serverless, marketplace, managed-GPU and routing lanes without enabling them", () => {
    const architecture = getGenerationExecutionArchitecture();
    const keys = new Set(architecture.alternatives.map((item) => item.key));
    for (const key of [
      "browser_webgpu_inference",
      "local_openai_compatible_runtime",
      "private_diffusion_generation_server",
      "serverless_open_model_catalog",
      "async_model_marketplace",
      "managed_gpu_job_queue",
      "dedicated_gpu_endpoint",
      "governed_provider_router"
    ]) {
      assert.equal(keys.has(key), true, `${key} missing from execution architecture`);
    }
    assert.equal(architecture.alternatives.every((item) => item.enabledByCatalog === false), true);
    assert.equal(architecture.alternatives.every((item) => item.canExecuteFromPlanner === false), true);
    assert.equal(RESEARCHED_EXECUTION_ALTERNATIVES.every((item) => item.executionAuthority === "none_from_research"), true);
  });

  it("keeps a local-only request entirely off external compute", () => {
    const result = selectExecutionAlternatives(
      {
        modality: "text",
        operation: "generate",
        localOnly: true,
        rightsApproved: true,
        workerBoundaryApproved: true,
        allowResearchCandidates: true
      },
      options({
        configuredAlternativeKeys: ["local_openai_compatible_runtime"],
        approvedAlternativeKeys: ["local_openai_compatible_runtime"]
      })
    );
    assert.equal(result.candidates.length > 0, true);
    assert.equal(result.candidates.every((item) => item.externalDataTransfer === false), true);
    assert.equal(result.candidates.some((item) => item.key === "local_openai_compatible_runtime"), true);
  });

  it("can force browser-only processing without silently escalating to a server or provider", () => {
    const result = selectExecutionAlternatives(
      {
        modality: "text",
        operation: "analyze",
        browserOnly: true,
        rightsApproved: true,
        allowResearchCandidates: true
      },
      options({
        configuredAlternativeKeys: ["browser_webgpu_inference"],
        approvedAlternativeKeys: ["browser_webgpu_inference"]
      })
    );
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].key, "browser_webgpu_inference");
    assert.equal(result.candidates[0].externalDataTransfer, false);
  });

  it("requires async-capable execution when the request explicitly requires a durable async job", () => {
    const result = selectExecutionAlternatives(
      {
        modality: "video",
        operation: "generate",
        asyncRequired: true,
        rightsApproved: true,
        externalSpendApproved: true,
        workerBoundaryApproved: true,
        allowResearchCandidates: true
      },
      options()
    );
    assert.equal(result.candidates.length > 0, true);
    assert.equal(result.candidates.every((item) => item.asyncCapable === true), true);
  });

  it("honors a zero external-spend ceiling", () => {
    const result = selectExecutionAlternatives(
      {
        modality: "image",
        operation: "generate",
        maxExternalSpend: 0,
        rightsApproved: true,
        workerBoundaryApproved: true,
        allowResearchCandidates: true
      },
      options()
    );
    assert.equal(result.candidates.length > 0, true);
    assert.equal(result.candidates.every((item) => item.externalSpend === false), true);
  });

  it("keeps automatic fallback disabled unless a multi-candidate allowlist is explicitly approved", () => {
    const intent = {
      modality: "video",
      operation: "generate",
      asyncRequired: true,
      rightsApproved: true,
      externalSpendApproved: true,
      allowResearchCandidates: true
    };
    const disabled = selectExecutionAlternatives(intent, options({
      configuredAlternativeKeys: ["serverless_open_model_catalog", "async_model_marketplace"],
      approvedAlternativeKeys: ["serverless_open_model_catalog", "async_model_marketplace"]
    }));
    assert.equal(disabled.fallbackPolicy.enabled, false);
    assert.equal(disabled.fallbackPolicy.canUseUnlistedProvider, false);

    const enabled = selectExecutionAlternatives(
      { ...intent, allowAutomaticFallback: true, maxFallbackAttempts: 2 },
      options({
        configuredAlternativeKeys: ["serverless_open_model_catalog", "async_model_marketplace"],
        approvedAlternativeKeys: ["serverless_open_model_catalog", "async_model_marketplace"]
      })
    );
    assert.equal(enabled.fallbackPolicy.enabled, true);
    assert.equal(enabled.fallbackPolicy.mode, "explicit_allowlist_only");
    assert.deepEqual(new Set(enabled.fallbackPolicy.chain), new Set(["serverless_open_model_catalog", "async_model_marketplace"]));
    assert.equal(enabled.fallbackPolicy.canUseUnlistedProvider, false);
  });

  it("returns an async job contract that requires idempotency and durable output persistence but grants no publish authority", () => {
    const contract = buildGenerationJobContract(
      {
        modality: "video",
        operation: "generate",
        rightsApproved: true,
        externalSpendApproved: true,
        allowResearchCandidates: true
      },
      "async_model_marketplace",
      options({
        configuredAlternativeKeys: ["async_model_marketplace"],
        approvedAlternativeKeys: ["async_model_marketplace"]
      })
    );
    assert.equal(contract.ok, true);
    assert.equal(contract.requiredIdentifiers.includes("idempotency_key"), true);
    assert.equal(contract.artifactContract.persistBeforeDownstreamUse, true);
    assert.equal(contract.artifactContract.providerOutputIsDurableByDefault, false);
    assert.equal(contract.authority.publishArtifact, false);
    assert.equal(contract.authority.chargeCustomer, false);
    assert.equal(contract.canExecuteFromContract, false);
  });

  it("requires worker-boundary approval before a local/private model runtime is execution-ready", () => {
    const missing = selectExecutionAlternatives(
      {
        modality: "text",
        operation: "generate",
        rightsApproved: true,
        allowResearchCandidates: true
      },
      options({
        configuredAlternativeKeys: ["local_openai_compatible_runtime"],
        approvedAlternativeKeys: ["local_openai_compatible_runtime"]
      })
    );
    const local = missing.candidates.find((item) => item.key === "local_openai_compatible_runtime");
    assert.equal(local.ready, false);
    assert.equal(local.setupReasons.includes("worker_boundary_approval_required"), true);

    const approved = selectExecutionAlternatives(
      {
        modality: "text",
        operation: "generate",
        rightsApproved: true,
        workerBoundaryApproved: true,
        allowResearchCandidates: true
      },
      options({
        configuredAlternativeKeys: ["local_openai_compatible_runtime"],
        approvedAlternativeKeys: ["local_openai_compatible_runtime"]
      })
    );
    assert.equal(approved.candidates.find((item) => item.key === "local_openai_compatible_runtime").ready, true);
  });
});

describe("generation adapter lifecycle", () => {
  function request(overrides = {}) {
    return {
      tenantId: "org_alpha",
      requestId: "req_001",
      idempotencyKey: "idem_001",
      modality: "image",
      operation: "generate",
      inputReferences: [{ ref: "object://tenant/input-1", mediaType: "image/png" }],
      inputDigests: [{ algorithm: "sha256", digest: "a".repeat(64) }],
      ...overrides
    };
  }

  it("defines a canonical adapter surface while keeping execution authority outside the manifest", () => {
    const manifest = validateGenerationAdapterManifest(IN_MEMORY_GENERATION_ADAPTER_MANIFEST);
    assert.equal(manifest.ok, true);
    const adapter = new InMemoryGenerationAdapter();
    const validation = validateGenerationAdapter(adapter);
    assert.equal(validation.ok, true);
    assert.deepEqual(buildGenerationAdapterArchitecture().requiredMethods, ["submit", "status", "cancel", "result", "health"]);
    assert.equal(validation.authority.publishArtifact, false);
    assert.equal(adapter.manifest.externalNetwork, false);
    assert.equal(adapter.manifest.externalSpend, false);
  });

  it("reuses the same logical job for one tenant and idempotency key", async () => {
    let id = 0;
    const adapter = new InMemoryGenerationAdapter({ idFactory: () => `id_${++id}` });
    const first = await adapter.submit(request());
    const second = await adapter.submit(request({ requestId: "req_retry" }));
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.jobId, first.jobId);
    assert.equal(second.providerLocator.providerRequestId, first.providerLocator.providerRequestId);
  });

  it("isolates identical idempotency keys across tenants", async () => {
    let id = 0;
    const adapter = new InMemoryGenerationAdapter({ idFactory: () => `id_${++id}` });
    const alpha = await adapter.submit(request());
    const beta = await adapter.submit(request({ tenantId: "org_beta", requestId: "req_beta" }));
    assert.notEqual(alpha.jobId, beta.jobId);
    await assert.rejects(
      () => adapter.status({ tenantId: "org_beta", jobId: alpha.jobId }),
      (error) => error instanceof GenerationJobRepositoryError && error.code === "job_not_found"
    );
  });

  it("rejects stale writes and illegal terminal transitions", () => {
    const repository = new InMemoryGenerationJobRepository({ idFactory: () => "cas" });
    let job = repository.createOrGetByIdempotency(request()).job;
    job = repository.transition({ tenantId: job.tenantId, jobId: job.id, expectedVersion: 1, toState: "submitted" });
    assert.throws(
      () => repository.transition({ tenantId: job.tenantId, jobId: job.id, expectedVersion: 1, toState: "queued" }),
      (error) => error.code === "stale_version"
    );
    job = repository.transition({ tenantId: job.tenantId, jobId: job.id, expectedVersion: job.version, toState: "canceled" });
    assert.throws(
      () => repository.transition({ tenantId: job.tenantId, jobId: job.id, expectedVersion: job.version, toState: "running" }),
      (error) => error.code === "terminal_state_immutable"
    );
  });

  it("does not persist raw prompts or source media supplied outside the reference contract", async () => {
    const adapter = new InMemoryGenerationAdapter({ idFactory: () => "safe" });
    const submitted = await adapter.submit(request({
      prompt: "TOP SECRET PROMPT SHOULD NOT PERSIST",
      media: "raw-binary-customer-media",
      authorization: "Bearer never-store-this"
    }));
    const stored = adapter.repository.getById("org_alpha", submitted.jobId);
    const serialized = JSON.stringify(stored);
    assert.equal(serialized.includes("TOP SECRET PROMPT"), false);
    assert.equal(serialized.includes("raw-binary-customer-media"), false);
    assert.equal(serialized.includes("never-store-this"), false);
    assert.deepEqual(stored.inputReferences, [{ ref: "object://tenant/input-1", mediaType: "image/png" }]);
  });

  it("withholds results until a durable artifact exists, then completes at zero external cost", async () => {
    const adapter = new InMemoryGenerationAdapter({ idFactory: () => "complete" });
    const submitted = await adapter.submit(request());
    const pending = await adapter.result({ tenantId: "org_alpha", jobId: submitted.jobId });
    assert.equal(pending.available, false);
    assert.equal(pending.reason, "job_not_complete");

    const completed = await adapter.complete({
      tenantId: "org_alpha",
      jobId: submitted.jobId,
      syntheticBytes: "reference-artifact",
      mediaType: "image/png",
      rightsAttestationRef: "rights://attestation/1"
    });
    assert.equal(completed.state, "succeeded");
    assert.equal(completed.cost.amountMinor, 0);

    const result = await adapter.result({ tenantId: "org_alpha", jobId: submitted.jobId });
    assert.equal(result.available, true);
    assert.equal(result.artifacts.length, 1);
    assert.equal(result.artifacts[0].durable, true);
    assert.equal(result.artifacts[0].provenance.adapterKey, "in_memory_reference");
    assert.equal(result.authority.publishArtifact, false);
    assert.equal(result.authority.chargeCustomer, false);
  });

  it("refuses success before a durable artifact has been recorded", () => {
    const repository = new InMemoryGenerationJobRepository({ idFactory: () => "artifact" });
    let job = repository.createOrGetByIdempotency(request()).job;
    job = repository.transition({ tenantId: job.tenantId, jobId: job.id, expectedVersion: job.version, toState: "submitted" });
    job = repository.transition({ tenantId: job.tenantId, jobId: job.id, expectedVersion: job.version, toState: "running" });
    assert.throws(
      () => repository.transition({ tenantId: job.tenantId, jobId: job.id, expectedVersion: job.version, toState: "succeeded" }),
      (error) => error.code === "durable_artifact_required"
    );
    assert.throws(
      () => repository.recordArtifact({
        tenantId: job.tenantId,
        jobId: job.id,
        expectedVersion: job.version,
        artifactId: "artifact_1",
        storageRef: "https://provider.example/temporary",
        sha256: "b".repeat(64),
        mediaType: "image/png",
        durable: false
      }),
      (error) => error.code === "artifact_not_durable"
    );
  });

  it("supports idempotent cancellation without reopening terminal jobs", async () => {
    const adapter = new InMemoryGenerationAdapter({ idFactory: () => "cancel" });
    const submitted = await adapter.submit(request());
    const first = await adapter.cancel({ tenantId: "org_alpha", jobId: submitted.jobId });
    const second = await adapter.cancel({ tenantId: "org_alpha", jobId: submitted.jobId });
    assert.equal(first.state, "canceled");
    assert.equal(first.canceled, true);
    assert.equal(second.state, "canceled");
    const result = await adapter.result({ tenantId: "org_alpha", jobId: submitted.jobId });
    assert.equal(result.available, false);
    assert.equal(result.reason, "job_did_not_succeed");
  });

  it("expires overdue non-terminal jobs without executing a network request", async () => {
    const now = new Date("2026-09-15T22:00:00.000Z");
    const adapter = new InMemoryGenerationAdapter({
      clock: () => now,
      idFactory: () => "expired"
    });
    const submitted = await adapter.submit(request({ deadlineAt: "2026-09-15T21:59:59.000Z" }));
    const status = await adapter.status({ tenantId: "org_alpha", jobId: submitted.jobId });
    assert.equal(status.state, "expired");
    assert.equal(status.terminal, true);
    const health = await adapter.health();
    assert.equal(health.externalNetworkChecked, false);
    assert.equal(health.billableGenerationPerformed, false);
  });

  it("keeps append-only audit history ordered and provider locators server-held", async () => {
    const adapter = new InMemoryGenerationAdapter({ idFactory: () => "audit" });
    const submitted = await adapter.submit(request());
    await adapter.complete({ tenantId: "org_alpha", jobId: submitted.jobId });
    const stored = adapter.repository.getById("org_alpha", submitted.jobId);
    assert.deepEqual(stored.audit.map((event) => event.sequence), stored.audit.map((_, index) => index + 1));
    assert.equal(stored.audit[0].type, "job.created");
    assert.equal(stored.providerLocator.adapterKey, "in_memory_reference");
    assert.equal(typeof stored.providerLocator.providerRequestId, "string");
    assert.equal(adapter.repository.getById("org_beta", submitted.jobId), null);
  });
});

describe("generation durable persistence contract", () => {
  function persistedJob(overrides = {}) {
    return {
      tenantId: "11111111-1111-4111-8111-111111111111",
      requestId: "req_persist_001",
      idempotencyKey: "idem_persist_001",
      modality: "image",
      operation: "generate",
      inputReferences: [{ ref: "object://tenant/reference-1", mediaType: "image/png" }],
      inputDigests: [{ algorithm: "sha256", digest: "c".repeat(64) }],
      ...overrides
    };
  }

  it("maps the proven lifecycle onto six tenant-scoped persistence tables without enabling a provider", () => {
    const architecture = getGenerationPersistenceArchitecture();
    assert.deepEqual(Object.values(GENERATION_PERSISTENCE_TABLES), [
      "generation_jobs",
      "generation_attempts",
      "generation_artifacts",
      "generation_callback_events",
      "generation_cost_events",
      "generation_audit_events"
    ]);
    assert.equal(architecture.tenantColumn, "organization_id");
    assert.equal(architecture.stateMachine.compareAndSwapVersion, true);
    assert.equal(architecture.stateMachine.durableArtifactBeforeSuccess, true);
    assert.equal(architecture.executionAuthority.providersEnabled, 0);
    assert.equal(architecture.executionAuthority.externalNetworkEnabled, false);
    assert.equal(architecture.executionAuthority.externalSpendEnabled, false);
  });

  it("persists only references and digests from a generation request", () => {
    const row = buildGenerationJobRow(persistedJob({
      prompt: "DO NOT STORE THIS PROMPT",
      media: "raw-customer-bytes",
      authorization: "Bearer never-store-this",
      providerResponse: { secret: "provider-body" }
    }));
    const serialized = JSON.stringify(row);
    assert.equal(row.organization_id, "11111111-1111-4111-8111-111111111111");
    assert.equal(row.state, "planned");
    assert.equal(row.version, 1);
    assert.equal(serialized.includes("DO NOT STORE THIS PROMPT"), false);
    assert.equal(serialized.includes("raw-customer-bytes"), false);
    assert.equal(serialized.includes("never-store-this"), false);
    assert.equal(serialized.includes("provider-body"), false);
    assert.deepEqual(row.input_references, [{ ref: "object://tenant/reference-1", mediaType: "image/png" }]);
  });

  it("requires durable artifacts and stores callback digests instead of callback bodies", () => {
    assert.throws(
      () => buildGenerationArtifactRow({
        tenantId: "org_alpha",
        jobId: "job_1",
        storageRef: "https://provider.example/temporary",
        sha256: "d".repeat(64),
        mediaType: "image/png",
        durable: false
      }),
      (error) => error instanceof GenerationPersistenceContractError && error.code === "artifact_not_durable"
    );

    const callback = buildGenerationCallbackEventRow({
      tenantId: "org_alpha",
      jobId: "job_1",
      providerKey: "provider_alpha",
      providerEventId: "evt_123",
      authVerified: true,
      payloadDigest: "e".repeat(64),
      payload: { prompt: "never persist callback body" }
    });
    assert.equal(callback.payload_digest, "e".repeat(64));
    assert.equal(Object.hasOwn(callback, "payload"), false);
    assert.equal(Object.hasOwn(callback, "body"), false);
  });

  it("keeps cost records explicit and strips sensitive audit details", () => {
    const cost = buildGenerationCostEventRow({
      tenantId: "org_alpha",
      jobId: "job_1",
      costType: "authorized",
      amountMinor: 275,
      currency: "usd",
      source: "budget_gate"
    });
    assert.equal(cost.amount_minor, 275);
    assert.equal(cost.currency, "USD");

    const audit = buildGenerationAuditEventRow({
      tenantId: "org_alpha",
      jobId: "job_1",
      eventType: "provider.callback_verified",
      details: {
        provider: "provider_alpha",
        attempt: 2,
        prompt: "secret prompt",
        accessToken: "secret token",
        callbackPayload: "raw payload",
        result: "verified"
      }
    });
    assert.deepEqual(audit.details, {
      provider: "provider_alpha",
      attempt: 2,
      result: "verified"
    });
  });

  it("builds compare-and-swap transitions only for legal state changes", () => {
    assert.deepEqual(
      buildGenerationJobTransitionPatch({ currentState: "submitted", nextState: "queued", expectedVersion: 4 }),
      { state: "queued", version: 5, expectedVersion: 4 }
    );
    assert.throws(
      () => buildGenerationJobTransitionPatch({ currentState: "planned", nextState: "succeeded", expectedVersion: 1 }),
      (error) => error instanceof GenerationPersistenceContractError && error.code === "illegal_transition"
    );
  });

  it("pins the SQL migration to tenant scope, RLS, callback dedupe, and the artifact-before-success guard", () => {
    const migrationPath = path.join(__dirname, "..", "supabase", "migrations", GENERATION_PERSISTENCE_MIGRATION);
    const sql = fs.readFileSync(migrationPath, "utf8").toLowerCase();
    for (const table of Object.values(GENERATION_PERSISTENCE_TABLES)) {
      assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`));
      assert.match(sql, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`));
    }
    assert.equal(sql.includes("public.sonara_is_org_member(organization_id)"), true);
    assert.equal(sql.includes("unique (organization_id, idempotency_key)"), true);
    assert.equal(sql.includes("unique (organization_id, provider_key, provider_event_id)"), true);
    assert.equal(sql.includes("generation job version must increment exactly once"), true);
    assert.equal(sql.includes("durable generation artifact required before success"), true);
    assert.equal(sql.includes("on delete set null (attempt_id)"), true);
    assert.equal(sql.includes("revoke update, delete on public.generation_audit_events from service_role"), true);
    assert.equal(/^\s*prompt\s+(text|jsonb|bytea)\b/im.test(sql), false);
    assert.equal(/^\s*provider_response\s+(text|jsonb|bytea)\b/im.test(sql), false);
    assert.equal(/^\s*payload\s+(text|jsonb|bytea)\b/im.test(sql), false);
  });
});
