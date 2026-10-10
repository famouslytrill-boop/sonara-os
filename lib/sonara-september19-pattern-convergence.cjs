// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHash } = require("node:crypto");

const { get2026MarketIntelligence } = require("./sonara-2026-market-intelligence.cjs");
const { getFrontendVisualIntelligence } = require("./sonara-frontend-visual-intelligence-2026.cjs");
const { getBackendOperationsIntelligence, retryDelayMs } = require("./sonara-backend-operations-intelligence-2026.cjs");
const { getBackendOperationsMarketAnalysis } = require("./sonara-backend-operations-market-analysis-2026.cjs");

const CONVERGENCE_VERSION = "1.2.0";
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

// Advisory-only graph planning and trace replay; no provider or customer writes.
function planWorkflowSequence(steps) {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 128) {
    throw new RangeError("steps must contain 1..128 entries");
  }
  const idPattern = /^[a-z][a-z0-9_-]{0,63}$/;
  const byId = new Map();
  for (const step of steps) {
    if (!step || typeof step !== "object" || Array.isArray(step) || !idPattern.test(step.id || "")) {
      throw new TypeError("Each step requires a safe lowercase id");
    }
    if (byId.has(step.id)) throw new RangeError("Duplicate step: " + step.id);
    const dependencies = step.dependsOn ?? [];
    if (!Array.isArray(dependencies) || dependencies.length > 32 || new Set(dependencies).size !== dependencies.length) {
      throw new RangeError("Invalid dependencies for " + step.id);
    }
    const estimatedMs = step.estimatedMs ?? 0;
    const maxAttempts = step.maxAttempts ?? 1;
    if (!Number.isSafeInteger(estimatedMs) || estimatedMs < 0 || estimatedMs > 604800000) {
      throw new RangeError("Invalid estimatedMs for " + step.id);
    }
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
      throw new RangeError("Invalid maxAttempts for " + step.id);
    }
    byId.set(step.id, Object.freeze({
      id: step.id,
      dependsOn: Object.freeze([...dependencies].sort()),
      estimatedMs,
      maxAttempts
    }));
  }

  let edgeCount = 0;
  for (const step of byId.values()) {
    for (const dependency of step.dependsOn) {
      if (!byId.has(dependency)) throw new RangeError("Unknown dependency " + dependency + " for " + step.id);
      if (dependency === step.id) throw new RangeError("Self-dependency: " + step.id);
      edgeCount += 1;
    }
  }
  if (edgeCount > 1024) throw new RangeError("Workflow has too many dependencies");

  const remaining = new Set(byId.keys());
  const order = [];
  const stages = [];
  const finishTimes = new Map();
  const paths = new Map();
  while (remaining.size) {
    const ready = [...remaining]
      .filter((id) => byId.get(id).dependsOn.every((dependency) => !remaining.has(dependency)))
      .sort();
    if (!ready.length) throw new RangeError("Workflow dependency cycle detected");
    stages.push(Object.freeze(ready));
    for (const id of ready) {
      const step = byId.get(id);
      const precedent = step.dependsOn.reduce((best, dependency) =>
        best === null || finishTimes.get(dependency) > finishTimes.get(best) ? dependency : best, null);
      finishTimes.set(id, (precedent === null ? 0 : finishTimes.get(precedent)) + step.estimatedMs);
      paths.set(id, Object.freeze([...(precedent === null ? [] : paths.get(precedent)), id]));
      remaining.delete(id);
      order.push(id);
    }
  }
  let critical = order[0];
  for (const id of order) if (finishTimes.get(id) > finishTimes.get(critical)) critical = id;
  const canonicalSteps = Object.freeze([...byId.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // Pin the normalized definition to prevent interpreting old events with a new graph.
  const definitionHash = createHash("sha256")
    .update("sonara.workflow.definition.v1:")
    .update(JSON.stringify(canonicalSteps))
    .digest("hex");
  return Object.freeze({
    steps: canonicalSteps,
    definitionHash,
    order: Object.freeze(order),
    stages: Object.freeze(stages),
    edgeCount,
    criticalPathMs: finishTimes.get(critical),
    criticalPath: paths.get(critical)
  });
}

function replayWorkflowTrace(plan, events) {
  if (!plan || !Array.isArray(plan.steps)) throw new TypeError("A workflow plan is required");
  const canonical = planWorkflowSequence(plan.steps);
  if (!Array.isArray(events) || events.length > 4096) throw new RangeError("events must contain at most 4096 entries");
  const states = new Map(canonical.steps.map((step) => [step.id, { id: step.id, state: "pending", attempts: 0 }]));
  const definitions = new Map(canonical.steps.map((step) => [step.id, step]));
  const seen = new Map();
  let replayedEvents = 0;
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event) ||
        typeof event.eventId !== "string" || !/^[a-zA-Z0-9:_-]{1,128}$/.test(event.eventId) ||
        !definitions.has(event.stepId) || !["started", "succeeded", "failed"].includes(event.action) ||
        !Number.isSafeInteger(event.attempt) || event.attempt < 1) {
      throw new TypeError("Invalid workflow trace event");
    }
    const signature = event.stepId + ":" + event.action + ":" + event.attempt;
    if (seen.has(event.eventId)) {
      if (seen.get(event.eventId) !== signature) throw new RangeError("Conflicting replay event id");
      replayedEvents += 1;
      continue;
    }
    const state = states.get(event.stepId);
    const definition = definitions.get(event.stepId);
    if (event.action === "started") {
      if (!["pending", "failed"].includes(state.state) || state.attempts >= definition.maxAttempts ||
          event.attempt !== state.attempts + 1 ||
          !definition.dependsOn.every((dependency) => states.get(dependency).state === "succeeded")) {
        throw new RangeError("Out-of-sequence start: " + event.stepId);
      }
      state.attempts = event.attempt;
      state.state = "running";
    } else {
      if (state.state !== "running" || event.attempt !== state.attempts) {
        throw new RangeError("Out-of-sequence completion: " + event.stepId);
      }
      state.state = event.action === "succeeded" ? "succeeded" : "failed";
    }
    seen.set(event.eventId, signature);
  }
  const stepStates = canonical.steps.map((step) => Object.freeze({ ...states.get(step.id) }));
  const eligible = canonical.order.filter((id) => {
    const state = states.get(id);
    const definition = definitions.get(id);
    return ["pending", "failed"].includes(state.state) && state.attempts < definition.maxAttempts &&
      definition.dependsOn.every((dependency) => states.get(dependency).state === "succeeded");
  });
  const exhausted = canonical.order.filter((id) => {
    const state = states.get(id);
    return state.state === "failed" && state.attempts >= definitions.get(id).maxAttempts;
  });
  return Object.freeze({
    complete: stepStates.every((step) => step.state === "succeeded"),
    stepStates: Object.freeze(stepStates),
    eligible: Object.freeze(eligible),
    exhausted: Object.freeze(exhausted),
    acceptedEvents: seen.size,
    replayedEvents
  });
}

