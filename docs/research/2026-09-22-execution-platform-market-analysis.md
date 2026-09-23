# SONARA 2026 Execution Platform Market Analysis

**Observed:** 2026-09-22  
**Repository baseline:** `0440239ba7ff9f262de4ba95ba610e3fe7f94811`  
**Decision:** stop treating provider catalog breadth as the next milestone. Convert the aggregation architecture into repeatable production evidence one provider and one capability at a time.

## Executive decision

The next competitive milestone is:

`one real tenant -> one real provider -> one read-only capability -> one canonical object/report -> real authorization -> real sync -> real health -> real telemetry -> real reconciliation -> disconnect/delete proof -> production evidence`

Then reuse that machinery for the next provider.

SONARA already has enough domain breadth to cover the requested market surface without building hundreds of unrelated integration subsystems. The execution moat is the shared machinery around each adapter:

- tenant and connection authority;
- least-privilege authorization and credential lifecycle;
- capability negotiation;
- canonical object/report mapping;
- bounded fetch/sync and checkpoint semantics;
- retries, rate limits, health and failure states;
- provenance and OpenTelemetry;
- reconciliation against provider truth;
- revoke/disconnect and data-deletion evidence;
- canary, SLO, rollback and exact-live-SHA proof.

A vendor existing in a catalog, an SDK importing successfully, OAuth rendering, or one HTTP 2xx response is not a production integration.

## Current 2026 market evidence

The strongest current integration products converge on a similar separation of concerns even though their product categories differ.

| Market pattern | Current evidence | SONARA implication |
| --- | --- | --- |
| Managed authorization | Nango and similar embedded-integration platforms separate end-user/provider authorization from application business state and handle credential lifecycle centrally. | Credentials and refresh behavior belong in one governed connection layer, not inside each product feature. |
| Per-user/per-connection authority | Composio-style connected-account and session models bind tools to a user's authorized account rather than making a toolkit globally authoritative. | A provider family being available must never imply that a tenant or connection is authorized. |
| Auth + action + proxy | Pipedream Connect combines account authorization with provider calls/tools while keeping credentials out of the client. | SONARA should keep provider credentials server-side and expose only bounded capabilities. |
| Connector vs connection | Workato distinguishes connector definitions from reusable authenticated connections and exposes job/error history. | SONARA needs adapter contract, connection instance, execution run and evidence as separate records. |
| Common model + sync | Merge normalizes provider-specific objects behind common models while retaining provider-linked sync behavior. | Canonical objects must preserve provider identity, version/provenance and provider-specific extensions. |
| Data pipeline correctness | Airbyte/Fivetran emphasize connectors, schema evolution and maintained sync behavior rather than one-off requests. | Cursor/checkpoint, replay, tombstones, schema drift and backfill are part of the connector contract. |
| Regulated platform rails | Stripe Connect and Plaid expose valuable breadth behind explicit account, product, institution, identity and regulatory constraints. | Financial breadth must remain provider-governed; SONARA owns workflow truth and reconciliation, not regulated rails. |
| Semantic observability | OpenTelemetry standardizes trace/metric semantics across execution boundaries. | Correlation IDs, provider/connection/capability labels and error classes should be consistent across every connector. |

Primary/current references:

- Google Search Console authorization: https://developers.google.com/webmaster-tools/v1/how-tos/authorizing
- Google Search Analytics query: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- Google Search Console limits: https://developers.google.com/webmaster-tools/limits
- Google OAuth web-server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Workato iPaaS/connections: https://docs.workato.com/en/ipaas
- Nango authorization/integration docs: https://docs.nango.dev/
- Composio authentication/connected accounts: https://docs.composio.dev/
- Pipedream Connect: https://pipedream.com/docs/connect
- Merge common models/sync: https://docs.merge.dev/
- Airbyte connectors: https://airbyte.com/connectors
- Fivetran connectors: https://fivetran.com/docs/connectors
- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/specs/semconv/
- Stripe Connect: https://docs.stripe.com/connect
- Plaid institutions/products: https://plaid.com/docs/institutions/

Vendor catalog counts and vendor-reported customer/usage metrics are market signals only. They are not SONARA native-integration counts or production evidence.

## Why Google Search Console is the first execution canary

Search Console is a useful first provider because the first capability can be genuinely read-only and still forces the platform to solve real integration problems.

Verified provider constraints:

- OAuth 2.0 is required.
- The least-privilege scope is `https://www.googleapis.com/auth/webmasters.readonly`.
- Background sync requires offline authorization/refresh-token lifecycle.
- Search Analytics accepts bounded date windows, dimensions, `rowLimit` and `startRow`.
- `rowLimit` is capped at 25,000.
- Google documents a maximum of 50,000 rows per day per search type for this extraction pattern.
- Search Analytics can expose top rows rather than every possible row, so a connector must preserve coverage limitations instead of claiming complete data.
- Search Analytics is quota governed; rate limiting and expensive query patterns are real operating constraints.

The first canonical object is therefore:

`growth.search_performance_daily_report.v1`

