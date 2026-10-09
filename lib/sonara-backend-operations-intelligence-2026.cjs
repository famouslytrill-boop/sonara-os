// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Backend Operations Research Pass #3.
//
// This module translates dated 2026 reliability, distributed-systems, AI-agent,
// database, payment, observability, deployment, retrieval, and policy evidence
// into SONARA-owned architecture contracts. It is research/control-plane data
// only: importing it must never install software, start a worker, mutate
// infrastructure, deploy code, authorize an agent, move money, or repair
// production automatically.

const BACKEND_RESEARCH_DATE = "2026-09-30";
const BACKEND_INTELLIGENCE_VERSION = "1.1.0";

const BACKEND_SIGNALS_2026 = Object.freeze([
  signal({
    key: "idempotent_mutation_contract",
    domain: "distributed_systems",
    source: "AWS Well-Architected — Make mutating operations idempotent",
    sourceUrl: "https://docs.aws.amazon.com/wellarchitected/2025-02-25/framework/rel_prevent_interaction_failure_idempotent.html",
    finding: "Mutating operations need stable idempotency tokens, persisted result state, concurrency control, downstream propagation, and duplicate-safe consumers.",
    sonaraUse: "Standardize organization-scoped idempotency across API mutations, workflow steps, events, payments, generation jobs, booking, ordering, delivery, refunds, and external adapters."
  }),
  signal({
    key: "bounded_failure_mitigation",
    domain: "reliability",
    source: "AWS Well-Architected — Distributed-system failure mitigation",
    sourceUrl: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/design-interactions-in-a-distributed-system-to-mitigate-or-withstand-failures.html",
    finding: "Graceful degradation, throttling, bounded retries, finite queues, client timeouts, statelessness where practical, and emergency levers reduce cascading failures and recovery time.",
    sonaraUse: "Make overload behavior explicit: throttle, defer, shed, isolate, or degrade before a dependency failure becomes a platform failure."
  }),
  signal({
    key: "agent_task_idempotency",
    domain: "agentic_ai",
    source: "AWS Well-Architected Agentic AI Lens — Idempotent task execution",
    sourceUrl: "https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentrel06-bp04.html",
    finding: "Agent retries are safe only when deterministic idempotency keys are derived from logical operation inputs and propagated through multi-step workflows.",
    sonaraUse: "The model never invents retry identity. SONARA derives stable operation identity from tenant, workflow, action type, resource and normalized request inputs."
  }),
  signal({
    key: "orchestrator_self_healing",
    domain: "runtime_orchestration",
    source: "Kubernetes — Self-Healing",
    sourceUrl: "https://kubernetes.io/docs/concepts/architecture/self-healing/",
    finding: "Infrastructure self-healing is desired-state reconciliation: restart failed containers, replace failed replicas, reattach storage, and stop routing traffic to unhealthy endpoints.",
    sonaraUse: "Adopt desired-state reconciliation for infrastructure and workers, while keeping application-logic and authority-changing repair behind branch, test, review and release gates."
  }),
  signal({
    key: "cloud_native_backend_standardization",
    domain: "platform_engineering",
    source: "CNCF — Annual Cloud Native Survey 2026",
    sourceUrl: "https://www.cncf.io/reports/the-cncf-annual-cloud-native-survey/",
    finding: "CNCF reports 82% of container users running Kubernetes in production and 66% of organizations hosting generative-AI models using Kubernetes for some or all inference workloads.",
    sonaraUse: "Keep SONARA portable across cloud-native deployment targets and design runtime health, reconciliation, telemetry and progressive delivery as standard contracts rather than provider-specific afterthoughts."
  }),
  signal({
    key: "agent_accuracy_gap",
    domain: "agentic_ai",
    source: "Stanford HAI — 2026 AI Index, Technical Performance",
    sourceUrl: "https://hai.stanford.edu/ai-index/2026-ai-index-report/technical-performance",
    finding: "Stanford reports major gains in computer-use agents while noting agents still fail roughly one in three attempts on structured benchmarks.",
    sonaraUse: "Assume model output can be wrong even when infrastructure is healthy; require independent verification, deterministic policy, bounded authority, evidence and safe recovery around agent actions."
  }),
  signal({
    key: "postgres_native_queue",
    domain: "events_and_queues",
    source: "Supabase — Queues",
    sourceUrl: "https://supabase.com/docs/guides/queues",
    finding: "A durable Postgres-native queue can provide persisted message delivery, visibility windows, archival and database-native access controls.",
    sonaraUse: "Evaluate the existing event-outbox foundation against Supabase Queues before adding another broker; preserve organization scope, visibility timeout, retry ceiling and dead-letter evidence."
  }),
  signal({
    key: "database_tenant_policy",
    domain: "tenant_security",
    source: "Supabase — Row Level Security",
    sourceUrl: "https://supabase.com/docs/guides/database/postgres/row-level-security",
    finding: "PostgreSQL row-level policy is an enforceable data-boundary primitive when policies, roles and service access are configured correctly.",
    sonaraUse: "Keep RLS as defense in depth for tenant data; request-supplied organization identifiers never replace authenticated membership and server-side authorization."
  }),
  signal({
    key: "vendor_neutral_observability",
    domain: "observability",
    source: "OpenTelemetry — Documentation",
    sourceUrl: "https://opentelemetry.io/docs/",
    finding: "OpenTelemetry provides vendor-neutral traces, metrics, logs, context propagation and collector patterns.",
    sonaraUse: "Use one correlation model across HTTP, jobs, agents, provider calls, payments, database operations and user-visible workflows so failures can be reconstructed end to end."
  }),
  signal({
    key: "database_ha_tradeoffs",
    domain: "database_scaling",
    source: "PostgreSQL 17 — High Availability, Load Balancing, and Replication",
    sourceUrl: "https://www.postgresql.org/docs/17/high-availability.html",
    finding: "High availability, replication and load balancing are separate mechanisms with latency, consistency and recovery tradeoffs.",
    sonaraUse: "Scale PostgreSQL from measured read/write pressure and recovery objectives; do not treat replicas as authority for freshness-sensitive writes or tenant authorization."
  }),
  signal({
    key: "payment_retry_safety",
    domain: "payments",
    source: "Stripe — Idempotent requests",
    sourceUrl: "https://docs.stripe.com/api/idempotent_requests",
    finding: "Stripe supports idempotency keys for safely retrying POST mutations without duplicate effects and replays the first recorded result for the same key.",
    sonaraUse: "Propagate SONARA operation identity into provider idempotency mechanisms and reconcile provider events into a canonical payment state machine."
  }),
  signal({
    key: "supply_chain_ci_hardening",
    domain: "software_supply_chain",
    source: "GitHub Docs — Security for GitHub Actions",
    sourceUrl: "https://docs.github.com/en/actions/how-tos/secure-your-work",
    finding: "Workflow hardening requires least privilege, careful third-party action use, secret boundaries and reviewable automation.",
    sonaraUse: "Keep exact-head CI, immutable action pins, scoped tokens, dependency evidence, artifact provenance and explicit production environments as release prerequisites."
  }),
  signal({
    key: "event_delivery_semantics",
    domain: "event_streaming",
    source: "Apache Kafka 4.1 — KafkaProducer",
    sourceUrl: "https://kafka.apache.org/41/javadoc/org/apache/kafka/clients/producer/KafkaProducer.html",
    finding: "Producer idempotence and transactions can strengthen delivery semantics, but application-level side effects still require explicit transactional and idempotency boundaries.",
    sonaraUse: "Treat brokers as transport, not business correctness. Keep business effects replay-safe and tenant-scoped whether transport is Postgres outbox, queue, Kafka or another provider."
  }),
  signal({
    key: "rag_exact_vs_approximate",
    domain: "rag_and_search",
    source: "pgvector — Vector similarity search for Postgres",
    sourceUrl: "https://github.com/pgvector/pgvector",
    finding: "Exact nearest-neighbor search and approximate indexes such as HNSW/IVFFlat have different latency, memory and recall tradeoffs.",
    sonaraUse: "Benchmark retrieval on tenant-filtered domain datasets and measure recall, groundedness, citation coverage, p95 latency and cost instead of assuming the fastest index is the most accurate."
  }),
  signal({
    key: "performance_as_release_gate",
    domain: "performance_testing",
    source: "Grafana k6 — Thresholds",
    sourceUrl: "https://grafana.com/docs/k6/latest/using-k6/thresholds/",
    finding: "Load-test thresholds turn latency and error-rate objectives into pass/fail release criteria.",
    sonaraUse: "Add scenario-specific thresholds for auth, CRUD, search/RAG, checkout, booking, ordering, webhook ingestion, event consumption and media-control APIs before scale claims."
  }),
  signal({
    key: "progressive_delivery",
    domain: "deployment",
    source: "Argo Rollouts — Canary",
    sourceUrl: "https://argo-rollouts.readthedocs.io/en/stable/features/canary/",
    finding: "Progressive delivery can move traffic in controlled steps rather than replacing an entire healthy version at once.",
    sonaraUse: "Use canary/preview evidence and automatic rollback signals for reversible deployments; never treat a green deploy mechanism as permission to activate a risky capability."
  }),
  signal({
    key: "policy_as_code",
    domain: "authorization",
    source: "Open Policy Agent — REST API",
    sourceUrl: "https://www.openpolicyagent.org/docs/rest-api",
    finding: "Policy decisions can be separated from application code and evaluated through a dedicated policy engine interface.",
    sonaraUse: "Keep agent/tool/provider permissions declarative and independently testable; policy evaluation cannot grant a tenant, payment, publication or infrastructure authority the caller does not already possess."
  }),
  signal({
    key: "ai_risk_governance",
    domain: "ai_governance",
    source: "NIST — AI Risk Management Framework and Generative AI Profile",
    sourceUrl: "https://www.nist.gov/itl/ai-risk-management-framework",
    finding: "AI risk management requires governance, measurement, monitoring and treatment across the lifecycle rather than a single model-safety check.",
    sonaraUse: "Separate model evaluation, policy guardrails, runtime monitoring, provenance, incident evidence and human approval instead of collapsing them into one agent score."
  }),
  signal({
    key: "ai_secure_development",
    domain: "secure_development",
    source: "NIST — Secure Software Development Practices for Generative AI",
    sourceUrl: "https://www.nist.gov/publications/secure-software-development-practices-generative-ai-and-dual-use-foundation-models-ssdf",
    finding: "Generative-AI development needs security practices across model, data, software supply chain, deployment and operations.",
    sonaraUse: "Treat prompts, tools, retrieval stores, model/provider configuration, evaluation datasets and agent policies as governed software assets with change evidence."
  }),
  signal({
    key: "strong_local_consistency",
    domain: "stateful_edge",
    source: "Cloudflare — Durable Objects storage",
    sourceUrl: "https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/",
    finding: "Strongly consistent per-object state can simplify coordination for workloads that need serialized mutation and colocated state.",
    sonaraUse: "Use strongly coordinated state only for workloads that need it, such as a room/session/device coordinator; do not replace canonical Postgres records without an explicit recovery and reconciliation model."
  })
]);

