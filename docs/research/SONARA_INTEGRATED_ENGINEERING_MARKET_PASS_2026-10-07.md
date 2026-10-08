# SONARA Industries — Integrated Research, Product, Engineering and Marketing Pass

Assessed: 2026-10-07
Review by: 2026-10-21
Status: DESIGN / REMEDIATION PROGRAM. This document is not a launch approval, migration, installed integration, or claim of live functionality.
Source: connected SONARA GitHub, Vercel, Supabase read-only evidence; public primary specifications listed below.

## Executive decision

SONARA Industries owns the platform architecture (SONARA One / application OS) and the shared control plane. Business Builder, Creator Studio and Growth Studio stay individually marketable products with a common identity, tenant, records, billing, notifications, audit, capability-governance and provider infrastructure. SONARA is not a kernel, device operating system, bank, payment processor, professional legal service or a substitute for specialist editors/ERP.

Optimize for a verifiable paying-customer journey, not the largest inventory of planned features. A feature must have a real route, accessible entry, authorization boundary, persisted result, error/recovery path, telemetry, entitlement, tests and appropriate third-party/owner proof before public launch language calls it operational. Infrastructure work is invisible to end users; interfaces should be calm, legible and task-centered.

## Fresh evidence; keep the categories separate

- GitHub default branch was checked at add53bf33a1c7cffa72fb7fc2b3738c25e8dac00. PR 446 (packaged-server startup and several end-to-end commerce/growth fixes) and PR 445 (resource/waitlist flows) were open. Work in those branches must be reviewed rather than duplicated.
- Production Vercel project reported live=false and most recent deployment BLOCKED. Preserve the existing pause until deliberate owner activation. The connected Vercel team reported Hobby. Official Vercel terms restrict Hobby to non-commercial use: hosting plan suitability is a commercial-launch gate.
- The connected Supabase project yqncsonkxgwhcxedgevk reported 160 applied migrations, most recent 20261007120000. A new migration called for by PR 446 was not applied during this check. A different, misleadingly named project exists; project identity must be checked, not inferred from names.
- Supabase security advisors reported: eight authenticated-executable SECURITY DEFINER warnings; 65 RLS-without-policy informational findings (not automatically vulnerabilities); leaked-password protection warning; extension-in-public warning. Performance advisors previously reported large volumes of policy/index findings. Review each by reachable surface, business need and actual EXPLAIN workload before changing grants or indexes.
- The release-evidence generator's original check only examined overall=pass and the textual shape of a digest. A separate byte-rehash/exact-commit checker is proposed with this pass. It proves artifact consistency, not runtime correctness or independent artifact authenticity.

Do not say a table exists in production because a CREATE TABLE appears in a migration. Do not say a provider is connected because an adapter exists. Do not say payment succeeded because Checkout returned a success URL.

## Architecture: one control plane, three domain planes

Boundary A — public website and accessible product discovery:
Home, product explanation, industry-specific value, free tools, self-service support, clear pricing/limits, contact, policies, privacy choices, status. Public copy must distinguish "available", "requires setup" and "planned". A free-tool result must be accessible without signup where the free-tool policy promises it.

Boundary B — customer experience:
Shared signed-in shell; organization picker; user-owned preferences; plan/usage; notification inbox; secure files; workspace switcher. Each Studio has a primary dashboard, primary tasks, saved records and customer-visible next steps. A user should never need to know an API URL to complete an existing advertised workflow.

Boundary C — server-side authority:
Request validation -> session -> organization membership -> entitlement -> scoped application service -> transaction/outbox -> result/receipt -> audit. Roles and target organization are resolved server-side. Never accept price, merchant account, asset path, role or organization authority from an untrusted form as authoritative. Admin/founder powers are not ambient. Unknown consequential agent actions require human review.

Boundary D — data and execution:
PostgreSQL as transactional source of truth with verified migrations, carefully scoped RLS and unique constraints. Private object storage for media and records. Durable queues/outbox for work that cannot complete synchronously. Idempotent consumers with leased claims, retry/backoff, cancellation, dead letters and traceable receipts. Optional GPU workers have explicit concurrency, cost, retention and rights limits.

Boundary E — external providers:
Adapter registry, per-tenant consent/scope, verified OAuth/API key storage, rotation, webhooks, idempotency, provider rate limits, reconciliation and revocation. An unconnected connector remains "setup required". Social platforms, maps, payments, airports/flight data, AI engines, distributors and email providers remain external systems with their own contracts.

Boundary F — independent governance:
Technical release board, security/privacy review, content/licensing approvals, customer approvals and incident response. Automation may request action, not silently approve itself. Each approval records actor, tenant, action hash, exact resource/version, expiration, rationale and irreversible-operation warnings.

