// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Second screenshot-led intake batch. Verified repository records are eligible
// for Research Lab display only. Nothing here is installed, imported, executed,
// or enabled in production. Ambiguous or non-repository screenshots are kept
// separately so the project never invents an owner, URL, or license.

const SCREENSHOT_TOOL_RADAR_BATCH2 = Object.freeze([
  record({
    key: "image_pipes",
    label: "Image Pipes",
    repository: "mrajaeim/image-pipes",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "image_processing_pipeline",
    integrationStatus: "optional_adapter_after_review",
    integrationMode: "isolated_media_pipeline",
    role: "Type-safe image processing pipeline with a plugin-oriented separation between orchestration and rendering engines",
    placement: "Creator Studio background media worker or SONARA-owned image transform layer after performance/security review",
    productFit: ["Creator Studio", "Asset processing", "Internal development"],
    capabilities: ["fluent image transforms", "plugin architecture", "bitmap/WASM engine support", "SVG engine support", "provider-independent processing"],
    safety: [
      "Accept only bounded user-owned or licensed media and validate file type, dimensions, decompression ratio, and transform count before processing.",
      "Treat third-party plugins as executable supply-chain dependencies; allowlist and pin them rather than loading arbitrary customer-supplied plugins.",
      "Keep heavy image work out of the synchronous Vercel request path and preserve deterministic output metadata for reproducibility."
    ],
    blockedUses: ["arbitrary plugin loading", "unbounded decompression or image dimensions", "unlicensed media processing", "synchronous production request-path transforms without limits"],
    nextStep: "Benchmark one SONARA-owned image transform recipe against the current Creator Studio path and record CPU, memory, output fidelity, and deterministic-result behavior before adopting any package."
  }),
  record({
    key: "feynman",
    label: "Feynman",
    repository: "advaitpaliwal/feynman",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "scientific_research_agent",
    integrationStatus: "research_only",
    integrationMode: "source_grounded_research_pattern",
    role: "Scientific research-agent workflow centered on hypothesis formation, literature review, experimentation, verification, citation checks, and reproducibility",
    placement: "Research Lab methodology and assistant skills; no direct production agent runtime adoption",
    productFit: ["Research Lab", "Founder research", "ChatGPT/Codex skills", "Claude skills"],
    capabilities: ["literature discovery", "claim verification", "experiment planning", "citation auditing", "review workflows", "reproducibility checks"],
    safety: [
      "Do not execute upstream curl-pipe-shell installation commands or import its runtime simply to copy the workflow idea.",
      "Keep primary-source evidence, contradiction checks, uncertainty, and citation verification explicit; model-generated claims are not evidence.",
      "Do not send private SONARA source, customer records, or unpublished business data to unapproved model or search providers."
    ],
    blockedUses: ["remote install scripts in production", "automatic publication of research conclusions", "uncited factual claims", "unapproved provider access to private data"],
    nextStep: "Implement an original SONARA source-grounded research skill that requires an evidence matrix, contradiction check, citation validation, uncertainty statement, and reproducibility/verification step before conclusions are accepted."
  }),
  record({
    key: "kubeopt",
    label: "KubeOpt",
    repository: "kubeopt/kubeopt",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "kubernetes_resource_optimizer",
    integrationStatus: "research_only",
    integrationMode: "infrastructure_observability_reference",
    role: "Kubernetes resource-usage observation, recommendation, and optional request/limit optimization with dashboard and server components",
    placement: "Founder operations research only until SONARA actually operates Kubernetes workloads",
    productFit: ["Founder operations", "Admin Command Center", "Future infrastructure cost optimization"],
    capabilities: ["pod memory observation", "SQLite-backed history", "resource recommendations", "dashboard", "optional autoscaling/resource mutation"],
    safety: [
      "Do not deploy a Kubernetes optimizer into an environment SONARA does not operate; current Vercel/Supabase production does not become Kubernetes by research decree.",
      "Any future resource mutation must require explicit change-control boundaries, rollback, namespace allowlists, dry-run evidence, and owner approval for production-impacting changes.",
      "Keep optional model recommendations advisory unless a separately reviewed automation policy authorizes a specific bounded action."
    ],
    blockedUses: ["automatic production cluster mutation", "cross-namespace changes without allowlists", "deployment solely to create a use case", "treating model recommendations as authoritative capacity data"],
    nextStep: "Keep as a future infrastructure reference. Re-evaluate only if SONARA begins operating Kubernetes workloads; until then, focus cost/readiness work on the actual Vercel, Supabase, Stripe, and worker infrastructure in use."
  }),
  record({
    key: "edgepilot",
    label: "EdgePilot",
    repository: "pricootz/edgepilot",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "local_desktop_system_monitor",
    integrationStatus: "curated_reference",
    integrationMode: "desktop_interaction_reference",
    role: "Local-first screen-edge system monitor and ambient-signal interaction pattern for Windows and Linux",
    placement: "Founder desktop/Admin Command Center design research; not the hosted SONARA web runtime",
    productFit: ["Founder operations", "Admin Command Center", "Desktop companion research"],
    capabilities: ["CPU and memory telemetry", "disk and network metrics", "edge-mounted pill UI", "tray integration", "local-first settings", "ambient signal concepts"],
    safety: [
      "Keep hostnames, disk labels, local paths, and machine telemetry on the owner device unless an explicit telemetry policy authorizes collection.",
      "Do not introduce a .NET/Avalonia desktop runtime into the web product merely to copy the interaction pattern.",
      "Any future desktop companion needs signed packages, explicit update policy, least-privilege OS access, and opt-in diagnostics before distribution."
    ],
    blockedUses: ["silent workstation telemetry upload", "production web dependency", "collecting customer device metrics without consent", "shipping unsigned production desktop binaries"],
    nextStep: "Prototype the compact edge-status interaction as a SONARA-owned desktop/admin concept first; adopt upstream code only if a real cross-platform desktop requirement justifies the runtime."
  }),
  record({
    key: "phi_cookbook",
    label: "Microsoft Phi Cookbook",
    repository: "microsoft/PhiCookBook",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "small_language_model_cookbook",
    integrationStatus: "curated_reference",
    integrationMode: "local_edge_model_reference",
    role: "Hands-on recipes for running and integrating Microsoft Phi small language and multimodal models across local, edge, and cloud environments",
    placement: "Provider Gateway and local-model research; examples are reference material, not a second production model authority",
    productFit: ["Provider Gateway", "Personal/local agent research", "Creator Studio", "Internal development"],
    capabilities: ["local SLM examples", "multimodal recipes", "edge deployment patterns", "GitHub Models examples", "Microsoft Foundry examples"],
    safety: [
      "The cookbook code license does not grant blanket rights to every model weight, dataset, service, or dependency used by an example; verify those licenses separately.",
      "Keep Provider Gateway as SONARA's model/provider boundary and require a measured latency, privacy, cost, or offline benefit before adding a local-model adapter.",
      "Do not place personal access tokens or model-service credentials in source, screenshots, prompts, or client bundles."
    ],
    blockedUses: ["assuming all Phi model weights share the cookbook license", "bypassing Provider Gateway", "hard-coded model credentials", "shipping unbenchmarked local inference as launch-critical"],
    nextStep: "Benchmark one bounded local/edge Phi use case against the existing Provider Gateway for latency, memory, quality, privacy, and cost before deciding whether SONARA needs an optional local-model adapter."
  }),
  record({
    key: "davinci_resolve_mcp",
    label: "DaVinci Resolve MCP Server",
    repository: "samuelgursky/davinci-resolve-mcp",
    license: "MIT",
    licenseRisk: "high",
    runtimeClass: "local_media_editor_control_bridge",
    integrationStatus: "research_only",
    integrationMode: "isolated_media_worker_after_security_review",
    role: "Local MCP bridge that can inspect and control DaVinci Resolve Studio through Resolve's official scripting API",
    placement: "Creator Studio owner workstation or isolated media worker only; never the Vercel request process",
    productFit: ["Creator Studio", "Owner media production", "Internal post-production"],
    capabilities: ["timeline and media-pool control", "render setup", "review markers", "grading and Fusion workflows", "Fairlight workflows", "source-safe media analysis"],
    safety: [
      "Treat social claims about specific frontier models driving Resolve as unverified marketing unless the upstream repository documents and tests that exact provider/model path.",
      "Recent September 2026 security advisories affected safe-mode enforcement and an optional network transport; do not enable a pinned release until those fixes and the chosen transport are independently reviewed.",
      "Prefer the local stdio transport, dry-run/plan-review-confirm flows, user-owned media, least-privilege filesystem access, and explicit project backups before mutating edits."
    ],
    blockedUses: ["networked control without authentication review", "project deletion without explicit confirmation", "plugin or script execution that bypasses safety gates", "autonomous publishing or destructive edits", "production secret access"],
    nextStep: "In a disposable Resolve project, review the current patched release and test read-only inspection plus a non-destructive timeline action through local stdio before considering a Creator Studio workstation adapter."
  }),
  record({
    key: "sceneflow",
    label: "SceneFlow",
    repository: "taruma/SceneFlow",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "script_video_fidelity_workspace",
    integrationStatus: "curated_reference",
    integrationMode: "creator_evaluation_pattern",
    role: "Script-to-screen synchronization and prompt-adherence review workspace for AI-generated video",
    placement: "Creator Studio evaluation UX and project-schema research",
    productFit: ["Creator Studio", "AI video evaluation", "Prompt iteration"],
    capabilities: ["script-to-video cue sync", "prompt-adherence review", "cue categories", "portable JSON projects", "local browser storage", "manual or externally generated cue mapping"],
    safety: [
      "Do not treat cue highlighting as an objective quality score; preserve reviewer judgment and source evidence.",
      "Remote project URLs and user media must be validated and restricted to user-owned or authorized content before any SONARA implementation fetches them.",
      "Prefer a SONARA-owned cue/project schema over importing the whole application unless a measured implementation gap justifies a dependency."
    ],
    blockedUses: ["automatic quality verdicts presented as fact", "unvalidated remote project ingestion", "unlicensed media ingestion", "automatic publication of generated video"],
    nextStep: "Prototype a small Creator Studio script-to-render comparison view using SONARA-owned data, then measure whether cue-level adherence review materially improves video iteration before adopting code."
  }),
  record({
    key: "lead_gen_api_stack",
    label: "Lead Generation API Stack",
    repository: "cporter202/lead-gen-api-stack",
    license: "NONE DECLARED",
    licenseRisk: "high",
    runtimeClass: "lead_generation_api_directory",
    integrationStatus: "reference_only_no_license",
    integrationMode: "business_research_directory",
    role: "Curated README directory of third-party lead-generation, prospecting, and outreach APIs, including affiliate-linked services",
    placement: "Business Builder market/API research only; no repository code adoption and no automatic provider onboarding",
    productFit: ["Business Builder", "Growth Studio", "Market research"],
    capabilities: ["lead-provider discovery", "API category comparison", "prospecting workflow ideas", "outreach vendor discovery"],
    safety: [
      "The repository currently declares no software license; treat the material as research/reference and do not copy code or content into SONARA as licensed source.",
      "Independently verify every third-party API's terms, privacy posture, data provenance, pricing, consent requirements, platform rules, and any affiliate/vendor claims before any integration.",
      "Do not build indiscriminate scraping or unsolicited bulk outreach from a marketing claim; require lawful purpose, suppression/opt-out controls, rate limits, auditability, and owner-approved campaign policy."
    ],
    blockedUses: ["copying unlicensed repository content into product code", "credential or contact-data harvesting outside authorized terms", "automated unsolicited bulk outreach", "bypassing platform anti-abuse controls", "treating affiliate claims as independent validation"],
    nextStep: "Use the directory only to seed a provider-evaluation matrix; independently vet a small number of legitimate APIs against Growth Studio's compliance, cost, provenance, and consent requirements before building any adapter."
  })
]);

