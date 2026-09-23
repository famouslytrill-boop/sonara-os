# SONARA 2026 Verified Connector Depth Market Analysis

**Observed:** 2026-09-22  
**Scope:** market research + engineering contract; no provider is enabled by this document.  
**Decision:** SONARA's current integration bottleneck is verified connector depth, not conceptual architecture.

## Executive conclusion

The Aggregation Control Plane is directionally sufficient. The next competitive gap is execution evidence.

SONARA should stop treating "integration breadth" as the primary milestone and measure a connector by whether it can survive the entire external-system lifecycle:

`authorize -> scope -> connect -> discover capabilities -> initial sync -> incremental sync/event -> normalize -> reconcile -> observe -> recover -> reauthorize -> disconnect/delete -> prove production behavior`

For an external write:

`authorize -> classify authority -> approve when required -> reserve idempotency -> execute -> persist provider receipt -> confirm provider state -> reconcile -> settle/compensate -> audit`

A connector does **not** count as verified because:

- the provider appears in a registry;
- an SDK or open-source repository exists;
- an OAuth window can be opened;
- one request returned 2xx;
- an MCP/unified-API vendor exposes the provider;
- a mock test passes;
- a provider has been researched;
- an environment variable is present.

A connector counts as **verified SONARA-native** only after sandbox evidence, failure-mode evidence, one-tenant canary evidence, controlled production evidence at the exact live SHA, rollback evidence, tenant/security proof, reconciliation, operations/SLO proof and deletion/disconnect proof all exist.

The machine-readable contract for this decision is `lib/sonara-connector-verification.cjs`.

## 2026 market benchmark

Connector scale is now enormous:

| Platform pattern | Current public signal | What SONARA should copy | What SONARA should not copy |
| --- | --- | --- | --- |
| Zapier | 9,000+ apps; workflow, SDK and MCP surfaces | discovery, reusable actions, broad customer expectation of connectivity | treating catalog size as proof that SONARA itself supports 9,000 providers |
| Composio | 1,500+ agent-connected apps in current docs, with managed auth/context and event subscriptions | per-user connections, scoped auth, runtime tool discovery, event routing | granting agents unrestricted mutation authority |
| Merge | hundreds of integrations, normalized unified APIs, linked accounts, sandboxes, observability | common models, linked-account lifecycle, sandbox and sync operations | flattening provider-specific capabilities until important differences disappear |
| n8n | 1,000+ apps/services | visible automation graph, retry/batching/rate-limit patterns, extensibility | allowing workflow convenience to bypass SONARA policy or evidence |
| Airbyte/Fivetran | hundreds of data connectors and mature state/schema handling | cursor/checkpoint correctness, backfill, schema drift, replay, lineage | counting a sync as correct because rows arrived once |
| Workato | mature connection + recipe + trigger/action runtime | explicit connection objects, webhook/polling semantics, job history and failure operations | hidden provider state or opaque "connected" status |
| Nango/Paragon class | embedded auth/connect infrastructure | OAuth/API-key lifecycle, refresh/revoke, embedded connection UX | outsourcing SONARA's authority model to the auth vendor |

Current sources:
- Zapier: https://help.zapier.com/hc/en-us/articles/37518970271245-What-is-Zapier
- Zapier developer platform: https://zapier.com/developer-platform
- Composio: https://docs.composio.dev/docs
- Merge: https://docs.merge.dev/home
- n8n: https://n8n.io/integrations
- Airbyte connectors: https://airbyte.com/connectors
- Fivetran connectors: https://fivetran.com/docs/connectors
- Workato: https://docs.workato.com/en/developing-connectors/sdk
- Nango: https://docs.nango.dev/guides/platform/auth
- Paragon: https://docs.useparagon.com/

The strategic consequence is simple: SONARA cannot win near-term by trying to match catalog counts. It can become commercially credible by shipping a smaller set of connectors whose behavior is measurable, tenant-safe and operationally reliable.

## The connector depth contract

Every provider connection should have first-class evidence across these layers.

### 1. Identity and connection lifecycle

Required:

- tenant / organization ID;
- provider family and provider key;
- exact external account/workspace/store/property/app ID;
- auth mechanism;
- credential reference, never raw credential in customer payloads or logs;
- exact granted scopes;
- token/credential expiry;
- refresh/rotation behavior;
- revocation and disconnect behavior;
- sandbox/production environment;
- region/data-residency attributes where applicable;
- last successful authorization and reauthorization;
- provider-side capability or permission discovery.

The database must not reduce this to `connected: true`.

### 2. Capability negotiation

