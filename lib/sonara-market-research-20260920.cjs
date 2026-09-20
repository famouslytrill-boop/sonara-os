// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Evidence and planning data only. No network, installs, tools, or billing actions.
const AS_OF = "2026-09-20";
const SOURCES = [
  ["census-ai", "U.S. Census Bureau", "https://www.census.gov/library/stories/2026/05/ai-use-businesses.html", "2025-12-14/2026-05-03", "US business AI use ranged from 17% to 20% during the reported period.", "Survey question changed in November 2025; not a September measurement or the same denominator as an organizational AI survey.", "2026-10-20"],
  ["stanford-ai", "Stanford HAI", "https://hai.stanford.edu/ai-index/2026-ai-index-report", "2026 report, principally 2025 observations", "The report records 88% organizational AI adoption and substantial agent benchmark limitations.", "Do not treat organizational survey adoption as US small-business penetration or a benchmark as production reliability.", "2026-12-20"],
  ["retail", "National Retail Federation", "https://nrf.com/media-center/press-releases/nrf-forecasts-4-4-annual-retail-sales-growth-with-new-economic-model", "2026 forecast published 2026-03-18", "NRF forecasts $5.6 trillion in 2026 US retail sales and 4.4% nominal growth.", "Forecast, not realized sales; retail sales are not software TAM.", "2026-10-20"],
  ["restaurants", "National Restaurant Association", "https://restaurant.org/research-and-media/research/research-reports/state-of-the-industry/", "2026 forecast", "The association forecasts $1.55 trillion in US restaurant and foodservice sales in 2026.", "Industry sales are not addressable software spending; forecasts can change.", "2026-10-20"],
  ["trades", "ServiceTitan investor relations", "https://investors.servicetitan.com/news-releases/news-release-details/servicetitan-announces-fiscal-fourth-quarter-and-full-fiscal", "Fiscal year ended 2026-01-31", "FY2026 revenue was $961 million; GAAP operating loss was $169.2 million.", "One incumbent's fiscal-year results, not total trades software market size or SONARA economics.", "2026-12-20"],
  ["creator-study", "Creator Impact Report, hosted by IAB", "https://www.iab.com/wp-content/uploads/2026/05/Creator-Impact-Report-2026.pdf", "US consumer survey January 2026", "45% of surveyed consumers reported buying creator-recommended products at least monthly.", "Self-report, not causal lift; consumer sample 1,050 and separate creator sample 539. See methodology.", "2026-12-20"],
  ["apple-free", "Apple US iPhone charts", "https://apps.apple.com/us/iphone/charts", "Retrieved 2026-09-20", "Free apps snapshot: Muse from Meta, ChatGPT, Vinted occupy positions 1-3.", "Dynamic country/device chart, not revenue, retention, market share, or Android ranking.", "2026-09-21"],
  ["apple-paid", "Apple US iPhone charts", "https://apps.apple.com/us/iphone/charts/36?chart=top-paid", "Retrieved 2026-09-20", "Paid apps snapshot: play_music_theory, Shadowrocket, HotSchedules occupy positions 1-3.", "Paid download chart, not top-grossing chart; ranking is not a product endorsement.", "2026-09-21"],
  ["android-free", "AppBrain", "https://www.appbrain.com/stats/google-play-rankings/top_free", "Chart updated 2026-09-19", "US Google Play free chart reported ChatGPT, TikTok Pro - Events, Muse from Meta in positions 1-3.", "Third-party chart, not direct authenticated Google Play data; paid chart was not verified.", "2026-09-21"],
  ["web-traffic", "Similarweb", "https://www.similarweb.com/blog/research/market-research/most-visited-websites/", "August 2026, published 2026-09-17", "Global website visit rankings start Google, YouTube, Facebook, Instagram, ChatGPT.", "Estimated visits include repeat visits; exclude inference about unique people, native-app activity, or profitability.", "2026-10-20"],
  ["agent-patterns", "Anthropic engineering", "https://www.anthropic.com/engineering/building-effective-agents", "Original article 2024-12-19, reviewed 2026-09-20", "The article distinguishes predefined workflows from model-directed agents and recommends simple composable designs.", "Foundational reference, not a 2026 product release or proof of SONARA performance.", "2026-12-20"],
  ["temporal", "Temporal documentation", "https://docs.temporal.io/workflows", "Documentation reviewed 2026-09-20", "Durable workflows replay recorded event histories; deterministic workflow code is required.", "Durable execution does not by itself prevent duplicate external business effects.", "2026-10-20"],
  ["agency-risk", "OWASP", "https://genai.owasp.org/llmrisk/llm062025-excessive-agency/", "2025 taxonomy reviewed 2026-09-20", "Excessive agency includes risks from excessive functionality, permissions, and autonomy.", "Risk guidance is not a certification or a completed SONARA security audit.", "2026-12-20"],
  ["stripe-webhooks", "Stripe documentation", "https://docs.stripe.com/webhooks", "Documentation reviewed 2026-09-20", "Payment integration must handle webhook delivery, verification, and duplicate-event concerns.", "No payment provider was configured or customer money moved in this research change.", "2026-10-20"],
  ["vercel-node", "Vercel documentation", "https://vercel.com/docs/functions/runtimes/node-js/node-js-versions", "Documentation retrieved 2026-09-20", "Available Node majors are 24, 22, and 20; 24 is the default.", "Do not force Node 26 into Vercel production without confirmed platform support.", "2026-09-27"],
  ["apple-rules", "Apple developer guidelines", "https://developer.apple.com/app-store/review/guidelines/", "Documentation reviewed 2026-09-20", "User-generated content requires moderation safeguards; distribution and purchase rules require product-specific review.", "Country, content type, and entitlement affect purchase requirements; no blanket commission assumption.", "2026-10-20"],
  ["eu-ai", "European Commission", "https://ai-act-service-desk.ec.europa.eu/en/ai-act/eu-ai-act-implementation-timeline", "Implementation timeline reviewed 2026-09-20", "The updated timeline includes transparency obligations in August 2026 and later high-risk application dates.", "Applicability and transition provisions require legal review; do not reuse a pre-omnibus timeline.", "2026-10-20"],
  ["pgvector-license", "pgvector upstream", "https://github.com/pgvector/pgvector/blob/master/LICENSE", "License file reviewed 2026-09-20", "The repository has a permissive PostgreSQL-style license.", "Actual adoption still needs pinned revision, dependency and advisory review.", "2026-10-20"],
  ["temporal-license", "Temporal TypeScript SDK upstream", "https://github.com/temporalio/sdk-typescript/blob/main/LICENSE", "License file reviewed 2026-09-20", "The TypeScript SDK license is MIT.", "SDK terms do not replace cloud service terms or worker compatibility review.", "2026-10-20"],
  ["otel-license", "OpenTelemetry JavaScript upstream", "https://github.com/open-telemetry/opentelemetry-js/blob/main/LICENSE", "License file reviewed 2026-09-20", "The JavaScript repository license is Apache-2.0.", "Redact secrets and customer content before exporting telemetry.", "2026-10-20"],
  ["vllm-license", "vLLM upstream", "https://github.com/vllm-project/vllm/blob/main/LICENSE", "License file reviewed 2026-09-20", "The inference engine code license is Apache-2.0.", "Model weights, datasets and hosted services have separate terms; GPU economics are unbenchmarked.", "2026-10-20"],
  ["ortools-license", "Google OR-Tools upstream", "https://github.com/google/or-tools/blob/stable/LICENSE", "License file reviewed 2026-09-20", "The repository license is Apache-2.0.", "Optimization quality depends on constraints and data; infeasibility needs an operator workflow.", "2026-10-20"],
  ["godot-license", "Godot upstream", "https://github.com/godotengine/godot/blob/master/LICENSE.txt", "License file reviewed 2026-09-20", "The engine license is MIT.", "Assets, plugins and platform distribution have separate terms.", "2026-10-20"],
  ["ffmpeg-license", "FFmpeg legal documentation", "https://ffmpeg.org/legal.html", "Documentation reviewed 2026-09-20", "FFmpeg is mainly LGPL with optional components that change licensing obligations.", "Review the exact build flags, linked libraries and codecs; isolated deployment is not automatic legal clearance.", "2026-10-20"],
  ["n8n-license", "n8n licensing documentation", "https://docs.n8n.io/sustainable-use-license/", "Documentation reviewed 2026-09-20", "The Sustainable Use License restricts use; it is not a blanket commercial embedding license.", "Client workflows and credentials require use-case-specific review and potentially a commercial agreement.", "2026-10-20"]
].map(([id, publisher, url, measurementPeriod, finding, limitation, reviewAfter]) => ({
  id, publisher, url, measurementPeriod, finding, limitation, reviewAfter,
  observedAt: AS_OF, kind: "source_observation"
}));