const RELIABILITY_PRIMITIVES = Object.freeze([
  primitive("request_identity", "Stable request, correlation and organization identity across every hop."),
  primitive("idempotency", "Deterministic duplicate suppression and same-result retry behavior for side effects."),
  primitive("transactional_outbox_inbox", "Commit business state and event intent atomically; deduplicate consumers before side effects."),
  primitive("bounded_retry", "Retry only classified transient failures with ceilings, delay, jitter policy and deadlines."),
  primitive("timeouts_deadlines", "Every network, provider, worker and agent action has an explicit time budget."),
  primitive("backpressure", "Bound queue depth and concurrency; throttle, defer or shed work before saturation cascades."),
  primitive("bulkhead_isolation", "Partition failure domains by tenant, workload class, provider and worker pool where justified."),
  primitive("circuit_breaker", "Stop hammering a failing dependency and probe recovery deliberately."),
  primitive("dead_letter_evidence", "Retain failed event identity, reason, attempts and remediation state without leaking secrets."),
  primitive("desired_state_reconciliation", "Repair drift toward an explicit desired state rather than issuing ad-hoc mutations."),
  primitive("health_readiness", "Separate process liveness, dependency readiness and end-to-end capability health."),
  primitive("progressive_delivery", "Canary changes, evaluate service metrics and roll back when evidence violates thresholds."),
  primitive("observability", "Correlated traces, metrics, logs, audit events and business outcomes."),
  primitive("slo_error_budget", "Define success, latency, durability and recovery objectives with measurable burn."),
  primitive("load_fault_testing", "Test normal load, spike, soak, dependency failure, retry storms and degraded modes."),
  primitive("tenant_policy", "Authenticate actor membership and enforce tenant policy at application and database layers."),
  primitive("provider_reconciliation", "Treat third-party state as external evidence reconciled into canonical SONARA state."),
  primitive("rag_evaluation", "Measure retrieval recall, grounding, citation coverage, latency and cost on fixed benchmarks."),
  primitive("release_evidence", "Tie tested source SHA, migrations, dependency state, artifacts and deployment evidence together.")
]);

