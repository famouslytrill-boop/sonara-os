"use strict";

const REQUESTED_REPOSITORIES = Object.freeze([
  record({
    key: "openhands",
    label: "OpenHands",
    requestedRepository: "OpenHands/OpenHands",
    repository: "OpenHands/OpenHands",
    repositoryVerified: true,
    license: "MIT outside enterprise/; enterprise directory has separate terms",
    licenseRisk: "high",
    runtimeClass: "developer_agent_platform",
    integrationStatus: "developer_only",
    integrationMode: "isolated_development_control_plane",
    role: "Self-hosted coding-agent control center",
    placement: "Dedicated development machine or isolated worker; never the production web process",
    productFit: ["Founder operations", "Internal development", "Repository maintenance"],
    capabilities: ["agent sessions", "reviewable automations", "GitHub issue decomposition", "multiple agent backends"],
    safety: [
      "Run with a dedicated sandbox and repository-scoped credentials.",
      "Require human review before commits, pull requests, deployment, deletion, billing, or secret changes.",
      "Never route customer prompts directly into filesystem, shell, browser, or repository tools."
    ],
    blockedUses: ["customer-controlled shell", "unreviewed autonomous merge", "production secret access"],
    nextStep: "Pilot on a disposable branch with read-only repository tasks before allowing reviewed patch creation."
  }),
  record({
    key: "caveman",
    label: "Caveman",
    requestedRepository: "JuliusBrussee/caveman",
    repository: "JuliusBrussee/caveman",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "prompt_skill",
    integrationStatus: "reference_only",
    integrationMode: "optional_response_style_profile",
    role: "Concise-response prompt and agent skill",
    placement: "Developer tools and optional internal prompt profiles",
    productFit: ["Internal development", "Prompt Library", "Cost observability"],
    capabilities: ["response brevity profile", "commit-message profile", "review-comment profile", "token-usage measurement concepts"],
    safety: [
      "Do not treat claimed token savings as guaranteed; measure on SONARA workloads.",
      "Preserve legal, security, financial, and operational detail even when brevity mode is enabled.",
      "Do not execute remote install scripts from the production application."
    ],
    blockedUses: ["automatic production installation", "compressing away required safety or compliance context"],
    nextStep: "Implement a SONARA-owned concise-output profile and benchmark it before adopting any external installer."
  }),
  record({
    key: "agency_agents",
    label: "Agency Agents",
    requestedRepository: "sonoisa/agency-agents",
    repository: "msitarzewski/agency-agents",
    repositoryVerified: true,
    sourceCorrection: "The supplied sonoisa/agency-agents link was not found; the matching maintained repository is msitarzewski/agency-agents.",
    license: "MIT",
    licenseRisk: "medium",
    runtimeClass: "agent_prompt_library",
    integrationStatus: "curated_reference",
    integrationMode: "reviewed_role_templates",
    role: "Specialized agent-role and workflow template library",
    placement: "Prompt Library and internal development playbooks",
    productFit: ["Business Builder", "Creator Studio", "Growth Studio", "Internal development"],
    capabilities: ["specialist role templates", "deliverable checklists", "review patterns", "workflow prompts"],
    safety: [
      "Import selected role files only after human review; do not bulk-install the full roster.",
      "Remove instructions that conflict with SONARA authorization, privacy, tenant isolation, or approval rules.",
      "Treat every prompt file as untrusted executable guidance."
    ],
    blockedUses: ["bulk agent installation", "unreviewed autonomous roles", "role prompts overriding platform policy"],
    nextStep: "Curate a small approved set: code reviewer, technical writer, database optimizer, accessibility specialist, and incident commander."
  }),
  record({
    key: "meetily",
    label: "Meetily",
    requestedRepository: "Zackriya-Solutions/meetily",
    repository: "Zackriya-Solutions/meetily",
    repositoryVerified: true,
    license: "MIT for the Community Edition; PRO is a separate product/codebase",
    licenseRisk: "medium",
    runtimeClass: "desktop_companion",
    integrationStatus: "optional_adapter_after_review",
    integrationMode: "local_export_import_companion",
    role: "Local meeting capture, transcription, and summarization",
    placement: "User desktop; SONARA receives explicit user-approved exports only",
    productFit: ["Founder operations", "Business Builder", "Files & Records"],
    capabilities: ["local transcription", "meeting summaries", "audio import", "local model support"],
    safety: [
      "Require recording consent and comply with the laws applicable to every participant and location.",
      "Keep raw audio and transcripts local unless the user explicitly imports them into a workspace.",
      "Do not claim Zoom, Teams, or Google Meet integration beyond what the verified upstream project supports."
    ],
    blockedUses: ["silent recording", "automatic cloud upload", "cross-tenant transcript access"],
    nextStep: "Add a user-controlled transcript/summary import flow rather than embedding the desktop application into Vercel."
  }),
  record({
    key: "officecli",
    label: "OfficeCLI",
    requestedRepository: "nicobrenner/officecli",
    repository: "iOfficeAI/OfficeCLI",
    repositoryVerified: true,
    sourceCorrection: "The supplied nicobrenner/officecli link was not found; the matching OfficeCLI project is iOfficeAI/OfficeCLI.",
    license: "Apache-2.0",
    licenseRisk: "medium",
    runtimeClass: "document_worker",
    integrationStatus: "optional_adapter_after_review",
    integrationMode: "isolated_artifact_worker",
    role: "Create, inspect, render, and modify DOCX, XLSX, and PPTX artifacts",
    placement: "Isolated background worker with a temporary workspace",
    productFit: ["Business Builder", "Creator Studio", "Reports", "Files & Records"],
    capabilities: ["DOCX generation", "XLSX generation", "PPTX generation", "document rendering", "structured document inspection"],
    safety: [
      "Never invoke document binaries through unsanitized shell strings.",
      "Use per-job temporary directories, strict file-size limits, malware scanning, and extension/MIME validation.",
      "Do not install or execute the binary inside the Vercel request process."
    ],
    blockedUses: ["arbitrary command passthrough", "untrusted macros", "production web-process execution"],
    nextStep: "Build a queue-backed artifact worker contract and test deterministic DOCX/XLSX/PPTX creation in an isolated container."
  }),
  record({
    key: "openwiki",
    label: "OpenWiki",
    requestedRepository: "nicosxt/openwiki",
    repository: "langchain-ai/openwiki",
    repositoryVerified: true,
    sourceCorrection: "The supplied nicosxt/openwiki link was not found; the matching maintained project is langchain-ai/openwiki.",
    license: "MIT",
    licenseRisk: "high",
    runtimeClass: "developer_cli",
    integrationStatus: "developer_only",
    integrationMode: "documentation_pull_request_worker",
    role: "Generate and maintain repository documentation and agent wikis",
    placement: "Development CI or a locked-down documentation worker",
    productFit: ["Internal development", "Research Lab", "Documentation"],
    capabilities: ["repository wiki generation", "documentation updates", "AGENTS.md maintenance", "scheduled documentation pull requests"],
    safety: [
      "Start in code mode only; personal connectors for Gmail, Slack, Notion, X, and web search remain disabled.",
      "Use a read-only checkout and require review before documentation pull requests merge.",
      "Store provider credentials outside the repository and disable unnecessary telemetry/connectors."
    ],
    blockedUses: ["production customer data ingestion", "personal connector ingestion", "automatic documentation merge"],
    nextStep: "Run code-mode documentation generation on a disposable branch and compare output with existing SONARA docs before CI adoption."
  }),
  record({
    key: "omniroute",
    label: "OmniRoute",
    requestedRepository: "omniroute/omniroute",
    repository: null,
    repositoryVerified: false,
    sourceCorrection: "The supplied repository could not be verified, and no authoritative repository matching the navigation-engine claims was identified.",
    license: "Unverified",
    licenseRisk: "critical",
    runtimeClass: "unverified_external_source",
    integrationStatus: "blocked",
    integrationMode: "none",
    role: "Claimed routing/navigation engine",
    placement: "Not admitted to SONARA",
    productFit: ["Research intake only"],
    capabilities: [],
    safety: [
      "Do not clone, install, vendor, or advertise this source until ownership, code, license, benchmarks, and security are verified.",
      "Do not use social-media performance claims as architecture evidence."
    ],
    blockedUses: ["all runtime use", "marketing claims", "customer routing"],
    nextStep: "Obtain the authoritative repository or project website, then perform license, architecture, benchmark, and security review."
  }),
  record({
    key: "strix",
    label: "Strix",
    requestedRepository: "strixsec/strix",
    repository: "usestrix/strix",
    repositoryVerified: true,
    sourceCorrection: "The supplied strixsec/strix link was not found; the matching maintained project is usestrix/strix.",
    license: "Apache-2.0",
    licenseRisk: "critical",
    runtimeClass: "security_testing_tool",
    integrationStatus: "staging_only",
    integrationMode: "authorized_security_pipeline",
    role: "Agentic application-security and penetration-testing tool",
    placement: "Isolated security environment against explicitly authorized SONARA targets only",
    productFit: ["Internal application security", "Pre-release security review"],
    capabilities: ["authorized SAST/DAST", "vulnerability validation", "security reports", "remediation suggestions"],
    safety: [
      "Restrict targets to assets SONARA owns or has explicit written authorization to test.",
      "Use network egress controls, target allowlists, rate limits, non-production credentials, and retained audit logs.",
      "Human security review is mandatory before accepting findings, proof-of-concepts, patches, or CI blocking decisions."
    ],
    blockedUses: ["third-party targets", "bug-bounty automation without program authorization", "customer-accessible exploitation", "production credentials"],
    nextStep: "Begin with source/diff-scoped scans in an isolated staging copy; do not enable black-box exploitation against production."
  }),
  record({
    key: "asi",
    label: "ASI Agent Skills",
    requestedRepository: "plurigrid/asi",
    repository: "plurigrid/asi",
    repositoryVerified: true,
    license: "Apache-2.0 stated upstream",
    licenseRisk: "critical",
    runtimeClass: "agent_skill_library",
    integrationStatus: "quarantined_reference",
    integrationMode: "allowlisted_skill_intake",
    role: "Large experimental library of agent skills",
    placement: "Offline review sandbox; selected skills may be rewritten into SONARA-owned modules",
    productFit: ["Research Lab", "Internal development"],
    capabilities: ["skill discovery", "agent workflow references", "security-tool references", "scientific and systems research prompts"],
    safety: [
      "Do not bulk-load more than one thousand third-party skills into any trusted agent runtime.",
      "Review each selected skill for prompt injection, shell/network behavior, license provenance, data access, and destructive actions.",
      "Prefer rewriting useful concepts into minimal SONARA-owned skills rather than importing upstream files verbatim."
    ],
    blockedUses: ["bulk installation", "automatic skill discovery in production", "unreviewed security or wallet skills", "policy override"],
    nextStep: "Create a five-skill pilot allowlist after individual source, license, and behavior review."
  }),
  record({
    key: "awesome_design_md",
    label: "Awesome Design MD",
    requestedRepository: "nicosxt/awesome-design-md",
    repository: null,
    repositoryVerified: false,
    sourceCorrection: "The supplied repository could not be verified, and no authoritative source matching the post was identified.",
    license: "Unverified",
    licenseRisk: "critical",
    runtimeClass: "unverified_external_source",
    integrationStatus: "blocked",
    integrationMode: "none",
    role: "Claimed Markdown design-template collection",
    placement: "Not admitted to SONARA",
    productFit: ["Research intake only"],
    capabilities: [],
    safety: [
      "Do not copy templates or assets without a verifiable repository and license.",
      "Use SONARA-owned documentation components in the meantime."
    ],
    blockedUses: ["all code or asset copying", "branding claims", "production dependency"],
    nextStep: "Request the correct repository URL or replace it with internally authored README, wiki, and project-page templates."
  })
]);