// Priority is a recommendation, not a validated demand score or launch promise.
const DOMAINS = [
  ["trades-cleaning", "validate_first", "business_builder", "field-mode", "HVAC, electrical, plumbing, carpentry, cleaning: intake to quote, job, payment and repeat service."],
  ["creator-commerce", "validate_first", "creator_studio", "creator-commerce", "Books, music, podcasts, video, images and sponsorships: rights-aware delivery and sales."],
  ["growth-service", "validate_first", "growth_studio", "lead-intelligence", "Consented lead response, reviews, local discovery, approved campaigns and outcome measurement."],
  ["restaurants-kiosks", "validate_next", "business_builder", "kiosk-mode", "Menus, reservations, orders and check-in; integrate POS and certified payment hardware."],
  ["retail-fashion", "validate_next", "business_builder", "embedded-commerce", "Stores, groceries, clothing and shoes: catalog, stock visibility, ordering, returns and loyalty."],
  ["trucking-delivery-waste", "partner_first", "business_builder", "field-mode", "Dispatch, appointments, route proposals, proof of service and maintenance; integrate telematics."],
  ["property-rentals", "validate_next", "business_builder", "durable-workflow-builder", "Maintenance, rental requests and scheduling; avoid automated eligibility or eviction decisions."],
  ["jobs-classrooms", "validate_next", "business_builder", "durable-workflow-builder", "Job listings, interviews, enrollment, translation and learning workflows; human hiring decisions."],
  ["venues-public-access", "validate_next", "business_builder", "qr-physical-digital-bridge", "Bookings, event information, accessibility, QR check-in and consent-controlled notifications."],
  ["manufacturing-food", "partner_first", "business_builder", "durable-workflow-builder", "Procurement, lot records, quality checklists and maintenance; not certified plant control."],
  ["engineering-cad", "partner_first", "creator_studio", "interactive-media-studio", "Design review, drawing versions, approvals and CAD handoff; licensed engineering remains external."],
  ["energy-ev-utilities", "partner_first", "business_builder", "field-mode", "Installation scheduling, asset service and billing reconciliation; no grid or vehicle control."],
  ["finance-insurance", "partner_first", "business_builder", "embedded-commerce", "Document intake and transaction reconciliation through authorized regulated providers."],
  ["government", "research_only", "business_builder", "durable-workflow-builder", "Procurement and public service workflows after accessibility, residency and procurement review."],
  ["military", "research_only", "business_builder", "durable-workflow-builder", "Administrative and maintenance concepts only; no targeting, weapons or autonomous force applications."],
  ["social-dating", "research_only", "creator_studio", "interactive-media-studio", "Prefer private client communities first; public networks require moderation, age and abuse controls."],
  ["games-ar-3d", "research_only", "creator_studio", "interactive-media-studio", "Interactive demos, training and licensed game assets; not a console or engine rebuild."],
  ["streaming-media", "partner_first", "creator_studio", "interactive-media-studio", "Production planning, review, rights and distribution adapters rather than a new mass-streaming network."],
  ["agent-workflows", "validate_first", "sonara_one", "governed-agent-runtime", "Model proposals inside deterministic authorization, approval, budget and audit boundaries."],
  ["rag-models", "validate_first", "sonara_one", "governed-agent-runtime", "Tenant-scoped retrieval, citations, abstention and per-task evaluations behind Provider Gateway."],
  ["databases-infrastructure", "validate_first", "sonara_one", "durable-workflow-builder", "Tenant isolation, indexes, pooling, outbox, backups, observability and measured capacity planning."],
  ["security-biometrics", "validate_first", "sonara_one", "governed-agent-runtime", "Passkeys, least privilege and authorized monitoring; no passive biometric surveillance."],
  ["sensors-notifications", "validate_next", "business_builder", "field-mode", "Permission-scoped camera, GPS, motion and opt-in sound, push and haptics with device fallback."],
  ["blockchain-ledgers", "research_only", "sonara_one", "embedded-commerce", "Use conventional auditable records first; distributed consensus requires a specific trust problem."],
  ["os-hardware-compute", "research_only", "sonara_one", "governed-agent-runtime", "Business software on existing operating systems; no new kernel, GPU, console or data center now."]
].map(([id, recommendation, product, capabilityKey, experiment]) => ({
  id, recommendation, product, capabilityKey, experiment,
  evidenceStatus: "hypothesis_not_customer_validated", enabledInProduction: false
}));

