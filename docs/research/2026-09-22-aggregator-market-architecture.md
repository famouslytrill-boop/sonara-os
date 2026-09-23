# SONARA 2026 Aggregator Market Architecture

**Observed:** 2026-09-22  
**Repository baseline:** `56772a326b5f005f6b9a3461287a62226575e043`  
**Status:** research + architecture only; no provider, dependency, credential, migration, payment rail, model, connector, device, worker, or external mutation is enabled by this document. Architecture registry version: `1.1.0`.

## Executive decision

SONARA should not build a collection of unrelated "aggregator" products.

Build one **Aggregation Control Plane** in SONARA Nexus and expose domain-specific aggregation experiences through Business Builder™, Creator Studio™, and Growth Studio™.

The common control plane owns:

`tenant -> connection -> capability class -> capability -> policy -> adapter -> normalization -> durable event/workflow -> evidence -> reconciliation -> telemetry`

For outbound mutations:

`desired state -> authority classification -> approval when required -> idempotent provider call -> provider receipt -> reconciliation -> settled state`

This architecture allows SONARA to aggregate models, tools, SaaS systems, data pipelines, banking data, payments, orders/POS, social networks, commerce channels, shipping/routes, travel inventory, places/reviews, media distribution, identity, jobs, property systems, IoT/edge inputs, and public-sector/open-data sources without duplicating identity, workflow, audit, billing, or policy infrastructure.

## 2026 market evidence

| Aggregation market | Current signal | SONARA implication |
| --- | --- | --- |
| SaaS/customer integrations | Merge exposes common models across HRIS, ATS, accounting, ticketing, CRM, file storage, knowledge and chat categories. | Normalize customer-facing integrations behind canonical domain objects, connection-specific scopes and provider envelopes. |
| LLM/model routing | OpenRouter exposes hundreds of models through one API with fallback/routing; LiteLLM exposes 100+ LLMs with routing, spend tracking and budgets. | Keep model selection behind Provider Gateway with explicit policy, cost, health and quality signals. |
| Data integration | Airbyte markets 700+ connectors; Fivetran documents 700+ connectors and automatic schema/API maintenance. | Connector count is secondary to cursor correctness, schema drift handling, lineage, replay, backfill and reconciliation. |
| Workflow automation | n8n lists 2,000+ integrations; Workato combines connectors, recipes, API/data/event workflows, job history, concurrency and error controls. | Aggregation must execute through SONARA's durable workflow/evidence plane, not a disconnected automation island. |
| Embedded payments | Stripe Connect aggregates onboarding, verification, payments, payouts, disputes and platform/marketplace money movement. | Do not become an unlicensed payment network; keep regulated operations behind reviewed provider boundaries and reconcile all receipts. |
| Financial data | Plaid reports support for 10,000+ US/Canada institutions, with product coverage varying by institution. | Capability availability is connection-specific; a bank connection is not a blanket guarantee of every financial feature. |
| Restaurant/order aggregation | Deliverect reports 1,000+ integrations, 1.5B+ orders processed and 80K locations served. | Canonicalize menu/modifiers/orders/fulfillment while keeping POS, delivery, loyalty and KDS adapters replaceable. |
| Social distribution | Ayrshare aggregates publishing and analytics across major networks and exposes MCP integration. | Build one rights-aware content package + per-network capability/receipt model with explicit publishing approval. |
| Travel connectivity | Booking.com Connectivity APIs use granular connection permissions for property management capabilities. | Store exact connection scopes, not a binary connected/not-connected flag. |
| Geospatial | Google Maps Platform separates Places, Routes, Route Optimization, Roads, geocoding and other capabilities with independent quota/billing behavior. | Treat geo as a provider family of task-specific capabilities with field, quota, region and cost controls. |
| Agent/tool interoperability | MCP 2026-07-28 is stateless, supports header-based routing, cacheable capability lists, hardened authorization and Tasks extensions. | SONARA's tool aggregator should route/authorize at the gateway by tenant, tool, capability and action class. |
| Machine-readable contracts | OpenAPI 3.2.1, AsyncAPI 3.1, CloudEvents and OpenTelemetry semantic conventions are current interoperability foundations. | Prefer standards-based contracts and semantic telemetry over proprietary wire formats. |

