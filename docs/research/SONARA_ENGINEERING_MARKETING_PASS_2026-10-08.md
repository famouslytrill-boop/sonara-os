# SONARA engineering and marketing research pass

Date: 2026-10-08 UTC (2026-10-07 in New York at the start of this pass)

Repository: famouslytrill-boop/sonara-os. Reviewed main: `add53bf33a1c7cffa72fb7fc2b3738c25e8dac00`.

Prepared for SONARA Industries, SONARA One, Business Builder, Creator Studio and Growth Studio. This is a dated source assessment, an implemented engineering increment, and a prioritized development specification. It is not a declaration that every requested capability is deployed or production-certified.

## 1. Decision and result

SONARA already has substantial application architecture. The highest-value advancement is to make its existing workflows authoritative, recoverable, understandable and demonstrably useful to customers. More registered engines, tables or adapters will not establish that customers can reliably complete their work.

This pass inspected the current source and hosted build evidence, refreshed primary-source research, reproduced defects, implemented two independent changes, and validated the commerce change locally. The Docker repair is published as draft PR [449](https://github.com/famouslytrill-boop/sonara-os/pull/449), with hosted image and migration checks passing. The commerce branch, `codex/commerce-amount-integrity-20261008`, fixes inconsistent currency displays, permissive amount coercion and database-range overflow. Its publication and final hosted results belong in the pull request record.

The existing temporary-offline direction is preserved. No production deployment, provider activation, campaign, refund, payout, schema migration or security-setting change was performed. A successful source change does not establish current production availability.

Four decisions follow from the evidence:

1. Keep the existing modular application and canonical PostgreSQL transitions. Consolidate shared primitives rather than begin a framework migration.
2. Complete one observable journey in each product before expanding marketplaces, native integrations or social-network breadth.
3. Connect customer claims and pricing to measured workflow, provider and cost evidence.
4. Make security, accessibility, recovery and operating cost part of each workflow's acceptance criteria.

## 2. What was actually established

Evidence categories throughout this report are **verified source/test fact**, **inference**, **recommendation**, and **unknown**. Source presence, a unit test, a hosted build, a real provider response and a production customer result are different evidence levels.

| Area | Verified source or local evidence | What it does not establish |
| --- | --- | --- |
| Public and application routes | 955 registered operations; 577 GET, 365 POST, 10 PATCH and 3 DELETE; 303 declared pages | Every page is usable, accessible or connected to a live provider |
| Route accounting | Every served GET is accounted for; no unmatched form actions or missing destinations in the inventory | Every destination is specific: 15 still use a workspace-home fallback |
| Persistence | Inventory recognizes 361 table names and 160 migration files; 320 tables are queried and 41 have no detected query | Actual production schema, data correctness or permission behavior |
| Other schema measurement | Coverage parser finds 376 created table names across migration history | These are not 376 confirmed current production tables; the parsers count different populations |
| Contracts | 39 explicit resource contracts with no detected gaps; 38 database functions and 51 triggers in the inventory | Runtime transaction correctness under contention and all effective deployed privileges |
| Deterministic tools | 59 formulas have registered evaluators; 11 supplemental financial formulas | Scientific validity for every input domain or predictive accuracy |
| Internal automation | 12 local skills, five schedulable actions and six registered agent handlers | Authority to execute sensitive actions or unattended provider success |
| Runtime reachability | No unaccounted modules; 48 are explicitly staged and reached only through tests | Staged modules are not active customer features |
| External research | 557 catalog entries, including 532 repository records; zero research repository records enabled in production | Hundreds of functioning integrations; catalog records are not connected services |
| Free product entry points | 15 public free tools: four per product and three parent tools | Unlimited free infrastructure or confirmed activation/conversion |
| Main release evidence | Docker image failed; controlled deployment stopped before migration/deployment | Production was updated by this pass |

The zero route-data-review-gap figure is a static mapping result. It should not be presented as proof that every data contract is complete or correct. Likewise, table and route counts are diagnostic measures, not customer value propositions.

The previous company research of September 30 and screenshot intake of October 5 were reviewed as historical inputs. Their design and intake lessons remain useful; dated competitor prices and earlier source counts are not current authority. The present inventory supersedes older gap estimates.

### Reproduced defects and implemented changes

| Trigger | Before | After and evidence |
| --- | --- | --- |
| Build the production Docker copy set | Server import failed because the Android association contract was omitted | Dockerfile copies `android`; local negative/positive copy-set probe and hosted Docker image check pass |
| Render a 1,200-unit JPY storefront price | Displayed `12.00 JPY`, while the order/provider amount was 1,200 JPY | Shared charge formatter displays `1200 JPY`; route test saves the same units |
| Read a boolean or array as a storefront price | JavaScript coercion could accept it as an amount | Shared parser accepts only safe, nonnegative integer numbers or decimal-integer strings within the existing database range |
| Order two units priced at 2,147,483,647 each | A total larger than PostgreSQL integer storage was accepted by the price calculation | Whole order is refused before order/line writes or inventory holds |
| Reconcile MGA, ISK or UGX | ISO display defaults and charge compatibility rules could disagree | Charge denomination explicitly controls scaling and displayed precision |
| Format a large aggregate amount | Floating-point division could lose a final minor unit | Decimal-string splitting preserves exact safe-integer values, including signed balances |
| Render an unreadable amount in selected order/payment views | `Number(value) || 0` could show zero | Selected views preserve the value and show `Amount unavailable` when it is unreadable |

The new shared module is `lib/sonara-commerce-amounts.cjs`. Storefront, creator listing, checkout, payment and reconciliation consumers reuse it. USD/GBP/EUR symbols remain available; other currency displays retain a code. ISK/UGX compatibility and HUF/TWD charge-versus-payout distinctions follow Stripe's current documentation [S1]. Formatting is not FX conversion, country eligibility, provider minimum/maximum validation, or payout execution.

No dependency, lockfile or schema was changed. Generated inventory and handoff records were refreshed; the proprietary-source exact count was advanced by one for the new runtime module, retaining the equality check. A historical universal-price claim in plan-source commentary was replaced with a requirement to compare current billing basis, fees, limits and proven workflows.

Remaining monetary work is explicit: some older sales aggregation and merchant reconciliation paths still coerce absent values to zero. This pass does not claim to have removed that behavior everywhere. Audit every financial aggregate for unknown values, mixed currencies, rounding, tax, discounts and provider limits before reporting audited profitability.

## 3. Architecture to strengthen

### Shared platform and product boundaries

SONARA One should provide identity, organization membership, permissions, billing entitlements, contacts, records, files, workflows, jobs, events, audit, preferences and provider connection management. Business Builder, Creator Studio and Growth Studio should present distinct tasks while sharing these services. The repository's parent/product naming is an application architecture; it is not evidence of separate incorporated legal entities.

Preserve the present Express/CommonJS modular structure and PostgreSQL-backed transitions. Build explicit service boundaries around commerce amounts, record ownership, approval, inventory, settlement, delivery and provider execution. HTTP handlers should authorize, validate, call the canonical transition, and render the result. Avoid independent read-then-write implementations of the same stock or entitlement operation.

Recommended dependency direction: presentation and routes call application services; services call domain policy and storage/provider adapters; policy remains independently testable. Keep platform administration behind dedicated permissions. Customer pages should show a task, status and next action. Operator traces, provider keys, migration details and internal engine catalogs belong in owner or engineering controls.

### Canonical workflow specification

| Product | Customer journey | Authoritative result and proof |
| --- | --- | --- |
| Business Builder | Lead → estimate → booking/job → employee/material allocation → completion → invoice/payment → repeat work | Organization-scoped job/order, locked stock changes, provider-backed payment state, receipt and cost inputs |
| Creator Studio | Asset → immutable version → rights/approval → listing → checkout → settlement → license → private delivery → refund/dispute | Exact sold version and grant; payment authority; expiring private delivery; buyer receipt and seller reconciliation |
| Growth Studio | Source/lead → approved campaign → connector execution → delivery → engagement → conversion → attribution | Persisted provider delivery ID, per-purpose consent, duplicate-safe execution and freshness-labelled metrics |

Each journey needs one source of truth and a visible recovery path. The repository's October 7 convergence contract already specifies these chains; this report advances that contract rather than introduces a parallel architecture.

For each transition record the actor, organization, input fingerprint, expected record version, approval version, previous and new state, provider account and record identifiers, timestamp, correlation ID and customer receipt destination. Where fields already exist, extend their contract rather than duplicate them. A receipt should say what happened, what remains pending, and what the customer can do next.

### Existing tables to consolidate around

| Responsibility | Source-established records | Next contract to validate |
| --- | --- | --- |
| Identity and tenancy | `organizations`, `organization_memberships`, `entity_memberships`, `business_permission_grants` | Resolve tenant server-side; role, resource and plan checks agree |
| Merchant operations | `merchant_storefronts`, `merchant_products`, `merchant_product_variants`, `merchant_orders`, `merchant_order_lines`, `merchant_order_fulfillments` | Immutable order snapshots; currencies/amounts bounded; fulfillment follows approved state |
| Stock | `inventory_items`, `inventory_movements`, `inventory_reservations` | Competing orders, cancellations and retries produce one correct stock outcome |
| Creator commerce | `creator_asset_versions`, `creator_asset_approvals`, `creator_listings`, `creator_marketplace_orders`, `creator_licence_grants`, `creator_version_files` | Paid entitlement, exact version delivery, revocation and refund consistency |
| Growth and contact authority | `growth_leads`, `growth_campaigns`, `growth_contact_consents`, `consent_records` | Provider/channel/purpose scope, suppression and withdrawal respected before dispatch |
| Integration state | `business_integration_connections`, `integration_jobs`, `integration_providers` | Exact account, scopes, token health, disconnect and provider receipt |
| Work and audit | `platform_jobs`, `event_outbox`, `audit_logs`, `system_audit_events` | Recoverable claims, duplicate-safe external effects and redacted evidence |
| Device and communication | `device_permission_grants`, `user_device_permissions`, `notification_preferences`, `user_notifications` | Browser permission and application preference remain distinct; revocation takes effect |

These are source-established names, not deployed-schema assertions. Proposed evidence fields, indexes or policy changes require a reviewed migration. The 41 apparently unqueried tables need a disposition: activate through a complete workflow, retain with an explicit purpose, or retire through a data-retention and compatibility review. Do not delete them based only on static reachability.

### Data, queues and operating infrastructure

Use existing durable job and outbox primitives before introducing another queue. The worker migration contains row-locking claims, retries and an idempotency-key uniqueness contract; its comment explicitly keeps activation disabled pending a worker and tenant canary. Review idempotency-key construction: the shown unique key is global, so include organization, operation and input/version identity to prevent unrelated tenant collisions. Bind key reuse to a matching payload fingerprint.

Recommended worker acceptance: enqueue and business state commit atomically where appropriate; acknowledge a webhook only after durable capture; claim with a lease; retry with bounded backoff and jitter; persist provider IDs; recover stale leases; distinguish retryable from permanent failure; expose dead letters to an authorized operator. A cancellation before external execution can stop work; after provider acceptance it requires an explicit compensating action.

Exactly-once external delivery is not guaranteed merely by a unique local key. Test the failure where the provider accepts a request but the local response write fails. Recover through provider idempotency or reconciliation before retrying. Treat distributed rate limiting, reserved usage budgets and worker concurrency limits as shared state when running more than one application instance.

Scale from measured demand. Keep bounded request sizes, pagination, per-tenant indexes, object storage for media, short web requests and isolated expensive workers. Measure queue age, retry frequency, connection use, latency, storage/egress and cost per completed workflow. Add replicas, specialized search or a separate event broker only after a measured bottleneck and an operational plan justify them.

## 4. Security, authentication and control planes

Use OWASP ASVS requirements as a versioned verification map, not as a certification claim [S5]. Map each applicable requirement to a control, negative test, deployed evidence and owner. The first critical boundaries are tenancy, account recovery, private files, provider credentials, approvals and money state.

Supabase's service role bypasses RLS [S3]. Therefore server-side queries require explicit organization/resource filters even where browser policies are strong. Test at least two organizations plus anonymous, customer, staff, manager and owner actors. A user-supplied organization ID is input to validate, not authorization. Test direct-record access, child-record access, exports, private URLs, job receipts and webhook references across tenants.

Recommended authentication improvements: a documented session lifecycle; fresh server-side authorization on mutations; CSRF protection where cookie authentication is used; secure cookie settings; bounded login and recovery attempts; explicit email-change and account-recovery receipts; and step-up authentication for sensitive actions. Passkeys are a candidate after recovery, device loss and credential removal have been designed and tested [S17]. Their presence alone does not make the entire account lifecycle secure.

Every refund, payout destination change, permission change, destructive action, legal publication, campaign or testimonial publication should retain the existing owner-review boundary. Approval should bind to the exact payload and expire or invalidate when inputs change. Re-check actor authority and target state at execution time. An agent's suggestion is not permission to act.

Keep secrets server-only, redact logs, rotate through a reviewable process, and scope provider credentials narrowly. Apply outbound URL allowlists and protections against private-network requests for imports and remote-media fetches. Treat filenames, archives, markup and uploads as untrusted. Keep development, sandbox and production account identifiers explicit.

The main branch was reported unprotected by the read-only branch API during this assessment. Recommend required checks and controlled merging, but changing repository security settings is a separate owner action. The production workflow correctly refused deployment after the Docker failure. Preserve its exact-commit release gate and require rollback evidence before reactivation.

## 5. Storage, devices, offline work and integrations

### Upload, download and recovery

Use private objects with tenant ownership checks before issuing short-lived download URLs. Storage RLS controls access [S4]; metadata authorization and a functioning signed URL do not establish that the bytes are the intended asset. Persist file size, detected type, checksum, version and scan/processing state. Quarantine uploads until accepted; limit decompression, duration and dimensions; protect remote imports and filename rendering. Keep licenses and consent attached to the exact version.

Back up both database state and object bytes. Supabase explicitly states database backups do not include Storage objects [S18]. Perform a restore drill that proves the restored records can retrieve their corresponding files. Define retention, recovery point and recovery time objectives by product need; suggested early targets are a 24-hour recovery point and a four-hour recovery time, subject to actual backup capability and a successful drill. These are proposed targets, not measured guarantees.

Contacts import should preview normalized rows, conflicts and purpose/consent before commit. Deduplicate within the tenant using stable identifiers; retain the original source and reversible import batch. Exports need scoped authorization, formula-safe spreadsheet output, expiring access and an audit receipt. Cloud portability should include data, assets and workflow definitions, not only a database dump.

### Offline and native operating-system interfaces

The staged offline-sync policy is a candidate decision layer; it does not itself encrypt a vault, write a durable queue or synchronize devices. Existing PWA/browser assets likewise do not prove cross-device recovery. Prioritize offline job notes and read-only work packs. Payments, refunds, role changes, publishing and destructive actions should remain online-authorized.

A proposed offline item carries operation ID, organization, device, schema version, record version, creation time, expiry and payload fingerprint. Reauthorize on reconnect. Distinguish appended notes from conflicting edits; show a conflict resolution screen rather than silently overwriting. Test device restart, full disk, stale schema, revoked membership, two-device edits, expired credentials and partial batch acceptance. Bound queued bytes and visible age. Design encryption and key lifecycle together; do not call a local cache a secure vault without those controls.

Location requires HTTPS and browser permission [S11]. Offer manual address entry, show accuracy/time, request access when a user chooses a location task, and stop watches when they are unnecessary. Gyroscope/orientation support varies by device and permission behavior [S12]; offer a normal pointer/keyboard control. Do not infer a native OS permission from a database preference row.

The existing route estimator uses great-circle distance and a nearest-neighbor/2-opt approach. This is a planning approximation, not a road-traffic ETA, optimal route guarantee or live dispatch system. A later routing adapter needs road data, time windows, capacity, provider terms and cost measurement. Flight/travel features should begin with budget and itinerary planning or an authorized offer search. No source establishes a mechanism that guarantees free flights.

### Integration lifecycle

Track researched, adapter-tested, authorized, sandbox-proven, canary-proven and production-enabled separately. The present research catalog deliberately executes none of its repository records. Promotion needs exact upstream/version/license, dependency risk, data flow, scopes, cost, cancellation, failure receipts and removal behavior. Research screenshots and popularity are discovery signals.

A connection should expose account, provider, scopes, last successful operation, expiration, retry state and disconnect. One authorized social/email connector with a stored receipt is worth more than many provider logos. Do not automatically move to a newer Stripe or Supabase API because documentation is newer; assess the pinned contract, changelog, compatibility fixtures and migration path first.

## 6. Media, knowledge, simulations and useful invention

Creator Studio should join briefs, assets, versions, approvals, publishing and monetization. Art, music, film and literature tools become useful when their outputs remain editable, exportable, attributed and attached to a real project. Keep creative generation opt-in and subject to approved provider/data rules.

| Domain | Proposed customer capability | Engineering acceptance |
| --- | --- | --- |
| Music and theory | Tempo/timeline, chord and section planning, notation export, stems and version comparison | Exact units and duration; reproducible transformations; editable metadata; audition and export verified |
| Film and video | Storyboard/shot list, timeline, captions, aspect-ratio exports and release package | Safe processing budgets; frame/time mapping; cancel/retry; captions included in final output |
| Art/design | Reference board, project variants, asset rights and delivery package | Exact version approval; source attribution; accessible alternatives; dimensions and file formats checked |
| Literature/language | Outline, revision comparison, reading aids, editorial notes and citation-aware research | Preserve author revisions; distinguish quotations and generated text; source/date attached to factual answers |
| Math/science | Unit-aware calculators, transparent formulas and scenario comparisons | Domain bounds; zero/invalid inputs; numeric precision; formula version; explainable result and reproducible fixtures |
| Social studies/public knowledge | Source-grounded topic collections and contextual comparisons | Publisher, date, jurisdiction/context and uncertainty visible; freshness checks for changing facts |
| Simulations and business models | Inventory demand, staffing capacity, pricing and cash scenarios | Assumptions and sensitivity visible; reproducible seed; scenario output separated from forecasts |
| Templates | Ready-made job, campaign, project and release packs; customer-defined versions | Tenant ownership; versioned schema; validation; preview before applying; no duplicate canonical records |

For music interchange, assess MusicXML 4.0 against actual import/export fixtures; it is a W3C Community Group report, not a W3C Recommendation [S19]. For media processing, review the exact FFmpeg build and linked components; its upstream licensing depends on optional components [S20]. No new external package or media engine was adopted in this pass.

Use deterministic computation for timing, units, transforms, validation and reporting. Reserve generative systems for tasks that benefit from them, with budget limits, provenance and human review. Store model/provider version, source asset IDs, instructions, consent basis and the resulting asset hash when appropriate. Provider commercial terms do not automatically establish copyright in an output; human authorship and the facts of creation matter [S16].

Examples of useful transparent formulas are gross margin `(revenue - direct cost) / revenue`, contribution `revenue - variable cost`, break-even customers `ceil(fixed cost / contribution per customer)`, and an equal-temperament frequency calculator with a declared tuning reference. Handle zero denominators and incompatible units explicitly. Annualized customer lifetime value inferred from short retention history should be labelled an estimate with its assumptions, not a fact.

A common formula contract should specify name/version, input type and units, domain limits, rounding mode, result units, assumptions, source and test vectors. Timers should separate monotonic elapsed duration from calendar time; bookings require an explicit timezone and tests around daylight-saving transitions. Arithmetic can be exact while the input assumptions remain uncertain.

## 7. Customer interfaces and accessibility

Preserve the parent identity and three clear product entrances. On the homepage, present a specific customer outcome, one useful example and a clear starting action. In workspaces, favor a focused task with a saved record, visible status and next step. Keep the advanced machinery behind those actions.

Every control needs loading, saved, empty, denied, setup-required, failed and stale/offline behavior where applicable. Show whether retrying is safe and whether an external action was accepted. Do not clear user input on a recoverable error. Redirect an action to its relevant receipt or record; inspect the 15 remaining workspace-home fallbacks individually. Some machine APIs need no customer page; document that deliberately instead of creating filler screens.

For table-heavy operations, add clear filters, pagination, saved views, accessible row actions, bulk-action previews and reversible archive behavior. On narrow screens, show the few fields needed for the task and preserve a detail view. Make multi-step setup explain the benefit and the required provider, without exposing implementation jargon.

Use WCAG 2.2 AA as the proposed acceptance target [S6]. Include keyboard-only operation, visible focus, semantic headings/labels, screen-reader status announcements, error identification, zoom/reflow, contrast and non-color status cues. Caption prerecorded synchronized media as applicable; support transcripts, editable captions, visual notification equivalents and audio controls. Respect reduced motion and keep voice, sounds, haptics and external alerts off or explicitly user-controlled.

Test critical journeys with a screen reader, keyboard, touch and high zoom. Automated contrast/static checks in this repository are useful evidence but do not establish full WCAG conformance. No new manual assistive-technology or device UI audit was completed during this code pass.

Proposed performance targets use field Core Web Vitals: LCP at most 2.5 seconds, INP at most 200 milliseconds and CLS at most 0.1 at the 75th percentile [S7]. Measure mobile and desktop separately. A Lighthouse score or Total Blocking Time is not a measured field INP result. Profile real pages and payloads before prescribing a frontend rewrite.

## 8. Business model, current prices and marketing engineering

### Pricing and operating economics

The runtime plan table advertises Free, One workspace at $29/month, All three at $59/month, and Team at $109/month; annual amounts are $290, $590 and $1,090. Availability depends on canonical Stripe configuration; annual plans may be hidden until buyable. The live Stripe-price comparison was skipped locally because no key was provided. Historical source comments about earlier live verification do not substitute for a fresh check.

| Service | Retrieved public pricing signal | Planning implication |
| --- | --- | --- |
| Supabase | Pro starts at $25/month; additional compute/projects and usage can add cost [S8] | Budget storage/egress and compute separately; avoid assuming a single unlimited project |
| Vercel | Pro starts at $20/month with included usage terms [S9] | Hosting estimate depends on actual deployed architecture and seat/usage needs |
| Resend | Free: 3,000 emails/month, 100/day; Pro: $20/month for 50,000 [S10] | Daily limits can bind even when the monthly allowance is unused |
| Stripe, US standard cards | 2.9% plus $0.30 for the stated domestic-card pricing [S2] | Other country, method, Billing, Connect, FX, tax and dispute costs need separate review |

A simple proposed Supabase-plus-Vercel baseline starts at $45/month, or $65 with the cited email plan. This is a planning floor, not SONARA's current invoice or complete operating cost. Domain, monitoring, backups, media/AI, additional seats/projects, taxes, support and traffic overages are excluded.

Illustrative unit economics: assume $150 monthly fixed overhead, $6 variable service/support cost per paying customer, and only the US standard card fee above. These are scenario assumptions, not observed SONARA costs or a revenue forecast.

| Monthly price | Assumed card fee | Contribution after fee and $6 variable cost | Customers to cover $150 fixed |
| --- | --- | --- | --- |
| $29 | $1.141 | $21.859 | 7 |
| $59 | $2.011 | $50.989 | 3 |
| $109 | $3.461 | $99.539 | 2 |

Model raw arithmetic before rounding; actual processor transaction rounding and additional fees affect the final ledger. Define included storage, expensive processing, message sends and staff limits using measured cost. Offer a preview and explicit approval before spending beyond allowance. Track cost per completed workflow and failed/retried execution, not only cost per request.

Recommended revenue sequence: subscriptions first; separately quoted setup where appropriate; metered expensive work only after accurate usage reservation/settlement; merchant platform fees only with disclosed contracts and verified payment configuration. Advertising should be clearly labelled and must not expose private work. Do not monetize every screen at the expense of the main task.

### Current competitor comparison

| Product and source | Verified comparison basis | Lesson for SONARA |
| --- | --- | --- |
| Shopify Basic [S21] | $39 month-to-month or $29/month billed annually on the retrieved pricing page | Compare billing commitments and complete merchant workflows; headline price alone does not show replacement value |
| Jobber Core [S22] | One user: $49 no-commitment monthly, $39 with a one-year commitment, or $29/month billed annually | Demonstrate booking, job, invoice, payment and customer receipt together |
| Podia Mover [S23] | Retrieved annual view: $42/month, $504 billed annually, 5% platform fee | Include platform fees, subscriber/product limits and delivery when comparing creator tools |
| Brevo [S24] | Pricing page retrieved without usable plan amounts in the extraction | Do not reuse an older price as current; verify account/region/billing before a numeric comparison |

These vendors' pages establish advertised plans, not independent evidence of SONARA superiority. No benchmark, conversion lift, total-addressable-market size or customer demand was established by this review. Avoid universal cheapest, all-in-one replacement, unlimited, fully autonomous or guaranteed-growth claims until the exact claim has adequate evidence.

### Marketing plan that can be measured

Use the existing message, **Build. Create. Grow.**, followed by concrete product outcomes. A proposed initial positioning is: Business Builder, organize a job and get paid; Creator Studio, package your work and sell the approved version; Growth Studio, follow up with permission and see the result. These are draft directions and should only be published for journeys with matching proof.

Start with a narrow customer cohort that completes one recurring job. Service operators and independent creators are reasonable hypotheses from the current product structure, not proven market demand. Conduct five to ten structured interviews and observed task sessions; identify the job, current workaround, willingness to pay and failure cost. Choose the beachhead using actual completion and repeat-use evidence.

Build one landing page per proven journey, an accurate comparison page and useful guides around the existing 15 free tools. Let a free result explain the benefit of saved work or the appropriate paid workspace. Use helpful, indexable content and correct page metadata; Google Search Essentials does not guarantee rankings [S15]. Avoid mass pages that restate the same claim or target every industry without relevant workflows.

Proposed four-week sequence:

| Week | Deliverable | Measurement |
| --- | --- | --- |
| 1 | Interview/observe the first cohort; capture workflow baseline | Time to complete, failure reasons and current workaround |
| 2 | One approved demo and landing journey; instrument activation | Visitor → meaningful start → saved record → completed outcome |
| 3 | Pilot with explicit consent and provider receipts | Completion, support minutes, repeat action and cost per completion |
| 4 | Review results; refine onboarding, limits and message | Repeat use, paid conversion, refund/failure reasons and contribution |

Do not send campaigns during this pass. Require approval, per-purpose consent, suppression and unsubscribe handling before execution. CAN-SPAM covers commercial email including B2B; truthful headers/subjects, sender identification, postal address and opt-out handling are among its requirements [S13]. A consent-first SONARA product policy can be stricter than a legal minimum. Record provider delivery separately from opens/clicks, which are imperfect engagement signals. Attribution should show source, period, freshness and method; an associated conversion is not automatically causal lift.

Keep an evidence register for public claims and testimonials. State what was tested, on which version, under which conditions, and when. Approval is required before publishing proof or legal wording. The FTC's advertising guidance supports truthful, substantiated claims [S14]; a legal page or internal policy does not itself establish compliance.

## 9. Validation, tracking and release evidence

The locally installed runtime was Node 24.19.0 and pnpm 11.25.0. The repository pins pnpm 12.7.0. Frozen installation succeeded without changing the lock; hosted checks are the stronger proof for the pinned toolchain. Resolve the local-version mismatch in the next developer-environment pass rather than silently change the repository pin.

| Verification | Result | Practical limit |
| --- | --- | --- |
| Frozen dependency install and moderate audit | Pass; no known vulnerabilities reported | An audit result is not an application security assessment |
| Runtime type/parse check, lint and build | Pass | Type coverage is limited by the existing JavaScript/contract checks |
| Focused commerce regressions | 201 passing | Provider behavior is fixture-backed |
| Full commerce suite | 6,869 passing; six pending | Pending tests remain pending; no production transaction proof |
| Repository governance chain | Pass after generated evidence/count updates | Some gates explicitly skip external or unavailable execution |
| Client-secret surface scan | Pass | Pattern-based scan cannot establish absence of every secret |
| Route smoke | Pass, including protected/refused/404 behavior | Server-response checks do not establish every device interaction |
| Local Stripe price check | Skipped: credential unavailable | Live price/entitlement availability remains unknown |
| Local migration replay | Skipped: files read, migrations not executed | A green local gate is not migration execution proof |
| Draft PR 449 hosted checks | Docker image, native migration replay and validation checks succeeded | The repair is still a draft; no merge or deployment by this pass |

The first full commerce run found the generated handoff test-file count stale after adding a regression file. It was regenerated, and the complete suite passed. The first governance run found the proprietary-source count stale after adding a runtime module. The exact count was updated, and the chain passed. Neither check was weakened.

Use three test layers for the next increments: pure policy/amount/state fixtures; real PostgreSQL constraints, RLS and contention tests; and authorized sandbox/provider journeys with persisted receipts. Add browser/device tests for actual changed interfaces. Tests should fail on the defect or prohibited state, not merely confirm that a helper exists.

Recommended telemetry envelope: event/version, organization and workflow ID, operation/correlation ID, actor class, state/outcome, duration, retry attempt, provider record reference and cost/usage. Redact personal data and credentials; limit high-cardinality labels. Persist product evidence separately from transient logs. Expose stale or missing measurements, not a fabricated zero.

Proposed initial reliability objectives are 99.5% monthly availability for the customer web journey and explicit latency/queue-age targets for each workflow. These are planning targets pending production measurement and incident ownership. Track account recovery failures, denied cross-tenant attempts, duplicate effects, reconciliation mismatches, private delivery failures, notification complaints and support time alongside speed.

## 10. Ordered implementation backlog

Effort ranges below are engineering estimates for focused slices, not promises. Provider access, test infrastructure and product decisions can change them. Work in independent reviewable pull requests and retain the controlled deployment gate.

| Priority | Next slice | Acceptance evidence | Estimated effort |
| --- | --- | --- | --- |
| P0 | Review the Docker repair and commerce amount changes | Exact-head hosted checks; provider availability limits documented; no unsafe merge | Completed source increments; review remains |
| P0 | One creator purchase to private delivery and reconciliation | Authorized sandbox payment, duplicate/out-of-order event tests, versioned grant/download, refund/dispute receipt | 3–7 engineer-days |
| P0 | One merchant order/job to stock, payment and receipt | Real concurrent stock tests; provider receipt; refresh/retry cannot duplicate effects | 3–7 engineer-days |
| P0 | Two-tenant authorization and private-file verification | Negative actor/tenant matrix with real database/storage policies; no credential exposure | 2–5 engineer-days |
| P0 | Audit remaining monetary aggregation/unknown handling | Invalid/missing/mixed-currency fixtures, tax/discount rounding, provider-range refusal | 1–3 engineer-days |
| P0 | Database-plus-object restore drill and release recovery | Recorded restore times, asset hashes, rollback drill and exact-version evidence | 2–4 engineer-days |
| P1 | One Growth Studio approved outbound connector | Authorization/scopes, consent, suppression, durable receipt, duplicate-safe recovery | 3–7 engineer-days |
| P1 | Customer receipts and specific destinations | Resolve each applicable workspace fallback; accessible failure/setup/retry states | 2–5 engineer-days |
| P1 | Bounded media worker | Real accepted job, progress, cancel/retry, resource limit and verified export | 3–7 engineer-days |
| P1 | Offline job notes and work-pack recovery | Restart/reconnect/revocation/conflict tests on two devices; visible queue | 3–7 engineer-days |
| P1 | Accessibility and field-performance pass | Manual critical-journey audit; captions; real field metrics and measured fixes | 2–5 engineer-days |
| P1 | Cost and product activation instrumentation | Per-tenant usage budgets, completed-workflow cost and cohort funnel | 2–5 engineer-days |
| P2 | Vertical packs, POS, community and knowledge tools | Reuse canonical records; demand proof; moderation/rights and operating cost | Scope after pilot |
| P2 | Advanced routing, travel and native sensors | Provider/device proof, permission fallback, terms and cost before release | Scope after need is measured |

For a community/social platform, define reporting, blocking, moderation, appeals, privacy and rate limits before opening public posting. For storefronts, define ownership, item rights, refunds, disputes and fulfillment before expanding inventory types. For general-question tools, source current facts and identify uncertainty. For child-company expansion, assign an accountable product owner, budget, data contract and support responsibility before increasing organizational complexity.

The next smallest unblocked engineering slice is the residual financial-unknown audit with negative fixtures; the next provider-dependent slice is one authorized creator purchase through private delivery and reconciliation. Production reactivation needs the existing offline instruction changed, exact-head release checks, credentials/scopes, deployed schema evidence and an agreed canary/rollback plan.

## 11. Evidence matrix, contradictions and remaining unknowns

| Material claim or decision | Evidence | Contradiction or boundary sought | Confidence |
| --- | --- | --- | --- |
| Fix deployment packaging first | Main Docker log missing `android/twa/build-contract.json`; production gate stopped; negative/positive probe; PR 449 green | Server works locally with a full checkout, which would hide the container omission | High for defect and repair; live production unknown |
| Consolidate commerce units | Negative examples; Stripe denomination documentation; new boundary and route regressions | Intl defaults differ for MGA; ISK/UGX compatibility differs from zero-decimal display conventions | High for changed source; provider charge eligibility remains separate |
| Prioritize workflow completion | Source inventory, staged-module accounting, convergence contract | Existing complete transitions should be reused rather than recreated | High for source breadth; customer demand and production completion unknown |
| Keep tenant filtering with RLS | Supabase service-role behavior and repository tenant-query gates | Browser policies do not constrain a service-role server query | High for requirement; effective deployed policies unverified |
| Preserve release gates | Main controlled deployment refusal and branch API; hosted repair checks | Green unit tests alone cannot establish a release | High for observed gates; merge-policy enforcement needs owner action |
| Use dated feature/price comparisons | Current Shopify, Jobber and Podia pages; Brevo extraction unavailable | Annual versus monthly commitments, platform fees and limits invalidate broad cheapest claims | High for retrieved figures; price/location changes remain possible |
| Back up objects separately | Supabase official backup documentation | Database metadata restoration does not recover missing object bytes | High for documented boundary; SONARA restore capability unknown |
| Keep offline/sensor claims bounded | Staged offline module, browser documentation and route-estimator source | A policy module is not sync execution; permission record is not browser consent; great-circle distance is not road ETA | High for source limitations; real device behavior unverified |

Material unknowns: production availability/configuration; current invoices and usage; active customers and retention; customer interviews; effective live schema/RLS; live provider accounts, prices and scopes; actual object backups; real device/offline behavior; completed accessibility audit; paid delivery/refund/dispute reconciliation; incident/restore performance; incorporation/jurisdiction obligations. None was filled with an invented result.

Reverse the architecture recommendation only if measurements show a concrete bottleneck or the present modules cannot safely support the canonical workflow. Reverse a market/pricing hypothesis if customers do not complete or repeat the workflow at a sustainable contribution. Stop a release if authorization, settlement, private delivery, idempotency, recovery or required accessibility behavior fails.

## 12. Primary-source register

All web sources below were retrieved on 2026-10-08 UTC. Vendor prices and API behavior are time-sensitive. Links establish the described source identity; the implementation and repository measurements have their own evidence above.

- **S1 — Stripe currencies:** https://docs.stripe.com/currencies — charge units, zero-decimal currencies and compatibility/payout exceptions.
- **S2 — Stripe pricing:** https://stripe.com/pricing — retrieved US standard domestic-card rate; not all provider charges.
- **S3 — Supabase RLS:** https://supabase.com/docs/guides/database/postgres/row-level-security — service-role bypass and policy boundaries.
- **S4 — Supabase Storage access:** https://supabase.com/docs/guides/storage/security/access-control — object access policies.
- **S5 — OWASP ASVS:** https://owasp.org/projects/asvs — versioned application-security verification requirements.
- **S6 — WCAG 2.2:** https://www.w3.org/TR/WCAG22/ — accessibility requirements; proposed AA target.
- **S7 — Web Vitals:** https://web.dev/articles/vitals — field performance metrics and thresholds.
- **S8 — Supabase pricing:** https://supabase.com/pricing — base plan and usage/compute distinctions.
- **S9 — Vercel pricing:** https://vercel.com/pricing — hosting plan/usage basis.
- **S10 — Resend pricing:** https://resend.com/pricing — email allowance and daily limit.
- **S11 — MDN Geolocation:** https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API — secure context and user permission.
- **S12 — MDN device orientation:** https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Detecting_device_orientation — browser/device behavior and permission considerations.
- **S13 — FTC CAN-SPAM:** https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business — commercial-email requirements.
- **S14 — FTC advertising:** https://www.ftc.gov/business-guidance/advertising-marketing — truthfulness and substantiation.
- **S15 — Google Search Essentials:** https://developers.google.com/search/docs/essentials — public search guidance, not ranking guarantees.
- **S16 — U.S. Copyright Office AI:** https://www.copyright.gov/ai/ — official copyrightability research and reports.
- **S17 — MDN Web Authentication:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API — passkey/WebAuthn capability basis.
- **S18 — Supabase backups:** https://supabase.com/docs/guides/platform/backups — database backup boundary; Storage objects excluded.
- **S19 — MusicXML 4.0:** https://www.w3.org/2021/06/musicxml40/ — community specification and interchange basis.
- **S20 — FFmpeg legal:** https://ffmpeg.org/legal.html — upstream license and optional-component considerations.
- **S21 — Shopify pricing:** https://www.shopify.com/pricing — retrieved monthly and annual billing basis.
- **S22 — Jobber pricing:** https://www.getjobber.com/pricing/ — Core billing commitment and one-user basis.
- **S23 — Podia pricing:** https://www.podia.com/pricing — retrieved annual Mover plan and platform fee.
- **S24 — Brevo pricing:** https://www.brevo.com/pricing/ — exact current plan amounts not established by retrieval.
- **S25 — Stripe webhooks:** https://docs.stripe.com/webhooks — signature verification and event delivery handling.
- **S26 — Stripe Connect charges:** https://docs.stripe.com/connect/charges — account/charge model and responsibility distinctions.
- **S27 — Node release policy:** https://nodejs.org/en/about/previous-releases — production runtime lifecycle reference.
- **S28 — Supabase changelog:** https://supabase.com/changelog — source for future pinned-contract compatibility reviews.

For Connect, direct and indirect charges have different account and responsibility relationships [S26]. A lower-custody payment design does not establish that every jurisdictional or contractual obligation disappears. Verify the account configuration and contractual model before introducing platform fees or claiming merchant eligibility. Stripe webhook acceptance requires raw-payload signature verification and robust event handling [S25]; no checkout success page should independently grant a paid entitlement.

## 13. Implementation handoff

Base: `add53bf33a1c7cffa72fb7fc2b3738c25e8dac00`.

Docker branch: `codex/docker-runtime-contract-20261008`; remote commit `4d1b74a08db7ad734e8a35775c790f18f029b3d5`; draft PR 449. Files: Dockerfile and shared handoff log. Negative probe reproduced missing contract; corrected copy-set import and hosted image/native migration checks passed. No local Docker binary and no production deployment.

Commerce branch: `codex/commerce-amount-integrity-20261008`; implementation parent `4d1b74a08db7ad734e8a35775c790f18f029b3d5`. It includes the separate PR 449 repair as an ancestor so hosted checks use the corrected container. Both drafts target main because several validation workflows filter that base; review and merge the repair first, after which the commerce diff narrows automatically. Adds one shared amount module and one regression file; updates three domain consumers, five route consumers, the plan-source commentary, two existing regression files, generated inventory/handoff, exact proprietary-source count, this report and the shared handoff log. Lockfiles and migrations untouched. Workflow slice: offered price → bounded order snapshot → accurate receipt/report display. It preserves canonical payment/stock transitions and existing authorization.

External proof still required: live Stripe prices and configured currencies/payment methods; actual payment, private delivery, refund/dispute and reconciliation on an authorized provider account; deployed schema and effective policies; production/device/customer results. Use the draft PRs as reviewable implementation, keep the site-offline direction, and take the smallest remaining canonical workflow slice next.