const SELF_REPAIR_LEVELS = Object.freeze([
  repairLevel(0, "observe", "Detect, classify and record. No mutation."),
  repairLevel(1, "retry_or_noop", "Replay a deterministic idempotent operation or return its prior successful result."),
  repairLevel(2, "runtime_reconcile", "Restart, requeue, reroute, pause, drain, refresh cache, replace an unhealthy replica, or restore desired runtime state inside pre-approved bounds."),
  repairLevel(3, "progressive_rollback", "Stop rollout, shift traffic, disable a feature flag, or roll back a reversible change when objective evidence fails."),
  repairLevel(4, "branch_repair", "Generate or apply a code/config/schema repair only on an isolated branch; require tests, security checks, exact-head CI and review before merge."),
  repairLevel(5, "authority_change", "Production secrets, access policy, destructive data repair, irreversible migration, regulated action, money movement or widened agent authority require explicit human authorization.")
]);

const REFERENCE_REPOSITORIES = Object.freeze([
  repository("kubernetes/kubernetes", "runtime_reconciliation", "review_before_adoption"),
  repository("argoproj/argo-rollouts", "progressive_delivery_and_metric_gated_rollback", "review_before_adoption"),
  repository("open-telemetry/opentelemetry-js", "vendor_neutral_telemetry", "review_before_adoption"),
  repository("supabase/supabase", "postgres_platform_queues_auth_storage_reference", "already_selected_platform_review_components_individually"),
  repository("pgvector/pgvector", "postgres_vector_retrieval", "review_before_adoption"),
  repository("open-policy-agent/opa", "policy_as_code_reference", "review_before_adoption"),
  repository("apache/kafka", "high_throughput_event_streaming_reference", "adopt_only_if_measured_load_requires"),
  repository("grafana/k6", "load_and_slo_threshold_testing", "licence_and_distribution_review_required")
]);

const SHARED_BACKEND_SURFACES = Object.freeze([
  surface("agentic_ai_llm_rag", ["identity", "tool authority", "workflow state", "retrieval", "evaluation", "memory", "cost", "observability", "approval"]),
  surface("small_and_large_business_management", ["organizations", "roles", "customers", "projects", "tasks", "files", "billing", "analytics", "automation"]),
  surface("restaurant_pos_kiosk_reservations_rsvp", ["menu", "inventory", "orders", "tables", "bookings", "payments", "refunds", "kiosk sessions", "delivery", "loyalty"]),
  surface("trucking_delivery_field_trades_cleaning_waste", ["jobs", "dispatch", "routes", "GPS evidence", "assets", "maintenance", "estimates", "invoices", "offline sync"]),
  surface("retail_ecommerce_marketplaces", ["catalog", "inventory reservation", "orders", "returns", "subscriptions", "seller profiles", "trust", "search"]),
  surface("creator_social_streaming_media_books_podcasts", ["assets", "projects", "timelines", "rights", "moderation", "publishing", "stream state", "subscriptions", "analytics"]),
  surface("manufacturing_robotics_cad_3d_printing", ["BOM", "work orders", "quality", "telemetry", "maintenance", "asset metadata", "specialist machine adapters"]),
  surface("real_estate_rental_jobs_dating_venues", ["listings", "profiles", "availability", "applications", "booking", "messaging", "payments", "moderation", "consent"]),
  surface("finance_banking_investment_insurance", ["account references", "ledger/reconciliation", "budgets", "risk inputs", "approvals", "audit", "regulated provider adapters"]),
  surface("education_translation_public_access_government", ["identity", "content", "records", "accessibility", "scheduling", "notifications", "retention", "audit"]),
  surface("gaming_3d_ar_device_media", ["sessions", "entitlements", "assets", "realtime state", "telemetry", "GPU jobs", "performance budgets", "device permissions"]),
  surface("websites_apps_seo_campaigns_customer_service", ["content", "forms", "contacts", "conversations", "campaign state", "search metadata", "attribution", "support outcomes"])
]);

const IMPLEMENTATION_SEQUENCE = Object.freeze([
  "measure_baseline_p50_p95_p99_error_rate_saturation_and_recovery_time",
  "standardize_tenant_scoped_operation_identity_and_idempotency",
  "make_outbox_inbox_consumers_replay_safe_with_visibility_timeout_and_dead_letter_evidence",
  "add_bounded_retry_timeout_circuit_breaker_backpressure_and_bulkhead_contracts",
  "unify_trace_metric_log_audit_and_business_outcome_correlation",
  "define_service_and_workflow_slos_with_load_and_fault_thresholds",
  "add_desired_state_reconciliation_for_safe_runtime_recovery",
  "add_progressive_delivery_and_objective_automatic_rollback",
  "benchmark_rag_exact_and_approximate_retrieval_for_recall_grounding_latency_and_cost",
  "make_provider_payment_subscription_booking_order_and_refund_reconciliation_explicit",
  "prove_one_tenant_canary_then_expand_by_workload_class",
  "permit_code_or_schema_self_repair_only_as_branch_changes_behind_full_release_gates"
]);

