// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Backend Operations Research + Market Analysis Pass #4.
//
// This module converts current 2026 platform, reliability, AI-agent, commerce,
// mobile, field-service, fleet, observability and retrieval evidence into
// SONARA-owned backend architecture contracts. It is deliberately non-executing:
// importing it must never start a worker, deploy code, mutate infrastructure,
// move money, widen authority or install a third-party repository.

const BACKEND_MARKET_ANALYSIS_DATE = "2026-09-20";
const BACKEND_MARKET_ANALYSIS_VERSION = "1.0.0";

const MARKET_SIGNALS_2026 = Object.freeze([
  signal({
    key: "platform_engineering_standardization",
    domain: "platform_engineering",
    source: "CNCF — State of Cloud Native Development Q1 2026",
    sourceUrl: "https://www.cncf.io/blog/2026/03/24/state-of-cloud-native-development-q1-2026/",
    finding: "Cloud-native development has become a mainstream backend operating model, with standardized DevOps and platform environments increasingly common among backend developers.",
    sonaraUse: "Build one reusable reliability and platform kernel for all SONARA verticals rather than duplicating infrastructure by industry."
  }),
  signal({
    key: "durable_business_execution",
    domain: "workflow_orchestration",
    source: "Temporal — Durable Execution",
    sourceUrl: "https://temporal.io/",
    finding: "Durable workflow engines persist workflow state so long-running work can resume after process, network or dependency failures.",
    sonaraUse: "Use durable workflow semantics for multi-step orders, reservations, subscriptions, fulfillment, field jobs, media jobs and agent workflows; evaluate adoption only after fit, licensing and operational cost review."
  }),
  signal({
    key: "bounded_automated_recovery",
    domain: "reliability",
    source: "AWS Well-Architected — REL13-BP05 Automate recovery",
    sourceUrl: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_auto_recovery.html",
    finding: "Recovery automation should be tested, observable and reproducible; low-risk issues can be corrected automatically while serious remediation remains invokable, observable and abortable.",
    sonaraUse: "Automate only deterministic, reversible and low-blast-radius recovery. Sensitive or irreversible repair remains approval- or release-gated."
  }),
  signal({
    key: "probe_semantics_prevent_cascades",
    domain: "runtime_health",
    source: "Kubernetes — Configure liveness, readiness and startup probes",
    sourceUrl: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/",
    finding: "Readiness, liveness and startup checks solve different problems; a poorly designed liveness check can turn dependency degradation into restart cascades.",
    sonaraUse: "Separate process health, dependency readiness and end-to-end capability health. Never restart a healthy process merely because an optional dependency is unavailable."
  }),
  signal({
    key: "unified_telemetry_semantics",
    domain: "observability",
    source: "OpenTelemetry — Semantic Conventions 1.44.0",
    sourceUrl: "https://opentelemetry.io/docs/specs/semconv/",
    finding: "Shared semantic conventions standardize traces, metrics, logs, profiles and resource attributes across heterogeneous services.",
    sonaraUse: "Use one correlation vocabulary for HTTP requests, jobs, agents, model calls, tools, payments, provider adapters, database activity and business outcomes."
  }),
  signal({
    key: "genai_tool_observability",
    domain: "agentic_ai",
    source: "OpenTelemetry — GenAI observability",
    sourceUrl: "https://opentelemetry.io/blog/2026/genai-observability/",
    finding: "GenAI telemetry can expose model calls, tool invocations, token usage, retries and latency so slow or incorrect agent behavior can be diagnosed instead of guessed.",
    sonaraUse: "Instrument agent and RAG execution as first-class operational workflows with privacy-aware capture, cost accounting and end-to-end correlation."
  }),
  signal({
    key: "hybrid_tenant_rag",
    domain: "rag_and_search",
    source: "Supabase — Hybrid Search",
    sourceUrl: "https://supabase.com/docs/guides/ai/hybrid-search",
    finding: "Hybrid retrieval combines lexical full-text and semantic vector search, while PostgreSQL policies can enforce tenant-aware data access.",
    sonaraUse: "Prefer measurable hybrid retrieval for business knowledge: tenant filter first, then lexical/vector retrieval, reranking, citations and evaluation."
  }),
  signal({
    key: "agent_security_2026",
    domain: "agent_security",
    source: "OWASP — Top 10 for Agentic Applications 2026",
    sourceUrl: "https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/",
    finding: "Agentic systems add security risks around identity, tool use, orchestration, excessive agency, data handling and multi-step autonomous execution.",
    sonaraUse: "Keep model intent separate from authority. Every tool call remains tenant-scoped, policy-checked, budgeted, auditable and independently verifiable."
  }),
  signal({
    key: "llm_security_2026",
    domain: "llm_security",
    source: "OWASP — GenAI LLM Top 10 2026",
    sourceUrl: "https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/",
    finding: "Current LLM security guidance treats prompt injection, sensitive-data exposure and connected-system risks as application-level controls, not model-only problems.",
    sonaraUse: "Treat prompts, retrieval, tools, skills, connectors and model outputs as untrusted inputs unless verified by SONARA-owned policy and validation."
  }),
  signal({
    key: "payment_retry_reconciliation",
    domain: "payments",
    source: "Stripe — Idempotent requests",
    sourceUrl: "https://docs.stripe.com/api/idempotent_requests",
    finding: "Provider idempotency supports safe retry of payment mutations, but application state still requires canonical reconciliation and webhook deduplication.",
    sonaraUse: "Use SONARA operation identity through checkout, subscription, refund and invoice flows and reconcile external provider events into canonical ledger state."
  }),
  signal({
    key: "commerce_duplicate_delivery",
    domain: "commerce",
    source: "Shopify — Webhooks best practices",
    sourceUrl: "https://shopify.dev/docs/apps/build/webhooks/subscribe/https",
    finding: "Commerce webhooks can be delivered more than once and therefore require duplicate-safe handlers plus authenticity verification.",
    sonaraUse: "Make all external event consumers replay-safe with provider event identity, HMAC/signature verification where supported, inbox deduplication and deterministic effects."
  }),
  signal({
    key: "fleet_realtime_adapter",
    domain: "fleet_and_telematics",
    source: "Samsara — API and Webhooks",
    sourceUrl: "https://developers.samsara.com/",
    finding: "Modern fleet platforms expose scoped APIs, webhooks and telematics feeds for vehicle, GPS, diagnostics and operational events.",
    sonaraUse: "Model fleet integrations as permissioned provider adapters feeding canonical jobs, routes, assets, maintenance, geospatial evidence and analytics."
  }),
  signal({
    key: "field_service_integration_market",
    domain: "field_service",
    source: "ServiceTitan — V2 API",
    sourceUrl: "https://developer.servicetitan.io/",
    finding: "Field-service platforms expose integration surfaces spanning customers, jobs, scheduling and operational records.",
    sonaraUse: "Keep trades/HVAC/plumbing/electrical/carpentry/cleaning as vertical compositions over shared customer, job, schedule, dispatch, estimate, invoice and payment primitives."
  }),
  signal({
    key: "mobile_monetization_acceleration",
    domain: "mobile_business",
    source: "Sensor Tower — State of Mobile 2026",
    sourceUrl: "https://sensortower.com/blog/state-of-mobile-2026",
    finding: "Global in-app purchase revenue reached record levels in 2025 and non-game app monetization accelerated alongside generative-AI adoption.",
    sonaraUse: "Make subscriptions, entitlements, usage metering, retention events, refunds and app-store/provider reconciliation core backend services rather than product-specific afterthoughts."
  }),
  signal({
    key: "ai_application_monetization",
    domain: "ai_business",
    source: "Sensor Tower — State of AI 2026",
    sourceUrl: "https://sensortower.com/report/state-of-ai-2026",
    finding: "AI-labelled applications continue to expand downloads, engagement and in-app purchase revenue in 2026.",
    sonaraUse: "Treat AI as a metered capability layer with measurable cost, value, safety and retention instead of an unrestricted feature flag."
  })
]);

