"use strict";

const PROVIDERS = Object.freeze([
  cloud({
    key: "elevenlabs",
    label: "ElevenLabs",
    officialUrl: "https://elevenlabs.io/docs/api-reference/introduction",
    adapterMode: "direct_http",
    capabilities: ["text_to_speech", "speech_to_speech", "sound_effects", "text_to_music", "music_plan", "video_to_music"],
    enabledEnv: "ELEVENLABS_ENABLED",
    requiredEnv: ["ELEVENLABS_API_KEY"],
    baseUrlEnv: "ELEVENLABS_BASE_URL",
    defaultBaseUrl: "https://api.elevenlabs.io",
    license: "Commercial API terms; generated-output rights depend on the account plan and product terms.",
    risk: "high",
    notes: [
      "Credentials remain server-side.",
      "Voice conversion requires documented consent for the source and target voice.",
      "Music prompts must remain original and must not request protected song or artist imitation.",
      "C2PA signing should be enabled where supported for publishable music outputs."
    ]
  }),
  cloud({
    key: "google_veo",
    label: "Google Veo / Gemini video",
    officialUrl: "https://ai.google.dev/gemini-api/docs/video",
    adapterMode: "long_running_http",
    capabilities: ["text_to_video", "image_to_video", "video_extend", "first_last_frame_video", "native_audio_video"],
    enabledEnv: "GOOGLE_VEO_ENABLED",
    requiredEnv: ["GEMINI_API_KEY"],
    baseUrlEnv: "GOOGLE_VEO_BASE_URL",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelEnv: "GOOGLE_VEO_MODEL",
    defaultModel: "veo-3.1-generate-preview",
    license: "Google API and generated-media terms apply.",
    risk: "high",
    notes: [
      "Generation is asynchronous and must be polled by operation name.",
      "Reference images and videos must be owned or licensed by the customer.",
      "Generated outputs should retain provider provenance and watermark metadata."
    ]
  }),
  cloud({
    key: "suno",
    label: "Suno Platform",
    officialUrl: "https://platform.suno.com/",
    adapterMode: "account_contract_http",
    capabilities: ["text_to_music", "song_cover", "song_mashup", "music_voice_profile"],
    enabledEnv: "SUNO_ENABLED",
    requiredEnv: ["SUNO_API_KEY", "SUNO_API_BASE_URL", "SUNO_GENERATE_PATH", "SUNO_STATUS_PATH_TEMPLATE"],
    baseUrlEnv: "SUNO_API_BASE_URL",
    license: "Suno Platform/API and account-plan terms apply.",
    risk: "high",
    notes: [
      "The official platform advertises a REST API, but endpoint contracts are account-gated and must be copied from the operator's current Suno developer documentation.",
      "SONARA does not guess undocumented endpoints.",
      "Voice features require explicit consent and rights evidence."
    ]
  }),
  external({
    key: "higgsfield",
    label: "Higgsfield",
    officialUrl: "https://higgsfield.ai/",
    adapterMode: "external_mcp",
    capabilities: ["text_to_video", "image_to_video", "talking_avatar", "explainer_video", "ad_video", "scene_orchestration"],
    integrationEndpoint: "https://mcp.higgsfield.ai",
    license: "Higgsfield subscription, model-provider, and MCP terms apply.",
    risk: "high",
    notes: [
      "Higgsfield documents an MCP connector rather than a stable public REST contract for this Express runtime.",
      "Jobs are recorded as manual-required until an approved server-side MCP client is deployed.",
      "Customer credentials must stay with Higgsfield or an approved secret vault."
    ]
  }),
  cloud({
    key: "open_source_media_worker",
    label: "SONARA Open Media Worker",
    officialUrl: "https://github.com/comfy-org/ComfyUI",
    adapterMode: "canonical_worker_http",
    capabilities: ["text_to_video", "image_to_video", "video_to_video", "text_to_music", "text_to_audio", "text_to_speech", "speech_to_speech", "reference_analysis"],
    enabledEnv: "CREATOR_MEDIA_WORKER_ENABLED",
    requiredEnv: ["CREATOR_MEDIA_WORKER_URL", "CREATOR_MEDIA_WORKER_TOKEN"],
    baseUrlEnv: "CREATOR_MEDIA_WORKER_URL",
    license: "Each selected engine and model has an independent license; activation requires a recorded license review.",
    risk: "high",
    notes: [
      "Runs outside the Vercel web process on an isolated GPU worker.",
      "The canonical contract is POST /v1/jobs and GET /v1/jobs/{id}.",
      "Model downloads, weights, and datasets are never bundled automatically."
    ]
  }),
  reference({
    key: "comfyui",
    label: "ComfyUI",
    repository: "comfy-org/ComfyUI",
    officialUrl: "https://github.com/comfy-org/ComfyUI",
    runtimeClass: "workflow_engine",
    capabilities: ["node_graphs", "image_generation", "video_generation", "audio_generation", "api_workflows"],
    license: "Repository license and every custom node/model license require review.",
    maturity: "worker_candidate"
  }),
  reference({
    key: "stable_audio_3",
    label: "Stable Audio 3",
    repository: "Stability-AI/stable-audio-3",
    officialUrl: "https://github.com/Stability-AI/stable-audio-3",
    runtimeClass: "model_family",
    capabilities: ["text_to_music", "text_to_audio", "fine_tuning"],
    license: "Code is MIT; model weights and commercial usage require separate review.",
    maturity: "worker_candidate"
  }),
  reference({
    key: "audiocraft",
    label: "AudioCraft / MusicGen / AudioGen",
    repository: "facebookresearch/audiocraft",
    officialUrl: "https://github.com/facebookresearch/audiocraft",
    runtimeClass: "research_framework",
    capabilities: ["text_to_music", "melody_conditioning", "text_to_sound", "audio_watermarking"],
    license: "Code is MIT; published model weights are CC-BY-NC 4.0 and are not approved for SONARA commercial generation.",
    maturity: "research_only"
  }),
  reference({
    key: "openvoice",
    label: "OpenVoice",
    repository: "myshell-ai/OpenVoice",
    officialUrl: "https://github.com/myshell-ai/OpenVoice",
    runtimeClass: "model_family",
    capabilities: ["voice_cloning", "cross_lingual_tts", "voice_style_control"],
    license: "MIT for V1/V2; consent and biometric/privacy review remain mandatory.",
    maturity: "worker_candidate"
  }),
  reference({
    key: "gpt_sovits",
    label: "GPT-SoVITS",
    repository: "RVC-Boss/GPT-SoVITS",
    officialUrl: "https://github.com/RVC-Boss/GPT-SoVITS",
    runtimeClass: "model_family",
    capabilities: ["few_shot_tts", "voice_conversion", "cross_lingual_tts", "dataset_preparation"],
    license: "Code is MIT; model, dataset, consent, and impersonation review remain mandatory.",
    maturity: "worker_candidate"
  }),
  reference({
    key: "ltx_2",
    label: "LTX-2",
    repository: "Lightricks/LTX-2",
    officialUrl: "https://github.com/Lightricks/LTX-2",
    runtimeClass: "model_family",
    capabilities: ["text_to_video", "image_to_video", "synchronized_audio_video", "keyframes", "lora_training"],
    license: "Code and model licenses must be reviewed independently before commercial activation.",
    maturity: "worker_candidate"
  }),
  reference({
    key: "wan_2_2",
    label: "Wan 2.2",
    repository: "Wan-Video/Wan2.2",
    officialUrl: "https://github.com/Wan-Video/Wan2.2",
    runtimeClass: "model_family",
    capabilities: ["text_to_video", "image_to_video", "speech_to_video", "character_animation"],
    license: "Apache-2.0 code noted upstream; model and downstream component licenses require review.",
    maturity: "worker_candidate"
  }),
  reference({
    key: "hunyuan_video",
    label: "HunyuanVideo",
    repository: "Tencent-Hunyuan/HunyuanVideo",
    officialUrl: "https://github.com/Tencent-Hunyuan/HunyuanVideo",
    runtimeClass: "model_family",
    capabilities: ["text_to_video", "image_to_video", "avatar_animation", "customized_video"],
    license: "Tencent model license and usage restrictions require qualified review.",
    maturity: "research_only"
  }),
  reference({
    key: "cogvideox",
    label: "CogVideoX",
    repository: "zai-org/CogVideo",
    officialUrl: "https://github.com/THUDM/CogVideo",
    runtimeClass: "model_family",
    capabilities: ["text_to_video", "image_to_video", "video_to_video", "quantized_inference"],
    license: "Code is Apache-2.0; model variants use different licenses and require review.",
    maturity: "worker_candidate"
  })
]);