// Product-specific workflows borrow operational lessons from commerce,
// creator distribution, and customer-growth platforms without cloning their
// services or assuming any provider is connected. These are pure contracts:
// they describe the state path and required evidence; persistence, permissions,
// and external effects remain owned by their respective application services.
const PRODUCT_WORKFLOW_CONTRACTS = Object.freeze({
  business_builder: workflow({
    product: "Business Builder",
    pattern: "order_and_job_lifecycle",
    states: ["captured", "scoped", "scheduled", "in_progress", "awaiting_payment", "fulfilled", "reconciled", "canceled"],
    transitions: {
      captured: ["scoped", "canceled"], scoped: ["scheduled", "canceled"],
      scheduled: ["in_progress", "canceled"], in_progress: ["awaiting_payment", "fulfilled", "canceled"],
      awaiting_payment: ["fulfilled", "canceled"], fulfilled: ["reconciled"], reconciled: [], canceled: []
    },
    evidenceByTarget: {
      scoped: ["scope_record"], scheduled: ["schedule_record"], in_progress: ["assigned_operator"],
      awaiting_payment: ["fulfillment_record"], fulfilled: ["fulfillment_record"],
      reconciled: ["payment_reconciliation"]
    },
    sensitiveTargets: ["awaiting_payment", "fulfilled", "reconciled"]
  }),
  creator_studio: workflow({
    product: "Creator Studio",
    pattern: "rights_aware_release_lifecycle",
    states: ["idea", "working", "in_review", "rights_cleared", "approved", "packaged", "published", "archived"],
    transitions: {
      idea: ["working", "archived"], working: ["in_review", "archived"],
      in_review: ["working", "rights_cleared"], rights_cleared: ["working", "approved"],
      approved: ["working", "packaged"], packaged: ["working", "published"],
      published: ["archived"], archived: []
    },
    evidenceByTarget: {
      in_review: ["project_manifest"], rights_cleared: ["asset_rights_records"],
      approved: ["owner_approval"], packaged: ["export_validation"], published: ["provider_receipt"]
    },
    sensitiveTargets: ["published"]
  }),
  growth_studio: workflow({
    product: "Growth Studio",
    pattern: "consent_gated_campaign_lifecycle",
    states: ["draft", "audience_validated", "consent_checked", "previewed", "approved", "scheduled", "dispatched", "measured", "paused"],
    transitions: {
      draft: ["audience_validated", "paused"], audience_validated: ["consent_checked", "draft", "paused"],
      consent_checked: ["previewed", "draft", "paused"], previewed: ["approved", "draft", "paused"],
      approved: ["scheduled", "dispatched", "paused"], scheduled: ["dispatched", "paused"],
      dispatched: ["measured", "paused"], measured: ["draft", "paused"], paused: ["draft"]
    },
    evidenceByTarget: {
      audience_validated: ["audience_snapshot"], consent_checked: ["consent_evaluation"],
      previewed: ["campaign_preview"], approved: ["owner_approval"],
      scheduled: ["schedule_record"], dispatched: ["provider_receipt"], measured: ["outcome_record"]
    },
    sensitiveTargets: ["dispatched"]
  })
});

function workflow(input) {
  return Object.freeze({
    ...input,
    states: Object.freeze([...input.states]),
    transitions: Object.freeze(Object.fromEntries(Object.entries(input.transitions).map(([key, values]) => [key, Object.freeze([...values])]))),
    evidenceByTarget: Object.freeze(Object.fromEntries(Object.entries(input.evidenceByTarget).map(([key, values]) => [key, Object.freeze([...values])]))),
    sensitiveTargets: Object.freeze([...input.sensitiveTargets])
  });
}

function evaluateProductWorkflowTransition(input = {}) {
  const contract = PRODUCT_WORKFLOW_CONTRACTS[String(input.product || "").toLowerCase().replace(/[ -]/g, "_")];
  if (!contract) return Object.freeze({ allowed: false, reason: "unknown_product_workflow" });
  const from = String(input.from || "");
  const to = String(input.to || "");
  if (!contract.states.includes(from) || !contract.states.includes(to)) {
    return Object.freeze({ allowed: false, reason: "unknown_workflow_state" });
  }
  if (!contract.transitions[from].includes(to)) {
    return Object.freeze({ allowed: false, reason: "transition_not_allowed", product: contract.product, from, to });
  }
  const evidence = input.evidence && typeof input.evidence === "object" ? input.evidence : {};
  const missingEvidence = (contract.evidenceByTarget[to] || []).filter((key) => !evidence[key]);
  if (missingEvidence.length) {
    return Object.freeze({ allowed: false, reason: "required_evidence_missing", product: contract.product, from, to, missingEvidence });
  }
  if (contract.sensitiveTargets.includes(to) && !isApprovalEvidence(evidence.owner_approval)) {
    return Object.freeze({ allowed: false, reason: "owner_approval_required", product: contract.product, from, to, missingEvidence: ["owner_approval"] });
  }
  return Object.freeze({ allowed: true, reason: "contract_checks_passed", product: contract.product, from, to, requiredEvidence: [...(contract.evidenceByTarget[to] || [])] });
}

function isApprovalEvidence(value) {
  return Boolean(value && typeof value === "object"
    && String(value.approvalId || "").trim()
    && String(value.approvedBy || "").trim()
    && value.approved === true);
}

function signal(input) {
  return Object.freeze({
    ...input,
    asOf: BACKEND_RESEARCH_DATE,
    runtimeAuthority: "none",
    productionCapability: false
  });
}