const UNVERIFIED_SCREENSHOT_LEADS_BATCH2 = Object.freeze([
  Object.freeze({
    key: "coding_agent_merge_button_lead",
    label: "Coding-agent / keep-the-merge-button post",
    observedTheme: "AI coding workflow that emphasizes retaining human merge control",
    status: "unverified_visual_lead",
    reason: "The screenshot theme is legible, but the exact upstream repository identity is not reliable enough to record an owner, URL, or license.",
    productFit: ["Internal development", "Release engineering"],
    nextStep: "Resolve the exact upstream from a readable repository header or direct link, then compare its approval model with SONARA's existing pull-request and controlled-deployment gates."
  }),
  Object.freeze({
    key: "anatomy_3d_lead",
    label: "Interactive 3D anatomy post",
    observedTheme: "Interactive browser-based 3D anatomy/visual learning experience",
    status: "unverified_visual_lead",
    reason: "The visual product can be described, but the exact upstream project and licensing cannot be established from the screenshot alone.",
    productFit: ["3D interaction research", "Creator Studio visualization patterns"],
    nextStep: "Resolve the source first; if verified, evaluate only reusable interaction/rendering patterns unless SONARA has a concrete licensed 3D-content use case."
  }),
  Object.freeze({
    key: "sceneai_service_reference",
    label: "SceneAI prompt library",
    observedTheme: "Commercial library of prompts and examples for animated web sections, backgrounds, and landing pages",
    status: "verified_hosted_service_reference",
    reason: "The sceneai.art service is verifiable, but no authoritative public source repository or open-source code license was established from this intake, so it does not belong in the executable repository catalog.",
    productFit: ["SONARA public website", "Creator Studio", "Design-system research"],
    nextStep: "Use only as visual/prompt-market research. Review the service license before reusing any premium prompt or asset, and build SONARA-owned layouts rather than copying another product's identity."
  })
]);

