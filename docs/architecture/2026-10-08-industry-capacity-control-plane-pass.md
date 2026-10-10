# SONARA Industries — Multi-industry capacity and shared control-plane plan
October 8, 2026. Implementation and acceptance plan; not a claim of production activation or full green CI.

## Reconciled source evidence
- Main reviewed: 9d141e68d1ec14c037f92d1eebb3c2718d583c0a.
- Main CI run 37815158957: 7,083 tests passed in that historical run, one failure in test-file handoff count (513 documented versus 516 actual). Node compatibility run 37815158721 fails the same assertion.
- Native migration replay run 37815158798: 25 policy-definition drift assertions abort across Node 22/24/26 and PostgreSQL 16/17/18 after the October 8 service-role hardening migration.
- Draft repair PRs #508, #519 and #526 propose different approaches to these two issues; review one coherent approach and do not blindly merge all three.
- Supabase is healthy with 163 recorded migrations through 20261008100000. Current advisors: 468 overlapping-permissive-policy WARN, 8 callable SECURITY DEFINER WARN, 1 public extension WARN, leaked-password-protection WARN, 379 unindexed foreign keys INFO, 581 unused indexes INFO.
- Two newest Vercel production deployments are BLOCKED. Older READY artifacts do not establish public service. Keep the owner-directed website OFFLINE.
- GitHub rulesets endpoint returned an empty list, branch protection endpoint denied connector read (403). Require independent admin confirmation of enforced settings.
- Concurrent draft PRs #529–#536 cover free-service role policy, source-read concurrency, rate limiter, entitlements, email-delivery reconciliation and telemetry; reuse them instead of reimplementing over their heads.

## Executable scale instrument implemented in this branch
Source: scripts/simulate-industry-capacity.mjs. Registered scripts: plan:industry-capacity and verify:capacity-model. The self-test is included in verify:gates.
Default planner inputs are illustrative, not telemetry: tenants=100, average request rate=0.02/sec/tenant, burst=4x, DB fanout=3, operation time=40ms, concurrent DB workers=8 and utilization target=70%.
Mathematics:
- steady demand = tenants x average requests per second per tenant
- peak demand = steady demand x burst multiplier
- DB operations per second = peak demand x DB operations per request
- offered DB concurrency = operations per second x service time (ms) / 1000
- target pool size = ceil(offered concurrency / target utilization)
- modeled backlog growth per minute = max(0, operations per second - current worker capacity per second) x 60
- steady monthly requests = steady requests per second x 30 x 86400
- optional egress and provider variable costs computed only if explicit unit-cost inputs are supplied
These are deterministic queue-fluid estimates, not M/M/c proofs or p95/p99 measurements. No traffic, secrets, tenants or hosted data are fetched.

## SONARA One, parent and child-company architecture
SONARA Industries = global navigation, market discovery, shared account and moderation entry.
SONARA One = common server-side identity, tenant permission service, event authority, rate and resource budgets, audit, notification preferences, connector governance, feature flags and release control.
Business Builder = industry-specific business operations, bookings, inventory, POS-provider integrations, job lifecycle, customer administrator.
Creator Studio = versioned media projects, licensing, consent, provenance, exports, optional queued GPU/media, creator marketplace.
Growth Studio = social graph, channel publishing, brand marketing, campaign evidence, analytics, conversions and provider-granted syndication.
Shared social + storefront + marketplace should be free basic services available after login across all four company experiences. This is an entitlement decision, not evidence that twelve production routes already enforce it. Seller prices, payment processing, delivery and optional enhanced tools remain independently priced/consented.

## Customer administration and authorization
Canonical tenant relation is organization_memberships; one person can administer multiple organizations while only seeing and changing a chosen, authenticated organization. Each write must resolve the current active membership from the server, never request IDs alone or user-editable JWT metadata. A store editor may manage listings but not grant global admin rights, rotate payment credentials, see unrelated buyers or edit another store. Owner settings should expose business identity, team/roles, integration scopes, content/publication, invoices, budget/usage, analytics, localization, notifications, support, retention/export and an inspectable audit history. Sensitive actions require reauthentication, role-and-capability check, optional independent owner confirmation and idempotent durable command/reconciliation.

## Shared public-network projection
Reuse existing growth_channels/growth_channel_posts, creator_listings/creator_marketplace_entries, merchant_storefronts/merchant_products, organization and commerce tables. Do NOT invent duplicate operational tables. A proposed future read-optimized public-activity projection must contain only safe public data: source organization, brand, source type/id/version, approved moderation state, publish time, licence/disclosure and public preview. Never copy CRM, undisclosed locations, private art or payment account data into public search. Moderation publication states: draft -> pending_review -> approved/published or denied/hidden -> appeal; takedown must propagate to search/CDN with version invalidation. Each user may report, block, appeal and withdraw consent. Publishing/rights need separate persisted evidence.

