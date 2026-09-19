// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Batch 14 screenshot intake, 19 September 2026.
//
// This module is a governed research/adoption record. It does not clone,
// install, import, authenticate to, execute, or enable any third-party project.
// Existing formal-registry records are confirmed instead of duplicated.

const REPOSITORIES = [
  {
    key: "browser_hand",
    label: "Browser Hand",
    repository: "verygoodplugins/browser-hand",
    repoUrl: "https://github.com/verygoodplugins/browser-hand",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "authenticated_browser_bridge",
    placement: "Founder/developer workstation or isolated browser worker only",
    productFit: ["Founder Operations", "Internal Development", "Business Builder"],
    integrationStatus: "research_only_security_gated",
    capabilities: [
      "control a user's real logged-in Chrome session through a local extension bridge",
      "agent-facing browser skill and command surface",
      "local browser-session continuity without moving the default Chrome profile into a remote-debug process"
    ],
    safety: [
      "Treat an authenticated browser session as delegated account authority, not as a generic scraping primitive.",
      "Require task- and destination-scoped authorization, bounded step/time budgets, audit evidence, and human approval before writes, purchases, publishing, account changes, or security changes.",
      "Keep production secrets, unrelated tabs, password stores, cookies, passkeys, and extension data outside agent-readable output unless a narrowly scoped approved workflow requires them."
    ],
    blockedUses: [
      "credential harvesting or account takeover",
      "bypassing access controls, bot protections, CAPTCHA, or provider policy",
      "unapproved purchases, publishing, refunds, security changes, or destructive account mutations",
      "unbounded production-secret or unrelated-session access"
    ],
    nextStep: "Prototype one read-only SONARA-owned workflow in a disposable local browser profile, record every navigation/tool call, then compare the evidence with the existing approval and browser-worker contracts before any adapter decision.",
    enabledInProduction: false,
    humanReviewRequired: true,
    evidence: "GitHub repository metadata read 19 September 2026: verygoodplugins/browser-hand, MIT, TypeScript; upstream describes a local extension bridge that lets agents control a real logged-in Chrome session."
  },
  {
    key: "agentic_bug_hunter",
    label: "Agentic Bug Hunter",
    repository: "awarexone/Agentic-Bug-Hunter",
    repoUrl: "https://github.com/awarexone/Agentic-Bug-Hunter",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "authorized_security_lab",
    placement: "Internal security lab and explicitly authorized assessment workflows",
    productFit: ["Internal Security", "Release Engineering", "Founder Operations"],
    integrationStatus: "research_only_security_gated",
    capabilities: [
      "agent-assisted reconnaissance and vulnerability research",
      "security workflow automation from reconnaissance through report preparation",
      "repeatable terminal-oriented security assessment workflows"
    ],
    safety: [
      "Targets must be SONARA-owned or covered by explicit written authorization and scope.",
      "Keep exploit-capable tooling in an isolated lab with target allowlists, rate limits, disposable credentials, and immutable audit logs.",
      "Require a human security reviewer to verify findings and evidence before disclosure, filing, remediation priority, or any consequential action."
    ],
    blockedUses: [
      "unauthorized reconnaissance, scanning, exploitation, or persistence",
      "credential attacks or lateral movement outside an approved test environment",
      "automatic bug-bounty submission or public disclosure without human verification"
    ],
    nextStep: "Use only against a deliberately vulnerable disposable SONARA lab target, measure false positives and evidence quality, and keep the result advisory until the security authorization contract and CI security gates accept it.",
    enabledInProduction: false,
    humanReviewRequired: true,
    evidence: "GitHub repository metadata read 19 September 2026: awarexone/Agentic-Bug-Hunter, MIT, Python; upstream describes an AI-powered bug-bounty hunting toolkit."
  },
  {
    key: "anti_slop",
    label: "anti-slop",
    repository: "miqdadbadjuber/anti-slop",
    repoUrl: "https://github.com/miqdadbadjuber/anti-slop",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "developer_quality_rule_reference",
    placement: "Design-system and coding-agent quality gates",
    productFit: ["Internal Development", "Design System", "Public Website", "All Product Apps"],
    integrationStatus: "adapt_patterns_after_review",
    capabilities: [
      "mandatory anti-generic UI/copy/code review rules",
      "purpose-gated design decisions and quality locks",
      "delivery PASS/FAIL report patterns for agent-authored work"
    ],
    safety: [
      "SONARA design direction remains authoritative; an external rule set may constrain low-quality output but must not silently redefine the product identity.",
      "Convert useful rules into repository-owned checks that are testable, versioned, accessible, and compatible with reduced motion, contrast, responsive, and performance requirements.",
      "Do not use subjective style rules as a substitute for functional, accessibility, security, or performance tests."
    ],
    blockedUses: [
      "bulk copying an external visual identity into SONARA",
      "using a style verdict as proof that functionality, accessibility, security, or performance works",
      "letting an agent rewrite DESIGN.md or production UI authority without review"
    ],
    nextStep: "Map the useful hard-gate, purpose-gate, quality-lock, and delivery-report ideas into SONARA-owned DESIGN.md and CI assertions, then test them on one current interface before expanding the rule set.",
    enabledInProduction: false,
    humanReviewRequired: true,
    evidence: "GitHub repository metadata read 19 September 2026: miqdadbadjuber/anti-slop, MIT, JavaScript; upstream describes rules for filtering generic AI-generated UI, text, and code."
  },
  {
    key: "librepods",
    label: "LibrePods",
    repository: "librepods-org/librepods",
    repoUrl: "https://github.com/librepods-org/librepods",
    repositoryVerified: true,
    license: "GPL-3.0",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "device_interoperability_reference",
    placement: "Android/Linux interoperability research only",
    productFit: ["Android Client Research", "Device Runtime Research"],
    integrationStatus: "reference_only_license_gated",
    capabilities: [
      "AirPods feature interoperability on Android and Linux",
      "device-state and control patterns for non-native platforms",
      "Bluetooth/device companion application patterns"
    ],
    safety: [
      "Use only as an interoperability architecture reference unless legal and security review explicitly approves a separable deployment.",
      "Do not require root, privileged hooks, vendor-identity spoofing, or undocumented protocol behavior in the normal SONARA customer application.",
      "Keep hardware/device permissions least-privileged and user-visible."
    ],
    blockedUses: [
      "copying GPL implementation code into proprietary SONARA application paths",
      "privileged or root-only hooks in the normal customer app",
      "vendor-ID spoofing or security-control bypass",
      "claiming official Apple support or endorsement"
    ],
    nextStep: "Extract only general Android companion-app and device-permission lessons, then validate SONARA's own Credential Manager, notification, Bluetooth, and device-runtime requirements independently of LibrePods code.",
    enabledInProduction: false,
    humanReviewRequired: true,
    evidence: "GitHub repository metadata read 19 September 2026: librepods-org/librepods, GPL-3.0, Kotlin; upstream describes AirPods interoperability for Android and Linux."
  },
  {
    key: "pentagi",
    label: "PentAGI",
    repository: "vxcontrol/pentagi",
    repoUrl: "https://github.com/vxcontrol/pentagi",
    repositoryVerified: true,
    license: "MIT repository metadata; VXControl Cloud SDK and derivative/commercial obligations require separate path-level review",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "autonomous_penetration_testing_reference",
    placement: "Internal authorized security lab only",
    productFit: ["Internal Security", "Security Research"],
    integrationStatus: "research_only_security_gated",
    capabilities: [
      "multi-agent penetration-testing workflow orchestration",
      "security-tool execution and evidence collection",
      "LLM-provider abstraction for security research"
    ],
    safety: [
      "Every target, network range, account, and test technique must be explicitly authorized before execution.",
      "Separate repository licensing from VXControl Cloud SDK, model/provider, exploit, scanner, and bundled-tool licensing before any use.",
      "Require target allowlists, egress controls, rate limits, human review, evidence retention, and immediate kill/rollback controls."
    ],
    blockedUses: [
      "autonomous penetration testing against third parties without authorization",
      "credential theft, persistence, destructive exploitation, or stealth intended to evade defenders",
      "customer-facing unrestricted offensive-security agents"
    ],
    nextStep: "Keep as architecture research; if SONARA needs automated security validation, reproduce only defensive lab patterns against disposable owned targets and require a path-level licence/security review before any executable component is introduced.",
    enabledInProduction: false,
    humanReviewRequired: true,
    evidence: "GitHub repository metadata read 19 September 2026: vxcontrol/pentagi, Go, MIT detected at repository level; upstream describes autonomous AI agents for complex penetration-testing tasks."
  },
  {
    key: "ever_gauzy",
    label: "Ever Gauzy",
    repository: "ever-co/ever-gauzy",
    repoUrl: "https://github.com/ever-co/ever-gauzy",
    repositoryVerified: true,
    license: "AGPL-3.0 detected; upstream also publishes separate community/commercial product terms",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "business_management_architecture_reference",
    placement: "Business Builder product and domain-model research",
    productFit: ["Business Builder", "Founder Operations"],
    integrationStatus: "reference_only_license_gated",
    capabilities: [
      "ERP/CRM/HRM/ATS/project-management domain decomposition",
      "time tracking, teams, organization and business-operations workflows",
      "modular business-management platform architecture"
    ],
    safety: [
      "Use domain decomposition, workflow vocabulary, and interoperability ideas as research; do not copy AGPL implementation into proprietary hosted SONARA paths.",
      "Keep employee monitoring, time tracking, payroll, HR, and applicant data behind explicit tenant, role, retention, privacy, and consent controls.",
      "Do not represent SONARA as an Ever Gauzy equivalent merely because adjacent modules exist."
    ],
    blockedUses: [
      "copying AGPL implementation into proprietary hosted SONARA services",
      "silent employee surveillance or invasive workforce monitoring",
      "marketing SONARA as feature-equivalent to a mature ERP/CRM/HRM suite without measured evidence"
    ],
    nextStep: "Compare Business Builder's existing organization, project, workforce, time, CRM, and operations schemas against Gauzy's domain boundaries, then implement only measured SONARA gaps with repository-owned models and tests.",
    enabledInProduction: false,
    humanReviewRequired: true,
    evidence: "GitHub repository metadata read 19 September 2026: ever-co/ever-gauzy, TypeScript, AGPL-3.0 detected; upstream describes an ERP/CRM/HRM/ATS/project-management platform."
  },
  {
    key: "obsidian_second_brain",
    label: "Obsidian Second Brain",
    repository: "eugeniughelbur/obsidian-second-brain",
    repoUrl: "https://github.com/eugeniughelbur/obsidian-second-brain",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "local_agent_memory_reference",
    placement: "Founder/developer knowledge system and agent-memory research",
    productFit: ["Founder Operations", "Internal Development", "Agent Control Plane"],
    integrationStatus: "research_only",
    capabilities: [
      "plain-Markdown persistent memory across multiple coding-agent CLIs",
      "searchable project knowledge and self-maintaining notes",
      "scheduled maintenance/research workflows over a local vault"
    ],
    safety: [
      "Customer memory remains tenant-scoped and policy-governed; a local developer vault must never become silent cross-customer memory.",
      "Keep secrets, credentials, regulated data, and unrelated personal data out of model-indexed notes by default.",
      "Require provenance, retention, deletion, conflict resolution, and source-of-truth boundaries before promoting a note into operational state."
    ],
    blockedUses: [
      "using a developer vault as production customer memory",
      "cross-tenant retrieval or silent long-term retention of customer data",
      "allowing scheduled note agents to mutate production systems without the normal SONARA authority gates"
    ],
    nextStep: "Prototype the platform-neutral Markdown memory pattern only for SONARA engineering context, then compare retrieval quality, deletion semantics, and conflict handling with the existing learning-memory control plane.",
    enabledInProduction: false,
    humanReviewRequired: true,
    evidence: "GitHub repository metadata read 19 September 2026: eugeniughelbur/obsidian-second-brain, MIT, Python; upstream describes persistent Markdown/Obsidian memory shared across multiple CLI agents."
  }
];