function record(input) {
  return Object.freeze({
    repositoryVerified: true,
    repoUrl: `https://github.com/${input.repository}`,
    launchImpact: "optional",
    enabledInProduction: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch2_2026_09_13",
    blockedUses: [],
    ...input
  });
}

function getPublicScreenshotToolCatalogBatch2() {
  return SCREENSHOT_TOOL_RADAR_BATCH2.map((item) => ({
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

function getScreenshotToolReadinessBatch2() {
  const repositories = getPublicScreenshotToolCatalogBatch2().map((item) => ({
    ...item,
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    canExecute: false
  }));

  return {
    ok: true,
    mode: "static_governed_screenshot_research_batch2",
    repositoryCount: repositories.length,
    verifiedCount: repositories.length,
    blockedCount: repositories.filter((item) => item.integrationStatus === "blocked").length,
    productionExecutionCount: 0,
    unresolvedVisualLeadCount: UNVERIFIED_SCREENSHOT_LEADS_BATCH2.length,
    repositories,
    unresolvedVisualLeads: UNVERIFIED_SCREENSHOT_LEADS_BATCH2.map((item) => ({ ...item }))
  };
}

function getUnverifiedScreenshotLeadsBatch2() {
  return UNVERIFIED_SCREENSHOT_LEADS_BATCH2.map((item) => ({
    ...item,
    productFit: [...item.productFit]
  }));
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH2,
  UNVERIFIED_SCREENSHOT_LEADS_BATCH2,
  getPublicScreenshotToolCatalogBatch2,
  getScreenshotToolReadinessBatch2,
  getUnverifiedScreenshotLeadsBatch2
};