## Proposed customer workspaces and navigation

Paths below are TARGET INFORMATION ARCHITECTURE, not assertions that the routes currently exist. Reconcile with the generated runtime route inventory before implementing.

Shared:
- /dashboard: customer role and next action; never fake metrics.
- /account/profile, /account/security, /account/permissions, /account/notifications, /account/data: user controls.
- /workspace/:id/overview, /workspace/:id/files, /workspace/:id/usage, /workspace/:id/activity, /workspace/:id/review-queue: tenant views.
- /help, /status, /accessibility, /pricing and canonical legal URLs: public trust and self-service.

Business Builder:
- /business-builder/jobs: quote -> approved work -> dispatch -> completion -> invoice -> money received.
- /business-builder/customers: consent-safe contact book and repeat jobs.
- /business-builder/storefront: catalog -> hosted provider checkout -> webhook -> receipt -> fulfillment -> refund/dispute state.
- /business-builder/inventory: stock movements, holds, returns, adjustments and reorder thresholds.
- /business-builder/verticals: restaurant/trades/trucking/cleaning/rentals/venues as independently qualified capability packs.

Creator Studio:
- /creator-studio/projects: project graph, ownership, versions and rights.
- /creator-studio/media: image/audio/video assets, transcripts, caption tracks, editing handoff, render jobs, cancellation and provenance.
- /creator-studio/marketplace: license terms, seller onboarding, purchase, private delivery, refund/dispute revocation and recovery.
- /creator-studio/learning: music theory, film theory, literature, writing and media skills as attributable educational references; no copied paid texts or copyrighted media library without permission.

Growth Studio:
- /growth-studio/campaigns: goal -> consented audience -> draft -> human approval -> dispatch -> provider receipt -> attribution.
- /growth-studio/channels: connected accounts, OAuth scopes and revocation.
- /growth-studio/analytics: campaign/source, cost, conversion, attribution assumptions and reproducible formulas.
- /growth-studio/review-board: customer-approved publication, social responses and brand safety.

No route is complete merely because its GET responds 200: prove create/edit/save/read/retry/remove, empty state, expired entitlement, forbidden tenant, offline behavior and keyboard interaction.

## Proposed data contracts (do not create as migrations without schema inventory)

The following logical entities should be mapped to existing tables first, not duplicated blindly:
- identity: organizations, memberships, roles, device sessions, preferences, consents, access decisions.
- commerce: sellers, payment provider accounts, products, price snapshots, orders, order lines, inventory reservations, charge/dispute/refund events, receipts, settlements, reconciliations.
- creator: project graphs, asset versions, license agreements, rights attestations, delivery grants, signed-download receipts, media jobs and provenance.
- growth: campaigns, destinations/channels, consents, contacts, links, clicks, provider sends, delivery events, conversions, costs and experiments.
- platform: usage budgets, reservations, entitlements, rate-limit buckets, audit events, approvals, outbox, execution leases, dead letters, notification subscriptions, retention rules.

For each logical entity define: tenant key, owner, lifecycle state, source/updated timestamps, external IDs, idempotency key (where relevant), immutable evidence hash, foreign-key semantics, RLS SELECT/INSERT/UPDATE/DELETE policies, backup class and retention. Make event writes append-only where appropriate. Retain consistency across a financial transaction through an atomic database transition and compensating recovery, not a browser callback. PostgreSQL advisory lock, row lock, unique key and optimistic version checks are options; choose based on operation and contention tests.

Design review must explicitly reject: plaintext provider tokens in table rows/logs, global permissive grants, user-editable JWT metadata as authorization, arbitrary table names supplied by a browser, cross-tenant object paths, transactions that depend on wall-clock ordering alone, and logs that contain raw PII or secrets.

## Deterministic formula and modeling program

All calculations must declare inputs, units, precision, locale/currency, rounding, bounds and error messages. Calculated results are not financial/legal guarantees.

Business examples:
- gross_margin = (net_revenue - cost_of_goods_sold) / net_revenue where net_revenue > 0.
- contribution = selling_price - variable_unit_cost; break_even_units = ceil(fixed_cost / contribution) if contribution > 0.
- inventory_available = on_hand - reserved - damaged; never sell negative available stock without a declared backorder policy.
- estimated_job_profit = contracted_net_price - material_cost - labor_cost - allocated_overhead - provider_fees, each timestamped and denominated in one currency.
- conversion_rate = attributed_conversions / eligible_unique_contacts; publish attribution window and exclusions.
- media_budget = reserved_generation_cost + actual_job_cost + storage_egress_estimate, reconciled after completion.

