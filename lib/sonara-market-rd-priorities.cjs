// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const MARKET_RD_PRIORITIES = Object.freeze({
  version: "2026-09-23",
  asOf: "2026-09-23",
  decisionRule: "No market signal becomes roadmap work until SONARA records a reachable segment, a measurable customer commitment, an owner, a cost ceiling, and a Product Lifecycle validation decision.",
  portfolioConclusion: "SONARA should consolidate fragmented work rather than imitate category leaders feature-for-feature. The portfolio advantage is a connected, affordable, governed path from first offer to transaction, original asset to rights-aware release, and consented customer evidence to measured growth.",
  crossCompanyFixes: Object.freeze([
    Object.freeze({
      key: "time_to_value",
      priority: 1,
      action: "Instrument the first-value event and elapsed time from account creation for every studio.",
      measures: ["median time to first value", "activation rate", "setup abandonment", "assisted setup rate"],
      reason: "Current small-team buyers prioritize ease of use, stack simplification, and clear outcomes over a larger feature list."
    }),
    Object.freeze({
      key: "shared_customer_and_consent_spine",
      priority: 2,
      action: "Use one portable customer, consent, suppression, source, asset, transaction, and attribution timeline across all studios.",
      measures: ["duplicate customer rate", "consent completeness", "cross-studio handoff completion", "export success rate"],
      reason: "First-party evidence, privacy-safe measurement, ownership, and reduced tool fragmentation are recurring needs in all three markets."
    }),
    Object.freeze({
      key: "value_and_cost_scorecards",
      priority: 3,
      action: "Attach value realization and cost-to-serve scorecards to every launched workflow and provider-backed operation.",
      measures: ["gross margin by workflow", "provider cost per completed outcome", "support minutes per active account", "retained usage"],
      reason: "SONARA's affordable pricing is defensible only when cost-bearing usage and support are measured and bounded."
    }),
    Object.freeze({
      key: "portable_evidence",
      priority: 4,
      action: "Make imports, exports, provenance, approvals, and audit evidence first-class product capabilities.",
      measures: ["successful import rate", "successful export rate", "records with provenance", "switching-friction incidents"],
      reason: "Customer ownership and portability differentiate SONARA from closed or percentage-fee ecosystems."
    }),
    Object.freeze({
      key: "database_contract_convergence",
      priority: 5,
      action: "Reduce database redundancy by treating tables, indexes, policies, event envelopes, cursors, and read models as one governed data-plane contract rather than feature-local inventions.",
      measures: ["duplicate index count", "overlapping policy findings", "migration replay pass rate", "p95 query latency", "tables covered by canonical ownership"],
      reason: "A broad operating system benefits more from one explainable data plane than from additional isolated schemas."
    }),
    Object.freeze({
      key: "durable_execution_spine",
      priority: 6,
      action: "Make long-running work use one persisted execution model with idempotency, checkpoints, retries, deadlines, human waits, compensation, and evidence.",
      measures: ["replay-safe workflow rate", "duplicate-effect incidents", "dead-letter age", "recovery completion", "approval wait time"],
      reason: "Orders, fulfillment, media jobs, research ingestion, provider syncs, and agents all fail in the same ways when execution state is implicit."
    }),
    Object.freeze({
      key: "nexus_navigation_and_attention",
      priority: 7,
      action: "Turn Nexus into the single orientation layer for navigation, global search, recent work, notifications, command actions, contextual help, and cross-studio handoffs.",
      measures: ["time to target task", "navigation backtrack rate", "search success", "notification action rate", "keyboard or command usage"],
      reason: "A large platform stays approachable when users can always answer where they are, what changed, what needs attention, and what action is safe next."
    }),
    Object.freeze({
      key: "research_to_runtime_graph",
      priority: 8,
      action: "Unify approved research, documents, public knowledge APIs, citations, RAG retrieval, freshness, permissions, and evaluation into a reusable research graph.",
      measures: ["citation completeness", "retrieval precision", "freshness violations", "permission denials", "answer-evaluation pass rate"],
      reason: "Academic, technical, market, legal, historical, and library research should use one provenance-aware retrieval contract instead of separate search experiences."
    }),
    Object.freeze({
      key: "performance_and_offline_quality",
      priority: 9,
      action: "Treat response time, offline tolerance, cacheability, progressive loading, accessibility, and graceful degradation as product features with release thresholds.",
      measures: ["p75 LCP", "p75 INP", "API p95", "offline task completion", "error recovery rate", "accessibility regression count"],
      reason: "Speed and predictability are core usability advantages for field, mobile, kiosk, creator, and operations workflows."
    }),
    Object.freeze({
      key: "vertical_composition_not_forks",
      priority: 10,
      action: "Build restaurants, trades, transport, retail, manufacturing, rentals, education, creator, and service businesses from shared primitives plus bounded vertical templates.",
      measures: ["shared primitive reuse", "vertical setup time", "vertical-specific code ratio", "cross-vertical defect reuse", "template activation"],
      reason: "One shared operating system scales farther than separate applications that duplicate identity, commerce, scheduling, communication, analytics, and security."
    })
  ]),
  advancementWave: Object.freeze({
    title: "SONARA Platform Advancement Wave — 2026-09-23",
    objective: "Make the application feel simpler while the platform becomes broader: one kernel, one data plane, one execution spine, one attention layer, and composable capability packs.",
    rules: Object.freeze([
      "Research presence never grants runtime authority.",
      "Prefer existing SONARA primitives before adding dependencies or tables.",
      "Use deterministic state machines for money, permissions, identity, fulfillment, inventory, safety, and audit.",
      "Use models for interpretation, planning, ranking, drafting, translation, and retrieval support; deterministic commands validate all side effects.",
      "Every external adapter has explicit tenant scope, capability scope, credentials outside model context, provider receipts, retry rules, health state, and deprecation state.",
      "Every public-facing interaction has a useful degraded mode when an optional provider is unavailable."
    ]),
    capabilityPacks: Object.freeze([
      Object.freeze({
        key: "data_workflow_reliability",
        name: "Data + Workflow Reliability",
        outcome: "One durable operational spine for records, events, jobs, queues, approvals, retries, reconciliation, and projections.",
        reuse: ["PostgreSQL/Supabase", "event_outbox", "event_delivery_attempts", "workflow_runs", "pgmq", "pg_cron", "OpenTelemetry"],
        next: ["duplicate-index and overlapping-policy cleanup", "canonical integration cursors", "read-model ownership", "queue and outbox responsibility rules", "SLOs for high-volume tables"],
        success: ["no duplicate effects under replay", "bounded queue age", "measured query p95", "migration replay remains green"]
      }),
      Object.freeze({
        key: "nexus_experience",
        name: "Nexus Experience",
        outcome: "A calm, fun, fast front door to every workspace and sub-application.",
        reuse: ["global navigation", "search", "notifications", "sub-app registry", "workspace context"],
        next: ["command palette", "recent and pinned work", "contextual breadcrumbs", "unified notification center", "progressive disclosure", "keyboard and touch parity"],
        success: ["fewer clicks to frequent tasks", "lower navigation abandonment", "higher successful search-to-action rate"]
      }),
      Object.freeze({
        key: "notifications_sound_haptics",
        name: "Notifications + Sound + Haptics",
        outcome: "Useful attention signals without noise.",
        reuse: ["user_notifications", "push subscriptions", "event outbox", "user preferences"],
        next: ["topic-level preferences", "priority and quiet-hours policy", "deduplication and bundling", "accessible visual alternatives", "optional sound and vibration cues", "delivery receipts"],
        success: ["low duplicate-notification rate", "measured action rate", "user-controlled quiet behavior"]
      }),
      Object.freeze({
        key: "research_library_rag",
        name: "Research + Library + RAG",
        outcome: "One source-grounded research experience across technical papers, public collections, company data, PDFs, books, history, science, and approved web sources.",
        reuse: ["research_sources", "vector extension", "grounded retrieval contract", "prompt library", "source permission model"],
        next: ["OpenAlex adapter evaluation", "Crossref metadata adapter", "Library of Congress public API adapter", "hybrid lexical/vector retrieval", "citation graph", "freshness and retraction signals", "translation-aware indexing"],
        success: ["citation coverage", "tenant isolation", "relevance evaluation", "freshness accuracy", "rights-aware source handling"]
      }),
      Object.freeze({
        key: "maps_mobility_dispatch",
        name: "Maps + Mobility + Dispatch",
        outcome: "Reusable maps, routing, service areas, fleet, transit, delivery, field dispatch, and mobility-business primitives.",
        reuse: ["transit_updates", "locations", "jobs", "schedules", "assets", "provider adapters"],
        next: ["MapLibre rendering evaluation", "Valhalla routing and matrix evaluation", "GTFS/GTFS-Realtime ingestion contracts", "geofences and service areas", "route evidence", "dispatch state machine"],
        success: ["route latency", "map interaction performance", "position freshness", "dispatch completion", "offline fallback"]
      }),
      Object.freeze({
        key: "realtime_communications_media",
        name: "Realtime Communications + Media",
        outcome: "Voice, video, streaming, recording, transcription, podcasting, customer communication, and AI-assisted sessions without forcing realtime media through ordinary JSON request paths.",
        reuse: ["call_sessions", "media-processing contract", "generation jobs", "storage", "consent records"],
        next: ["LiveKit-style SFU adapter evaluation", "recording consent ledger", "FFmpeg worker profile", "transcription quality benchmarks", "stream-health telemetry", "media retention policy"],
        success: ["join success", "media p95 latency", "recording consent completeness", "transcription quality", "worker cost per minute"]
      }),
      Object.freeze({
        key: "deterministic_math_and_forecasting",
        name: "Deterministic Math + Forecasting",
        outcome: "Reusable formulas for pricing, scheduling, routing, inventory, staffing, reliability, statistics, finance, geometry, optimization, and scenario planning.",
        reuse: ["formula library", "analytics", "market intelligence", "business records"],
        next: ["units and dimensions contract", "formula provenance and versioning", "confidence intervals", "optimization constraints", "scenario comparison", "calibration and backtesting"],
        success: ["reproducible results", "formula version traceability", "prediction calibration", "zero silent unit mismatch"]
      }),
      Object.freeze({
        key: "vertical_business_composition",
        name: "Vertical Business Composition",
        outcome: "Customers can create service, retail, restaurant, logistics, rental, creator, manufacturing, education, and professional businesses from shared modules.",
        reuse: ["business vertical templates", "sub-app records", "catalog", "orders", "bookings", "jobs", "invoices", "payments", "customers", "staff"],
        next: ["capability-based templates", "vertical onboarding", "vertical KPI packs", "safe default workflows", "industry-specific field schemas without new tenant tables per customer"],
        success: ["time to configured business", "template completion", "shared-module reuse", "first transaction"]
      }),
      Object.freeze({
        key: "graphics_game_and_3d",
        name: "Graphics + Game + 3D Interaction",
        outcome: "Use game-quality interaction patterns, simulation, 3D visualization, maps, product scenes, training, and interactive media where they improve a real workflow.",
        reuse: ["creator assets", "media jobs", "cinematic sites", "maps"],
        next: ["Godot as external research/tooling candidate", "WebGPU/WebGL capability detection", "performance budgets by device tier", "reduced-motion fallback", "asset LOD and streaming rules"],
        success: ["stable frame time", "device compatibility", "accessible fallback", "measured task benefit over 2D"]
      }),
      Object.freeze({
        key: "security_observability_quality",
        name: "Security + Observability + Quality",
        outcome: "Every critical action is observable, attributable, reversible where possible, and verified by independent evidence.",
        reuse: ["OpenTelemetry", "audit events", "security reviews", "release evidence", "provider health", "cross-tenant tests"],
        next: ["trace-to-business-outcome correlation", "database advisor budget", "policy-overlap detection", "security event timelines", "dependency and repository trust evidence", "load and chaos thresholds"],
        success: ["mean time to detect", "mean time to recover", "cross-tenant isolation pass rate", "release SLO pass rate", "critical finding age"]
      }),
      Object.freeze({
        key: "connector_ecosystem",
        name: "Connector + Adapter Ecosystem",
        outcome: "A single governed way to connect analytics, commerce, payments, CRM, calendars, communications, storage, logistics, government, and specialist vertical systems.",
        reuse: ["business_integration_connections", "provider registry", "connector verification", "event outbox"],
        next: ["capability-level connection state", "sync cursors and checkpoints", "webhook inbox and replay", "provider receipts", "version compatibility", "marketplace manifests"],
        success: ["sync freshness", "replay correctness", "scope-mismatch rate", "provider-error recovery", "time to add a read-only connector"]
      })
    ]),
    externalResearchCandidates: Object.freeze([
      Object.freeze({ name: "MapLibre GL JS", role: "interactive maps", posture: "evaluate as a bounded map-rendering dependency or adapter" }),
      Object.freeze({ name: "Valhalla", role: "multimodal routing, matrices, isochrones and map matching", posture: "evaluate as a dedicated routing service" }),
      Object.freeze({ name: "GTFS / GTFS Realtime", role: "public transit schedules, vehicle positions, trip updates and alerts", posture: "standards adapter, provider feed terms still apply" }),
      Object.freeze({ name: "LiveKit", role: "realtime voice, video and AI-agent media transport", posture: "dedicated realtime service; privacy, retention and cost review required" }),
      Object.freeze({ name: "Temporal", role: "durable execution reference", posture: "research and benchmark against SONARA's existing Postgres/outbox model before adding another control plane" }),
      Object.freeze({ name: "Qdrant", role: "vector, hybrid and offline/edge retrieval reference", posture: "benchmark only if pgvector no longer meets measured retrieval requirements" }),
      Object.freeze({ name: "OpenTelemetry", role: "vendor-neutral traces, metrics and logs", posture: "already aligned with SONARA observability direction" }),
      Object.freeze({ name: "Prometheus", role: "time-series metrics and alerting", posture: "optional operations backend behind OpenTelemetry-compatible instrumentation" }),
      Object.freeze({ name: "Godot", role: "2D/3D interactive and simulation tooling", posture: "research/tooling candidate, not a reason to turn ordinary workflows into 3D" }),
      Object.freeze({ name: "FFmpeg", role: "media transform and encoding", posture: "isolated worker candidate; build configuration and codec licensing require review" }),
      Object.freeze({ name: "OpenAlex", role: "scholarly graph and bibliographic discovery", posture: "public research adapter with caching, budget and provenance controls" }),
      Object.freeze({ name: "Crossref REST API", role: "DOI and publisher-deposited scholarly metadata", posture: "public metadata adapter with polite identification and caching" }),
      Object.freeze({ name: "Library of Congress APIs", role: "public digital collections and structured cultural/historical metadata", posture: "public research adapter with rate-limit and rights-aware display controls" })
    ]),
    interfaceRules: Object.freeze([
      "Use progressive disclosure: show the next useful action first and advanced controls only when relevant.",
      "Keep primary navigation stable across studios; context changes, navigation grammar does not.",
      "Use maps, charts, 3D, animation, sound, haptics, and gamification only when they improve comprehension or task completion.",
      "Respect reduced motion, text scaling, contrast, keyboard access, screen readers, touch targets, and alternate cues.",
      "Prefer optimistic interaction only when reconciliation can prove the final state; money and destructive actions stay confirmed.",
      "Make latency visible with skeletons, progress, resumable jobs, and clear queued/running/completed states rather than frozen screens."
    ])
  }),
  companies: Object.freeze({
    business_builder: Object.freeze({
      strategicPosition: "The guided operating path for a solopreneur or small local team to complete and repeat a first transaction.",
      primaryBets: [
        "First Transaction Mode with one guided offer-to-payment-to-delivery checklist.",
        "Vertical starter packs for service operators, food and mobile vendors, consultants, and creator-led services.",
        "CSV and provider-assisted import/export with field mapping and ownership evidence.",
        "Security, recovery, permissions, and payment-boundary readiness.",
        "Posted-record cash-flow snapshots that do not claim to replace accounting, tax, payroll, or banking products."
      ],
      validationExperiments: [
        Object.freeze({ name: "concierge first transaction", method: "Run a guided setup with 10 representative owners", commitment: "publish an offer and attempt a real booking, order, or payment", success: "at least 6 complete the first-value event within 48 hours" }),
        Object.freeze({ name: "vertical starter pack test", method: "Test four starter packs with segment-specific landing and onboarding flows", commitment: "choose a pack and complete its required records", success: "one pack improves activation by at least 20% over blank setup" }),
        Object.freeze({ name: "switching import trial", method: "Import real customer or service records from a commonly used tool", commitment: "owner verifies mapped records", success: "90% of required fields import without manual re-entry" })
      ],
      successMetrics: ["first transaction activation", "median setup time", "repeat customer rate", "weekly retained operators", "support minutes per activated account"],
      killCriteria: ["customers still need multiple external tools before first value", "support cost exceeds plan economics", "starter packs do not outperform guided generic setup"]
    }),
    creator_studio: Object.freeze({
      strategicPosition: "The rights-aware operating system that turns original work into a portable release, client, archive, or brand-partnership package.",
      primaryBets: [
        "Release Package Builder with assets, versions, collaborators, approvals, rights, consent, source references, and provenance.",
        "Portable exports for DAWs, distributors, clients, brand partners, and archives.",
        "Creator-owned fan, buyer, collaborator, and partner records with consent and suppression controls.",
        "Brand Deal Operations covering brief, deliverables, approvals, disclosure readiness, payment status, and measurement handoff.",
        "Human-controlled generation with provider metadata, originality checks, and identity-imitation restrictions."
      ],
      validationExperiments: [
        Object.freeze({ name: "portable release package", method: "Have 10 creators package an existing project", commitment: "export and use the package outside SONARA", success: "at least 7 complete export without staff intervention" }),
        Object.freeze({ name: "brand deal operations pilot", method: "Track five real or representative partnerships end to end", commitment: "creator and reviewer approve deliverables and disclosures", success: "all required evidence is complete before campaign handoff" }),
        Object.freeze({ name: "direct audience ownership test", method: "Import or capture consented fan and buyer records", commitment: "creator performs an export or approved follow-up", success: "no unresolved consent or suppression defect" })
      ],
      successMetrics: ["completed project rate", "successful export rate", "repeat project creation", "rights evidence completeness", "direct buyer or fan record growth", "brand deliverable approval time"],
      killCriteria: ["the product competes mainly on generic generation volume", "portable packages are not usable outside SONARA", "rights and consent evidence is routinely incomplete"]
    }),
    growth_studio: Object.freeze({
      strategicPosition: "The governed layer between basic CRM or sending tools and expensive enterprise marketing operations.",
      primaryBets: [
        "First-party Customer Timeline shared with Business Builder transactions and Creator Studio assets.",
        "Purpose- and channel-specific consent, suppression, provider diagnostics, and human approval.",
        "Offline conversions, deduplication, freshness, attribution model, confidence, and sampling evidence.",
        "Holdout and incrementality experiment planning instead of last-click certainty.",
        "Creator partnership measurement with audience fit, deliverables, disclosures, and business outcomes.",
        "Answer-engine visibility evidence based on observable citations and referrals without placement guarantees."
      ],
      validationExperiments: [
        Object.freeze({ name: "customer timeline reconciliation", method: "Reconcile transactions, creator assets, touchpoints, and conversions for five organizations", commitment: "owner verifies one end-to-end customer journey", success: "at least 95% deduplicated linkage for required records" }),
        Object.freeze({ name: "incrementality planning pilot", method: "Design a holdout or phased test for five campaigns", commitment: "owner accepts hypothesis, exposure rule, primary metric, and stop condition", success: "no result is reported as lift without an eligible comparison" }),
        Object.freeze({ name: "creator partnership measurement", method: "Connect five creator deliverable sets to consented touchpoints and outcomes", commitment: "brand or creator verifies delivery and disclosure evidence", success: "every result includes source, confidence, freshness, and attribution limitations" })
      ],
      successMetrics: ["consent completeness", "deduplication rate", "offline conversion match rate", "experiment completion", "attribution evidence freshness", "retained active campaigns"],
      killCriteria: ["value depends on unauthorized sending or advertising", "measurement cannot distinguish modeled correlation from verified lift", "provider cost or compliance risk exceeds customer value"]
    })
  }),
  sources: Object.freeze([
    Object.freeze({ publisher: "U.S. Department for Business and Trade", title: "SME Digital Adoption Taskforce final report", observedAt: "2025-07-31", implication: "Prioritize simple adoption, interoperability, CRM and operations value rather than feature volume." }),
    Object.freeze({ publisher: "U.S. Small Business Administration", title: "2025 small-business reports and 2026 statistics", observedAt: "2026-01-30", implication: "Design for a large market of small and often nonemployer businesses with limited specialist staff." }),
    Object.freeze({ publisher: "Visa", title: "Monetized: Visa 2025 Creator Report", observedAt: "2025-11-11", implication: "Treat creators as businesses needing payment, finance, ownership, and growth operations." }),
    Object.freeze({ publisher: "Interactive Advertising Bureau", title: "2025 Creator Economy Ad Spend & Strategy Report", observedAt: "2025-11-20", implication: "Prioritize creator selection, measurement standards, and business-outcome evidence." }),
    Object.freeze({ publisher: "American Marketing Association / Act-On", title: "Marketing Automation and AI Trends Report", observedAt: "2026-05-20", implication: "Ease of use, stack simplification, reporting, attribution, integration, and ROI proof are high-value gaps." }),
    Object.freeze({ publisher: "Supabase", title: "Queues", observedAt: "2026-09-23", url: "https://supabase.com/docs/guides/queues", implication: "Use Postgres-native durable transport when it reduces moving parts, while preserving application-level idempotency and reconciliation." }),
    Object.freeze({ publisher: "Supabase", title: "Realtime Broadcast", observedAt: "2026-09-23", url: "https://supabase.com/docs/guides/realtime/broadcast", implication: "Use low-latency broadcast for live UX without making transient messages the source of truth." }),
    Object.freeze({ publisher: "MapLibre", title: "MapLibre GL JS", observedAt: "2026-09-23", url: "https://maplibre.org/maplibre-gl-js/docs/", implication: "Open interactive maps can support service areas, fleet, field operations, analytics and creator visuals." }),
    Object.freeze({ publisher: "Valhalla", title: "Open-source routing engine", observedAt: "2026-09-23", url: "https://github.com/valhalla/valhalla", implication: "Multimodal routing, matrices, isochrones and map matching can sit behind a bounded routing adapter." }),
    Object.freeze({ publisher: "MobilityData / GTFS", title: "GTFS Realtime Reference", observedAt: "2026-09-23", url: "https://gtfs.org/documentation/realtime/reference/", implication: "Transit packs can use a standard contract for trip updates, vehicle positions and service alerts." }),
    Object.freeze({ publisher: "LiveKit", title: "LiveKit documentation", observedAt: "2026-09-23", url: "https://docs.livekit.io/", implication: "Realtime voice and video should use a purpose-built media transport rather than ordinary request/response routes." }),
    Object.freeze({ publisher: "Temporal", title: "Temporal documentation", observedAt: "2026-09-23", url: "https://docs.temporal.io/", implication: "Durable execution remains a useful benchmark for replay, long-running work, human waits and recovery semantics." }),
    Object.freeze({ publisher: "Qdrant", title: "Qdrant documentation", observedAt: "2026-09-23", url: "https://qdrant.tech/documentation/", implication: "Benchmark external vector infrastructure only when existing pgvector retrieval cannot meet measured scale, latency or offline requirements." }),
    Object.freeze({ publisher: "OpenTelemetry", title: "OpenTelemetry documentation", observedAt: "2026-09-23", url: "https://opentelemetry.io/docs/", implication: "Keep traces, metrics and logs on one vendor-neutral correlation model." }),
    Object.freeze({ publisher: "Prometheus", title: "Prometheus overview", observedAt: "2026-09-23", url: "https://prometheus.io/docs/introduction/overview/", implication: "Time-series monitoring and alerting can remain an optional operations backend behind standardized instrumentation." }),
    Object.freeze({ publisher: "OpenAlex", title: "OpenAlex API reference", observedAt: "2026-09-23", url: "https://help.openalex.org/api/", implication: "Use a structured scholarly graph instead of scraping Google Scholar for broad research discovery." }),
    Object.freeze({ publisher: "Crossref", title: "Crossref REST API", observedAt: "2026-09-23", url: "https://www.crossref.org/documentation/retrieve-metadata/rest-api/", implication: "Use DOI and publisher-deposited metadata for authoritative bibliographic identifiers and provenance." }),
    Object.freeze({ publisher: "Library of Congress", title: "APIs at the Library of Congress", observedAt: "2026-09-23", url: "https://www.loc.gov/apis/", implication: "Use public structured collection data for books, maps, images, recordings and cultural/historical research with source rights preserved." }),
    Object.freeze({ publisher: "Apple", title: "2026 Apple Design Awards", observedAt: "2026-06-02", url: "https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/", implication: "Delight, inclusivity, intuitive interaction and coherent visuals are competitive product qualities, not decoration." }),
    Object.freeze({ publisher: "Baymard Institute", title: "Mobile App UX Benchmark 2026", observedAt: "2026-03-24", url: "https://baymard.com/research-articles/mobile-app-ux-benchmark-2026", implication: "Use research-backed mobile interaction patterns and test complete task flows rather than judging interface quality by screenshots." })
  ])
});

function getMarketRDPriorities() {
  return JSON.parse(JSON.stringify(MARKET_RD_PRIORITIES));
}

module.exports = { MARKET_RD_PRIORITIES, getMarketRDPriorities };
