"use strict";

// Batch 11 closes the latest screenshot intake with a verification-first pass.
// Social posts, screenshots, star counts, marketing claims, and copied prompts
// are leads only. A repository is recorded here only after its current GitHub
// identity and declared repository licence were checked. None of these records
// grants runtime authority, installs code, enables a provider, or widens tenant,
// approval, billing, publishing, security-testing, or release permissions.

const BATCH11_OPERATIONAL_REVIEW = Object.freeze([
  sourceRecord({
    key: "evidence_before_adoption",
    label: "Evidence-first external source intake",
    source: "Batch 11 screenshot intake",
    sourceClass: "user_submitted_screenshots",
    productFit: ["SONARA One", "Founder Operations", "Research Lab", "Internal development"],
    requirements: [
      "Resolve canonical repository identity before using a social-media repository name or link.",
      "Verify current repository licence and maintenance state independently from screenshots, badges, star counts, or marketing copy.",
      "Keep source evidence, product capability, integration status, and production authority as separate facts.",
      "Record unresolved or contradictory sources explicitly instead of guessing an upstream project."
    ],
    implementationPath: "Feed verified candidates into the existing convergence and formal open-source review surfaces; unresolved sources remain non-executable research leads."
  }),
  sourceRecord({
    key: "bounded_agent_team_factory",
    label: "Bounded multi-agent team architecture",
    source: "Batch 11 agent-team, graph-engineering, Harness, and Agency Agents references",
    sourceClass: "user_submitted_screenshots",
    productFit: ["Business Builder", "Creator Studio", "Growth Studio", "Internal development"],
    requirements: [
      "Decompose work into router/coordinator, specialist workers, shared state, integrator, reviewer, and human checkpoint roles.",
      "Give every worker a narrow capability surface and deny shell, network, write, send, billing, publish, and destructive authority unless separately exposed and approved.",
      "Use explicit handoff contracts and retained evidence instead of relying on hidden conversational memory.",
      "Failed review returns work to the responsible builder rather than silently shipping a partial result."
    ],
    implementationPath: "Adapt team-pattern concepts into SONARA-owned agent/skill strategies and execution contracts; external role prompts never override platform policy."
  }),
  sourceRecord({
    key: "truthful_build_value_estimator",
    label: "Truthful build, MVP, and cost estimator",
    source: "Batch 11 software-value and no-code prompt screenshots",
    sourceClass: "user_submitted_screenshots",
    productFit: ["Business Builder", "Founder Operations"],
    requirements: [
      "Estimate requirements, MVP scope, engineering effort, infrastructure cost, operating cost, maintenance burden, delivery risk, and timeline from evidence.",
      "Compare code, low-code, no-code, managed-service, and build-versus-buy paths without assuming one path is always cheaper or equivalent.",
      "Do not claim a product is worth $5,000, $8,000, $12,000, $20,000, or any other amount merely because a prompt or avoided agency quote names that amount.",
      "Separate replacement-cost estimates from business valuation, which requires evidence such as revenue, customers, IP, margins, growth, risk, and transferability."
    ],
    implementationPath: "Add an evidence-backed planning model to Business Builder before exposing any valuation or savings language in customer-facing copy."
  }),
  sourceRecord({
    key: "local_meeting_intelligence",
    label: "Consent-aware local meeting intelligence",
    source: "Batch 11 Meetily reference",
    sourceClass: "verified_repository_reference",
    productFit: ["Business Builder", "Founder Operations", "Files & Records"],
    requirements: [
      "Support explicit import of user-approved transcript, summary, decisions, action items, owners, and deadlines.",
      "Prefer local processing when selected by the user, but do not claim every optional model/provider path is local.",
      "Require recording/participant consent appropriate to the applicable jurisdiction and workflow.",
      "Never silently upload raw audio, transcripts, or meeting-derived personal data across tenants."
    ],
    implementationPath: "Keep the desktop recorder outside the Vercel request process and design an explicit import contract into tenant-scoped SONARA records."
  }),
  sourceRecord({
    key: "document_and_code_documentation_workers",
    label: "Isolated document and code-documentation workers",
    source: "Batch 11 OfficeCLI and OpenWiki references",
    sourceClass: "verified_repository_reference",
    productFit: ["Business Builder", "Creator Studio", "Reports", "Documentation", "Internal development"],
    requirements: [
      "Run document conversion/editing and code-documentation jobs in isolated workers with bounded filesystems and no arbitrary command passthrough.",
      "Validate file type, size, paths, macros, generated artifacts, and provenance before an artifact can be returned to a customer workspace.",
      "Keep code-documentation generation read-only by default and require review before any pull request or documentation merge.",
      "Do not expose repository, personal connector, or provider credentials to documentation workers unless the exact connector is approved for that job."
    ],
    implementationPath: "Use queue-backed artifact/documentation contracts rather than installing desktop/CLI binaries inside the production web process."
  }),
  sourceRecord({
    key: "design_intelligence_and_skill_portability",
    label: "Portable design and engineering skill intelligence",
    source: "Batch 11 UI/UX Pro Max, engineering-skills, prompt, motion, and scroll-world references",
    sourceClass: "verified_repository_and_visual_reference",
    productFit: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio", "Internal development"],
    requirements: [
      "Treat reusable design and engineering skills as reviewable instruction packages with provenance, version, purpose, and bounded tools.",
      "Preserve SONARA v3 / Balanced Precision as the design authority; external design libraries supply research patterns, not a replacement brand system.",
      "Evaluate scroll, motion, Lottie, SVG, 3D, and immersive effects against accessibility, mobile performance, reduced-motion support, and conversion goals before use.",
      "Keep prompt libraries provider-portable and separate from credentials, provider authority, memory, or automatic execution."
    ],
    implementationPath: "Curate high-value patterns into SONARA-owned skills and components after design, accessibility, licence, and performance review."
  }),
  sourceRecord({
    key: "authorized_security_skill_boundary",
    label: "Authorized security skill boundary",
    source: "Batch 11 Strix and reverse-skill references",
    sourceClass: "verified_repository_reference",
    productFit: ["Authorized Security Lab", "Internal application security"],
    requirements: [
      "Require an owned or explicitly authorized target allowlist before active security testing.",
      "Run security tooling in isolated environments with bounded egress, non-production credentials, rate limits, retained logs, and explicit scope.",
      "Keep proof-of-concept exploitation, reverse engineering, reconnaissance, and remediation review behind human security approval.",
      "Never expose offensive security automation as a general customer capability or use it against unrelated third-party systems."
    ],
    implementationPath: "Use verified security repositories only as staging/authorized-security references; they receive no production target authority from this batch."
  }),
  sourceRecord({
    key: "agentic_crm_research",
    label: "Agentic-first CRM research",
    source: "Batch 11 Comp AI CRM reference",
    sourceClass: "verified_repository_reference",
    productFit: ["Business Builder", "Growth Studio", "Founder Operations"],
    requirements: [
      "Model CRM agents as bounded workers writing auditable research, notes, tasks, and recommendations into tenant-scoped records.",
      "Keep contact mutation, outbound messaging, pipeline stage changes, deletion, imports, and exports behind explicit permissions and audit events.",
      "Preserve human ownership of consequential customer communication and sales decisions.",
      "Research data models and interaction patterns without replacing SONARA tenancy, auth, consent, and provider boundaries."
    ],
    implementationPath: "Evaluate CRM data/agent patterns against existing SONARA customer and growth tables before creating duplicate schemas."
  })
]);