### Primary sources

- Merge Unified: https://docs.merge.dev/merge-unified/overview
- OpenRouter: https://openrouter.ai/docs/quickstart
- LiteLLM: https://docs.litellm.ai/
- Airbyte connectors: https://airbyte.com/connectors
- Fivetran connectors: https://fivetran.com/docs/connectors
- Workato iPaaS: https://docs.workato.com/en/ipaas
- n8n integrations: https://n8n.io/integrations
- Stripe Connect: https://stripe.com/connect
- Plaid institution coverage: https://plaid.com/docs/institutions/
- Deliverect: https://www.deliverect.com/en-us
- Ayrshare integrations: https://www.ayrshare.com/integrations/
- Booking.com Connectivity APIs: https://developers.booking.com/connectivity/docs
- Google Maps Platform APIs: https://developers.google.com/maps/apis-by-platform
- MCP 2026-07-28: https://blog.modelcontextprotocol.io/posts/2026-07-28/
- OpenAPI 3.2.1: https://spec.openapis.org/oas/v3.2.1.html
- AsyncAPI: https://www.asyncapi.com/docs
- CloudEvents: https://cloudevents.io/
- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/specs/semconv/

## What SONARA already has

The existing architecture already contains pieces an aggregation platform needs:

- tenant/org isolation and entitlement boundaries
- Provider Gateway concepts
- durable event/outbox and workflow direction
- agent authority classification and human approvals
- provider health/resilience planning
- RAG/provenance/evidence concepts
- Stripe, Supabase, Resend and other provider adapters
- research-only/reference-only registry semantics
- OpenTelemetry direction
- Business Builder, Creator Studio and Growth Studio domain ownership
- a rule that external catalog size is not SONARA native integration count

The missing step is to converge these pieces into one explicit aggregation contract.

## 2026 market topology and build-vs-buy boundary

The market now separates into distinct layers: common-model/unified APIs; embedded auth/sync/webhook/action infrastructure; enterprise iPaaS/API/agent governance; AI model/tool gateways; and domain aggregators for finance, commerce, logistics, communications, identity, app stores, ads, media and vertical industries.

SONARA should own the control plane, not every commodity adapter.

**SONARA-owned moat:** tenant authority, canonical business state, capability classes, entitlements, budgets, approvals, deterministic workflow execution, receipts, provenance, reconciliation, observability, usage metering, connector certification and product billing.

**Replaceable provider reach:** long-tail OAuth/provider coverage, commodity schema translation, carrier/marketplace/social/financial-institution breadth, specialized model/media compute, and regulated third-party rails.

The rule is: **providers supply reach; SONARA retains workflow truth and authority.**

### Capability classes

| Class | Execution semantics | Default boundary |
| --- | --- | --- |
| Common-model read | bounded request/response read | read-only |
| Managed connection/auth | credential + scope lifecycle | security boundary |
| Incremental sync | cursor + checkpoint + backfill | read-only |
| Event ingress | webhook/poll + dedupe/replay | read-only |
| Synchronous action | bounded provider write | policy-gated |
| Long-running task | durable async job | policy-gated |
| Bidirectional sync | desired-state reconciliation | approval-capable |
| Policy routing gateway | hard constraints then deterministic route | bounded external compute |
| Regulated mutation | receipt + settlement/reversal lifecycle | human approval by default |
| Device/edge command | interlock + command + evidence | safety-gated |

A connector's verification stage remains a separate hard-evidence decision in `lib/sonara-connector-verification.cjs`; a capability class never upgrades verification by itself.

## Aggregation Control Plane

### 1. Connection registry

Every external account or provider connection needs a first-class record:

- tenant ID
- provider family + provider key
- external account/workspace/location ID
- auth mode
- credential reference, never raw secret
- granted scopes
- supported capabilities
- region/data residency attributes
- sandbox vs production
- provider health
- quota and rate state
- cost/budget state
- created/rotated/revoked timestamps
- last successful read/write/reconciliation

### 2. Capability negotiation

