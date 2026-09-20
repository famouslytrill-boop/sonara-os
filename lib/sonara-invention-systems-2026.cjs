// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/**
 * SONARA Invention Systems Intelligence — 2026-09-20
 *
 * Non-executing deterministic research/control-plane registry. It translates
 * current external market and technology evidence into SONARA-owned system
 * concepts without copying vendor implementations or granting runtime authority.
 *
 * Nothing in this file installs software, downloads repositories, enables a
 * provider, performs a payment, deploys an agent, modifies production data, or
 * marks a capability as live.
 */

const SNAPSHOT_DATE = "2026-09-20";
const REGISTRY_VERSION = "1.1.0";

const MATURITY_STAGES = Object.freeze([
  "research",
  "design",
  "sandbox",
  "validated",
  "canary",
  "production"
]);

const PROMOTION_GATES = Object.freeze({
  design: ["problem_definition", "source_provenance", "architecture_boundary"],
  sandbox: ["threat_model", "test_plan", "cost_model", "rollback_plan"],
  validated: ["deterministic_tests", "security_tests", "tenant_isolation_tests", "performance_tests"],
  canary: ["observability", "rate_limits", "approval_policy", "operator_runbook"],
  production: ["exact_sha_release_evidence", "rollback_evidence", "production_health", "owner_authorization"]
});

