"use strict";

const DEFAULT_HUB_URL = "https://huggingface.co";
const DEFAULT_PROBE_TIMEOUT_MS = 1800;
const MAX_PROBE_TIMEOUT_MS = 5000;

const HUGGINGFACE_RESOURCES = Object.freeze([
  model({
    key: "bge_small_en_v15",
    label: "BGE Small English v1.5",
    resourceId: "BAAI/bge-small-en-v1.5",
    task: "text-embeddings",
    license: "MIT",
    commercialUse: "permissive",
    runtimeClass: "embedding_worker",
    adoptionStatus: "pilot_ready",
    productFit: ["All studios", "Files & Records", "Search"],
    capabilities: ["semantic search", "similarity", "RAG indexing"],
    metadata: { parameters: "33.4M", safetensors: true, teiSupported: true, languages: ["en"] },
    safety: ["Embed tenant-authorized text only.", "Keep vectors tenant-scoped.", "Pin an immutable revision before deployment."],
    nextStep: "Pilot on a CPU-isolated Text Embeddings Inference worker against SONARA search evaluations."
  }),
  model({
    key: "qwen3_embedding_06b",
    label: "Qwen3 Embedding 0.6B",
    resourceId: "Qwen/Qwen3-Embedding-0.6B",
    task: "text-embeddings",
    license: "Apache-2.0",
    commercialUse: "permissive",
    runtimeClass: "embedding_worker",
    adoptionStatus: "evaluation",
    productFit: ["All studios", "Multilingual search", "Research Lab"],
    capabilities: ["multilingual embeddings", "long-text retrieval", "semantic search"],
    metadata: { parameters: "0.6B", safetensors: true, teiSupported: true, multilingual: true },
    safety: ["Benchmark cost and latency against BGE Small before adoption.", "Use deterministic chunking and tenant isolation.", "Pin model and tokenizer revisions."],
    nextStep: "Evaluate only if multilingual retrieval quality materially exceeds the smaller BGE pilot."
  }),
  model({
    key: "bge_reranker_v2_m3",
    label: "BGE Reranker v2 M3",
    resourceId: "BAAI/bge-reranker-v2-m3",
    task: "text-ranking",
    license: "Apache-2.0",
    commercialUse: "permissive",
    runtimeClass: "reranker_worker",
    adoptionStatus: "pilot_ready",
    productFit: ["Search", "Research Lab", "Files & Records"],
    capabilities: ["query-document reranking", "multilingual relevance scoring"],
    metadata: { safetensors: true, teiSupported: true, multilingual: true },
    safety: ["Rerank only records already authorized for the requesting tenant.", "Do not treat ranking scores as factual truth.", "Retain retrieval audit metadata."],
    nextStep: "Run offline retrieval benchmarks after the embedding pilot; do not place it in the synchronous web process."
  }),
  model({
    key: "qwen3_4b",
    label: "Qwen3 4B",
    resourceId: "Qwen/Qwen3-4B",
    task: "text-generation",
    license: "Apache-2.0",
    commercialUse: "permissive",
    runtimeClass: "text_generation_worker",
    adoptionStatus: "evaluation",
    productFit: ["Business Builder", "Creator Studio", "Growth Studio", "Private model mode"],
    capabilities: ["draft generation", "structured extraction", "reasoning assistance"],
    metadata: { parameters: "4B", safetensors: true, tgiCompatible: true },
    safety: ["Generated output remains untrusted until validated.", "No autonomous billing, publishing, deletion, or legal decisions.", "Use schema validation and human approval."],
    nextStep: "Evaluate in an isolated model gateway with deterministic SONARA validation and no production write tools."
  }),
  model({
    key: "phi4_mini_instruct",
    label: "Phi-4 Mini Instruct",
    resourceId: "microsoft/Phi-4-mini-instruct",
    task: "text-generation",
    license: "MIT",
    commercialUse: "permissive",
    runtimeClass: "text_generation_worker",
    adoptionStatus: "review_required",
    productFit: ["Private model mode", "Internal assistance", "Multilingual drafting"],
    capabilities: ["instruction following", "long-context drafting", "multilingual text"],
    metadata: { parameters: "3.8B", context: "128K", safetensors: true, trustRemoteCode: true },
    safety: ["Do not enable trust_remote_code in a trusted production process.", "Vendor and review custom model code in an isolated image.", "Treat the June 2024 knowledge cutoff as stale for current facts."],
    nextStep: "Security-review custom code before any isolated evaluation; otherwise prefer a standard-architecture model."
  }),
  model({
    key: "granite_docling_258m",
    label: "Granite Docling 258M",
    resourceId: "ibm-granite/granite-docling-258M",
    task: "document-parsing",
    license: "Apache-2.0",
    commercialUse: "permissive",
    runtimeClass: "document_worker",
    adoptionStatus: "pilot_ready",
    productFit: ["Business Builder", "Files & Records", "Invoices", "Reports"],
    capabilities: ["OCR", "layout parsing", "tables", "formulas", "document structure"],
    metadata: { parameters: "258M", safetensors: true, modalities: ["image", "text"] },
    safety: ["Scan and validate every uploaded file before processing.", "Use per-job temporary storage and strict size limits.", "Never expose extracted documents across tenants."],
    nextStep: "Pilot receipt, invoice, menu, and contract extraction in a queue-backed document worker."
  }),
  model({
    key: "whisper_large_v3_turbo",
    label: "Whisper Large v3 Turbo",
    resourceId: "openai/whisper-large-v3-turbo",
    task: "automatic-speech-recognition",
    license: "MIT",
    commercialUse: "permissive",
    runtimeClass: "speech_worker",
    adoptionStatus: "pilot_ready",
    productFit: ["Creator Studio", "Meeting imports", "Voice interface", "Accessibility"],
    capabilities: ["speech transcription", "multilingual ASR", "timestamps"],
    metadata: { parameters: "0.8B", safetensors: true, languages: 99, approximateWeights: "1.62GB" },
    safety: ["Require recording consent and lawful collection.", "Do not retain raw audio longer than needed.", "Redact sensitive information before downstream use where required."],
    nextStep: "Pilot asynchronous transcription on user-uploaded audio with consent records and deletion controls."
  }),
  model({
    key: "kokoro_82m",
    label: "Kokoro 82M",
    resourceId: "hexgrad/Kokoro-82M",
    task: "text-to-speech",
    license: "Apache-2.0",
    commercialUse: "permissive",
    runtimeClass: "tts_worker",
    adoptionStatus: "review_required",
    productFit: ["Voice interface", "Accessibility", "Creator previews"],
    capabilities: ["text-to-speech", "multilingual voices", "low-cost local synthesis"],
    metadata: { parameters: "82M", safetensors: false, pickleWeights: true },
    safety: ["Do not imitate a real person without explicit authorization.", "Disclose synthesized speech where appropriate.", "Load legacy pickle weights only inside a locked-down worker after hash verification."],
    nextStep: "Prefer an ONNX or reviewed safe-weight build and add voice-consent and provenance controls before pilot use."
  }),
  model({
    key: "gliner_multi_pii_v1",
    label: "GLiNER Multilingual PII v1",
    resourceId: "urchade/gliner_multi_pii-v1",
    task: "pii-detection",
    license: "Apache-2.0",
    commercialUse: "permissive",
    runtimeClass: "pii_worker",
    adoptionStatus: "review_required",
    productFit: ["Files & Records", "Support", "Meeting imports", "Privacy"],
    capabilities: ["PII entity detection", "multilingual redaction assistance"],
    metadata: { languages: ["en", "fr", "de", "es", "pt", "it"], safetensors: false, pickleWeights: true },
    safety: ["PII detection is probabilistic and cannot replace access control.", "Measure false negatives on SONARA-specific data.", "Load weights only in an isolated, hash-pinned worker."],
    nextStep: "Evaluate as a redaction assistant with mandatory rule-based checks and human review."
  }),
  model({
    key: "siglip2_base_224",
    label: "SigLIP 2 Base 224",
    resourceId: "google/siglip2-base-patch16-224",
    task: "image-text-retrieval",
    license: "Apache-2.0",
    commercialUse: "permissive",
    runtimeClass: "vision_worker",
    adoptionStatus: "evaluation",
    productFit: ["Creator Studio", "Asset search", "Catalog tagging"],
    capabilities: ["image-text embeddings", "zero-shot image classification", "asset retrieval"],
    metadata: { safetensors: true, approximateRepositorySize: "1.54GB" },
    safety: ["Do not infer sensitive traits about people.", "Use only for content and asset organization.", "Test labeling bias before customer-facing use."],
    nextStep: "Evaluate for creator-asset search and duplicate discovery, not identity or eligibility decisions."
  }),
  model({
    key: "clap_htsat_unfused",
    label: "CLAP HTSAT Unfused",
    resourceId: "laion/clap-htsat-unfused",
    task: "audio-text-embeddings",
    license: "Apache-2.0",
    commercialUse: "permissive",
    runtimeClass: "audio_embedding_worker",
    adoptionStatus: "review_required",
    productFit: ["Creator Studio", "Audio search", "Sound tagging"],
    capabilities: ["audio-text similarity", "audio embeddings", "semantic sound search"],
    metadata: { approximateRepositorySize: "618MB", safetensors: false, pickleWeights: true },
    safety: ["Do not use similarity scores to assert ownership or copyright clearance.", "Hash-pin and isolate legacy weight loading.", "Evaluate music and speech bias separately."],
    nextStep: "Evaluate on SONARA-owned audio only after safe serialization or isolated loading review."
  }),
  model({
    key: "flux1_schnell",
    label: "FLUX.1 Schnell",
    resourceId: "black-forest-labs/FLUX.1-schnell",
    task: "text-to-image",
    license: "Apache-2.0",
    commercialUse: "permissive",
    runtimeClass: "image_generation_worker",
    adoptionStatus: "review_required",
    productFit: ["Creator Studio", "Marketing concepts", "Draft artwork"],
    capabilities: ["text-to-image generation", "rapid concept rendering"],
    metadata: { parameters: "12B", safetensors: true, gated: true, approximateWeights: "23.8GB" },
    safety: ["Require content moderation and human approval before publication.", "Store prompt, model revision, and provenance metadata.", "Do not generate deceptive identity, non-consensual, or rights-violating content."],
    nextStep: "Use a managed or isolated GPU endpoint only after gated-access, cost, rights, and moderation review."
  }),
  model({
    key: "phi4_multimodal",
    label: "Phi-4 Multimodal Instruct",
    resourceId: "microsoft/Phi-4-multimodal-instruct",
    task: "multimodal-assistance",
    license: "MIT",
    commercialUse: "permissive",
    runtimeClass: "multimodal_worker",
    adoptionStatus: "review_required",
    productFit: ["Research Lab", "Document and audio experiments", "Accessibility"],
    capabilities: ["speech recognition", "speech summarization", "visual question answering", "multimodal text generation"],
    metadata: { approximateRepositorySize: "12.9GB", safetensors: true, trustRemoteCode: true },
    safety: ["Custom remote code must never execute in the production web process.", "Separate speech and vision evaluations by consent and data class.", "Do not use for biometric or high-impact decisions."],
    nextStep: "Keep research-only until custom-code review shows a material advantage over specialized workers."
  }),
  model({
    key: "stable_audio_open_10",
    label: "Stable Audio Open 1.0",
    resourceId: "stabilityai/stable-audio-open-1.0",
    task: "text-to-audio",
    license: "Stability AI Community License",
    commercialUse: "conditional",
    runtimeClass: "audio_generation_worker",
    adoptionStatus: "license_review",
    productFit: ["Creator Studio", "Sound-effect concepts"],
    capabilities: ["text-to-audio", "short music and sound generation"],
    metadata: { safetensors: true, gated: true, commercialThreshold: "$1,000,000 annual revenue", registrationRequired: true },
    safety: ["Legal review is required before commercial activation.", "Comply with attribution, registration, revenue threshold, and acceptable-use terms.", "Track generated-audio provenance and rights review."],
    nextStep: "Do not enable until counsel approves the current license and required product attribution."
  }),
  model({
    key: "musicgen_small",
    label: "MusicGen Small",
    resourceId: "facebook/musicgen-small",
    task: "text-to-music",
    license: "CC-BY-NC-4.0 model weights",
    commercialUse: "noncommercial",
    runtimeClass: "audio_generation_worker",
    adoptionStatus: "blocked_commercial",
    productFit: ["Research Lab only"],
    capabilities: ["text-to-music", "audio-conditioned music generation"],
    metadata: { parameters: "300M", safetensors: true },
    safety: ["Model weights are noncommercial.", "Do not expose in paid SONARA products.", "Do not use outputs as proof of rights clearance."],
    nextStep: "Retain only as a research comparison; select a commercially compatible alternative for production."
  }),
  model({
    key: "mert_v1_95m",
    label: "MERT v1 95M",
    resourceId: "m-a-p/MERT-v1-95M",
    task: "music-understanding",
    license: "CC-BY-NC-4.0",
    commercialUse: "noncommercial",
    runtimeClass: "audio_embedding_worker",
    adoptionStatus: "blocked_commercial",
    productFit: ["Research Lab only"],
    capabilities: ["music feature extraction", "music representation learning"],
    metadata: { parameters: "95M", trustRemoteCode: true, safetensors: false },
    safety: ["Noncommercial license blocks paid product use.", "Custom remote code adds supply-chain risk.", "Do not install in production."],
    nextStep: "Use only for offline comparison on authorized audio, or replace with a permissively licensed model."
  }),

  dataset({
    key: "banking77",
    label: "BANKING77",
    resourceId: "PolyAI/banking77",
    task: "intent-classification",
    license: "CC-BY-4.0",
    commercialUse: "permissive_with_attribution",
    adoptionStatus: "evaluation",
    productFit: ["Business Builder", "Support", "Voice interface"],
    capabilities: ["fine-grained customer-service intent evaluation"],
    metadata: { rows: 13083, intents: 77, language: "en" },
    safety: ["Use for evaluation or controlled fine-tuning only.", "Preserve attribution.", "Do not assume banking intents represent SONARA users or domains."],
    nextStep: "Map a subset of intents to SONARA support taxonomy and use it as a benchmark, not production customer data."
  }),
  dataset({
    key: "minds14",
    label: "MInDS-14",
    resourceId: "PolyAI/minds14",
    task: "spoken-intent-detection",
    license: "CC-BY-4.0",
    commercialUse: "permissive_with_attribution",
    adoptionStatus: "evaluation",
    productFit: ["Voice interface", "Business Builder", "Accessibility"],
    capabilities: ["multilingual spoken-intent evaluation", "ASR and intent testing"],
    metadata: { languages: 14, approximateSize: "1.13GB" },
    safety: ["Preserve attribution and dataset notices.", "Use evaluation splits without mixing them into customer records.", "Measure accent and language performance separately."],
    nextStep: "Use selected language subsets to benchmark voice intent routing and error rates."
  }),
  dataset({
    key: "fleurs",
    label: "FLEURS",
    resourceId: "google/fleurs",
    task: "multilingual-speech-evaluation",
    license: "CC-BY-4.0",
    commercialUse: "permissive_with_attribution",
    adoptionStatus: "evaluation",
    productFit: ["Voice interface", "Accessibility", "Research Lab"],
    capabilities: ["multilingual ASR evaluation", "language coverage testing"],
    metadata: { languages: 102, approximateSize: "878GB", streamingRequired: true },
    safety: ["Stream narrowly scoped subsets; never mirror the full dataset into production.", "Preserve attribution.", "Read speech may not represent noisy real-world audio."],
    nextStep: "Use small streamed validation subsets for supported-language ASR benchmarking."
  }),
  dataset({
    key: "mmlu",
    label: "MMLU",
    resourceId: "cais/mmlu",
    task: "general-knowledge-evaluation",
    license: "MIT",
    commercialUse: "permissive",
    adoptionStatus: "evaluation",
    productFit: ["Research Lab", "Model gateway evaluation"],
    capabilities: ["multi-domain multiple-choice evaluation"],
    metadata: { domains: 57, approximateRepositorySize: "270MB" },
    safety: ["Use only as one evaluation signal.", "Do not market benchmark scores as product reliability.", "Keep test splits out of training and prompt tuning."],
    nextStep: "Add a small reproducible evaluation slice for candidate text models."
  }),
  dataset({
    key: "gsm8k",
    label: "GSM8K",
    resourceId: "openai/gsm8k",
    task: "reasoning-evaluation",
    license: "MIT",
    commercialUse: "permissive",
    adoptionStatus: "evaluation",
    productFit: ["Research Lab", "Formula system evaluation"],
    capabilities: ["multi-step arithmetic reasoning evaluation"],
    metadata: { rows: "8.5K", formats: ["parquet"] },
    safety: ["Keep evaluation data separate from training prompts.", "Verify final answers independently with deterministic calculators.", "Do not infer business accuracy from school-math performance."],
    nextStep: "Use test-only evaluation to compare model reasoning with SONARA deterministic formulas."
  }),
  dataset({
    key: "fineweb_edu",
    label: "FineWeb-Edu",
    resourceId: "HuggingFaceFW/fineweb-edu",
    task: "language-model-training-corpus",
    license: "ODC-By-1.0 plus Common Crawl terms",
    commercialUse: "conditional",
    adoptionStatus: "research_only",
    productFit: ["Research Lab only"],
    capabilities: ["large-scale educational web corpus"],
    metadata: { approximateSize: "5.84TB", rows: "1.53B", streamingRequired: true, unsafeFileReported: true },
    safety: ["Do not download or train on this corpus in the current SONARA stack.", "Web-scale provenance, privacy, copyright, and unsafe-file review are mandatory.", "Streaming access does not remove data-governance obligations."],
    nextStep: "Catalog only; do not ingest until a separate data-governance and training program exists."
  }),
  dataset({
    key: "funsd_layoutlmv2",
    label: "FUNSD LayoutLMv2 Variant",
    resourceId: "nielsr/FUNSD_layoutlmv2",
    task: "form-understanding-evaluation",
    license: "Unverified in retrieved dataset card",
    commercialUse: "unknown",
    adoptionStatus: "blocked_license_review",
    productFit: ["Document worker evaluation"],
    capabilities: ["annotated form layout evaluation"],
    metadata: { imagesResized: "224x224" },
    safety: ["Do not ingest until the original dataset license and redistribution terms are verified.", "Use synthetic SONARA forms as the default evaluation set."],
    nextStep: "Verify the authoritative source and license before any use."
  }),

  spec({ key: "model_cards", label: "Model Cards", sourceUrl: "https://huggingface.co/docs/hub/model-cards", task: "governance", capabilities: ["intended-use documentation", "limitations", "training data", "evaluation metadata"], nextStep: "Require a SONARA model card for every approved model revision." }),
  spec({ key: "dataset_cards", label: "Dataset Cards", sourceUrl: "https://huggingface.co/docs/hub/datasets-cards", task: "data-governance", capabilities: ["license metadata", "bias documentation", "dataset structure", "responsible-use context"], nextStep: "Require a dataset card and license record before ingestion." }),
  spec({ key: "safetensors", label: "Safetensors", sourceUrl: "https://huggingface.co/docs/safetensors/index", task: "model-serialization", capabilities: ["non-pickle tensor loading", "zero-copy reads", "partial tensor access"], nextStep: "Prefer Safetensors and reject unreviewed pickle weights in production workers." }),
  spec({ key: "hub_security", label: "Hub Security Scanning", sourceUrl: "https://huggingface.co/docs/hub/security", task: "supply-chain-security", capabilities: ["malware scanning", "pickle import scanning", "secret scanning", "signed commits"], nextStep: "Record scan state, source owner, revision, file hashes, and signature status before deployment." }),
  spec({ key: "hub_api", label: "Hub OpenAPI and REST API", sourceUrl: "https://huggingface.co/docs/hub/api", task: "metadata-integration", capabilities: ["model metadata", "dataset metadata", "repository revisions", "webhooks"], nextStep: "Use read-only metadata calls first; keep write scopes disabled." }),
  spec({ key: "transformers_js", label: "Transformers.js", sourceUrl: "https://huggingface.co/docs/transformers.js/en/index", task: "browser-inference", capabilities: ["ONNX browser inference", "NLP", "vision", "audio"], nextStep: "Allow only small reviewed ONNX models; never ship customer secrets or unrestricted model downloads to the browser." }),
  spec({ key: "text_embeddings_inference", label: "Text Embeddings Inference", sourceUrl: "https://huggingface.co/docs/text-embeddings-inference/en/index", task: "embedding-serving", capabilities: ["dynamic batching", "Safetensors loading", "OpenTelemetry", "Prometheus metrics"], nextStep: "Use TEI as the preferred isolated embedding service for the pilot." }),
  spec({ key: "inference_endpoints", label: "Inference Endpoints", sourceUrl: "https://huggingface.co/docs/inference-endpoints/about", task: "managed-inference", capabilities: ["managed engines", "autoscaling", "scale-to-zero", "private endpoints"], nextStep: "Compare managed endpoint cost and security against self-hosted workers before production." }),
  spec({ key: "dataset_streaming", label: "Datasets Streaming", sourceUrl: "https://huggingface.co/docs/datasets/stream", task: "dataset-access", capabilities: ["iterable streaming", "partial exploration", "large-dataset access"], nextStep: "Stream bounded evaluation subsets and enforce sample-count and byte limits." }),
  spec({ key: "croissant", label: "Croissant Dataset Metadata", sourceUrl: "https://huggingface.co/docs/dataset-viewer/croissant", task: "dataset-interoperability", capabilities: ["JSON-LD metadata", "schema.org dataset description", "Parquet distributions"], nextStep: "Store Croissant metadata snapshots for approved dataset revisions." })
]);