A provider family is not a capability guarantee.

Examples:

- one bank may support transactions but not investments
- one social network may support images but not the same video/reel workflow
- one POS may support menu push but not two-way inventory
- one model provider may support text and embeddings but not tools or image generation
- one travel partner may grant reservations but not content modification

SONARA must ask: **Can this exact connection perform this exact operation now?**

### 3. Canonical model + provider envelope

Core SONARA records remain provider-neutral.

Each normalized record preserves:

- canonical SONARA ID
- provider key
- external provider ID
- external version/etag when available
- source timestamp
- received timestamp
- schema/adapter version
- provenance
- provider-specific extension bag
- raw-payload reference only when retention policy permits

Provider-specific fields may extend a record, but cannot silently redefine core state.

### 4. Events and webhooks

Normalize provider events into a common CloudEvents-style envelope with:

- event ID
- source/provider
- type
- tenant/connection
- subject/external ID
- provider timestamp
- SONARA received timestamp
- idempotency/deduplication key
- correlation/trace ID
- adapter/schema version
- signature-verification result
- normalized payload reference
- reconciliation status

### 5. Durable sync

Every sync connector needs:

- initial backfill
- incremental cursor
- checkpoint persistence
- pagination proof
- duplicate handling
- replay handling
- schema drift detection
- deleted/tombstone handling
- per-record error capture
- retry/dead-letter
- last-good checkpoint
- reconciliation

### 6. Mutating connectors

No external write is "successful" merely because an HTTP request returned 2xx.

Required sequence:

1. authority classification
2. tenant + entitlement check
3. exact provider capability check
4. policy and approval
5. idempotency reservation
6. bounded provider call
7. provider receipt persistence
8. webhook/poll confirmation where relevant
9. reconciliation against provider state
10. settled/failed/unknown state
11. audit and telemetry

### 7. Routing

Routing can use deterministic scores, but hard constraints run first.

Hard constraints:

- tenant authorization
- data residency
- provider/account availability
- capability support
- legal/contractual boundary
- action authority
- budget ceiling
- user/provider preference where applicable

Soft score after hard constraints:

`0.25*quality + 0.25*reliability + 0.15*freshness + 0.10*latency_fit + 0.10*cost_fit + 0.15*policy_fit`

Do not silently route a sensitive write to a different provider merely because the score is higher.

## Domain aggregation map

### SONARA One / shared platform

- AI model gateway
- MCP/tool gateway
- SaaS unified API
- workflow automation
- data integration/CDP
- identity/auth connections
- device/IoT/edge event aggregation
- connection/capability registry
- receipts/evidence/reconciliation
- provider telemetry and budgets

### Business Builder™

- banking/financial-data read models
- payments/marketplace provider boundary
- POS/order/menu/KDS aggregation
- ecommerce/storefront/marketplace channel aggregation
- shipping/carrier/tracking/route aggregation
- travel/lodging/property channel connectivity
- jobs/ATS/HR connections
- property/rental/maintenance connections
- vertical industry adapters

### Creator Studio™

- generation provider routing
- media ingest/export/transcode providers
- podcast/music/video distribution
- rights/provenance aggregation
- creator storefront/product channels
- streaming/realtime media partner boundaries
- publication receipts and analytics

### Growth Studio™

- social publishing and analytics
- ads/search/SEO/ASO intelligence
- local places/reputation
- campaign/lead/CRM adapters
- attribution and conversion receipts
- app-store/web analytics connectors

## User experience

Customers should see one **Connections** system with domain-specific views rather than different OAuth/account-management experiences in every product.

Each connection card should show:

- provider and connected account
- capabilities available
- capabilities unavailable
- read/write level
- approval requirements
- last sync
- health
- quota/rate state
- cost state
- errors needing action
- reconnect/reauthorize state
- data freshness
- last reconciliation
- disconnect/delete-data controls

Never show "Connected" as the only state.

Use truthful states such as:

- connected
- limited
- degraded
- setup required
- reauthorization required
- rate limited
- budget blocked
- disabled
- unavailable

## Failure modes to design out