const MARKET_SIGNALS = Object.freeze([
  signal(
    "workflow_redesign_over_chat",
    "agentic_ai",
    "McKinsey — Cutting the coordination tax: how agentic AI can reshape workflows",
    "2026-09-18",
    "https://www.mckinsey.com/industries/industrials/our-insights/cutting-the-coordination-tax-how-agentic-ai-can-reshape-workflows",
    "AI productivity is widespread, but organization-level economic impact lags; the strongest opportunity is redesigning handoffs between people, agents, and systems.",
    "Prioritize workflow orchestration, evidence, approvals, state transitions, and measurable business outcomes over generic chat."
  ),
  signal(
    "agent_scale_gap",
    "agentic_ai",
    "McKinsey — The state of AI in 2026",
    "2026-08-25",
    "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",
    "Agent scaling remains materially more common in large enterprises than smaller organizations.",
    "Package difficult orchestration, governance, evaluation, and integrations into reusable modules affordable to smaller operators."
  ),
  signal(
    "restaurant_grounded_ai",
    "vertical_saas",
    "Toast — How Restaurants Are Using AI in 2026",
    "2026-09-14",
    "https://pos.toasttab.com/blog/data/restaurant-ai-statistics",
    "Restaurant operators are experimenting heavily with AI while relying on vendor-integrated tools and human oversight.",
    "Ground recommendations in sales, menu, inventory, labor, guest, and operational data and connect them to approved actions."
  ),
  signal(
    "retail_operational_simplification",
    "vertical_saas",
    "Toast — 2026 Voice of the Retail Industry",
    "2026-09-09",
    "https://pos.toasttab.com/blog/data/voice-of-the-retail-industry-survey-2026",
    "Retail operators report pressure around inventory, operational simplification, and supervised AI use.",
    "Build one inventory/order/customer/analytics fabric that can serve POS, kiosk, store, and multi-location use cases."
  ),
  signal(
    "machine_payments",
    "payments",
    "Stripe — Machine Payments Protocol",
    "2026-03-18",
    "https://stripe.com/blog/machine-payments-protocol",
    "AI agents are beginning to participate in machine-readable commerce and payment workflows.",
    "Separate agent intent from payment authority; enforce budgets, idempotency, approval, fraud controls, receipts, refunds, and reconciliation."
  ),
  signal(
    "machine_payment_networks",
    "payments",
    "Mastercard — Agent Pay for Machines",
    "2026-06-10",
    "https://www.mastercard.com/us/en/news-and-trends/press/2026/june/mastercard-launches-agent-pay-for-machines.html",
    "Payment networks are designing primitives for high-frequency programmatic machine transactions.",
    "Create a provider-neutral delegated-commerce envelope rather than coupling business logic to one payment network."
  ),
  signal(
    "agent_security",
    "security",
    "OWASP — AI Agent Security Cheat Sheet",
    SNAPSHOT_DATE,
    "https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html",
    "Prompt injection, tool abuse, privilege escalation, exfiltration, memory poisoning, excessive autonomy, and denial-of-wallet are first-class agent risks.",
    "Apply least privilege, independent authorization, bounded tools, cost ceilings, memory provenance, approval gates, and adversarial tests."
  ),
  signal(
    "passkey_scale",
    "identity",
    "FIDO Alliance — State of Passkeys 2026",
    "2026-05-07",
    "https://fidoalliance.org/the-state-of-passkeys-2026-global-consumer-and-workforce-report/",
    "Passkeys have reached broad consumer and workforce adoption.",
    "Use passkeys/device-bound credentials for authentication while keeping recovery, step-up authorization, and audit policy explicit."
  ),
  signal(
    "genai_observability",
    "observability",
    "OpenTelemetry — GenAI Observability",
    "2026-05-14",
    "https://opentelemetry.io/blog/2026/genai-observability/",
    "OpenTelemetry conventions make model calls, tokens, tool calls, traces, and latency observable across agent systems.",
    "Correlate agent/model/tool activity with workflow, tenant, cost, approval, and business outcome telemetry while excluding sensitive content by default."
  ),
  signal(
    "modular_digital_twins",
    "manufacturing",
    "NIST — Standards-Based Digital Twin Composition",
    "2026-08-26",
    "https://www.nist.gov/publications/standards-based-digital-twin-composition-robot-arm-and-gripper",
    "Composable component twins can reduce the cost and complexity of large digital-twin systems, but interoperability and lifecycle validity remain hard.",
    "Model businesses, assets, locations, jobs, inventory, and devices as composable twins with versioned schemas and adapter boundaries."
  ),
  signal(
    "smart_manufacturing",
    "manufacturing",
    "NIST — 2026 Roadmap on AI and ML for Smart Manufacturing",
    "2026-07-03",
    "https://www.nist.gov/publications/2026-roadmap-artificial-intelligence-and-machine-learning-smart-manufacturing",
    "Industrial AI opportunity spans sensing, data, robotics, digital twins, supply chains, quality, sustainability, and trustworthy operation.",
    "SONARA should manage planning, evidence, telemetry, work orders, maintenance, and analytics while leaving safety-critical machine control to specialist systems."
  ),
  signal(
    "webgpu_maturity",
    "spatial_compute",
    "W3C — WebGPU Candidate Recommendation Draft",
    "2026-09-01",
    "https://www.w3.org/TR/webgpu/",
    "WebGPU is advancing as a modern web graphics and compute API.",
    "Use progressive enhancement: GPU acceleration may improve 3D and visual analytics, but core navigation, forms, payments, and accessibility must not depend on it."
  ),
  signal(
    "webxr_maturity",
    "spatial_compute",
    "W3C — WebXR Device API",
    "2026-06-09",
    "https://www.w3.org/TR/webxr/",
    "WebXR provides a standards-track interface to immersive and augmented-reality devices.",
    "Treat spatial interfaces as optional presentation adapters over the same business state and permission model."
  ),
  signal(
    "search_social_measurement",
    "growth",
    "Google Search Central — Platform properties",
    "2026-07-29",
    "https://developers.google.com/search/blog/2026/07/platform-properties-social-video-guide",
    "Search Console now exposes discovery performance for supported social and video platform properties.",
    "Unify owned-site SEO, social/video discovery, campaign attribution, and commerce outcomes in one evidence graph."
  ),
  signal(
    "android_distribution_policy",
    "mobile",
    "Android Developers — Target API requirements",
    "2026-08-31",
    "https://developer.android.com/google/play/requirements/target-sdk",
    "New Google Play submissions and updates must meet the 2026 target-API requirements for their device category.",
    "Keep mobile packaging policy versioned and independently verified from the web control plane."
  ),
  signal(
    "apple_subscription_server_truth",
    "mobile_billing",
    "Apple Developer — App Store Server API",
    SNAPSHOT_DATE,
    "https://developer.apple.com/documentation/appstoreserverapi",
    "Apple exposes signed server-side transaction and subscription state.",
    "Reconcile signed store evidence into canonical SONARA entitlements instead of trusting client-reported purchase state."
  ),
  signal(
    "mcp_stateless_interop",
    "agent_protocols",
    "Model Context Protocol — 2026-07-28 specification update",
    "2026-07-28",
    "https://blog.modelcontextprotocol.io/posts/2026-07-28/",
    "The protocol moved toward a stateless core with method/name routing headers, cache-friendly discovery, stronger authorization guidance, and extension points for tasks and apps.",
    "Keep SONARA integrations contract-first and stateless where possible; isolate provider/session state behind adapters, validate auth issuers, cache capability metadata safely, and version/deprecate protocol surfaces deliberately."
  ),
  signal(
    "agent_identity_authority",
    "agent_security",
    "NIST — AI Agent Standards Initiative",
    "2026-02-17",
    "https://www.nist.gov/news-events/news/2026/02/announcing-ai-agent-standards-initiative-interoperable-and-secure",
    "Agent interoperability creates a parallel need for explicit identity, authorization, accountability, and secure protocol behavior.",
    "Give every agent and workload a verifiable identity and a separately evaluated authority envelope; model reasoning never substitutes for authentication or authorization."
  ),
  signal(
    "runtime_agent_governance",
    "agent_security",
    "Google Developers — Build zero-trust AI agents that judge intent, not just syntax",
    "2026-09-15",
    "https://developers.googleblog.com/build-zero-trust-ai-agents-that-judge-intent-not-just-syntax/",
    "Connected agents need runtime controls that evaluate intent and behavior rather than relying only on static prompts or pre-execution filters.",
    "Put deterministic gateways, signed mutation evidence, anomaly detection, least privilege, and revocation around agent actions; keep prompts outside the trusted security boundary."
  ),
  signal(
    "agentic_storefront_distribution",
    "commerce_distribution",
    "Shopify — Agentic commerce momentum",
    "2026-03-24",
    "https://www.shopify.com/news/agentic-commerce-momentum",
    "Commerce catalogs and checkout capabilities are increasingly exposed to AI assistants and agentic storefront channels while merchants retain centralized operational control.",
    "Publish machine-readable catalog, availability, policy, and checkout contracts from one canonical commerce graph instead of building channel-specific business logic."
  ),
  signal(
    "agentic_payment_runtime",
    "payments",
    "Visa — Agentic payments from the ground up",
    "2026-07-14",
    "https://www.visa.com/en-us/thought-leadership/innovation/agentic-payments-from-the-ground-up",
    "Agentic purchasing expands from recommendations toward delegated execution, increasing the importance of trust, spend limits, identity, and payment-specific controls.",
    "Treat payment as a privileged deterministic subsystem: agents may propose purchases, but spend scope, merchant constraints, velocity, confirmation, receipts, disputes, and reconciliation stay policy-controlled."
  ),
  signal(
    "app_ai_economics",
    "mobile_market",
    "Apple — App Store ecosystem reaches $1.4 trillion in developer billings and sales",
    "2026-06-04",
    "https://www.apple.com/newsroom/2026/06/app-store-ecosystem-reaches-1-point-4-trillion-usd-as-developers-thrive-globally/",
    "Mobile software remains a major distribution and commerce surface, with consumer-facing AI applications showing strong billings growth in Apple's 2025 ecosystem analysis.",
    "Design mobile as a first-class distribution surface with measurable retention, entitlement reconciliation, store-policy compliance, device capability budgets, and unit economics."
  ),
  signal(
    "operational_vector_search",
    "data_infrastructure",
    "AWS — Amazon DynamoDB vector search",
    "2026-08-05",
    "https://aws.amazon.com/about-aws/whats-new/2026/08/amazon-dynamodb-vector-search/",
    "Operational databases are adding native vector retrieval so semantic retrieval can sit closer to live application state at large scale.",
    "Keep canonical transactional state authoritative while allowing vector and lexical indexes to be rebuildable, permission-scoped projections selected by latency, recall, cost, and operational fit."
  ),
  signal(
    "realtime_stateful_coordination",
    "realtime_infrastructure",
    "Cloudflare — Durable Objects",
    "2026-07-15",
    "https://developers.cloudflare.com/durable-objects/",
    "Stateful server-side coordination primitives can serialize updates for a logical object while combining compute, storage, and realtime connections.",
    "Use per-entity or per-session coordinators only where ordered mutable state is valuable; define partitioning, reconnect/replay, persistence, hotspot, and regional-failure behavior explicitly."
  ),
  signal(
    "creative_agent_workflows",
    "creative_software",
    "Adobe — Creative agents and expanded Firefly workflows",
    "2026-06-18",
    "https://news.adobe.com/news/2026/06/adobe-unveils-major-expansion",
    "Creative software is moving from isolated generation toward multi-step agent-assisted workflows connected to editable assets and established creative tools.",
    "Store creative identity, versions, rights, provenance, edits, timelines, and reusable assets as durable project data so models remain replaceable collaborators rather than the source of truth."
  ),
  signal(
    "open_video_av2",
    "media_infrastructure",
    "Alliance for Open Media — AV2 codec release",
    "2026-06-09",
    "https://aomedia.org/press%20releases/Alliance-for-Open-Media-Releases-AV2-Codec/",
    "A new open video codec generation extends the royalty-free media stack with improved compression and broader media-delivery capabilities.",
    "Make media delivery codec-pluggable and device-aware; benchmark AV2/AV1/fallback ladders against quality, encode cost, decode support, bandwidth, latency, storage, and HDR/4K requirements."
  ),
  signal(
    "physical_ai_world_models",
    "physical_ai",
    "NVIDIA — Physical AI for real-world robotics",
    "2026-03-16",
    "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-and-Global-Robotics-Leaders-Take-Physical-AI-to-the-Real-World/",
    "Robotics development is increasingly combining world models, simulation, synthetic data, perception, and embodied policies before real-world execution.",
    "Use simulation and digital rehearsal to test business/robotic workflows before physical execution; keep safety-critical actuation behind specialist controllers and independent authorization."
  ),
  signal(
    "agentic_design_interop",
    "engineering_design",
    "Autodesk Platform Services — Building agentic AI",
    "2026-04-15",
    "https://aps.autodesk.com/blog/building-agentic-ai-whats-new-autodesk-platform-services",
    "Engineering-design platforms are exposing model data and automation through APIs and agent-oriented interfaces rather than requiring every application to reimplement CAD kernels.",
    "Integrate engineering/CAD through governed file/model APIs, metadata, automation jobs, viewers, previews, and approval workflows; keep mature geometry kernels external unless SONARA has a justified core need."
  ),
  signal(
    "realtime_engine_convergence",
    "interactive_3d",
    "Epic Games — Unreal Engine 5.8",
    "2026-06-23",
    "https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available",
    "Real-time engines continue to combine high-fidelity world building, performance tooling, and AI-assisted development workflows.",
    "Borrow scene graphs, streaming, frame budgets, telemetry, asset pipelines, deterministic gameplay/state concepts, and editor ergonomics without making core business workflows depend on a heavyweight game engine."
  ),
  signal(
    "postgres_operational_foundation",
    "data_infrastructure",
    "PostgreSQL — PostgreSQL 18.6 release",
    "2026-08-13",
    "https://www.postgresql.org/docs/release/18.6/",
    "PostgreSQL 18 continues strengthening replication, temporal/data-management capabilities, authentication/TLS behavior, and operational observability.",
    "Prefer one well-governed relational source of truth for core tenant/business state, then add specialized projections only when measured workload evidence justifies them."
  )
]);