function primitive(key, purpose) {
  return Object.freeze({ key, purpose, status: "architecture_contract" });
}

function repairLevel(level, key, boundary) {
  return Object.freeze({ level, key, boundary });
}

function repository(name, use, status) {
  return Object.freeze({
    name,
    use,
    status,
    installedByResearch: false,
    enabledInProduction: false
  });
}

function surface(key, primitives) {
  return Object.freeze({ key, primitives: Object.freeze([...primitives]) });
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

function nonNegativeInteger(value, field) {
  const number = finite(value, field);
  if (!Number.isInteger(number) || number < 0) throw new RangeError(`${field} must be a non-negative integer`);
  return number;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function backendReliabilityScore(input = {}) {
  const availability = unit(input.availability, "availability");
  const correctness = unit(input.correctness, "correctness");
  const recoveryCoverage = unit(input.recoveryCoverage, "recoveryCoverage");
  const observabilityCoverage = unit(input.observabilityCoverage, "observabilityCoverage");
  const latencyMs = Math.max(0, finite(input.latencyP95Ms, "latencyP95Ms"));
  const latencyBudgetMs = positive(input.latencyBudgetMs, "latencyBudgetMs");
  const latencyFit = 1 - Math.min(latencyMs / latencyBudgetMs, 1);

  return round(
    0.25 * availability +
    0.25 * correctness +
    0.15 * latencyFit +
    0.20 * recoveryCoverage +
    0.15 * observabilityCoverage
  );
}

function retryDelayMs(input = {}) {
  const baseMs = positive(input.baseMs, "baseMs");
  const attempt = nonNegativeInteger(input.attempt, "attempt");
  const maxMs = positive(input.maxMs, "maxMs");
  return Math.round(Math.min(maxMs, baseMs * (2 ** attempt)));
}

function sloBudgetState(input = {}) {
  const total = nonNegativeInteger(input.totalRequests, "totalRequests");
  const failed = nonNegativeInteger(input.failedRequests, "failedRequests");
  const targetSuccessRate = unit(input.targetSuccessRate, "targetSuccessRate");
  if (failed > total) throw new RangeError("failedRequests cannot exceed totalRequests");
  if (total === 0) {
    return Object.freeze({
      actualSuccessRate: 1,
      allowedFailures: 0,
      remainingFailures: 0,
      budgetState: "no_traffic"
    });
  }
  const actualSuccessRate = (total - failed) / total;
  const allowedFailures = Math.floor(total * (1 - targetSuccessRate));
  const remainingFailures = Math.max(0, allowedFailures - failed);
  return Object.freeze({
    actualSuccessRate: round(actualSuccessRate),
    allowedFailures,
    remainingFailures,
    budgetState: actualSuccessRate >= targetSuccessRate ? "within_budget" : "exhausted"
  });
}

function repairAuthorityDecision(input = {}) {
  const evidenceFreshness = unit(input.evidenceFreshness, "evidenceFreshness");
  const blastRadius = unit(input.blastRadius, "blastRadius");
  const tenantScoped = Boolean(input.tenantScoped);
  const deterministic = Boolean(input.deterministic);
  const reversible = Boolean(input.reversible);
  const changesCode = Boolean(input.changesCode);
  const changesSchema = Boolean(input.changesSchema);
  const changesAuthority = Boolean(input.changesAuthority);
  const movesMoney = Boolean(input.movesMoney);
  const destructive = Boolean(input.destructive);

  if (!tenantScoped) return Object.freeze({ allowed: false, mode: "blocked", reason: "tenant_scope_not_proven" });
  if (changesAuthority || movesMoney || destructive) {
    return Object.freeze({ allowed: false, mode: "human_authorization_required", reason: "sensitive_authority_boundary" });
  }
  if (changesCode || changesSchema) {
    return Object.freeze({ allowed: false, mode: "branch_repair_required", reason: "source_or_schema_change" });
  }
  if (evidenceFreshness < 0.8) return Object.freeze({ allowed: false, mode: "observe_only", reason: "evidence_too_stale" });
  if (!deterministic || !reversible) return Object.freeze({ allowed: false, mode: "observe_only", reason: "repair_not_proven_safe" });
  if (blastRadius > 0.1) return Object.freeze({ allowed: false, mode: "approval_required", reason: "blast_radius_too_large" });

  return Object.freeze({ allowed: true, mode: "bounded_runtime_recovery", reason: "preapproved_reversible_reconciliation" });
}

// Pure operational control-plane decisions. These never send a signal, stop a
// process, change configuration, delete a file, or override a release gate.
const OPERATIONAL_MODES = Object.freeze(["active", "paused", "maintenance", "lockdown", "offline"]);
const OPERATIONAL_TRANSITIONS = Object.freeze({
  active: Object.freeze(["paused", "maintenance", "lockdown", "offline"]),
  paused: Object.freeze(["active", "maintenance", "lockdown", "offline"]),
  maintenance: Object.freeze(["paused", "active", "lockdown", "offline"]),
  lockdown: Object.freeze(["paused"]),
  offline: Object.freeze(["paused"])
});
const MAINTENANCE_ACTIONS = Object.freeze([
  "security_scan", "debug_diagnostics", "backup_verification",
  "isolated_restore_drill", "cache_cleanup_review", "retention_purge_review",
  "vacuum_analyze_review", "reindex_review", "disk_defragmentation", "service_restart"
]);

function operationalTransitionDecision(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
  const from = input.from;
  const to = input.to;
  const deny = (reason) => Object.freeze({
    candidate: false, reason, from: from || null, to: to || null,
    transitionExecuted: false, releaseAuthorized: false, requiresDurableCompareAndSwap: true
  });
  if (!OPERATIONAL_MODES.includes(from) || !OPERATIONAL_MODES.includes(to)) return deny("unknown_operational_mode");
  if (from === to) return deny("no_op_transition");
  if (!OPERATIONAL_TRANSITIONS[from].includes(to)) return deny("transition_not_allowed");
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
      !Number.isSafeInteger(input.observedRevision) || input.observedRevision < 0 ||
      input.observedRevision >= Number.MAX_SAFE_INTEGER ||
      input.expectedRevision !== input.observedRevision) return deny("stale_or_missing_revision");
  if (input.scopeVerified !== true || !["tenant", "platform"].includes(input.scope)) return deny("scope_unverified");
  if (input.actorAuthorized !== true) return deny("operator_authority_unverified");
  if (input.bypassRequested === true || input.overrideReleaseGate === true ||
      input.ignoreSecurityIncident === true) return deny("policy_bypass_refused");
  if (input.ownerApproved !== true) return deny("owner_approval_required");

  if (to === "lockdown" && input.verifiedSecurityIncident !== true) return deny("incident_evidence_missing");
  if ((from === "lockdown" || from === "offline") &&
      (input.incidentClearedVerified !== true || input.recoveryVerified !== true))
    return deny("recovery_evidence_missing");
  if (to === "maintenance" && input.inFlightJobsDrained !== true) return deny("in_flight_jobs_not_drained");
  if (to === "active" &&
      (input.healthVerified !== true || input.releaseGatesVerified !== true ||
       input.incidentClearedVerified !== true))
    return deny("startup_release_or_health_unverified");
  if (to === "offline" && input.safeShutdownPlanReviewed !== true) return deny("shutdown_plan_unreviewed");
  if (to === "offline" && input.inFlightJobsDrained !== true) return deny("shutdown_jobs_not_drained");
  return Object.freeze({
    candidate: true, reason: "review_ready_transition",
    from, to, nextRevision: input.observedRevision + 1,
    transitionExecuted: false, releaseAuthorized: false,
    requiresDurableCompareAndSwap: true, requiresAuditReceipt: true
  });
}

// Replay proposed lifecycle receipts without executing the transition. This is
// an ordered ledger consistency check, NOT verification of signed approvals.
function reviewOperationalTransitionLedger(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Operational ledger input must be an object");
  }
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  const idPattern = /^[A-Za-z0-9:_-]{1,128}$/;
  const scope = input.scope;
  const organizationId = input.organizationId ?? null;
  if (scope !== "platform" && scope !== "tenant") throw new TypeError("Invalid operational ledger scope");
  if ((scope === "tenant" && (typeof organizationId !== "string" || !uuidPattern.test(organizationId))) ||
      (scope === "platform" && organizationId !== null)) {
    throw new TypeError("Invalid operational ledger organization scope");
  }
  if (!OPERATIONAL_MODES.includes(input.initialMode) ||
      !Number.isSafeInteger(input.initialRevision) || input.initialRevision < 0 ||
      input.initialRevision >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Invalid operational ledger origin");
  }
  if (!Array.isArray(input.events) || input.events.length > 512) {
    throw new RangeError("Operational ledger cannot exceed 512 events");
  }
  let mode = input.initialMode;
  let revision = input.initialRevision;
  let lastTimeMs = -1;
  let duplicates = 0;
  const seenEvents = new Map();
  const usedApprovals = new Set();
  for (const event of input.events) {
    if (!event || typeof event !== "object" || Array.isArray(event) ||
        typeof event.eventId !== "string" || !idPattern.test(event.eventId) ||
        typeof event.actorId !== "string" || !uuidPattern.test(event.actorId) ||
        event.scope !== scope || (event.organizationId ?? null) !== organizationId ||
        !Number.isSafeInteger(event.revision) || event.revision < 1 ||
        !Number.isSafeInteger(event.occurredAtMs) || event.occurredAtMs < 0 ||
        !event.evidence || typeof event.evidence !== "object" || Array.isArray(event.evidence) ||
        !event.approval || typeof event.approval !== "object" || Array.isArray(event.approval)) {
      throw new TypeError("Invalid operational ledger event");
    }
    const a = event.approval;
    if (typeof a.approvalId !== "string" || !idPattern.test(a.approvalId) ||
        typeof a.approvedBy !== "string" || !uuidPattern.test(a.approvedBy) ||
        a.scope !== scope || (a.organizationId ?? null) !== organizationId ||
        a.from !== event.from || a.to !== event.to ||
        a.expectedRevision !== event.revision - 1 ||
        !Number.isSafeInteger(a.issuedAtMs) || a.issuedAtMs < 0 ||
        !Number.isSafeInteger(a.expiresAtMs) || a.expiresAtMs < a.issuedAtMs ||
        a.expiresAtMs - a.issuedAtMs > 900000 ||
        a.issuedAtMs > event.occurredAtMs || a.expiresAtMs < event.occurredAtMs) {
      throw new RangeError("Stale, cross-scope or unbound operational approval");
    }
    // Ignore unknown untrusted event fields, but bind the fields used in replay.
    const receipt = JSON.stringify([
      event.eventId, event.actorId, event.scope, event.organizationId ?? null,
      event.from, event.to, event.revision, event.occurredAtMs,
      a.approvalId, a.approvedBy, a.scope, a.organizationId ?? null,
      a.from, a.to, a.expectedRevision, a.issuedAtMs, a.expiresAtMs,
      ...["scopeVerified", "actorAuthorized", "verifiedSecurityIncident",
        "incidentClearedVerified", "recoveryVerified", "inFlightJobsDrained",
        "healthVerified", "releaseGatesVerified", "safeShutdownPlanReviewed",
        "bypassRequested", "overrideReleaseGate", "ignoreSecurityIncident"]
        .map((key) => event.evidence[key] === true)
    ]);
    if (seenEvents.has(event.eventId)) {
      if (seenEvents.get(event.eventId) !== receipt) {
        throw new RangeError("Conflicting operational event replay");
      }
      duplicates++;
      continue;
    }
    if (usedApprovals.has(a.approvalId)) throw new RangeError("Operational approval reused for another event");
    if (event.from !== mode || event.revision !== revision + 1 ||
        event.occurredAtMs < lastTimeMs) {
      throw new RangeError("Out-of-order operational state transition");
    }
    // Scope, actor permission and all contextual evidence must be supplied by
    // a trusted server, never by customer parameters or an unsigned event.
    const decision = operationalTransitionDecision({
      ...event.evidence,
      from: event.from, to: event.to, scope,
      expectedRevision: revision, observedRevision: revision,
      ownerApproved: true
    });
    if (!decision.candidate || decision.nextRevision !== event.revision) {
      throw new RangeError("Operational transition refused: " + decision.reason);
    }
    seenEvents.set(event.eventId, receipt);
    usedApprovals.add(a.approvalId);
    mode = event.to;
    revision = event.revision;
    lastTimeMs = event.occurredAtMs;
  }
  return Object.freeze({
    scope, organizationId, mode, revision,
    acceptedEvents: seenEvents.size, replayedEvents: duplicates,
    transitionExecuted: false, authorizationVerified: false,
    durableConsistencyProven: false
  });
}

