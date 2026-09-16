"use strict";

const { getCreatorGenerationCatalog } = require("./creator-generation-provider-registry.cjs");
const hostedModels = require("./sonara-model-provider-router.cjs");

const GENERATION_MODALITIES = Object.freeze([
  "text",
  "document",
  "image",
  "audio",
  "music",
  "speech",
  "video",
  "three_d",
  "interactive",
  "transcription",
  "multimodal"
]);

const GENERATION_PATHWAYS = Object.freeze([
  pathway({ key: "deterministic_templates", label: "Deterministic templates and renderers", runtimeLane: "web_process", implementationState: "active_internal", modalities: ["text", "document", "image", "interactive"], privacyClass: "tenant_scoped_internal", costClass: "included_compute", latencyClass: "interactive", externalSpend: false, modelBacked: false, configurationRequired: false, rightsReviewRequired: false, examples: ["HTML/SVG/CSS composition", "structured documents", "template-driven social graphics", "deterministic record assistants"], notes: ["Prefer this path when a model adds no material value.", "Inputs and embedded customer media still retain their own rights and privacy obligations."] }),
  pathway({ key: "browser_native_creation", label: "Browser-native creation runtime", runtimeLane: "browser_runtime", implementationState: "active_internal", modalities: ["image", "audio", "interactive", "multimodal"], privacyClass: "browser_session", costClass: "client_compute", latencyClass: "interactive", externalSpend: false, modelBacked: false, configurationRequired: false, rightsReviewRequired: false, examples: ["Canvas/SVG editing", "WebAudio composition", "WebGL/Three.js-style previews", "manual timeline and layout tools"], notes: ["Browser tools do not gain server credentials or provider authority.", "Large model inference remains outside the browser runtime unless separately reviewed."] }),
  pathway({ key: "hosted_fixed_provider", label: "Configured hosted provider adapters", runtimeLane: "external_api", implementationState: "adapter_available_with_setup", modalities: ["text", "document", "image", "audio", "music", "speech", "video", "transcription", "multimodal"], privacyClass: "explicit_external_provider", costClass: "metered_external", latencyClass: "interactive_or_async", externalSpend: true, modelBacked: true, configurationRequired: true, rightsReviewRequired: true, examples: ["OpenAI/Anthropic governed text", "ElevenLabs", "Google Veo", "Suno", "approved external creative providers"], notes: ["Provider selection is explicit and server-side.", "No silent fallback between paid providers.", "Provider terms, consent, provenance, and metering remain binding."] }),
  pathway({ key: "hosted_model_marketplace", label: "Hosted model marketplace", runtimeLane: "external_api", implementationState: "research_backed_candidate", modalities: ["text", "image", "audio", "music", "speech", "video", "three_d", "transcription", "multimodal"], privacyClass: "explicit_external_provider", costClass: "metered_external", latencyClass: "async_first", externalSpend: true, modelBacked: true, configurationRequired: true, rightsReviewRequired: true, examples: ["Replicate predictions", "fal queue/webhook APIs"], notes: ["Research-backed candidate only; SONARA has not enabled these providers by this planner.", "Each selected model needs a separate license/terms/output-rights decision.", "Webhook handlers must be idempotent and authenticated before production use."] }),
  pathway({ key: "managed_gpu_worker", label: "Managed GPU worker backend", runtimeLane: "isolated_gpu_worker", implementationState: "research_backed_candidate", modalities: ["image", "audio", "music", "speech", "video", "three_d", "transcription", "multimodal"], privacyClass: "isolated_external_compute", costClass: "metered_gpu", latencyClass: "async_first", externalSpend: true, modelBacked: true, configurationRequired: true, rightsReviewRequired: true, examples: ["Runpod Serverless wrapping the SONARA worker contract"], notes: ["Use a versioned worker image and bounded queue contract rather than running GPU jobs in Vercel.", "Require timeout, cancellation, cost ceiling, audit, health, and rollback evidence."] }),
  pathway({ key: "self_hosted_generation_worker", label: "Self-hosted isolated generation worker", runtimeLane: "isolated_gpu_worker", implementationState: "worker_contract_available_with_setup", modalities: ["image", "audio", "music", "speech", "video", "three_d", "transcription", "multimodal"], privacyClass: "sonara_controlled_worker", costClass: "owned_or_rented_compute", latencyClass: "async_first", externalSpend: false, modelBacked: true, configurationRequired: true, rightsReviewRequired: true, examples: ["Hugging Face Diffusers", "ComfyUI", "ACE-Step 1.5", "Wan 2.2", "Qwen-Image", "TripoSR", "Whisper-family analysis"], notes: ["The existing SONARA Open Media Worker contract is the boundary; model repositories are not installed by this planner.", "ComfyUI remains an isolated GPL-reviewed workflow engine rather than hosted SONARA source.", "Model weights, datasets, custom nodes, checkpoints and output rights are reviewed separately from library licenses."] }),
  pathway({ key: "owner_device_local", label: "Owner-device local generation", runtimeLane: "owner_device", implementationState: "research_backed_candidate", modalities: ["text", "image", "audio", "music", "speech", "transcription", "multimodal"], privacyClass: "device_local", costClass: "owner_hardware", latencyClass: "hardware_dependent", externalSpend: false, modelBacked: true, configurationRequired: true, rightsReviewRequired: true, examples: ["Ollama", "llama.cpp", "local ACE-Step", "local Whisper"], notes: ["Device permissions stay explicit and local.", "This is a privacy/offline pathway, not a hidden fallback when cloud providers fail."] }),
  pathway({ key: "external_creative_companion", label: "External creative companion", runtimeLane: "owner_device", implementationState: "external_companion", modalities: ["image", "audio", "music", "speech", "video", "three_d", "interactive", "multimodal"], privacyClass: "explicit_external_application", costClass: "external_application", latencyClass: "human_in_loop", externalSpend: false, modelBacked: false, configurationRequired: false, rightsReviewRequired: true, examples: ["Blender", "OBS Studio", "FL Studio", "NLE/DAW interchange"], notes: ["Prefer documented interchange formats and explicit companion actions over bundling third-party application runtimes.", "The planner does not control desktop applications."] }),
  pathway({ key: "hybrid_staged_pipeline", label: "Hybrid staged creation pipeline", runtimeLane: "orchestration_only", implementationState: "planning_ready", modalities: [...GENERATION_MODALITIES], privacyClass: "stage_specific", costClass: "stage_specific", latencyClass: "stage_specific", externalSpend: false, modelBacked: true, configurationRequired: false, rightsReviewRequired: true, examples: ["plan -> generate -> analyze/QC -> revise -> approve -> export/publish"], notes: ["Each stage inherits the stricter rights, privacy, cost and approval boundary of the selected execution pathway.", "Publish, campaign, payment, destructive, identity-sensitive and other high-authority actions remain owner-approved."] })
]);

