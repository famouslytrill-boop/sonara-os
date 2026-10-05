// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Screenshot intake received 4 October 2026. The 19 screenshots are research
// evidence only. No repository, dependency, workflow, provider, credential,
// financial connector, model, dataset, capture service, or production authority
// is installed or enabled by this record.

const REPOSITORIES = [
  {
    key: "headcount",
    label: "headcount",
    repository: "cbrock84/headcount",
    repoUrl: "https://github.com/cbrock84/headcount",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "agent_department_and_skill_organization_reference",
    placement: "Internal Development / Agent Control Plane research only; no third-party department is granted SONARA tool, tenant, repository, billing, deployment, or production authority",
    productFit: ["Internal Development", "Agent Control Plane", "Research Lab"],
    integrationStatus: "curated_reference_no_install",
    capabilities: [
      "department-scoped specialist skill organization",
      "independently loadable skills and agent charters",
      "exclusive write-surface and reviewer-role patterns",
      "source-backed specialist guidance"
    ],
    safety: [
      "The upstream repository describes 16 departments and 172 skills, not 172 autonomous employees or production agents.",
      "Skill text is advisory. SONARA policy, tenant isolation, tool scopes, exact-head tests, release gates, and human approvals remain authoritative.",
      "A department or reviewer role must not create hidden authority, overlapping write ownership, or a path around repository protections.",
      "Any future adaptation must preserve attribution and review the exact upstream revision before copying substantial MIT-licensed material."
    ],
    blockedUses: [
      "bulk-installing all departments into production",
      "granting skills credentials or deployment rights based on department labels",
      "treating specialist output as legal, financial, security, compliance, or release approval without the required human/system checks"
    ],
    nextStep: "Benchmark the organizational pattern against SONARA's existing specialist-agent registry using synthetic tasks. Measure routing precision, duplicate work, review coverage, token/tool usage, and write-surface conflicts before any adapter exists.",
    sourceEvidence: [
      "https://github.com/cbrock84/headcount",
      "https://github.com/cbrock84/headcount/blob/main/README.md",
      "https://github.com/cbrock84/headcount/blob/main/LICENSE"
    ]
  }
];

const CONFIRMED_EXISTING_RECORDS = [
  {
    key: "n8n_existing",
    label: "n8n",
    source: "Existing SONARA workflow/operations stack",
    note: "The screenshot contributes a video-generation-to-social workflow pattern only. Existing n8n governance remains authoritative; Veo-style generation, social publishing credentials, and automatic posting are not activated."
  },
  {
    key: "munder_difflin_existing_batch25",
    label: "Munder Difflin",
    repository: "HarnessMD/munder-difflin",
    source: "Previously governed screenshot research",
    note: "This screenshot repeats an existing multi-agent harness reference. No local-agent process, subscription wrapper, BYO-key route, dictation service, or production authority is added."
  },
  {
    key: "tradingview_ai_chart_copilot_existing",
    label: "TradingView AI Chart Copilot",
    source: "Previously governed hosted-product UX reference",
    note: "Keep the prior correction: this is a hosted-product interaction reference, not a durable browser-extension dependency or a trading-action integration. No brokerage or investment action is authorized."
  },
  {
    key: "paddleocr_existing",
    label: "PaddleOCR",
    source: "Existing SONARA document-AI catalog and prior screenshot research",
    note: "Document parsing remains a bounded backend-worker candidate with upload limits, file isolation, provenance, retention, and review requirements. No OCR service or MCP server is enabled by this intake."
  }
];