- **Connector-count theater:** catalog size is mistaken for verified customer capability.
- **Green-check connection UX:** OAuth success is shown as healthy even when scopes, quota, sync, webhook or write capability is missing.
- **Webhook-only state:** missed or out-of-order events corrupt local state because no polling/backfill/reconciliation exists.
- **Agent authority leakage:** credentials or generic write tools reach a model without deterministic policy, idempotency, approval and receipt boundaries.
- **Fail-open authority or cost:** execution continues when budget, policy, provider health, rights, residency or authorization cannot be proven.
- **Provider-shaped core data:** one vendor schema becomes SONARA's business model and makes provider replacement expensive.
- **2xx equals complete:** accepted requests are treated as settled payments, publications, orders or jobs without confirmation and reconciliation.
- **SDK/spec drift:** declaring protocol support is confused with proving the installed SDK/transport version actually speaks it.
- **Rights loss through normalization:** provenance, consent, deletion, licensing or AI-use restrictions disappear in RAG/media pipelines.
- **Silent provider substitution:** routing swaps a consequential provider without authorization merely because another route scores better.

## Enterprise requirements

Aggregator depth becomes enterprise-ready only after SONARA proves:

- tenant isolation across connections, cursors, webhooks and receipts
- secret isolation and credential rotation
- least-privilege scopes
- provider webhook signature verification
- idempotent writes
- replay protection
- durable retries and dead letters
- noisy-neighbor/concurrency limits
- schema drift handling
- backfill and restore
- reconciliation correctness
- OpenTelemetry traces/metrics/logs
- SLOs by provider family
- per-tenant/provider cost attribution
- audit export
- data deletion propagation
- incident and provider-outage playbooks
- provider deprecation/migration lifecycle

## Native integration definition

A provider counts as a **verified SONARA native connector** only after:

1. exact auth flow is implemented
2. required scopes are documented
3. canonical mapping is tested
4. webhooks/sync behavior is tested
5. tenant isolation is tested
6. failure/retry/rate-limit behavior is tested
7. secrets are server-only
8. telemetry exists
9. reconciliation exists for writes
10. sandbox evidence passes
11. one-tenant canary passes
12. production evidence exists for the exact connector version

Research catalogs, SDK references, external unified-API vendor catalogs, and "compatible with" lists do **not** count.

## Implementation order

1. Define connection, capability and provider-envelope contracts.
2. Define external-ID, provenance and canonical-object rules.
3. Standardize OpenAPI 3.2.1, AsyncAPI 3.1, CloudEvents and MCP 2026-07-28 boundaries.
4. Build provider health/quota/cost/capability registry.
5. Build cursor/webhook/receipt/reconciliation primitives.
6. Build idempotent mutation, retry, dead-letter and concurrency contracts.
7. Add aggregation semantic telemetry + SLOs.
8. Ship low-risk read-only connector canaries.
9. Ship exactly one mutating connector behind approval + reconciliation.
10. Expand by domain only after connector-specific evidence.
11. Publish verified native connector counts separately from research/catalog counts.

## Recommended first production aggregator capability

Do **not** begin by aggregating payments, banking, publication writes, or dozens of provider families.

The first production canary should be a **read-only SaaS/Data Connection Aggregator**:

- one tenant
- one low-risk provider
- OAuth/API-key credential reference
- one canonical object type
- incremental cursor
- webhook if available
- provider health
- rate/backoff
- OpenTelemetry
- provenance
- reconciliation of imported state
- explicit disconnect/data-deletion path

That proves the shared aggregation contract without money movement or destructive external authority.

## Repository changes in this wave

This research wave should add:

- `lib/sonara-aggregation-control-plane.cjs`
- deterministic readiness/routing/authority formulas
- cross-industry aggregation-domain registry
- current protocol baseline
- regression tests that keep the registry non-executing
- a Research Lab page
- a link from the existing 2026 market-intelligence page

It should **not** install Nango, Merge, Airbyte, Fivetran, LiteLLM, n8n, Workato, MCP servers, social SDKs, payment SDKs, or any other dependency solely because research found them useful.

Adoption remains a separate engineering decision with license, security, cost, data, tenant, operational, and canary evidence.
