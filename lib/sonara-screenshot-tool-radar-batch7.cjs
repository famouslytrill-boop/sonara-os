"use strict";

// Consolidated 2026-09-15 screenshot intake. This is evidence and planning
// data only: no package is installed, imported, executed, or granted secrets.

const REPOSITORIES = [
  ["spec_kit", "GitHub Spec Kit", "github/spec-kit", "MIT", "spec-driven development workflow", ["Internal development", "SONARA One"], "developer_only", "Define requirements, acceptance criteria, plans, tasks, and verification before implementation."],
  ["awesome_selfhosted", "Awesome-Selfhosted", "awesome-selfhosted/awesome-selfhosted", "CC-BY-SA-3.0", "self-hosted software discovery catalog", ["Research Lab", "Founder Operations"], "curated_reference", "Use as a discovery index; independently verify every linked project's license and security posture."],
  ["openclip", "OpenClip", "ganeshmshetty/openclip", "MIT", "macOS selected-text action utility", ["Desktop companion", "SONARA One"], "developer_only", "Prototype consent-based contextual actions without capturing unrelated clipboard or screen content."],
  ["growthbook", "GrowthBook", "growthbook/growthbook", "Mixed: MIT outside enterprise directories; GrowthBook Enterprise License inside enterprise directories", "feature flags and experimentation", ["SONARA One", "Growth Studio", "Internal development"], "optional_adapter_after_review", "Compare a narrow SDK integration with SONARA's current rollout controls; exclude enterprise-licensed source."],
  ["agent_skills_addy", "Agent Skills", "addyosmani/agent-skills", "MIT", "cross-agent software delivery skills", ["Claude", "Codex", "Internal development"], "developer_only", "Review and adapt individual skills into SONARA's existing authority, pnpm, test, and release contracts."],
  ["olmocr", "olmOCR", "allenai/olmocr", "Apache-2.0; model weights and datasets require separate review", "document OCR and structured text extraction", ["Business Builder", "Creator Studio", "Document worker"], "optional_adapter_after_review", "Benchmark one isolated, resource-limited document worker on synthetic documents."],
  ["albertmicro", "AlbertMicro", "thinking0things/AlbertMicro", "No license file verified", "ESP32-S3 expressive quadruped reference", ["Personal Agent OS", "Research Lab"], "curated_reference", "Keep as hardware inspiration unless the owner supplies or upstream publishes usable license terms."],
  ["skills_manager", "Skills Manager", "yibie/skills-manager", "MIT", "macOS cross-agent skill manager", ["Claude", "Codex", "Desktop companion"], "developer_only", "Compare read-only discovery and validation with SONARA's governed skill registry before any installer work."],
  ["dspy", "DSPy", "stanfordnlp/dspy", "MIT", "programmatic LM workflow optimization", ["SONARA One", "Research Lab", "Provider Gateway"], "optional_adapter_after_review", "Run an offline evaluation against one existing prompt workflow; do not let optimization bypass policy gates."],
  ["fluxer", "Fluxer", "fluxerapp/fluxer", "AGPL-3.0", "self-hosted communications platform", ["Community operations", "Research Lab"], "research_only", "Treat as architecture reference unless a separately operated AGPL-compliant service is approved."],
  ["hiring_agent", "Hiring Agent", "interviewstreet/hiring-agent", "MIT", "recruiting workflow agent", ["Business Builder", "Founder Operations"], "research_only", "Limit to drafting, scheduling, and evidence organization; humans make employment decisions."],
  ["awesome_social_engineering", "Awesome Social Engineering", "giuliacassara/awesome-social-engineering", "No license file verified", "social-engineering learning catalog", ["Security awareness", "Research Lab"], "research_only", "Use only for defensive awareness and controls; never operational manipulation or credential capture."],
  ["hackagent", "HackAgent", "AISecurityLab/hackagent", "Apache-2.0", "AI security testing framework", ["Authorized Security Lab", "Internal development"], "research_only", "Only test allowlisted SONARA-owned or explicitly authorized targets in an isolated lab."],
  ["agentmemory", "AgentMemory", "rohitg00/agentmemory", "Apache-2.0", "long-term memory for agents", ["SONARA One", "Claude", "Codex"], "optional_adapter_after_review", "Prototype provenance, tenant isolation, correction, expiry, export, and deletion before persistence."],
  ["system_informer", "System Informer", "winsiderss/systeminformer", "License requires authoritative path-level review", "Windows diagnostics and process inspection", ["Desktop companion", "Founder Operations"], "developer_only", "Use as diagnostics UX reference; keep process control local, privileged, explicit, and reversible."],
  ["insomnia", "Insomnia", "Kong/insomnia", "Apache-2.0", "API design and testing client", ["Internal development", "Provider Gateway"], "developer_only", "Use local collections with redacted examples; never commit tokens, cookies, or production response data."],
  ["torbot", "TorBot", "DedSecInside/TorBot", "GPL-3.0", "Tor search and OSINT crawler", ["Authorized Security Lab"], "research_only", "No production adapter; prohibit identity tracing, credential gathering, surveillance, and unauthorized crawling."],
  ["claude_desktop_buddy", "Claude Desktop Buddy", "anthropics/claude-desktop-buddy", "MIT for code; bundled Bufo art excluded", "physical ambient AI companion", ["Personal Agent OS", "Desktop companion"], "curated_reference", "Use original SONARA characters/assets and preserve local hardware consent and status visibility."],
  ["autogpt", "AutoGPT", "Significant-Gravitas/AutoGPT", "Mixed: PolyForm Shield for autogpt_platform; MIT outside that directory", "agent building and deployment platform", ["Research Lab", "Agent orchestration"], "research_only", "Use patterns only until path-level licensing, authority, secret, cost, and isolation reviews pass."],
  ["rengine", "reNgine", "yogeshojha/rengine", "GPL-3.0", "web reconnaissance and vulnerability assessment", ["Authorized Security Lab"], "research_only", "Allowlisted targets only; no hosted customer scanner and no source reuse without copyleft review."],
  ["convertx", "ConvertX", "C4illin/ConvertX", "AGPL-3.0", "self-hosted multi-format conversion", ["Document worker", "Creator Studio"], "research_only", "Benchmark formats in an isolated worker; block archives, active content, unbounded jobs, and network egress."],
  ["langostino", "Langostino", "swarm-subnet/Langostino", "MIT", "autonomous drone reference platform", ["Research Lab", "Personal Agent OS"], "research_only", "Simulation first; no autonomous physical operation without hardware safety and legal review."],
  ["affine", "AFFiNE", "toeverything/AFFiNE", "Mixed: MIT generally; backend/native directories use separate terms", "documents, whiteboards, and knowledge workspace", ["SONARA One", "Business Builder", "Creator Studio"], "curated_reference", "Extract clean-room workspace requirements; do not copy restricted backend/native code."],
  ["wechaty", "Wechaty", "wechaty/wechaty", "Apache-2.0; puppet/provider terms separate", "multi-channel conversational RPA", ["Growth Studio", "Business Builder"], "optional_adapter_after_review", "Require approved provider APIs, consent, opt-out, credential isolation, and send approval."],
  ["gpty", "gPTY", "godot-pty/gpty", "GPL-3.0", "Godot/Rust PTY workspace with JSON-RPC and MCP", ["Admin Command Center", "Internal development"], "research_only", "Keep terminals local or sandboxed; never expose unrestricted shell execution to customers."],
  ["wardrobe", "Wardrobe", "tandpfun/wardrobe", "MIT", "image-to-organized-item catalog", ["Creator Studio", "Business Builder"], "curated_reference", "Generalize the consent-based extraction pattern for user-owned product and asset catalogs."],
  ["fleetbase", "Fleetbase", "fleetbase/fleetbase", "AGPL-3.0 reported in submitted screenshot; authoritative file review still required", "logistics and supply-chain operations", ["Business Builder", "Research Lab"], "research_only", "Map dispatch, routing, fleet, and order concepts; do not embed copyleft source without review."]
];

