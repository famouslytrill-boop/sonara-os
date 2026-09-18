// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  GENERATION_MODALITIES,
  selectGenerationPathways
} = require("./sonara-generation-pathway-planner.cjs");

const GENERATION_OPERATIONS = Object.freeze([
  "generate",
  "edit",
  "transform",
  "extend",
  "upscale",
  "transcribe",
  "synthesize_speech",
  "compose_music",
  "render_3d",
  "analyze"
]);

const EXECUTION_MODES = Object.freeze([
  "synchronous",
  "streaming",
  "asynchronous_job",
  "batch",
  "device_local"
]);

const RESEARCHED_EXECUTION_ALTERNATIVES = Object.freeze([
  executionAlternative({
    key: "browser_webgpu_inference",
    label: "Browser / WebGPU inference",
    pathwayKeys: ["browser_native_creation"],
    runtimeLane: "browser_runtime",
    trustBoundary: "user_device_browser",
    implementationState: "research_backed_candidate",
    modalities: ["text", "image", "audio", "speech", "transcription", "multimodal"],
    operations: ["generate", "edit", "transform", "transcribe", "analyze"],
    executionModes: ["synchronous", "device_local"],
    externalSpend: false,
    externalDataTransfer: false,
    asyncCapable: false,
    workerRequired: false,
    examples: ["Transformers.js with WebGPU", "ONNX Runtime Web with WebGPU/WASM"],
    strengths: ["keeps eligible inputs on-device", "can reduce cloud inference cost", "can continue offline after model assets are available"],
    cautions: ["model and browser support must be benchmarked per capability", "large generative models may exceed practical browser memory/latency limits"],
    sources: [
      "https://huggingface.co/docs/transformers.js/guides/webgpu",
      "https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html"
    ]
  }),
  executionAlternative({
    key: "local_openai_compatible_runtime",
    label: "Local OpenAI-compatible model runtime",
    pathwayKeys: ["owner_device_local", "self_hosted_generation_worker"],
    runtimeLane: "owner_device_or_private_worker",
    trustBoundary: "sonara_or_owner_controlled_compute",
    implementationState: "research_backed_candidate",
    modalities: ["text", "document", "multimodal"],
    operations: ["generate", "edit", "transform", "analyze"],
    executionModes: ["synchronous", "streaming", "device_local"],
    externalSpend: false,
    externalDataTransfer: false,
    asyncCapable: false,
    workerRequired: true,
    examples: ["llama.cpp server", "Ollama", "vLLM", "SGLang"],
    strengths: ["provider-independent local/private inference", "OpenAI-compatible HTTP surfaces reduce adapter churn", "supports offline/private text and multimodal paths depending on model"],
    cautions: ["model weights and licenses remain separately reviewable", "runtime endpoints require network hardening and tenant isolation", "compatibility is API-shaped, not behavior-equivalent across models"],
    sources: [
      "https://docs.ollama.com/api/introduction",
      "https://docs.vllm.ai/en/latest/serving/openai_compatible_server/",
      "https://docs.sglang.io/docs/basic_usage/overview",
      "https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md"
    ]
  }),
  executionAlternative({
    key: "private_diffusion_generation_server",
    label: "Private image/video diffusion server",
    pathwayKeys: ["self_hosted_generation_worker", "owner_device_local"],
    runtimeLane: "isolated_gpu_worker",
    trustBoundary: "sonara_or_owner_controlled_compute",
    implementationState: "research_backed_candidate",
    modalities: ["image", "video", "audio", "multimodal"],
    operations: ["generate", "edit", "transform", "extend", "upscale"],
    executionModes: ["synchronous", "asynchronous_job", "device_local"],
    externalSpend: false,
    externalDataTransfer: false,
    asyncCapable: true,
    workerRequired: true,
    examples: ["Hugging Face Diffusers", "SGLang Diffusion", "ComfyUI behind the SONARA worker boundary"],
    strengths: ["model choice remains replaceable", "supports image/video pipelines without coupling them to the web process", "can be wrapped in SONARA's canonical worker contract"],
    cautions: ["GPU capacity and cold starts must be measured", "custom nodes and model assets require supply-chain review", "GPL components remain isolated where required"],
    sources: [
      "https://huggingface.co/docs/diffusers/index",
      "https://docs.sglang.io/docs/sglang-diffusion"
    ]
  }),
  executionAlternative({
    key: "serverless_open_model_catalog",
    label: "Serverless open-model catalog",
    pathwayKeys: ["hosted_model_marketplace", "hosted_fixed_provider"],
    runtimeLane: "external_api",
    trustBoundary: "approved_external_provider",
    implementationState: "research_backed_candidate",
    modalities: ["text", "document", "image", "audio", "speech", "video", "transcription", "multimodal"],
    operations: ["generate", "edit", "transform", "transcribe", "synthesize_speech", "analyze"],
    executionModes: ["synchronous", "streaming", "asynchronous_job", "batch"],
    externalSpend: true,
    externalDataTransfer: true,
    asyncCapable: true,
    workerRequired: false,
    examples: ["Together AI serverless inference", "Cloudflare Workers AI"],
    strengths: ["no dedicated GPU fleet required", "broad model catalogs", "useful for bursty or evaluation workloads"],
    cautions: ["catalog and per-model terms can change", "provider retention/privacy and output rights require review", "video and other long jobs need durable async handling"],
    sources: [
      "https://docs.together.ai/docs/serverless/models",
      "https://developers.cloudflare.com/workers-ai/"
    ]
  }),
  executionAlternative({
    key: "async_model_marketplace",
    label: "Async model marketplace / queued generation API",
    pathwayKeys: ["hosted_model_marketplace"],
    runtimeLane: "external_api",
    trustBoundary: "approved_external_provider",
    implementationState: "research_backed_candidate",
    modalities: ["text", "image", "audio", "music", "speech", "video", "three_d", "transcription", "multimodal"],
    operations: ["generate", "edit", "transform", "extend", "upscale", "transcribe", "synthesize_speech", "compose_music", "render_3d", "analyze"],
    executionModes: ["asynchronous_job", "streaming"],
    externalSpend: true,
    externalDataTransfer: true,
    asyncCapable: true,
    workerRequired: false,
    examples: ["fal queue/webhook APIs", "Replicate predictions/webhooks"],
    strengths: ["rapid access to heterogeneous models", "queue/webhook patterns fit long-running creative generation", "useful for model evaluation before committing infrastructure"],
    cautions: ["webhook handlers must be idempotent", "temporary provider outputs must be copied into durable SONARA storage", "each model still needs separate rights/license review"],
    sources: [
      "https://fal.ai/docs/documentation/model-apis/inference/queue",
      "https://fal.ai/docs/documentation/model-apis/inference/webhooks",
      "https://replicate.com/docs/topics/webhooks"
    ]
  }),
  executionAlternative({
    key: "managed_gpu_job_queue",
    label: "Managed GPU job queue",
    pathwayKeys: ["managed_gpu_worker"],
    runtimeLane: "isolated_gpu_worker",
    trustBoundary: "approved_external_compute",
    implementationState: "research_backed_candidate",
    modalities: ["text", "image", "audio", "music", "speech", "video", "three_d", "transcription", "multimodal"],
    operations: ["generate", "edit", "transform", "extend", "upscale", "transcribe", "synthesize_speech", "compose_music", "render_3d", "analyze"],
    executionModes: ["synchronous", "asynchronous_job", "batch"],
    externalSpend: true,
    externalDataTransfer: true,
    asyncCapable: true,
    workerRequired: true,
    examples: ["Runpod Serverless", "Modal", "Baseten async inference"],
    strengths: ["SONARA can own the worker image and inference stack", "supports scale-to-zero or queued execution patterns", "fits long-running GPU jobs without placing them inside Vercel"],
    cautions: ["requires image/version rollout discipline", "webhook/output persistence must survive provider retries or expiry", "cost ceilings and cancellation semantics are mandatory"],
    sources: [
      "https://docs.runpod.io/serverless/endpoints/overview",
      "https://modal.com/docs",
      "https://docs.baseten.co/inference/async"
    ]
  }),
  executionAlternative({
    key: "dedicated_gpu_endpoint",
    label: "Dedicated GPU inference endpoint",
    pathwayKeys: ["managed_gpu_worker", "self_hosted_generation_worker"],
    runtimeLane: "isolated_gpu_worker",
    trustBoundary: "approved_dedicated_compute",
    implementationState: "research_backed_candidate",
    modalities: ["text", "document", "image", "audio", "video", "transcription", "multimodal"],
    operations: ["generate", "edit", "transform", "transcribe", "analyze"],
    executionModes: ["synchronous", "streaming", "asynchronous_job"],
    externalSpend: true,
    externalDataTransfer: true,
    asyncCapable: true,
    workerRequired: true,
    examples: ["Together AI dedicated endpoints", "Baseten deployments", "Modal model endpoints"],
    strengths: ["more predictable capacity and latency than shared serverless catalogs", "custom/fine-tuned model deployment is possible where provider terms permit", "can preserve a stable API while changing deployment capacity"],
    cautions: ["idle or reserved capacity can cost more", "capacity planning and autoscaling become an operator responsibility", "deployment-specific security and data handling still require review"],
    sources: [
      "https://docs.together.ai/docs/dedicated-endpoints/overview",
      "https://docs.baseten.co/inference/overview",
      "https://modal.com/docs/cli/latest/endpoint"
    ]
  }),
  executionAlternative({
    key: "governed_provider_router",
    label: "Governed multi-provider router",
    pathwayKeys: ["hosted_fixed_provider"],
    runtimeLane: "external_api",
    trustBoundary: "approved_external_router",
    implementationState: "research_backed_candidate",
    modalities: ["text", "document", "multimodal"],
    operations: ["generate", "edit", "transform", "analyze"],
    executionModes: ["synchronous", "streaming"],
    externalSpend: true,
    externalDataTransfer: true,
    asyncCapable: false,
    workerRequired: false,
    examples: ["OpenRouter provider ordering/fallbacks", "self-hosted routing layer in front of approved OpenAI-compatible endpoints"],
    strengths: ["can centralize endpoint health, model/provider selection and fallback policy", "can reduce application-specific provider branching"],
    cautions: ["SONARA must disable implicit fallback unless the complete fallback set is explicitly approved", "routing must preserve data-retention, residency, budget and capability constraints"],
    sources: [
      "https://openrouter.ai/docs/guides/routing/provider-selection",
      "https://openrouter.ai/docs/guides/routing/model-fallbacks"
    ]
  })
]);

