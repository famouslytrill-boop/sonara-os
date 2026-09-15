"use strict";

const { getUnifiedBatchConvergence, inferLicenseRisk } = require("./sonara-batch-convergence-engine.cjs");
const { getCreatorGenerationCatalog } = require("./creator-generation-provider-registry.cjs");
const { getPublicAIIntegrationCatalog } = require("./sonara-ai-integration-registry.cjs");
const { getRuntimeCapabilityPlan } = require("./sonara-runtime-capability-planner.cjs");

// Explicit runtime/engine candidates are the small set with a concrete SONARA
// placement decision. The convergence/open-source groups below still cover the
// complete maintained repository inventory, including tools that remain only
// reference/research/blocked records.
const ENGINE_CATALOG = Object.freeze([
  engine({ key: "sonara_local_rules", label: "SONARA deterministic local rules", kind: "deterministic_core", repository: null, license: "SONARA internal", adoptionStatus: "active_core", runtimeBoundary: "web_process", products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"], capabilities: ["record_checks", "readiness_logic", "policy_gates", "deterministic_assistance"] }),
  engine({ key: "openai_hosted_text", label: "OpenAI / ChatGPT hosted text provider", kind: "hosted_text_provider", repository: null, license: "External service contract", adoptionStatus: "available_with_setup", runtimeBoundary: "external_api", products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"], capabilities: ["governed_text_generation", "business_drafting"], restrictions: ["server-side credential only", "official OpenAI API host only", "explicit provider selection", "no silent paid-provider fallback", "current shipped authority is draft_content only", "research/control-plane records do not execute provider calls"] }),
  engine({ key: "anthropic_hosted_text", label: "Anthropic Claude hosted text provider", kind: "hosted_text_provider", repository: null, license: "External service contract", adoptionStatus: "available_with_setup", runtimeBoundary: "external_api", products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"], capabilities: ["governed_text_generation", "business_drafting"], restrictions: ["server-side credential only", "official Anthropic API host only", "explicit provider selection", "no silent paid-provider fallback", "current shipped authority is draft_content only", "research/control-plane records do not execute provider calls"] }),
  engine({ key: "sonara_open_media_worker", label: "SONARA Open Media Worker contract", kind: "worker_contract", repository: null, license: "SONARA internal adapter contract", adoptionStatus: "adapter_available_with_setup", runtimeBoundary: "isolated_worker", products: ["Creator Studio"], capabilities: ["text_to_video", "image_to_video", "video_to_video", "text_to_music", "text_to_audio", "text_to_speech", "speech_to_speech", "reference_analysis"] }),
  engine({ key: "comfyui", label: "ComfyUI", kind: "workflow_engine", repository: "Comfy-Org/ComfyUI", license: "GPL-3.0", adoptionStatus: "isolated_worker_review", runtimeBoundary: "isolated_gpu_worker", products: ["Creator Studio"], capabilities: ["node_graphs", "image_generation", "video_generation", "audio_generation", "api_workflows"], restrictions: ["GPL integration review required", "custom nodes and model weights require separate review", "not embedded in the hosted web process"] }),
  engine({ key: "ace_step_1_5", label: "ACE-Step 1.5", kind: "music_model_family", repository: "ace-step/ACE-Step-1.5", license: "MIT", adoptionStatus: "commercial_candidate_with_model_review", runtimeBoundary: "isolated_gpu_or_local_worker", products: ["Creator Studio"], capabilities: ["text_to_music", "full_song_generation", "music_editing_research"], restrictions: ["repository license is permissive; model-card/weight/dataset/output rights remain separately reviewable", "protected-artist imitation is not an approved product workflow"] }),
  engine({ key: "wan_2_2", label: "Wan 2.2", kind: "video_model_family", repository: "Wan-Video/Wan2.2", license: "Apache-2.0", adoptionStatus: "commercial_candidate_with_model_review", runtimeBoundary: "isolated_gpu_worker", products: ["Creator Studio"], capabilities: ["text_to_video", "image_to_video", "video_generation"], restrictions: ["model weights and downstream components require separate review", "input media rights and output provenance are required"] }),
  engine({ key: "qwen_image", label: "Qwen-Image", kind: "image_model_family", repository: "QwenLM/Qwen-Image", license: "Apache-2.0", adoptionStatus: "commercial_candidate_with_model_review", runtimeBoundary: "isolated_gpu_worker", products: ["Creator Studio"], capabilities: ["image_generation", "image_editing", "text_rendering_in_images"], restrictions: ["repository license is Apache-2.0; model-card, weights, datasets, media rights, and intended use still require release-time review"] }),
  engine({ key: "basic_pitch", label: "Basic Pitch", kind: "audio_analysis_engine", repository: "spotify/basic-pitch", license: "Apache-2.0", adoptionStatus: "commercial_candidate", runtimeBoundary: "python_or_local_worker", products: ["Creator Studio"], capabilities: ["audio_to_midi", "pitch_detection", "pitch_bend_detection"] }),
  engine({ key: "whisper_cpp", label: "whisper.cpp", kind: "speech_recognition_engine", repository: "ggml-org/whisper.cpp", license: "MIT", adoptionStatus: "commercial_candidate", runtimeBoundary: "local_or_isolated_worker", products: ["Creator Studio", "Files & Records"], capabilities: ["speech_to_text", "local_inference", "transcription"] }),
  engine({ key: "faster_whisper", label: "faster-whisper", kind: "speech_recognition_engine", repository: "SYSTRAN/faster-whisper", license: "MIT", adoptionStatus: "commercial_candidate", runtimeBoundary: "python_or_local_worker", products: ["Creator Studio", "Files & Records"], capabilities: ["speech_to_text", "timestamped_transcription", "caption_generation"] }),
  engine({ key: "demucs", label: "Demucs", kind: "audio_separation_engine", repository: "facebookresearch/demucs", license: "MIT", adoptionStatus: "archived_reference_choose_successor", runtimeBoundary: "python_or_local_worker", products: ["Creator Studio"], capabilities: ["stem_separation", "source_separation"], restrictions: ["canonical upstream is archived; do not create a new critical dependency without a maintained-successor decision"] }),
  engine({ key: "opentimelineio", label: "OpenTimelineIO", kind: "media_interchange", repository: "AcademySoftwareFoundation/OpenTimelineIO", license: "Apache-2.0", adoptionStatus: "commercial_candidate", runtimeBoundary: "library_or_worker", products: ["Creator Studio"], capabilities: ["timeline_interchange", "editorial_metadata", "nle_export"] }),
  engine({ key: "react_three_fiber", label: "React Three Fiber", kind: "web_3d_runtime", repository: "pmndrs/react-three-fiber", license: "MIT", adoptionStatus: "commercial_candidate", runtimeBoundary: "browser_runtime", products: ["Creator Studio", "Marketing/Product proof"], capabilities: ["realtime_3d", "interactive_product_visualization", "scene_composition"], restrictions: ["3D assets, textures, fonts, and downstream Three.js dependencies keep their own rights"] }),
  engine({ key: "blender", label: "Blender", kind: "external_3d_application", repository: "blender/blender", license: "GNU GPL", adoptionStatus: "external_companion", runtimeBoundary: "owner_device_or_isolated_render_worker", products: ["Creator Studio", "Internal development"], capabilities: ["3d_modeling", "animation", "rendering", "video_editing", "procedural_geometry"], restrictions: ["Blender is GPL; use as an external application/worker boundary rather than copying its source into SONARA hosted code"] }),
  engine({ key: "openjarvis", label: "OpenJarvis", kind: "personal_agent_runtime", repository: "open-jarvis/OpenJarvis", license: "Apache-2.0", adoptionStatus: "local_companion_research", runtimeBoundary: "owner_device", products: ["Founder operations", "Personal Agent OS"], capabilities: ["local_agent_runtime", "device_local_ai", "personal_workflows"], restrictions: ["not a customer web-process dependency", "device permissions remain local and explicit"] }),
  engine({ key: "ui_tars", label: "UI-TARS Desktop / Agent TARS", kind: "computer_use_agent", repository: "bytedance/UI-TARS-desktop", license: "Apache-2.0", adoptionStatus: "operator_research_only", runtimeBoundary: "owner_device_or_isolated_desktop", products: ["Founder operations", "Internal development"], capabilities: ["computer_use", "browser_use", "mcp", "multimodal_agent"], restrictions: ["no unattended customer-account actions", "requires explicit target/action approval and isolated credentials"] }),
  engine({ key: "obs_studio", label: "OBS Studio", kind: "capture_companion", repository: "obsproject/obs-studio", license: "GPL-2.0", adoptionStatus: "external_companion", runtimeBoundary: "owner_device", products: ["Creator Studio", "Founder operations"], capabilities: ["screen_recording", "streaming", "capture"], restrictions: ["treat as external companion; do not copy GPL code into SONARA hosted application"] })
]);

function getModelEngineControlPlane() {
  const convergence = getUnifiedBatchConvergence();
  // Public metadata must never inherit server configuration key names from the
  // static readiness object. Live readiness already has a separate admin-only
  // surface. Use the deliberately sanitized public integration catalog here.
  const aiIntegrations = getPublicAIIntegrationCatalog();
  const creatorProviders = getCreatorGenerationCatalog().map(sanitizeCreatorProvider);
  const openSource = classifyCommercialOpenSource(convergence.repositories);
  const runtimePlan = getRuntimeCapabilityPlan({ convergence });
  return {
    ok: true,
    dataSource: "repository_static_metadata",
    mode: "governed_model_engine_control_plane",
    engineCount: ENGINE_CATALOG.length,
    engines: ENGINE_CATALOG.map(clone),
    repositoryInventoryCount: convergence.counts.uniqueRepositoryResearch,
    existingRuntimeAdapters: {
      aiIntegrations,
      creatorGenerationProviders: creatorProviders
    },
    runtimeCapabilityPlan: {
      mode: runtimePlan.mode,
      sourceRepositoryCount: runtimePlan.sourceRepositoryCount,
      runtimeLanes: [...runtimePlan.runtimeLanes],
      adoptionTiers: [...runtimePlan.adoptionTiers],
      counts: clone(runtimePlan.counts),
      productCounts: Object.fromEntries(Object.entries(runtimePlan.productPlans).map(([product, records]) => [product, records.length])),
      promotionPolicy: clone(runtimePlan.promotionPolicy),
      boundaries: [...runtimePlan.boundaries]
    },
    openSource,
    boundaries: [
      "The explicit engine catalog is a placement/architecture shortlist; the open-source groups cover the full converged repository inventory.",
      "The research-to-runtime planner classifies the complete converged repository collection by product, runtime lane, rights, and adoption tier without granting execution authority.",
      "The control plane is policy and readiness metadata; it does not download models, install repositories, or widen provider credentials.",
      "Permissive repository licenses do not automatically grant model-weight, dataset, trademark, media-rights, privacy, or customer-data permissions.",
      "Copyleft projects stay isolated or external until legal/architecture review approves the deployment boundary.",
      "Commercial-use status from the formal registry is enforced separately from license text; low-risk licensing alone does not make a blocked/review-only repository adoptable.",
      "All customer-affecting actions remain tenant-scoped, auditable, bounded, and approval-controlled."
    ]
  };
}

function sanitizeCreatorProvider(provider = {}) {
  return {
    key: provider.key,
    label: provider.label,
    capabilities: [...(provider.capabilities || [])],
    enabled: provider.enabled === true,
    configured: provider.configured === true,
    status: provider.status || provider.configurationStatus || "unknown",
    humanReviewRequired: true
  };
}

function classifyCommercialOpenSource(repositories = []) {
  const groups = { permissiveCandidates: [], copyleftReview: [], blockedOrUnknown: [], researchOnly: [] };
  for (const record of repositories) {
    const risk = String(record.licenseRisk || inferLicenseRisk(record.license));
    const status = String(record.integrationStatus || "research_only");
    const commercial = String(record.commercialUseStatus || "needs_review");
    const license = String(record.license || "NOASSERTION");
    const summary = {
      repository: record.repository,
      license,
      licenseRisk: risk,
      commercialUseStatus: commercial,
      integrationStatus: status,
      seenInBatches: [...(record.seenInBatches || [])],
      sourceRecordCount: Array.isArray(record.sourceRecords) ? record.sourceRecords.length : 0,
      nextStep: record.nextStep || null
    };

    const isBlocked = !record.repositoryVerified || /blocked|quarantined/i.test(status) || /blocked/i.test(commercial) || /NOASSERTION|UNKNOWN|UNVERIFIED/i.test(license);
    const isCopyleft = /AGPL|GPL|MPL/i.test(license);
    const isPermissive = risk === "low" && /MIT|Apache|BSD|CC0|PostgreSQL/i.test(license);
    const commercialAllowed = /^(allowed|allowed_after_review)$/i.test(commercial);

    if (isBlocked) groups.blockedOrUnknown.push(summary);
    else if (isCopyleft) groups.copyleftReview.push(summary);
    else if (isPermissive && commercialAllowed) groups.permissiveCandidates.push(summary);
    else groups.researchOnly.push(summary);
  }
  return {
    permissiveCandidateCount: groups.permissiveCandidates.length,
    copyleftReviewCount: groups.copyleftReview.length,
    blockedOrUnknownCount: groups.blockedOrUnknown.length,
    researchOnlyCount: groups.researchOnly.length,
    ...groups
  };
}

function engine(input) {
  return Object.freeze({
    enabledByControlPlane: false,
    canExecuteFromRegistry: false,
    humanReviewRequired: true,
    ...input,
    products: Object.freeze([...(input.products || [])]),
    capabilities: Object.freeze([...(input.capabilities || [])]),
    restrictions: Object.freeze([...(input.restrictions || [])])
  });
}

function clone(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

module.exports = {
  ENGINE_CATALOG,
  getModelEngineControlPlane,
  classifyCommercialOpenSource
};