const WORKLOAD_ARCHETYPES = Object.freeze([
  archetype("transactional_system_of_record",
    ["customers", "organizations", "orders", "bookings", "jobs", "invoices", "entitlements", "inventory", "audit"],
    ["strong write correctness", "tenant isolation", "transaction boundaries", "reconciliation"],
    "PostgreSQL/Supabase remains canonical until measured workload evidence requires another authority model."),
  archetype("durable_business_workflow",
    ["order fulfillment", "reservation lifecycle", "subscription lifecycle", "field job", "refund", "approval", "agent workflow"],
    ["durable state", "idempotent activities", "bounded retry", "timeouts", "compensation", "human checkpoints"],
    "Use explicit persisted workflow state now; evaluate a specialized durable engine when workflow volume/complexity justifies it."),
  archetype("event_and_telemetry_ingest",
    ["webhooks", "device events", "fleet GPS", "notifications", "audit", "analytics events"],
    ["signature/authentication", "deduplication", "backpressure", "ordering contract", "dead-letter evidence"],
    "Prefer the existing outbox/inbox and queue foundation; add streaming infrastructure only from measured throughput/retention needs."),
  archetype("low_latency_session_coordination",
    ["kiosk session", "live room", "game lobby", "device control", "presence", "collaboration"],
    ["serialized mutation where required", "ephemeral state", "timeouts", "canonical reconciliation"],
    "Use a specialized coordinator only for workloads needing low-latency serialized state; durable business authority remains canonical elsewhere."),
  archetype("analytical_observability",
    ["telemetry", "business analytics", "agent/tool traces", "funnel events", "performance history"],
    ["append-friendly ingest", "high-cardinality query", "retention", "cost controls", "privacy"],
    "Keep operational telemetry separate from transactional write paths while preserving correlation IDs and governed joins."),
  archetype("tenant_scoped_rag",
    ["business knowledge", "customer support", "documents", "manuals", "policies", "creator assets"],
    ["tenant filter", "hybrid retrieval", "reranking", "citation coverage", "groundedness evaluation", "retention"],
    "Use PostgreSQL/pgvector and lexical search first; select ANN indexes from measured recall/latency rather than fashion."),
  archetype("media_asset_pipeline",
    ["video", "audio", "images", "movies", "podcasts", "books", "creator projects"],
    ["immutable source", "derived renditions", "object storage", "job state", "rights", "moderation", "approval"],
    "Separate control-plane records from high-volume media bytes and GPU/processing workers."),
  archetype("external_provider_adapter",
    ["payments", "email", "calendar", "maps", "social", "shipping", "banking", "app stores", "search"],
    ["scoped credentials", "rate/cost limits", "idempotency", "webhook verification", "reconciliation", "audit"],
    "All external providers terminate behind SONARA identity, policy, budget, retry and evidence contracts."),
  archetype("offline_sync_edge",
    ["field service", "delivery", "fleet", "POS", "kiosk", "mobile inspections", "warehousing"],
    ["local queue", "conflict policy", "stable operation identity", "encrypted storage", "sync checkpoints"],
    "Model offline writes as replayable commands and deterministic merges instead of hidden last-write-wins behavior."),
  archetype("risk_approval_ledger",
    ["money movement", "refunds", "access changes", "regulated actions", "publication", "destructive maintenance"],
    ["separation of duties", "immutable evidence", "policy decision", "approval state", "replay protection"],
    "Sensitive authority requires explicit provenance and approval; agents may prepare evidence but cannot widen their own authority.")
]);

