// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Fifth screenshot-led intake batch. These records are research/catalog state
// only. No third-party repository is installed, imported, executed, or enabled
// in production by this file.

const SCREENSHOT_TOOL_RADAR_BATCH5 = Object.freeze([
  record({
    key: "claude_ads",
    label: "Claude Ads",
    repository: "AgriciDaniel/claude-ads",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "paid_media_agent_skill_and_control_plane",
    integrationStatus: "developer_tool_candidate",
    integrationMode: "growth_studio_paid_media_reference",
    role: "Claude-first paid-media operations skill covering audits, planning, creative workflows, monitoring, experiments, reporting, and capability-gated account changes across major advertising platforms",
    placement: "Growth Studio research and founder/operator tooling; read-only audits may be prototyped before any platform write capability is considered",
    productFit: ["Growth Studio", "Paid media operations", "Campaign auditing", "Marketing reporting", "Agent governance"],
    capabilities: ["source-grounded ad audits", "campaign planning", "creative briefs", "monitoring", "experiments", "versioned JSON reports", "draft mutations", "capability-gated writes"],
    safety: [
      "Keep every advertising adapter read-only by default; live writes require explicit platform/account authorization, before/after diff, blast-radius review, owner approval, idempotency, audit logging, rollback, and post-change verification.",
      "Credentials and client data stay in approved secret/data stores and never enter Git history, prompts, screenshots, reports, or research fixtures.",
      "Platform API terms, ad policy, billing authority, consent/privacy requirements, account ownership, and regional advertising law remain separate from the repository's MIT code license."
    ],
    blockedUses: ["automatic campaign launches", "unsupervised budget increases", "cross-client credential reuse", "bulk account mutation without per-operation approval", "treating repository controls as a substitute for platform terms"],
    nextStep: "Run a synthetic, read-only Growth Studio audit benchmark against SONARA's existing campaign/reporting model, then adopt only the evidence, scoring, capability-manifest, and rollback patterns that close measured gaps."
  }),
  record({
    key: "terrain",
    label: "Terrain",
    repository: "sopaco/terrain",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "agent_ready_engineering_environment",
    integrationStatus: "developer_tool_candidate",
    integrationMode: "local_repository_knowledge_and_agent_environment_reference",
    role: "Rust-based engineering environment that generates codebase knowledge assets, agent context, C4 documentation, freshness tracking, search/Q&A, shared agent contracts, and optional tool/skill environment setup",
    placement: "Developer/Founder engineering workstation and CI research; not part of the customer-facing Vercel request runtime",
    productFit: ["Developer tooling", "Architecture documentation", "Agent context", "CI knowledge refresh", "SONARA One engineering operations"],
    capabilities: ["C4 docs", "agent context packs", "repomix source index", "freshness scoring", "knowledge search/Q&A", "CLI JSON output", "agent environment planning", "CI refresh workflows"],
    safety: [
      "Treat repository scanning and generated context as sensitive engineering data; do not send private source, secrets, or customer data to an unapproved LLM endpoint.",
      "Use environment planning/dry-run before any command that installs tools, skills, managed AGENTS.md snippets, or changes workstation state.",
      "Generated architecture and Q&A are derived artifacts, not source truth; keep provenance, freshness scores, and direct-source verification for consequential engineering decisions."
    ],
    blockedUses: ["automatic workstation mutation in production", "overwriting SONARA agent policy files without review", "sending private repositories to unapproved providers", "treating generated docs as stronger evidence than source code"],
    nextStep: "Benchmark Terrain locally against SONARA's current handoff, architecture-map, and research-doc workflow using a disposable clone; compare freshness, token cost, C4 accuracy, and agent navigation before any developer-tool adoption."
  }),
  record({
    key: "anything2explainer",
    label: "anything2explainer",
    repository: "Vincentwei1021/anything2explainer",
    license: "PolyForm Noncommercial 1.0.0",
    licenseRisk: "high",
    runtimeClass: "agent_driven_remotion_explainer_video_pipeline",
    integrationStatus: "research_only_license_gated",
    integrationMode: "creator_studio_explainer_video_reference",
    role: "Claude Code/Codex skill and Remotion pipeline that turns a researched topic into deterministic motion-graphics explainer video with narration, TTS, subtitles, chapter progress, parallel shot construction, rendering, and QC",
    placement: "Creator Studio workflow benchmark only unless the author grants commercial authorization for SONARA's use of the toolkit",
    productFit: ["Creator Studio", "Explainer video", "Remotion", "TTS", "Agent video production", "Quality control"],
    capabilities: ["sourced research", "narration", "storyboarding", "TTS alignment", "parallel Remotion shot building", "subtitles", "rendering", "frame metrics", "chapter QC"],
    safety: [
      "The toolkit is PolyForm Noncommercial: commercial SONARA use requires prior authorization from the author; generated videos are separately described by the project as belonging to their creators.",
      "TTS engines, fonts, optional footage, source material, and external endpoints have their own licenses/terms and must be tracked independently.",
      "Rendering should run in an isolated media worker with bounded CPU, memory, disk, browser, subprocess, and network access; never inside the synchronous Vercel request path."
    ],
    blockedUses: ["commercial production use without author authorization", "copying the toolkit into a paid SONARA product", "unbounded headless-browser/FFmpeg execution", "using unlicensed media or voices", "publishing unsourced factual claims"],
    nextStep: "Use the public workflow as a clean-room Creator Studio requirements benchmark—research, narration lock, pilot preview, parallel shot build, deterministic render, and QC—without copying protected toolkit code into commercial SONARA paths."
  })
]);

