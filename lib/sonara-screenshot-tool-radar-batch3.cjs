"use strict";

// Third screenshot-led intake batch. These records are research/catalog state
// only. No third-party repository is installed, imported, executed, or enabled
// in production by this file. Hosted-service references stay outside the
// executable repository catalog.

const SCREENSHOT_TOOL_RADAR_BATCH3 = Object.freeze([
  record({
    key: "ocrmypdf",
    label: "OCRmyPDF",
    repository: "ocrmypdf/OCRmyPDF",
    license: "MPL-2.0",
    licenseRisk: "medium",
    runtimeClass: "document_ocr_pipeline",
    integrationStatus: "optional_adapter_after_review",
    integrationMode: "isolated_document_worker",
    role: "Adds searchable OCR text layers to scanned PDFs, supports PDF/A output, deskew/rotation, validation, optimization, multilingual Tesseract OCR, and multi-core processing",
    placement: "Business Builder or internal document-ingestion worker; never the synchronous Vercel request process",
    productFit: ["Business Builder", "Document intake", "Internal operations", "Searchable archives"],
    capabilities: ["searchable PDF/PDF-A", "multilingual OCR", "deskew and rotation", "input/output validation", "image optimization", "large document processing"],
    safety: [
      "Run OCR in an isolated bounded worker because OCRmyPDF depends on external binaries such as Tesseract and Ghostscript and can consume substantial CPU, memory, and temporary storage.",
      "Treat uploaded PDFs/images as untrusted input: enforce file-size, page-count, decompression, timeout, malware-scanning, and private-storage boundaries before processing.",
      "MPL-2.0 obligations apply to covered source files; keep license notices and review any modified/distributed covered files before adoption."
    ],
    blockedUses: ["unbounded user uploads", "synchronous OCR inside the Vercel request process", "arbitrary OCR plugins", "publicly exposing private document contents", "removing MPL notices from covered files"],
    nextStep: "Benchmark a disposable worker on representative scanned PDFs and compare quality, latency, CPU/memory, temporary-storage use, and multilingual accuracy before building a private document-ingestion adapter."
  }),
  record({
    key: "archify",
    label: "Archify",
    repository: "tt-a1i/archify",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "architecture_diagram_agent_skill",
    integrationStatus: "developer_tool_candidate",
    integrationMode: "development_only_visualization_skill",
    role: "Agent-oriented architecture, workflow, sequence, data-flow, and lifecycle diagram generation with typed intermediate data, deterministic validation, and self-contained HTML/SVG exports",
    placement: "Internal development, architecture reviews, release documentation, and founder system maps; not a customer-facing production dependency by default",
    productFit: ["Internal development", "Admin Command Center", "Architecture documentation", "Release engineering"],
    capabilities: ["architecture maps", "sequence diagrams", "data-flow diagrams", "lifecycle diagrams", "validated typed IR", "HTML/SVG/PNG/WebM exports"],
    safety: [
      "Treat repository inspection as read-only unless the user explicitly authorizes source changes; generated diagrams must not invent runtime topology not supported by source evidence.",
      "Do not publish private file paths, secrets, internal hostnames, or proprietary architecture artifacts without owner approval.",
      "Keep this as a development skill or generated-artifact workflow unless a measured production requirement justifies shipping its runtime."
    ],
    blockedUses: ["invented architecture presented as verified", "publishing private topology without approval", "automatic production mutation", "making Archify a required production runtime without review"],
    nextStep: "Generate one source-pinned SONARA runtime architecture artifact from the production Express/Vercel/Supabase path and compare it with the existing SYSTEM_MAP before deciding whether to adopt the skill for recurring release documentation."
  }),
  record({
    key: "three_ws",
    label: "three.ws",
    repository: "nirholas/three.ws",
    license: "Apache-2.0",
    licenseRisk: "medium",
    runtimeClass: "browser_native_3d_ai_platform",
    integrationStatus: "curated_reference",
    integrationMode: "creator_3d_reference",
    role: "Browser-native 3D AI platform for prompt/image/sketch-to-3D generation, GLB workflows, avatar/agent experiences, SDK/MCP integration, and embeddable 3D models",
    placement: "Creator Studio 3D research and browser-interaction reference; any generation or agent adapter stays behind explicit provider and asset-license review",
    productFit: ["Creator Studio", "3D asset research", "Interactive experiences", "Agent embodiment research"],
    capabilities: ["text-to-3D", "image-to-3D", "sketch-to-3D", "GLB import/export", "browser 3D rendering", "SDK/MCP interfaces"],
    safety: [
      "Repository license does not automatically license generated assets, third-party models, hosted generation services, tokens, datasets, or blockchain integrations; review those separately.",
      "Only process user-owned or properly licensed reference media and preserve provenance for generated 3D assets.",
      "Do not introduce wallet/on-chain registration, token promotion, or autonomous agent actions into SONARA merely because the upstream platform supports them."
    ],
    blockedUses: ["unreviewed on-chain registration", "using unlicensed reference images or models", "treating generated asset rights as guaranteed by Apache-2.0", "autonomous 3D-agent actions without authorization"],
    nextStep: "Prototype a provider-neutral GLB preview/import flow with one owner-created asset, then separately benchmark whether text/image-to-3D generation adds enough Creator Studio value to justify an adapter."
  }),
  record({
    key: "openpost",
    label: "OpenPost",
    repository: "getopenpost/openpost",
    license: "AGPL-3.0",
    licenseRisk: "high",
    runtimeClass: "social_content_creation_and_scheduling_suite",
    integrationStatus: "research_only_license_gated",
    integrationMode: "growth_creator_workflow_reference",
    role: "Unified social publishing workspace with image/carousel design, browser video editing, recording, scheduling, analytics, media library, inbox, optional AI writing, and automation APIs",
    placement: "Growth Studio and Creator Studio workflow/product reference; no code adoption into SONARA without explicit AGPL/commercial architecture review",
    productFit: ["Growth Studio", "Creator Studio", "Social scheduling", "Content operations"],
    capabilities: ["multi-platform publishing", "image and carousel editor", "video editor", "screen/camera recording", "calendar and queues", "analytics", "media library", "API/CLI/MCP automation"],
    safety: [
      "AGPL-3.0 is network copyleft; do not copy or combine covered source into SONARA's hosted product without a deliberate license/legal architecture decision.",
      "Social-provider credentials, app approvals, platform terms, rate limits, content rights, user consent, and publishing permissions must be reviewed per provider.",
      "Publishing, campaign launch, direct-message actions, and other customer-impacting social actions remain owner/user approval-gated even if an automation API exists."
    ],
    blockedUses: ["copying AGPL code into proprietary production paths without review", "automatic publishing without user approval", "credential sharing across tenants", "bypassing social platform terms or rate limits", "unlicensed media reuse"],
    nextStep: "Use OpenPost as a feature-gap benchmark for Growth/Creator Studio and write a SONARA-owned social-workflow requirements matrix before deciding whether any clean-room adapter or separately hosted AGPL service is justified."
  }),
  record({
    key: "uiverse_galaxy",
    label: "Uiverse Galaxy",
    repository: "uiverse-io/galaxy",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "community_ui_component_archive",
    integrationStatus: "curated_reference",
    integrationMode: "design_system_reference",
    role: "Large community-curated archive of CSS and Tailwind UI elements sourced from Uiverse.io",
    placement: "SONARA design-system research and component inspiration; select components only after accessibility, performance, provenance, and brand review",
    productFit: ["SONARA website", "Business Builder", "Creator Studio", "Growth Studio", "Design system"],
    capabilities: ["buttons", "cards", "forms", "inputs", "loaders", "notifications", "tooltips", "patterns", "CSS/Tailwind components"],
    safety: [
      "Do not bulk-import thousands of community components; every adopted component must be reviewed for accessibility, keyboard behavior, responsive layout, performance, and compatibility with SONARA's design tokens.",
      "Keep original license/attribution records for substantial reused code and avoid copying another product's brand identity.",
      "Prefer SONARA-owned normalized components over runtime dependency on an uncontrolled community archive."
    ],
    blockedUses: ["bulk importing the archive", "shipping inaccessible interaction patterns", "copying third-party branding", "using visual novelty instead of measured UX improvement"],
    nextStep: "Select at most three interaction patterns that solve an existing SONARA UX gap, rebuild them against SONARA tokens, and validate keyboard, contrast, mobile, and reduced-motion behavior before adoption."
  }),
  record({
    key: "openresearch",
    label: "OpenResearch",
    repository: "alphaXiv/OpenResearch",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "local_parallel_research_agent_workspace",
    integrationStatus: "developer_tool_candidate",
    integrationMode: "local_research_harness_reference",
    role: "Local-first research workspace that gives coding agents isolated worktrees, reproducible experiment lineage, local logs/artifacts, and local or remote compute backends",
    placement: "Founder/local research workstation and Research Lab experiments; not the hosted customer request path",
    productFit: ["Research Lab", "Founder research", "Internal development", "Experiment orchestration"],
    capabilities: ["parallel agent sessions", "isolated git worktrees", "reproducible experiments", "local artifact lineage", "local/SSH/cluster compute", "Codex/Claude/OpenCode integration"],
    safety: [
      "Do not execute curl-pipe-shell install commands from research notes; inspect and pin a release/install path before local use.",
      "Its local service is designed around loopback/local trust boundaries; do not expose a local dashboard or experiment service publicly without authentication and network review.",
      "Keep SONARA's source-grounded evidence standards authoritative; a parallel agent harness increases throughput but does not make model conclusions evidence."
    ],
    blockedUses: ["publicly exposing an unauthenticated local research service", "automatic production deployment of experiments", "sending private repositories to unapproved compute providers", "treating agent consensus as factual verification"],
    nextStep: "Evaluate OpenResearch locally on a disposable research repository with no production secrets, comparing experiment isolation, reproducibility, compute cost, and evidence capture against SONARA's existing research workflow."
  }),
  record({
    key: "nvidia_switchyard",
    label: "NVIDIA NeMo Switchyard",
    repository: "NVIDIA-NeMo/Switchyard",
    license: "Apache-2.0",
    licenseRisk: "medium",
    runtimeClass: "llm_request_router",
    integrationStatus: "research_only_pre1",
    integrationMode: "provider_gateway_routing_reference",
    role: "Pre-1.0 model-routing library and proxy that selects an efficient/capable model per LLM request and can integrate with gateways such as NeMo Relay or LiteLLM",
    placement: "Provider Gateway benchmarking and routing research only; Provider Gateway remains SONARA's production authority",
    productFit: ["Provider Gateway", "Internal agent infrastructure", "Cost optimization", "Model routing research"],
    capabilities: ["per-request model routing", "classifier/staged routing", "OpenAI/Anthropic-compatible proxying", "Python/Rust embedding", "benchmark tooling", "usage and routing evaluation"],
    safety: [
      "Upstream explicitly marks major components pre-1.0 and the standalone server as demo/evaluation only; pin exact versions and do not treat main-branch APIs as stable production contracts.",
      "Provider credentials, retries, routing policy, tenant isolation, observability, spend controls, and fallback behavior remain SONARA responsibilities.",
      "A cheaper routing result is not sufficient evidence: benchmark quality, latency, total token cost, failure modes, and privacy/provider constraints on SONARA workloads."
    ],
    blockedUses: ["replacing Provider Gateway without an ADR", "production use of the demo standalone server", "unpinned main-branch integration", "routing that bypasses tenant or spend policy", "silent provider substitution where policy forbids it"],
    nextStep: "Run an offline replay benchmark against representative non-sensitive SONARA prompts and compare fixed-model versus routed quality, latency, and cost before considering a Provider Gateway experiment behind a feature flag."
  })
]);

