// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const EXECUTION_STATES = Object.freeze({
  ACTIVE: "active",
  SETUP_REQUIRED: "setup_required",
  RESEARCH_ONLY: "research_only"
});

function freezeRecord(record) {
  return Object.freeze({
    ...record,
    outputs: Object.freeze([...(record.outputs || [])]),
    deterministicCore: Object.freeze([...(record.deterministicCore || [])])
  });
}

const PLATFORM_COMPLETENESS_CONTRACT = Object.freeze([
  freezeRecord({
    key: "business-builder",
    purpose: "Operate a small or growing business from canonical customer, job, staff, inventory, money, and service records.",
    route: "/business-builder/dashboard",
    state: EXECUTION_STATES.ACTIVE,
    dataAuthority: "tenant-scoped PostgreSQL records",
    deterministicCore: ["CRUD", "pricing formulas", "scheduling", "inventory math", "work-order state machines", "exports"],
    outputs: ["text", "data", "file"],
    emptyState: "show the first valid record/action and explain what will be created",
    externalAiRequired: false
  }),
  freezeRecord({
    key: "creator-studio",
    purpose: "Plan, organize, transform, package, and publish creator assets with reproducible media workflows.",
    route: "/creator-studio/dashboard",
    state: EXECUTION_STATES.ACTIVE,
    dataAuthority: "tenant-scoped asset, release, workflow, and rights records",
    deterministicCore: ["asset catalog", "metadata", "FFmpeg transforms", "timeline planning", "template rendering", "exports"],
    outputs: ["text", "image", "audio", "video", "file"],
    emptyState: "offer upload/create/import paths; never render an inert studio",
    externalAiRequired: false
  }),
  freezeRecord({
    key: "growth-studio",
    purpose: "Run consent-aware campaigns, leads, conversion tracking, local visibility, and customer follow-up.",
    route: "/growth-studio/dashboard",
    state: EXECUTION_STATES.ACTIVE,
    dataAuthority: "tenant-scoped lead, consent, campaign, touchpoint, and conversion records",
    deterministicCore: ["segmentation", "UTM construction", "rule scoring", "campaign state machines", "attribution summaries"],
    outputs: ["text", "data", "file"],
    emptyState: "offer a first campaign, lead import, or visibility scan with an explicit next action",
    externalAiRequired: false
  }),
  freezeRecord({
    key: "notifications",
    purpose: "Show actionable system, billing, workflow, and account events without duplicate noise.",
    route: "/notifications",
    state: EXECUTION_STATES.ACTIVE,
    dataAuthority: "persisted notification and audit records",
    deterministicCore: ["deduplication keys", "read/unread state", "severity routing", "recovery notifications"],
    outputs: ["text", "audio"],
    emptyState: "show all-clear state plus notification preferences",
    externalAiRequired: false
  }),
  freezeRecord({
    key: "integrations",
    purpose: "Connect external systems through explicit authorization, scopes, sync state, health, reconciliation, and disconnect paths.",
    route: "/account/integrations",
    state: EXECUTION_STATES.ACTIVE,
    dataAuthority: "connection registry and provider evidence",
    deterministicCore: ["capability grants", "checkpoints", "retries", "idempotency", "reconciliation", "revocation"],
    outputs: ["text", "data"],
    emptyState: "show supported connection types and setup requirements; no fake Connected state",
    externalAiRequired: false
  }),
  freezeRecord({
    key: "market-intelligence",
    purpose: "Turn dated market evidence into product requirements without converting research into unsupported runtime claims.",
    route: "/market-intelligence",
    state: EXECUTION_STATES.ACTIVE,
    dataAuthority: "dated source records and evidence snapshots",
    deterministicCore: ["source scoring", "recency checks", "comparison matrices", "formula-based prioritization"],
    outputs: ["text", "data", "file"],
    emptyState: "show research intake and source requirements",
    externalAiRequired: false
  }),
  freezeRecord({
    key: "product-lifecycle",
    purpose: "Track each capability from research through design, validation, canary, production, measurement, and retirement.",
    route: "/product-lifecycle",
    state: EXECUTION_STATES.ACTIVE,
    dataAuthority: "lifecycle evidence and exact-release records",
    deterministicCore: ["promotion gates", "rollback requirements", "owner approval", "evidence checks"],
    outputs: ["text", "data"],
    emptyState: "show the lifecycle stages and the first evidence needed",
    externalAiRequired: false
  }),
  freezeRecord({
    key: "technology-radar",
    purpose: "Classify technology by license, security, maturity, integration cost, isolation boundary, and commercial-use status.",
    route: "/technology-radar",
    state: EXECUTION_STATES.ACTIVE,
    dataAuthority: "governed open-source and external-technology registry",
    deterministicCore: ["license policy", "status contract", "risk scoring", "version tracking"],
    outputs: ["text", "data"],
    emptyState: "show intake criteria rather than an empty catalog",
    externalAiRequired: false
  }),
  freezeRecord({
    key: "admin-system",
    purpose: "Expose operational truth for health, configuration, deployment, database, storage, security, and release evidence.",
    route: "/admin/system",
    state: EXECUTION_STATES.ACTIVE,
    dataAuthority: "runtime health, release evidence, audit logs, and configuration metadata",
    deterministicCore: ["health checks", "exact-SHA checks", "gate status", "audit trails", "rollback evidence"],
    outputs: ["text", "data", "file"],
    emptyState: "show missing configuration/evidence as setup-required, never as success",
    externalAiRequired: false
  })
]);