with page-level rows plus the property/day provider summary and an explicit reconciliation delta.

The adapter added in this implementation wave deliberately reports `adapter_contract`, not `production_verified`. Live verification remains blocked until SONARA has tenant-safe external OAuth credential custody, refresh rotation, persistent checkpoint/report storage, revoke/delete evidence, a real tenant canary and exact-live-SHA/SLO proof.

## Execution scorecard

Connector progress should now be measured with execution metrics, not provider-count growth.

| Metric | Formula / evidence |
| --- | --- |
| Authorization completion | successful authorized connections / authorization attempts |
| Least-privilege compliance | connections whose granted scopes equal an approved capability scope set / active connections |
| Time to first successful read | first canonical read completed timestamp - authorization completed timestamp |
| First-read success | connections reaching a valid canonical object / newly authorized connections |
| Freshness lag | current time - provider data-through timestamp |
| Cursor/checkpoint durability | successful restarts from persisted checkpoint / restart tests |
| Duplicate suppression | duplicate/replay events suppressed / duplicate/replay events injected |
| Retry recovery | transient provider failures recovered inside bounded policy / transient failures |
| Reconciliation coverage | executions with provider-vs-canonical reconciliation evidence / completed executions |
| Reconciliation delta | provider summary - canonical observed total, preserved by metric rather than hidden |
| Auth refresh health | successful token refreshes / refresh attempts |
| Provider health | successful bounded calls, latency, rate-limit and availability state by connection |
| Disconnect proof | successful provider revoke + local credential deletion + downstream deletion/tombstone proof / disconnect requests |
| Tenant isolation proof | cross-tenant adversarial tests blocked / attempted cross-tenant accesses |
| Production evidence completeness | required verification proofs present / proofs required for that capability class |
| Exact-live proof | deployed commit equals reviewed/merged SHA and post-deploy checks pass |
| Unit economics | provider/API/compute cost attributed to tenant + capability / successful canonical executions |

A connector should not advance stages because its score is high. Verification stage is an evidence gate, not a weighted average.

## 29-domain execution conversion

The existing domain architecture remains useful, but every domain now needs a first **canonical read object** before it earns mutating authority.

| Domain | First canonical read object/report | First execution proof |
| --- | --- | --- |
| AI model gateway | model capability + usage/latency/cost snapshot | provider identity, model/version, budget and trace provenance |
| Agent/tool gateway | tool capability manifest + invocation-readiness report | exact tenant/tool/action authority and denial tests |
| SaaS unified API | account/workspace + one common-model object | scoped auth, external ID mapping and sync freshness |
| Workflow automation | workflow/job execution history | idempotent run identity, retry/dead-letter and terminal state |
| Data integration/CDP | source schema + incremental record batch | cursor/checkpoint, schema drift and replay |
| Banking/financial data | account + transaction/holding snapshot | institution capability, consent scope, freshness and reconciliation |
| Payments/marketplace | payment/payout/dispute read model | provider receipt/readback and settlement-state reconciliation |
| Restaurant/order/POS | menu + order + location read model | external order IDs, modifiers/taxes and location isolation |
| Social publishing | account + content/analytics capability report | network-specific capability negotiation before any publish write |
| Commerce/catalog/marketplace | product/inventory/order snapshot | variant identity, inventory source and channel reconciliation |
| Shipping/delivery/routes | shipment/tracking/route snapshot | carrier/provider status, timestamp and delivery-event reconciliation |
| Travel/lodging | property/inventory/reservation snapshot | connection permissions, property identity and availability freshness |
| Places/reviews/reputation | place/profile/review snapshot | place identity, source provenance and update timestamp |
| Creator/media distribution | asset/release/channel analytics report | rights/provenance, provider asset ID and delivery status |
| Identity/auth | connection identity + granted-scope report | subject/account binding, token lifecycle and revocation |
| Jobs/talent | listing/application/candidate snapshot | external identity mapping and consent/retention boundaries |
| Property/real estate | property/listing/lease/lead snapshot | property identity, region/source and freshness |
| IoT/edge/robotics | device inventory + telemetry snapshot | device identity, user/tenant authorization and stale-signal handling |
| Public sector/open data | dataset/resource snapshot | source authority, license, update time and schema version |
| Communications/omnichannel | channel/account + delivery-status read model | recipient/channel identity, consent and provider delivery receipt |
| App-store distribution/analytics | app/version/performance report | app ownership, report date and provider reconciliation |
| Ads/search/marketing | search/ad/campaign analytics report | account scope, sampled/bounded data disclosure and spend readback |
| Cloud/compute/storage/observability | resource inventory + usage/health report | account/project scope, region and telemetry correlation |
| Manufacturing/supply chain | item/BOM/work-order/inventory snapshot | facility identity, unit/version mapping and change provenance |
| Insurance/risk | policy/claim/risk-factor snapshot | policy authority, effective dates and source provenance |
| Utilities/energy | meter/account/usage snapshot | account authorization, interval/timezone and meter identity |
| Education/learning/translation | course/roster/progress/translation-job snapshot | learner/account scope, locale/version and privacy boundary |
| Gaming/platform services | title/player-owned account/telemetry snapshot | account linking, platform capability and anti-cheat/privacy boundary |
| Mobility/vehicle/fleet | vehicle/trip/maintenance/telemetry snapshot | vehicle identity, driver/account consent and stale-location handling |