const NON_REPOSITORY_REFERENCES_BATCH3 = Object.freeze([
  Object.freeze({
    key: "breachlab_service_reference",
    label: "BreachLab",
    observedTheme: "Hosted offensive-security training with live targets, tracks, flags, and hands-on exploitation exercises",
    status: "verified_hosted_service_reference",
    reason: "breachlab.org is verifiable as a training service, but this screenshot intake does not establish an authoritative open-source product repository/license for SONARA to adopt.",
    productFit: ["Security training", "Founder development", "Authorized lab research"],
    nextStep: "Use only for lawful training on BreachLab-provided targets or other explicitly authorized systems; do not convert training techniques into scanning or exploitation of third-party systems."
  }),
  Object.freeze({
    key: "google_trends_service_reference",
    label: "Google Trends",
    observedTheme: "Search-interest and trending-topic research by geography, category, related queries, and time",
    status: "verified_hosted_service_reference",
    reason: "Google Trends is a hosted Google research product, not an open-source repository supplied for code adoption.",
    productFit: ["Growth Studio", "Market research", "Content planning"],
    nextStep: "Use Trends as one demand signal in a research workflow, preserving its sampled/normalized-data limitations and validating business decisions against additional evidence before acting."
  }),
  Object.freeze({
    key: "hackproduct_learning_reference",
    label: "HackProduct AI engineering reference",
    observedTheme: "Educational framing of traditional ML and modern AI concepts such as regression, trees, transformers, self-attention, CNNs, post-training, and RAG",
    status: "verified_hosted_learning_reference",
    reason: "HackProduct is a hosted learning/practice service; the screenshot is educational content, not a source-code repository or benchmark to import.",
    productFit: ["Founder learning", "Internal training", "Research Lab methodology"],
    nextStep: "Use the concept map as a curriculum prompt only; rely on primary technical sources and measured experiments for architecture choices rather than an infographic."
  })
]);

function record(input) {
  return Object.freeze({
    repositoryVerified: true,
    repoUrl: `https://github.com/${input.repository}`,
    launchImpact: "optional",
    enabledInProduction: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch3_2026_09_13",
    blockedUses: [],
    ...input
  });
}

function getPublicScreenshotToolCatalogBatch3() {
  return SCREENSHOT_TOOL_RADAR_BATCH3.map((item) => ({
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

function getScreenshotToolReadinessBatch3() {
  const repositories = getPublicScreenshotToolCatalogBatch3().map((item) => ({
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
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH3.length,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch3()
  };
}

function getNonRepositoryReferencesBatch3() {
  return NON_REPOSITORY_REFERENCES_BATCH3.map((item) => ({
    ...item,
    productFit: [...item.productFit]
  }));
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH3,
  NON_REPOSITORY_REFERENCES_BATCH3,
  getPublicScreenshotToolCatalogBatch3,
  getScreenshotToolReadinessBatch3,
  getNonRepositoryReferencesBatch3
};