function model(input) { return resource("model", input); }
function dataset(input) { return resource("dataset", { runtimeClass: "dataset_evaluation", ...input }); }
function spec(input) {
  return resource("spec", {
    resourceId: input.key,
    license: "Documentation/reference specification",
    commercialUse: "metadata_only",
    runtimeClass: "platform_spec",
    adoptionStatus: "spec_adopted",
    productFit: ["Platform governance"],
    safety: ["Specifications inform SONARA-owned implementation; external code is not automatically executed."],
    metadata: {},
    ...input
  });
}

function resource(resourceType, input) {
  return Object.freeze({
    resourceType,
    executionEnabled: false,
    humanReviewRequired: true,
    sourceUrl: input.sourceUrl || `https://huggingface.co/${resourceType === "dataset" ? "datasets/" : ""}${input.resourceId}`,
    ...input
  });
}

function getPublicHuggingFaceCatalog() {
  return HUGGINGFACE_RESOURCES.map((item) => ({
    key: item.key,
    label: item.label,
    resourceType: item.resourceType,
    resourceId: item.resourceId,
    sourceUrl: item.sourceUrl,
    task: item.task,
    license: item.license,
    commercialUse: item.commercialUse,
    runtimeClass: item.runtimeClass,
    adoptionStatus: item.adoptionStatus,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    metadata: { ...item.metadata },
    executionEnabled: item.executionEnabled,
    humanReviewRequired: item.humanReviewRequired,
    safety: [...item.safety],
    nextStep: item.nextStep
  }));
}