// No arbitrary command, paths, SQL, scanner arguments or file names accepted.
function maintenanceActionDecision(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
  const action = input.action;
  const deny = (reason, review = false) => Object.freeze({
    candidate: false, reason, action: action || null,
    ownerReviewRequired: review, executed: false, dataDeleted: false,
    commandIssued: false
  });
  if (!MAINTENANCE_ACTIONS.includes(action)) return deny("unknown_maintenance_action");
  if (input.command !== undefined || input.path !== undefined || input.force === true ||
      input.bypassRequested === true) return deny("arbitrary_command_or_bypass_refused");
  if (input.scopeVerified !== true || input.actorAuthorized !== true) return deny("operator_scope_unverified");
  if (!OPERATIONAL_MODES.includes(input.mode)) return deny("unknown_operational_mode");
  if (!Number.isSafeInteger(input.maxItems) || input.maxItems < 1 || input.maxItems > 1000 ||
      !Number.isSafeInteger(input.maxDurationMs) || input.maxDurationMs < 1 ||
      input.maxDurationMs > 60000) return deny("unbounded_maintenance_budget");
  if (action === "service_restart") return deny("use_reviewed_operational_state_transition", true);
  if (action === "disk_defragmentation") return deny("cloud_storage_has_no_generic_defragment_operation", true);

  const readOnly = ["security_scan", "debug_diagnostics", "backup_verification"].includes(action);
  if (readOnly) return Object.freeze({
    candidate: true, reason: "bounded_read_only_review_ready",
    action, ownerReviewRequired: false, executed: false, dataDeleted: false, commandIssued: false,
    maxItems: input.maxItems, maxDurationMs: input.maxDurationMs
  });

  if (input.mode !== "maintenance") return deny("maintenance_mode_required", true);
  if (input.ownerApproved !== true) return deny("owner_approval_required", true);
  if (input.inFlightJobsDrained !== true) return deny("in_flight_jobs_not_drained", true);
  if (input.backupVerified !== true) return deny("backup_evidence_missing", true);
  if (input.legalHold === true || input.incidentEvidence === true) return deny("legal_or_incident_hold", true);
  if (action === "retention_purge_review") return deny("retention_policy_and_storage_authority_review_required", true);
  if (action === "isolated_restore_drill" && input.isolatedEnvironmentVerified !== true)
    return deny("isolated_restore_environment_missing", true);
  if (["vacuum_analyze_review", "reindex_review"].includes(action) &&
      (input.databaseMetricsVerified !== true || input.maintenanceWindowApproved !== true))
    return deny("database_metrics_or_window_missing", true);
  if (action === "reindex_review" && input.lockImpactReviewed !== true)
    return deny("database_lock_impact_unreviewed", true);
  if (action === "cache_cleanup_review" &&
      (input.cacheOnlyTargetsVerified !== true || input.retentionProtectedTargetsExcluded !== true))
    return deny("cache_scope_or_retention_protection_unverified", true);
  return Object.freeze({
    candidate: true, reason: "review_ready_maintenance_plan", action,
    ownerReviewRequired: true, executed: false, dataDeleted: false, commandIssued: false,
    maxItems: input.maxItems, maxDurationMs: input.maxDurationMs
  });
}