const RESEARCH_BACKED_ALTERNATIVES = Object.freeze([
  alternative({ key: "huggingface_diffusers", label: "Hugging Face Diffusers", pathway: "self_hosted_generation_worker", repository: "huggingface/diffusers", license: "Apache-2.0", status: "research_verified_library", capabilities: ["image_generation", "video_generation", "audio_generation", "adapter_workflows"] }),
  alternative({ key: "comfyui", label: "ComfyUI", pathway: "self_hosted_generation_worker", repository: "Comfy-Org/ComfyUI", license: "GPL-3.0", status: "isolated_license_review", capabilities: ["node_graphs", "image_generation", "video_generation", "audio_generation"] }),
  alternative({ key: "ace_step_1_5", label: "ACE-Step 1.5", pathway: "self_hosted_generation_worker", repository: "ace-step/ACE-Step-1.5", license: "MIT", status: "model_rights_review", capabilities: ["music_generation", "music_editing"] }),
  alternative({ key: "wan_2_2", label: "Wan 2.2", pathway: "self_hosted_generation_worker", repository: "Wan-Video/Wan2.2", license: "Apache-2.0", status: "model_rights_review", capabilities: ["text_to_video", "image_to_video"] }),
  alternative({ key: "qwen_image", label: "Qwen-Image", pathway: "self_hosted_generation_worker", repository: "QwenLM/Qwen-Image", license: "Apache-2.0", status: "model_rights_review", capabilities: ["image_generation", "image_editing", "image_text_rendering"] }),
  alternative({ key: "triposr", label: "TripoSR", pathway: "self_hosted_generation_worker", repository: "VAST-AI-Research/TripoSR", license: "MIT", status: "model_rights_review", capabilities: ["image_to_3d"] }),
  alternative({ key: "runpod_serverless", label: "Runpod Serverless", pathway: "managed_gpu_worker", repository: null, license: "External service contract", status: "research_backed_candidate", capabilities: ["queued_gpu_jobs", "async_status", "cancellation", "worker_scaling"] }),
  alternative({ key: "replicate", label: "Replicate", pathway: "hosted_model_marketplace", repository: null, license: "External service contract", status: "research_backed_candidate", capabilities: ["hosted_predictions", "async_predictions", "webhooks"] }),
  alternative({ key: "fal", label: "fal", pathway: "hosted_model_marketplace", repository: null, license: "External service contract", status: "research_backed_candidate", capabilities: ["queued_generation", "webhooks", "multi_model_catalog"] }),
  alternative({ key: "ollama", label: "Ollama", pathway: "owner_device_local", repository: null, license: "separate_runtime_and_model_terms", status: "research_backed_candidate", capabilities: ["local_text", "local_multimodal", "local_embeddings"] }),
  alternative({ key: "llama_cpp", label: "llama.cpp", pathway: "owner_device_local", repository: "ggml-org/llama.cpp", license: "verify_before_adoption", status: "research_backed_candidate", capabilities: ["local_text", "local_vlm", "openai_compatible_local_server"] })
]);

