# SONARA 2026 Aggregator Execution Market Analysis

**Observed:** 2026-09-23  
**Repository base:** \`0440239ba7ff9f262de4ba95ba610e3fe7f94811\`  
**Scope:** aggregator market analysis + execution contracts. No provider, credential, migration, external write, payment rail, social publication, device command, or production connector is activated by this document.

## Executive conclusion

SONARA does not need another horizontal catalog expansion.

The competitive milestone is now verified execution depth:

\`one tenant -> one provider -> one read-only capability -> one canonical report -> real authorization -> real sync -> real health -> real telemetry -> real reconciliation -> disconnect/delete proof -> exact deployed SHA evidence\`

Then repeat the same machinery across providers.

The market is mature enough that SONARA should buy or adopt replaceable reach where it eliminates commodity work, while retaining the parts that create durable product value:

- tenant and external-account identity
- connection and credential lifecycle
- capability negotiation
- entitlement and authority policy
- canonical SONARA business state
- durable workflow truth
- idempotency and receipts
- reconciliation and compensation
- observability and SLOs
- usage/cost attribution
- connector certification
- customer-facing health and lifecycle UX
- marketplace billing and lifecycle policy

The governing principle is:

**Providers supply reach. SONARA retains authority, canonical truth, workflow truth, evidence, and customer trust.**

## Current market topology

### 1. Unified SaaS / common-model APIs

Representative market references:

- Merge Unified: https://docs.merge.dev/merge-unified/overview
- Apideck: https://developers.apideck.com/

These products normalize common business categories such as CRM, HRIS, accounting, ATS, file storage, ecommerce, chat, and knowledge systems behind shared APIs.

**SONARA use:** accelerate long-tail read coverage where provider-specific behavior is not the differentiator.

**Do not outsource:** tenant authority, capability truth, business state, receipts, reconciliation, policy, or billing.

### 2. Embedded auth and connector infrastructure

Representative market references:

- Nango: https://docs.nango.dev/
- Paragon: https://docs.useparagon.com/
- Pipedream Connect: https://pipedream.com/docs/connect/
- Workato Embedded: https://docs.workato.com/en/oem/workato-embedded

This layer reduces OAuth, token refresh, connection UX, sync plumbing, webhook handling, and provider-specific maintenance work.

**SONARA use:** embedded or headless connection UX and commodity connector plumbing.

**Boundary:** hosted connection components cannot become SONARA's source of truth. SONARA must still persist its own connection identity, exact scopes, capability state, provider version, health, deprecation state, and evidence references.

### 3. Agent/tool aggregators

Representative market references:

- Composio connected accounts: https://docs.composio.dev/reference/v3/api-reference/connected-accounts
- Composio toolkits: https://docs.composio.dev/docs/toolkits
- MCP: https://modelcontextprotocol.io/

The market is separating tool discovery from authenticated connected accounts. That maps well to SONARA's agent architecture.

**SONARA rule:** discovering a toolkit or MCP tool never grants invocation authority. The exact connected account, tenant, capability, scopes, action class, approval requirement, budget, and audit path must still pass before execution.

### 4. Data / ELT / CDC aggregators

Representative market references:

- Airbyte connector catalog: https://airbyte.com/connectors
- Fivetran connectors: https://fivetran.com/docs/connectors

Airbyte currently markets 700+ connectors, illustrating why raw connector count is no longer a useful differentiator by itself.

**SONARA use:** broad extraction/load reach, databases, warehouses, marketing/product analytics, file sources, and long-tail operational systems.

**SONARA moat:** canonical domain objects, customer-facing freshness, reconciliation, lineage, provenance, tenant isolation, cost attribution, and workflows that act on normalized state.

### 5. iPaaS and workflow ecosystems

Representative market references:

- Workato Connector SDK: https://docs.workato.com/developing-connectors/sdk.html
- n8n integrations: https://n8n.io/integrations

These platforms demonstrate the value of reusable triggers/actions and connector development systems.

**SONARA use:** reference patterns and replaceable commodity reach.

**Boundary:** no external workflow engine becomes a second authority plane for approvals, billing entitlements, sensitive writes, or settled business state.

### 6. Model, AI, RAG, and media routing

Representative categories:

- LLM/model gateways
- embedding/reranking providers
- vector/search providers
- image/video/audio generation providers
- speech/transcription/translation providers
- GPU/compute providers
- MCP tools and agent runtimes
- rights/provenance services

SONARA should treat this as another aggregation family governed by the same connection, policy, health, budget, telemetry, and evidence system.

Hard constraints run before soft routing:

- tenant authorization
- data residency
- provider/account availability
- model/tool capability
- content rights
- privacy/retention policy
- legal/contract boundary
- monetary budget
- user/provider preference
- safety/action authority

Only after those pass should latency, quality, cost, reliability, and freshness influence routing.

### 7. Regulated and vertical aggregators

Representative categories:

- payments and marketplace money movement
- banking/financial data
- restaurant/POS/order aggregation
- shipping/carrier/logistics
- travel/property channels
- healthcare or government systems where applicable
- social publishing and ad platforms
- IoT/device control

These should come later because the consequences of state divergence are higher.

For these domains, a 2xx response is not completion.

The required state machine is:

\`requested -> authorized -> approved -> idempotency_reserved -> provider_accepted -> provider_confirmed -> reconciled -> settled\`

With explicit:

\`failed | unknown | reversed | compensated\`

## Direct vs unified adapter economics

SONARA should not choose direct integrations or unified providers ideologically.

Choose **direct** when:

- the provider is strategically important to the product
- customer volume justifies dedicated maintenance
- provider-specific features create differentiation
- latency/control requirements are high
- margin leakage through a unified vendor becomes material
- exact provider semantics are required
- the operation is consequential and generic fallback would be unsafe

Choose **unified / embedded** when:

- long-tail breadth matters more than provider-specific features
- time to market is the dominant constraint
- maintaining OAuth/version churn has low strategic value
- one unified API adequately covers the required read capability
- the provider can remain replaceable behind a SONARA adapter contract

Choose **hybrid** when economics are close:

- direct adapters for strategic providers
- a unified layer for the long tail
- identical SONARA canonical models and evidence contracts above both

The code contract added in this wave makes this decision deterministic rather than ad hoc.

## Connection Registry

The active database surface is \`business_integration_connections\`.

The older \`organization_integrations\` surface has been retired and must not be revived.

The shared registry needs these first-class concepts:

- organization / tenant
- business/workspace
- provider key
- external account/workspace/property/app identity
- auth type
- opaque credential reference
- exact granted scopes
- environment
- capability state
- provider/API version
- credential/grant expiration
- health
- deprecation/sunset state
- last health check
- last successful sync
- last reconciliation

Raw tokens and provider secrets never belong in the registry record, client payload, logs, analytics, prompts, traces, or generated artifacts.

## Truthful connection UX

A single green "Connected" state is insufficient.

SONARA should surface:

- connected
- limited
- scope missing
- degraded
- reauthorization required
- rate limited
- provider outage
- schema drift
- budget blocked
- revoked
- disabled
- unavailable
- setup required

The state must be derived from real evidence rather than user optimism or OAuth completion.

Each connection card should expose:

- account identity
- capabilities available
- capabilities unavailable
- auth/scopes status
- last successful sync
- data freshness
- provider health
- rate/quota condition
- API/provider version
- deprecation deadline
- last reconciliation
- errors requiring action
- reconnect/reauthorize
- disconnect/revoke/delete controls

## First read-only connector wave

### 1. Google Search Console

Primary reference:
https://developers.google.com/webmaster-tools/v1/searchanalytics/query

The Search Analytics API exposes Google Search performance grouped by dimensions such as date, query, page, country, device, and search appearance.

Important correctness constraint: Google states that Search Analytics does not guarantee every possible row; it returns top rows subject to internal limits. SONARA therefore must not represent this connector as a complete event ledger.

Canonical report:

- clicks
- impressions
- CTR
- average position
- dimensions
- report period
- provider identity/version
- checkpoint
- provenance

### 2. App Store Connect Analytics

Primary references:

- https://developer.apple.com/help/app-store-connect-analytics/overview/analytics-reports-api
- https://developer.apple.com/documentation/appstoreconnectapi

Apple's Analytics Reports API provides bulk exports and supports ongoing reports plus one-time historical snapshots. Apple documents privacy thresholds, delayed completeness, roles, and compressed tab-delimited report files.

SONARA requirements:

- model report requests, reports, instances, and segments separately
- persist processing date/granularity
- account for privacy threshold omissions
- account for reporting completeness delay
- keep App Store analytics distinct from final financial settlement data

### 3. Google Play Developer Reporting

Primary reference:
https://developers.google.com/play/developer/reporting/reference/rest

The API provides Android vitals and app-quality data including crash rate, ANR rate, error counts, anomalies, and other metric sets.

SONARA requirements:

- service-account or delegated auth path modeled explicitly
- package/app identity
- metric-set/version identity
- timeline checkpoint
- dimension/filter fingerprint
- pagination
- per-metric freshness and failure evidence

### 4. Google Analytics Data API

Primary reference:
https://developers.google.com/analytics/devguides/reporting/data/v1

The GA4 Data API provides reporting across metrics/dimensions for a Google Analytics property.

SONARA requirements:

- explicit property identity
- least-privilege read-only scope
- report-query fingerprint
- bounded date windows
- pagination/limit correctness
- source/medium/campaign normalization
- consent-aware interpretation rather than treating analytics as ground truth for every customer action

### 5. PostHog

Primary references:

- https://posthog.com/docs/api
- https://posthog.com/docs/web-analytics

PostHog exposes project-scoped APIs with endpoint-specific API scopes and supports product/web analytics workflows.

SONARA requirements:

- project identity
- narrow read scopes
- query/report version identity
- event-time checkpoints or bounded query windows
- ingestion lag/freshness
- no client-visible personal API keys
- reconciliation between canonical report totals and source responses

## Shared infrastructure before connector expansion

All five connectors must reuse the same primitives:

### Authorization and identity

- tenant-scoped connection
- external account identity
- credential reference
- auth type
- granted scopes
- expiration
- capability negotiation
- revoke/delete lifecycle

### Sync

- initial backfill
- cursor or bounded time-window checkpoint
- pagination
- durable checkpoint persistence
- retry/backoff
- provider Retry-After behavior
- duplicate/replay handling
- deletion/tombstone semantics where applicable
- last-good checkpoint
- resync/backfill path

### Reconciliation

Every connector needs a repeatable comparison between source provider state and canonical SONARA state.

A webhook or successful HTTP call is never enough evidence by itself.

### Telemetry

OpenTelemetry semantic conventions:
https://opentelemetry.io/docs/specs/semconv/

Required connector attributes should include:

- tenant/organization identifier or privacy-safe internal surrogate
- connection identifier
- provider family/key
- adapter version
- provider version
- capability/operation
- auth path class
- attempt/result/error class
- latency
- retry count
- rate/quota state
- records read/written
- checkpoint age
- reconciliation result
- cost attribution
- trace/correlation identifier

Do not emit raw credentials, user secrets, full authorization headers, or unnecessarily sensitive provider payloads.

## Industry expansion map

The broad industries requested by SONARA do not require separate control planes.

They map into reusable domain packs:

### SONARA One / platform

- AI models and agents
- RAG and search
- identity/collaboration/storage
- agent tools / MCP
- databases/data pipelines
- deterministic workflows
- compute/GPU/CPU
- realtime communications
- device/sensor inputs
- security/monitoring
- notification/sound/haptics

### Business Builder

- SMB and enterprise operations
- POS/kiosk
- restaurants/food
- trucking/logistics
- HVAC/electrical/plumbing/carpentry
- cleaning and field services
- project/work management
- waste management
- ecommerce/order/delivery
- payments/accounting/banking
- insurance/risk
- real estate/rentals
- jobs/ATS/HR
- manufacturing
- utilities
- vehicle/EV/fleet
- engineering/CAD metadata
- government/open data

### Growth Studio

- Search Console
- GA4
- PostHog
- SEO/ASO
- attribution
- social analytics
- CRM
- campaign systems
- ads
- reputation/reviews
- app-store analytics
- web analytics
- email and customer lifecycle

### Creator Studio

- video/audio/image
- podcasting
- music
- movies/production
- books/artists
- streaming
- speech/text/chat
- translation
- generation providers
- media rights/provenance
- publishing/distribution

The vertical UI and canonical objects change; the connection, policy, sync, evidence, telemetry, and reconciliation machinery should not.

## Connector Marketplace roadmap

The Marketplace should follow production proof, not precede it.

A connector manifest should eventually declare:

- provider key/family
- version compatibility
- auth methods
- scopes
- capability classes
- canonical objects
- read/write authority level
- webhook behavior
- cursor/checkpoint semantics
- rate-limit contract
- data residency/retention notes
- required approvals
- telemetry contract
- test fixtures
- certification level
- supported SONARA versions
- owner/maintainer
- security review
- license/commercial review
- deprecation/sunset policy

Certification levels should be evidence-based:

1. research only
2. adapter contract
3. sandbox verified
4. tenant canary verified
5. production verified

Only the final stage counts as a verified native connector.

## Metrics that matter

Do not optimize for catalog count.

Track:

- production-verified connections
- operations supported per connector
- authorization success
- sync success rate
- sync freshness
- checkpoint lag
- reconciliation accuracy
- webhook delivery/replay correctness
- SLO attainment
- provider error rate
- reauthorization rate
- schema/provider-version drift incidents
- cost per successful sync/action
- active connections
- connector adoption
- revenue influenced
- retention influenced
- support burden per connector

## Recommended execution order

1. Merge this control-plane wave only after normal CI/review.
2. Verify exact deployed SHA before enabling any connector runtime.
3. Generate a version-controlled migration extending \`business_integration_connections\`.
4. Update the Connections UX to the truthful state model.
5. Build shared sync/checkpoint/reconciliation/telemetry infrastructure.
6. Implement Google Search Console read-only first.
7. Prove one real tenant and one real Search Console property end to end.
8. Prove disconnect/revoke/delete behavior.
9. Prove exact production SHA and tenant canary evidence.
10. Repeat with App Store Connect Analytics.
11. Repeat with Google Play Developer Reporting.
12. Repeat with GA4.
13. Repeat with PostHog.
14. Add Shopify, HubSpot, Microsoft Graph, Slack, and QuickBooks in read-first mode.
15. Introduce exactly one bounded write with idempotency, approval, receipt, confirmation, reconciliation, and compensation.
16. Add regulated/high-consequence domains only after the write contract is proven.
17. Build the Connector Marketplace around evidence already produced by real connectors.

## Repository changes in this wave

- \`lib/sonara-connection-registry.cjs\`
- \`lib/sonara-read-only-connector-wave.cjs\`
- \`lib/sonara-aggregator-sourcing-policy.cjs\`
- \`tests/sonara-aggregator-execution-wave.test.js\`
- this market analysis

All runtime flags remain off.

No provider credentials were added.

No production database was mutated.

No connector was declared production verified.

No external write authority was granted.