function getStaticHuggingFaceReadiness(env = process.env) {
  const enabled = parseEnabled(env.HUGGINGFACE_HUB_ENABLED);
  const parsed = parseHubUrl(env.HUGGINGFACE_HUB_BASE_URL || DEFAULT_HUB_URL, env);
  const tokenConfigured = Boolean(String(env.HF_TOKEN || "").trim());
  const configurationStatus = enabled ? (parsed.ok ? "configured" : "setup_required") : "disabled";
  const resources = getPublicHuggingFaceCatalog();
  const counts = resources.reduce((summary, item) => {
    summary[item.resourceType] = (summary[item.resourceType] || 0) + 1;
    summary[item.adoptionStatus] = (summary[item.adoptionStatus] || 0) + 1;
    return summary;
  }, {});
  return {
    ok: true,
    mode: "static",
    resourceCount: resources.length,
    counts,
    hub: {
      enabled,
      configurationStatus,
      runtimeStatus: "not_probed",
      configuredHost: parsed.ok ? parsed.url.host : null,
      tokenConfigured,
      canProbe: parsed.ok,
      missingConfiguration: parsed.ok ? [] : ["HUGGINGFACE_HUB_BASE_URL"],
      configurationKeys: ["HUGGINGFACE_HUB_ENABLED", "HUGGINGFACE_HUB_BASE_URL", "HF_TOKEN"]
    },
    resources
  };
}