const OUTPUT_FALLBACKS = Object.freeze([
  Object.freeze({
    output: "text",
    deterministicBaseline: "templates, rules, database records, formulas, search/FTS, and explicit user input",
    optionalEnhancement: "language-model drafting or summarization after policy checks",
    externalAiRequired: false,
    failureMode: "return canonical records, formulas, and editable templates"
  }),
  Object.freeze({
    output: "image",
    deterministicBaseline: "SVG/Canvas composition, templates, charts, diagrams, thumbnails, and user-owned assets",
    optionalEnhancement: "isolated generative-image adapter",
    externalAiRequired: false,
    failureMode: "render template/diagram/asset output with provenance"
  }),
  Object.freeze({
    output: "audio",
    deterministicBaseline: "Web Audio synthesis, samples, MIDI, recorded assets, and FFmpeg transcode/mix pipelines",
    optionalEnhancement: "isolated speech/music generation worker",
    externalAiRequired: false,
    failureMode: "return playable source/mix plus transcript or score where applicable"
  }),
  Object.freeze({
    output: "video",
    deterministicBaseline: "FFmpeg composition/transcode, timeline templates, captions, stills, waveform/video assembly",
    optionalEnhancement: "isolated video generation worker",
    externalAiRequired: false,
    failureMode: "render deterministic timeline output from owned inputs"
  }),
  Object.freeze({
    output: "map",
    deterministicBaseline: "MapLibre rendering over a replaceable licensed tile/data source with attribution",
    optionalEnhancement: "routing/geocoding adapters behind explicit provider contracts",
    externalAiRequired: false,
    failureMode: "show stored coordinates/addresses and switchable map provider state"
  }),
  Object.freeze({
    output: "data",
    deterministicBaseline: "PostgreSQL queries, materialized projections, formulas, statistics, and versioned exports",
    optionalEnhancement: "prediction/recommendation models that never become the source of truth",
    externalAiRequired: false,
    failureMode: "return canonical records and explain unavailable derived metrics"
  }),
  Object.freeze({
    output: "file",
    deterministicBaseline: "CSV, JSON, ICS, vCard, PDF/report templates, media files, and signed/versioned exports",
    optionalEnhancement: "content assistance before export",
    externalAiRequired: false,
    failureMode: "export the canonical machine-readable record"
  })
]);

const DOMAIN_FAMILIES = Object.freeze([
  Object.freeze({ key: "commerce", systems: ["catalog", "orders", "payments", "subscriptions", "refunds", "inventory", "entitlements"] }),
  Object.freeze({ key: "service-business", systems: ["leads", "booking", "dispatch", "work-orders", "invoicing", "reviews"] }),
  Object.freeze({ key: "restaurant", systems: ["menu", "recipes", "inventory", "vendors", "waste", "sales", "staff"] }),
  Object.freeze({ key: "transportation", systems: ["fleet", "routing", "scheduling", "locations", "jobs", "telemetry"] }),
  Object.freeze({ key: "media", systems: ["assets", "timeline", "audio", "video", "rights", "publishing", "analytics"] }),
  Object.freeze({ key: "gaming-interactive", systems: ["scene", "assets", "input", "rendering", "state", "telemetry", "distribution"] }),
  Object.freeze({ key: "education-research", systems: ["library", "sources", "curricula", "assignments", "search", "citations"] }),
  Object.freeze({ key: "finance-risk", systems: ["ledger", "reconciliation", "risk-rules", "audit", "reporting", "approvals"] }),
  Object.freeze({ key: "manufacturing", systems: ["bom", "inventory", "work-orders", "quality", "maintenance", "scheduling"] }),
  Object.freeze({ key: "real-estate-jobs", systems: ["listings", "applications", "documents", "appointments", "payments", "messaging"] }),
  Object.freeze({ key: "social-communications", systems: ["profiles", "feeds", "messages", "moderation", "notifications", "publishing"] }),
  Object.freeze({ key: "science-math-engineering", systems: ["units", "formulas", "geometry", "statistics", "simulation", "visualization"] })
]);