The runtime question is not "is Shopify connected?" or "is Google connected?"

It is:

> Can this exact tenant connection execute this exact operation, with these scopes, in this environment, at this moment?

Store capability state independently for reads, writes, webhooks, bulk operations, media types, regions, account tiers and provider-specific restrictions.

Example states:

- available;
- unavailable;
- scope missing;
- plan/tier restricted;
- provider beta;
- temporarily degraded;
- reauthorization required;
- budget blocked;
- region restricted.

### 3. Canonical mapping and provider envelope

Every normalized entity should preserve:

- SONARA canonical ID;
- provider key;
- external object ID;
- external account/workspace ID;
- external version / ETag / updated token when available;
- source timestamp;
- received timestamp;
- adapter/schema version;
- provenance;
- provider-specific extension fields;
- raw payload reference only when retention policy permits.

Do not let a provider-specific shape silently redefine SONARA's system of record.

### 4. Read/sync correctness

A production read connector needs proof of:

- initial backfill;
- pagination;
- incremental cursor;
- checkpoint persistence;
- restart from last good checkpoint;
- duplicates;
- replay;
- deleted/tombstoned entities;
- schema/API version changes;
- per-record failures;
- partial-page failures;
- rate limiting;
- retry/backoff;
- resync/backfill;
- reconciliation against provider state.

Airbyte's cursor/state model and Fivetran's schema-evolution behavior illustrate why this is deeper than fetching JSON.

### 5. Webhook correctness

When webhooks are supported:

- verify provider signature;
- identify tenant/connection before business processing;
- deduplicate by provider delivery/event ID;
- persist or enqueue before acknowledging when the provider deadline requires quick acknowledgement;
- record provider timestamp and receive timestamp;
- reject replay or invalid signature;
- retry processing independently of provider delivery;
- use polling/delta/backfill as the missed-event backstop when the provider supports it.

Microsoft Graph explicitly recommends combining change notifications with delta query/backstop behavior rather than assuming notification delivery alone is enough.

### 6. Mutating connector correctness

Every write must add:

- authority classification;
- tenant + entitlement check;
- capability and scope check;
- human approval when action class requires it;
- deterministic idempotency key;
- bounded provider request;
- provider request/receipt ID;
- reconciliation against provider state;
- settled, failed or unknown outcome;
- retry rules that cannot duplicate the business action;
- rollback/compensation path where possible.

Stripe's idempotency model is the correct class of behavior to preserve: retries must not create duplicate mutations.

### 7. Operational depth

Every connector needs:

- health state;
- last successful read/write/event/reconciliation;
- error class and last error time;
- rate-limit state;
- quota state;
- cost/budget state;
- latency and reliability;
- retries and dead-letter count;
- queue age where asynchronous;
- provider/API version;
- deprecation deadline;
- reconnect status;
- OpenTelemetry trace/metric/log correlation;
- SLO and error budget;
- runbook;
- provider outage procedure;
- credential-compromise procedure;
- disconnect/data-deletion procedure.

## Verification stages

SONARA should publish one internal maturity vocabulary:

1. **research_only** — market/API research only.
2. **adapter_contract** — bounded adapter interface exists and configuration fails closed.
3. **sandbox_verified** — real provider sandbox/test-account evidence plus required failure modes.
4. **tenant_canary_verified** — one isolated tenant has exercised the exact workflow with rollback and telemetry.
5. **production_verified** — controlled production evidence exists for the exact live SHA and all required operations/deletion/runbook/SLO evidence is present.

Only stage 5 contributes to a verified-native connector count.

A numeric depth score may prioritize engineering work, but it must never promote a connector across an evidence stage.

## Immediate build sequence

### Wave 1 — read-only, measurable customer value

Preserve the already-selected order:

1. Google Search Console
2. App Store Connect analytics/API read surface
3. Google Play Developer Reporting
4. Google Analytics Data API
5. PostHog

Why this sequence:

- reads are reversible and lower-risk;
- each has clear customer value in Growth/Creator operations;
- they exercise multiple credential models;
- they force SONARA to prove scopes, pagination/query windows, provider IDs, freshness and reconciliation;
- they produce a reusable connection runtime before money movement or public publishing.

Provider-specific 2026 notes:

**Google Search Console**
- OAuth 2.0 is required for private user data.
- A read-only scope exists: `https://www.googleapis.com/auth/webmasters.readonly`.
- Property permission levels are returned and should become connection capability evidence.
- Source: https://developers.google.com/webmaster-tools/v1/how-tos/authorizing

