// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Dated, non-executing Creator Studio market and architecture radar.
// A record here grants no provider authority, installs no package, downloads no
// model, publishes no content, charges no customer, and creates no production
// capability. Promotion must follow SONARA's normal licence, security, tenant,
// consent, cost, CI, canary, and release gates.

const AS_OF = "2026-09-22";

const STATUS = Object.freeze({
  LIVE_FOUNDATION: "live_foundation",
  IMPLEMENT_NEXT: "implement_next",
  DESIGN_ONLY: "design_only",
  PARTNER_INTEGRATION: "partner_integration",
  RESEARCH_ONLY: "research_only",
  DO_NOT_REBUILD: "do_not_rebuild"
});

const CREATOR_OWNERSHIP = Object.freeze({
  creatorStudio: [
    "creator projects and asset library",
    "image video audio music voice podcast book and design workflows",
    "timeline transcript caption and packaging workflows",
    "rights provenance consent and release evidence",
    "private review collaboration and creator client spaces",
    "creator commerce memberships releases and digital products",
    "channel packaging publishing approvals and creator analytics"
  ],
  sharedNexus: [
    "identity tenant authorization and plan access",
    "agent authority workflow approvals and durable jobs",
    "RAG search evidence and evaluation",
    "billing payments usage credits and provider cost reconciliation",
    "storage databases observability security notifications and audit",
    "calendar scheduling communications translation and API/MCP gateways"
  ],
  businessBuilder: [
    "restaurant POS kiosk and inventory operations",
    "trucking fleet routing and field service operations",
    "HVAC electrical plumbing carpentry cleaning and project operations",
    "manufacturing waste retail real estate rentals and workforce operations"
  ],
  partnerOnly: [
    "banking rails and money transmission",
    "insurance underwriting and regulated financial decisions",
    "government or military sensitive systems",
    "biometric identity infrastructure",
    "external social network distribution APIs"
  ]
});

const MARKET_PATTERNS = Object.freeze([
  pattern("multi-model-creative-workspace", "All-in-one multi-model creative workspace", STATUS.IMPLEMENT_NEXT,
    "Keep one SONARA project and rights model while routing approved generation and editing work to interchangeable providers."),
  pattern("persistent-project-graph", "Persistent creator project graph", STATUS.IMPLEMENT_NEXT,
    "Treat prompts, source assets, edits, transcripts, timelines, rights, versions, releases, channels, offers, and analytics as one connected project."),
  pattern("transcript-timeline-editing", "Transcript and timeline editing", STATUS.IMPLEMENT_NEXT,
    "Add editable transcript/timeline state instead of reducing video and podcast work to generated files."),
  pattern("content-repurposing", "One source to many deliverables", STATUS.IMPLEMENT_NEXT,
    "Package a master asset into reviewed 16:9, 9:16, 1:1, audio, transcript, caption, thumbnail, article, and promo outputs."),
  pattern("audience-commerce-loop", "Audience, commerce, and monetization loop", STATUS.IMPLEMENT_NEXT,
    "Connect releases and content to direct products, memberships, credits, offers, conversions, and channel revenue evidence."),
  pattern("durable-agentic-workflows", "Durable agentic workflows with deterministic boundaries", STATUS.IMPLEMENT_NEXT,
    "Use deterministic orchestration for state and retries; keep model/API/network I/O in bounded activities with approval and evidence."),
  pattern("hybrid-rag", "Hybrid RAG and evidence retrieval", STATUS.IMPLEMENT_NEXT,
    "Combine lexical and semantic retrieval, source timestamps, citations, evaluation, and tenant-scoped evidence rather than vector-only chat."),
  pattern("private-collaboration", "Private review and collaboration", STATUS.IMPLEMENT_NEXT,
    "Support comments, approvals, version review, live rooms, client handoff, and role-scoped access before public social-network ambitions."),
  pattern("open-media-interchange", "Open media interchange", STATUS.DESIGN_ONLY,
    "Use standard timeline, color, image, subtitle, and media transforms behind workers/adapters so projects are portable."),
  pattern("realtime-media", "Realtime creator rooms and voice/video agents", STATUS.PARTNER_INTEGRATION,
    "Prefer reviewed realtime infrastructure over rebuilding WebRTC/media routing from scratch."),
  pattern("native-os", "New general-purpose operating system", STATUS.DO_NOT_REBUILD,
    "Creator Studio is an application/business operating layer; do not spend roadmap capacity rebuilding kernels, GPU drivers, codecs, or browser engines.")
]);