const NON_REPOSITORY_REFERENCES = [
  {
    key: "prompt_credit_efficiency_reference",
    label: "Prompt and context-efficiency checklist",
    status: "workflow_reference_only",
    observedTheme: "Plan before prompting, batch related questions, provide complete instructions, reuse stable context, split unrelated tasks, constrain output length, and reduce revision loops.",
    sonaraUse: "Use as an internal request-budget pattern: goal, context, constraints, output schema, model/tool class, context reuse, iteration budget, and measurable completion criteria.",
    boundary: "Do not optimize cost by removing required evidence, security checks, accessibility checks, tenant context, or release validation."
  },
  {
    key: "sensitive_metric_mobile_dashboard_reference",
    label: "Mobile metric dashboard and quick-log interaction reference",
    status: "sensitive_domain_ui_reference_only",
    observedTheme: "Compact cards, trend visualization, quick-add modal, time/context tags, and a clear save action.",
    sonaraUse: "Reuse only generic interaction architecture for user-owned metrics, logs, inspections, readings, or operational records.",
    boundary: "The screenshot is health-oriented. SONARA must not infer diagnosis, treatment, or regulated medical capability from the design reference; sensitive-domain products require separate compliance, consent, retention, and access-control review."
  },
  {
    key: "php_fundamentals_learning_reference",
    label: "PHP fundamentals learning cards",
    status: "educational_reference_only",
    observedTheme: "Short progressive cards cover runtime basics, syntax, variables, data types, constants, comments, and output.",
    sonaraUse: "Use the micro-lesson format for internal technical education or Creator Studio course-template research.",
    boundary: "The current SONARA runtime is not changed to PHP by this reference."
  },
  {
    key: "workflow_from_idea_reference",
    label: "Idea-to-workflow framework",
    status: "architecture_reference_only",
    observedTheme: "Problem -> desired outcome -> trigger -> inputs -> process -> tools -> guardrails -> human review -> output -> feedback.",
    sonaraUse: "Promote this as a deterministic workflow contract for Business Builder, Creator Studio, and Growth Studio builders.",
    boundary: "A diagram does not prove a connector, model, automation, or external action is production-ready."
  },
  {
    key: "frontend_structure_reference",
    label: "Frontend folder-structure reference",
    status: "engineering_reference_only",
    observedTheme: "Separation among assets, components, layouts, pages, features, hooks, context/state, services, utilities, and application entry points.",
    sonaraUse: "Use as a modularity checklist where it matches the existing codebase; prefer feature ownership, explicit service boundaries, and reusable presentation components.",
    boundary: "Do not rewrite the current application around a social-media diagram or add Redux/Vite merely because they appear in the screenshot."
  },
  {
    key: "nodejs_learning_path_reference",
    label: "Node.js learning path",
    status: "educational_reference_only",
    observedTheme: "JavaScript fundamentals -> Node runtime -> core modules -> packages -> frameworks -> databases -> auth -> APIs -> realtime/testing/deployment.",
    sonaraUse: "Use as an internal competency map for backend training and documentation.",
    boundary: "Technology choices remain repository- and workload-driven; the graphic is not an architecture authority."
  },
  {
    key: "enterprise_agent_control_plane_reference",
    label: "Enterprise agent control-plane reference",
    status: "architecture_reference_high_value",
    observedTheme: "Models as intelligence, agents as execution, and a control plane as the trust layer for identity, policy, orchestration, observability, cost, audit, and human oversight.",
    sonaraUse: "Reinforces SONARA's separation of model/provider routing, bounded agent execution, permissions, observability, quotas, approvals, and audit evidence.",
    boundary: "The control plane must be server-enforced; prompts alone cannot establish authorization or governance."
  },
  {
    key: "ai_engineering_roadmap_reference",
    label: "AI engineering roadmap",
    status: "educational_reference_only",
    observedTheme: "Data/SQL, ML/deep learning, prompts, agents, RAG, evaluation, security/guardrails, and MLOps/deployment.",
    sonaraUse: "Use as a gap-analysis taxonomy for internal engineering maturity and training.",
    boundary: "Named libraries are examples, not automatic dependencies or endorsements."
  },
  {
    key: "rental_booking_storefront_reference",
    label: "Rental booking storefront concept",
    status: "vertical_product_design_reference",
    observedTheme: "Search by pickup/drop-off and date, inventory categories, daily pricing, featured inventory, promotions, long-term plans, reviews, and clear booking CTAs.",
    sonaraUse: "Map to Business Builder rental/vehicle/equipment verticals using real inventory, availability, location, rate rules, deposits, taxes, booking states, receipts, cancellation policy, and customer communication.",
    boundary: "Do not copy branding, vehicle imagery, prices, testimonials, or claims. Every price and availability state must come from SONARA-owned/customer data."
  },
  {
    key: "full_stack_developer_roadmap_reference",
    label: "Full-stack developer roadmap",
    status: "educational_reference_only",
    observedTheme: "Web fundamentals, frontend, frameworks, backend, databases, DevOps, testing/security, advanced architecture, and projects.",
    sonaraUse: "Use as an internal curriculum index and as a course-builder information-architecture reference.",
    boundary: "Tool logos are examples; they do not change SONARA's approved stack."
  },
  {
    key: "business_system_maturity_reference",
    label: "Prompt-to-business-system maturity reference",
    status: "product_strategy_reference",
    observedTheme: "Progression from prompts to workflows, systems, dashboards, deployments, agent layers, testing, launch, and improvement.",
    sonaraUse: "Use as a maturity ladder for customer projects: idea -> workflow -> governed system -> measurable dashboard -> controlled deployment -> bounded agent assistance -> continuous improvement.",
    boundary: "The social graphic's step count is not a completeness proof. SONARA must define its own acceptance criteria and evidence at each stage."
  },
  {
    key: "social_analytics_dashboard_reference",
    label: "Social analytics dashboard reference",
    status: "growth_studio_design_reference",
    observedTheme: "Account/platform navigation, top-level engagement metrics, visitor trend, audience distribution, follower growth, and recent activity.",
    sonaraUse: "Map to Growth Studio read-only intelligence with source timestamp, platform/account scope, metric definition, comparison window, confidence/data freshness, and drill-down provenance.",
    boundary: "Do not fabricate metrics or imply cross-platform comparability when source definitions differ."
  },
  {
    key: "tool_using_agent_loop_reference",
    label: "Tool-using agent loop reference",
    status: "architecture_reference_only",
    observedTheme: "User request -> plan -> select tool -> take action -> observe result -> repeat if needed -> final response, with optional memory.",
    sonaraUse: "Use only with typed tool contracts, explicit tool scopes, bounded loop counts, postconditions, trace IDs, tenant context, and approval gates for consequential actions.",
    boundary: "Memory cannot create permission, and model selection of a tool cannot bypass server-side authorization."
  },
  {
    key: "business_content_prompt_library_reference",
    label: "Business/content prompt-library reference",
    status: "product_template_reference",
    observedTheme: "Business ideas, digital products, sales pages, social content, hooks, email funnels, video ideas, affiliate content, market research, pricing, courses, and content planning.",
    sonaraUse: "Use as categories for SONARA-authored, editable Business Builder/Growth Studio templates with customer inputs, measurable goals, source-aware research, and approval before publishing.",
    boundary: "No income guarantee, affiliate recommendation, price claim, market fact, or promotional statement should be produced as truth without current evidence and user approval."
  }
];