**App Store Connect**
- Treat key identity, role/access, key rotation/revocation and exact app/team access as first-class connection state.
- Never store a downloaded private key in browser-accessible configuration.
- Source: https://developer.apple.com/documentation/appstoreconnectapi

**Google Play Developer Reporting**
- Service accounts are recommended for automation.
- Grant the minimum Play Console permissions required for the requested metric sets.
- The reporting API exposes quality data such as crash/ANR and error information.
- Source: https://developers.google.com/play/developer/reporting/overview

**Google Analytics Data API**
- Use the read-only analytics scope when writes are unnecessary.
- Keep property identity and dimensions/metric query evidence with each run.
- Source: https://developers.google.com/identity/protocols/oauth2/scopes

**PostHog**
- Use narrowly scoped personal/project API credentials for server-side reads.
- Record project ID and host with the connection; self-hosted and cloud deployments must not be conflated.
- Source: https://posthog.com/docs/api

### Wave 2 — CRM, commerce and collaboration

After the Wave 1 connection runtime is proven:

- HubSpot;
- Shopify GraphQL Admin API;
- Microsoft Graph;
- Slack;
- QuickBooks Online.

Important current market changes:

**HubSpot**
- HubSpot announced migration from legacy v1 OAuth toward date-based OAuth endpoints, including token revoke; connector code needs explicit provider-version/deprecation tracking.
- Source: https://developers.hubspot.com/changelog/v1-oauth-api-deprecation

**Shopify**
- Build new integrations against GraphQL Admin API rather than the legacy REST Admin API.
- Shopify's latest stable API at this observation date is 2026-07 and versions are released quarterly.
- Webhook payloads are versioned and include an HMAC signature and webhook ID for verification/deduplication.
- Sources:
  - https://shopify.dev/docs/api/admin-graphql/latest
  - https://shopify.dev/docs/api/usage/versioning
  - https://shopify.dev/docs/api/webhooks

**Microsoft Graph**
- Use webhooks/change notifications plus delta/backstop synchronization where supported.
- Do not assume one notification stream is a durable system of record.
- Source: https://learn.microsoft.com/graph/webhooks-with-resource-data

### Wave 3 — regulated or consequential mutations

Do not use these to prove the first generic connector runtime:

- Stripe Connect money movement/refund/payout changes;
- Plaid mutating/payment products;
- social publication;
- paid-ad mutations;
- POS/order writes;
- security settings;
- cameras/biometric decisions;
- IoT/device control;
- government/regulatory submissions.

These can reuse the same connection model later, but they require stronger approval, legal/compliance and settlement boundaries.

## Cross-industry market map

The user's requested scope is broad, but it does not require separate connector infrastructure for every industry.

### SONARA One / shared platform

One connector system should cover:

- LLM/model providers;
- embeddings/rerankers/vector systems;
- MCP/tool servers;
- RAG data sources;
- identity/OAuth/OIDC/directory providers;
- Google/Microsoft collaboration suites;
- Slack/chat;
- GitHub/developer systems;
- storage/object/file systems;
- databases/data warehouses;
- observability;
- notifications/email/SMS/calling providers;
- maps/places/GPS;
- IoT/edge/device telemetry;
- compute/GPU/media worker providers.

### Business Builder™

Connector packs should specialize the same runtime for:

- CRM/accounting;
- banking and financial data;
- checkout/subscriptions/invoices;
- ecommerce/storefront/marketplaces;
- POS/kiosk/menu/KDS;
- restaurant delivery and ordering;
- trucking/fleet/dispatch/GPS;
- shipping/rates/labels/tracking;
- HVAC/electrical/plumbing/carpentry/cleaning;
- work orders/scheduling/time/labor;
- construction/project/CAD document metadata;
- manufacturing/ERP/MES/inventory/quality;
- waste/field operations;
- jobs/ATS/HR;
- property/rental/real-estate;
- venue/booking/access systems;
- public/open-data systems.

### Growth Studio™

Prioritize:

- Search Console;
- GA4;
- PostHog;
- app-store analytics;
- CRM;
- email/SMS;
- social analytics;
- reviews/reputation;
- local search/places;
- SEO/ASO;
- attribution;
- ad reporting;
- only later, approval-gated campaign/ad/publication writes.

### Creator Studio™

Prioritize:

- media ingest/storage;
- transcription;
- image/audio/video generation provider gateway;
- metadata and rights/provenance;
- video/social/podcast analytics;
- YouTube and platform read data;
- podcast/RSS distribution evidence;
- creator storefront/catalog;
- streaming/realtime media;
- only later, approval-gated publication and monetization mutations.

### Restricted/safety-sensitive surfaces

