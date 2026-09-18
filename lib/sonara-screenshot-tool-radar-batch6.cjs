// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Sixth screenshot-led intake batch, submitted 2026-09-14.
// Research/catalog state only: nothing here installs, executes, or enables a
// third-party project. Every record stays disabled until a separate adoption,
// security, privacy, license, and runtime review explicitly changes that state.

const SCREENSHOT_TOOL_RADAR_BATCH6 = Object.freeze([
  record({
    key: "social_analyzer",
    label: "Social Analyzer",
    repository: "qeeqbox/social-analyzer",
    license: "AGPL-3.0",
    licenseRisk: "high",
    runtimeClass: "osint_social_profile_discovery",
    integrationStatus: "research_only",
    integrationMode: "authorized_brand_and_self_audit_reference",
    role: "API/CLI/web reference for finding public social-profile presence across many sites",
    placement: "Growth Studio brand research and privacy/security self-audit only; never a general people-search feature",
    productFit: ["Growth Studio", "Research Lab", "Admin Command Center", "Privacy self-audit"],
    capabilities: ["public-profile discovery", "username research", "API/CLI workflow patterns", "cross-source normalization"],
    safety: [
      "Limit use to identifiers the customer owns, controls, or is explicitly authorized to investigate, or documented organization/brand research.",
      "No doxxing, stalking, unconsented identity correlation, sensitive-trait inference, or use in employment, housing, credit, insurance, or similar high-impact decisions.",
      "AGPL-3.0 is reciprocal; do not embed or copy source into proprietary SONARA production paths without explicit compliance review."
    ],
    blockedUses: ["unconsented person tracking", "doxxing", "high-impact eligibility decisions", "platform-protection circumvention", "unreviewed AGPL source reuse"],
    nextStep: "If brand-presence checks are needed, build a clean-room permission-scoped adapter against approved public APIs and customer-supplied accounts."
  }),
  record({
    key: "maybe_finance",
    label: "Maybe Finance",
    repository: "maybe-finance/maybe",
    license: "AGPL-3.0",
    licenseRisk: "high",
    runtimeClass: "archived_personal_finance_application",
    integrationStatus: "curated_reference",
    integrationMode: "finance_ux_and_data_model_reference",
    role: "Archived personal-finance product reference for net worth, accounts, holdings, debt, planning, and finance dashboards",
    placement: "Business Builder finance/owner-operations UX research; not a source dependency or advice engine",
    productFit: ["Business Builder", "Founder Operations", "Financial operations", "Dashboard research"],
    capabilities: ["net-worth views", "account organization", "portfolio-allocation UX", "debt/planning UX", "manual financial tracking"],
    safety: [
      "Upstream is archived; treat it as historical architecture/UX reference rather than a maintained dependency.",
      "AGPL-3.0 is reciprocal; no server/UI source reuse in proprietary paths without review.",
      "SONARA may summarize user-provided records but must not turn this reference into individualized investment, tax, legal, or credit advice."
    ],
    blockedUses: ["live trading", "personalized investment advice", "credit eligibility decisions", "unreviewed AGPL source reuse"],
    nextStep: "Extract a clean-room finance-dashboard requirements matrix and map only non-advisory bookkeeping and owner-operations features into Business Builder."
  }),
  record({
    key: "recordly",
    label: "Recordly",
    repository: "webadderallorg/Recordly",
    license: "GitHub metadata NOASSERTION; submitted screenshot displays AGPL-3.0",
    licenseRisk: "high",
    runtimeClass: "desktop_screen_recorder_and_demo_editor",
    integrationStatus: "needs_license_review",
    integrationMode: "creator_demo_video_workflow_reference",
    role: "Cross-platform screen-recording/editing reference for polished demos, cursor emphasis, zooms, webcam overlays, and timeline editing",
    placement: "Creator Studio demo/tutorial workflow research; any executable adoption belongs in a reviewed desktop or isolated media-worker boundary",
    productFit: ["Creator Studio", "Product demos", "Tutorial videos", "Desktop companion research"],
    capabilities: ["screen recording", "timeline editing", "cursor effects", "zoom/pan effects", "webcam overlays", "demo export"],
    safety: [
      "Treat the license as unresolved until authoritative license terms are reviewed; a social screenshot badge is not sufficient redistribution evidence.",
      "Screen capture can expose credentials, customer data, notifications, private windows, microphone, and camera content; require explicit scope, redaction, and confirmation.",
      "No external upload by default; cloud processing requires approved provider, retention, and tenant-isolation controls."
    ],
    blockedUses: ["recording without consent", "capturing secrets without redaction", "source reuse before license review", "running desktop capture inside Vercel requests"],
    nextStep: "Use the workflow as a benchmark, then implement SONARA-owned capture/edit requirements or a separately reviewed desktop adapter."
  }),
  record({
    key: "aio_usb_drive",
    label: "All In One USB Drive",
    repository: "fathulfahmy/aio-usb-drive",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "portable_recovery_toolkit_reference",
    integrationStatus: "curated_reference",
    integrationMode: "founder_it_resilience_runbook_reference",
    role: "Curated multiboot USB reference for diagnostics, recovery, installers, and portable workstation utilities",
    placement: "Business Builder founder operations, support, recovery, and continuity documentation; not a hosted runtime dependency",
    productFit: ["Business Builder", "Founder Operations", "Support Center", "Business continuity"],
    capabilities: ["multiboot planning", "recovery-tool curation", "portable diagnostics", "offline installer reference", "workstation recovery checklist"],
    safety: [
      "Every linked ISO, rescue environment, installer, driver, and utility retains its own license and supply-chain risk; the list's MIT license does not license those tools.",
      "Never auto-download or auto-run third-party recovery binaries from a customer-facing web request.",
      "Require checksum/signature verification and explicit operator confirmation before adding tools to internal recovery media."
    ],
    blockedUses: ["automatic third-party binary execution", "treating the list license as covering linked tools", "writing customer devices without operator confirmation"],
    nextStep: "Convert useful categories into a SONARA-owned recovery checklist with vendor links, checksums, and review dates rather than bundling the collection."
  }),
  record({
    key: "i_have_adhd",
    label: "i-have-adhd",
    repository: "HulkAi/i-have-adhd",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "agent_output_style_skill",
    integrationStatus: "optional_adapter_after_review",
    integrationMode: "answer_first_accessibility_output_pattern",
    role: "Answer-first communication-style reference for reducing cognitive load in coding and general-purpose agent responses",
    placement: "SONARA One, coding assistant, onboarding, and accessibility preferences as an opt-in presentation mode",
    productFit: ["SONARA One", "AI Code Assistant", "Accessibility", "Developer Formula Studio"],
    capabilities: ["answer-first responses", "bounded next steps", "progress/state visibility", "reduced tangent density", "action-oriented summaries"],
    safety: [
      "Treat this only as a user-selectable communication preference, never as an ADHD diagnosis, screening result, or medical intervention.",
      "Do not omit safety-critical detail, uncertainty, legal terms, or necessary technical constraints for brevity.",
      "Users must be able to turn the style on or off; task semantics stay identical across presentation modes."
    ],
    blockedUses: ["diagnosing ADHD", "medical advice", "silently inferring a health condition", "hiding safety-critical information"],
    nextStep: "Prototype an opt-in SONARA answer-first preference with original rule text and test comprehension, completion, and safety-detail retention."
  }),
  record({
    key: "android_mic",
    label: "AndroidMic",
    repository: "teamclouday/AndroidMic",
    license: "GPL-3.0",
    licenseRisk: "high",
    runtimeClass: "desktop_mobile_audio_bridge",
    integrationStatus: "curated_reference",
    integrationMode: "creator_audio_capture_reference",
    role: "Reference for using an Android device as a PC microphone over Wi-Fi or USB with audio processing and desktop routing",
    placement: "Creator Studio and desktop-companion audio-capture research; not a browser-only or Vercel-server capability",
    productFit: ["Creator Studio", "Audio capture", "Desktop companion research"],
    capabilities: ["Android microphone streaming", "TCP/UDP transport", "USB serial/ADB transport", "noise reduction", "waveform/audio settings"],
    safety: [
      "Microphone access requires explicit visible user consent and local-device indicators; never record covertly.",
      "Network audio bridges must authenticate peers and avoid exposing unauthenticated microphone streams on shared networks.",
      "GPL-3.0 is reciprocal; use as a workflow/protocol reference unless a separately reviewed distribution model is approved."
    ],
    blockedUses: ["covert microphone capture", "unauthenticated remote audio exposure", "unreviewed GPL source reuse", "claiming browser-only support for desktop routing"],
    nextStep: "Document a SONARA desktop/mobile audio interface and security model; build an original adapter only if Creator Studio actually needs phone-as-microphone capture."
  }),
  record({
    key: "clash_verge_rev",
    label: "Clash Verge Rev",
    repository: "clash-verge-rev/clash-verge-rev",
    license: "GPL-3.0",
    licenseRisk: "high",
    runtimeClass: "desktop_proxy_configuration_client",
    integrationStatus: "research_only",
    integrationMode: "local_network_profile_ux_reference",
    role: "Tauri desktop UX reference for local proxy/profile configuration, rules, status visibility, and cross-platform network controls",
    placement: "Secure Compute and founder/developer desktop networking research only; not bot-evasion or traffic-concealment functionality",
    productFit: ["Secure Compute Layer", "Internal Development", "Desktop companion research"],
    capabilities: ["cross-platform Tauri UI", "local proxy profiles", "network-status visualization", "rule/configuration UX", "local log/settings patterns"],
    safety: [
      "Any SONARA networking feature stays limited to user-controlled local configuration, legitimate testing, privacy, or enterprise-routing use cases.",
      "No use to evade platform enforcement, defeat bot detection, scrape against site policy, bypass access controls, or conceal malicious traffic.",
      "GPL-3.0 is reciprocal; no client source reuse in proprietary production paths without review."
    ],
    blockedUses: ["bot-detection bypass", "unauthorized scraping", "access-control circumvention", "malicious traffic concealment", "unreviewed GPL source reuse"],
    nextStep: "Extract only safe local-network profile UX requirements; keep traffic-routing execution outside the hosted web process and behind explicit operator control."
  }),
  record({
    key: "trading_agents",
    label: "TradingAgents",
    repository: "TauricResearch/TradingAgents",
    license: "Apache-2.0",
    licenseRisk: "low",
    runtimeClass: "multi_agent_financial_research_framework",
    integrationStatus: "research_only",
    integrationMode: "multi_agent_research_architecture_reference",
    role: "Multi-agent LLM research reference for role separation, debate, synthesis, and risk-oriented reasoning",
    placement: "Research Lab and generic orchestration research only; no customer trading, order execution, or individualized financial recommendations",
    productFit: ["Research Lab", "Workflow Brain", "System Design Intelligence", "Agent orchestration research"],
    capabilities: ["role-specialized agents", "research synthesis", "debate/critique patterns", "risk-analysis patterns", "multi-provider orchestration"],
    safety: [
      "Apache-2.0 does not make live trading or individualized financial advice an approved SONARA capability.",
      "Do not connect the framework to brokerage credentials, order endpoints, customer portfolio actions, or autonomous capital allocation.",
      "Any reusable orchestration pattern must first be stripped of trading-specific tasks and validated on non-financial synthetic workflows."
    ],
    blockedUses: ["live order execution", "brokerage credential handling", "autonomous trading", "individualized investment advice", "customer portfolio management"],
    nextStep: "Benchmark only generic role/debate/verification orchestration on synthetic non-financial tasks before considering a SONARA-owned workflow."
  }),
  record({
    key: "diagram_design",
    label: "diagram-design",
    repository: "cathrynlavery/diagram-design",
    license: "MIT",
    licenseRisk: "low",
    runtimeClass: "agent_diagram_generation_skill",
    integrationStatus: "optional_adapter_after_review",
    integrationMode: "editorial_system_diagram_skill_reference",
    role: "Editorial diagram-design skill for self-contained HTML/SVG architecture, process, relationship, state, timeline, and analytical diagrams",
    placement: "Business Builder reports, Creator Studio explainers, Admin Command Center architecture views, and System Design Intelligence",
    productFit: ["Business Builder", "Creator Studio", "Admin Command Center", "System Design Intelligence"],
    capabilities: ["architecture diagrams", "flow/process diagrams", "sequence/state diagrams", "ER/relationship diagrams", "timelines/cycles", "self-contained HTML/SVG"],
    safety: [
      "Generate from customer-authorized data only and escape all labels/metadata before inserting them into HTML or SVG.",
      "Do not expose secrets, private infrastructure addresses, internal identifiers, or cross-tenant data in exported diagrams.",
      "Prefer a SONARA visual grammar or attributed MIT adaptation; diagrams must remain accessible without relying on color alone."
    ],
    blockedUses: ["unescaped user HTML", "publishing secret infrastructure data", "cross-tenant diagram inputs"],
    nextStep: "Prototype a SONARA-owned diagram renderer for architecture/process/report views using sanitized structured inputs and accessibility checks."
  })
]);