const ARCHITECTURE_EXTENSIONS = [
  {
    key: "request_budget_and_context_contract",
    title: "Request budget and context-efficiency contract",
    product: "All workspaces",
    principle: "Efficiency is achieved by structured context and bounded work, not by dropping required checks.",
    implementation: "Normalize goal, context, constraints, output schema, authority, evidence, model/tool class, reusable project context, iteration cap, and completion criteria. Track token/tool/runtime cost as telemetry; never let budget pressure suppress mandatory safety or release gates."
  },
  {
    key: "deterministic_workflow_builder_contract",
    title: "Deterministic workflow builder contract",
    product: "Business Builder / Creator Studio / Growth Studio",
    principle: "Every automation should have an explicit problem, outcome, trigger, typed inputs, ordered steps, tools, guardrails, review point, output, and feedback signal.",
    implementation: "Persist workflow definition separately from runs. Validate schemas before execution, idempotency-key writes, classify consequential actions, require approval where policy says so, capture step receipts, support retry/backoff, and expose measurable success/failure criteria."
  },
  {
    key: "agent_trust_control_plane_contract",
    title: "Agent trust control-plane contract",
    product: "Agent Control Plane",
    principle: "Models propose; bounded executors act; server-enforced control-plane policy decides what is allowed.",
    implementation: "Centralize identity/tenant permissions, policy/guardrails, agent routing, tool scopes, observability/tracing, quotas/cost controls, immutable audit, human approval, and kill/revoke controls. Keep model/provider credentials outside prompts and clients."
  },
  {
    key: "department_specialist_agent_contract",
    title: "Department and specialist-agent contract",
    product: "Agent Control Plane",
    principle: "Specialization should reduce ambiguity and duplicated work without expanding authority.",
    implementation: "Give each specialist a declared domain, input/output schema, permitted tools, exclusive or conflict-aware write surface, escalation target, independent reviewer role, source requirements, and measurable completion test. Reject cycles, conflicting writers, and hidden privilege inheritance."
  },
  {
    key: "business_system_maturity_gate",
    title: "Business-system maturity gate",
    product: "SONARA One",
    principle: "A prompt is not a system, and a prototype is not a deployable business capability.",
    implementation: "Track stages: intent -> repeatable workflow -> durable records/state -> dashboard/observability -> integration tests -> deployment evidence -> bounded automation/agents -> measured improvement. Each stage has explicit exit criteria and rollback/ownership."
  },
  {
    key: "rental_inventory_booking_contract",
    title: "Rental inventory and booking contract",
    product: "Business Builder",
    principle: "Rental UX must be backed by real inventory and a collision-safe reservation lifecycle.",
    implementation: "Model inventory/resource, location, availability window, rate plan, fees/taxes/deposit, quote expiry, hold, booking, payment status, pickup/check-out, return/check-in, damage/adjustment, cancellation/refund, receipt, and audit. Prevent overlapping confirmed reservations transactionally."
  },
  {
    key: "growth_social_metric_provenance_contract",
    title: "Growth social metric provenance contract",
    product: "Growth Studio",
    principle: "Dashboards are trustworthy only when every metric identifies its source, scope, definition, freshness, and comparison window.",
    implementation: "Store platform/account, metric name/version, source timestamp, retrieval window, aggregation method, currency/unit where relevant, confidence/partial-sync flags, and raw-source reference. Never merge incompatible platform metrics without an explicit normalized definition."
  },
  {
    key: "sensitive_metric_entry_privacy_contract",
    title: "Sensitive metric-entry privacy contract",
    product: "Shared UI / future regulated verticals",
    principle: "Quick logging can be generic, but sensitive-domain semantics require stronger privacy and compliance boundaries.",
    implementation: "Minimize collected fields, classify sensitivity, enforce tenant/user access, encrypt in transit/at rest through platform controls, expose retention/delete, separate observational records from professional interpretation, and require domain-specific legal/compliance review before regulated use."
  },
  {
    key: "creator_growth_template_generation_contract",
    title: "Creator/Growth business-template generation contract",
    product: "Creator Studio / Growth Studio / Business Builder",
    principle: "Generated business content is a draft with provenance and editable assumptions, not guaranteed market truth or income.",
    implementation: "Capture audience, offer, channel, evidence/source set, brand constraints, objective, prohibited claims, output format, review owner, and publish authority. Separate sourced facts from generated suggestions and require explicit approval before external publication."
  },
  {
    key: "engineering_learning_reference_contract",
    title: "Engineering learning-reference contract",
    product: "Internal Development",
    principle: "Cheat sheets and roadmaps are navigation aids, not repository architecture decisions.",
    implementation: "Map each educational reference to current official docs, repository conventions, tests, and production evidence. Record useful learning gaps without adding a dependency, framework, database, or runtime solely because it appears in a poster."
  }
];