Government, military, biometrics, cameras, security monitoring and robotics should not be treated as ordinary automation connectors.

For SONARA:
- public/official data reads may fit the normal read-only model;
- security monitoring must be limited to owned/authorized targets;
- biometric processing needs explicit purpose, consent, retention and access controls;
- physical/device actions require dedicated safety and human-control gates;
- nothing in this research authorizes surveillance, weapons, destructive cyber activity or autonomous physical control.

## Database direction

Do not add provider-specific token columns to random product tables.

The eventual durable model should converge on entities equivalent to:

- `integration_connections`
- `integration_connection_capabilities`
- `integration_credentials` or secret references
- `integration_sync_cursors`
- `integration_webhook_deliveries`
- `integration_runs`
- `integration_run_items`
- `integration_receipts`
- `integration_reconciliations`
- `integration_health_snapshots`
- `integration_rate_budgets`
- `integration_schema_versions`
- `integration_verification_evidence`

Before adding migrations, reconcile these names against existing SONARA tables such as `organization_integrations`, `entity_connectors`, `entity_connector_events`, provider registry tables and durable event infrastructure. Reuse first; do not create parallel systems.

## Admin UX direction — Connector Verification Lab

Do not build a decorative integrations marketplace first.

The useful admin surface should show, per connector and connection:

- provider/account;
- environment;
- exact scopes;
- capabilities;
- evidence stage;
- verification blockers;
- last auth/refresh;
- last sync/cursor;
- webhook health;
- reconciliation status;
- rate/quota/budget;
- last error;
- SLO;
- provider/API version;
- deprecation deadline;
- canary tenant;
- exact production SHA used for proof;
- disconnect/delete-data evidence.

Customer UX may simplify this, but admin truth must remain detailed.

## Metrics that matter

Do not optimize the connector program around raw catalog size.

Track:

- verified-native connector count;
- sandbox-verified connector count;
- active tenant connections;
- connection success rate;
- OAuth completion rate;
- reauthorization rate;
- median time to first successful sync;
- sync freshness;
- reconciliation mismatch rate;
- duplicate-event rate;
- cursor reset/backfill rate;
- webhook verification failures;
- 429/rate-limit frequency;
- retry recovery rate;
- dead-letter rate;
- provider incident minutes;
- p50/p95 provider latency;
- per-tenant/provider cost;
- support tickets per 100 active connections;
- connector adoption;
- connector retention;
- revenue/activation influenced by connectors.

## What to build versus buy

Use three lanes.

**Build natively** when:
- the connector is strategically central;
- customer demand is high;
- provider API is stable/documented;
- the canonical model is a SONARA differentiator;
- operations can be supported.

**Use an aggregation/unified provider** when:
- breadth matters faster than native development;
- it can preserve tenant/account/scopes/capability evidence;
- it does not undermine SONARA's authority/audit model;
- total cost is justified;
- exit/migration is possible.

**Keep research/reference only** when:
- licensing/terms are unresolved;
- API access is restricted;
- provider does not offer a supported production interface;
- the workflow is safety-critical or heavily regulated;
- demand is speculative;
- integration would exist only to increase a catalog count.

## Repository action from this research wave

This research wave adds:

- `lib/sonara-connector-verification.cjs` — machine-readable evidence stages, required proof sets, depth scoring, build waves and cross-industry domain map;
- `tests/sonara-connector-verification.test.js` — fail-closed verification semantics;
- this market/research document;
- a public Research Lab explanation on the aggregator intelligence page.

It adds **zero** dependencies, credentials, database migrations, provider calls, payment rails, social publication actions or runtime connector authority.

## Next executable engineering unit

After this exact PR head is green, merged and production-verified, the next isolated runtime capability should remain:

**Google Search Console read-only connector for one tenant and one property.**

Definition of done:

1. OAuth flow with read-only scope.
2. Tenant-scoped connection record and secret reference.
3. Exact property ID and permission captured.
4. Capability discovery.
5. Search Analytics read path with bounded query/date windows.
6. Pagination/dimension handling where applicable.
7. Durable run and provider request evidence.
8. Rate-limit/backoff behavior.
9. Provenance and normalization into an isolated canonical read model.
10. Reconciliation/freshness evidence.
11. Reauthorization/disconnect/data-deletion path.
12. OpenTelemetry traces/metrics/logs with no tokens or unnecessary customer data.
13. Real Google test-account/sandbox-like evidence where available.
14. One-tenant canary.
15. Controlled production deployment and exact live-SHA evidence.
16. Only then mark it production-verified.

Do not start Wave 2 or a mutating connector merely because its adapter compiles.
