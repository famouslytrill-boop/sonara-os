// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Backend Operations Research + Market Analysis Pass #6.
//
// This module converts current 2026 platform, reliability, AI-agent, commerce,
// mobile, field-service, fleet, observability and retrieval evidence into
// SONARA-owned backend architecture contracts. It is deliberately non-executing:
// importing it must never start a worker, deploy code, mutate infrastructure,
// move money, widen authority or install a third-party repository.

const BACKEND_MARKET_ANALYSIS_DATE = "2026-09-20";
const BACKEND_MARKET_ANALYSIS_VERSION = "1.2.0";

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
  }),
  signal({
    key: "durable_agent_execution_2026",
    domain: "agentic_workflows",
    source: "Cloudflare — Workflows and durable Agents",
    sourceUrl: "https://developers.cloudflare.com/workflows/",
    finding: "Current durable execution platforms persist multi-step progress, checkpoint work, retry bounded steps and pause for approvals or external events instead of depending on one long-lived request.",
    sonaraUse: "Treat long-running agent, reservation, fulfillment, media and integration jobs as persisted workflows with stable operation identity, checkpoints, deadlines and explicit human-event waits."
  }),
  signal({
    key: "postgres_queue_replay",
    domain: "queueing",
    source: "Supabase — Queues / PGMQ",
    sourceUrl: "https://supabase.com/docs/guides/queues",
    finding: "PostgreSQL-backed queues can expose visibility timeouts, explicit deletion and archival/replay semantics while remaining close to transactional application data.",
    sonaraUse: "Use queue transport semantics as delivery infrastructure only. Business effects must still be idempotent, tenant-scoped and independently reconciled."
  }),
  signal({
    key: "retry_only_when_safe",
    domain: "reliability",
    source: "Google Cloud — Retry strategy",
    sourceUrl: "https://cloud.google.com/storage/docs/retry-strategy",
    finding: "Retries are safe only when the failure is retryable and the operation is idempotent or protected by explicit preconditions; retrying non-idempotent effects can duplicate or conflict.",
    sonaraUse: "Classify retries by transient failure, idempotency, deadline, attempt ceiling and authority sensitivity instead of applying one generic retry loop."
  }),
  signal({
    key: "vector_recall_speed_tradeoff",
    domain: "rag_and_search",
    source: "pgvector — exact and approximate nearest-neighbor search",
    sourceUrl: "https://github.com/pgvector/pgvector",
    finding: "Exact vector search maximizes recall while HNSW and IVFFlat trade recall for speed, build time and memory in different ways.",
    sonaraUse: "Benchmark exact versus approximate retrieval on fixed tenant-scoped evaluation sets and promote an index only when recall, p95 latency and cost satisfy explicit thresholds."
  }),
  signal({
    key: "postgres18_replication",
    domain: "data_resilience",
    source: "PostgreSQL 18 — replication documentation",
    sourceUrl: "https://www.postgresql.org/docs/18/runtime-config-replication.html",
    finding: "PostgreSQL 18 continues to expose streaming and logical replication controls for availability, read scaling and downstream data movement.",
    sonaraUse: "Keep the transactional authority explicit; introduce replicas or logical subscribers for measured read, analytics or recovery needs without allowing projections to become accidental write authorities."
  }),
  signal({
    key: "slo_as_release_gate",
    domain: "performance_engineering",
    source: "Grafana k6 — thresholds",
    sourceUrl: "https://grafana.com/docs/k6/latest/using-k6/thresholds/",
    finding: "Performance thresholds can turn latency, error-rate and service-level objectives into executable pass/fail release evidence rather than dashboard-only observations.",
    sonaraUse: "Gate critical releases on workload-specific p95/p99 latency, error, saturation and business-outcome thresholds with enough samples to make promotion evidence meaningful."
  }),
  signal({
    key: "progressive_delivery_rollback",
    domain: "release_engineering",
    source: "Argo Rollouts — progressive delivery",
    sourceUrl: "https://argo-rollouts.readthedocs.io/",
    finding: "Canary and blue/green delivery can evaluate metrics during rollout and pause, promote or roll back based on explicit health evidence.",
    sonaraUse: "Separate deployment from promotion. Compare exact-SHA canary evidence against objective technical and business thresholds before widening traffic."
  }),
  signal({
    key: "policy_decision_auditability",
    domain: "policy_as_code",
    source: "Open Policy Agent — decision logs",
    sourceUrl: "https://www.openpolicyagent.org/docs/management-decision-logs",
    finding: "Policy decision logs can retain the query, input metadata, bundle identity and trace/decision identifiers needed to explain why a runtime authorization decision occurred.",
    sonaraUse: "Attach policy decision identity to sensitive agent, provider, payment, admin and repair actions so authority can be reconstructed independently from model or workflow logs."
  }),
  signal({
    key: "supply_chain_sha_pinning",
    domain: "software_supply_chain",
    source: "GitHub — secure use of GitHub Actions",
    sourceUrl: "https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions",
    finding: "GitHub recommends pinning third-party actions to full-length commit SHAs because a commit SHA is the immutable action reference.",
    sonaraUse: "Keep external CI actions SHA-pinned, review dependency changes and treat build/release configuration as part of the production trust boundary."
  }),
  signal({
    key: "trades_ai_integration_gap_2026",
    domain: "field_service_market",
    source: "ServiceTitan — 2026 State of AI in the Trades",
    sourceUrl: "https://www.servicetitan.com/resources/reports/ai-in-the-trades",
    finding: "ServiceTitan's 2026 contractor survey reports a gap between experimentation and embedded AI adoption, with training, integration complexity, comprehension and ROI among the stated barriers.",
    sonaraUse: "Win on guided implementation, measurable workflow outcomes and shared back-office primitives rather than exposing raw models or disconnected AI features."
  }),
  signal({
    key: "restaurant_grounded_ai_2026",
    domain: "restaurant_market",
    source: "Toast — Toast IQ and restaurant operating intelligence",
    sourceUrl: "https://pos.toasttab.com/products/toast-iq",
    finding: "Restaurant platforms increasingly ground operator intelligence in sales, labor, menu, guest and operating data instead of treating AI as a separate chat surface.",
    sonaraUse: "Build restaurant assistance over canonical order, labor, inventory, reservation, guest and fulfillment state with explicit action approvals and outcome measurement."
  }),
  signal({
    key: "agentic_commerce_2026",
    domain: "commerce_market",
    source: "Shopify — 2026 agentic commerce updates",
    sourceUrl: "https://www.shopify.com/news/agentic-commerce",
    finding: "AI-assisted product discovery and shopping are becoming material acquisition channels, while inventory, pricing, tax, payment, fraud and fulfillment still require canonical commerce systems.",
    sonaraUse: "Expose governed product and availability data to assistants while retaining SONARA-owned order identity, inventory reservation, payment reconciliation, permissions and audit."
  }),
  signal({
    key: "postgres_18_6_stable_2026",
    domain: "database_platform",
    source: "PostgreSQL — 18.6 release notes",
    sourceUrl: "https://www.postgresql.org/docs/release/18.6/",
    finding: "PostgreSQL 18.6 was released on 2026-08-13 with fixes for the supported PostgreSQL 18 major line while PostgreSQL 19 remained in beta.",
    sonaraUse: "Keep SONARA on a supported stable PostgreSQL/Supabase path and treat newer beta majors as research until provider support, extension compatibility, replay, backup and rollback evidence are complete."
  }),
  signal({
    key: "postgres_native_durable_execution_2026",
    domain: "workflow_orchestration",
    source: "DBOS — architecture and durable workflow documentation",
    sourceUrl: "https://docs.dbos.dev/architecture",
    finding: "DBOS checkpoints workflows and queues in PostgreSQL so applications can resume from completed steps after crashes without requiring a separate orchestration server.",
    sonaraUse: "Evaluate Postgres-native durable execution as an isolated TypeScript experiment for long-running SONARA workflows only after migration, tenancy, operational-load and licensing review; do not replace the existing outbox/inbox path by default."
  }),
  signal({
    key: "durable_service_runtime_2026",
    domain: "workflow_orchestration",
    source: "Restate — service and workflow documentation",
    sourceUrl: "https://docs.restate.dev/concepts/services/",
    finding: "Restate combines durable execution, per-key state and workflow identity for resilient multi-step services, approvals and state machines.",
    sonaraUse: "Keep Restate in architecture evaluation because its server is BSL-1.1 and introduces a distinct runtime/control-plane boundary; use only if measured workflow complexity justifies that operating and licensing cost."
  }),
  signal({
    key: "cloudevents_interoperability",
    domain: "event_architecture",
    source: "CloudEvents — specification",
    sourceUrl: "https://cloudevents.io/",
    finding: "CloudEvents standardizes event metadata so producers, routers and consumers can interoperate without every integration inventing a new event envelope.",
    sonaraUse: "Adopt a SONARA-compatible canonical event envelope inspired by CloudEvents for external adapters and internal event transport while keeping tenant, sensitivity and authorization metadata explicit and minimal."
  }),
  signal({
    key: "feature_flag_provider_abstraction",
    domain: "release_engineering",
    source: "OpenFeature — provider specification",
    sourceUrl: "https://openfeature.dev/specification/sections/providers/",
    finding: "OpenFeature separates application flag evaluation from the underlying flag-management provider through a vendor-neutral provider interface.",
    sonaraUse: "Use provider-neutral feature-evaluation contracts for reversible rollout controls while keeping authorization, billing entitlement and security policy outside feature flags."
  }),
  signal({
    key: "mcp_2026_stateless_agent_protocol",
    domain: "agentic_ai",
    source: "Model Context Protocol — 2026-07-28 specification release",
    sourceUrl: "https://blog.modelcontextprotocol.io/posts/2026-07-28/",
    finding: "MCP 2026-07-28 introduced a stateless protocol core, header-based routing, cacheable lists, authorization hardening and an extensions model for tasks and other capabilities.",
    sonaraUse: "Treat MCP as an interoperability boundary behind SONARA identity, tenant policy, tool allowlists, budgets and audit; protocol compatibility never grants tool authority."
  }),
  signal({
    key: "apple_server_entitlement_reconciliation",
    domain: "mobile_business",
    source: "Apple — App Store Server Notifications V2",
    sourceUrl: "https://developer.apple.com/documentation/AppStoreServerNotifications",
    finding: "Apple server notifications V2 deliver signed server-to-server purchase lifecycle events including renewals and refunds so applications can update their own user-account state.",
    sonaraUse: "Model App Store purchases as provider evidence reconciled into canonical SONARA entitlement records; verify signatures and make duplicate delivery replay-safe."
  }),
  signal({
    key: "google_play_backend_entitlements_2026",
    domain: "mobile_business",
    source: "Google Play — backend integration guidance",
    sourceUrl: "https://developer.android.com/google/play/billing/backend",
    finding: "Google recommends backend purchase lifecycle management with Real-time Developer Notifications for subscriptions and one-time purchases so entitlements remain consistent; 2026 APIs also added pending chargeback-review events.",
    sonaraUse: "Keep Google Play RTDN as a trigger, fetch authoritative purchase state server-side, reconcile canonical entitlements and gate refund/chargeback decisions behind explicit owner policy."
  }),
  signal({
    key: "vector_tiered_multitenancy_2026",
    domain: "rag_and_search",
    source: "Qdrant — multitenancy documentation",
    sourceUrl: "https://qdrant.tech/documentation/manage-data/multitenancy/",
    finding: "Qdrant supports payload-partitioned, dedicated-shard and tiered multitenancy, including promotion of larger tenants from shared to dedicated shards.",
    sonaraUse: "Keep PostgreSQL/pgvector as the default retrieval authority and benchmark Qdrant only when measured vector scale, isolation or latency ceilings justify another reconciled projection service."
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

const AUTONOMIC_CONTROL_LOOPS = Object.freeze([
  controlLoop(
    "queue_stall_recovery",
    ["queue age", "lease expiry", "attempt count", "handler outcome", "dead-letter state"],
    ["reclaim expired lease", "requeue replay-safe operation", "dead-letter at retry ceiling", "pause a poisoned consumer lane"],
    ["tenant scope missing", "business idempotency unproven", "authority-sensitive side effect", "unknown handler outcome"],
    "Every recovery action preserves operation identity and produces settlement evidence."
  ),
  controlLoop(
    "provider_degradation",
    ["timeout rate", "429/5xx rate", "circuit state", "fallback health", "remaining deadline"],
    ["open circuit", "shed optional work", "retry classified idempotent calls", "route to tested equivalent fallback"],
    ["fallback changes authority", "fallback changes money semantics", "no tested fallback", "deadline exhausted"],
    "Provider failure degrades a capability without cascading through unrelated healthy services."
  ),
  controlLoop(
    "workflow_checkpoint_recovery",
    ["workflow checkpoint", "activity idempotency key", "attempt", "deadline", "approval state"],
    ["resume persisted checkpoint", "retry idempotent activity", "wait for human event", "compensate using predeclared transition"],
    ["external effect has unknown outcome", "approval expired", "compensation is destructive", "workflow schema drift"],
    "A process crash cannot erase progress or silently repeat a customer-visible effect."
  ),
  controlLoop(
    "release_regression",
    ["exact commit SHA", "canary sample count", "error rate", "p95 latency", "business KPI", "rollback readiness"],
    ["hold promotion", "pause rollout", "rollback reversible deployment"],
    ["exact SHA unverified", "insufficient evidence", "rollback path unproven", "migration rollback unsafe"],
    "Traffic widens only from exact-SHA evidence; regression causes pause or proven rollback."
  ),
  controlLoop(
    "projection_reconciliation",
    ["canonical row/version", "projection checkpoint", "lag", "checksum or aggregate mismatch"],
    ["rebuild derived cache", "replay projection event", "invalidate stale derivative"],
    ["canonical authority unavailable", "tenant scope missing", "repair would mutate canonical history"],
    "Derived search, cache, analytics and recommendation state can be rebuilt without changing canonical records."
  ),
  controlLoop(
    "agent_tool_recovery",
    ["tool-call identity", "policy decision id", "attempt", "tool result", "budget", "approval state"],
    ["retry read-only or idempotent tool", "resume checkpoint", "request approval", "stop at retry or budget ceiling"],
    ["tool scope expands", "policy decision missing", "money/destructive action lacks approval", "tool outcome is ambiguous"],
    "The model may propose recovery, but the harness owns authority, retry ceilings, checkpoints and verification."
  )
]);

const MARKET_WEDGES_2026 = Object.freeze([
  marketWedge("embedded_vertical_operations_ai", "Trades are experimenting faster than they are embedding AI; integration and measurable ROI remain adoption barriers.", ["Business Builder", "SONARA One"], "Shared job/schedule/customer/invoice data plus governed automation lowers integration cost across trades."),
  marketWedge("restaurant_operating_copilot", "Restaurant AI is increasingly grounded in operational sales, labor, menu and guest data.", ["Business Builder", "SONARA One"], "A canonical restaurant data graph can support recommendations and actions without creating a second source of truth."),
  marketWedge("agentic_commerce_control_plane", "AI-assisted shopping is becoming a material discovery and order channel.", ["Growth Studio", "Business Builder"], "Governed product feeds, inventory reservation, order identity and reconciliation make external assistants replaceable channels."),
  marketWedge("durable_agent_execution", "Long-running AI and automation tasks increasingly use persisted workflow/checkpoint semantics.", ["SONARA One", "Creator Studio", "Growth Studio"], "The SONARA harness can make model/provider choice replaceable while workflow identity, policy, evidence and recovery remain stable."),
  marketWedge("mobile_monetization_entitlements", "Non-game mobile and AI applications continue to grow monetization through subscriptions and in-app purchases.", ["SONARA One", "Creator Studio", "Growth Studio"], "One entitlement, receipt, refund, quota and usage-metering layer avoids product-specific billing logic."),
  marketWedge("physical_operations_event_fabric", "Fleet, field-service and device platforms expose APIs, webhooks and telemetry streams.", ["Business Builder"], "One tenant-scoped event/asset/job graph can serve trucking, delivery, waste, trades, facilities and light manufacturing."),
  marketWedge("reliability_evidence_and_governed_repair", "Modern operations combine SLO testing, progressive delivery, policy evidence and bounded recovery.", ["SONARA One"], "Exact-SHA evidence plus deterministic repair authority is a platform capability every vertical can reuse.")
]);

const BACKEND_REFERENCE_SYSTEMS_2026 = Object.freeze([
  referenceSystem("dbos-inc/dbos-transact-ts", "MIT", "evaluate_isolated", "Postgres-native TypeScript durable workflows and queues; strongest fit when SONARA needs durability without a separate orchestration server."),
  referenceSystem("temporalio/temporal", "MIT", "evaluate_isolated_worker", "Mature durable workflow reference for long-lived multi-service execution, timers, retries and human waits."),
  referenceSystem("restatedev/restate", "BSL-1.1", "reference_and_commercial_review", "Durable services, keyed state and workflows; license and operating boundary require explicit review before adoption."),
  referenceSystem("nats-io/nats-server", "Apache-2.0", "evaluate_on_measured_event_pressure", "High-throughput messaging and JetStream persistence; transport does not replace business idempotency or canonical reconciliation."),
  referenceSystem("cloudevents/spec", "Apache-2.0", "specification_reference", "Portable event metadata contract for adapters, routing and tracing without adopting a broker."),
  referenceSystem("open-feature/spec", "Apache-2.0", "specification_reference", "Vendor-neutral feature evaluation contract for canaries, degradation controls and reversible rollout."),
  referenceSystem("modelcontextprotocol/modelcontextprotocol", "Apache-2.0/MIT transition; docs CC-BY-4.0", "protocol_reference", "Agent/tool interoperability protocol; SONARA policy and authority remain outside the protocol."),
  referenceSystem("qdrant/qdrant", "Apache-2.0", "evaluate_after_pgvector_benchmark", "Vector-search projection candidate for measured scale or tenant-isolation ceilings."),
  referenceSystem("openfga/openfga", "Apache-2.0", "evaluate_for_graph_authorization_only", "Relationship-based authorization reference for delegated or hierarchical sharing that exceeds current role/RLS needs."),
  referenceSystem("open-telemetry/opentelemetry-js", "Apache-2.0", "preferred_observability_standard", "Vendor-neutral trace, metric and log instrumentation for Node services, jobs, tools and provider adapters."),
  referenceSystem("argoproj/argo-rollouts", "Apache-2.0", "future_kubernetes_only", "Progressive-delivery reference; not a current SONARA runtime dependency while the customer web runtime remains on Vercel."),
  referenceSystem("grafana/k6", "AGPL-3.0", "external_developer_tool", "Executable latency/error/SLO threshold reference; keep license boundary deliberate and separate from customer runtime.")
]);

function referenceSystem(repository, licensePosture, adoptionState, sonaraUse) {
  return Object.freeze({
    repository,
    licensePosture,
    adoptionState,
    sonaraUse,
    installedByResearch: false,
    enabledInProduction: false
  });
}

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

function controlLoop(key, evidence, automatedActions, blockConditions, proof) {
  return Object.freeze({
    key,
    evidence: Object.freeze([...evidence]),
    automatedActions: Object.freeze([...automatedActions]),
    blockConditions: Object.freeze([...blockConditions]),
    proof
  });
}

function marketWedge(key, demandSignal, productFit, backendMoat) {
  return Object.freeze({
    key,
    demandSignal,
    productFit: Object.freeze([...productFit]),
    backendMoat
  });
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

function nonNegativeInteger(value, field) {
  const number = nonNegative(value, field);
  if (!Number.isInteger(number)) throw new TypeError(`${field} must be an integer`);
  return number;
}

function positiveInteger(value, field) {
  const number = positive(value, field);
  if (!Number.isInteger(number)) throw new TypeError(`${field} must be an integer`);
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

function retrySafetyDecision(input = {}) {
  const attempt = nonNegativeInteger(input.attempt, "attempt");
  const maxAttempts = positiveInteger(input.maxAttempts, "maxAttempts");
  const remainingDeadlineMs = nonNegative(input.remainingDeadlineMs, "remainingDeadlineMs");
  const nextDelayMs = nonNegative(input.nextDelayMs, "nextDelayMs");
  const retryable = Boolean(input.retryable);
  const idempotent = Boolean(input.idempotent);
  const authoritySensitive = Boolean(input.authoritySensitive);

  if (!retryable) return Object.freeze({ retry: false, mode: "fail_fast", reason: "not_retryable" });
  if (!idempotent) return Object.freeze({ retry: false, mode: "blocked", reason: "idempotency_not_proven" });
  if (authoritySensitive) return Object.freeze({ retry: false, mode: "human_approval_required", reason: "authority_sensitive_retry" });
  if (attempt >= maxAttempts) return Object.freeze({ retry: false, mode: "dead_letter", reason: "retry_ceiling_reached" });
  if (nextDelayMs >= remainingDeadlineMs) return Object.freeze({ retry: false, mode: "dead_letter", reason: "deadline_exhausted" });

  return Object.freeze({ retry: true, mode: "bounded_retry", reason: "transient_idempotent_operation" });
}

function progressiveDeliveryDecision(input = {}) {
  const sampleCount = nonNegativeInteger(input.sampleCount, "sampleCount");
  const minSamples = positiveInteger(input.minSamples, "minSamples");
  const errorRate = unit(input.errorRate, "errorRate");
  const errorRateBudget = unit(input.errorRateBudget, "errorRateBudget");
  const latencyP95Ms = nonNegative(input.latencyP95Ms, "latencyP95Ms");
  const latencyBudgetMs = positive(input.latencyBudgetMs, "latencyBudgetMs");
  const businessKpi = unit(input.businessKpi, "businessKpi");
  const businessKpiFloor = unit(input.businessKpiFloor, "businessKpiFloor");
  const rollbackReady = Boolean(input.rollbackReady);
  const exactShaVerified = Boolean(input.exactShaVerified);

  if (!exactShaVerified) return Object.freeze({ decision: "blocked", reason: "exact_sha_not_verified" });
  if (sampleCount < minSamples) return Object.freeze({ decision: "hold", reason: "insufficient_samples" });

  const breached = errorRate > errorRateBudget || latencyP95Ms > latencyBudgetMs || businessKpi < businessKpiFloor;
  if (breached && rollbackReady) return Object.freeze({ decision: "rollback", reason: "canary_threshold_breach" });
  if (breached) return Object.freeze({ decision: "pause", reason: "threshold_breach_without_rollback_proof" });

  return Object.freeze({ decision: "promote", reason: "canary_thresholds_pass" });
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
    autonomicControlLoopCount: AUTONOMIC_CONTROL_LOOPS.length,
    marketWedgeCount: MARKET_WEDGES_2026.length,
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
    autonomicControlLoops: AUTONOMIC_CONTROL_LOOPS.map((item) => ({
      ...item,
      evidence: [...item.evidence],
      automatedActions: [...item.automatedActions],
      blockConditions: [...item.blockConditions]
    })),
    marketWedges: MARKET_WEDGES_2026.map((item) => ({
      ...item,
      productFit: [...item.productFit]
    })),
    formulas: {
      capacityHeadroom: "clamp(1 - peak_observed / safe_capacity, 0, 1)",
      recoveryConfidence: "0.25*detection + 0.25*runbook + 0.25*rollback + 0.25*test_freshness",
      workflowFitness: "0.30*correctness + 0.25*durability + 0.20*auditability + 0.15*latency_fit + 0.10*cost_fit",
      retrySafety: "retryable && idempotent && !authority_sensitive && attempt < max_attempts && next_delay_ms < remaining_deadline_ms",
      progressiveDelivery: "exact_sha && samples>=minimum && error_rate<=budget && p95<=latency_budget && business_kpi>=floor"
    },
    architectureDecision: {
      core: "One shared reliability kernel supports every vertical; industry differentiation lives in schemas, workflows, policies and adapters rather than duplicated infrastructure.",
      synchronousPath: "Keep customer-facing command paths small, bounded and deterministic; move slow or failure-prone work into persisted workflows.",
      data: "PostgreSQL/Supabase remains the canonical transactional authority. Specialized search, analytics, realtime and media systems are projections or workload-specific services with reconciliation.",
      agents: "LLMs are probabilistic planners/reasoners inside deterministic identity, policy, workflow, verification, telemetry and budget envelopes.",
      selfRepair: "Use bounded desired-state reconciliation: retry/requeue, circuit breaking, checkpoint resume, derived-state rebuild and proven rollback. Production source/schema rewriting is forbidden; authority, destructive changes and money movement require explicit authorization.",
      scale: "Add queues, replicas, partitioning, brokers, specialized analytics or coordinators only when measured latency, throughput, retention or recovery requirements justify them."
    },
    guardrails: [
      "This market analysis has zero production execution authority.",
      "No third-party repository, workflow engine, broker, analytics database or provider is installed by this module.",
      "External market evidence is a design input, not proof that SONARA itself has reached another product's scale.",
      "Self-repair never means unrestricted self-modifying production code.",
      "Queue or provider delivery guarantees never substitute for idempotent, reconciled business effects.",
      "Promotion and automated rollback require exact-SHA evidence, minimum samples and a proven recovery path.",
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
  AUTONOMIC_CONTROL_LOOPS,
  MARKET_WEDGES_2026,
  capacityHeadroom,
  recoveryConfidenceScore,
  workflowFitnessScore,
  repairAutomationDecision,
  retrySafetyDecision,
  progressiveDeliveryDecision,
  getBackendOperationsMarketAnalysis
};