const BATCH11_REPOSITORY_REVIEW = Object.freeze([
  repositoryRecord({
    key: "harness_team_factory",
    repository: "revfactory/harness",
    license: "Apache-2.0",
    licenseStatus: "verified_from_github_repository_metadata",
    productFit: ["Internal development", "Business Builder", "Creator Studio", "Growth Studio"],
    value: "Meta-skill and team-pattern research for deterministic specialist-agent composition.",
    boundary: "Adapt orchestration patterns only; generated teams cannot widen tool, credential, publishing, billing, or merge authority."
  }),
  repositoryRecord({
    key: "mattpocock_engineering_skills",
    repository: "mattpocock/skills",
    license: "MIT",
    licenseStatus: "verified_from_github_repository_metadata",
    productFit: ["Internal development", "Skill Registry"],
    value: "Small composable engineering-skill patterns suitable for reviewed internal skill adaptation.",
    boundary: "Curate individual skills after behavior review; no bulk installation into a trusted runtime."
  }),
  repositoryRecord({
    key: "reverse_security_skill_router",
    repository: "zhaoxuya520/reverse-skill",
    license: "MIT",
    licenseStatus: "verified_from_github_repository_metadata",
    productFit: ["Authorized Security Lab", "Internal application security"],
    value: "Security/reverse-engineering skill-routing and authorization-boundary research.",
    boundary: "Owned or explicitly authorized targets only; no production credentials, third-party exploitation, covert access, or policy bypass."
  }),
  repositoryRecord({
    key: "ui_ux_pro_max_skill",
    repository: "nextlevelbuilder/ui-ux-pro-max-skill",
    license: "MIT",
    licenseStatus: "verified_canonical_upstream_from_fork_metadata",
    productFit: ["Internal design", "Creator Studio", "Business Builder"],
    value: "UI/UX design-intelligence patterns covering styles, palettes, typography, components, charts, and landing-page patterns.",
    boundary: "Use as design research only; Balanced Precision remains SONARA authority and every visible change still requires accessibility/performance verification."
  }),
  repositoryRecord({
    key: "agency_agents",
    repository: "msitarzewski/agency-agents",
    license: "MIT",
    licenseStatus: "verified_current_canonical_correction",
    productFit: ["Business Builder", "Creator Studio", "Growth Studio", "Internal development"],
    value: "Specialist role, deliverable-checklist, and review-workflow reference patterns.",
    boundary: "Curate selected roles only; external prompt instructions cannot override SONARA authorization, tenant isolation, privacy, or review rules."
  }),
  repositoryRecord({
    key: "meetily",
    repository: "Zackriya-Solutions/meetily",
    license: "MIT",
    licenseStatus: "verified_current_repository_metadata",
    productFit: ["Founder Operations", "Business Builder", "Files & Records"],
    value: "Local-first transcription, diarization, summarization, and meeting-notes architecture research.",
    boundary: "Desktop/local companion and explicit imports only; recording consent and tenant-scoped data handling are mandatory."
  }),
  repositoryRecord({
    key: "officecli",
    repository: "iOfficeAI/OfficeCLI",
    license: "Apache-2.0",
    licenseStatus: "verified_current_canonical_correction",
    productFit: ["Business Builder", "Creator Studio", "Reports", "Files & Records"],
    value: "DOCX/XLSX/PPTX inspection, creation, editing, and rendering worker patterns.",
    boundary: "Isolated worker only; no arbitrary shell passthrough, untrusted macros, or execution inside the production request process."
  }),
  repositoryRecord({
    key: "openwiki",
    repository: "langchain-ai/openwiki",
    license: "MIT",
    licenseStatus: "verified_current_canonical_correction",
    productFit: ["Internal development", "Research Lab", "Documentation"],
    value: "Repository documentation/wiki generation and maintenance workflow research.",
    boundary: "Read-only code mode first; no personal connectors or automatic documentation merge."
  }),
  repositoryRecord({
    key: "strix",
    repository: "usestrix/strix",
    license: "Apache-2.0",
    licenseStatus: "verified_current_canonical_correction",
    productFit: ["Authorized Security Lab", "Internal application security"],
    value: "Authorized application-security scanning, validation, reporting, and remediation workflow research.",
    boundary: "Staging/authorized targets only; no customer-accessible exploitation, third-party targeting, or production credentials."
  }),
  repositoryRecord({
    key: "comp_ai_crm",
    repository: "trycompai/crm",
    license: "MIT",
    licenseStatus: "verified_current_repository_metadata",
    productFit: ["Business Builder", "Growth Studio", "Founder Operations"],
    value: "Agentic-first CRM interaction, research-agent, and customer-record architecture reference.",
    boundary: "Reference patterns only until tenancy, auth, migrations, data model, outbound-action, and privacy behavior are independently reviewed."
  }),
  repositoryRecord({
    key: "scroll_world",
    repository: "oso95/scroll-world",
    license: "MIT",
    licenseStatus: "verified_current_repository_metadata",
    productFit: ["Creator Studio", "Marketing site research", "Internal design"],
    value: "Scroll-scrubbed 3D landing-page and immersive scene-transition skill research.",
    boundary: "Optional visual research only; do not compromise mobile performance, reduced-motion behavior, accessibility, or the current Balanced Precision information architecture."
  }),
  repositoryRecord({
    key: "nano_banana_prompt_recommender",
    repository: "YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill",
    license: "NOASSERTION",
    licenseStatus: "source_adoption_blocked_no_declared_license",
    productFit: ["Creator Studio", "Prompt Library research"],
    value: "Prompt-recommendation and prompt-search product pattern for image-generation workflows.",
    boundary: "Repository metadata declares no licence; do not copy source or prompt corpus. Independently implement only the general search/recommendation pattern if useful."
  })
]);