const CONFIRMED_EXISTING_RECORDS = [
  {
    key: "tooljet_existing_formal_registry",
    repository: "ToolJet/ToolJet",
    label: "ToolJet",
    registerSource: "data/open-source-tools.ts",
    agrees: true,
    registerSays: "AGPL-3.0; blocked from incorporation/resale as a SONARA feature; architectural reference only.",
    reReadSays: "GitHub metadata read 19 September 2026 still reports AGPL-3.0 and describes an internal-tool/business-application/workflow/agent platform.",
    nextStep: "Keep the formal registry verdict authoritative; use only high-level internal-tool composition ideas and do not add a competing screenshot-catalog record."
  },
  {
    key: "voxcpm_existing_voice_clone_cluster",
    repository: "OpenBMB/VoxCPM",
    label: "VoxCPM2",
    registerSource: "data/open-source-tools.ts voice-cloning cluster",
    agrees: true,
    registerSays: "Voice-cloning systems require provenance, explicit voice-owner consent, security review, and model/source review before use.",
    reReadSays: "GitHub metadata read 19 September 2026 reports Apache-2.0 for OpenBMB/VoxCPM and describes VoxCPM2 multilingual TTS, creative voice design, and true-to-life cloning.",
    nextStep: "Keep voice cloning behind creator_voice_consents/provenance controls; evaluate VoxCPM2 only as an isolated Creator Studio voice worker with separate model-weight and dependency review."
  }
];