const BENCHMARKS = Object.freeze([
  benchmark("Adobe Firefly", "all_in_one_creative_ai", "Image, video, audio, design, multi-model access, generation history and timeline-oriented editing are converging into one workspace.",
    "https://blog.adobe.com/en/publish/2026/08/20/adobe-firefly-expands-its-creative-ai-studio-generate-music-speech-and-sound-effects-in-one-place"),
  benchmark("Adobe Firefly unified generation and editing", "persistent_projects", "Generation and editing are being unified with project organization and timeline workflows.",
    "https://helpx.adobe.com/firefly/web/unified-generation-and-editing-experience/generation-and-editing-experience-overview.html"),
  benchmark("Descript", "transcript_first_editing", "Transcript editing, multitrack podcast/video production and an AI co-editor show that creators want editing state, not only generated media.",
    "https://www.descript.com/blog/article/descript-season-6-meet-underlord"),
  benchmark("Runway Gen-4.5", "specialist_video_generation", "Specialist video models remain valuable; SONARA should route to specialists without making one provider its project model.",
    "https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5"),
  benchmark("ElevenLabs", "voice_dubbing_audio", "Dubbing and voice workflows increasingly require editable segments, multilingual delivery, consent and provenance.",
    "https://elevenlabs.io/blog/dubbing-api"),
  benchmark("YouTube Studio", "distribution_analytics", "Publishing value extends into content analytics, revenue evidence, comparisons and exports.",
    "https://support.google.com/youtube/answer/9002587?hl=en"),
  benchmark("Patreon", "membership_commerce", "Membership plus digital commerce demonstrates demand for direct fan monetization and one-time products.",
    "https://support.patreon.com/hc/en-us/articles/11111747095181-Creator-fees-overview"),
  benchmark("Spotify for Creators", "podcast_video_monetization", "Podcast/video workflows increasingly combine publishing, analytics, ads, subscriptions and sponsorship operations.",
    "https://creators.spotify.com/features/monetization"),
  benchmark("Substack", "publisher_video_subscription", "Publishing platforms are adding native video, transcripts, podcast distribution, paid previews and subscription commerce.",
    "https://support.substack.com/hc/en-us/articles/21093671091220-Guide-to-video-posts-on-Substack"),
  benchmark("OpenAI Agents API", "managed_agent_runtime", "Managed agent runtimes are moving toward durable sessions, tools, MCP connections and isolated execution environments.",
    "https://openai.com/index/introducing-the-agents-api/"),
  benchmark("Temporal", "durable_execution", "Durable workflow systems separate deterministic orchestration from non-deterministic activities, retries, waits and human approval.",
    "https://go.temporal.io/platform-hub/ai-engineering/ai-reference-architecture"),
  benchmark("Qdrant", "hybrid_retrieval", "Modern retrieval combines dense semantic and sparse lexical signals and should be measured rather than assumed to help.",
    "https://qdrant.tech/articles/hybrid-search/")
]);

const ARCHITECTURE = Object.freeze([
  architecture("creator-project-graph", 1, STATUS.IMPLEMENT_NEXT,
    ["project", "asset", "version", "prompt", "rights", "transcript", "timeline", "release", "channel_package", "offer", "analytics_evidence"],
    "Reuse current creator assets, generation jobs, releases, music, video treatments and links first; add persistence only where lifecycle cannot be represented clearly."),
  architecture("deterministic-workflow-runtime", 1, STATUS.IMPLEMENT_NEXT,
    ["versioned workflow", "step run", "idempotency key", "retry/backoff", "wait", "approval", "dead letter", "evidence"],
    "Deterministic state transitions own orchestration. LLM/provider/database/network side effects remain bounded activities."),
  architecture("creator-rag", 1, STATUS.IMPLEMENT_NEXT,
    ["tenant-scoped chunk", "lexical index", "semantic vector", "source timestamp", "citation", "evaluation result"],
    "Start reuse-first with PostgreSQL/pgvector if it satisfies measured needs; keep Qdrant/Weaviate behind optional adapters."),
  architecture("media-interchange-worker", 2, STATUS.DESIGN_ONLY,
    ["OpenTimelineIO", "FFmpeg", "OpenColorIO", "OpenImageIO", "subtitle/caption interchange"],
    "Run CPU/GPU-heavy transforms outside the public web process with allowlisted operations and immutable input/output provenance."),
  architecture("media-intelligence-worker", 2, STATUS.DESIGN_ONLY,
    ["Whisper or reviewed ASR", "scene detection", "OpenCV", "MediaPipe", "librosa", "Basic Pitch"],
    "Expose narrow capabilities such as transcript, scene boundaries, feature extraction and audio-to-MIDI rather than arbitrary Python execution."),
  architecture("distribution-gateway", 2, STATUS.PARTNER_INTEGRATION,
    ["YouTube", "Spotify", "Substack", "Patreon", "reviewed social APIs"],
    "Export/manual-first, then OAuth adapters with minimal scopes, draft-before-publish, idempotency, rate limits, audit and revocation."),
  architecture("creator-commerce", 1, STATUS.LIVE_FOUNDATION,
    ["Stripe products", "subscriptions", "usage credits", "digital products", "memberships", "payout evidence"],
    "Use existing commerce primitives and connect creator-specific packaging; do not build a payment processor or money-transmission rail."),
  architecture("observability-and-cost", 1, STATUS.IMPLEMENT_NEXT,
    ["OpenTelemetry", "generation cost event", "provider latency", "failure class", "quota", "budget ceiling"],
    "Every expensive media/agent workflow needs traceability and cost reconciliation before broader activation."),
  architecture("private-review-rooms", 2, STATUS.IMPLEMENT_NEXT,
    ["comment", "approval", "version", "presence", "live room", "role-scoped share"],
    "Private collaboration has higher product value and lower governance risk than launching a public social network.")
]);