async function getHuggingFaceReadiness(options = {}) {
  const env = options.env || process.env;
  const staticState = getStaticHuggingFaceReadiness(env);
  const timeoutMs = normalizeTimeout(options.timeoutMs || env.SONARA_HF_PROBE_TIMEOUT_MS);
  if (options.probe !== true || staticState.hub.configurationStatus !== "configured") {
    return { ...staticState, probeTimeoutMs: timeoutMs };
  }

  const parsed = parseHubUrl(env.HUGGINGFACE_HUB_BASE_URL || DEFAULT_HUB_URL, env);
  if (!parsed.ok) return { ...staticState, probeTimeoutMs: timeoutMs };
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { ...staticState, probeTimeoutMs: timeoutMs, hub: { ...staticState.hub, runtimeStatus: "fetch_unavailable" } };
  }

  const target = new URL("/api/models/BAAI/bge-small-en-v1.5", parsed.url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { Accept: "application/json", "User-Agent": "sonara-huggingface-readiness/1.0" };
  const token = String(env.HF_TOKEN || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetchImpl(target, { method: "GET", headers, redirect: "error", signal: controller.signal });
    return {
      ...staticState,
      mode: "live_bounded",
      probeTimeoutMs: timeoutMs,
      hub: {
        ...staticState.hub,
        runtimeStatus: response.ok ? "ready" : "unhealthy",
        httpStatus: Number(response.status) || null,
        probeResource: "BAAI/bge-small-en-v1.5"
      }
    };
  } catch (error) {
    return {
      ...staticState,
      mode: "live_bounded",
      probeTimeoutMs: timeoutMs,
      hub: {
        ...staticState.hub,
        runtimeStatus: error?.name === "AbortError" ? "timeout" : "unreachable",
        httpStatus: null,
        probeResource: "BAAI/bge-small-en-v1.5"
      }
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseHubUrl(value, env = process.env) {
  try {
    const url = new URL(String(value || "").trim());
    const local = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
    const official = url.hostname === "huggingface.co" || url.hostname.endsWith(".huggingface.co");
    if (url.username || url.password) return { ok: false, code: "credentials_in_url" };
    if (!official && !(local && env.NODE_ENV !== "production")) return { ok: false, code: "unapproved_host" };
    if (url.protocol !== "https:" && !local) return { ok: false, code: "insecure_transport" };
    return { ok: true, url };
  } catch {
    return { ok: false, code: "invalid_url" };
  }
}

function normalizeTimeout(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 100) return DEFAULT_PROBE_TIMEOUT_MS;
  return Math.min(parsed, MAX_PROBE_TIMEOUT_MS);
}

function parseEnabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

module.exports = {
  HUGGINGFACE_RESOURCES,
  getPublicHuggingFaceCatalog,
  getStaticHuggingFaceReadiness,
  getHuggingFaceReadiness,
  parseHubUrl,
  normalizeTimeout
};