const INVENTION_SYSTEMS = Object.freeze([
  invention("governed-agent-mesh", "Governed Agent Mesh", "agentic_ai", [
    "role-scoped agents", "bounded tool registry", "agent-to-agent delegation", "approval checkpoints",
    "budget ceilings", "evidence graph", "memory provenance", "kill switch"
  ], ["Business Builder", "Creator Studio", "Growth Studio"], "research"),
  invention("deterministic-workflow-compiler", "Deterministic Workflow Compiler", "workflows", [
    "versioned workflow DSL", "finite-state transitions", "idempotency keys", "human/agent steps",
    "retry policies", "dead-letter paths", "rollback contracts", "workflow replay"
  ], ["operations", "payments", "customer service", "scheduling", "project management"], "research"),
  invention("evidence-rag-fabric", "Evidence RAG Fabric", "rag", [
    "tenant-scoped retrieval", "source provenance", "freshness scoring", "citation graph",
    "retrieval evaluation", "semantic plus lexical search", "document permissions", "memory isolation"
  ], ["knowledge", "customer service", "research", "learning", "analytics"], "research"),
  invention("business-digital-twin-graph", "Business Digital Twin Graph", "business_management", [
    "organizations", "locations", "people", "assets", "inventory", "services", "projects", "customers",
    "jobs", "orders", "devices", "contracts", "events", "financial relationships"
  ], ["all vertical packs"], "research"),
  invention("machine-commerce-guard", "Machine Commerce Guard", "payments", [
    "delegated spend envelopes", "merchant/product constraints", "approval tiers", "velocity limits",
    "idempotent checkout", "fraud signals", "receipts", "refund workflow", "reconciliation"
  ], ["payments", "procurement", "subscriptions", "agentic commerce"], "research"),
  invention("universal-entitlement-ledger", "Universal Entitlement Ledger", "commerce", [
    "Stripe/web/mobile receipt reconciliation", "subscription state machine", "usage entitlements",
    "seat entitlements", "trial state", "refund/revocation evidence", "offline grace policy"
  ], ["SaaS", "mobile", "creator commerce", "gaming", "media"], "research"),
  invention("vertical-operations-kernel", "Vertical Operations Kernel", "vertical_saas", [
    "customer CRM", "catalog", "orders", "inventory", "staff", "scheduling", "projects", "documents",
    "billing", "communications", "analytics", "automation"
  ], ["restaurant", "retail", "trucking", "HVAC", "electrical", "plumbing", "carpentry", "cleaning", "waste", "venues"], "research"),
  invention("adaptive-pos-kiosk-engine", "Adaptive POS & Kiosk Engine", "commerce", [
    "touch-first catalog", "offline-tolerant cart", "price/tax rules", "kitchen/fulfillment routing",
    "receipt state", "accessibility modes", "device capability detection", "operator override"
  ], ["restaurant", "retail", "venue", "events"], "research"),
  invention("field-intelligence-mesh", "Field Intelligence Mesh", "field_operations", [
    "GPS jobs", "geofences", "dispatch", "route optimization", "camera evidence", "asset scans",
    "offline mutation queue", "sync conflict resolution", "weather/context adapters"
  ], ["trucking", "delivery", "trades", "waste", "property", "utilities"], "research"),
  invention("modular-digital-twin-composer", "Modular Digital Twin Composer", "industrial", [
    "component twins", "schema adapters", "desired/reported state", "telemetry", "maintenance models",
    "quality evidence", "lifecycle versioning", "simulation hooks"
  ], ["manufacturing", "facilities", "fleet", "utilities", "warehousing"], "research"),
  invention("predictive-operations-engine", "Predictive Operations Engine", "forecasting", [
    "time-series features", "scenario simulation", "demand forecasts", "inventory risk", "capacity risk",
    "maintenance risk", "confidence intervals", "backtesting", "drift detection"
  ], ["retail", "food", "fleet", "manufacturing", "staffing", "finance planning"], "research"),
  invention("self-healing-reliability-supervisor", "Self-Healing Reliability Supervisor", "infrastructure", [
    "health probes", "error clustering", "known-safe remediation playbooks", "circuit breakers",
    "rollback proposals", "dependency isolation", "SLO budgets", "human approval for risky repair"
  ], ["web", "workers", "databases", "adapters", "deployments"], "research"),
  invention("compute-routing-fabric", "Compute Routing Fabric", "compute", [
    "CPU/GPU workload classification", "model routing", "latency budgets", "quality budgets",
    "token/GPU cost accounting", "batching", "cache policy", "provider fallback"
  ], ["LLM", "media", "analytics", "3D", "forecasting"], "research"),
  invention("spatial-experience-engine", "Spatial Experience Engine", "spatial_compute", [
    "WebGPU/WebGL fallback", "WebXR optional adapter", "3D scene documents", "GPU budgets",
    "frame-time telemetry", "reduced-motion path", "2D fallback", "asset streaming"
  ], ["cinematic website", "AR", "showrooms", "training", "data visualization", "gaming-adjacent experiences"], "research"),
  invention("media-production-fabric", "Media Production Fabric", "media", [
    "video/audio/image project graph", "timeline", "render queue", "transcoding", "captions",
    "rights/provenance", "versioning", "export profiles", "streaming handoff"
  ], ["Creator Studio", "podcasting", "music", "film", "social", "advertising"], "research"),
  invention("growth-experiment-loop", "Growth Experiment Loop", "growth", [
    "SEO/social/search signals", "content calendar", "campaign graph", "audience cohorts",
    "attribution evidence", "holdouts", "incrementality", "creative variants", "budget limits"
  ], ["Growth Studio", "social", "search", "email", "creator commerce"], "research"),
  invention("communications-fabric", "Communications Fabric", "communications", [
    "email", "SMS", "voice", "chat", "notifications", "sound/haptics preferences", "translation",
    "thread timeline", "consent", "quiet hours", "delivery evidence"
  ], ["customer service", "sales", "operations", "communities"], "research"),
  invention("learning-translation-engine", "Learning & Translation Engine", "education", [
    "course graph", "adaptive practice", "spaced repetition", "translation memory", "captions",
    "accessibility", "assessment", "teacher/operator oversight", "provenance"
  ], ["classrooms", "training", "language learning", "workforce"], "research"),
  invention("trust-identity-plane", "Trust & Identity Plane", "security", [
    "passkeys", "step-up auth", "RBAC/ABAC", "tenant isolation", "session policy", "device trust",
    "audit evidence", "biometric-template avoidance", "recovery controls"
  ], ["all products"], "research"),
  invention("adapter-marketplace-gateway", "Adapter Marketplace Gateway", "integrations", [
    "provider contracts", "MCP-compatible tools", "webhooks", "event adapters", "schema transforms",
    "credential vault boundary", "rate limits", "health/readiness", "license status"
  ], ["external services", "external inputs", "sub-apps", "marketplace"], "research"),
  invention("research-to-runtime-foundry", "Research-to-Runtime Foundry", "research_ops", [
    "view source", "save snapshot", "download permitted artifact", "license classification",
    "security review", "sandbox", "benchmark", "test evidence", "scale plan", "promotion gate"
  ], ["repositories", "papers", "PDFs", "Google Scholar", "vendor docs", "market research"], "research"),
  invention("agent-identity-authority-mesh", "Agent Identity & Authority Mesh", "security", [
    "unique agent/workload identities", "delegated scopes", "short-lived credentials", "identity-to-tool binding",
    "signed mutation evidence", "non-repudiation", "step-up approval", "revocation and kill switch"
  ], ["agents", "integrations", "payments", "automation", "admin"], "research"),
  invention("protocol-interop-fabric", "Protocol Interop Fabric", "integrations", [
    "stateless MCP gateway", "capability discovery/cache", "method/name routing", "task extensions",
    "API/webhook adaptation", "issuer validation", "schema/version translation", "deprecation windows"
  ], ["external adapters", "internal services", "agent tools", "marketplace"], "research"),
  invention("realtime-coordination-engine", "Realtime Coordination Engine", "realtime", [
    "logical session actors", "ordered mutations", "presence", "durable room/entity state",
    "reconnect and replay", "WebSocket/SSE bridge", "hotspot partitioning", "latency/error budgets"
  ], ["collaboration", "dispatch", "gaming-adjacent state", "live support", "venues"], "research"),
  invention("simulation-rehearsal-engine", "Simulation & Rehearsal Engine", "simulation", [
    "digital-twin scenarios", "synthetic data", "policy rehearsal", "failure injection",
    "workflow replay", "what-if branches", "canary mirroring", "simulation-to-reality metrics"
  ], ["business operations", "manufacturing", "robotics", "logistics", "releases"], "research"),
  invention("reality-model-learning-loop", "Reality-to-Model Learning Loop", "physical_ai", [
    "camera/sensor/telemetry ingest", "observed-to-modeled state", "multimodal extraction", "context graph",
    "human confirmation", "predicted next state", "approved action proposals", "outcome feedback"
  ], ["field operations", "manufacturing", "retail", "facilities", "media capture"], "research"),
  invention("creative-continuity-graph", "Creative Continuity Graph", "media", [
    "character/brand identity", "style and asset graph", "rights/provenance", "cross-modal identifiers",
    "version history", "prompt/edit lineage", "scene/location continuity", "provider-portable exports"
  ], ["Creator Studio", "film", "music", "advertising", "social", "games"], "research"),
  invention("adaptive-media-delivery-engine", "Adaptive Media Delivery Engine", "streaming", [
    "AV2/AV1/fallback codec ladder", "4K/HDR profiles", "bitrate/resolution adaptation", "device capability",
    "GPU decode budget", "CDN/storage economics", "quality telemetry", "offline/download policy"
  ], ["streaming", "Creator Studio", "training", "cinematic web", "video commerce"], "research"),
  invention("market-signal-radar", "Market Signal Radar", "market_intelligence", [
    "web/repository/paper intake", "source provenance", "freshness scoring", "deduplication/corroboration",
    "competitor capability map", "adoption/cost/security signals", "dated snapshots", "implementation candidate queue"
  ], ["strategy", "research", "product planning", "Growth Studio", "technology radar"], "research")
]);