const NON_REPOSITORY_REFERENCES_BATCH5 = Object.freeze([
  Object.freeze({
    key: "openai_agents_platform_reference",
    label: "OpenAI Agents API / Agents SDK / Responses API",
    status: "verified_platform_reference",
    source: "official_openai_2026_09",
    observedTheme: "Managed long-running agent sessions, controlled environments, tools, subagents, and agent orchestration",
    correction: "The screenshot compresses several layers into one. As of 2026-09-14, OpenAI's Agents API is a public-beta managed agent-session API powered by the Codex harness; the Agents SDK remains an orchestration toolkit, while the Responses API remains a lower-level model/tool primitive. They are complementary rather than one single replacement object.",
    productFit: ["SONARA One", "Personal Agent OS", "Long-running agents", "Provider Gateway evaluation"],
    safety: [
      "Treat the Agents API as beta infrastructure and pin API/SDK versions plus contract tests before customer-critical use.",
      "Keep SONARA's own owner-approval, tenant, audit, cost, provider, data-retention, and tool-authority boundaries authoritative even when OpenAI manages the agent harness or environment.",
      "Do not move private repositories, customer files, credentials, or consequential tools into hosted agent sessions until the data path, environment choice, vault/tool permissions, retention posture, and rollback story have been explicitly approved."
    ],
    nextStep: "Build a non-production architecture spike comparing a managed Agents API session against SONARA's existing runner for one long-horizon coding/research task, measuring reliability, latency, token/tool cost, observability, data boundary, and approval-hook fit."
  })
]);

const DEDUPLICATED_SCREENSHOT_REFERENCES_BATCH5 = Object.freeze([
  Object.freeze({ key: "iris", repository: "brijr/iris", existingBatch: 1 }),
  Object.freeze({ key: "deepwiki_rs", repository: "sopaco/deepwiki-rs", existingBatch: 1, note: "Screenshot additionally confirms the upstream-directed evolution path to sopaco/terrain, which is recorded as a new Batch 5 repository." }),
  Object.freeze({ key: "viberaven", repository: "ohad6k/VibeRaven", existingBatch: 1 }),
  Object.freeze({ key: "offpack", repository: "Assemou007/OFFPack", existingBatch: 1 }),
  Object.freeze({ key: "langchain", repository: "langchain-ai/langchain", existingBatch: 1 })
]);

function record(input) {
  return Object.freeze({
    repositoryVerified: true,
    repoUrl: `https://github.com/${input.repository}`,
    launchImpact: "optional",
    enabledInProduction: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch5_2026_09_14",
    blockedUses: [],
    ...input
  });
}

function getPublicScreenshotToolCatalogBatch5() {
  return SCREENSHOT_TOOL_RADAR_BATCH5.map((item) => ({
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

function getScreenshotToolReadinessBatch5() {
  const repositories = getPublicScreenshotToolCatalogBatch5().map((item) => ({
    ...item,
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    canExecute: false
  }));
  return {
    ok: true,
    mode: "static_governed_catalog",
    repositoryCount: repositories.length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH5.length,
    deduplicatedReferenceCount: DEDUPLICATED_SCREENSHOT_REFERENCES_BATCH5.length,
    productionExecutionCount: repositories.filter((item) => item.enabledInProduction).length,
    repositories,
    nonRepositoryReferences: NON_REPOSITORY_REFERENCES_BATCH5.map((item) => ({ ...item })),
    deduplicatedReferences: DEDUPLICATED_SCREENSHOT_REFERENCES_BATCH5.map((item) => ({ ...item }))
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH5,
  NON_REPOSITORY_REFERENCES_BATCH5,
  DEDUPLICATED_SCREENSHOT_REFERENCES_BATCH5,
  getPublicScreenshotToolCatalogBatch5,
  getScreenshotToolReadinessBatch5
};
