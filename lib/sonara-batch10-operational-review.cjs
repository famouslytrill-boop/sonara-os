"use strict";

// Batch 10 turns the latest user-supplied PDFs, screenshots, and workflow
// references into governed implementation requirements.  These records are
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

function getBatch10OperationalReview() {
  const records = BATCH10_OPERATIONAL_REVIEW.map((record) => ({
    ...record,
    productFit: [...record.productFit],
    requirements: [...record.requirements]
  }));
  return {
    ok: true,
    batch: 10,
    mode: "governed_source_review",
    recordCount: records.length,
    repositoryCountAdded: 0,
    productionExecutionAdded: 0,
    records
  };
}

module.exports = {
  BATCH10_OPERATIONAL_REVIEW,
  getBatch10OperationalReview
};