const DOMAIN_COVERAGE = Object.freeze([
  coverage("agentic_ai_llm_rag", ["governed-agent-mesh", "evidence-rag-fabric", "deterministic-workflow-compiler", "compute-routing-fabric"], "build_core", "Models may propose and reason; SONARA policy, tenancy, approvals, budgets, evidence, and state transitions remain authoritative."),
  coverage("deterministic_workflows_automation", ["deterministic-workflow-compiler", "self-healing-reliability-supervisor"], "build_core", "Version workflows, legal transitions, retry/compensation behavior, idempotency, and replay evidence."),
  coverage("small_and_large_business_management", ["vertical-operations-kernel", "business-digital-twin-graph", "communications-fabric"], "build_core", "Shared business primitives should serve both small-business simplicity and enterprise governance without separate source-of-truth systems."),
  coverage("pos_kiosk_restaurant_retail", ["adaptive-pos-kiosk-engine", "vertical-operations-kernel", "machine-commerce-guard", "universal-entitlement-ledger"], "build_core_with_payment_adapters", "Keep card credentials and payment-network authority outside application/model context; support offline-safe operational state."),
  coverage("trucking_delivery_logistics", ["field-intelligence-mesh", "predictive-operations-engine", "business-digital-twin-graph"], "compose_with_telematics_adapters", "Use partner telematics/maps for vehicle/device facts; SONARA owns jobs, dispatch, evidence, optimization, and business workflow."),
  coverage("hvac_electrical_plumbing_carpentry_trades", ["field-intelligence-mesh", "vertical-operations-kernel", "predictive-operations-engine"], "build_vertical_pack", "Prioritize estimates, scheduling, dispatch, field evidence, inventory, invoices, customer communication, and explainable automation."),
  coverage("project_management_and_service_delivery", ["deterministic-workflow-compiler", "vertical-operations-kernel", "communications-fabric"], "build_core", "Unify projects, tasks, dependencies, documents, approvals, time, costs, status, and deliverables."),
  coverage("waste_utilities_facilities", ["field-intelligence-mesh", "modular-digital-twin-composer", "predictive-operations-engine"], "compose_with_industry_adapters", "Keep safety-critical utility control outside SONARA; manage work, telemetry, routing, assets, incidents, and evidence."),
  coverage("payments_banking_transfer_finance", ["machine-commerce-guard", "universal-entitlement-ledger", "deterministic-workflow-compiler"], "regulated_provider_adapter_first", "SONARA may orchestrate authorized payment workflows but is not a bank, payment network, custodian, or autonomous money manager."),
  coverage("investment_risk_insurance", ["predictive-operations-engine", "evidence-rag-fabric"], "decision_support_only_initially", "Use evidence-backed analysis, scenarios, audit trails, and explicit uncertainty; no autonomous trading, underwriting, or personalized regulated advice by default."),
  coverage("scheduling_calendar_reservations_rsvp", ["deterministic-workflow-compiler", "communications-fabric", "vertical-operations-kernel"], "build_core", "Canonical availability, conflict handling, reminders, time zones, cancellation rules, waitlists, and calendar adapters."),
  coverage("cleaning_and_home_services", ["field-intelligence-mesh", "vertical-operations-kernel", "communications-fabric"], "build_vertical_pack", "Reuse trades/service primitives for bookings, crews, checklists, photos, recurring service, invoices, and customer updates."),
  coverage("customer_service_chat_voice_text", ["communications-fabric", "governed-agent-mesh", "evidence-rag-fabric"], "build_core_with_channel_adapters", "Keep consent, escalation, provenance, customer identity, delivery evidence, and human handoff visible."),
  coverage("ecommerce_ordering_buying_selling", ["machine-commerce-guard", "vertical-operations-kernel", "universal-entitlement-ledger"], "build_core_with_marketplace_adapters", "Catalog, inventory, price, order, fulfillment, returns, refunds, tax evidence, and delegated purchase policy share one commerce graph."),
  coverage("social_media_marketing_seo_campaigns", ["growth-experiment-loop", "communications-fabric", "adapter-marketplace-gateway"], "build_measurement_core_partner_distribution", "Own campaign/evidence/attribution state; publish through governed platform adapters and respect platform terms."),
  coverage("video_audio_images_movies_books_music_podcasting", ["media-production-fabric", "spatial-experience-engine", "universal-entitlement-ledger"], "build_creator_core_with_specialized_workers", "Track editable project state, rights/provenance, versions, rendering, exports, distribution, and monetization."),
  coverage("gaming_ar_3d_interactive", ["spatial-experience-engine", "media-production-fabric", "compute-routing-fabric"], "experience_engine_not_general_game_engine", "Borrow real-time state, telemetry, entitlements, progression, GPU budgeting, and spatial interaction while retaining accessible non-3D fallbacks."),
  coverage("manufacturing_food_production_robotics", ["modular-digital-twin-composer", "predictive-operations-engine", "business-digital-twin-graph"], "management_layer_partner_machine_control", "Own planning, quality, maintenance, inventory, traceability, and telemetry evidence; specialist systems retain safety-critical machine control."),
  coverage("real_estate_renting_property", ["vertical-operations-kernel", "business-digital-twin-graph", "communications-fabric"], "build_vertical_pack_with_listing_adapters", "Model properties, units, tenants/customers, maintenance, bookings/tours, documents, payments, and provider/listing integrations."),
  coverage("jobs_listing_posting_workforce", ["vertical-operations-kernel", "growth-experiment-loop", "communications-fabric"], "build_marketplace_workflow", "Support job/service listings, applications, scheduling, skills evidence, messaging, hiring workflow, and anti-discrimination controls."),
  coverage("education_classroom_translation_learning", ["learning-translation-engine", "evidence-rag-fabric", "communications-fabric"], "build_core_with_content_adapters", "Preserve source provenance, accessibility, teacher/operator oversight, assessment evidence, and purpose-limited learner data."),
  coverage("government_public_access_venues", ["deterministic-workflow-compiler", "evidence-rag-fabric", "communications-fabric"], "forms_records_accessibility_partner_first", "Focus on public forms, records, scheduling, accessibility, service delivery, retention, and procurement/security evidence; no weapons or tactical capability."),
  coverage("blockchain_decentralized_ledgers", ["adapter-marketplace-gateway", "machine-commerce-guard", "business-digital-twin-graph"], "optional_settlement_or_provenance_adapter", "Use only when verifiable multi-party settlement/provenance adds value; do not replace transactional databases merely for decentralization."),
  coverage("security_monitoring_biometrics", ["trust-identity-plane", "self-healing-reliability-supervisor", "governed-agent-mesh"], "build_security_plane_specialist_adapters", "Default deny, least privilege, passkeys, audit, threat detection, secrets boundaries, and minimal biometric data; avoid storing raw biometric templates when not necessary."),
  coverage("mobile_camera_gps_gyroscope_notifications_haptics", ["field-intelligence-mesh", "spatial-experience-engine", "communications-fabric", "trust-identity-plane"], "permission_scoped_progressive_enhancement", "Device capabilities require explicit user permission, purpose limitation, foreground/background policy, data minimization, and physical-device testing."),
  coverage("subscriptions_refunds_in_app_purchases", ["universal-entitlement-ledger", "machine-commerce-guard"], "canonical_server_entitlements", "Reconcile signed store/provider evidence to one entitlement state machine; never trust client-only paid state."),
  coverage("websites_subapps_directories_profiles", ["vertical-operations-kernel", "growth-experiment-loop", "trust-identity-plane"], "shared_shell_and_tenant_graph", "Sub-apps reuse identity, tenancy, navigation, permissions, search, analytics, accessibility, and deployment contracts."),
  coverage("databases_storage_search_vector_memory", ["evidence-rag-fabric", "business-digital-twin-graph", "adapter-marketplace-gateway"], "postgres_source_of_truth_specialized_indexes", "Use transactional authority for canonical records and specialized search/vector/analytics stores as rebuildable projections where possible."),
  coverage("cloud_compute_gpu_cpu_datacenters", ["compute-routing-fabric", "self-healing-reliability-supervisor"], "provider_neutral_workload_routing", "Route workloads by quality, latency, privacy, cost, capacity, and failure domain; expose unit economics per tenant/workflow."),
  coverage("operating_systems_desktop_mobile_packaging", ["trust-identity-plane", "spatial-experience-engine", "adapter-marketplace-gateway"], "web_control_plane_plus_native_wrappers", "SONARA OS is an application/business operating system, not a hardware kernel; native packaging adds device capabilities without duplicating business logic."),
  coverage("analytics_statistics_measurement_forecasting", ["predictive-operations-engine", "growth-experiment-loop", "evidence-rag-fabric"], "build_shared_measurement_plane", "Distinguish descriptive metrics, causal experiments, probabilistic forecasts, and decision rules; retain assumptions and confidence."),
  coverage("external_internal_adapters_services_inputs", ["adapter-marketplace-gateway", "deterministic-workflow-compiler", "trust-identity-plane"], "contract_first", "Every adapter declares identity, schema, auth, rate limits, health, idempotency, data class, license/terms, rollback, and failure behavior."),
  coverage("autocad_cad_engineering_design", ["media-production-fabric", "modular-digital-twin-composer", "adapter-marketplace-gateway"], "file_interop_and_external_tool_boundary", "Prefer standards/file interchange, previews, metadata, approvals, and manufacturing handoff over recreating mature CAD kernels."),
  coverage("creator_artist_sponsorship_venues_events", ["media-production-fabric", "growth-experiment-loop", "vertical-operations-kernel", "machine-commerce-guard"], "compose_creator_commerce_and_venue_ops", "Unify rights, assets, campaigns, sponsors, bookings, tickets, merchandise, audience/customer records, and settlement evidence."),
  coverage("dating_community_social_discovery", ["communications-fabric", "growth-experiment-loop", "trust-identity-plane"], "safety_first_vertical_pack", "Identity, consent, reporting, blocking, moderation, abuse prevention, recommendation transparency, and privacy precede growth optimization."),
  coverage("search_engines_and_discovery", ["evidence-rag-fabric", "growth-experiment-loop", "adapter-marketplace-gateway"], "hybrid_search_and_external_distribution", "Combine structured data, lexical/vector retrieval, provenance, SEO, AI-readable catalogs, and platform adapters rather than trying to replace global search engines.")
]);