const SCREENSHOT_TOOL_RADAR_BATCH7 = Object.freeze(REPOSITORIES.map((row) => record({
  key: row[0], label: row[1], repository: row[2], license: row[3], role: row[4],
  productFit: row[5], integrationStatus: row[6], nextStep: row[7]
})));

const NON_REPOSITORY_REFERENCES_BATCH7 = Object.freeze([
  reference("picolm_local_ai", "PicoLM / PicoClaw local AI claim", "Unverified local-model and low-cost hardware lead", "Verify the exact upstream, benchmarks, model license, memory limits, and device support before prototyping."),
  reference("ostris_osint", "OSTRIS OSINT interface", "OSINT map/interface concept", "Keep as lawful public-data and self-audit UX inspiration; prohibit covert monitoring or sensitive-person tracking."),
  reference("rag_architecture_guide", "Eight RAG architectures", "Educational comparison of naive, multimodal, HyDE, corrective, graph, hybrid, adaptive, and agentic RAG", "Use as an evaluation matrix; select retrieval by measured failure mode, latency, faithfulness, and cost."),
  reference("response_shortcuts", "ChatGPT and Claude response shortcuts", "Community prompt-pattern graphics", "Translate useful patterns into documented presentation modes; verify native commands against official product docs."),
  reference("higgsfield_service", "Higgsfield", "Hosted image editing/generation service", "Evaluate through Creator Studio's provider boundary after terms, pricing, training-data, retention, and rights review."),
  reference("claude_seo_skill", "Claude SEO", "Community SEO skill/plugin lead", "Verify the exact upstream before adapting technical, content, local, schema, and commerce SEO workflows."),
  reference("ruview_wifi_sensing", "RuView Wi-Fi sensing", "Wi-Fi-based presence and vital-sign sensing claim", "No product integration without explicit consent, local processing, accuracy validation, and privacy/legal review."),
  reference("creative_os_pipeline", "Five-agent Creative OS", "Research, script, package, create/QC, and publish/operations workflow", "Implement as original approval-gated Creator Studio workflow specifications, not copied prompts or branding."),
  reference("tel_agent", "Tel-Agent", "Open-source phone-agent service shown without an authoritative repository", "Verify upstream and license; require recording disclosure, consent, human transfer, emergency limits, and retention controls."),
  reference("pos_ui_lead", "Small-business POS interface", "User-submitted POS workflow screenshot without source repository", "Turn checkout, stock, supplier, loyalty, employee, and permission ideas into a separate PCI/tax-reviewed product specification."),
  reference("ai_infrastructure_path", "AI infrastructure pathway", "Training/architecture checklist from Linux through multi-tenant inference", "Use as a maturity model; do not provision GPU or Kubernetes infrastructure before measured demand."),
  reference("llm_learning_material", "LLM, RAG, and agent learning graphics", "Community educational diagrams and course roadmap", "Keep as internal learning leads and verify technical claims and course availability at use time."),
  reference("cloudflare_security_audit_skill", "Cloudflare Security Audit skill", "Security-audit skill lead", "Verify upstream; any adaptation must preserve independent verification and authorized-target boundaries."),
  reference("phone_repair_toolbox", "MCT Android Toolbox", "Third-party device service and flashing utility", "Owned/authorized devices only; prohibit lock bypass, identifier alteration, unauthorized access, or bundled execution."),
  reference("google_drive_pooling", "Multi-account Drive gateway", "Storage aggregation concept", "Support legitimate connected-account views only; reject quota evasion, credential sharing, and provider-limit circumvention."),
  reference("sop_generator_lead", "Recorded actions to SOP", "Unverified browser-extension concept", "Specify consent-based local capture, redaction, editable steps, and user-approved export before seeking an implementation."),
  reference("agent_clone_pattern", "Personal AI clone pattern", "Personal-context and reusable-instruction workflow", "Implement transparent, editable, exportable memory and style preferences; prohibit deceptive impersonation.")
]);