function record(input) {
  return Object.freeze({
    launchImpact: "optional",
    enabledInProduction: false,
    humanReviewRequired: true,
    sourceCorrection: null,
    blockedUses: [],
    ...input,
    repoUrl: input.repository ? `https://github.com/${input.repository}` : null,
    requestedRepoUrl: `https://github.com/${input.requestedRepository}`
  });
}

function getPublicRequestedRepositoryCatalog() {
  return REQUESTED_REPOSITORIES.map((item) => ({
    key: item.key,
    label: item.label,
    requestedRepository: item.requestedRepository,
    requestedRepoUrl: item.requestedRepoUrl,
    repository: item.repository,
    repoUrl: item.repoUrl,
    repositoryVerified: item.repositoryVerified,
    sourceCorrection: item.sourceCorrection,
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
    nextStep: item.nextStep
  }));
}

function getRequestedRepositoryReadiness() {
  const repositories = getPublicRequestedRepositoryCatalog().map((item) => ({
    ...item,
    configurationStatus: item.repositoryVerified ? "cataloged_disabled" : "blocked_unverified_source",
    runtimeStatus: "not_executed",
    canExecute: false
  }));
  return {
    ok: true,
    mode: "static_governed_catalog",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    blockedCount: repositories.filter((item) => item.integrationStatus === "blocked").length,
    productionExecutionCount: repositories.filter((item) => item.enabledInProduction).length,
    repositories
  };
}

module.exports = {
  REQUESTED_REPOSITORIES,
  getPublicRequestedRepositoryCatalog,
  getRequestedRepositoryReadiness
};
