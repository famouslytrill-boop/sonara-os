"use strict";

const assert = require("node:assert/strict");
const {
  getRuntimeCapabilityPlan,
  planResearchRecord,
  inferProductTargets
} = require("../lib/sonara-runtime-capability-planner.cjs");
const {
  getGenerationPathwayPlan,
  selectGenerationPathways,
  buildCreationPipeline,
  capabilityToModalities
} = require("../lib/sonara-generation-pathway-planner.cjs");
const { getModelEngineControlPlane } = require("../lib/sonara-model-engine-control-plane.cjs");

function convergence(repositories) {
  return {
    mode: "test_convergence",
    counts: { uniqueRepositoryResearch: repositories.length },
    repositories
  };
}

function record(overrides = {}) {
  return {
    repository: "example/tool",
    label: "Example Tool",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    commercialUseStatus: "allowed_after_review",
    runtimeClass: "worker_service",
    integrationStatus: "research_only",
    integrationMode: "reference_only",
    productFit: ["Creator Studio"],
    capabilities: ["media pipeline"],
    safety: [],
    blockedUses: [],
    sourceRecords: [{ sourceId: 10 }],
    seenInBatches: [10],
    enabledInProduction: false,
    ...overrides
  };
}

function generationOptions({ creatorConfigured = false, workerConfigured = false, hostedTextConfigured = false } = {}) {
  return {
    providerCatalog: [
      {
        key: "creator_provider",
        label: "Creator Provider",
        adapterMode: "direct_http",
        integrationStatus: "adapter_available",
        capabilities: ["text_to_video", "text_to_music"],
        readiness: { configured: creatorConfigured, status: creatorConfigured ? "configured" : "disabled" }
      },
      {
        key: "open_source_media_worker",
        label: "SONARA Open Media Worker",
        adapterMode: "canonical_worker_http",
        integrationStatus: "adapter_available",
        capabilities: ["text_to_video", "text_to_music", "reference_analysis"],
        readiness: { configured: workerConfigured, status: workerConfigured ? "configured" : "disabled" }
      },
      {
        key: "reference_only_model",
        label: "Reference Model",
        adapterMode: "reference_only",
        integrationStatus: "worker_candidate",
        capabilities: ["image_generation"],
        readiness: { configured: false, status: "worker_candidate" }
      }
    ],
    hostedTextState: {
      local_rules: { enabled: true, status: "ready" },
      openai: { enabled: hostedTextConfigured, status: hostedTextConfigured ? "configured" : "disabled" },
      anthropic: { enabled: false, status: "disabled" }
    }
  };
}