function record(input) {
  const sensitive = /security|Tor|hiring|recruiting|financial|drone|communications|logistics|PTY|diagnostic/i.test(`${input.role} ${input.label}`);
  return Object.freeze({
    repositoryVerified: !/reported in submitted screenshot|requires authoritative/.test(input.license),
    repoUrl: `https://github.com/${input.repository}`,
    licenseRisk: /AGPL|GPL|PolyForm|Enterprise|No license|requires|reported/.test(input.license) ? "high" : "medium",
    runtimeClass: input.role.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
    integrationMode: "governed_research_record",
    placement: input.productFit.join(", "),
    capabilities: [input.role],
    launchImpact: "optional",
    enabledInProduction: false,
    humanReviewRequired: true,
    safety: [
      "No third-party code executes from this catalog; adoption requires a separate implementation and dependency review.",
      "Keep secrets, customer data, tenant boundaries, provider terms, cost limits, provenance, and rollback controls explicit.",
      sensitive ? "Sensitive or consequential use requires explicit authorization, least privilege, retained audit evidence, and human review." : "Any prototype must be bounded, observable, reversible, and tested before production use."
    ],
    blockedUses: sensitive ? ["unauthorized access or surveillance", "unreviewed consequential automation", "production execution from the research catalog"] : ["production execution from the research catalog", "unreviewed source adoption"],
    source: "user_submitted_screenshot_research_batch7_2026_09_15",
    ...input
  });
}

function reference(key, label, observedTheme, nextStep) {
  return Object.freeze({
    key, label, status: "unverified_or_non_repository_reference", observedTheme,
    reason: "The submitted screenshot is useful as a lead but is not authoritative evidence for a specific executable repository and license.",
    placement: "Research Lab and product-planning backlog",
    safety: ["No code, credentials, customer data, or runtime authority is granted by this record."],
    nextStep
  });
}

function getPublicScreenshotToolCatalogBatch7() {
  return SCREENSHOT_TOOL_RADAR_BATCH7.map((item) => ({
    ...item,
    requestedRepository: item.repository,
    requestedRepoUrl: item.repoUrl,
    sourceCorrection: null,
    productFit: [...item.productFit], capabilities: [...item.capabilities],
    safety: [...item.safety], blockedUses: [...item.blockedUses]
  }));
}

function getNonRepositoryReferencesBatch7() {
  return NON_REPOSITORY_REFERENCES_BATCH7.map((item) => ({ ...item, safety: [...item.safety] }));
}

function getScreenshotToolReadinessBatch7() {
  const repositories = getPublicScreenshotToolCatalogBatch7().map((item) => ({
    ...item, configurationStatus: "cataloged_disabled", runtimeStatus: "not_executed", canExecute: false
  }));
  return {
    ok: true, mode: "static_governed_screenshot_research_batch7",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH7.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch7()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH7,
  NON_REPOSITORY_REFERENCES_BATCH7,
  getPublicScreenshotToolCatalogBatch7,
  getNonRepositoryReferencesBatch7,
  getScreenshotToolReadinessBatch7
};