function getGenerationExecutionArchitecture() {
  return {
    ok: true,
    mode: "governed_generation_execution_architecture",
    modalities: [...GENERATION_MODALITIES],
    operations: [...GENERATION_OPERATIONS],
    executionModes: [...EXECUTION_MODES],
    alternatives: RESEARCHED_EXECUTION_ALTERNATIVES.map(copy),
    invariants: [
      "Research-backed alternatives are candidates only and do not gain execution authority from this module.",
      "No external provider, marketplace, router or GPU service is enabled by appearing in the catalog.",
      "Automatic fallback is disabled by default and can only use an explicit approved allowlist.",
      "Local-only and browser-only requests cannot cross into external compute.",
      "A zero external-spend ceiling excludes metered external execution.",
      "Long-running creation uses a durable job contract with idempotency, cancellation, timeout and output persistence.",
      "Provider-hosted output URLs are treated as temporary unless a provider contract explicitly guarantees durability.",
      "Generation ends at a reviewable artifact; publish, send, campaign, billing and destructive authority remain outside this contract."
    ]
  };
}

function selectExecutionAlternatives(intent = {}, options = {}) {
  const normalized = normalizeExecutionIntent(intent);
  const configured = new Set(options.configuredAlternativeKeys || []);
  const approved = new Set(options.approvedAlternativeKeys || []);
  const pathways = selectGenerationPathways(normalized, options.pathwayOptions || options);
  const candidates = RESEARCHED_EXECUTION_ALTERNATIVES
    .map((entry) => evaluateExecutionAlternative(entry, normalized, { configured, approved }))
    .filter((entry) => entry.eligible)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

  const fallbackPolicy = buildFallbackPolicy(candidates, normalized, { approved });
  return {
    ok: candidates.length > 0,
    mode: "generation_execution_candidates",
    intent: normalized,
    pathwaySelection: pathways,
    candidates,
    fallbackPolicy,
    canExecuteFromPlanner: false,
    requiresExplicitExecutionStep: true,
    publishAuthorityGranted: false
  };
}