describe("research-to-runtime capability planner", () => {
  it("classifies every converged repository without granting execution authority", () => {
    const source = [
      record(),
      record({ repository: "example/dev-tool", runtimeClass: "developer_cli", productFit: ["Internal development"] }),
      record({ repository: "example/unlicensed", license: "NOASSERTION", licenseRisk: "unknown" })
    ];
    const plan = getRuntimeCapabilityPlan({
      convergence: convergence(source),
      providerState: {
        local_rules: { enabled: true, status: "ready" },
        openai: { enabled: false, status: "disabled", model: "gpt-test", host: "api.openai.com" },
        anthropic: { enabled: false, status: "disabled", model: "claude-test", host: "api.anthropic.com" }
      }
    });

    assert.equal(plan.sourceRepositoryCount, 3);
    assert.equal(plan.research.length, 3);
    assert.equal(plan.research.every((item) => item.canExecuteFromPlan === false), true);
    assert.equal(plan.research.every((item) => item.executionAuthority === "none_from_research"), true);
    assert.equal(plan.promotionPolicy.rule, "Research presence never grants execution authority.");
  });

  it("blocks missing-license and unverified research records", () => {
    const noLicense = planResearchRecord(record({ license: "NOASSERTION", licenseRisk: "unknown" }));
    assert.equal(noLicense.adoptionTier, "blocked");
    assert.equal(noLicense.licenseDisposition, "blocked_license_review");

    const unverified = planResearchRecord(record({ repositoryVerified: false, license: "MIT" }));
    assert.equal(unverified.adoptionTier, "blocked");
    assert.equal(unverified.licenseDisposition, "blocked_unverified_repository");
  });

  it("keeps security-sensitive and provider-limit-bypass research out of production authority", () => {
    const sensitive = planResearchRecord(record({
      repository: "example/device-tracker",
      capabilities: ["device activity tracker"],
      safety: ["privacy-sensitive"]
    }));
    assert.equal(sensitive.securityDisposition, "security_privacy_or_dual_use_review");
    assert.equal(sensitive.canExecuteFromPlan, false);

    const bypass = planResearchRecord(record({
      repository: "example/subscription-rotator",
      capabilities: ["subscription pool", "credential rotation"],
      blockedUses: ["limit bypass"]
    }));
    assert.equal(bypass.securityDisposition, "restricted_or_blocked");
    assert.equal(bypass.adoptionTier, "blocked");
  });

  it("represents hosted providers as optional external APIs and never executes them from planning", () => {
    const plan = getRuntimeCapabilityPlan({
      convergence: convergence([]),
      providerState: {
        local_rules: { enabled: true, status: "ready" },
        openai: { enabled: true, status: "configured", model: "gpt-test", host: "api.openai.com" },
        anthropic: { enabled: false, status: "disabled", model: "claude-test", host: "api.anthropic.com" }
      }
    });
    const openai = plan.runtimeCore.find((item) => item.key === "hosted_openai");
    const anthropic = plan.runtimeCore.find((item) => item.key === "hosted_anthropic");

    assert.equal(openai.runtimeLane, "external_api");
    assert.equal(openai.executionAuthority, "draft_content_only_via_agent_runner");
    assert.equal(openai.canExecuteFromPlan, false);
    assert.equal(anthropic.executionAuthority, "setup_required");
    assert.equal(anthropic.canExecuteFromPlan, false);
  });

  it("maps research to the product surfaces it can inform without widening access", () => {
    assert.deepEqual(
      inferProductTargets(record({
        label: "Marketing media analytics",
        productFit: ["Growth Studio", "Creator Studio"],
        capabilities: ["campaign analytics", "video content"]
      })),
      ["Creator Studio™", "Growth Studio™"]
    );
  });
});