const REPOSITORIES = [
  ["pgvector/pgvector", "pgvector-license", "Tenant-scoped retrieval benchmark", "PostgreSQL query and isolation tests"],
  ["temporalio/sdk-typescript", "temporal-license", "Durable worker comparison against existing outbox", "Separate long-running worker; retain Provider Gateway and pnpm"],
  ["open-telemetry/opentelemetry-js", "otel-license", "End-to-end trace and cost instrumentation", "No raw prompts, secrets or private assets in telemetry"],
  ["vllm-project/vllm", "vllm-license", "Optional self-hosted inference benchmark", "Isolated GPU worker; separately reviewed weights and memory budget"],
  ["google/or-tools", "ortools-license", "Dispatch and scheduling constraint experiments", "Explainable infeasibility and human approval"],
  ["godotengine/godot", "godot-license", "Interactive asset/export prototype", "Rights-cleared assets and tested mobile performance"],
  ["FFmpeg/FFmpeg", "ffmpeg-license", "Media normalization worker evaluation", "Sandbox, file limits and exact build-license review"],
  ["n8n-io/n8n", "n8n-license", "Reference-only workflow UX comparison", "Commercial embedding not approved"]
].map(([repository, sourceId, experiment, boundary]) => ({
  repository, sourceId, experiment, boundary, status: "research_only",
  enabledInProduction: false, pinnedRevision: null, securityReview: "not_completed"
}));