// A deduplicated, read-only alert recommendation. Alerting must be backed by
// trusted probe evidence and a separately authorized delivery adapter.
const OPERATIONAL_ALERT_SIGNALS = Object.freeze({
  security_bypass_attempt: "critical",
  storage_integrity_failed: "critical",
  tenant_boundary_violation: "critical",
  job_queue_stalled: "warning",
  provider_unavailable: "warning",
  backup_evidence_missing: "high",
  release_gate_failed: "high"
});
function operationalAlertDecision(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
  const severity = Object.hasOwn(OPERATIONAL_ALERT_SIGNALS, input.signal)
    ? OPERATIONAL_ALERT_SIGNALS[input.signal] : null;
  const deny = (reason) => Object.freeze({
    notifyCandidate: false, reason, signal: severity ? input.signal : null,
    severity, alertSent: false, shutdownExecuted: false, lockdownExecuted: false
  });
  if (!severity) return deny("unknown_alert_signal");
  if (input.scopeVerified !== true || input.evidenceVerified !== true) return deny("unverified_alert_evidence");
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0 ||
      !Number.isSafeInteger(input.consecutiveFailures) || input.consecutiveFailures < 0 ||
      input.consecutiveFailures > 10000 ||
      !Number.isSafeInteger(input.threshold) || input.threshold < 1 || input.threshold > 20 ||
      !Number.isSafeInteger(input.cooldownMs) || input.cooldownMs < 1000 ||
      input.cooldownMs > 86400000) return deny("invalid_alert_budget");
  if (input.lastAlertAtMs !== null && input.lastAlertAtMs !== undefined &&
      (!Number.isSafeInteger(input.lastAlertAtMs) || input.lastAlertAtMs < 0 ||
       input.lastAlertAtMs > input.nowMs)) return deny("invalid_last_alert_clock");
  if (!Number.isSafeInteger(input.nowMs + input.cooldownMs)) return deny("invalid_alert_budget");
  if (input.consecutiveFailures < input.threshold) return deny("below_alert_threshold");
  if (input.lastAlertAtMs !== null && input.lastAlertAtMs !== undefined &&
      input.nowMs - input.lastAlertAtMs < input.cooldownMs) return deny("alert_cooldown_active");
  return Object.freeze({
    notifyCandidate: true, reason: "review_ready_alert",
    signal: input.signal, severity,
    nextEligibleAlertAtMs: input.nowMs + input.cooldownMs,
    alertSent: false, shutdownExecuted: false, lockdownExecuted: false
  });
}