function evaluateExecutionAlternative(record, intent, state = {}) {
  const entry = copy(record);
  const blockedReasons = [];
  const setupReasons = [];
  const modalityMatch = entry.modalities.includes(intent.modality) || entry.modalities.includes("multimodal");
  const operationMatch = entry.operations.includes(intent.operation);

  if (!modalityMatch) blockedReasons.push("modality_not_supported");
  if (!operationMatch) blockedReasons.push("operation_not_supported");
  if (intent.localOnly && entry.externalDataTransfer) blockedReasons.push("local_only_excludes_external_compute");
  if (intent.browserOnly && entry.runtimeLane !== "browser_runtime") blockedReasons.push("browser_only_excludes_non_browser_runtime");
  if (intent.maxExternalSpend === 0 && entry.externalSpend) blockedReasons.push("zero_external_spend_excludes_metered_path");
  if (intent.asyncRequired && entry.asyncCapable !== true) blockedReasons.push("async_required");
  if (!intent.allowResearchCandidates && entry.implementationState === "research_backed_candidate") blockedReasons.push("research_candidate_not_enabled");

  if (entry.requiresRightsReview && intent.rightsApproved !== true) setupReasons.push("rights_review_required");
  if (entry.externalSpend && intent.externalSpendApproved !== true) setupReasons.push("external_spend_approval_required");
  if (entry.workerRequired && intent.workerBoundaryApproved !== true) setupReasons.push("worker_boundary_approval_required");
  if (!state.configured?.has(entry.key)) setupReasons.push("adapter_or_runtime_not_configured");
  if (state.approved?.size > 0 && !state.approved.has(entry.key)) setupReasons.push("not_in_approved_execution_allowlist");

  let score = 0;
  if (modalityMatch) score += 40;
  if (operationMatch) score += 30;
  if (!entry.externalSpend && intent.preferLowerCost) score += 15;
  if (!entry.externalDataTransfer && intent.preferLocal) score += 20;
  if (entry.runtimeLane === "browser_runtime" && intent.preferBrowser) score += 25;
  if (entry.asyncCapable && intent.asyncPreferred) score += 10;
  if (state.configured?.has(entry.key)) score += 15;
  if (state.approved?.has(entry.key)) score += 10;
  if (entry.implementationState === "research_backed_candidate") score -= 10;

  return {
    ...entry,
    eligible: blockedReasons.length === 0,
    ready: blockedReasons.length === 0 && setupReasons.length === 0,
    blockedReasons,
    setupReasons: [...new Set(setupReasons)],
    score,
    canExecuteFromPlanner: false
  };
}

