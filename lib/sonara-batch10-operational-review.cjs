"use strict";

// Batch 10 turns the latest user-supplied PDFs, screenshots, and workflow
// references into governed implementation requirements. These records are
// deliberately non-executing: a source can justify a requirement without
// becoming a dependency, a provider connection, or a claim that SONARA already
// satisfies a standard.

const BATCH10_OPERATIONAL_REVIEW = Object.freeze([
  sourceRecord({
    key: "compliance_control_model",
    label: "Compliance evidence control model",
    source: "How-to-build-compliance-strategy_copy.pdf",
    sourceClass: "uploaded_reference",
    productFit: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio", "Founder Operations"],
    requirements: [
      "Organize readiness evidence around visibility, protection/localization, governance, and audit/reporting.",
      "Keep encryption, access control, logging, sensitive-data handling, and data-location posture explicit.",
      "Retain auditable provider/request metadata while redacting secrets and unnecessary personal data.",
      "Never translate control evidence into a claim of PCI DSS, ISO 27001, GDPR, SOC 2, or other certification without independent proof."
    ],
    implementationPath: "Extend the existing readiness and audit surfaces with evidence status and named gaps instead of a compliance badge."
  }),
  sourceRecord({
    key: "payment_cost_and_dispute_transparency",
    label: "Payment cost and dispute transparency",
    source: "Ebook-Secrets-of-Payment-Processing_copy.pdf",
    sourceClass: "uploaded_reference",
    productFit: ["Business Builder", "Billing", "Founder Operations"],
    requirements: [
      "Expose provider-reported processing costs and fee components when authoritative transaction evidence is available.",
      "Keep recurring billing, emailed invoices, mobile payment, reconciliation, refund, and dispute state understandable to a small operator.",
      "Do not hard-code marketing-guide fee averages or universalize claims about fees a merchant should never pay.",
      "Keep raw card data and CVV out of SONARA and preserve the existing direct-charge custody boundary."
    ],
    implementationPath: "Add provider-truth cost/dispute evidence around the existing Stripe Connect direct-charge architecture rather than introducing a second payment rail."
  }),
  sourceRecord({
    key: "generative_ai_governance",
    label: "Generative AI governance and model choice",
    source: "ebook_mit-cio-generative-ai-report_copy.pdf",
    sourceClass: "uploaded_reference",
    productFit: ["SONARA One", "Provider Gateway", "Creator Studio", "Growth Studio", "Research Lab"],
    requirements: [
      "Keep model/provider choice centralized and observable instead of allowing product modules to call arbitrary models directly.",
      "Treat organizational data, intellectual property, privacy, security, copyright, reliability, and provider dependence as model-governance concerns.",
      "Allow local, open, small, or custom models only through the same authority, provenance, tenancy, and cost controls as hosted providers.",
      "Track model/provider readiness separately from product capability so an unavailable provider does not become a fake product failure."
    ],
    implementationPath: "Strengthen Provider Gateway evidence, model/provider registry metadata, and audit provenance without granting new provider authority."
  }),
  sourceRecord({
    key: "saas_launch_operating_method",
    label: "SaaS launch operating method",
    source: "SaasSArchitects(1).pdf",
    sourceClass: "uploaded_reference",
    productFit: ["Business Builder", "Founder Operations", "Research Lab"],
    requirements: [
      "Require problem validation and market evidence before a build commitment.",
      "Define an MVP around the smallest testable customer outcome rather than the largest feature list.",
      "Record technology, UX, delivery, pre-launch, beta-feedback, and iteration decisions as lifecycle evidence.",
      "Keep roadmap decisions reversible until customer evidence and release gates justify expansion."
    ],
    implementationPath: "Map the source's validation-to-beta sequence onto SONARA's existing product lifecycle evidence instead of creating a parallel project system."
  }),
  sourceRecord({
    key: "agent_prompt_portability",
    label: "Portable agent skills and prompt workflows",
    source: "Batch 10 screenshot intake",
    sourceClass: "user_submitted_screenshots",
    productFit: ["Claude", "ChatGPT/Codex", "Prompt Library", "Internal development"],
    requirements: [
      "Represent reusable prompts, skills, personas, checklists, and review workflows as portable instructions rather than provider-specific authority.",
      "Preserve SONARA tenancy, approvals, provider policy, secrets, audit, and release gates regardless of which agent executes a development workflow.",
      "Keep personal-style and memory features transparent, editable, exportable, and non-deceptive.",
      "Treat community prompt graphics as workflow inspiration rather than authoritative product commands."
    ],
    implementationPath: "Adapt useful instruction patterns into the existing governed Prompt Library and cross-agent development contract."
  }),
  sourceRecord({
    key: "creator_growth_automation",
    label: "Research-to-publish automation loop",
    source: "Batch 10 creative automation screenshots",
    sourceClass: "user_submitted_screenshots",
    productFit: ["Creator Studio", "Growth Studio"],
    requirements: [
      "Separate research, scripting, packaging, generation, quality control, publishing, and measurement into observable stages.",
      "Require owner approval for consequential sends or publishing and retain consent, rights, provider, and cost checks.",
      "Use provider adapters and isolated workers for media generation rather than embedding third-party workflow credentials into the web process.",
      "Persist outcomes and retry state without silently expanding the approved recipient or publication set."
    ],
    implementationPath: "Use the staged loop as an original SONARA workflow specification; do not copy third-party prompts, branding, or provider credentials."
  }),
  sourceRecord({
    key: "authorized_security_research",
    label: "Authorized security and OSINT research boundary",
    source: "Batch 10 security-tool screenshots",
    sourceClass: "user_submitted_screenshots",
    productFit: ["Authorized Security Lab", "Internal development"],
    requirements: [
      "Keep reconnaissance, social-engineering, Tor, device, and agent-security projects research-only unless a specific defensive implementation is approved.",
      "Require an allowlisted owned or explicitly authorized target for active security testing.",
      "Prohibit credential capture, covert surveillance, lock bypass, identity tracing, and unauthorized crawling.",
      "Keep defensive findings auditable and isolated from customer production data."
    ],
    implementationPath: "Preserve the existing authorized-security-lab boundary; Batch 10 adds evidence and review criteria, not offensive runtime capability."
  })
]);