function ragQualityScore(input = {}) {
  const recall = unit(input.recall, "recall");
  const groundedness = unit(input.groundedness, "groundedness");
  const citationCoverage = unit(input.citationCoverage, "citationCoverage");
  const latencyMs = Math.max(0, finite(input.latencyP95Ms, "latencyP95Ms"));
  const latencyBudgetMs = positive(input.latencyBudgetMs, "latencyBudgetMs");
  const latencyFit = 1 - Math.min(latencyMs / latencyBudgetMs, 1);
  return round(0.35 * recall + 0.30 * groundedness + 0.25 * citationCoverage + 0.10 * latencyFit);
}

function getBackendOperationsIntelligence() {
  return {
    ok: true,
    version: BACKEND_INTELLIGENCE_VERSION,
    snapshotDate: BACKEND_RESEARCH_DATE,
    researchOnly: true,
    productionExecutionCount: 0,
    installedRepositoryCount: 0,
    signalCount: BACKEND_SIGNALS_2026.length,
    primitiveCount: RELIABILITY_PRIMITIVES.length,
    repairLevelCount: SELF_REPAIR_LEVELS.length,
    referenceRepositoryCount: REFERENCE_REPOSITORIES.length,
    sharedSurfaceCount: SHARED_BACKEND_SURFACES.length,
    productWorkflowContractCount: Object.keys(PRODUCT_WORKFLOW_CONTRACTS).length,
    signals: BACKEND_SIGNALS_2026.map((item) => ({ ...item })),
    reliabilityPrimitives: RELIABILITY_PRIMITIVES.map((item) => ({ ...item })),
    selfRepairLevels: SELF_REPAIR_LEVELS.map((item) => ({ ...item })),
    referenceRepositories: REFERENCE_REPOSITORIES.map((item) => ({ ...item })),
    sharedBackendSurfaces: SHARED_BACKEND_SURFACES.map((item) => ({ ...item, primitives: [...item.primitives] })),
    productWorkflowContracts: Object.fromEntries(Object.entries(PRODUCT_WORKFLOW_CONTRACTS).map(([key, value]) => [key, {
      ...value,
      states: [...value.states],
      transitions: Object.fromEntries(Object.entries(value.transitions).map(([state, transitions]) => [state, [...transitions]])),
      evidenceByTarget: Object.fromEntries(Object.entries(value.evidenceByTarget).map(([state, evidence]) => [state, [...evidence]])),
      sensitiveTargets: [...value.sensitiveTargets]
    }])),
    implementationSequence: [...IMPLEMENTATION_SEQUENCE],
    formulas: {
      backendReliabilityScore: "0.25*availability + 0.25*correctness + 0.15*latency_fit + 0.20*recovery_coverage + 0.15*observability_coverage",
      retryDelay: "min(max_delay, base_delay * 2^attempt)",
      actualSuccessRate: "(total_requests - failed_requests) / total_requests",
      ragQualityScore: "0.35*recall + 0.30*groundedness + 0.25*citation_coverage + 0.10*latency_fit"
    },
    architectureDecision: {
      systemOfRecord: "PostgreSQL/Supabase remains canonical unless a measured workload proves another authority model is required.",
      eventing: "Prefer the existing transactional event/outbox foundation; add a broker only when measured throughput, ordering or retention requirements justify it.",
      selfHealing: "Runtime reconciliation may repair only pre-approved, reversible, tenant-scoped operational drift. Code/schema/authority repair is branch-only and release-gated.",
      agents: "Models propose or execute only through SONARA-owned identity, policy, budgets, approvals, idempotency, verification and evidence.",
      verticals: "Industry products compose shared backend primitives instead of creating disconnected infrastructure stacks."
    },
    guardrails: [
      "Research records do not install or enable third-party repositories.",
      "No autonomous production worker, deployment, migration, payment, refund, publication, customer-data export, secret mutation or authority change is enabled here.",
      "Self-healing means desired-state reconciliation and bounded rollback, not unrestricted self-modifying production code.",
      "Code, schema and policy repairs occur on isolated branches and must pass the normal exact-head test, security, tenant and release gates.",
      "Exactly-once business effects are not assumed from transport; idempotency and reconciliation remain application responsibilities.",
      "Performance and scale claims require measured load-test and production evidence."
    ]
  };
}

module.exports = {
  BACKEND_RESEARCH_DATE,
  BACKEND_INTELLIGENCE_VERSION,
  BACKEND_SIGNALS_2026,
  RELIABILITY_PRIMITIVES,
  SELF_REPAIR_LEVELS,
  REFERENCE_REPOSITORIES,
  SHARED_BACKEND_SURFACES,
  PRODUCT_WORKFLOW_CONTRACTS,
  IMPLEMENTATION_SEQUENCE,
  backendReliabilityScore,
  retryDelayMs,
  sloBudgetState,
  repairAuthorityDecision,
  OPERATIONAL_MODES,
  OPERATIONAL_TRANSITIONS,
  MAINTENANCE_ACTIONS,
  OPERATIONAL_ALERT_SIGNALS,
  operationalTransitionDecision,
  reviewOperationalTransitionLedger,
  maintenanceActionDecision,
  operationalAlertDecision,
  ragQualityScore,
  evaluateProductWorkflowTransition,
  getBackendOperationsIntelligence
};