const NON_REPOSITORY_REFERENCES_BATCH6 = Object.freeze([
  Object.freeze({
    key: "revealer_us_service_reference",
    label: "Revealer.US",
    status: "verified_hosted_service_reference",
    observedTheme: "Hosted OSINT search across public/third-party username, email, breach, and investigation data",
    reason: "The submitted item is a hosted service, not an identified source repository. Current service disclosures describe public/third-party sources and explicit privacy/acceptable-use limits.",
    placement: "Research Lab vendor intelligence and privacy/security self-audit reference only",
    safety: [
      "No general people-search feature in SONARA.",
      "Any future vendor evaluation must be restricted to user-owned/controlled identifiers or a documented lawful basis and authorization.",
      "No employment, tenant, credit, insurance, harassment, doxxing, discrimination, or other high-impact use.",
      "Require privacy, retention, source-provenance, opt-out/suppression, API-key, abuse-prevention, and legal review before any provider connection."
    ],
    nextStep: "Keep as a non-executable vendor reference. If a legitimate self-audit use case appears, perform a separate legal/security/privacy review before any API integration."
  })
]);

function record(input) {
  return Object.freeze({
    repositoryVerified: true,
    repoUrl: `https://github.com/${input.repository}`,
    launchImpact: "optional",
    enabledInProduction: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch6_2026_09_14",
    blockedUses: [],
    ...input
  });
}

function getPublicScreenshotToolCatalogBatch6() {
  return SCREENSHOT_TOOL_RADAR_BATCH6.map((item) => ({
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

function getNonRepositoryReferencesBatch6() {
  return NON_REPOSITORY_REFERENCES_BATCH6.map((item) => ({ ...item, safety: [...item.safety] }));
}

function getScreenshotToolReadinessBatch6() {
  const repositories = getPublicScreenshotToolCatalogBatch6().map((item) => ({
    ...item,
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    canExecute: false
  }));
  return {
    ok: true,
    mode: "static_governed_catalog",
    repositoryCount: repositories.length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH6.length,
    productionExecutionCount: repositories.filter((item) => item.enabledInProduction).length,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch6()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH6,
  NON_REPOSITORY_REFERENCES_BATCH6,
  getPublicScreenshotToolCatalogBatch6,
  getNonRepositoryReferencesBatch6,
  getScreenshotToolReadinessBatch6
};