function freezeRepository(item) {
  return Object.freeze({
    ...item,
    productFit: Object.freeze([...item.productFit]),
    capabilities: Object.freeze([...item.capabilities]),
    safety: Object.freeze([...item.safety]),
    blockedUses: Object.freeze([...item.blockedUses]),
    sourceEvidence: Object.freeze([...item.sourceEvidence]),
    checkedOn: "2026-10-04",
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch25_2026_10_04"
  });
}

const SCREENSHOT_TOOL_RADAR_BATCH25 = Object.freeze(REPOSITORIES.map(freezeRepository));
const CONFIRMED_EXISTING_RECORDS_BATCH25 = Object.freeze(CONFIRMED_EXISTING_RECORDS.map((item) => Object.freeze({ ...item })));
const NON_REPOSITORY_REFERENCES_BATCH25 = Object.freeze(NON_REPOSITORY_REFERENCES.map((item) => Object.freeze({
  ...item,
  // The Research Lab renderer historically consumes reason/nextStep. Batch 25
  // keeps the richer clean-room fields while also exposing that common shape.
  reason: item.reason || item.boundary || "Governed reference only.",
  nextStep: item.nextStep || item.sonaraUse || "Keep as a non-executing reference.",
  source: "user_submitted_screenshot_research_batch25_2026_10_04"
})));
const ARCHITECTURE_EXTENSIONS_BATCH25 = Object.freeze(ARCHITECTURE_EXTENSIONS.map((item) => Object.freeze({ ...item })));

function getPublicScreenshotToolCatalogBatch25() {
  return SCREENSHOT_TOOL_RADAR_BATCH25.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses],
    sourceEvidence: [...item.sourceEvidence]
  }));
}

function getConfirmedExistingRecordsBatch25() {
  return CONFIRMED_EXISTING_RECORDS_BATCH25.map((item) => ({ ...item }));
}

function getNonRepositoryReferencesBatch25() {
  return NON_REPOSITORY_REFERENCES_BATCH25.map((item) => ({ ...item }));
}

function getArchitectureExtensionsBatch25() {
  return ARCHITECTURE_EXTENSIONS_BATCH25.map((item) => ({ ...item }));
}

function getScreenshotToolReadinessBatch25() {
  const repositories = getPublicScreenshotToolCatalogBatch25();
  return {
    ok: true,
    batch: 25,
    mode: "static_governed_screenshot_research_batch25",
    screenshotCount: 19,
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    reciprocalLicenseCount: repositories.filter((item) => item.reciprocalLicense).length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS_BATCH25.length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH25.length,
    architectureExtensionCount: ARCHITECTURE_EXTENSIONS_BATCH25.length,
    productionExecutionCount: 0,
    repositories,
    confirmedExistingRecords: getConfirmedExistingRecordsBatch25(),
    nonRepositoryReferences: getNonRepositoryReferencesBatch25(),
    architectureExtensions: getArchitectureExtensionsBatch25()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH25,
  CONFIRMED_EXISTING_RECORDS_BATCH25,
  NON_REPOSITORY_REFERENCES_BATCH25,
  ARCHITECTURE_EXTENSIONS_BATCH25,
  getPublicScreenshotToolCatalogBatch25,
  getConfirmedExistingRecordsBatch25,
  getNonRepositoryReferencesBatch25,
  getArchitectureExtensionsBatch25,
  getScreenshotToolReadinessBatch25
};
