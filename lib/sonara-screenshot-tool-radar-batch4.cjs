// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Fourth screenshot-led intake batch. These records are research/catalog state
// only. No third-party repository is installed, imported, executed, or enabled
// in production by this file. Repeated screenshots that already exist in prior
// batches are documented in the dated research note instead of duplicated here.

const SCREENSHOT_TOOL_RADAR_BATCH4 = Object.freeze([
  record({
    key: "vercel_vgpu",
    label: "vGPU",
    repository: "vercel-labs/vgpu",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "webgpu_rendering_and_compute_library",
    integrationStatus: "optional_adapter_after_review",
    integrationMode: "client_gpu_progressive_enhancement",
    role: "TypeScript WebGPU library with typed WGSL imports, explicit GPU primitives, browser/headless-Node runtimes, deterministic mocks, CLI documentation, examples, and agent-oriented discovery surfaces",
    placement: "Creator Studio, data/graphics experiments, or selectively enhanced public experiences; browser GPU work must remain optional and never become a launch dependency",
    productFit: ["Creator Studio", "Interactive graphics", "Data visualization", "Developer tooling"],
    capabilities: ["typed WGSL", "WebGPU rendering", "GPU compute", "browser and headless Node", "deterministic mock testing", "CLI docs/examples", "read-only MCP documentation"],
    safety: [
      "Treat WebGPU as progressive enhancement and provide a non-WebGPU fallback for unsupported devices, disabled hardware acceleration, accessibility needs, and constrained mobile hardware.",
      "Do not assume a Vercel request has GPU access merely because the library also supports headless Node; server-side GPU execution needs a separately reviewed compute environment.",
      "Keep shader inputs, buffer sizes, frame loops, memory use, and imported examples bounded; benchmark device loss, thermal/mobile cost, reduced-motion behavior, and Core Web Vitals before shipping."
    ],
    blockedUses: ["making WebGPU mandatory for core product flows", "assuming Vercel server GPU availability", "unbounded user-supplied shaders", "copying examples without provenance review"],
    nextStep: "Build one feature-detected, client-only SONARA-owned visualization behind a flag, test it with vgpu/mock in CI, and compare performance/accessibility against a conventional Canvas/SVG fallback before adding a runtime dependency."
  }),
  record({
    key: "open_webui",
    label: "Open WebUI",
    repository: "open-webui/open-webui",
    license: "Open WebUI License (custom; branding restriction)",
    licenseRisk: "high",
    runtimeClass: "self_hosted_ai_interface",
    integrationStatus: "research_only_license_gated",
    integrationMode: "ai_workspace_architecture_reference",
    role: "Feature-rich self-hosted AI interface for local and cloud model providers, retrieval, tools, voice/media, user workspaces, and OpenAI-compatible APIs",
    placement: "SONARA One, Provider Gateway, and personal-agent architecture research; not a drop-in SONARA-branded production UI",
    productFit: ["SONARA One", "Personal Agent OS", "Provider Gateway", "AI workspace research"],
    capabilities: ["self-hosted AI UI", "Ollama and OpenAI-compatible APIs", "RAG", "web search", "voice/media interfaces", "agent/tool extensions", "local/cloud model access"],
    safety: [
      "The current repository uses a custom Open WebUI License whose branding clause limits removal or alteration of Open WebUI branding outside stated exceptions; do not rebrand or redistribute it as SONARA without license review or permission.",
      "Self-hosting does not remove privacy obligations: isolate tenant data, provider keys, retrieval stores, uploaded files, tool permissions, and logs before any experiment with customer information.",
      "Use it as an architecture/feature benchmark first; Provider Gateway and SONARA's authority/approval system remain the production control boundaries."
    ],
    blockedUses: ["rebranding Open WebUI as SONARA without license clearance", "embedding unrestricted provider keys", "bypassing Provider Gateway", "granting extensions unrestricted production tool authority"],
    nextStep: "Run a disposable local-only comparison with synthetic data and no production secrets, then write a feature-gap matrix against SONARA One before considering any separately branded or licensed deployment."
  }),
  record({
    key: "openshot_qt",
    label: "OpenShot Video Editor",
    repository: "OpenShot/openshot-qt",
    license: "GPL-3.0-or-later",
    licenseRisk: "high",
    runtimeClass: "desktop_video_editor",
    integrationStatus: "curated_reference",
    integrationMode: "creator_video_workflow_reference",
    role: "Cross-platform desktop video editor with timeline/layer editing, FFmpeg-backed media processing, animation/keyframes, titles, chroma key, transitions, and effects",
    placement: "Creator Studio workflow and UX benchmark; any source reuse or distribution is a separate GPL architecture decision",
    productFit: ["Creator Studio", "Video editing", "Media workflows", "Desktop companion research"],
    capabilities: ["timeline editing", "multi-layer video", "keyframes", "titles", "chroma key", "effects and transitions", "FFmpeg media workflows"],
    safety: [
      "GPL-3.0-or-later is reciprocal; do not copy OpenShot source into proprietary SONARA production paths without explicit legal/architecture review and corresponding-source obligations.",
      "Treat imported media, project files, codecs, fonts, templates, and external binaries as separate trust and licensing surfaces.",
      "If SONARA needs server-side video rendering, evaluate a purpose-built isolated worker instead of attempting to run a desktop Qt editor inside the Vercel request path."
    ],
    blockedUses: ["copying GPL UI/editor code into proprietary production paths without review", "running the desktop editor in the Vercel request process", "processing unlicensed media", "treating FFmpeg/codec rights as covered by the OpenShot repository license"],
    nextStep: "Extract a clean-room Creator Studio requirements checklist from OpenShot's timeline, title, chroma, transition, and effect workflows, then compare those requirements with SONARA's existing media worker and HyperFrames plans before choosing implementation technology."
  }),
  record({
    key: "agent_me",
    label: "Agent-Me",
    repository: "jzjzzzzzzz/agent-me",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "personal_ai_agent_twin",
    integrationStatus: "curated_reference",
    integrationMode: "inspectable_memory_and_reasoning_pattern",
    role: "Inspectable personal-agent architecture that distills user-provided knowledge, memories, projects, preferences, experiences, and decisions into retrieval, planning, critique, verification, and evidence-oriented workflows",
    placement: "Personal Agent OS and SONARA One architecture research; memory provenance and user control must remain first-class",
    productFit: ["Personal Agent OS", "SONARA One", "Memory architecture", "Agent verification"],
    capabilities: ["personal knowledge ingestion", "memory retrieval", "typed agent handoffs", "evidence tracing", "planning", "critique", "verification"],
    safety: [
      "A personal-agent twin must be explicitly user-controlled: distinguish user-authored facts, inferred summaries, and model-generated conclusions, with provenance and correction/deletion paths.",
      "Do not impersonate the user to third parties, make consequential decisions in the user's name, or silently expand authority because a memory/profile exists.",
      "Keep private memories and source documents within approved storage/providers and enforce SONARA's existing approval gates for external actions."
    ],
    blockedUses: ["silent identity impersonation", "unreviewed autonomous external actions", "mixing generated inference with verified user facts", "sending private memories to unapproved providers"],
    nextStep: "Compare Agent-Me's evidence/retrieval/handoff model with SONARA's existing memory and authority architecture, then adopt only source-grounded provenance patterns that improve inspectability without creating a second agent-control plane."
  }),
  record({
    key: "quarkdown",
    label: "Quarkdown",
    repository: "iamgio/quarkdown",
    license: "GPL-3.0 (CLI/LSP modules AGPL-3.0)",
    licenseRisk: "high",
    runtimeClass: "markdown_typesetting_and_document_compiler",
    integrationStatus: "curated_reference",
    integrationMode: "document_output_reference",
    role: "Markdown-based programmable typesetting system for papers, books, knowledge bases, presentations, websites, and print/PDF-oriented publishing workflows",
    placement: "Business Builder document-generation research and internal documentation experiments; not a production dependency without reciprocal-license review",
    productFit: ["Business Builder", "Document generation", "Knowledge bases", "Presentation/report publishing"],
    capabilities: ["programmable Markdown", "typesetting", "PDF/print output", "books and papers", "presentations", "websites", "knowledge bases"],
    safety: [
      "The repository is GPL-3.0 by default while its CLI and language-server modules/binaries are AGPL-3.0; treat integration and network-service use as deliberate reciprocal-license architecture decisions.",
      "Generated documents may contain user data, fonts, images, citations, templates, or other licensed material not governed by Quarkdown's code license; preserve source rights and provenance separately.",
      "Sandbox compilation inputs and cap CPU, memory, output size, include/import scope, and filesystem/network access before any document-worker experiment."
    ],
    blockedUses: ["copying GPL/AGPL source into proprietary production paths without review", "exposing an AGPL-derived network service without compliance review", "unbounded document compilation", "publishing user documents without authorization"],
    nextStep: "Use Quarkdown as a document-product benchmark and compile a synthetic sample in an isolated local experiment; compare output quality and operational cost with SONARA's existing Markdown/PDF pipeline before any dependency decision."
  }),
  record({
    key: "generative_ai_arbitrage",
    label: "Generative AI Arbitrage",
    repository: "cporter202/generative-ai-arbitrage",
    license: "NONE DECLARED",
    licenseRisk: "high",
    runtimeClass: "provider_cost_reference_directory",
    integrationStatus: "reference_only_no_license",
    integrationMode: "vendor_and_pricing_lead_source",
    role: "Curated directory of claimed lower-cost access paths for generative video, image, and music models/providers",
    placement: "Provider Gateway market research and cost benchmarking only; no code reuse or automatic provider onboarding",
    productFit: ["Provider Gateway", "Creator Studio", "Cost optimization", "Vendor research"],
    capabilities: ["provider discovery", "price-comparison leads", "video/image/music API references", "cost-reduction research"],
    safety: [
      "GitHub currently reports no declared repository license, so the source is reference-only; do not copy code/content into SONARA as though it were open source.",
      "Treat savings percentages and 'same model' claims as leads, not verified facts. Independently verify provider identity, model provenance, pricing, rate limits, data retention, content rights, reliability, support, and terms before use.",
      "All approved model access must still enter through Provider Gateway with explicit spend, privacy, tenant-isolation, fallback, quality, and abuse controls."
    ],
    blockedUses: ["copying unlicensed repository content into SONARA", "automatic provider onboarding from a directory", "routing around Provider Gateway", "representing unverified savings or model-equivalence claims as guaranteed"],
    nextStep: "Turn the directory into a non-executable vendor-research checklist, independently verify only the providers relevant to current Creator Studio workloads, and benchmark total cost/quality before adding any approved provider adapter."
  })
]);

