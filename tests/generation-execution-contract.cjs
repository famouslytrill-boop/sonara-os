"use strict";

const assert = require("node:assert/strict");
const {
  RESEARCHED_EXECUTION_ALTERNATIVES,
  getGenerationExecutionArchitecture,
  selectExecutionAlternatives,
  buildGenerationJobContract
} = require("../lib/sonara-generation-execution-contract.cjs");

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