function buildFallbackPolicy(candidates = [], intent = {}, state = {}) {
  const approved = state.approved || new Set();
  const approvedCandidates = candidates.filter((entry) => approved.has(entry.key) && entry.ready);
  if (intent.allowAutomaticFallback !== true) {
    return fallbackPolicy("disabled", [], ["automatic_fallback_not_requested"]);
  }
  if (approved.size < 2) {
    return fallbackPolicy("disabled", [], ["explicit_multi_candidate_allowlist_required"]);
  }
  if (approvedCandidates.length < 2) {
    return fallbackPolicy("disabled", approvedCandidates.map((entry) => entry.key), ["at_least_two_approved_ready_candidates_required"]);
  }
  const maxAttempts = clampInteger(intent.maxFallbackAttempts + 1, 2, approvedCandidates.length);
  const chain = approvedCandidates.slice(0, maxAttempts).map((entry) => entry.key);
  return {
    enabled: true,
    mode: "explicit_allowlist_only",
    chain,
    maximumAttempts: chain.length,
    preserveConstraints: ["tenant_scope", "rights", "privacy", "residency", "budget", "modality", "operation"],
    externalEscalationRequiresApproval: true,
    canUseUnlistedProvider: false,
    reasons: []
  };
}

function buildGenerationJobContract(intent = {}, alternativeKey, options = {}) {
  const normalized = normalizeExecutionIntent({ ...intent, asyncRequired: true });
  const alternative = RESEARCHED_EXECUTION_ALTERNATIVES.find((item) => item.key === alternativeKey);
  if (!alternative) {
    return { ok: false, mode: "generation_job_contract", error: "unknown_execution_alternative", alternativeKey: alternativeKey || null };
  }
  const evaluated = evaluateExecutionAlternative(alternative, normalized, {
    configured: new Set(options.configuredAlternativeKeys || []),
    approved: new Set(options.approvedAlternativeKeys || [])
  });
  return {
    ok: evaluated.eligible && evaluated.asyncCapable === true,
    mode: "generation_job_contract",
    version: "sonara.generation.job.v1",
    alternative: evaluated,
    intent: normalized,
    stateMachine: ["planned", "submitted", "queued", "running", "succeeded", "failed", "canceled", "expired"],
    requiredIdentifiers: ["tenant_id", "request_id", "idempotency_key"],
    requiredControls: ["deadline", "max_attempts", "cancellation", "max_cost_or_compute_budget", "input_rights_attestation", "output_persistence_target"],
    callbackContract: {
      allowedCompletionModes: ["authenticated_webhook", "bounded_polling"],
      requirements: [
        "correlate provider request id to tenant/request/idempotency key",
        "verify provider-specific signature or shared-secret mechanism when available",
        "process duplicate callbacks idempotently",
        "return success quickly after durable acceptance",
        "never treat callback delivery as publication approval"
      ]
    },
    artifactContract: {
      providerOutputIsDurableByDefault: false,
      persistBeforeDownstreamUse: true,
      provenanceRequired: true,
      recordFields: ["provider", "model_or_runtime", "version", "prompt_or_input_hash", "created_at", "cost_when_available", "source_asset_references", "rights_review_reference"]
    },
    authority: {
      generateArtifact: false,
      publishArtifact: false,
      sendExternally: false,
      chargeCustomer: false,
      mutateIdentitySensitiveData: false,
      destructiveAction: false
    },
    canExecuteFromContract: false
  };
}