function cloud(record) {
  return Object.freeze({ runtimeClass: "cloud_provider", integrationStatus: "adapter_available", launchImpact: "optional", ...record });
}

function external(record) {
  return Object.freeze({ runtimeClass: "external_platform", integrationStatus: "connector_required", launchImpact: "optional", ...record });
}

function reference(record) {
  return Object.freeze({ adapterMode: "reference_only", integrationStatus: record.maturity, launchImpact: "optional", risk: "high", ...record, repoUrl: `https://github.com/${record.repository}` });
}

function parseEnabled(value) {
  return ["1", "true", "yes", "on", "enabled"].includes(String(value || "").trim().toLowerCase());
}

function getProvider(key) {
  return PROVIDERS.find((item) => item.key === String(key || "").trim()) || null;
}

function getProviderReadiness(provider, env = process.env) {
  if (!provider) return { configured: false, status: "provider_not_found", missing: [] };
  if (provider.adapterMode === "reference_only") return { configured: false, status: provider.maturity || "reference_only", missing: [] };
  if (provider.adapterMode === "external_mcp") return { configured: false, status: "external_mcp_required", missing: [] };
  const enabled = parseEnabled(env[provider.enabledEnv]);
  const missing = (provider.requiredEnv || []).filter((key) => !String(env[key] || "").trim());
  return {
    configured: enabled && missing.length === 0,
    enabled,
    status: !enabled ? "disabled" : missing.length ? "setup_required" : "configured",
    missing,
    baseUrlHost: safeHost(env[provider.baseUrlEnv] || provider.defaultBaseUrl),
    model: provider.modelEnv ? String(env[provider.modelEnv] || provider.defaultModel || "") : null
  };
}