function record(input) {
  return Object.freeze({
    repositoryVerified: true,
    repoUrl: `https://github.com/${input.repository}`,
    launchImpact: "optional",
    enabledInProduction: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch4_2026_09_14",
    blockedUses: [],
    ...input
  });
}

function getPublicScreenshotToolCatalogBatch4() {
  return SCREENSHOT_TOOL_RADAR_BATCH4.map((item) => ({
    key: item.key,
    label: item.label,
    requestedRepository: item.repository,
    requestedRepoUrl: item.repoUrl,
    repository: item.repository,
    repoUrl: item.repoUrl,
    repositoryVerified: item.repositoryVerified,
    sourceCorrection: null,
    license: item.license,
    licenseRisk: item.licenseRisk,
    runtimeClass: item.runtimeClass,
    integrationStatus: item.integrationStatus,
    integrationMode: item.integrationMode,
    role: item.role,
    placement: item.placement,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    launchImpact: item.launchImpact,
    enabledInProduction: item.enabledInProduction,
    humanReviewRequired: item.humanReviewRequired,
    safety: [...item.safety],
    blockedUses: [...item.blockedUses],
    nextStep: item.nextStep,
    source: item.source
  }));
}

function getScreenshotToolReadinessBatch4() {
  const repositories = getPublicScreenshotToolCatalogBatch4().map((item) => ({
    ...item,
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    canExecute: false
  }));

  return {
    ok: true,
    mode: "static_governed_catalog",
    repositoryCount: repositories.length,
    productionExecutionCount: repositories.filter((item) => item.enabledInProduction).length,
    repositories
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH4,
  getPublicScreenshotToolCatalogBatch4,
  getScreenshotToolReadinessBatch4
};