const NON_REPOSITORY_REFERENCES = [
  {
    key: "google_industrial_agentic_engineering_2026",
    label: "Google Research: Industrial Agentic Engineering",
    sourceUrl: "https://research.google/pubs/industrial-agentic-engineering/",
    observedTheme: "verifiable specification -> harness -> multi-step trajectory -> verification -> meta-debugging",
    reason: "The publication treats the model as only one component of a reliable agentic engineering system. The reusable SONARA lesson is to put tools, prompts, guardrails, deterministic checks, execution evidence, and workflow-level debugging around model behavior.",
    nextStep: "Map the harness pattern onto SONARA's exact-head CI, agent authority classifier, approval receipts, structured outputs, tool scopes, traces, and release evidence; debug failed trajectories at the workflow/tool/prompt-contract layer instead of automatically changing models.",
    safety: [
      "This is an engineering reference, not a runtime dependency or Google endorsement of SONARA.",
      "A stronger harness does not widen agent authority; sensitive actions still require SONARA policy and approval gates.",
      "Evaluation evidence must remain tenant-safe and secret-redacted."
    ]
  }
];

function freezeRepository(item) {
  return Object.freeze({
    ...item,
    productFit: Object.freeze([...item.productFit]),
    capabilities: Object.freeze([...item.capabilities]),
    safety: Object.freeze([...item.safety]),
    blockedUses: Object.freeze([...item.blockedUses]),
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    canExecute: false,
    source: "user_submitted_screenshot_research_2026_09_19"
  });
}