const FORMULAS = Object.freeze([
  Object.freeze({
    key: "invention_readiness_score",
    expression: "round(20*evidence + 15*reuse + 15*workflow_depth + 10*distribution + 10*margin + 15*reliability + 15*security - 10*integration_risk - 10*compliance_risk) / 5",
    inputs: ["evidence", "reuse", "workflow_depth", "distribution", "margin", "reliability", "security", "integration_risk", "compliance_risk"],
    inputScale: "0_to_5",
    outputRange: "0_to_100",
    meaning: "internal deterministic prioritization heuristic; not a market forecast"
  }),
  Object.freeze({
    key: "automation_value_density",
    expression: "(hours_saved * loaded_hourly_cost + error_cost_avoided + incremental_contribution) / max(1, monthly_platform_cost)",
    meaning: "measures operational value against platform cost; inputs must be evidence-backed"
  }),
  Object.freeze({
    key: "agent_action_risk",
    expression: "impact * irreversibility * externality * privilege * uncertainty",
    inputScale: "normalized",
    meaning: "higher values demand stronger authorization, verification, and human approval"
  }),
  Object.freeze({
    key: "retrieval_quality",
    expression: "grounded_answer_rate * citation_precision * permission_correctness * freshness_factor",
    meaning: "RAG quality must include access-control correctness and source freshness, not semantic relevance alone"
  }),
  Object.freeze({
    key: "workflow_reliability",
    expression: "successful_terminal_runs / max(1, eligible_runs)",
    meaning: "terminal success after retries, dedupe, and compensation; exclude cancelled-by-user runs"
  }),
  Object.freeze({
    key: "unit_economics_per_workflow",
    expression: "revenue_or_value - model_cost - compute_cost - provider_cost - support_cost - expected_failure_cost",
    meaning: "workflow-level contribution estimate; no guarantee of realized profit"
  }),
  Object.freeze({
    key: "agent_authority_envelope",
    expression: "min(identity_scope, tenant_scope, tool_scope, data_scope, spend_scope, approval_scope)",
    meaning: "an agent action can never exceed the narrowest independently authorized scope"
  }),
  Object.freeze({
    key: "interoperability_friction",
    expression: "protocol_specificity * auth_complexity * schema_drift * state_coupling",
    meaning: "higher values favor a stronger provider-neutral adapter or stateless protocol boundary"
  }),
  Object.freeze({
    key: "simulation_reality_fidelity",
    expression: "observed_feature_coverage * temporal_alignment * validation_accuracy * environment_match",
    meaning: "tracks whether rehearsal evidence is representative enough to justify a bounded real-world canary"
  }),
  Object.freeze({
    key: "creative_continuity",
    expression: "identity_consistency * rights_coverage * provenance_coverage * cross_modal_alignment",
    meaning: "scores continuity as durable project metadata rather than prompt similarity alone"
  }),
  Object.freeze({
    key: "realtime_coordination_health",
    expression: "ordered_commit_rate * reconnect_recovery_rate * state_convergence / max(1, p95_latency_factor)",
    meaning: "combines correctness, recovery, convergence, and latency for realtime shared state"
  })
]);