// Validate durable event envelopes before replay. Caller-provided scope is not authentication.
function replayScopedWorkflowTrace(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Scoped replay input must be an object");
  }
  const organizationId = input.organizationId;
  const runId = input.runId;
  if (typeof organizationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(organizationId)) {
    throw new TypeError("organizationId must be a canonical lowercase UUID");
  }
  if (typeof runId !== "string" || !/^[A-Za-z0-9:_-]{1,128}$/.test(runId)) {
    throw new TypeError("runId must be an opaque safe identifier");
  }
  if (!Array.isArray(input.events) || input.events.length > 4096) {
    throw new RangeError("Scoped replay events must contain at most 4096 entries");
  }
  const definitionHash = input.definitionHash;
  if (typeof definitionHash !== "string" || !/^[a-f0-9]{64}$/.test(definitionHash)) {
    throw new TypeError("definitionHash must be lowercase 64-character SHA-256 hex");
  }
  const canonicalPlan = planWorkflowSequence(input.plan?.steps);
  if (definitionHash !== canonicalPlan.definitionHash) {
    throw new RangeError("Workflow definition mismatch");
  }
  const seenIds = new Map();
  const seenSequences = new Map();
  const canonicalEvents = [];
  let lastSequence = 0;
  let duplicateEvents = 0;
  for (const event of input.events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      throw new TypeError("Invalid durable workflow event");
    }
    if (event.organizationId !== organizationId || event.runId !== runId) {
      throw new RangeError("Cross-scope workflow event refused");
    }
    if (event.definitionHash !== definitionHash) {
      throw new RangeError("Workflow event definition mismatch");
    }
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1 || event.sequence > 4096) {
      throw new RangeError("Invalid workflow event sequence");
    }
    if (typeof event.eventId !== "string" || !/^[A-Za-z0-9:_-]{1,128}$/.test(event.eventId)) {
      throw new TypeError("Invalid workflow event id");
    }
    const traceId = event.traceId ?? null;
    if (traceId !== null && (typeof traceId !== "string" ||
        !/^[a-f0-9]{32}$/.test(traceId) || /^0{32}$/.test(traceId))) {
      throw new TypeError("Invalid trace id");
    }
    const signature = JSON.stringify([
      event.sequence, event.eventId, event.stepId, event.action, event.attempt, traceId, definitionHash
    ]);
    const earlierId = seenIds.get(event.eventId);
    const earlierSequence = seenSequences.get(event.sequence);
    if (earlierId !== undefined || earlierSequence !== undefined) {
      if (earlierId !== signature || earlierSequence !== signature) {
        throw new RangeError("Conflicting durable workflow event");
      }
      duplicateEvents += 1;
      continue;
    }
    if (event.sequence !== lastSequence + 1) {
      throw new RangeError("Workflow event sequence gap or reordering");
    }
    seenIds.set(event.eventId, signature);
    seenSequences.set(event.sequence, signature);
    canonicalEvents.push({
      eventId: event.eventId,
      stepId: event.stepId,
      action: event.action,
      attempt: event.attempt
    });
    lastSequence = event.sequence;
  }
  const result = replayWorkflowTrace(input.plan, canonicalEvents);
  return Object.freeze({
    ...result,
    organizationId,
    runId,
    definitionHash,
    lastSequence,
    acceptedEvents: canonicalEvents.length,
    replayedEvents: duplicateEvents
  });
}

