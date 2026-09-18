// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Batch 13 intake, 16 September 2026.
// Research/catalog data only. Nothing in this module installs, imports, clones,
// executes, authenticates to, or enables any third-party project.

const REPOSITORIES = [
  {
    key: "openosint",
    label: "OpenOSINT",
    repository: "OpenOSINT/OpenOSINT",
    repoUrl: "https://github.com/OpenOSINT/OpenOSINT",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "authorized_security_lab",
    placement: "Security research adapter candidate",
    productFit: ["Authorized Security Lab", "Admin Command Center"],
    integrationStatus: "research_only",
    capabilities: [
      "OSINT investigation workflow",
      "CLI/REPL/MCP interfaces",
      "deterministic tool execution behind model-issued tool calls"
    ],
    safety: [
      "Targets must be SONARA-owned or explicitly authorized for assessment.",
      "Do not use for credential attacks, harassment, doxxing, stalking, or sensitive-person profiling.",
      "Results require provenance and human review before any operational action."
    ],
    blockedUses: [
      "unauthorized reconnaissance",
      "credential or account compromise",
      "automated consequential action based on OSINT output"
    ],
    nextStep: "Prototype only against a disposable SONARA-owned test domain after a path-level security review; keep all network egress allowlisted.",
    enabledInProduction: false,
    humanReviewRequired: true,
    evidence: "GitHub repository metadata checked 16 September 2026: OpenOSINT/OpenOSINT, MIT, Python, repository description limits use to authorized security research."
  },
  {
    key: "pinchtab",
    label: "PinchTab",
    repository: "pinchtab/pinchtab",
    repoUrl: "https://github.com/pinchtab/pinchtab",
    repositoryVerified: true,
    license: "MIT (current upstream metadata; submitted screenshot showed Apache-2.0)",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "local_browser_worker",
    placement: "Optional loopback-only browser worker",
    productFit: ["Internal Development", "Business Builder", "Growth Studio"],
    integrationStatus: "research_only",
    capabilities: [
      "Chrome control through an HTTP API",
      "accessibility-tree interaction",
      "multi-instance local browser control"
    ],
    safety: [
      "Bind to loopback by default and require explicit authentication before any remote deployment.",
      "Operate only on user-authorized destinations.",
      "Disable or refuse stealth, fingerprint-evasion, CloakBrowser, CAPTCHA bypass, and anti-bot circumvention paths."
    ],
    blockedUses: [
      "stealth or fingerprint evasion",
      "bypassing bot protections or access controls",
      "unauthorized scraping or session takeover"
    ],
    nextStep: "Benchmark a restricted loopback adapter with an allowlisted destination set and no stealth capability exposed to agents.",
    enabledInProduction: false,
    humanReviewRequired: true,
    evidence: "GitHub repository metadata checked 16 September 2026: pinchtab/pinchtab, MIT, Go. Current upstream description explicitly includes advanced stealth injection, so SONARA must narrow the feature surface before any adapter exists."
  },
  {
    key: "openshorts",
    label: "OpenShorts",
    repository: "mutonby/openshorts",
    repoUrl: "https://github.com/mutonby/openshorts",
    repositoryVerified: true,
    license: "Mixed: core application described as MIT; cloud/ is under the OpenShorts Commercial License; GitHub reports NOASSERTION for the repository as a whole",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "isolated_media_worker",
    placement: "Creator Studio media-worker candidate",
    productFit: ["Creator Studio", "Growth Studio"],
    integrationStatus: "research_only",
    capabilities: [
      "long-video to vertical-short clipping",
      "face-aware crop/layout",
      "subtitles and dubbing",
      "UGC-style video generation",
      "MCP/API surface for agent workflows"
    ],
    safety: [
      "Only process content the user owns or is licensed to transform.",
      "Require consent and rights checks for faces, voices, avatars, and uploaded likenesses.",
      "Keep social-platform credentials isolated per provider and require approval before publishing.",
      "Never copy or host the cloud/ commercial-service code without a separate license decision."
    ],
    blockedUses: [
      "unlicensed media transformation",
      "non-consensual voice or likeness cloning",
      "automatic social publishing without user authorization and approval",
      "incorporating cloud/ hosted-service code into SONARA without license review"
    ],
    nextStep: "Run a path-level license and dependency review of the self-hostable core, then benchmark an isolated worker using synthetic media only.",
    enabledInProduction: false,
    humanReviewRequired: true,
    evidence: "GitHub metadata and current README checked 16 September 2026: mutonby/openshorts; README distinguishes MIT core from a separately licensed cloud/ directory."
  },
  {
    key: "every_programmer_should_know",
    label: "Every Programmer Should Know",
    repository: "mtdvio/every-programmer-should-know",
    repoUrl: "https://github.com/mtdvio/every-programmer-should-know",
    repositoryVerified: true,
    license: "CC-BY-4.0",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "engineering_reference",
    placement: "Internal engineering curriculum/reference",
    productFit: ["Internal Development", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: [
      "curated software-engineering reading list",
      "cross-discipline technical reference"
    ],
    safety: [
      "Reference material is not a production dependency.",
      "Preserve attribution if SONARA reproduces or adapts licensed content."
    ],
    blockedUses: ["presenting third-party educational content as SONARA-authored without attribution"],
    nextStep: "Use as a gap-checking index for engineering training and architecture reviews; link to sources rather than copying the collection.",
    enabledInProduction: false,
    humanReviewRequired: false,
    evidence: "GitHub repository metadata checked 16 September 2026: mtdvio/every-programmer-should-know, CC-BY-4.0, documentation/reference repository."
  }
];

const NON_REPOSITORY_REFERENCES = [
  {
    key: "confluent_event_driven_agents_2025",
    label: "Confluent: A Guide to Event-Driven Design for Agents and Multi-Agent Systems",
    observedTheme: "event-driven multi-agent architecture",
    reason: "The uploaded 2025 guide is a vendor-authored architecture source, not a dependency. Its reusable contribution is the provider-neutral design vocabulary: orchestrator-worker, hierarchical, blackboard, market-based coordination, immutable event logs, replay, idempotency, dead-letter handling, stream governance, and asynchronous scaling.",
    nextStep: "Apply the architecture principles through SONARA-owned event contracts and authority gates; do not make Confluent/Kafka a required runtime until load and operating-cost evidence justifies it.",
    safety: ["preserve tenant isolation", "owner review for consequential actions", "no claim that research material is production implementation"]
  },
  {
    key: "aws_datadog_genai_observability_2025",
    label: "AWS + Datadog: Operationalize generative AI with confidence",
    observedTheme: "LLM observability, traceability, security, compliance, and golden datasets",
    reason: "The uploaded 2025 solution brief recommends observability during development, full-stack traceability, prompt/response behavior monitoring, cost/latency tracking, audit trails, guardrails, golden datasets, and continuous evaluation. SONARA can implement the measurement contract without committing to Datadog.",
    nextStep: "Use SONARA-owned provider-neutral telemetry records first; evaluate Datadog or another exporter only after retention, privacy, cost, and tenant-isolation requirements are fixed.",
    safety: ["no raw secrets in telemetry", "raw prompts/responses excluded by default", "RBAC and audit trails required for diagnostic access"]
  }
];

const SCREENSHOT_TOOL_RADAR_BATCH13 = Object.freeze(REPOSITORIES.map((item) => Object.freeze({
  ...item,
  productFit: Object.freeze([...item.productFit]),
  capabilities: Object.freeze([...item.capabilities]),
  safety: Object.freeze([...item.safety]),
  blockedUses: Object.freeze([...item.blockedUses]),
  configurationStatus: "cataloged_disabled",
  runtimeStatus: "not_executed",
  canExecute: false,
  source: "user_submitted_batch13_2026_09_16"
})));

const NON_REPOSITORY_REFERENCES_BATCH13 = Object.freeze(NON_REPOSITORY_REFERENCES.map((item) => Object.freeze({
  ...item,
  safety: Object.freeze([...item.safety]),
  source: "user_uploaded_batch13_2026_09_16"
})));

function getPublicScreenshotToolCatalogBatch13() {
  return SCREENSHOT_TOOL_RADAR_BATCH13.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses]
  }));
}

function getNonRepositoryReferencesBatch13() {
  return NON_REPOSITORY_REFERENCES_BATCH13.map((item) => ({ ...item, safety: [...item.safety] }));
}

function getScreenshotToolReadinessBatch13() {
  const repositories = getPublicScreenshotToolCatalogBatch13();
  return {
    ok: true,
    batch: 13,
    mode: "static_governed_screenshot_research_batch13",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH13.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch13()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH13,
  NON_REPOSITORY_REFERENCES_BATCH13,
  getPublicScreenshotToolCatalogBatch13,
  getNonRepositoryReferencesBatch13,
  getScreenshotToolReadinessBatch13
};