Use integer minor units or fixed decimal for money, explicit timezone storage with UTC instants and locale-aware display, overflow-safe arithmetic and deterministic test fixtures. The user can edit assumptions but not rewrite the stored computation evidence. Simulations and forecasts must label uncertainty, methodology, data vintage and scenario assumptions. Geography and physics simulations should retain units, precision and source provenance; do not turn map/GPS inputs into undocumented surveillance.

## Accessibility and user-interface acceptance

Target WCAG 2.2 AA. All core journeys must support keyboard, visible focus, accessible form names/errors, assistive tech announcements for confirmed saved states, 200%/400% zoom and reflow, reduced motion, adequate contrast, non-drag alternatives, and touch-target spacing. Prerecorded video requires captions; live spoken media has live-caption obligations at WCAG AA. Provide textual transcripts when practical, alt text for meaningful images, captions for sound-dependent instructions, and human-controlled audio/haptics (default off). Do not substitute synthetic speech for accessible text. Test with browser automation AND manual screen-reader, keyboard, hearing-impaired and mobile-device scenarios.

Customer home screens should show three things prominently: what happened, what the customer can do next, and what needs their approval. Navigation depth and cognitive load are costs. Advanced engines should run behind simple, consistent controls; show technical detail only in optional advanced panels.

## Device, offline, storage and communication

Mobile: progressively qualified PWA -> verified Android TWA -> native shell only when required -> iOS distribution only after store-policy decision. Android digital asset links must be correct for signed builds; a file unreadable in packaged runtime must fail in CI. Gyroscope, GPS, camera, microphone, Bluetooth and local-files permission requests must occur in context, be revocable and never be granted silently.

Offline: use device-bound operation IDs, tenant/session affinity, local encryption where supported, bounded queue size, idempotent sync, conflict detection, visible pending/failed badges, replay protection and server-side permission recheck. Never queue raw card data, credential rotations, destructive or monetary transfers for unreviewed replay.

Storage: private-by-default buckets, direct signed/resumable upload, tenant-chosen object keys resolved server-side, content type/size verification after upload, malware scanning/quarantine where appropriate, short-lived download grants and deliberate deletion/retention. Offer customer export/delete workflows consistent with applicable obligations.

Notifications: in-app inbox as a common base; email/push/SMS/voice are separately consented channels. Deduplicate event deliveries by event ID; honor quiet hours, rate limits, unsubscribe and communication preferences. Every automation has a readable history and an on/off control. Unavailable email is not recorded as "delivered".

## Security, legal, provider and monetization boundaries

P0: review all exposed SECURITY DEFINER functions with actual definitions and EXECUTE grants. Do not revoke arbitrary grants without analyzing call sites and performing staging tests. Decide policy coverage on RLS-no-policy tables intentionally: deny-all is often the correct default. Enable supported leaked-password protection under owner-controlled account change and keep the verification ratchet. Backups require restoration proof, not only backup success. Apply NIST SSDF and OWASP ASVS to the release checklist.

Payments: customers should receive merchant funds through approved payment providers wherever feasible. This reduces operational burden but does not erase platform liability, tax, refunds, disputes, KYC, chargeback, seller licensing or money-transmission questions. SONARA invoices its software fees under clearly documented terms; never store card PAN/CVV. Stripe Connect account type and fee liability require exact provider contract review.

Licensing: maintain SBOM and dependency license matrix, model-card rights, dataset licensing, third-party media rights, music sampling/cover rights, commercial-use terms, software/network copyleft obligations and takedown workflow. The source is proprietary, but a public GitHub repository remains publicly readable. Marketing claims and sample output must not imply trademark registration, guaranteed income, unearned testimonials, copyright clearance or general counsel certification.

Free and paid pricing: retain existing approved tier prices unless an owner-authorized commercial decision changes them. Meter CPU/GPU minutes, storage GB-months, egress, API calls, render minutes, provider sends and agent executions separately; every paid feature must have an audited variable-cost floor and usage limit. Margin math must include refunds, support and provider fees. Commercial hosting cannot rely on Vercel Hobby. No unlimited media generation at a fixed $29 tier.

## Marketing and go-to-market engineering

Initial positioning: "Build. Create. Grow." One integrated, affordable business operating workspace with evidence-based functionality. Use landing pages organized by customer outcome, not by the number of engines/modules.

Choose one verified vertical pilot rather than launching every industry simultaneously. Recommended first wedge: service businesses needing lead intake -> estimate -> scheduling -> job -> invoice -> receipt -> follow-up. The proof is the complete customer transaction, not a mock account.

Acquire early users through:
- public free tools and useful SEO pages with no signup trap;
- 15–30 second demonstrations using genuine working routes and customer-safe demo records;
- opt-in creator/business education videos, accessible captions, and step-by-step product use;
- founder-led outreach, limited pilots, referrals and opt-in email;
- industry-specific calculators with clear methodology and saved outcomes after signup.