// Advisory, deterministic retry scheduling. Does not grant authority or perform I/O.
function evaluateWorkflowRetry(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Retry input must be an object");
  }
  const positiveInteger = (value, name, maximum) => {
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
      throw new RangeError(name + " must be an integer between 1 and " + maximum);
    }
    return value;
  };
  const validEpoch = (value, name) => {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(name + " must be a nonnegative safe integer");
    }
    return value;
  };
  const runId = input.runId;
  if (typeof runId !== "string" || !/^[a-zA-Z0-9:_-]{1,128}$/.test(runId)) {
    throw new TypeError("runId must be an opaque safe identifier");
  }
  const nowMs = validEpoch(input.nowMs, "nowMs");
  const startedAtMs = validEpoch(input.startedAtMs, "startedAtMs");
  if (nowMs < startedAtMs) throw new RangeError("nowMs precedes startedAtMs");
  const maxElapsedMs = positiveInteger(input.maxElapsedMs, "maxElapsedMs", 86_400_000);
  const baseDelayMs = positiveInteger(input.baseDelayMs ?? 1_000, "baseDelayMs", 60_000);
  const capDelayMs = positiveInteger(input.capDelayMs ?? 30_000, "capDelayMs", 300_000);
  if (capDelayMs < baseDelayMs) throw new RangeError("capDelayMs cannot be below baseDelayMs");
  const deadlineMs = startedAtMs + maxElapsedMs;
  if (!Number.isSafeInteger(deadlineMs)) throw new RangeError("deadlineMs exceeds safe integer range");

  const snapshot = replayWorkflowTrace(input.plan, input.events);
  const step = snapshot.stepStates.find((item) => item.id === input.stepId);
  const definition = input.plan.steps.find((item) => item.id === input.stepId);
  if (!step || !definition) throw new RangeError("Unknown workflow stepId");
  const stop = (reason) => Object.freeze({
    action: "stop",
    reason,
    stepId: step.id,
    completedAttempts: step.attempts
  });
  if (input.cancellationRequested === true) return stop("cancel_requested");
  if (step.state !== "failed") return stop("step_not_failed");
  if (step.attempts >= definition.maxAttempts) return stop("attempt_budget_exhausted");
  if (nowMs >= deadlineMs) return stop("time_budget_exhausted");
  if (!["transient", "rate_limited"].includes(input.failureKind)) return stop("non_retryable_failure");
  if (input.authorizationConfirmed !== true) return stop("authorization_unconfirmed");
  if (input.effectReplaySafe !== true) return stop("idempotency_unconfirmed");
  if (input.budgetApproved !== true) return stop("resource_budget_unconfirmed");

  const windowMs = retryDelayMs({ baseMs: baseDelayMs, attempt: step.attempts - 1, maxMs: capDelayMs });
  const hash = createHash("sha256").update(JSON.stringify([runId, step.id, step.attempts])).digest();
  const uniform = hash.readUInt32BE(0) / 0x1_0000_0000;
  let delayMs = Math.max(1, Math.floor(windowMs * uniform));
  if (input.failureKind === "rate_limited") {
    const providerRetryAfterMs = input.providerRetryAfterMs;
    if (!Number.isSafeInteger(providerRetryAfterMs) || providerRetryAfterMs < 1) {
      return stop("provider_backoff_unverified");
    }
    delayMs = Math.max(delayMs, providerRetryAfterMs);
    if (delayMs > capDelayMs) return stop("provider_backoff_exceeds_cap");
  }
  const notBeforeMs = nowMs + delayMs;
  if (!Number.isSafeInteger(notBeforeMs) || notBeforeMs > deadlineMs) {
    return stop("time_budget_exhausted");
  }
  return Object.freeze({
    action: "schedule",
    reason: "bounded_retry",
    stepId: step.id,
    nextAttempt: step.attempts + 1,
    remainingAttempts: definition.maxAttempts - step.attempts - 1,
    delayMs,
    notBeforeMs,
    deadlineMs
  });
}