const INDUSTRY_BACKEND_MAP = Object.freeze([
  vertical("restaurant_pos_kiosk_reservations_rsvp", ["transactional_system_of_record", "durable_business_workflow", "event_and_telemetry_ingest", "offline_sync_edge", "external_provider_adapter"], ["inventory reservation", "table/seat capacity", "kitchen fulfillment", "tips/tax", "delivery reconciliation"]),
  vertical("trades_hvac_electrical_plumbing_carpentry_cleaning", ["transactional_system_of_record", "durable_business_workflow", "offline_sync_edge", "external_provider_adapter"], ["dispatch", "estimate-to-invoice", "crew skills", "service history", "photo/signature evidence"]),
  vertical("trucking_delivery_waste_logistics", ["transactional_system_of_record", "event_and_telemetry_ingest", "offline_sync_edge", "external_provider_adapter", "analytical_observability"], ["GPS/telematics", "route/stop state", "driver/asset compliance", "proof of service", "maintenance"]),
  vertical("retail_ecommerce_marketplace", ["transactional_system_of_record", "durable_business_workflow", "event_and_telemetry_ingest", "external_provider_adapter", "analytical_observability"], ["inventory reservation", "order lifecycle", "returns", "seller trust", "tax/shipping"]),
  vertical("creator_social_streaming_media_books_podcasts", ["media_asset_pipeline", "durable_business_workflow", "event_and_telemetry_ingest", "tenant_scoped_rag", "analytical_observability"], ["rights/provenance", "moderation", "render/transcode jobs", "publishing approval", "audience analytics"]),
  vertical("manufacturing_robotics_cad_printing", ["transactional_system_of_record", "event_and_telemetry_ingest", "durable_business_workflow", "analytical_observability", "external_provider_adapter"], ["BOM/work orders", "machine telemetry", "quality checkpoints", "maintenance", "specialist equipment protocols"]),
  vertical("finance_banking_investment_insurance", ["transactional_system_of_record", "risk_approval_ledger", "durable_business_workflow", "event_and_telemetry_ingest", "external_provider_adapter"], ["ledger/reconciliation", "risk inputs", "approvals", "audit/retention", "regulated provider boundaries"]),
  vertical("real_estate_rental_venues_jobs_dating", ["transactional_system_of_record", "durable_business_workflow", "external_provider_adapter", "tenant_scoped_rag"], ["listings/profiles", "availability", "applications", "messaging/consent", "payments/moderation"]),
  vertical("education_translation_classroom_public_access_government", ["transactional_system_of_record", "tenant_scoped_rag", "risk_approval_ledger", "external_provider_adapter"], ["accessibility", "records/retention", "identity/roles", "translation provenance", "public-sector audit"]),
  vertical("gaming_ar_spatial_device", ["low_latency_session_coordination", "event_and_telemetry_ingest", "media_asset_pipeline", "analytical_observability", "external_provider_adapter"], ["realtime state", "entitlements", "device permissions", "performance budgets", "anti-abuse"]),
  vertical("ai_agents_llms_skills_rag", ["durable_business_workflow", "tenant_scoped_rag", "analytical_observability", "risk_approval_ledger", "external_provider_adapter"], ["tool authority", "memory policy", "evaluation", "cost/token budgets", "prompt/tool injection resistance"]),
  vertical("websites_seo_campaigns_customer_service", ["transactional_system_of_record", "event_and_telemetry_ingest", "tenant_scoped_rag", "external_provider_adapter", "analytical_observability"], ["consent/suppression", "attribution", "conversation state", "search metadata", "support outcomes"])
]);