// Repositories below were independently resolved from Batch 10 screenshots.
// Verification here means the repository identity and declared licence were
// checked; it does NOT mean the code is approved for production adoption.
const BATCH10_REPOSITORY_REVIEW = Object.freeze([
  repositoryRecord({
    key: "page_agent",
    repository: "alibaba/page-agent",
    license: "MIT",
    licenseStatus: "verified",
    productFit: ["Internal development", "Business Builder"],
    value: "In-page GUI-agent and browser interaction patterns.",
    boundary: "No autonomous customer-site control; require target allowlists, tenant isolation, approval, and bounded browser sessions before any runtime adoption."
  }),
  repositoryRecord({
    key: "open_code_review",
    repository: "alibaba/open-code-review",
    license: "Apache-2.0",
    licenseStatus: "verified",
    productFit: ["Internal development", "Release engineering"],
    value: "Structured diff/file review, resumable review sessions, and portable coding-agent integration patterns.",
    boundary: "May assist review but cannot approve or merge its own changes, infer provider credentials, or bypass SONARA release gates."
  }),
  repositoryRecord({
    key: "prompt_master",
    repository: "nidhinjs/prompt-master",
    license: "MIT",
    licenseStatus: "verified",
    productFit: ["Prompt Library", "Claude", "ChatGPT/Codex"],
    value: "Portable prompt/skill structure and concise task-context patterns.",
    boundary: "Adapt patterns only; do not import hidden memory claims or grant a prompt broader tool authority."
  }),
  repositoryRecord({
    key: "presentation_design_prompts",
    repository: "SlideSpeak/presentation-design-prompts",
    license: "MIT",
    licenseStatus: "verified",
    productFit: ["Creator Studio", "Internal design"],
    value: "Structured presentation design-system prompts with palette, font, layout, and avoid-list conventions.",
    boundary: "Use as design-system research; preserve SONARA v3/Balanced Precision and do not imply affiliation with named consulting brands."
  }),
  repositoryRecord({
    key: "screenshot_to_code",
    repository: "abi/screenshot-to-code",
    license: "MIT",
    licenseStatus: "verified",
    productFit: ["Internal development", "Creator Studio"],
    value: "Screenshot-to-HTML/Tailwind/React/Vue reconstruction patterns.",
    boundary: "Reference implementation only until privacy, image-rights, model-provider, and generated-code review controls are satisfied."
  }),
  repositoryRecord({
    key: "neko",
    repository: "m1k1o/neko",
    license: "Apache-2.0",
    licenseStatus: "verified",
    productFit: ["Internal development", "Browser worker research"],
    value: "Self-hosted Docker/WebRTC virtual-browser architecture.",
    boundary: "Any adoption must run as an isolated, resource-bounded worker with authenticated sessions and no implicit access to tenant credentials."
  }),
  repositoryRecord({
    key: "recordly",
    repository: "webadderallorg/Recordly",
    license: "AGPL-3.0",
    licenseStatus: "verified_from_repository_license",
    productFit: ["Creator Studio", "Documentation"],
    value: "Screen recording, editing, and polished product-demo workflow patterns.",
    boundary: "Copyleft review required before source reuse; treat as research-only unless an isolated deployment or compatible licensing decision is approved."
  }),
  repositoryRecord({
    key: "connected_things_security",
    repository: "V33RU/awesome-connected-things-sec",
    license: "CC0-1.0",
    licenseStatus: "verified",
    productFit: ["Authorized Security Lab", "Research Lab"],
    value: "Curated IoT, embedded, firmware, wireless, and connected-device security references.",
    boundary: "Reference catalog only; active testing remains limited to owned or explicitly authorized targets."
  }),
  repositoryRecord({
    key: "saas_marketing_agents",
    repository: "shalintripathi/saas-marketing-agents",
    license: "MIT",
    licenseStatus: "verified",
    productFit: ["Growth Studio", "Internal development"],
    value: "Role/skill decomposition across SEO/AEO/GEO, content, demand, PLG, analytics, ABM, and product marketing.",
    boundary: "Adapt workflow decomposition only; sends, targeting, claims, consent, and customer data remain governed by SONARA approvals and provider policy."
  }),
  repositoryRecord({
    key: "artuniverse",
    repository: "Bugfux1979/artuniverse",
    license: "MIT",
    licenseStatus: "verified",
    productFit: ["Creator Studio", "Community research"],
    value: "Authentication, media sharing, and dynamic-feed reference patterns.",
    boundary: "Low-maturity reference only; no direct source adoption without architecture, dependency, security, and tenancy review."
  }),
  repositoryRecord({
    key: "hands_on_data_viz",
    repository: "HandsOnDataViz/book",
    license: "MIT",
    licenseStatus: "verified",
    productFit: ["SONARA One", "Growth Studio", "Reporting"],
    value: "Data-visualization and interactive-storytelling design guidance.",
    boundary: "Use principles and original SONARA components; do not copy book prose or illustrations into product UI."
  }),
  repositoryRecord({
    key: "visionnote_ai",
    repository: "mohit-jadav01/VisionNote-AI",
    license: "NOASSERTION",
    licenseStatus: "source_adoption_blocked_no_declared_license",
    productFit: ["Creator Studio", "Media intelligence research"],
    value: "Transcription, summary, media insight, and RAG-over-media product pattern.",
    boundary: "Do not copy source while no repository licence is declared; only independently implement the general product pattern."
  }),
  repositoryRecord({
    key: "blue_team_catalog",
    repository: "fabacab/awesome-cybersecurity-blueteam",
    license: "NOASSERTION",
    licenseStatus: "source_adoption_blocked_no_declared_license",
    productFit: ["Authorized Security Lab", "Research Lab"],
    value: "Defensive blue-team resource discovery.",
    boundary: "Catalog/reference use only; individual downstream tools require their own authorization and licence review."
  }),
  repositoryRecord({
    key: "system_design_architecture",
    repository: "puncsky/system-design-and-architecture",
    license: "NOASSERTION",
    licenseStatus: "source_adoption_blocked_no_declared_license",
    productFit: ["Internal architecture research"],
    value: "System-design decomposition and architecture-study reference.",
    boundary: "Conceptual research only while no repository licence is declared; do not copy content into SONARA documentation."
  })
]);