function getCreatorGenerationCatalog(env = process.env) {
  return PROVIDERS.map((provider) => ({
    key: provider.key,
    label: provider.label,
    officialUrl: provider.officialUrl,
    repository: provider.repository || null,
    repoUrl: provider.repoUrl || null,
    runtimeClass: provider.runtimeClass,
    adapterMode: provider.adapterMode,
    integrationStatus: provider.integrationStatus,
    capabilities: [...provider.capabilities],
    license: provider.license,
    risk: provider.risk,
    notes: [...(provider.notes || [])],
    readiness: getProviderReadiness(provider, env)
  }));
}

function chooseProvider(capability, requestedKey, env = process.env) {
  if (requestedKey && requestedKey !== "auto") {
    const requested = getProvider(requestedKey);
    if (!requested || !requested.capabilities.includes(capability)) return { ok: false, code: "provider_capability_unavailable" };
    return { ok: true, provider: requested, readiness: getProviderReadiness(requested, env) };
  }
  const candidates = PROVIDERS.filter((provider) => provider.capabilities.includes(capability));
  const configured = candidates.find((provider) => getProviderReadiness(provider, env).configured);
  const provider = configured || candidates[0];
  return provider ? { ok: true, provider, readiness: getProviderReadiness(provider, env) } : { ok: false, code: "capability_not_supported" };
}

function safeHost(value) {
  try { return new URL(String(value || "")).host || null; } catch { return null; }
}

module.exports = {
  CREATOR_GENERATION_PROVIDERS: PROVIDERS,
  getProvider,
  getProviderReadiness,
  getCreatorGenerationCatalog,
  chooseProvider,
  parseEnabled
};