const CAPABILITY_PRIORITIES = Object.freeze([
  priority("P0", "shared_reliability_kernel", ["tenant identity", "idempotency", "outbox/inbox", "deadlines", "backpressure", "circuit breakers", "audit", "release evidence"]),
  priority("P1", "durable_operations", ["persisted workflow state", "reconciliation", "SLOs", "OpenTelemetry correlation", "bounded runtime remediation", "progressive rollback"]),
  priority("P1", "revenue_and_retention", ["subscriptions", "entitlements", "usage metering", "checkout/refund reconciliation", "webhook deduplication", "retention analytics"]),
  priority("P1", "governed_ai_and_rag", ["tenant-scoped retrieval", "hybrid search", "evaluation", "agent/tool telemetry", "policy gates", "approval checkpoints"]),
  priority("P2", "vertical_accelerators", ["fleet telematics", "field-service adapters", "POS/offline sync", "media pipelines", "manufacturing telemetry", "spatial/realtime sessions"]),
  priority("P3", "regulated_and_high_authority_connectors", ["banking/investment execution", "government-sensitive writes", "destructive infrastructure repair", "widened autonomous authority"])
]);

function signal(input) {
  return Object.freeze({
    ...input,
    asOf: BACKEND_MARKET_ANALYSIS_DATE,
    runtimeAuthority: "none",
    productionCapability: false
  });
}

