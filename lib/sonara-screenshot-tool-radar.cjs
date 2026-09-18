// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// This is an intake/research catalog, not an executable plugin registry.
// Nothing in this file is cloned, installed, imported, or enabled at runtime.
// External tools must still pass source, license, security, cost, and product-fit
// review before becoming a dependency or worker adapter.

const SCREENSHOT_TOOL_RADAR = Object.freeze([
  record({
    key: "browser_use_pi",
    label: "Browser Use Pi",
    repository: "browser-use/browser-use-pi",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "browser_automation_agent",
    integrationStatus: "optional_adapter_after_review",
    integrationMode: "isolated_browser_worker",
    role: "Programmable browser-agent runtime using a persistent V8 REPL and Chrome DevTools Protocol",
    placement: "Isolated worker or owner-operated development environment; never the Vercel request process",
    productFit: ["Founder operations", "Business Builder", "Internal development"],
    capabilities: ["browser sessions", "typed results", "saved workspaces", "CDP automation", "screenshots and recordings"],
    safety: [
      "Restrict browsing to user-authorized destinations and tasks; do not defeat access controls or bot protections.",
      "Run untrusted tasks in an isolated machine because the upstream runtime can execute JavaScript with filesystem and network access.",
      "Use narrowly scoped credentials and cap steps, wall time, and spend before any production pilot."
    ],
    blockedUses: ["credential harvesting", "access-control bypass", "unbounded autonomous browsing", "production secret access"],
    nextStep: "Prototype one read-only owner workflow in an isolated worker and compare reliability against SONARA's existing browser/tooling path before adopting a dependency."
  }),
  record({
    key: "quickliquid",
    label: "QuickLiquid",
    repository: "amarnath3003/quickLiquid",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "ui_effects_library",
    integrationStatus: "curated_reference",
    integrationMode: "design_reference_first",
    role: "Apple-style refractive liquid-glass effects for React and vanilla DOM surfaces",
    placement: "Design-system research; any production use must be selective and performance-gated",
    productFit: ["SONARA public website", "Creator Studio", "Design system"],
    capabilities: ["SVG backdrop refraction", "spring gestures", "chromatic edge effects", "grouped glass surfaces"],
    safety: [
      "Treat glass effects as progressive enhancement, never as the only affordance or contrast boundary.",
      "Require reduced-motion behavior, keyboard usability, readable contrast, and graceful non-Chromium fallback.",
      "Benchmark Core Web Vitals and GPU cost before shipping effects on high-traffic surfaces."
    ],
    blockedUses: ["site-wide mandatory glass layer", "motion without reduced-motion fallback", "copying visual identity wholesale"],
    nextStep: "Recreate one SONARA-owned navigation or command surface with the underlying optical ideas, then measure accessibility and performance before considering the package."
  }),
  record({
    key: "l0p4map",
    label: "L0p4Map",
    repository: "HaxL0p4/L0p4Map",
    license: "GPL-3.0",
    licenseRisk: "high",
    runtimeClass: "network_security_tool",
    integrationStatus: "staging_only",
    integrationMode: "authorized_security_reference",
    role: "Network discovery, nmap integration, topology visualization, and security-research interface",
    placement: "Owner-controlled lab or explicitly authorized security environment only",
    productFit: ["Internal application security", "Founder operations"],
    capabilities: ["ARP discovery", "nmap integration", "network topology", "traffic and vulnerability-oriented views"],
    safety: [
      "Only scan networks, hosts, and services SONARA owns or has explicit authorization to test.",
      "Do not embed or distribute GPL code inside the hosted SONARA application without a separate license review.",
      "Keep target allowlists, rate limits, audit logs, and non-production credentials around any security-lab use."
    ],
    blockedUses: ["third-party scanning", "customer-accessible port scanning", "stealth or access-control bypass", "production credential use"],
    nextStep: "Keep as a lab reference. If network observability becomes a product requirement, design a SONARA-owned inventory surface from authorized telemetry rather than embedding a penetration-testing application."
  }),
  record({
    key: "hyperframes",
    label: "HyperFrames",
    repository: "heygen-com/hyperframes",
    license: "Apache-2.0",
    licenseRisk: "medium",
    runtimeClass: "video_rendering_framework",
    integrationStatus: "optional_adapter_after_review",
    integrationMode: "isolated_media_worker",
    role: "Deterministic HTML/CSS/media-to-video rendering for agent-authored compositions",
    placement: "Creator Studio background rendering worker; never the synchronous production request process",
    productFit: ["Creator Studio", "Marketing production", "Internal demos"],
    capabilities: ["HTML-native compositions", "seekable animation", "FFmpeg rendering", "Puppeteer capture", "reusable video blocks", "agent skills"],
    safety: [
      "Render only sanitized, user-owned or licensed media in isolated per-job workspaces.",
      "Apply file-size, duration, codec, network-egress, and execution-time limits before processing customer media.",
      "Preserve Apache-2.0 attribution and pin versions before enabling any worker adapter."
    ],
    blockedUses: ["arbitrary remote HTML execution", "untrusted shell passthrough", "synchronous Vercel rendering", "unlicensed media ingestion"],
    nextStep: "Build a disposable worker proof that renders one SONARA-owned 10-second composition, records deterministic output hashes, and measures CPU/memory/FFmpeg requirements."
  }),
  record({
    key: "iris",
    label: "Iris",
    repository: "brijr/iris",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "visual_qa_camera",
    integrationStatus: "developer_only",
    integrationMode: "local_cli_or_mcp",
    role: "Fast website screenshot capture for coding agents through CLI or local stdio MCP",
    placement: "Local development and CI visual verification",
    productFit: ["Internal development", "QA", "Design system"],
    capabilities: ["desktop/mobile screenshots", "selector capture", "full-page capture", "dark-mode capture", "machine-readable output"],
    safety: [
      "Use as a camera, not as an interaction or credential automation layer.",
      "Restrict automated capture to SONARA-controlled, test, localhost, or otherwise authorized URLs.",
      "Do not treat a successful screenshot as proof that authentication, payments, or database writes work."
    ],
    blockedUses: ["credential capture", "third-party scraping without authorization", "substituting visual proof for functional tests"],
    nextStep: "Pilot as an optional developer camera for responsive regression evidence and attach screenshots to UI-change pull requests."
  }),
  record({
    key: "viberaven",
    label: "VibeRaven",
    repository: "ohad6k/VibeRaven",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "developer_control_cockpit",
    integrationStatus: "developer_only",
    integrationMode: "local_readiness_console",
    role: "Local cockpit for repository architecture, provider state, releases, launch blockers, and coding-agent control",
    placement: "Owner/developer workstation only",
    productFit: ["Founder operations", "Internal development", "Release engineering"],
    capabilities: ["repository mapping", "provider readiness", "release drift", "agent chat", "production-readiness checks"],
    safety: [
      "Keep provider proof separate from code changes and never grant a local cockpit unrestricted production secrets by default.",
      "Require human review for agent-produced patches, merges, deployments, billing changes, and destructive actions.",
      "Use it as an independent diagnostic reference; SONARA's own release gates remain authoritative."
    ],
    blockedUses: ["automatic merge", "automatic deploy", "unscoped production credentials", "replacing SONARA release gates with a UI verdict"],
    nextStep: "Run its read-only launch check against a disposable checkout and compare findings with SONARA's controlled-production diagnostics before deciding whether it adds unique signal."
  }),
  record({
    key: "langchain",
    label: "LangChain",
    repository: "langchain-ai/langchain",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "agent_application_framework",
    integrationStatus: "research_only",
    integrationMode: "pattern_reference_before_dependency",
    role: "Framework and ecosystem for agents, LLM applications, tools, retrieval, and model/provider integrations",
    placement: "Architecture research and isolated prototypes",
    productFit: ["SONARA One", "Internal development", "Provider Gateway"],
    capabilities: ["agent composition", "tool orchestration", "retrieval patterns", "provider integrations", "middleware patterns"],
    safety: [
      "Do not add a framework dependency merely because a pattern exists; SONARA already has explicit provider and agent-control boundaries.",
      "Route consequential actions through SONARA's owner-approval gate even if an external agent framework can execute them directly.",
      "Pin any adopted package and test provider, tracing, data-retention, and tenant-isolation behavior."
    ],
    blockedUses: ["bypassing Provider Gateway", "bypassing agent authority rules", "unreviewed tracing of customer data", "framework-driven secret exposure"],
    nextStep: "Use as a pattern library first. Adopt a package only when a measured capability gap is cheaper and safer to close with LangChain than with SONARA's existing runtime."
  }),
  record({
    key: "deepwiki_rs",
    label: "Litho / deepwiki-rs",
    repository: "sopaco/deepwiki-rs",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "codebase_documentation_generator",
    integrationStatus: "developer_only",
    integrationMode: "isolated_documentation_worker",
    role: "Generate architecture documentation and AI-ready codebase context from repositories",
    placement: "Local development or locked-down documentation CI",
    productFit: ["Internal development", "Research Lab", "Documentation"],
    capabilities: ["codebase analysis", "Markdown documentation", "architecture context", "C4-oriented documentation", "agent context generation"],
    safety: [
      "Run against a read-only checkout and require review before generated documentation is merged.",
      "Keep private source and generated context inside SONARA-controlled storage and do not send it to unapproved model providers.",
      "Evaluate the upstream successor Terrain before adopting new infrastructure because deepwiki-rs has evolved into that broader project."
    ],
    blockedUses: ["automatic documentation merge", "sending private code to unapproved providers", "treating generated diagrams as authoritative without source verification"],
    nextStep: "Compare a local documentation run with SONARA's existing generated handoff/docs pipeline; adopt only the pieces that produce better, verifiable architecture context."
  }),
  record({
    key: "offpack",
    label: "OFFPack",
    repository: "Assemou007/OFFPack",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "offline_package_cache",
    integrationStatus: "research_only",
    integrationMode: "package_cache_concept",
    role: "Lightweight Go-based offline npm dependency cache and installer",
    placement: "Developer-tool research only",
    productFit: ["Internal development", "Build resilience"],
    capabilities: ["local package cache", "offline dependency installation", "registry resolution"],
    safety: [
      "SONARA's repository rule is pnpm-only; do not replace pnpm or introduce a second package-manager authority.",
      "Do not trust a local cache without integrity verification, lockfile agreement, and supply-chain provenance.",
      "A young package manager must not sit on the production release path without extensive reproducibility and security testing."
    ],
    blockedUses: ["replacing pnpm", "ignoring pnpm-lock.yaml", "unsigned/unverified cache artifacts", "production release dependency"],
    nextStep: "Study its local-cache design only. If offline installs are needed, first evaluate pnpm's native store/fetch/offline capabilities so the project keeps one package-manager contract."
  })
]);

function record(input) {
  return Object.freeze({
    repositoryVerified: true,
    repoUrl: `https://github.com/${input.repository}`,
    launchImpact: "optional",
    enabledInProduction: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_2026_09_13",
    blockedUses: [],
    ...input
  });
}

function getPublicScreenshotToolCatalog() {
  return SCREENSHOT_TOOL_RADAR.map((item) => ({
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

function getScreenshotToolReadiness() {
  const repositories = getPublicScreenshotToolCatalog().map((item) => ({
    ...item,
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    canExecute: false
  }));

  return {
    ok: true,
    mode: "static_governed_screenshot_research",
    repositoryCount: repositories.length,
    verifiedCount: repositories.length,
    blockedCount: repositories.filter((item) => item.integrationStatus === "blocked").length,
    productionExecutionCount: 0,
    repositories
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR,
  getPublicScreenshotToolCatalog,
  getScreenshotToolReadiness
};
