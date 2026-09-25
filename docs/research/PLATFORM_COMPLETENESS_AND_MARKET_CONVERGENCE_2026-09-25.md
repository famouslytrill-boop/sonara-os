# SONARA Platform Completeness and Market Convergence

Updated: 2026-09-25
Review by: 2026-10-25

## Decision

SONARA should not become hundreds of unrelated mini-products. The competitive architecture is one governed platform made of reusable primitives: identity, tenant records, workflow state, commerce, communications, media, maps/location, analytics, observability, adapters, evidence, and deterministic formulas.

The operating rule is simple:

> Every visible control has one purpose, one owner, one route/action, one authorization rule, one success state, one failure state, one useful empty state, and one telemetry/audit path.

A feature that cannot satisfy that rule stays research-only or setup-required. It must not ship as an inert button, fake demo, empty workspace, or unsupported production claim.

## 2026 technology baseline

Primary-source checks performed on 2026-09-25 support these boundaries:

- Node.js: keep production on Node 24 LTS. Node 26 is Current and belongs in compatibility CI until it becomes the production-approved LTS lane.
  - https://nodejs.org/en/about/previous-releases
- PostgreSQL: PostgreSQL 18 remains the current production major; 18.6 was released 2026-08-13. PostgreSQL 19 is beta and research-only.
  - https://www.postgresql.org/docs/release/18.6/
  - https://www.postgresql.org/docs/release/
- OpenTelemetry: semantic conventions provide the common naming layer for traces, metrics, logs, resources, database operations, CI/CD and errors.
  - https://opentelemetry.io/docs/specs/semconv/
- OpenFeature: keep feature evaluation provider-neutral and deterministic, with safe defaults and explicit evaluation context.
  - https://openfeature.dev/specification/
- MCP: the 2026-07-28 specification moves the protocol core to stateless request/response operation and adds stronger authorization/versioning expectations.
  - https://blog.modelcontextprotocol.io/posts/2026-07-28/
- WebGPU: still a Candidate Recommendation Draft as of 2026-09-15. Use capability detection and preserve WebGL/Canvas fallbacks.
  - https://www.w3.org/standards/history/webgpu/
- MapLibre GL JS: v6 is the current major family. Keep the renderer separate from the tile/geocoding/routing provider.
  - https://maplibre.org/maplibre-gl-js/docs/
- OpenStreetMap: OSM data is reusable, but the public OSM tile servers are best-effort community infrastructure with usage restrictions. Do not make production availability depend on hard-coded community tile endpoints.
  - https://operations.osmfoundation.org/policies/tiles/
- FFmpeg: 8.1.3 is the latest stable 8.1 release observed on 2026-09-25. Treat it as an isolated, checksum-pinned media worker.
  - https://ffmpeg.org/download.html
- Godot: 4.7.2 is stable; 4.8 is still development. Use Godot as an external authoring/runtime adapter, not as a dependency of the core web request path.
  - https://godotengine.org/download/archive/

## Product architecture

### Canonical layers

1. **Experience layer**
   - one navigation model
   - responsive web/PWA surfaces
   - keyboard, screen-reader, reduced-motion, zoom/reflow support
   - optional sound/haptics only after user choice
   - no hidden duplicate route to the same operation

2. **Application layer**
   - Business Builder
   - Creator Studio
   - Growth Studio
   - shared account, billing, notifications, integrations, lifecycle and intelligence surfaces

3. **Deterministic workflow layer**
   - explicit state machines
   - idempotency keys
   - retries/backoff
   - dead-letter/reconciliation paths
   - formulas and thresholds stored as versioned policy
   - human approval for privileged actions

4. **Canonical data layer**
   - PostgreSQL is operational truth
   - tenant ID and authorization are enforced server-side
   - tables have an owner, purpose, retention rule and read/write path
   - unused tables are removed, archived, or explicitly marked research-only
   - no customer-facing workspace depends on an empty schema with no workflow

5. **Adapter layer**
   - provider identity
   - scopes/capabilities
   - version
   - checkpoint
   - freshness
   - health
   - reconciliation
   - disconnect/delete
   - rate-limit and outage behavior

6. **Observability layer**
   - OpenTelemetry-compatible names
   - traces, metrics and logs correlated by request/workflow/tenant-safe identifiers
   - secret and personal-data redaction
   - exact release SHA in operational evidence

7. **Research/invention layer**
   - research never automatically becomes production authority
   - every new technology moves through research -> design -> sandbox -> validated -> canary -> production
   - maturity, license, security, economics and operational ownership are explicit

## Deterministic output strategy

External AI services are enhancements, not prerequisites.

| Output | Deterministic baseline | Optional enhancement | Safe degradation |
| --- | --- | --- | --- |
| Text | templates, rules, SQL records, formulas, FTS/search, user input | model drafting/summarization | canonical records + editable template |
| Image | SVG, Canvas, charts, diagrams, thumbnails, owned assets | generative image worker | template/diagram with provenance |
| Audio | Web Audio, samples, MIDI, owned recordings, FFmpeg mix/transcode | speech/music worker | playable source/mix plus transcript/score |
| Video | FFmpeg composition/transcode, captions, timelines, image/audio assembly | video generation worker | deterministic timeline render |
| Map | MapLibre + replaceable licensed/self-hosted data/tile source | routing/geocoder providers | coordinates/address list + provider state |
| Data | PostgreSQL queries, projections, formulas, statistics | prediction/recommendation model | canonical records + unavailable-derived-metric reason |
| File | CSV, JSON, ICS, vCard, PDFs/reports, media exports | assisted content generation | canonical machine-readable export |

General-purpose translation cannot be honestly guaranteed without a translation engine or service. The deterministic baseline is message catalogs, terminology/glossary substitution, locale formatting, transliteration where defined, and human-editable source/target records.

