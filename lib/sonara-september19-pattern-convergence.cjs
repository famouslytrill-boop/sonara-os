// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { get2026MarketIntelligence } = require("./sonara-2026-market-intelligence.cjs");
const { getBackendOperationsIntelligence } = require("./sonara-backend-operations-intelligence-2026.cjs");

const CONVERGENCE_VERSION = "1.1.0";
const DEFAULT_ROUTE_WEIGHTS = Object.freeze({
  quality: 0.45,
  reliability: 0.25,
  latency: 0.15,
  cost: 0.15
});

const SOURCE_LEADS = Object.freeze([
  Object.freeze({
    key: "grok_build",
    label: "Grok Build",
    sourceType: "verified_repository",
    repository: "xai-org/grok-build",
    license: "Apache-2.0",
    placement: "developer_agent_reference",
    enabledInProduction: false,
    nextStep: "Compare terminal-agent orchestration, ACP-style client integration, long-running task control, and TUI ergonomics against SONARA-owned engineering workflows."
  }),
  Object.freeze({
    key: "concat",
    label: "Concat",
    sourceType: "verified_repository",
    repository: "jub0t/Concat",
    license: "AGPL-3.0",
    placement: "creator_media_reference_only",
    enabledInProduction: false,
    nextStep: "Study local-first editing, multi-track timelines, captions, TTS, and MCP integration without incorporating reciprocal-licensed source into SONARA proprietary runtime."
  }),
  Object.freeze({
    key: "situation_monitor",
    label: "Situation Monitor",
    sourceType: "verified_repository",
    repository: "hipcityreg/situation-monitor",
    license: "unreported",
    placement: "dashboard_and_event_monitoring_reference",
    enabledInProduction: false,
    nextStep: "Keep as an architecture reference until licensing, data-source terms, update cadence, and operational trust boundaries are verified."
  }),
  Object.freeze({
    key: "searchphone",
    label: "SearchPhone",
    sourceType: "screenshot_reference",
    repository: null,
    license: "unresolved",
    placement: "restricted_osint_reference",
    enabledInProduction: false,
    blockedUses: Object.freeze(["covert_person_lookup", "unauthorized_tracking", "credential_or_sensitive_data_harvesting"]),
    nextStep: "Resolve upstream identity before any code review; any lawful contact-enrichment capability must be consented, purpose-limited, auditable, and tenant-scoped."
  }),
  Object.freeze({
    key: "doorman_api_gateway",
    label: "Doorman API Gateway",
    sourceType: "screenshot_reference",
    repository: null,
    license: "unresolved",
    placement: "api_gateway_reference",
    enabledInProduction: false,
    nextStep: "Use the multi-protocol gateway idea as a reference for REST, SOAP, GraphQL, gRPC, and agent-protocol adapters behind SONARA authentication and authority checks."
  }),
  Object.freeze({
    key: "security_audit_skill",
    label: "Security Audit skill",
    sourceType: "screenshot_reference",
    repository: null,
    license: "unresolved",
    placement: "authorized_security_harness_reference",
    enabledInProduction: false,
    blockedUses: Object.freeze(["unauthorized_reconnaissance", "credential_capture", "destructive_testing"]),
    nextStep: "Preserve isolated reconnaissance, coverage-led hunting, candidate validation, independent verification, and target-neutral reporting only for owned or explicitly authorized targets."
  }),
  Object.freeze({
    key: "higgsfield_oauth",
    label: "Higgsfield OAuth/provider connection",
    sourceType: "hosted_service_reference",
    repository: null,
    license: "service_terms_apply",
    placement: "creator_provider_gateway_reference",
    enabledInProduction: false,
    nextStep: "Treat cinematic generation as a provider adapter behind OAuth, rights, cost, retention, provenance, and explicit customer-authorization gates."
  }),
  Object.freeze({
    key: "free_video_generator",
    label: "Local free video generator",
    sourceType: "screenshot_reference",
    repository: null,
    license: "unresolved",
    placement: "isolated_gpu_worker_research",
    enabledInProduction: false,
    nextStep: "Resolve the exact repository and model licenses before testing; keep GPU/media generation inside isolated workers with no implicit publication authority."
  }),
  Object.freeze({
    key: "github_codespaces",
    label: "GitHub Codespaces",
    sourceType: "hosted_service_reference",
    repository: null,
    license: "service_terms_apply",
    placement: "developer_workspace_reference",
    enabledInProduction: false,
    nextStep: "Use quota-aware disposable developer environments where useful; never hard-code social-post pricing or quota claims into SONARA product promises."
  }),
  Object.freeze({
    key: "hackproduct_architecture_diagrams",
    label: "HackProduct architecture diagrams",
    sourceType: "educational_reference",
    repository: null,
    license: "not_source_code",
    placement: "internal_architecture_learning",
    enabledInProduction: false,
    nextStep: "Adapt only general engineering patterns: bounded loops, harnesses, control planes, RAG evaluation, streaming reliability, sharding, event delivery, system design, and agent observability."
  })
]);

