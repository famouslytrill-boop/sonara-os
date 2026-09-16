"use strict";

// Source-derived evidence registry for the eleven-batch convergence. These records
// preserve what a supplied document/screenshot supports without turning the
// source into executable code, a legal/compliance claim, or a provider grant.

const SOURCE_EVIDENCE = Object.freeze([
  evidence({
    key: "compliance_strategy_pdf",
    title: "How-to-build-compliance-strategy_copy.pdf",
    sourceClass: "uploaded_pdf",
    authority: "operational_guidance",
    batches: [10],
    productFit: ["SONARA One", "Founder operations", "Business Builder", "Creator Studio", "Growth Studio"],
    supports: [
      "four-stage readiness model: visibility, protect/localize, governance, audit/reporting",
      "access control, encryption, logging, data minimization, data-location awareness, and audit evidence",
      "generative-AI audit metadata including providers, errors, timestamps, and request/response evidence"
    ],
    boundaries: [
      "does not prove SONARA compliance or certification",
      "raw prompts/responses are not logged by default when data minimization or sensitive-data controls call for redacted provenance instead"
    ]
  }),
  evidence({
    key: "payment_processing_pdf",
    title: "Ebook-Secrets-of-Payment-Processing_copy.pdf",
    sourceClass: "uploaded_pdf",
    authority: "operational_guidance",
    batches: [10],
    productFit: ["Business Builder", "Billing", "Founder operations"],
    supports: [
      "payment-cost transparency",
      "recurring billing, invoicing, reconciliation, refunds, disputes, and chargeback visibility",
      "provider-reported payment truth rather than generic estimated fees"
    ],
    boundaries: ["marketing-guide fee averages are not runtime pricing truth", "raw card data and CVV remain outside SONARA"]
  }),
  evidence({
    key: "mit_cio_genai_pdf",
    title: "ebook_mit-cio-generative-ai-report_copy.pdf",
    sourceClass: "uploaded_pdf",
    authority: "architecture_guidance",
    batches: [10],
    productFit: ["SONARA One", "Provider Gateway", "Creator Studio", "Growth Studio", "Research Lab"],
    supports: [
      "centralized provider/model governance",
      "explicit hosted-versus-open/local model decisions",
      "privacy, IP, copyright, security, reliability, cost, and provider-dependence review"
    ],
    boundaries: ["provider availability is not the same as product capability", "source guidance does not authorize any model or provider"]
  }),
  evidence({
    key: "saas_architects_pdf",
    title: "SaasSArchitects(1).pdf",
    sourceClass: "uploaded_pdf",
    authority: "product_delivery_guidance",
    batches: [10],
    productFit: ["Founder operations", "Business Builder", "Product lifecycle"],
    supports: ["problem validation before build", "smallest testable MVP", "technology/UX/pre-launch/beta feedback and iteration evidence"],
    boundaries: ["does not replace SONARA release gates or roadmap authority"]
  }),
  evidence({
    key: "repository_allowlist",
    title: "REPOSITORY_ALLOWLIST.md",
    sourceClass: "uploaded_policy_document",
    authority: "open_source_policy_input",
    batches: [1,2,3,4,5,6,7,10],
    productFit: ["Infrastructure", "Creator Studio", "Internal development"],
    supports: [
      "adapter-first integration for ComfyUI, ACE-Step, Wan 2.2, Basic Pitch, Demucs, speech recognition, OpenTimelineIO, OpenJarvis, UI-TARS, and OBS",
      "permissive/review/never-import policy classes",
      "recording upstream, pinned version, source license, weight license, hashes, compatibility, and advisories"
    ],
    boundaries: ["an allowlist is an adoption policy input, not proof that every model weight or dependency remains commercially safe today"]
  }),
  evidence({
    key: "model_registry_yaml",
    title: "models.yaml",
    sourceClass: "uploaded_machine_readable_model_registry",
    authority: "model_registry_input",
    batches: [1,2,3,4,5,6,7,10],
    productFit: ["Creator Studio", "Provider Gateway", "Model/Engine control plane"],
    supports: [
      "separate source-code and model-weight license fields",
      "execution placement and VRAM requirements",
      "approved/review/blocked model states",
      "consent requirement for voice-cloning-capable models"
    ],
    boundaries: ["current upstream metadata can supersede stale registry entries", "commercial use remains gated by current model-card and intended-use review"]
  }),
  evidence({
    key: "open_source_ai_license_audit",
    title: "compass_artifact_wf-ffcbbcc1-cdab-5179-a063-c525fa346706_text_markdown.md",
    sourceClass: "uploaded_research_report",
    authority: "research_input",
    batches: [1,2,3,4,5,6,7,10],
    productFit: ["Creator Studio", "Research Lab"],
    supports: [
      "commercial-safe versus restricted model families",
      "local GPU/media worker architecture",
      "human-authored media and provenance requirements",
      "Wan/Qwen/ACE-Step/TTS/transcription/animation candidate research"
    ],
    boundaries: ["volatile prices, versions, hosted-service terms, and model licenses require current re-verification before production promotion"]
  }),
  evidence({
    key: "five_channel_build_plan",
    title: "five-channel-build-plan (1).md",
    sourceClass: "uploaded_research_plan",
    authority: "research_input",
    batches: [1,2,3,4,5,6,7,10],
    productFit: ["Creator Studio", "Growth Studio"],
    supports: ["media generation stack comparisons", "character consistency workflow research", "TTS/music/animation pipeline ideas", "human-authorship and staged automation strategy"],
    boundaries: ["channel-specific business assumptions are not SONARA platform runtime facts", "source contains time-sensitive model/license claims that require upstream verification"]
  }),
  evidence({
    key: "balanced_precision_design",
    title: "DESIGN_DIRECTION.md",
    sourceClass: "uploaded_design_document",
    authority: "current_design_support",
    batches: [9,10],
    productFit: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"],
    supports: ["Balanced Precision", "shared tokens with product-specific accents", "neutral-first layout with controlled saturated moments", "human approval as a visible design principle"],
    boundaries: ["Batch 9/current repository design authority wins if an older design document conflicts"]
  }),
  evidence({
    key: "market_rd_2026_2027",
    title: "MARKET_R&D_2026_2027.md",
    sourceClass: "uploaded_market_research",
    authority: "design_and_product_research",
    batches: [8,9,10],
    productFit: ["SONARA One", "Marketing site", "Product UX"],
    supports: ["bright precision direction", "explainable recommendations", "controlled personalization", "performance targets", "one coherent design system"],
    boundaries: ["third-party brand principles are inspiration only; SONARA must remain original"]
  }),
  evidence({
    key: "cross_industry_research",
    title: "CROSS_INDUSTRY_RESEARCH.md",
    sourceClass: "uploaded_market_research",
    authority: "design_and_product_research",
    batches: [8,9,10],
    productFit: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"],
    supports: ["product demonstration", "accessible design", "media-first hierarchy", "clear commerce", "performance-as-brand", "multi-channel feedback"],
    boundaries: ["no copying proprietary source, assets, private architecture, or distinctive layouts"]
  }),
  evidence({
    key: "legacy_claude_design_prompt",
    title: "CLAUDE_DESIGN_MASTER_PROMPT.md",
    sourceClass: "uploaded_agent_design_prompt",
    authority: "historical_superseded_where_conflicting",
    batches: [8,9],
    productFit: ["Claude", "Design workflow"],
    supports: ["stable product route families", "small-operator audience", "Balanced Precision principles", "truthful product states"],
    boundaries: ["SONARA Nexus naming and Prism Wave authority are historical when they conflict with current SONARA One v3 / Batch 9 authority"]
  }),
  evidence({
    key: "batch10_visual_intake",
    title: "Batch 10 screenshots, diagrams, graphs, and UI references",
    sourceClass: "uploaded_visual_evidence_set",
    authority: "research_and_workflow_inspiration",
    batches: [10],
    productFit: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio", "Internal development"],
    supports: ["agent workflow decomposition", "prompt-tool patterns", "LLM architecture education", "creator automation stages", "POS/admin concepts", "phone-assistant concepts", "developer/security tool leads"],
    boundaries: ["screenshots are not proof of repository identity, license, security, integration, or production capability", "visual references are not copied wholesale into SONARA"]
  }),
  evidence({
    key: "batch11_visual_intake",
    title: "Batch 11 screenshots, repository posts, architecture diagrams, prompts, and workflow references",
    sourceClass: "uploaded_visual_evidence_set",
    authority: "verification_first_research_and_workflow_inspiration",
    batches: [11],
    productFit: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio", "Founder Operations", "Internal development"],
    supports: [
      "verification-first repository intake and source correction",
      "bounded multi-agent team patterns with router, specialist, integrator, reviewer, and human checkpoint roles",
      "truthful build/MVP/cost-estimation requirements without social-media valuation claims",
      "local meeting intelligence and explicit transcript import",
      "isolated document and code-documentation worker patterns",
      "portable design/engineering skills and accessible motion/scroll research",
      "agentic CRM research with human approval for consequential actions",
      "authorized security-lab patterns for owned or explicitly authorized targets"
    ],
    boundaries: [
      "screenshots and social posts remain leads rather than proof of repository identity, licence, capability, cost, valuation, safety, or production readiness",
      "current repository/runtime truth and formal SONARA policy override external marketing claims",
      "no screenshot, prompt, skill, repository, or agent gains execution authority from evidence intake"
    ]
  })
]);

function getSourceEvidenceRegister() {
  const records = SOURCE_EVIDENCE.map(clone);
  const classes = records.reduce((out, record) => {
    out[record.sourceClass] = (out[record.sourceClass] || 0) + 1;
    return out;
  }, {});
  return {
    ok: true,
    mode: "source_grounded_evidence_register",
    sourceCount: records.length,
    classes,
    records,
    boundaries: [
      "A source record is evidence/context, not executable code or an authorization grant.",
      "Current repository/runtime truth supersedes stale time-sensitive claims in uploaded research.",
      "Legal, regulatory, model-weight, dataset, content-rights, and provider terms remain separately reviewable."
    ]
  };
}

function evidence(input) {
  return Object.freeze({
    executable: false,
    productionAuthority: false,
    humanReviewRequired: true,
    ...input,
    batches: Object.freeze([...(input.batches || [])]),
    productFit: Object.freeze([...(input.productFit || [])]),
    supports: Object.freeze([...(input.supports || [])]),
    boundaries: Object.freeze([...(input.boundaries || [])])
  });
}

function clone(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

module.exports = { SOURCE_EVIDENCE, getSourceEvidenceRegister };