function getInventionSystemsIntelligence() {
  return {
    ok: true,
    version: REGISTRY_VERSION,
    snapshotDate: SNAPSHOT_DATE,
    authority: "research_and_design_only",
    runtimeAuthority: false,
    executionEnabled: false,
    claims: {
      productionReady: false,
      patentStatus: "not_assessed",
      legalNovelty: "not_assessed",
      marketForecast: false
    },
    lifecycle: [...MATURITY_STAGES],
    promotionGates: JSON.parse(JSON.stringify(PROMOTION_GATES)),
    counts: {
      marketSignals: MARKET_SIGNALS.length,
      inventionSystems: INVENTION_SYSTEMS.length,
      domainCoverage: DOMAIN_COVERAGE.length,
      formulas: FORMULAS.length
    },
    marketSignals: MARKET_SIGNALS.map(clone),
    inventionSystems: INVENTION_SYSTEMS.map(clone),
    domainCoverage: DOMAIN_COVERAGE.map(clone),
    formulas: FORMULAS.map(clone),
    platformThesis: [
      "one governed event and workflow fabric across products",
      "deterministic state transitions around probabilistic models",
      "provider-neutral adapters instead of duplicated business logic",
      "tenant-scoped evidence and memory",
      "human approval proportional to action risk",
      "progressive enhancement for GPU, XR, sensors and device features",
      "vertical products assembled from reusable primitives",
      "research evidence never grants execution authority",
      "identity and authority are first-class resources for every agent and workload",
      "simulation precedes irreversible real-world execution",
      "protocol interoperability must survive provider and model churn",
      "creative continuity and provenance are durable data, not prompt-only state"
    ],
    implementationSequence: [
      "research-to-runtime foundry and evidence registry",
      "deterministic workflow compiler plus agent authority envelope",
      "evidence RAG fabric and observability",
      "business digital twin graph and vertical operations kernel",
      "commerce/entitlements/POS with machine-commerce guard",
      "field/geospatial/offline synchronization",
      "media and growth fabrics",
      "digital-twin and predictive industrial modules",
      "spatial/WebGPU/WebXR surfaces after performance and accessibility gates",
      "agent identity authority mesh and stateless protocol gateway",
      "simulation rehearsal plus reality-to-model feedback loop",
      "realtime coordination for collaboration, dispatch, sessions, and live state",
      "creative continuity plus adaptive media delivery after codec/device benchmarks"
    ]
  };
}