const PLATFORM_PATTERNS = Object.freeze([
  Object.freeze({
    key: "control_data_plane_split",
    domain: "media_and_delivery",
    principle: "Separate command/control decisions from high-volume byte delivery.",
    sonaraUse: "Keep orchestration, authorization, manifests, and recommendations in the application control plane while media derivatives and large immutable assets use storage/CDN paths."
  }),
  Object.freeze({
    key: "write_once_read_many_media",
    domain: "media_and_delivery",
    principle: "Do expensive ingest/transcode work once and serve cached derivatives many times.",
    sonaraUse: "Create immutable source assets plus derived renditions; never overwrite the source during preview processing."
  }),
  Object.freeze({
    key: "bounded_agent_harness",
    domain: "agents",
    principle: "The harness owns context, policy, execution, verification, retries, and observability; the model is one replaceable component.",
    sonaraUse: "Use explicit context builders, policy gates, isolated executors, independent verification, retry ceilings, idempotency, and stop conditions."
  }),
  Object.freeze({
    key: "memory_read_before_write",
    domain: "agents",
    principle: "Retrieve only relevant durable memory before acting; persist only information that passes a worth-saving policy.",
    sonaraUse: "Separate working, episodic, semantic, and procedural memory and require tenant scope, provenance, retention, sensitivity checks, and user control."
  }),
  Object.freeze({
    key: "rag_retrieve_augment_generate_evaluate",
    domain: "knowledge",
    principle: "Production retrieval needs indexing, query routing, reranking, citations, state, safety, observability, and evaluation.",
    sonaraUse: "Build on the grounded-retrieval contract with tenant filters, measurable citation coverage, explicit source types, and provider-neutral adapters."
  }),
  Object.freeze({
    key: "api_gateway_authority_boundary",
    domain: "integration",
    principle: "Protocol translation is not authorization.",
    sonaraUse: "REST, GraphQL, gRPC, SOAP, MCP, ACP, and provider adapters must terminate behind identity, tenant, scope, rate, cost, approval, and audit checks."
  }),
  Object.freeze({
    key: "delivery_semantics_explicit",
    domain: "events",
    principle: "At-most-once, at-least-once, and exactly-once-like effects require different idempotency and acknowledgement contracts.",
    sonaraUse: "Default to at-least-once transport with idempotent business effects, replay-safe handlers, dead-letter evidence, and immutable correlation identifiers."
  }),
  Object.freeze({
    key: "partition_shard_replicate_by_measurement",
    domain: "data",
    principle: "Partitioning, sharding, and replication solve different scaling and resilience problems.",
    sonaraUse: "Choose them from measured load, locality, recovery, and failure-domain requirements rather than from social-post architecture diagrams."
  }),
  Object.freeze({
    key: "defense_in_depth_https",
    domain: "security",
    principle: "TLS certificates, CA validation, handshakes, ciphers, renewal, HSTS, and secure defaults form one transport-security system.",
    sonaraUse: "Keep HTTPS-only public surfaces, certificate renewal monitoring, HSTS where appropriate, secure cookies, and provider callbacks that reject downgrade or origin ambiguity."
  }),
  Object.freeze({
    key: "database_by_workload",
    domain: "data",
    principle: "Relational, document, cache, wide-column, search, graph, analytical, embedded, and time-series stores optimize different access patterns.",
    sonaraUse: "Keep PostgreSQL/Supabase as the system of record and add specialized stores only behind measured requirements and explicit consistency/retention contracts."
  }),
  Object.freeze({
    key: "design_patterns_as_local_tools",
    domain: "software_design",
    principle: "Factory, builder, adapter, decorator, facade, proxy, composite, observer, strategy, command, iterator, state, template method, and chain-of-responsibility are local design tools, not architecture goals.",
    sonaraUse: "Use the smallest pattern that clarifies an actual extension, state, composition, routing, or compatibility problem."
  }),
  Object.freeze({
    key: "eval_guardrail_monitoring_separation",
    domain: "reliability",
    principle: "Evaluation measures quality, guardrails enforce policy, and monitoring detects runtime behavior; none substitutes for the others.",
    sonaraUse: "Maintain all three as separate control-plane surfaces with explicit release evidence."
  })
]);