const SNAPSHOT = {
  schemaVersion: 1, asOf: AS_OF, status: "research_only", enabledInProduction: false,
  scope: "Representative global technology and US-first commercial assessment, not an exhaustive market census.",
  decision: "Validate service operations, creator commerce and consented growth before expanding into capital-intensive or regulated sectors.",
  sources: SOURCES, domains: DOMAINS, repositories: REPOSITORIES,
  unknowns: ["SONARA paying-customer cohorts, CAC, churn and contribution margin", "Current Google Play paid ranking", "Exact current S&P 500 constituent ranking", "Full dependency and production readiness verification", "Release-level security and license clearance for each candidate"],
  promotionRequirements: ["named owner", "reachable segment", "customer commitment", "cost ceiling", "tenant and security tests", "license and terms approval", "Product Lifecycle review", "release evidence"]
};

function getMarketResearch20260920() {
  return JSON.parse(JSON.stringify(SNAPSHOT));
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

// This validates research structure/freshness, NEVER authorizes execution.
function validateMarketResearch(snapshot, asOf) {
  const errors = [];
  const staleSourceIds = [];
  if (!isIsoDate(asOf)) return { ok: false, errors: ["invalid_as_of"], staleSourceIds };
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return { ok: false, errors: ["invalid_snapshot"], staleSourceIds };
  }
  if (snapshot.schemaVersion !== 1) errors.push("invalid_schema_version");
  if (snapshot.status !== "research_only" || snapshot.enabledInProduction !== false) errors.push("execution_not_allowed");
  if (!isIsoDate(snapshot.asOf) || snapshot.asOf > asOf) errors.push("invalid_snapshot_date");
  const ids = new Set();
  for (const field of ["sources", "domains", "repositories"]) {
    if (!Array.isArray(snapshot[field]) || snapshot[field].length === 0) errors.push(`missing_${field}`);
  }
  for (const source of Array.isArray(snapshot.sources) ? snapshot.sources : []) {
    if (!source || typeof source !== "object") { errors.push("invalid_source"); continue; }
    if (typeof source.id !== "string" || !source.id.trim() || ids.has(source.id)) errors.push("invalid_source_id");
    else ids.add(source.id);
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:" || url.username || url.password) errors.push("invalid_source_url");
    } catch { errors.push("invalid_source_url"); }
    for (const field of ["publisher", "measurementPeriod", "finding", "limitation"]) {
      if (typeof source[field] !== "string" || !source[field].trim()) errors.push(`missing_source_${field}`);
    }
    if (source.kind !== "source_observation") errors.push("invalid_source_kind");
    if (!isIsoDate(source.observedAt) || source.observedAt > asOf || source.observedAt > snapshot.asOf) errors.push("invalid_observation_date");
    if (!isIsoDate(source.reviewAfter) || source.reviewAfter < source.observedAt) errors.push("invalid_review_date");
    else if (source.reviewAfter <= asOf) staleSourceIds.push(source.id);
  }
  const domains = new Set();
  for (const domain of Array.isArray(snapshot.domains) ? snapshot.domains : []) {
    if (!domain || typeof domain !== "object") { errors.push("invalid_domain"); continue; }
    if (!domain.id || domains.has(domain.id)) errors.push("invalid_domain_id");
    domains.add(domain.id);
    if (domain.enabledInProduction !== false || domain.evidenceStatus !== "hypothesis_not_customer_validated") errors.push("invalid_domain_status");
  }
  const repositories = new Set();
  for (const repo of Array.isArray(snapshot.repositories) ? snapshot.repositories : []) {
    if (!repo || typeof repo !== "object") { errors.push("invalid_repository"); continue; }
    if (!repo.repository || repositories.has(repo.repository)) errors.push("invalid_repository_id");
    repositories.add(repo.repository);
    if (!ids.has(repo.sourceId)) errors.push("unknown_repository_source");
    if (repo.enabledInProduction !== false || repo.status !== "research_only") errors.push("invalid_repository_status");
  }
  return { ok: errors.length === 0 && staleSourceIds.length === 0, errors, staleSourceIds };
}

module.exports = { getMarketResearch20260920, validateMarketResearch };
