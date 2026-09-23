# SONARA Platform Advancement Wave — 2026-09-23

## Purpose

This research wave turns broad cross-industry research into a smaller set of reusable SONARA platform capabilities. It does **not** authorize external providers, install repositories, activate payment rails, widen agent authority, or create production infrastructure by itself.

The architectural rule is:

> Make the application feel simpler while the platform becomes broader: one kernel, one data plane, one execution spine, one attention layer, and composable capability packs.

## What SONARA already has

The active production database already provides the main primitives required for the next stage:

- PostgreSQL/Supabase as the system of record.
- Row-level security across the current public-table estate.
- Postgres-native queueing and scheduling primitives.
- Vector search support.
- Durable event outbox and delivery-attempt evidence.
- Workflow-run state.
- Integration connection records.
- Sub-application records.
- Notification records and push subscriptions.
- Call-session and media-generation records.
- OpenTelemetry instrumentation in the application runtime.

Because these foundations already exist, the next engineering value comes from convergence and product depth rather than creating more disconnected frameworks.

## Priority 1 — Data + workflow reliability

Use one shared contract for:

- operation identity;
- idempotency;
- workflow state;
- queue transport;
- checkpoints and cursors;
- retries and deadlines;
- approvals;
- provider receipts;
- reconciliation;
- dead-letter handling;
- read models;
- audit and observability.

The live Supabase advisors currently report at least one duplicate-index finding and many overlapping permissive-policy findings. Those should be treated as database-quality debt before expanding the schema further.

## Priority 2 — Nexus as the attention and orientation layer

Nexus should become the stable front door across Business Builder, Creator Studio, Growth Studio, research, sub-applications, and future vertical packs.

Recommended shared UX:

- stable primary navigation;
- global command/search surface;
- recent and pinned work;
- contextual breadcrumbs;
- unified notification center;
- progress and queued-job visibility;
- keyboard, touch, screen-reader, and reduced-motion parity;
- clear degraded states when optional providers are unavailable.

The objective is not more visual complexity. It is lower cognitive load while preserving platform depth.

## Priority 3 — Notifications, sound, and haptics

Notifications should be event-driven and user-controlled.

Required product rules:

- category and topic preferences;
- priority levels;
- quiet hours;
- deduplication and bundling;
- action links;
- delivery receipts;
- accessible visual alternatives to sound or vibration;
- optional sound/haptic cues rather than mandatory effects.

Sound and vibration should communicate useful state, never become decoration or noise.

## Priority 4 — Research, library, and RAG

Build one source-grounded research plane for technical, scholarly, historical, cultural, market, company, and customer-approved sources.

Recommended public-data adapters to evaluate:

- OpenAlex for scholarly graph discovery;
- Crossref for DOI and publisher-deposited bibliographic metadata;
- Library of Congress APIs for books, images, maps, audio, and collection metadata.

Google Scholar should be treated as a user-facing research destination rather than something SONARA scrapes. Prefer documented public APIs and licensed sources.

RAG requirements remain:

- tenant filter first;
- document/source permissions;
- provenance;
- citations;
- freshness;
- retrieval trace;
- evaluation;
- no secret indexing;
- no cross-tenant memory.

## Priority 5 — Maps, mobility, dispatch, and transportation businesses

Create a reusable mobility capability pack rather than separate Uber-, Lyft-, taxi-, trucking-, bus-, rail-, or delivery clones.

Evaluate:

- MapLibre GL JS for interactive maps;
- Valhalla for routing, matrices, isochrones, and map matching;
- GTFS and GTFS Realtime for public-transit schedules, trip updates, vehicle positions, and service alerts.

Shared SONARA primitives should cover:

- organization;
- driver/operator;
- customer/rider;
- asset/vehicle;
- service area;
- stop/location;
- route;
- trip/job;
- dispatch;
- booking/order;
- fare/price quote;
- payment reference;
- position update;
- incident;
- maintenance;
- proof of completion.

Provider-specific commercial ride-hailing APIs remain adapter boundaries.

## Priority 6 — Realtime voice, video, streaming, and recording

Use a dedicated realtime-media plane instead of routing long-lived media through ordinary JSON application requests.

