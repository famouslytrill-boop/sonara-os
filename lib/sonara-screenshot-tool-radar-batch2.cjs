"use strict";

// Second screenshot-led intake batch. Verified repository records are eligible
// for Research Lab display only. Nothing here is installed, imported, executed,
// or enabled in production. Ambiguous screenshots are kept separately as visual
// leads so the project never invents an owner, URL, or license from fuzzy pixels.

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
    key: "desktop_pill_tracker_lead",
    label: "Desktop pill activity tracker post",
    observedTheme: "Small desktop status/activity surface for side-project or work tracking",
    status: "unverified_visual_lead",
    reason: "The product concept is visible, but the exact repository name/owner cannot be established confidently from the supplied pixels.",
    productFit: ["Founder operations", "Desktop companion research"],
    nextStep: "Obtain the direct repository link before evaluating telemetry, local-data handling, operating-system permissions, or whether the UI concept belongs in SONARA."
  }),
  Object.freeze({
    key: "anatomy_3d_lead",
    label: "Interactive 3D anatomy post",
    observedTheme: "Interactive browser-based 3D anatomy/visual learning experience",
    status: "unverified_visual_lead",
    reason: "The visual product can be described, but the exact upstream project and licensing cannot be established from the screenshot alone.",
    productFit: ["3D interaction research", "Creator Studio visualization patterns"],
    nextStep: "Resolve the source first; if verified, evaluate only reusable interaction/rendering patterns unless SONARA has a concrete licensed 3D-content use case."
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