function getGenerationPathwayPlan(options = {}) {
  const providerCatalog = options.providerCatalog || getCreatorGenerationCatalog(options.env || process.env);
  const hostedTextState = summarizeHostedTextReadiness(options.hostedTextState || hostedModels.getProviderReadiness(options.hostedTextOptions || {}));
  const providerState = summarizeProviderCatalog(providerCatalog, hostedTextState);
  const pathways = GENERATION_PATHWAYS.map((entry) => hydratePathway(entry, providerState));
  return {
    ok: true,
    mode: "governed_generation_creation_pathways",
    modalities: [...GENERATION_MODALITIES],
    pathways,
    alternatives: RESEARCH_BACKED_ALTERNATIVES.map(copy),
    providerState,
    routingPrinciples: [
      "Prefer deterministic or browser-native creation when a model adds no material value.",
      "Never silently switch between paid/external providers.",
      "A local-only request excludes external APIs and externally managed GPU execution.",
      "A research record or model example never grants execution authority.",
      "Rights, consent, tenant scope, budget, provenance and provider readiness are evaluated before execution.",
      "Generation and creation stop at a reviewable artifact; publish/send/bill/destructive actions keep their existing approval boundaries."
    ],
    boundaries: [
      "This planner returns eligible pathways and staged plans only; it does not call providers, run models, start workers, download weights or mutate customer records.",
      "Replicate, fal and Runpod are research-backed candidates in this plan, not installed SONARA adapters.",
      "Diffusers, ComfyUI and model-family records are worker choices, not dependencies automatically added to the Express/Vercel web process.",
      "Owner-device pathways require an explicit local companion connection and never receive server credentials by implication.",
      "Every third-party model, checkpoint, dataset, custom node, asset, font, voice, reference image/video/audio and generated-output use remains subject to its own rights and policy review."
    ]
  };
}

function selectGenerationPathways(intent = {}, options = {}) {
  const normalized = normalizeIntent(intent);
  const plan = getGenerationPathwayPlan(options);
  const evaluated = plan.pathways
    .map((entry) => evaluatePathway(entry, normalized, plan.providerState))
    .filter((entry) => entry.eligible)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return { ok: evaluated.length > 0, mode: "eligible_generation_pathways", intent: normalized, pathways: evaluated, canExecuteFromPlanner: false, automaticProviderFallback: false, requiresExplicitExecutionStep: true };
}