function scoreInventionOpportunity(input = {}) {
  const values = {
    evidence: bounded(input.evidence),
    reuse: bounded(input.reuse),
    workflow_depth: bounded(input.workflow_depth ?? input.workflowDepth),
    distribution: bounded(input.distribution),
    margin: bounded(input.margin),
    reliability: bounded(input.reliability),
    security: bounded(input.security),
    integration_risk: bounded(input.integration_risk ?? input.integrationRisk),
    compliance_risk: bounded(input.compliance_risk ?? input.complianceRisk)
  };
  const raw =
    20 * values.evidence +
    15 * values.reuse +
    15 * values.workflow_depth +
    10 * values.distribution +
    10 * values.margin +
    15 * values.reliability +
    15 * values.security -
    10 * values.integration_risk -
    10 * values.compliance_risk;
  return Math.max(0, Math.min(100, Math.round(raw / 5)));
}

function promotionReadiness(currentStage, evidence = {}) {
  const currentIndex = MATURITY_STAGES.indexOf(currentStage);
  if (currentIndex < 0 || currentIndex >= MATURITY_STAGES.length - 1) {
    return { ok: false, currentStage, nextStage: null, missing: ["valid_non_terminal_stage_required"] };
  }
  const nextStage = MATURITY_STAGES[currentIndex + 1];
  const required = PROMOTION_GATES[nextStage] || [];
  const missing = required.filter((key) => evidence[key] !== true);
  return {
    ok: missing.length === 0,
    currentStage,
    nextStage,
    required: [...required],
    missing
  };
}