function archetype(key, examples, invariants, sonaraFit) {
  return Object.freeze({
    key,
    examples: Object.freeze([...examples]),
    invariants: Object.freeze([...invariants]),
    sonaraFit
  });
}

function vertical(key, archetypes, differentiators) {
  return Object.freeze({
    key,
    archetypes: Object.freeze([...archetypes]),
    differentiators: Object.freeze([...differentiators])
  });
}

function priority(tier, key, capabilities) {
  return Object.freeze({ tier, key, capabilities: Object.freeze([...capabilities]) });
}

function finite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${field} must be finite`);
  return number;
}

function unit(value, field) {
  const number = finite(value, field);
  if (number < 0 || number > 1) throw new RangeError(`${field} must be between 0 and 1`);
  return number;
}

function positive(value, field) {
  const number = finite(value, field);
  if (number <= 0) throw new RangeError(`${field} must be greater than zero`);
  return number;
}

function nonNegative(value, field) {
  const number = finite(value, field);
  if (number < 0) throw new RangeError(`${field} must be non-negative`);
  return number;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function capacityHeadroom(input = {}) {
  const peakObserved = nonNegative(input.peakObserved, "peakObserved");
  const safeCapacity = positive(input.safeCapacity, "safeCapacity");
  return round(Math.max(0, Math.min(1, 1 - peakObserved / safeCapacity)));
}

function recoveryConfidenceScore(input = {}) {
  const detectionCoverage = unit(input.detectionCoverage, "detectionCoverage");
  const runbookCoverage = unit(input.runbookCoverage, "runbookCoverage");
  const rollbackCoverage = unit(input.rollbackCoverage, "rollbackCoverage");
  const testFreshness = unit(input.testFreshness, "testFreshness");
  return round(0.25 * detectionCoverage + 0.25 * runbookCoverage + 0.25 * rollbackCoverage + 0.25 * testFreshness);
}

function workflowFitnessScore(input = {}) {
  const correctness = unit(input.correctness, "correctness");
  const durability = unit(input.durability, "durability");
  const auditability = unit(input.auditability, "auditability");
  const latencyFit = unit(input.latencyFit, "latencyFit");
  const costFit = unit(input.costFit, "costFit");
  return round(0.30 * correctness + 0.25 * durability + 0.20 * auditability + 0.15 * latencyFit + 0.10 * costFit);
}

function repairAutomationDecision(input = {}) {
  const evidenceFreshness = unit(input.evidenceFreshness, "evidenceFreshness");
  const blastRadius = unit(input.blastRadius, "blastRadius");
  const deterministic = Boolean(input.deterministic);
  const reversible = Boolean(input.reversible);
  const tenantScoped = Boolean(input.tenantScoped);
  const authoritySensitive = Boolean(input.authoritySensitive);
  const changesCode = Boolean(input.changesCode);
  const changesSchema = Boolean(input.changesSchema);

  if (!tenantScoped) return Object.freeze({ automate: false, mode: "blocked", reason: "tenant_scope_not_proven" });
  if (authoritySensitive) return Object.freeze({ automate: false, mode: "human_approval_required", reason: "authority_sensitive" });
  if (changesCode || changesSchema) return Object.freeze({ automate: false, mode: "branch_only", reason: "source_or_schema_change" });
  if (evidenceFreshness < 0.8) return Object.freeze({ automate: false, mode: "observe_only", reason: "stale_evidence" });
  if (!deterministic || !reversible) return Object.freeze({ automate: false, mode: "observe_only", reason: "repair_not_proven_safe" });
  if (blastRadius > 0.1) return Object.freeze({ automate: false, mode: "approval_required", reason: "blast_radius_too_large" });

  return Object.freeze({ automate: true, mode: "bounded_reconciliation", reason: "preapproved_low_risk_repair" });
}

function getBackendOperationsMarketAnalysis() {
  return {
    ok: true,
    version: BACKEND_MARKET_ANALYSIS_VERSION,
    snapshotDate: BACKEND_MARKET_ANALYSIS_DATE,
    researchOnly: true,
    productionExecutionCount: 0,
    installedRepositoryCount: 0,
    marketSignalCount: MARKET_SIGNALS_2026.length,
    workloadArchetypeCount: WORKLOAD_ARCHETYPES.length,
    industryMapCount: INDUSTRY_BACKEND_MAP.length,
    capabilityPriorityCount: CAPABILITY_PRIORITIES.length,
    marketSignals: MARKET_SIGNALS_2026.map((item) => ({ ...item })),
    workloadArchetypes: WORKLOAD_ARCHETYPES.map((item) => ({
      ...item,
      examples: [...item.examples],
      invariants: [...item.invariants]
    })),
    industryBackendMap: INDUSTRY_BACKEND_MAP.map((item) => ({
      ...item,
      archetypes: [...item.archetypes],
      differentiators: [...item.differentiators]
    })),
    capabilityPriorities: CAPABILITY_PRIORITIES.map((item) => ({
      ...item,
      capabilities: [...item.capabilities]
    })),
    formulas: {
      capacityHeadroom: "clamp(1 - peak_observed / safe_capacity, 0, 1)",
      recoveryConfidence: "0.25*detection + 0.25*runbook + 0.25*rollback + 0.25*test_freshness",
      workflowFitness: "0.30*correctness + 0.25*durability + 0.20*auditability + 0.15*latency_fit + 0.10*cost_fit"
    },
    architectureDecision: {
      core: "One shared reliability kernel supports every vertical; industry differentiation lives in schemas, workflows, policies and adapters rather than duplicated infrastructure.",
      synchronousPath: "Keep customer-facing command paths small, bounded and deterministic; move slow or failure-prone work into persisted workflows.",
      data: "PostgreSQL/Supabase remains the canonical transactional authority. Specialized search, analytics, realtime and media systems are projections or workload-specific services with reconciliation.",
      agents: "LLMs are probabilistic planners/reasoners inside deterministic identity, policy, workflow, verification, telemetry and budget envelopes.",
      selfRepair: "Automatically reconcile only low-risk runtime drift. Code/schema changes are branch-only; authority, destructive changes and money movement require explicit authorization.",
      scale: "Add queues, replicas, partitioning, brokers, specialized analytics or coordinators only when measured latency, throughput, retention or recovery requirements justify them."
    },
    guardrails: [
      "This market analysis has zero production execution authority.",
      "No third-party repository, workflow engine, broker, analytics database or provider is installed by this module.",
      "External market evidence is a design input, not proof that SONARA itself has reached another product's scale.",
      "Self-repair never means unrestricted self-modifying production code.",
      "Performance, availability and scale claims require exact-SHA load, failure and post-deploy evidence.",
      "Regulated finance, government, identity, biometrics and safety-sensitive capabilities require domain-specific legal/security review before production activation."
    ]
  };
}

module.exports = {
  BACKEND_MARKET_ANALYSIS_DATE,
  BACKEND_MARKET_ANALYSIS_VERSION,
  MARKET_SIGNALS_2026,
  WORKLOAD_ARCHETYPES,
  INDUSTRY_BACKEND_MAP,
  CAPABILITY_PRIORITIES,
  capacityHeadroom,
  recoveryConfidenceScore,
  workflowFitnessScore,
  repairAutomationDecision,
  getBackendOperationsMarketAnalysis
};