function evaluatePathway(pathwayRecord, normalizedIntent, providerState = {}) {
  const entry = copy(pathwayRecord);
  const reasons = [];
  const setupReasons = [];
  const modalityMatch = entry.modalities.includes(normalizedIntent.modality) || entry.modalities.includes("multimodal");
  if (!modalityMatch) reasons.push("modality_not_supported");
  if (normalizedIntent.localOnly && entry.runtimeLane === "external_api") reasons.push("local_only_excludes_external_api");
  if (normalizedIntent.localOnly && entry.key === "managed_gpu_worker") reasons.push("local_only_excludes_managed_external_gpu");
  if (normalizedIntent.deterministicOnly && entry.modelBacked) reasons.push("deterministic_only_excludes_model_path");
  if (!normalizedIntent.allowExternalCompanion && entry.key === "external_creative_companion") reasons.push("external_companion_not_requested");
  if (!normalizedIntent.allowResearchCandidates && entry.implementationState === "research_backed_candidate") reasons.push("research_candidate_not_enabled");
  if (normalizedIntent.maxExternalSpend === 0 && entry.externalSpend) reasons.push("zero_external_spend_excludes_metered_external_path");
  if (entry.rightsReviewRequired && normalizedIntent.rightsApproved !== true) setupReasons.push("rights_review_required");
  if (entry.configurationRequired && entry.configured !== true) setupReasons.push("configuration_required");
  if (entry.key === "hosted_fixed_provider" && !providerState.configuredModalities.includes(normalizedIntent.modality)) setupReasons.push("no_configured_provider_for_modality");
  if (["managed_gpu_worker", "self_hosted_generation_worker"].includes(entry.key) && providerState.openMediaWorkerConfigured !== true) setupReasons.push("open_media_worker_not_configured");
  if (entry.key === "hybrid_staged_pipeline") setupReasons.push("stage_selection_and_review_required");

  let score = 0;
  if (modalityMatch) score += 50;
  if (!entry.externalSpend) score += normalizedIntent.preferLowerCost ? 15 : 5;
  if (entry.privacyClass === "device_local" && normalizedIntent.preferLocal) score += 25;
  if (entry.key === "deterministic_templates" && normalizedIntent.preferDeterministic) score += 30;
  if (entry.configured === true) score += 15;
  if (entry.implementationState === "active_internal") score += 10;
  if (entry.implementationState === "research_backed_candidate") score -= 20;

  return { ...entry, eligible: reasons.length === 0, ready: reasons.length === 0 && setupReasons.length === 0, blockedReasons: reasons, setupReasons: [...new Set(setupReasons)], score, canExecuteFromPlanner: false };
}

function buildCreationPipeline(intent = {}, options = {}) {
  const selection = selectGenerationPathways(intent, options);
  const stages = [
    stage("plan", "Define objective, modality, audience, budget, privacy, rights and success criteria.", false),
    stage("create", "Choose one explicitly approved eligible generation/creation pathway and produce a draft artifact.", false),
    stage("quality_control", "Analyze the artifact for technical quality, policy, rights/provenance and requested constraints.", false),
    stage("revise", "Apply bounded edits or regenerate only with an explicitly selected eligible pathway.", false),
    stage("owner_review", "Present the final artifact, provenance, cost and material warnings for review.", true),
    stage("export_or_publish", "Export locally or hand off to an existing approval-gated publish/send workflow.", true)
  ];
  return { ok: selection.ok, mode: "staged_creation_pipeline", intent: selection.intent, candidatePathways: selection.pathways, stages, canExecuteFromPlanner: false, publishAuthorityGranted: false, automaticProviderFallback: false };
}

function hydratePathway(entry, providerState) {
  let configured = entry.configurationRequired === false;
  let readiness = configured ? "available" : "setup_required";
  if (entry.key === "hosted_fixed_provider") {
    configured = providerState.totalConfiguredProviderCount > 0;
    readiness = configured ? "configured" : "setup_required";
  } else if (["managed_gpu_worker", "self_hosted_generation_worker"].includes(entry.key)) {
    configured = providerState.openMediaWorkerConfigured === true;
    readiness = configured ? "worker_contract_configured" : "worker_backend_required";
  } else if (entry.implementationState === "research_backed_candidate") {
    configured = false;
    readiness = "research_only_not_connected";
  } else if (entry.key === "hybrid_staged_pipeline") {
    configured = true;
    readiness = "planning_available_execution_stage_specific";
  }
  return { ...copy(entry), configured, readiness, canExecuteFromPlanner: false, humanReviewRequired: true, explicitSelectionRequired: entry.externalSpend || entry.modelBacked || entry.runtimeLane === "owner_device" };
}

function summarizeHostedTextReadiness(state = {}) {
  const providers = ["openai", "anthropic"].map((key) => {
    const item = state[key] || {};
    const configured = item.enabled === true && item.status === "configured";
    return { key, configured, status: item.status || "unknown" };
  });
  return { configuredCount: providers.filter((item) => item.configured).length, configuredModalities: providers.some((item) => item.configured) ? ["text", "document"] : [], providers };
}