describe("generation and creation pathway planner", () => {
  it("covers the major creation modalities while remaining non-executing", () => {
    const plan = getGenerationPathwayPlan(generationOptions());
    const covered = new Set(plan.pathways.flatMap((item) => item.modalities));
    for (const modality of ["text", "image", "video", "music", "three_d", "interactive", "transcription"]) {
      assert.equal(covered.has(modality), true, `${modality} has no pathway`);
    }
    assert.equal(plan.pathways.every((item) => item.canExecuteFromPlanner === false), true);
    assert.equal(plan.alternatives.every((item) => item.enabledByPlanner === false), true);
    assert.equal(plan.alternatives.every((item) => item.canExecuteFromPlanner === false), true);
  });

  it("excludes external APIs and managed external GPU compute for a local-only request", () => {
    const result = selectGenerationPathways(
      { modality: "music", localOnly: true, allowResearchCandidates: true, rightsApproved: true },
      generationOptions({ workerConfigured: true })
    );
    assert.equal(result.pathways.some((item) => item.runtimeLane === "external_api"), false);
    assert.equal(result.pathways.some((item) => item.key === "managed_gpu_worker"), false);
    assert.equal(result.pathways.some((item) => item.key === "owner_device_local"), true);
    assert.equal(result.automaticProviderFallback, false);
    assert.equal(result.canExecuteFromPlanner, false);
  });

  it("excludes model-backed generation when deterministic-only is required", () => {
    const result = selectGenerationPathways(
      { modality: "image", deterministicOnly: true, rightsApproved: true },
      generationOptions({ creatorConfigured: true, workerConfigured: true, hostedTextConfigured: true })
    );
    assert.equal(result.pathways.length > 0, true);
    assert.equal(result.pathways.every((item) => item.modelBacked === false), true);
    assert.equal(result.pathways.some((item) => item.key === "deterministic_templates"), true);
  });

  it("keeps marketplace, managed GPU and owner-device candidates out unless research candidates are explicitly requested", () => {
    const normal = selectGenerationPathways({ modality: "video", rightsApproved: true }, generationOptions({ creatorConfigured: true }));
    assert.equal(normal.pathways.some((item) => item.implementationState === "research_backed_candidate"), false);

    const review = selectGenerationPathways(
      { modality: "video", rightsApproved: true, allowResearchCandidates: true },
      generationOptions({ creatorConfigured: true })
    );
    assert.equal(review.pathways.some((item) => item.key === "hosted_model_marketplace"), true);
    assert.equal(review.pathways.find((item) => item.key === "hosted_model_marketplace").ready, false);
  });

  it("marks a configured hosted provider ready only for modalities that its installed adapters support", () => {
    const text = selectGenerationPathways(
      { modality: "text", rightsApproved: true },
      generationOptions({ hostedTextConfigured: true })
    );
    const hostedText = text.pathways.find((item) => item.key === "hosted_fixed_provider");
    assert.equal(hostedText.ready, true);

    const image = selectGenerationPathways(
      { modality: "image", rightsApproved: true },
      generationOptions({ hostedTextConfigured: true })
    );
    const hostedImage = image.pathways.find((item) => item.key === "hosted_fixed_provider");
    assert.equal(hostedImage.ready, false);
    assert.equal(hostedImage.setupReasons.includes("no_configured_provider_for_modality"), true);
  });

  it("requires the worker boundary and rights review before self-hosted model pathways are ready", () => {
    const missing = selectGenerationPathways(
      { modality: "video", allowResearchCandidates: true },
      generationOptions({ workerConfigured: false })
    );
    const selfHostedMissing = missing.pathways.find((item) => item.key === "self_hosted_generation_worker");
    assert.equal(selfHostedMissing.ready, false);
    assert.equal(selfHostedMissing.setupReasons.includes("rights_review_required"), true);
    assert.equal(selfHostedMissing.setupReasons.includes("open_media_worker_not_configured"), true);

    const ready = selectGenerationPathways(
      { modality: "video", rightsApproved: true, allowResearchCandidates: true },
      generationOptions({ workerConfigured: true })
    );
    assert.equal(ready.pathways.find((item) => item.key === "self_hosted_generation_worker").ready, true);
  });

  it("does not treat input-side text in text-to-video as a configured text-generation provider", () => {
    assert.deepEqual(capabilityToModalities("text_to_video"), ["video"]);
    assert.deepEqual(capabilityToModalities("text_to_music"), ["music"]);
    assert.equal(capabilityToModalities("business_drafting").includes("text"), true);
  });

  it("builds a staged pipeline whose review and publish/export stages remain approval-gated", () => {
    const pipeline = buildCreationPipeline(
      { modality: "image", rightsApproved: true },
      generationOptions({ creatorConfigured: true })
    );
    assert.equal(pipeline.canExecuteFromPlanner, false);
    assert.equal(pipeline.publishAuthorityGranted, false);
    assert.equal(pipeline.automaticProviderFallback, false);
    assert.equal(pipeline.stages.find((stage) => stage.key === "owner_review").approvalRequired, true);
    assert.equal(pipeline.stages.find((stage) => stage.key === "export_or_publish").approvalRequired, true);
  });

  it("surfaces generation pathways and the new worker candidates through the model control plane", () => {
    const controlPlane = getModelEngineControlPlane();
    assert.equal(controlPlane.generationCreationPathways.pathwayCount >= 9, true);
    assert.equal(controlPlane.generationCreationPathways.pathways.every((item) => item.canExecuteFromPlanner === false), true);
    assert.equal(controlPlane.engines.some((item) => item.key === "huggingface_diffusers"), true);
    assert.equal(controlPlane.engines.some((item) => item.key === "triposr"), true);
  });
});