const BUSINESS_APPLICATIONS = Object.freeze([
  Object.freeze({
    key: "creator_media_pipeline",
    product: "Creator Studio",
    use: "Immutable ingest, preview derivation, captions/transcripts, quality verification, approval-gated publication, and cached delivery."
  }),
  Object.freeze({
    key: "business_integration_gateway",
    product: "Business Builder",
    use: "Governed REST, GraphQL, gRPC, SOAP, MCP, ACP, and provider adapters with tenant, rate, cost, approval, and audit boundaries."
  }),
  Object.freeze({
    key: "grounded_knowledge_workspace",
    product: "SONARA One",
    use: "Tenant-scoped retrieval, governed memory, citations, evaluation, and evidence-aware business knowledge workflows."
  }),
  Object.freeze({
    key: "growth_event_operations",
    product: "Growth Studio",
    use: "Replay-safe event handling, bounded retries, backpressure, observable automations, and approval-gated external actions."
  }),
  Object.freeze({
    key: "founder_engineering_harness",
    product: "Founder Operations",
    use: "Scoped coding agents, disposable developer workspaces, independent verification, exact-head CI, and release evidence."
  })
]);

const AGENT_ROLES = Object.freeze([
  Object.freeze({ key: "context_builder", authority: "read_only", purpose: "Assemble scoped current-task, policy, memory, and retrieval context." }),
  Object.freeze({ key: "planner_router", authority: "proposal_only", purpose: "Choose a bounded workflow, model, or specialist route without granting execution authority." }),
  Object.freeze({ key: "retriever", authority: "read_only", purpose: "Retrieve tenant-scoped evidence and return source identifiers for citation." }),
  Object.freeze({ key: "executor", authority: "scoped_action", purpose: "Perform the narrow approved action with idempotency, cost, timeout, and tenant limits." }),
  Object.freeze({ key: "policy_gate", authority: "block_or_approve", purpose: "Apply deterministic policy before sensitive tools, external writes, publication, security work, or customer-data export." }),
  Object.freeze({ key: "verifier", authority: "release_gate", purpose: "Independently validate output, citations, tests, safety, and acceptance criteria." }),
  Object.freeze({ key: "observer", authority: "telemetry_only", purpose: "Record structured evidence, latency, retries, failures, and quality metrics without widening authority." })
]);

const SKILLS = Object.freeze([
  Object.freeze({ key: "harness_engineering", steps: Object.freeze(["build_context", "plan", "policy_gate", "execute", "verify", "observe", "bounded_retry_or_stop"]) }),
  Object.freeze({ key: "grounded_rag_delivery", steps: Object.freeze(["index", "retrieve", "rerank", "augment", "generate", "cite", "evaluate"]) }),
  Object.freeze({ key: "governed_memory", steps: Object.freeze(["classify_memory", "scope_to_tenant", "retrieve_relevant", "act", "score_worth_saving", "persist_or_drop"]) }),
  Object.freeze({ key: "media_delivery", steps: Object.freeze(["ingest", "preserve_source", "derive_renditions", "verify", "publish_after_approval", "serve_via_cache"]) }),
  Object.freeze({ key: "integration_gateway", steps: Object.freeze(["authenticate", "authorize", "normalize_protocol", "rate_limit", "execute_adapter", "audit"]) }),
  Object.freeze({ key: "authorized_security_audit", steps: Object.freeze(["confirm_scope", "reconnaissance", "coverage_hunt", "candidate_validation", "independent_verification", "report"]) }),
  Object.freeze({ key: "data_store_selection", steps: Object.freeze(["define_access_pattern", "define_consistency", "measure_scale", "select_store", "define_retention", "test_recovery"]) }),
  Object.freeze({ key: "production_agent_evaluation", steps: Object.freeze(["offline_eval", "guardrail_test", "canary", "monitor", "compare_to_baseline", "promote_or_rollback"]) })
]);