General-purpose voice generation also is not bit-for-bit deterministic across arbitrary platform TTS engines. The deterministic baseline is prerecorded/user-owned audio, score/sample synthesis and explicit transcript output. Local speech engines can be optional governed adapters.

## Database and table rules

Every production table must answer:

- Which product/module owns it?
- Which tenant/user boundary applies?
- Which route or worker reads it?
- Which route or worker writes it?
- Which workflow states are valid?
- What does an empty table mean?
- What is the retention/delete policy?
- Is there audit evidence for privileged mutation?
- Is it included in backup/restore evidence?
- Is it still referenced by shipped code?

The existing orphan-table, tenant-query, RLS, migration replay and unreferenced-module checks should remain release-blocking. Add new tables only when the workflow cannot be represented cleanly by an existing canonical record.

## UI/UX rules

Do not copy the visual identity of popular applications. Reuse interaction principles:

- progressive disclosure
- strong search
- predictable back navigation
- command/action history
- visible save/sync state
- skeletons only while real data is loading
- useful zero states with one clear next action
- optimistic UI only when rollback is safe
- keyboard-first desktop behavior
- thumb-safe mobile behavior
- explicit destructive-action confirmation
- accessible maps/charts with text equivalents
- performance budgets for initial load, interaction latency and media

A button must be one of:

- route navigation
- form submission
- local deterministic calculation
- authenticated mutation
- download/export
- external authorization
- explicit unavailable/setup-required explanation

Anything else is not a production button.

## Market positioning

Avoid the claim that SONARA is unique because it has the largest feature list. Large suites already win on catalog depth.

The defensible position is:

**One operating layer that helps a small business or creator go from idea -> records -> workflow -> payment -> delivery -> measurement, with deterministic core operations and optional intelligence.**

That positioning is stronger when supported by:

- one login and tenant model
- shared customer/asset/activity records
- portable exports
- transparent setup state
- low-cost deterministic functions before paid inference
- optional adapters rather than lock-in
- evidence-backed release and security gates
- vertical templates composed from the same platform primitives

## Consolidated domain model

The large requested market surface should map to reusable families rather than new products for every noun:

- commerce: catalog, orders, payments, subscriptions, refunds, inventory, entitlements
- services/trades: lead, booking, dispatch, work order, invoice, payment, review
- restaurants: menu, recipe, inventory, purchasing, waste, staff, sales
- transportation: fleet, routing, schedules, jobs, locations, telemetry
- media: assets, rights, timeline, audio, video, release, distribution, analytics
- gaming/interactive: scene, assets, input, rendering, state, telemetry, distribution
- education/research: library, sources, search, curricula, assignments, citations
- finance/risk: ledger, reconciliation, approvals, rules, evidence, reporting
- manufacturing: BOM, inventory, work orders, quality, maintenance, schedules
- real estate/jobs: listings, applicants, documents, appointments, payments, messaging
- social/communications: profiles, feed, messaging, moderation, notifications, publishing
- science/math/engineering: units, formulas, geometry, statistics, simulation, visualization

## Security and monitoring

Preserve the existing defense-in-depth direction:

- RLS/tenant isolation
- short-lived and scoped provider grants
- no raw provider secrets in analytics/logging
- OpenTelemetry redaction
- CodeQL, OSV, Gitleaks and Trivy gates
- CSP and browser secret scans
- dependency and source-license checks
- exact-head CI evidence
- controlled post-merge deployment
- rollback evidence
- one-tenant canaries before broader activation

For cameras, biometrics, precise location, call recording, microphone, contacts and device sensors, permissions must be purpose-specific, time-bounded where possible, user-visible, revocable and off by default unless the workflow requires an explicit user action.

## Performance

Set budgets rather than subjective "fast" claims:

- route response and database query latency budgets
- Core Web Vitals/Lighthouse floors
- k6 thresholds for critical APIs
- bounded bundle growth
- image/media lazy loading
- pagination and cursor-based large lists
- background workers for transcoding, indexing and external sync
- cache only where invalidation rules are explicit
- deterministic tie-breakers for ranked results

WebGPU and GPU acceleration are enhancement paths. No core workflow should fail just because WebGPU, HDR, a discrete GPU or high refresh rate is unavailable.

## Next engineering sequence

1. Keep current main release gates intact.
2. Merge this completeness contract only after exact-head tests and checks pass.
3. Add a generated control inventory that classifies every visible button/form/link by its action type and canonical route/handler.
4. Extend the orphan-table report into a table-purpose report: owner, read paths, write paths, RLS, retention, backup class.
5. Extend route accounting to POST/PUT/PATCH/DELETE action ownership, not only GET pages.
6. Add deterministic media worker reproducibility fixtures: fixed inputs -> checksummed output metadata.
7. Add map provider abstraction and ban production hard-coding of OSM community tile servers.
8. Add MCP protocol-version compatibility tests for 2026-07-28 before any MCP runtime expansion.
9. Add Node 26 as non-blocking compatibility CI while Node 24 remains production.
10. Keep PostgreSQL 19 beta strictly research-only until stable and explicitly approved.
11. Activate one external read-only connector for one tenant and prove auth -> sync -> telemetry -> reconciliation -> disconnect/delete -> recovery.
12. Measure activation, time-to-first-value, workflow completion, support burden, reliability and paid conversion before adding another major vertical.

## Owner/manual actions that remain outside source-only engineering

- reconnect the local Desktop Commander host before local installs or local full-matrix execution can be performed remotely
- approve any paid infrastructure or production environment that creates cost
- supply/authorize production provider credentials without exposing them in chat or source
- approve destructive production migrations or data deletion
- approve final production publish/deploy/activation after exact-head evidence is green