const CURRENT_TECH_BASELINES = Object.freeze({
  asOf: "2026-09-25",
  node: Object.freeze({ production: "24.x LTS", compatibility: "26.x Current", policy: "production stays on LTS" }),
  postgresql: Object.freeze({ production: "18.x", currentPatchObserved: "18.6", researchOnly: "19 beta" }),
  mcp: Object.freeze({ protocol: "2026-07-28", policy: "stateless/versioned adapters with explicit capability and authorization checks" }),
  opentelemetry: Object.freeze({ semanticConventions: "1.44.0", policy: "normalize traces, metrics, logs, resources, and error attributes" }),
  openfeature: Object.freeze({ policy: "provider-neutral feature evaluation with deterministic defaults" }),
  webgpu: Object.freeze({ status: "Candidate Recommendation Draft", policy: "feature-detect and preserve WebGL/Canvas fallback" }),
  maplibre: Object.freeze({ major: "6.x", policy: "replaceable tile/data provider; preserve attribution and offline/provider policy" }),
  ffmpeg: Object.freeze({ stableObserved: "8.1.3", policy: "isolated deterministic media worker, pinned and checksum-verified" }),
  godot: Object.freeze({ stableObserved: "4.7.2", policy: "external authoring/runtime adapter; never a core request-path dependency" })
});

function validateCompletenessContract() {
  const problems = [];
  const keys = new Set();
  const routes = new Set();
  for (const item of PLATFORM_COMPLETENESS_CONTRACT) {
    if (keys.has(item.key)) problems.push(`duplicate capability key: ${item.key}`);
    if (routes.has(item.route)) problems.push(`duplicate canonical route: ${item.route}`);
    keys.add(item.key);
    routes.add(item.route);
    if (!item.purpose || !item.dataAuthority || !item.emptyState) problems.push(`incomplete capability record: ${item.key}`);
    if (!item.deterministicCore.length) problems.push(`missing deterministic core: ${item.key}`);
    if (item.externalAiRequired !== false) problems.push(`external AI became mandatory: ${item.key}`);
  }
  for (const fallback of OUTPUT_FALLBACKS) {
    if (!fallback.deterministicBaseline || !fallback.failureMode) problems.push(`incomplete output fallback: ${fallback.output}`);
    if (fallback.externalAiRequired !== false) problems.push(`external AI became mandatory for output: ${fallback.output}`);
  }
  return problems;
}

function getPlatformCompletenessSummary() {
  const issues = validateCompletenessContract();
  return Object.freeze({
    asOf: CURRENT_TECH_BASELINES.asOf,
    contractStatus: issues.length === 0 ? "valid" : "invalid",
    issues: Object.freeze(issues),
    capabilities: Object.freeze(PLATFORM_COMPLETENESS_CONTRACT.map(({ key, route, purpose, emptyState }) => Object.freeze({ key, route, purpose, emptyState }))),
    outputs: Object.freeze(OUTPUT_FALLBACKS.map(({ output }) => output)),
    domainFamilies: Object.freeze(DOMAIN_FAMILIES.map(({ key }) => key)),
    note: "This is a product and engineering contract. It does not prove each capability is deployed or production-ready."
  });
}

module.exports = {
  CURRENT_TECH_BASELINES,
  DOMAIN_FAMILIES,
  EXECUTION_STATES,
  OUTPUT_FALLBACKS,
  PLATFORM_COMPLETENESS_CONTRACT,
  getPlatformCompletenessSummary,
  validateCompletenessContract
};