LiveKit is a strong open-source reference for a WebRTC/SFU boundary. FFmpeg remains a strong worker-side media-processing reference.

The production design should include:

- explicit recording consent;
- retention policy;
- role and room authorization;
- TURN and network fallback;
- ingress/egress;
- transcription quality measurement;
- cost per participant-minute;
- stream health telemetry;
- optional end-to-end encryption where the workflow supports it.

## Priority 7 — Deterministic mathematics and operational science

Turn formulas into versioned, testable platform assets.

Useful domains include:

- pricing and margin;
- scheduling and capacity;
- routing and geometry;
- inventory and reorder;
- staffing;
- reliability;
- statistics;
- forecasting;
- calibration;
- simulation;
- optimization;
- unit conversion and dimensional analysis.

Every formula should carry:

- version;
- units;
- input contract;
- provenance;
- assumptions;
- constraints;
- deterministic test cases;
- confidence or error measure when it is predictive rather than exact.

## Priority 8 — Vertical businesses as compositions

Restaurants, trades, cleaning, retail, transport, rentals, manufacturing, education, creator businesses, professional services, and similar markets should reuse shared primitives.

Avoid one table family and one backend per industry.

Instead compose:

- customers;
- staff;
- assets;
- catalogs;
- bookings;
- jobs;
- orders;
- fulfillment;
- inventory;
- invoices;
- payments;
- schedules;
- documents;
- communications;
- analytics;
- approvals;
- workflows.

Use vertical templates to change defaults, fields, dashboards, KPIs, and workflow recipes.

## Priority 9 — Graphics, gaming, 3D, and cinematic interfaces

Game-quality interaction can improve simulation, training, spatial planning, product visualization, maps, media creation, and selected onboarding experiences.

Godot is a useful open-source reference for 2D/3D and simulation. Browser experiences should prefer WebGL/WebGPU capability detection and graceful fallback.

Rules:

- 3D must improve task comprehension or completion;
- respect reduced-motion settings;
- maintain accessible 2D alternatives;
- enforce frame-time and memory budgets;
- stream assets progressively;
- use level-of-detail rules;
- do not turn ordinary CRUD workflows into 3D for novelty.

## Priority 10 — Security, monitoring, and quality

Continue the vendor-neutral observability direction already present in the codebase.

Use OpenTelemetry as the correlation layer and evaluate Prometheus-compatible metrics backends where appropriate.

Quality gates should measure:

- API p95/p99 latency;
- database query latency;
- queue age;
- retry rate;
- error rate;
- workflow recovery;
- cross-tenant isolation;
- notification duplicates;
- media join success;
- retrieval quality;
- accessibility regressions;
- production exact-SHA evidence.

## Open-source adoption policy

Open-source research is not the same as runtime adoption.

For each candidate:

1. verify repository identity;
2. verify license from the upstream repository;
3. verify commercial-use constraints;
4. verify security and maintenance;
5. define a bounded SONARA capability gap;
6. compare against capabilities already present;
7. prefer adapters/services over source copying;
8. benchmark before promoting;
9. pin versions and preserve attribution;
10. keep an exit path.

## Market position

SONARA should not try to win by claiming the largest feature count.

Its differentiated product direction is:

- one operating layer across multiple business and creator domains;
- deterministic policy under AI assistance;
- portable customer and asset ownership;
- source-grounded intelligence;
- reusable vertical composition;
- governed connectors;
- evidence-backed actions;
- affordable entry pricing with metered expensive usage;
- user-friendly navigation over a deep system.

## Engineering sequence

1. Clean duplicate indexes and policy overlap in the production database.
2. Define canonical workflow, queue, cursor, provider-receipt, and reconciliation contracts.
3. Strengthen Nexus navigation, search, recent work, and notification experience.
4. Add research adapters and hybrid retrieval evaluation using the existing RAG boundary.
5. Build maps/mobility as a reusable capability pack.
6. Add realtime media only through a dedicated reviewed transport boundary.
7. Version formulas and deterministic operational models.
8. Convert vertical growth into templates and capability composition.
9. Add 3D/gaming interaction only where measured usability improves.
10. Gate every expansion on security, latency, accessibility, cost, and customer evidence.