Proposed acquisition measurements: landing-to-free-tool use; tool-to-qualified signup; signup-to-first-saved-record; first-saved-record-to-first-useful-outcome; trial-to-paid; week-4/quarterly retention; customer support burden; gross margin by plan. Attribution must account for consent and privacy; no fabricated success stories, inflated provider integrations or guaranteed ROI. For pricing tests use small cohorts with explicit owner approval and record the plan and entitlement used.

Define pricing profitability per paid cohort:
MRR = sum(active_paid_subscription_net_prices).
Gross_margin = (recognized_subscription_revenue - directly attributable usage costs) / recognized_subscription_revenue.
CAC_payback_months = acquisition_cost_per_customer / monthly_gross_profit_per_customer when denominator positive.
Report cohorts and uncertainty. A dashboard is not evidence of product-market fit without real usage and payment events.

## Prioritized dependency graph

P0 — reliability/compliance before monetization:
1. Close PR 446 startup/package break after its own exact-head checks; leave deployment paused.
2. Verify release-evidence manifest against actual files and exact commit (this pass).
3. Review Supabase privileged function warnings and exact RLS permissions; do not make speculative DDL.
4. Confirm commercial hosting, production project ID, provider configurations, correct migrations, backup/restore and incident ownership.
5. End-to-end payer/customer/seller transaction tests in a controlled provider environment; public checkout requires real money-path proof.
6. Resolve 15 remaining workspace fallback routes and test actual customer paths; avoid parallel duplicate work in PR 445.

P1 — user-facing usefulness and automation:
1. One verified Business Builder job-to-payment vertical; accountable owner, acceptance tests and pilot retention.
2. Consent-safe email receipts, notifications, provider connections and growth attribution.
3. Creator file versioning, caption/transcript evidence, rights-cleared delivery, quotas and provider reconciliation.
4. Accessibility, offline sync and recoverable device permissions across real devices.
5. Deterministic forecasting with source-tagged inputs and plain-language explanation; AI optional, governed and quota-bound.

P2 — advanced expansion after repeat usage:
1. Multi-provider social publishing and review/moderation; verified OAuth/webhook scope and takedowns.
2. GPU/media worker autoscaling, signed releases, render reproducibility and royalties under contracts.
3. Industry packs, route optimization, simulations, privacy-preserving mapping and real-time dashboards.
4. Marketplace partner program, public developer/API program and external app ecosystem; separate sandbox and billing budgets.
5. Deeper enterprise compliance, DR/load proofs, localization and accessible assistive integrations.

## Acceptance matrix required before any "done" claim

For EVERY new product surface:
- Experience: signed-out and signed-in routes; readable mobile UI; input error; loading/success/failure; keyboard/screen-reader; no inert control.
- Data: request contract, tenant key, persisted record, RLS/permission, migration, history, export/deletion.
- Execution: happy path, duplicate, timeout, retry, cancel, conflicting edit, provider failure, outbox replay, rate limit.
- Money: immutable amount/currency snapshots, provider owner, idempotent webhook, refund/dispute handling, recognized fees, reconciliation.
- Media: rights/provenance, upload size/type, malicious file quarantine, private delivery, caption/transcript, cancel/refund effects.
- Proof: unit/property/contract/route tests, browser/device acceptance, recorded exact SHA, provider canary, rollback and customer-approved policy.
- Metrics: failed actions, latency, customer completion rate, provider costs, retention and incident recovery.
- Commercial claim: truthful status (source, staged, provider-verified, customer-proven), named review owner and dated evidence.

Nothing in this document authorizes direct production schema changes, customer payments, provider activation, legal publication, live campaigns, repository-wide merges or unpausing production. Those require owner-controlled, reviewable actions.

## Primary research standards and current-source anchors

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- NIST SSDF SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final
- NIST Generative AI SSDF community profile: https://csrc.nist.gov/pubs/sp/800/218/a/final
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- Vercel Hobby plan and terms: https://vercel.com/docs/plans/hobby and https://vercel.com/legal/terms
- Supabase RLS and database linting: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/database/database-linter
- Stripe Connect direct charges: https://docs.stripe.com/connect/direct-charges
- Stripe Checkout fulfillment: https://docs.stripe.com/checkout/fulfillment
- Internal engineering evidence: docs/CAPABILITY_ROUTE_SCHEMA_COVERAGE.md, docs/owner/WHAT-IS-LEFT.md, docs/COMMERCE_UPLOAD_READINESS.md, docs/security/RELEASE_EVIDENCE.md, SECURITY_NOTES.md, AGENTS.md.