const BATCH11_UNRESOLVED_LEADS = Object.freeze([
  Object.freeze({
    key: "omniroute",
    requestedRepository: "omniroute/omniroute",
    reason: "The screenshot repository identity remains unverified/conflicted. Do not adopt routing claims, code, benchmarks, or licensing until an authoritative upstream is established."
  }),
  Object.freeze({
    key: "awesome_design_md",
    requestedRepository: "nicosxt/awesome-design-md",
    reason: "The supplied repository identity remains unverified. Use SONARA-owned documentation components until a canonical source and licence are established."
  })
]);

function sourceRecord(input) {
  return Object.freeze({
    batch: 11,
    recordType: "source_derived_operational_requirement",
    enabledByThisBatch: false,
    canExecuteFromThisRecord: false,
    productionExecutionAdded: 0,
    humanReviewRequired: true,
    ...input,
    productFit: Object.freeze([...(input.productFit || [])]),
    requirements: Object.freeze([...(input.requirements || [])])
  });
}

function repositoryRecord(input) {
  return Object.freeze({
    batch: 11,
    recordType: "verified_repository_research",
    integrationStatus: "research_only",
    enabledInProduction: false,
    runtimeStatus: "not_executed",
    canExecute: false,
    humanReviewRequired: true,
    verifiedAt: "2026-09-16",
    ...input,
    productFit: Object.freeze([...(input.productFit || [])])
  });
}

function getBatch11OperationalReview() {
  const records = BATCH11_OPERATIONAL_REVIEW.map((record) => ({
    ...record,
    productFit: [...record.productFit],
    requirements: [...record.requirements]
  }));
  const repositories = BATCH11_REPOSITORY_REVIEW.map((record) => ({
    ...record,
    productFit: [...record.productFit]
  }));
  const unresolvedLeads = BATCH11_UNRESOLVED_LEADS.map((record) => ({ ...record }));
  return {
    ok: true,
    batch: 11,
    mode: "verification_first_source_and_repository_review",
    recordCount: records.length,
    repositoryCount: repositories.length,
    unresolvedLeadCount: unresolvedLeads.length,
    productionExecutionAdded: 0,
    records,
    repositories,
    unresolvedLeads
  };
}

module.exports = {
  BATCH11_OPERATIONAL_REVIEW,
  BATCH11_REPOSITORY_REVIEW,
  BATCH11_UNRESOLVED_LEADS,
  getBatch11OperationalReview
};