function assertFinite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${field} must be finite`);
  return number;
}

function assertUnit(value, field) {
  const number = assertFinite(value, field);
  if (number < 0 || number > 1) throw new RangeError(`${field} must be between 0 and 1`);
  return number;
}

function positive(value, field) {
  const number = assertFinite(value, field);
  if (number <= 0) throw new RangeError(`${field} must be greater than zero`);
  return number;
}

function nonNegativeInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new RangeError(`${field} must be a non-negative integer`);
  return number;
}

function round(value, digits = 4) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function citationCoverage(citedClaims, totalClaims) {
  const cited = nonNegativeInteger(citedClaims, "citedClaims");
  const total = nonNegativeInteger(totalClaims, "totalClaims");
  if (cited > total) throw new RangeError("citedClaims cannot exceed totalClaims");
  return total === 0 ? 0 : round(cited / total);
}

function routeScore(input = {}) {
  const quality = assertUnit(input.quality, "quality");
  const reliability = assertUnit(input.reliability, "reliability");
  const latencyMs = assertFinite(input.latencyMs, "latencyMs");
  const cost = assertFinite(input.cost, "cost");
  if (latencyMs < 0 || cost < 0) throw new RangeError("latencyMs and cost must be non-negative");

  const latencyBudgetMs = positive(input.latencyBudgetMs, "latencyBudgetMs");
  const costBudget = positive(input.costBudget, "costBudget");
  const weights = { ...DEFAULT_ROUTE_WEIGHTS, ...(input.weights || {}) };
  const weightValues = ["quality", "reliability", "latency", "cost"].map((key) => assertUnit(weights[key], `weights.${key}`));
  const weightTotal = weightValues.reduce((sum, value) => sum + value, 0);
  if (Math.abs(weightTotal - 1) > 0.000001) throw new RangeError("route weights must sum to 1");

  const latencyFit = 1 - Math.min(latencyMs / latencyBudgetMs, 1);
  const costFit = 1 - Math.min(cost / costBudget, 1);
  return round(
    quality * weights.quality +
    reliability * weights.reliability +
    latencyFit * weights.latency +
    costFit * weights.cost
  );
}

function memoryWriteDecision(input = {}) {
  const relevance = assertUnit(input.relevance, "relevance");
  const confidence = assertUnit(input.confidence, "confidence");
  const durability = assertUnit(input.durability, "durability");
  const sensitive = Boolean(input.sensitive);
  const consent = Boolean(input.consent);
  const ttlDays = nonNegativeInteger(input.ttlDays ?? 0, "ttlDays");
  const score = round(relevance * 0.45 + confidence * 0.35 + durability * 0.2);

  if (sensitive && !consent) return Object.freeze({ save: false, score, reason: "sensitive_without_consent" });
  if (sensitive && ttlDays < 1) return Object.freeze({ save: false, score, reason: "sensitive_without_retention_limit" });
  if (score < 0.72) return Object.freeze({ save: false, score, reason: "below_durability_threshold" });
  return Object.freeze({ save: true, score, reason: "policy_pass" });
}

function backpressureState(input = {}) {
  const queueDepth = nonNegativeInteger(input.queueDepth, "queueDepth");
  const workerCapacity = positive(input.workerCapacity, "workerCapacity");
  const load = queueDepth / workerCapacity;
  if (load < 0.75) return Object.freeze({ state: "normal", load: round(load) });
  if (load < 1.25) return Object.freeze({ state: "throttle", load: round(load) });
  return Object.freeze({ state: "shed_or_defer", load: round(load) });
}

function shardRequirement(input = {}) {
  const estimatedQps = assertFinite(input.estimatedQps, "estimatedQps");
  if (estimatedQps < 0) throw new RangeError("estimatedQps must be non-negative");
  const qpsPerShard = positive(input.qpsPerShard, "qpsPerShard");
  const targetUtilization = assertUnit(input.targetUtilization ?? 0.7, "targetUtilization");
  if (targetUtilization === 0) throw new RangeError("targetUtilization must be greater than zero");
  return Math.max(1, Math.ceil(estimatedQps / (qpsPerShard * targetUtilization)));
}

function replicaRequirement(input = {}) {
  const targetAvailability = assertUnit(input.targetAvailability, "targetAvailability");
  const instanceAvailability = assertUnit(input.instanceAvailability, "instanceAvailability");
  const maxReplicas = Math.max(1, nonNegativeInteger(input.maxReplicas ?? 8, "maxReplicas"));
  if (targetAvailability === 0) return 1;
  if (instanceAvailability === 0) return maxReplicas;
  if (instanceAvailability === 1) return 1;
  const required = Math.ceil(Math.log(1 - targetAvailability) / Math.log(1 - instanceAvailability));
  return Math.max(1, Math.min(required, maxReplicas));
}

function boundedLoopStatus(input = {}) {
  const attempt = nonNegativeInteger(input.attempt, "attempt");
  const maxIterations = Math.max(1, nonNegativeInteger(input.maxIterations, "maxIterations"));
  const blocked = Boolean(input.blocked);
  const verified = Boolean(input.verified);
  if (blocked) return Object.freeze({ continue: false, reason: "policy_blocked" });
  if (verified) return Object.freeze({ continue: false, reason: "verified" });
  if (attempt >= maxIterations) return Object.freeze({ continue: false, reason: "iteration_budget_exhausted" });
  return Object.freeze({ continue: true, reason: "within_budget" });
}

function getSeptember19PatternConvergence() {
  const marketIntelligence = get2026MarketIntelligence();
  const backendOperationsIntelligence = getBackendOperationsIntelligence();
  return {
    ok: true,
    version: CONVERGENCE_VERSION,
    sourceLeadCount: SOURCE_LEADS.length,
    patternCount: PLATFORM_PATTERNS.length,
    agentRoleCount: AGENT_ROLES.length,
    skillCount: SKILLS.length,
    businessApplicationCount: BUSINESS_APPLICATIONS.length,
    marketSignalCount: marketIntelligence.marketSignalCount,
    verticalOpportunityCount: marketIntelligence.verticalOpportunityCount,
    backendSignalCount: backendOperationsIntelligence.signalCount,
    backendReliabilityPrimitiveCount: backendOperationsIntelligence.primitiveCount,
    selfRepairLevelCount: backendOperationsIntelligence.repairLevelCount,
    productionThirdPartyExecutionCount: 0,
    sourceLeads: SOURCE_LEADS.map((item) => ({ ...item, blockedUses: item.blockedUses ? [...item.blockedUses] : [] })),
    patterns: PLATFORM_PATTERNS.map((item) => ({ ...item })),
    agentRoles: AGENT_ROLES.map((item) => ({ ...item })),
    businessApplications: BUSINESS_APPLICATIONS.map((item) => ({ ...item })),
    skills: SKILLS.map((item) => ({ ...item, steps: [...item.steps] })),
    marketIntelligence,
    backendOperationsIntelligence,
    formulas: {
      citationCoverage: "cited_claims / total_claims",
      routeScore: "0.45*quality + 0.25*reliability + 0.15*latency_fit + 0.15*cost_fit",
      memoryWriteScore: "0.45*relevance + 0.35*confidence + 0.20*durability",
      shardRequirement: "ceil(estimated_qps / (qps_per_shard * target_utilization))",
      replicaAvailabilityAssumption: "1 - (1 - instance_availability)^replicas",
      backpressureLoad: "queue_depth / worker_capacity"
    }
  };
}

module.exports = {
  CONVERGENCE_VERSION,
  DEFAULT_ROUTE_WEIGHTS,
  SOURCE_LEADS,
  PLATFORM_PATTERNS,
  BUSINESS_APPLICATIONS,
  AGENT_ROLES,
  SKILLS,
  citationCoverage,
  routeScore,
  memoryWriteDecision,
  backpressureState,
  shardRequirement,
  replicaRequirement,
  boundedLoopStatus,
  getSeptember19PatternConvergence
};