const BATCH10_UNRESOLVED_LEADS = Object.freeze([
  Object.freeze({ key: "agent_quest", reason: "Screenshot owner/repository spelling could not be resolved authoritatively; keep unresolved instead of guessing." }),
  Object.freeze({ key: "threejs_object_sculptor", reason: "Multiple similarly named forks/plugins exist; canonical screenshot upstream must be resolved before catalog promotion." }),
  Object.freeze({ key: "tel_agent", reason: "Screenshot describes an AGPL/pre-alpha phone gateway but does not provide an authoritative repository identity in the captured frame." }),
  Object.freeze({ key: "userhunter", reason: "OSINT screenshot did not establish a canonical repository/license; retain as an authorized-security research lead only." }),
  Object.freeze({ key: "mcp_project_planner", reason: "Screenshot exposes a hosted MCP endpoint, not an independently verified source repository; no connection is added by this batch." })
]);

function sourceRecord(input) {
  return Object.freeze({
    batch: 10,
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
    batch: 10,
    recordType: "verified_repository_research",
    integrationStatus: "research_only",
    enabledInProduction: false,
    runtimeStatus: "not_executed",
    canExecute: false,
    humanReviewRequired: true,
    verifiedAt: "2026-09-15",
    ...input,
    productFit: Object.freeze([...(input.productFit || [])])
  });
}

function getBatch10OperationalReview() {
  const records = BATCH10_OPERATIONAL_REVIEW.map((record) => ({
    ...record,
    productFit: [...record.productFit],
    requirements: [...record.requirements]
  }));
  const repositories = BATCH10_REPOSITORY_REVIEW.map((record) => ({
    ...record,
    productFit: [...record.productFit]
  }));
  const unresolvedLeads = BATCH10_UNRESOLVED_LEADS.map((record) => ({ ...record }));
  return {
    ok: true,
    batch: 10,
    mode: "governed_source_and_repository_review",
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
  BATCH10_OPERATIONAL_REVIEW,
  BATCH10_REPOSITORY_REVIEW,
  BATCH10_UNRESOLVED_LEADS,
  getBatch10OperationalReview
};