This table converts the user's broader requested markets—restaurants, trucking, trades, HVAC, electrical, plumbing, carpentry, cleaning, manufacturing, finance, insurance, utilities, media, podcasts, gaming, AR, GPS, devices, government, education, real estate, jobs, commerce, app stores and AI—into one repeatable connector methodology instead of separate integration architectures.

## Risk-ordered execution waves

### Wave 1 — read-only digital analytics

1. Google Search Console.
2. App Store Connect analytics/reporting.
3. Google Play reporting.
4. GA4.
5. PostHog.

Goal: prove the connection/runtime machinery where consequences are low and reconciliation is measurable.

### Wave 2 — read-only business operations

Add one provider at a time for commerce, CRM, help desk, calendar/scheduling, field service, POS/order, shipping, media analytics and public/open data.

Goal: prove canonical object mapping, incremental sync, webhook backstop and schema drift across heterogeneous APIs.

### Wave 3 — event ingress and bidirectional state observation

Add signed webhooks/poll backstops, dedupe, persist-before-ack, replay and desired-vs-observed state.

Goal: prove durable event correctness before SONARA gains broad outbound authority.

### Wave 4 — bounded low-risk writes

Permit narrowly scoped writes only after approval/authority/idempotency/provider-receipt/reconciliation machinery is demonstrated.

Examples: draft creation, internal task creation, non-public metadata updates.

### Wave 5 — consequential and regulated mutations

Payments, payouts, banking movement, public publishing, ad-spend changes, security settings, identity changes, device/robot commands and destructive data actions remain last.

These require stronger owner approval, compensation/rollback where possible, settlement evidence, legal/provider constraints and domain-specific safety interlocks.

## Architecture SONARA should own

Do not outsource these to an aggregator vendor:

- tenant authority and entitlement;
- canonical IDs and business truth;
- capability classes and action authority;
- deterministic workflow state;
- approval and idempotency;
- evidence/provenance;
- reconciliation and settled state;
- telemetry/SLOs;
- usage attribution and product billing;
- connector verification stage;
- deletion/retention policy;
- exact-live release evidence.

Provider or aggregator infrastructure can remain replaceable for long-tail OAuth coverage, provider-specific transport, commodity schema translation, specialized compute and regulated rails.

## Repository changes in this execution wave

Branch: `feat/search-console-read-canary-20260922`

Implemented:

- `lib/sonara-google-search-console-read.cjs`
  - fixed Google API origin;
  - exact read-only scope requirement;
  - tenant/business/connection execution context required before network access;
  - single-day bounded Search Analytics extraction;
  - 25,000-row pagination with a 50,000-row daily boundary;
  - bounded retry for 429/5xx/network failure;
  - canonical page rows + daily report;
  - provider summary vs observed page-row reconciliation;
  - coverage limitation preserved instead of hidden;
  - evidence hash;
  - no access-token material in returned evidence;
  - explicit adapter-contract stage and production blockers.
- Growth Studio readiness now exposes the first execution-canary contract.
- Connector verification tests exercise fail-closed tenancy/scope, pagination, reconciliation, bounded retry and credential non-leakage.
- Proprietary-source count is ratcheted for the new shipped module.

## What is intentionally not implemented yet

This branch does **not**:

- store a Google OAuth client secret or refresh token;
- use Google sign-in tokens as Search Console authorization;
- create a second ungoverned secret system;
- claim a sandbox, tenant canary or production verification result;
- deploy a migration merely to make the connector look more complete;
- enable writes to Google, ads, social networks, payments, banking or devices;
- convert researched-provider count into a native-integration marketing claim.

## Hard blockers before the first real tenant sync

1. Choose and implement the server-only credential-custody mechanism for external tenant OAuth credentials.
2. Add exact Search Console OAuth consent flow using only the read-only scope and offline access.
3. Bind the returned provider identity/site permissions to one `business_integration_connections` row.
4. Add a persistent sync checkpoint and canonical report storage contract.
5. Execute a real authorized one-day read against one tenant/site.
6. Persist health, trace/correlation, quota/retry and reconciliation evidence.
7. Disconnect the provider, revoke authorization, remove local credential material and prove downstream deletion/retention behavior.
8. Run the connector-verification evidence gate.
9. Deploy through the normal controlled release path.
10. Verify exact live SHA and one-tenant production SLO evidence before promoting the connector beyond `adapter_contract`.

## Competitive milestone

The milestone is no longer “29 domains researched” or “hundreds of providers listed.”

It is:

**the second provider taking materially less engineering effort than the first because authorization, capability negotiation, sync, evidence, reconciliation, telemetry, deletion and verification are reusable.**

When that is true, SONARA has an integration platform rather than a connector catalog.
