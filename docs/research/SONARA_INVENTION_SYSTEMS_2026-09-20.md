# SONARA Invention Systems Intelligence — 2026-09-20

## Purpose

This research batch is treated as **invention input**: models, engines, modules, software systems, formulas, workflows, interfaces, infrastructure and new business/product patterns. The objective is not to copy competitors or dump repositories into production. The objective is to translate current evidence into reusable SONARA-owned architecture that can be viewed, saved, tested, scaled, audited and promoted deliberately.

Machine-readable companion: \`lib/sonara-invention-systems-2026.cjs\`.

Application surface: \`/invention-systems\`.

API surfaces:

- \`GET /api/invention-systems/catalog\`
- \`POST /api/invention-systems/score\`
- \`POST /api/invention-systems/promotion-readiness\`

## Market conclusion

The 2026 market is converging on five important patterns.

1. **Workflow value beats generic chat.** AI adoption is broad, but enterprise value depends on redesigning handoffs, state, approvals, evidence and measurable outcomes.
2. **Vertical systems want grounded AI.** Restaurant and retail operators are actively experimenting with AI but still want human oversight and tools grounded in real operational data.
3. **Commerce is becoming machine-readable.** Payment providers are defining agent/machine-payment primitives. That creates opportunity, but it also increases the importance of spend envelopes, authorization, idempotency, reconciliation and fraud controls.
4. **Composable digital twins are a strong cross-industry primitive.** NIST's 2026 work emphasizes modular composition, interoperability, lifecycle validity, trustworthy industrial AI and reusable component models.
5. **Spatial/GPU interfaces are becoming practical web options, not foundations.** WebGPU and WebXR are advancing, but SONARA should use them as progressive enhancement over accessible 2D workflows.

## The invention portfolio

The registry defines 21 SONARA system concepts:

- Governed Agent Mesh
- Deterministic Workflow Compiler
- Evidence RAG Fabric
- Business Digital Twin Graph
- Machine Commerce Guard
- Universal Entitlement Ledger
- Vertical Operations Kernel
- Adaptive POS & Kiosk Engine
- Field Intelligence Mesh
- Modular Digital Twin Composer
- Predictive Operations Engine
- Self-Healing Reliability Supervisor
- Compute Routing Fabric
- Spatial Experience Engine
- Media Production Fabric
- Growth Experiment Loop
- Communications Fabric
- Learning & Translation Engine
- Trust & Identity Plane
- Adapter Marketplace Gateway
- Research-to-Runtime Foundry

These are **research/design records**, not production claims.

## Requested-domain coverage

The machine-readable registry maps the requested scope into 36 domain families so broad research does not turn into 36 disconnected products:

- agentic AI, LLMs and RAG;
- deterministic workflows and automation;
- small/large business management;
- POS, kiosk, restaurant and retail;
- trucking, delivery and logistics;
- HVAC, electrical, plumbing, carpentry and trades;
- project management and service delivery;
- waste, utilities and facilities;
- payments, banking, transfers and finance;
- investment, risk and insurance decision support;
- scheduling, calendars, reservations and RSVP;
- cleaning and home services;
- customer service, chat, voice and text;
- ecommerce, ordering, buying and selling;
- social media, marketing, SEO and campaigns;
- video, audio, images, movies, books, music and podcasting;
- gaming, AR, 3D and interactive experiences;
- manufacturing, food production and robotics;
- real estate, rental and property operations;
- jobs, listings, posting and workforce;
- education, classroom, translation and learning;
- government/public-access and venue workflows;
- blockchain/decentralized ledgers as optional settlement/provenance adapters;
- security, monitoring and biometrics;
- mobile camera, GPS, gyroscope, notifications and haptics;
- subscriptions, refunds and in-app purchases;
- websites, sub-applications, directories and profiles;
- databases, storage, search, vector retrieval and memory;
- cloud, CPU/GPU compute and data-center economics;
- desktop/mobile packaging and application operating-system surfaces;
- analytics, statistics, measurement and forecasting;
- external/internal adapters, services and inputs;
- CAD/engineering design interoperability;
- creator/artist/sponsorship/venue/event operations;
- dating/community/social discovery with safety-first controls;
- search/discovery and AI-readable distribution.

Each domain points back to the 21 shared invention systems and declares a strategy such as build-core, vertical-pack, provider-adapter-first, decision-support-only, permission-scoped progressive enhancement, or partner/specialist boundary.

## Research-to-runtime lifecycle

Every new technology, repository, paper, PDF, standards document, market signal or external service should move through one lifecycle:

\`research → design → sandbox → validated → canary → production\`

The process is deliberately asymmetric: research can be broad, but runtime authority must remain narrow.

### Research

View the source, record provenance, save the useful evidence, classify licensing/rights, extract patterns, and deduplicate it against the existing registry. Research never grants execution authority.

### Design

Turn the pattern into a SONARA-owned contract: domain model, API boundary, events, deterministic states, failure modes, security boundary, cost model and rollback plan.

### Sandbox

Run isolated prototypes with synthetic or explicitly permitted data. External repositories are pinned to reviewed commits and are not given production credentials.

### Validated

Require deterministic tests, adversarial/security tests, tenant-isolation tests, performance budgets, accessibility where applicable, data migration proof, and provider failure behavior.

### Canary

Enable only a bounded tenant/workflow/provider slice with telemetry, rate limits, operator visibility, rollback and explicit approval policy.

### Production

Require exact-SHA release evidence, production health, rollback evidence and owner authorization. A research record, passing unit test or successful sandbox is never sufficient by itself.

## Product architecture

### Shared platform fabric

The strongest invention is not a single giant application. It is a reusable fabric:

\`identity → tenant/business graph → authorization → workflows → agents/tools → events → commerce → communications → media → geospatial/device data → analytics → evidence\`

Vertical applications should be composed from that fabric.

### Business Builder

Primary inventions: Vertical Operations Kernel, Business Digital Twin Graph, Adaptive POS/Kiosk, Field Intelligence Mesh, Machine Commerce Guard, Universal Entitlement Ledger, Predictive Operations Engine.

Applicable industries include restaurant, retail, trucking, delivery, HVAC, electrical, plumbing, carpentry, cleaning, waste, venues, property/rental, manufacturing and other service businesses.

### Creator Studio

Primary inventions: Media Production Fabric, Spatial Experience Engine, Communications Fabric, Universal Entitlement Ledger, Adapter Marketplace Gateway.

Applicable workflows include podcasting, video, movies, music, images, books, artists, streaming, social content, 3D experiences, exports and rights/provenance.

### Growth Studio

Primary inventions: Growth Experiment Loop, Evidence RAG Fabric, Communications Fabric, Governed Agent Mesh and Business Digital Twin Graph.

Growth work should connect SEO, social/video discovery, campaigns, audiences, customer timelines, experimentation, attribution and commerce outcomes.

## Deterministic + probabilistic architecture

LLMs and forecasting models are probabilistic. Payments, permissions, subscriptions, order state, tenant boundaries and irreversible actions cannot be.

Therefore:

- models propose;
- deterministic policy authorizes;
- state machines transition;
- idempotency prevents duplication;
- evidence records what happened;
- humans approve high-impact actions;
- observability measures cost, latency and failure;
- rollback/compensation handles errors.

This is the core rule for agents, customer service, ordering, refunds, subscriptions, scheduling, notifications, manufacturing workflows, external adapters and internal services.

## Self-repair boundary

"Self-healing" must not mean unrestricted autonomous mutation.

The Self-Healing Reliability Supervisor is limited to:

- detecting health/SLO failures;
- clustering recurring errors;
- isolating failed dependencies;
- opening circuits;
- executing pre-approved reversible playbooks;
- proposing rollback;
- verifying recovery;
- escalating risky or novel repairs.

Schema changes, destructive data mutation, billing changes, auth-policy changes, security controls and production deployment remain separately authorized.

## Mobile/device layer

Camera, GPS, gyroscope, notifications, vibration/haptics and other device capabilities stay permission-scoped. Android packaging must remain current with Play policy. Apple/Google purchase state is external evidence that must reconcile to canonical SONARA entitlements.

## Spatial/3D layer

Use a capability ladder:

1. accessible HTML/CSS/server-rendered workflow;
2. lightweight Canvas/SVG enhancement;
3. WebGL/WebGPU enhancement when supported and beneficial;
4. WebXR only for explicit immersive workflows.

Measure frame time, GPU memory, asset weight, input latency, battery/data constraints and reduced-motion preference. Never make core commerce, account, support or admin flows depend on a GPU path.

## Open-source and repository strategy

Repository research is input, not authority.

Use this order:

1. study architecture and interfaces;
2. verify repository identity and current maintenance;
3. verify license and commercial-use constraints;
4. classify security/supply-chain risk;
5. prefer API/protocol/adapter boundaries;
6. pin reviewed versions;
7. sandbox;
8. benchmark against SONARA-owned acceptance tests;
9. install only the minimal justified component;
10. promote only after the normal release matrix passes.

The current ecosystem already tracks candidates such as Timefold, PostgreSQL, OpenSearch, DuckDB, FFmpeg, Godot, OBS, FreeCAD, ThingsBoard and other domain tools. This invention registry is intentionally complementary: it describes what SONARA owns and how third-party components may fit behind controlled boundaries.

## 2026 evidence used in this pass

- McKinsey, *Cutting the coordination tax: how agentic AI can reshape workflows*, 2026-09-18.
- McKinsey, *The state of AI in 2026*, 2026-08-25.
- Toast, *How Restaurants Are Using AI in 2026*, 2026-09-14.
- Toast, *2026 Voice of the Retail Industry*, 2026-09-09.
- Stripe, *Machine Payments Protocol*, 2026-03-18.
- Mastercard, *Agent Pay for Machines*, 2026-06-10.
- OWASP, *AI Agent Security Cheat Sheet*.
- FIDO Alliance, *State of Passkeys 2026*, 2026-05-07.
- OpenTelemetry, *GenAI Observability*, 2026-05-14.
- NIST, *2026 Roadmap on AI and ML for Smart Manufacturing*, 2026-07-03.
- NIST, *Standards-Based Digital Twin Composition*, 2026-08-26.
- W3C, *WebGPU*, Candidate Recommendation Draft, 2026-09-01.
- W3C, *WebXR Device API*, Candidate Recommendation Draft, 2026-06-09.
- Google Search Central, platform properties/social-video measurement, 2026-07-29.
- Android Developers, 2026 target API requirements.
- Apple Developer, App Store Server API and subscription state.

## Engineering rule

This batch should merge only through the normal exact-head engineering gate. The new registry itself does not authorize production activation of any invention system, provider, worker, migration or autonomous agent.