const OPEN_SOURCE_CANDIDATES = Object.freeze([
  candidate("FFmpeg", "FFmpeg/FFmpeg", "worker_media_transform", "mixed_lgpl_gpl_review_required", "external_binary_or_isolated_worker", true,
    "High-value media transform foundation; build configuration changes licence obligations, so pin a reviewed build profile."),
  candidate("OpenTimelineIO", "AcademySoftwareFoundation/OpenTimelineIO", "timeline_interchange", "Apache-2.0", "worker_candidate", true,
    "Strong fit for portable editorial timeline state and interchange."),
  candidate("OpenColorIO", "AcademySoftwareFoundation/OpenColorIO", "color_management", "BSD-3-Clause", "worker_candidate", true,
    "Use behind media pipeline boundaries for predictable color transforms."),
  candidate("OpenImageIO", "AcademySoftwareFoundation/OpenImageIO", "image_io", "Apache-2.0", "worker_candidate", true,
    "Useful image format and processing layer for isolated media workers."),
  candidate("OpenCV", "opencv/opencv", "computer_vision", "Apache-2.0", "worker_candidate", true,
    "Use for bounded analysis/transforms, never unrestricted customer code execution."),
  candidate("MediaPipe", "google-ai-edge/mediapipe", "live_media_ml", "Apache-2.0", "worker_or_client_candidate", true,
    "Useful for reviewed camera/live-media features; biometric identity databases remain out of scope."),
  candidate("Whisper", "openai/whisper", "speech_recognition", "MIT", "worker_candidate", true,
    "Candidate for tenant-scoped transcription; model/runtime resource use still needs benchmarking."),
  candidate("faster-whisper", "SYSTRAN/faster-whisper", "speech_recognition_runtime", "MIT", "worker_candidate", true,
    "Potential faster inference path; benchmark accuracy, memory and operational cost before selection."),
  candidate("PySceneDetect", "Breakthrough/PySceneDetect", "scene_detection", "BSD-3-Clause", "worker_candidate", true,
    "Useful deterministic scene-boundary extraction for repurposing and timeline assistance."),
  candidate("librosa", "librosa/librosa", "audio_analysis", "ISC", "worker_candidate", true,
    "Useful bounded audio feature analysis for creator tools."),
  candidate("Basic Pitch", "spotify/basic-pitch", "audio_to_midi", "Apache-2.0", "worker_candidate", true,
    "Useful optional music transcription pathway; validate model/data obligations separately."),
  candidate("OBS Studio", "obsproject/obs-studio", "recording_streaming_reference", "GPL-2.0", "external_companion_only", true,
    "Do not copy GPL implementation into proprietary packages; prefer interoperability and user-controlled external workflows."),
  candidate("Demucs", "facebookresearch/demucs", "source_separation_reference", "MIT", "research_only_archived", true,
    "Upstream is archived; retain as research reference and evaluate maintained alternatives before runtime adoption."),
  candidate("LiveKit", "livekit/livekit", "realtime_media", "Apache-2.0", "partner_or_service_candidate", true,
    "Strong realtime substrate candidate; require tenant auth, token scope, recording consent, moderation and load testing."),
  candidate("LiveKit Agents", "livekit/agents", "realtime_voice_agents", "Apache-2.0", "research_then_adapter", true,
    "Keep agent tool authority and approvals in SONARA even if realtime transport/turn-taking is external."),
  candidate("Temporal TypeScript SDK", "temporalio/sdk-typescript", "durable_workflows", "MIT", "research_then_service_candidate", true,
    "Evaluate against SONARA's existing outbox/workflow infrastructure before adding another operational control plane."),
  candidate("OpenTelemetry JS", "open-telemetry/opentelemetry-js", "observability", "Apache-2.0", "implementation_candidate", true,
    "Use for traces/metrics/log correlation without leaking prompts, secrets, biometric data or customer payloads.")
]);