function coverage(key, systemKeys, strategy, boundary) {
  return Object.freeze({
    key,
    systemKeys: Object.freeze([...systemKeys]),
    strategy,
    boundary
  });
}

function signal(key, domain, source, observedAt, sourceUrl, finding, designRule) {
  return Object.freeze({ key, domain, source, observedAt, sourceUrl, finding, designRule });
}

function invention(key, name, domain, primitives, productFit, maturity) {
  return Object.freeze({
    key,
    name,
    domain,
    maturity,
    executionEnabled: false,
    productionClaim: false,
    primitives: Object.freeze([...primitives]),
    productFit: Object.freeze([...productFit]),
    boundaries: Object.freeze([
      "tenant_scoped",
      "least_privilege",
      "approval_for_high_impact_actions",
      "observable",
      "idempotent_where_state_changes",
      "provider_neutral",
      "rollback_or_compensation_required"
    ])
  });
}

function bounded(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  SNAPSHOT_DATE,
  REGISTRY_VERSION,
  MATURITY_STAGES,
  PROMOTION_GATES,
  MARKET_SIGNALS,
  INVENTION_SYSTEMS,
  DOMAIN_COVERAGE,
  FORMULAS,
  getInventionSystemsIntelligence,
  scoreInventionOpportunity,
  promotionReadiness
};