Potential migration candidates (NOT applied): public_activity, activity_reports, activity_moderation_events, customer_admin_grants and publisher_consents. Before adding them, reconcile exact existing schemas, generate migration through repository CLI, include tenant-constrained RLS with USING/WITH CHECK, explicit privileges, immutable audit, indexes supporting (published_at, id) keyset pagination, cross-tenant negative tests, staging forward/rollback and untouched production until approved.

## Infrastructure, industry, and operational test matrix
- Restaurants/venues: menus, reservations, staff, stock holds, queues; collision, refund and cancellation proof.
- Field services, trucking, cleaning and trades: dispatch, opt-in GPS, offline drafts, sync conflict resolution and permissioned device access.
- Retail/manufacturing/leases: inventory/order/POS, receiving, fulfillment, durable payment events and reconciliation; oversell/replay tests.
- Creators/music/film/books: media projects and original rights, subtitle/caption pipeline, provenance, secure/licensed downloads and expiry; transcode failure and rights-denial tests.
- Growth/marketing: opt-in sends, unsubscribe, confirmed receipt versus uncertain provider outcome, campaigns and conversion signals; duplicate-send and suppression tests.
- Parent discovery: multi-tenant sanitized search and moderation; no private-row leakage.
Back-end queues must support bounded concurrency, monotonic leases, retries with jitter, dead-letter and review, idempotency keys, quotas, provider backoff and durable outbox. Avoid synchronous GPU work in public requests. Respect Microsoft Graph Retry-After; isolate all external account scopes. Read-only analytics must not count unknown provider failures as zero.

## User experience, legal and monetization
Customer screens use plain language, dark-first branding and clear setup-required states; keyboard focus, readable contrasts, captions/transcripts, reduced-motion, screen-reader operation, large touch targets, explicit consent for cameras/microphone/GPS/alerts and accessible data tables. Target WCAG 2.2 A/AA in review, not claim certified conformance without tests. Customer admins should see plain operational results; complex budgets, automations and reconciliation remain behind optional drill-downs.
Counsel must review terms, privacy, marketplace seller/buyer obligations, refunds, notices/takedowns, copyright/licensing, contributor/talent/voice releases, minors, accessibility obligations, payments and local regulations. Consent requires exact version/content hash, affirmative actor decision, tenant, locale, timestamp, immutable event and withdrawal handling. Sponsored relations must be conspicuously disclosed in the endorsed content; no fabricated ratings/ROI/revenue.
Unit economics: contribution = attributable realized revenue minus bandwidth, storage, rendering, provider calls, fraud, moderation, support, payment fees and applicable taxes. Free-to-sign-up is not free-to-operate. Measure active account acquisition, activation, first successful publish, retained active business, paid conversion, support costs and abuse rather than inventing results.

## Release authority and evidence
P0: enforce main rulesets/branch protections, required exact-commit checks, review requirements and protected Vercel production environment; select tested CI and native replay repair without weakening assertions. P1: RLS cross-tenant tests, administrative role matrix, 12 free surfaces wired through real auth and permissions, accessibility, public moderation/rights proof, signed/reconciled provider money flows. P2: measured k6 load, p95/p99 and saturation, circuit breakers, restores, region/egress and worker cost. Preserve OFFLINE production until separate owner approval with verified staged SHA and migration/rollback evidence. Never treat draft PR text, synthetic capacity inputs or status-check skips as green release proof.

References:
- GitHub rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- FTC endorsement disclosure: https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers
- W3C accessibility: https://www.w3.org/WAI/WCAG22/understanding/
- Microsoft Graph throttling: https://learn.microsoft.com/graph/throttling

## Phase 2 continuation (October 8)
- Extended the single-industry deterministic planning script to reject unsafe provider-cost numeric precision.
- Added cross-suite, 18-industry allowlisted aggregate planning in `scripts/plan-industry-portfolio.mjs`; no account identifiers accepted, duplicate suite/industry rejected, optional cost totals stay null if any required input is absent. The model assumes simultaneous peaks and a shared DB worker pool; it is NOT an actual admission controller or throughput benchmark.
- Registered `plan:industry-portfolio` and `verify:industry-portfolio` in `package.json` and the Node 24/26 workflow plus `verify:gates`.
- Added `docs/operations/2026-10-08-live-postgres-traffic-baseline.md` from read-only Supabase inspection: 60 max DB connections; 18 total observed sessions / 1 active / 0 lock waits; 4,862 retained query-stat entries with 21 deallocations; cumulative temp-file activity. Sampled slow queries are **not** yet attributed to customers or code paths. Build measured load/trace experiments before migrating performance-critical indexes.
- This branch remains a DRAFT. No production migration, merge, website unpause, external processor action or unverified full-suite green claim.