function normalizeExecutionIntent(intent = {}) {
  const modality = GENERATION_MODALITIES.includes(String(intent.modality || "text"))
    ? String(intent.modality || "text")
    : "multimodal";
  const operation = GENERATION_OPERATIONS.includes(String(intent.operation || "generate"))
    ? String(intent.operation || "generate")
    : "generate";
  const spend = intent.maxExternalSpend == null ? null : Number(intent.maxExternalSpend);
  const maxExternalSpend = Number.isFinite(spend) ? Math.max(0, spend) : null;
  const maxFallbackAttempts = clampInteger(Number(intent.maxFallbackAttempts || 1), 1, 8);
  return {
    modality,
    operation,
    localOnly: intent.localOnly === true,
    browserOnly: intent.browserOnly === true,
    preferLocal: intent.preferLocal === true || intent.localOnly === true,
    preferBrowser: intent.preferBrowser === true || intent.browserOnly === true,
    preferLowerCost: intent.preferLowerCost !== false,
    asyncRequired: intent.asyncRequired === true,
    asyncPreferred: intent.asyncPreferred === true || intent.asyncRequired === true || ["video", "three_d", "music"].includes(modality),
    rightsApproved: intent.rightsApproved === true,
    externalSpendApproved: intent.externalSpendApproved === true,
    workerBoundaryApproved: intent.workerBoundaryApproved === true,
    allowResearchCandidates: intent.allowResearchCandidates === true,
    allowAutomaticFallback: intent.allowAutomaticFallback === true,
    maxFallbackAttempts,
    maxExternalSpend
  };
}

function executionAlternative(input) {
  return Object.freeze({
    executionAuthority: "none_from_research",
    enabledByCatalog: false,
    canExecuteFromPlanner: false,
    requiresRightsReview: true,
    ...input,
    pathwayKeys: Object.freeze([...(input.pathwayKeys || [])]),
    modalities: Object.freeze([...(input.modalities || [])]),
    operations: Object.freeze([...(input.operations || [])]),
    executionModes: Object.freeze([...(input.executionModes || [])]),
    examples: Object.freeze([...(input.examples || [])]),
    strengths: Object.freeze([...(input.strengths || [])]),
    cautions: Object.freeze([...(input.cautions || [])]),
    sources: Object.freeze([...(input.sources || [])])
  });
}

function fallbackPolicy(mode, chain, reasons) {
  return {
    enabled: false,
    mode,
    chain: [...chain],
    maximumAttempts: chain.length,
    preserveConstraints: ["tenant_scope", "rights", "privacy", "residency", "budget", "modality", "operation"],
    externalEscalationRequiresApproval: true,
    canUseUnlistedProvider: false,
    reasons: [...reasons]
  };
}

function clampInteger(value, min, max) {
  const numeric = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : min;
  return Math.max(min, Math.min(max, numeric));
}

function copy(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(copy);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
}

module.exports = {
  GENERATION_OPERATIONS,
  EXECUTION_MODES,
  RESEARCHED_EXECUTION_ALTERNATIVES,
  getGenerationExecutionArchitecture,
  selectExecutionAlternatives,
  evaluateExecutionAlternative,
  buildFallbackPolicy,
  buildGenerationJobContract,
  normalizeExecutionIntent
};