const SCREENSHOT_TOOL_RADAR_BATCH14 = Object.freeze(REPOSITORIES.map(freezeRepository));
const CONFIRMED_EXISTING_RECORDS_BATCH14 = Object.freeze(CONFIRMED_EXISTING_RECORDS.map((item) => Object.freeze({ ...item })));
const NON_REPOSITORY_REFERENCES_BATCH14 = Object.freeze(NON_REPOSITORY_REFERENCES.map((item) => Object.freeze({
  ...item,
  safety: Object.freeze([...item.safety]),
  source: "user_submitted_screenshot_research_2026_09_19"
})));

function getPublicScreenshotToolCatalogBatch14() {
  return SCREENSHOT_TOOL_RADAR_BATCH14.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses]
  }));
}

function getConfirmedExistingRecordsBatch14() {
  return CONFIRMED_EXISTING_RECORDS_BATCH14.map((item) => ({ ...item }));
}

function getNonRepositoryReferencesBatch14() {
  return NON_REPOSITORY_REFERENCES_BATCH14.map((item) => ({ ...item, safety: [...item.safety] }));
}

function getScreenshotToolReadinessBatch14() {
  const repositories = getPublicScreenshotToolCatalogBatch14();
  return {
    ok: true,
    batch: 14,
    mode: "static_governed_screenshot_research_batch14",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS_BATCH14.length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH14.length,
    productionExecutionCount: 0,
    repositories,
    confirmedExistingRecords: getConfirmedExistingRecordsBatch14(),
    nonRepositoryReferences: getNonRepositoryReferencesBatch14()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH14,
  CONFIRMED_EXISTING_RECORDS_BATCH14,
  NON_REPOSITORY_REFERENCES_BATCH14,
  getPublicScreenshotToolCatalogBatch14,
  getConfirmedExistingRecordsBatch14,
  getNonRepositoryReferencesBatch14,
  getScreenshotToolReadinessBatch14
};