function summarizeProviderCatalog(catalog = [], hostedTextState = summarizeHostedTextReadiness()) {
  const providers = catalog.map((provider) => ({ key: provider.key, label: provider.label, adapterMode: provider.adapterMode, integrationStatus: provider.integrationStatus, capabilities: [...(provider.capabilities || [])], configured: provider.readiness?.configured === true, readinessStatus: provider.readiness?.status || "unknown" }));
  const selectable = providers.filter((provider) => provider.adapterMode !== "reference_only");
  const configuredCreatorProviders = selectable.filter((provider) => provider.configured);
  const configuredModalities = new Set(hostedTextState.configuredModalities || []);
  for (const provider of configuredCreatorProviders) {
    for (const capability of provider.capabilities) {
      for (const modality of capabilityToModalities(capability)) configuredModalities.add(modality);
    }
  }
  return {
    providerCount: providers.length,
    selectableProviderCount: selectable.length,
    configuredProviderCount: configuredCreatorProviders.length,
    hostedTextConfiguredCount: hostedTextState.configuredCount || 0,
    totalConfiguredProviderCount: configuredCreatorProviders.length + Number(hostedTextState.configuredCount || 0),
    configuredModalities: [...configuredModalities],
    openMediaWorkerConfigured: providers.find((provider) => provider.key === "open_source_media_worker")?.configured === true,
    hostedTextProviders: hostedTextState.providers.map(copy),
    providers
  };
}

function capabilityToModalities(capability) {
  const value = String(capability || "").toLowerCase();
  const modalities = new Set();
  if (/music/.test(value)) modalities.add("music");
  if (/speech_to_text|transcri|caption/.test(value)) modalities.add("transcription");
  if (/text_to_speech|speech_to_speech|voice|tts/.test(value)) modalities.add("speech");
  if (/audio|sound/.test(value)) modalities.add("audio");
  if (/video/.test(value)) modalities.add("video");
  if (/image/.test(value)) modalities.add("image");
  if (/three_d|3d/.test(value)) modalities.add("three_d");
  if (/text_generation|draft|document|copywriting|business_drafting/.test(value)) modalities.add("text");
  if (modalities.size > 1) modalities.add("multimodal");
  return [...modalities];
}

function normalizeIntent(intent = {}) {
  const modality = GENERATION_MODALITIES.includes(String(intent.modality || "text")) ? String(intent.modality || "text") : "multimodal";
  return { modality, localOnly: intent.localOnly === true, deterministicOnly: intent.deterministicOnly === true, preferLocal: intent.preferLocal === true || intent.localOnly === true, preferLowerCost: intent.preferLowerCost !== false, preferDeterministic: intent.preferDeterministic !== false, rightsApproved: intent.rightsApproved === true, allowExternalCompanion: intent.allowExternalCompanion === true, allowResearchCandidates: intent.allowResearchCandidates === true, maxExternalSpend: Number.isFinite(Number(intent.maxExternalSpend)) ? Number(intent.maxExternalSpend) : null };
}

function pathway(input) {
  return Object.freeze({ executionAuthority: "none_from_planner", canExecuteFromPlanner: false, humanReviewRequired: true, ...input, modalities: Object.freeze([...(input.modalities || [])]), examples: Object.freeze([...(input.examples || [])]), notes: Object.freeze([...(input.notes || [])]) });
}

function alternative(input) {
  return Object.freeze({ executionAuthority: "none_from_research", enabledByPlanner: false, canExecuteFromPlanner: false, humanReviewRequired: true, ...input, capabilities: Object.freeze([...(input.capabilities || [])]) });
}

function stage(key, description, approvalRequired) {
  return { key, description, approvalRequired, executionAuthority: "none_from_planner" };
}

function copy(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(copy);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
}

module.exports = {
  GENERATION_MODALITIES,
  GENERATION_PATHWAYS,
  RESEARCH_BACKED_ALTERNATIVES,
  getGenerationPathwayPlan,
  selectGenerationPathways,
  evaluatePathway,
  buildCreationPipeline,
  summarizeProviderCatalog,
  summarizeHostedTextReadiness,
  capabilityToModalities,
  normalizeIntent
};