function getSeptember19PatternConvergence() {
  const marketIntelligence = get2026MarketIntelligence();
  const frontendVisualIntelligence = getFrontendVisualIntelligence();
  const backendOperationsIntelligence = getBackendOperationsIntelligence();
  const backendOperationsMarketAnalysis = getBackendOperationsMarketAnalysis();
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
    frontendMarketSignalCount: frontendVisualIntelligence.marketSignalCount,
    frontendSurfaceArchetypeCount: frontendVisualIntelligence.surfaceArchetypeCount,
    frontendRepositoryReferenceCount: frontendVisualIntelligence.repositoryReferenceCount,
    backendSignalCount: backendOperationsIntelligence.signalCount,
    backendReliabilityPrimitiveCount: backendOperationsIntelligence.primitiveCount,
    selfRepairLevelCount: backendOperationsIntelligence.repairLevelCount,
    backendMarketSignalCount: backendOperationsMarketAnalysis.marketSignalCount,
    backendWorkloadArchetypeCount: backendOperationsMarketAnalysis.workloadArchetypeCount,
    backendIndustryMapCount: backendOperationsMarketAnalysis.industryMapCount,
    productionThirdPartyExecutionCount: 0,
    sourceLeads: SOURCE_LEADS.map((item) => ({ ...item, blockedUses: item.blockedUses ? [...item.blockedUses] : [] })),
    patterns: PLATFORM_PATTERNS.map((item) => ({ ...item })),
    agentRoles: AGENT_ROLES.map((item) => ({ ...item })),
    businessApplications: BUSINESS_APPLICATIONS.map((item) => ({ ...item })),
    skills: SKILLS.map((item) => ({ ...item, steps: [...item.steps] })),
    marketIntelligence,
    frontendVisualIntelligence,
    backendOperationsIntelligence,
    backendOperationsMarketAnalysis,
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
  planWorkflowSequence,
  replayWorkflowTrace,
  replayScopedWorkflowTrace,
  evaluateWorkflowRetry,
  getSeptember19PatternConvergence
};