const DEPRECATIONS = Object.freeze([
  Object.freeze({
    key: "openai-sora-videos-api",
    status: "do_not_start_new_dependency",
    checkedAt: AS_OF,
    reason: "OpenAI's deprecation page lists the Sora 2/Videos API for shutdown on 2026-09-24. Keep video generation provider-neutral and do not create a new hard dependency on a retiring API.",
    sourceUrl: "https://developers.openai.com/api/docs/deprecations"
  })
]);

const ROADMAP = Object.freeze({
  days0to30: [
    "define the Creator Project Graph and versioned project document without duplicating existing tables",
    "add transcript/timeline state contract and source-to-multi-format packaging specification",
    "add hybrid RAG retrieval/evaluation contract for tenant-owned creator knowledge",
    "instrument generation and agent workflows with cost, latency, failure and provenance evidence",
    "connect existing Stripe commerce primitives to creator releases, digital products and memberships",
    "design export/manual-first channel packages for YouTube, Spotify, Substack and Patreon"
  ],
  days30to90: [
    "build an isolated media worker proof using reviewed FFmpeg/OTIO plus bounded transcription and scene analysis",
    "ship private review rooms with comments, versions and approval state",
    "pilot exactly one minimal-scope distribution adapter behind owner approval, idempotency and audit",
    "add multilingual dubbing/localization workflow using configured provider adapters and consent evidence",
    "normalize cross-channel analytics into timestamped source evidence rather than fabricated unified metrics"
  ],
  days90to180: [
    "evaluate realtime creator rooms and co-editing after tenant/security/load proof",
    "add motion/3D and interactive experience authoring as structured project state",
    "evaluate local/private GPU worker economics only after cloud usage and demand data justify it",
    "add label/studio/team governance, reusable brand controls and enterprise review workflows",
    "consider a reviewed extension marketplace only after publisher identity, permissions, rollback, abuse and payout policy are complete"
  ]
});

const GUARDRAILS = Object.freeze([
  "no automatic repository or model-weight installation from customer requests",
  "no arbitrary shell Python filesystem path URL or custom-node execution in media workers",
  "no non-consensual voice cloning likeness generation or biometric identity database",
  "no hidden publishing messaging advertising spend or irreversible external mutation",
  "no trading financial advice underwriting money transmission or regulated decision automation",
  "no claim that a benchmark product is integrated unless an independently tested adapter proves it",
  "no new table until reuse of existing creator generation commerce workflow and evidence records has been evaluated"
]);

function pattern(key, name, status, rationale) {
  return Object.freeze({ key, name, status, rationale });
}
function benchmark(name, archetype, takeaway, sourceUrl) {
  return Object.freeze({ name, archetype, takeaway, sourceUrl, checkedAt: AS_OF, relationship: "market_reference_not_integration" });
}
function architecture(key, priority, status, primitives, decision) {
  return Object.freeze({ key, priority, status, primitives: Object.freeze([...primitives]), decision });
}
function candidate(name, repository, role, licenseDecision, integrationBoundary, humanReviewRequired, notes) {
  return Object.freeze({
    name,
    repository,
    repoUrl: `https://github.com/${repository}`,
    role,
    licenseDecision,
    integrationBoundary,
    humanReviewRequired,
    notes,
    runtimeAuthority: "none"
  });
}

function getCreatorStudioMarketRadar2026() {
  return Object.freeze({
    asOf: AS_OF,
    authority: "research_and_product_planning_only",
    executionAuthority: "none",
    creatorOwnership: CREATOR_OWNERSHIP,
    marketPatterns: MARKET_PATTERNS,
    benchmarks: BENCHMARKS,
    architecture: ARCHITECTURE,
    openSourceCandidates: OPEN_SOURCE_CANDIDATES,
    deprecations: DEPRECATIONS,
    roadmap: ROADMAP,
    guardrails: GUARDRAILS,
    counts: Object.freeze({
      marketPatterns: MARKET_PATTERNS.length,
      benchmarks: BENCHMARKS.length,
      architectureDecisions: ARCHITECTURE.length,
      openSourceCandidates: OPEN_SOURCE_CANDIDATES.length,
      deprecations: DEPRECATIONS.length
    })
  });
}

module.exports = {
  STATUS,
  getCreatorStudioMarketRadar2026
};
