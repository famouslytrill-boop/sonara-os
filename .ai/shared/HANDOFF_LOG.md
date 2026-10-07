# Handoff Log

## 2026-10-07 — Codex: seller payment/licence evidence (PR #441, implementation)

- Built `/creator-studio/owner/marketplace/reconciliation`, linked from the seller marketplace. It reads authenticated seller orders, grants and the connected Stripe account; all provider operations are GETs. Financial evidence requires a verified owner/admin/manager membership in the same organization; unknown roles and staff are refused before sales/provider reads. The organization resolver runs with automatic workspace creation disabled.
- Reports missing recorded payments/grants, duplicate paid checkouts, snapshot mismatches, full refunds, disputes and incomplete reads. Currency totals and original-charge fee/net figures remain separate; no payout, profit or production sale is claimed.
- Buyer downloads now require the grant's organization, buyer, version and licence to match the immutable order. The receipt states payment and delivery separately.
- Stripe session pagination fails on malformed or repeated cursors and identifies page bounds. Provider objects are projected before rendering; client secrets never enter the report.
- Local focused validation: 82 passing tests under Node 24 using its test runner's Mocha-compatible globals. The full 6,341-test suite, including the real organization-resolver boundary and three real-server private-storage regressions, passed at `deea8f80971878cf9cf620b5723cfada0608ba8d`. Frozen installation, type checking, lint, build, route smoke and database/storage contracts passed there; its release gate rejected stale inventory. Generated evidence is now refreshed. Current gate decisions and Chromium screenshots are recorded on PR #441; the local clone remains unavailable after an automatic approval-review usage-limit error.
- Desktop/mobile Chromium checks render the actual route and real document/card shell with fixture provider records, exercise period refresh, and distinguish missing grants/provider failure. Screenshots and logs are uploaded by Browser Quality; this is fixture UI proof, not a live sale. Findings use escaped card markup rather than the shared plain-text card helper.
- The existing branch regeneration workflow now includes this convergence branch and regenerates capability evidence from a complete CI checkout before a fresh validation commit. The capability map includes a compact generated list of open destination workflows with endpoint, workspace, current fallback and exact source location; these remain open until real screens exist. Derived inventory is never edited by hand.
- Coordination: #439 is merged; its locks are released. #440 LinkedIn execution and #442 leasing/legal work are untouched. Remaining production proof requires configured accounts and actual customer/provider transactions; no live charges, refunds, payouts or deployment were performed.


## 2026-10-07 - Claude - Record detail pages for every door; declared doors in the inventory

- `hasDetailPage(page)` (lib/sonara-owner-record-pages.cjs) decides which record
  kinds get `/…/:recordId`: line items, `shareableAs`, or `publishHandle`. Quotes,
  bookings and Creator Studio artist profiles now have one, because their share or
  publish card had nowhere to render. If you add a card to the detail page, gate it
  on a declaration and add that declaration to `hasDetailPage` if it can stand
  alone.
- The detail page is `registerDetailRoute(page, guard, chrome)` in
  routes/sonara-last9-routes.cjs, used by Business Builder and Creator Studio.
- **New generator invariant for both of us:** `declaredDoorsNotRendered`. A card
  the detail handler renders for only some record kinds must be listed in
  `declaredDoors` in scripts/generate-capability-inventory.cjs with the predicate
  that picks its pages; a form credited to every record detail page with no door
  fails the build.
- Owner steps blocking #439's checks: apply `20261006040000` to production
  (additive; `20261006035501` is already applied), and reset #439's Supabase
  preview branch (it still records the replaced 030000).

## 2026-10-07 - Claude - Merged #438 into #439; one place moves an order's stock

- Codex: your `transition_merchant_order` is kept exactly as merged and is the only
  thing that takes an order's stock off the shelf. #439 had its own fulfil path; it
  is removed, so nothing double-decrements.
- What #439 adds on top: `inventory_order_hold` (20261006040000, replacing the
  unapplied 030000) holds the line's frozen link when an order is placed, under the
  same order-then-items row locks your function takes; a trigger on the order's
  status settles the hold (fulfilled -> consumed, cancelled -> released) in your
  transaction. The owner card no longer says "Checkout does not reserve stock".
- **Updated shared rule:** on-hand stock moves only in `transition_merchant_order`
  (order fulfilment) and `inventory_material_stock` (jobs). Holds only through
  `inventory_order_hold`. Never a route PATCH of `inventory_items.quantity`.
- Lesson for both of us: my lock lived only on my branch. Before starting a chain,
  check open PRs as well as LOCKS.md on main.

## 2026-10-06 - Claude - Route data contracts: 300 -> 0

- Took a lock on `scripts/generate-capability-inventory.cjs` (Codex edited it in
  #437 for the commerce `restClient`; that special case is kept and now one
  instance of a general rule).
- The 300 were mostly the generator unable to read routes, not missing contracts:
  it read the async-safety wrapper for every route, never followed `deps`
  helpers, missed nested calls, and placed callback-registered routes on the
  wrong line. Twelve fixes, each pinned by
  `tests/the-inventory-traces-what-a-route-calls.test.js`.
- **New rule for both of us:** `routesWithoutDataContract` is a generator
  invariant. A new route must trace to the tables/functions/provider endpoints it
  reaches, or be read and recorded in `lib/sonara-route-data-reviews.cjs` -- and
  that register is refused if the trace contradicts it, and proven at runtime by
  `tests/a-route-that-reads-nothing-reads-nothing.test.js`.
- If a route of yours fails it, the usual cause is a helper the tracer cannot
  follow; the fix is in the tracer (see the twelve in SPRINT_LOG), not a review
  entry for a route that does read data.

## 2026-10-06 - Claude - Stock moves with orders and jobs

- Pulled main at `ddae877b` (Codex #437 on top of #436). Read Codex's entry: both
  commerce migrations recorded in production; route/data reviews 300, destination
  fallbacks 96. Took the inventory lock in LOCKS.md.
- `20261006030000` adds `inventory_reservations` and two locked SQL functions;
  storefront orders hold stock on placement, fulfilment consumes, cancellation
  releases; work-order materials used/returned move the count. Proven in the
  migration replay including a two-session last-item race. Not applied to
  production by this change.
- Shared rule worth keeping for both of us: **any stock change goes through
  `inventory_order_stock` / `inventory_material_stock`, never a PATCH of
  `inventory_items.quantity` from a route** -- a count written from a value read a
  moment ago is the race. A test refuses the store path writing it directly.
- Fixed in passing: work-order materials picked from inventory could never be saved
  (missing_required), and record pages never showed `?problem=` refusals.

## 2026-10-06 - Codex - Commerce recovery and route/data proof

Pulled main at `d926cadb161660fba1f642ddd5f2661256d61bcd` (PR #436).
Connected-account webhooks now return 503 when a required order transition,
exclusive listing closure, grant revocation or payment-event audit write fails.
Full refunds and disputes replay the outstanding revocation after an order has
already changed state. Downloads require a paid order independently of the
grant, so a stale unrevoked grant cannot unlock a refunded or disputed purchase.
Already-paid grant repair still requires Stripe's paid status. No refunds or
payout changes are issued by this change.

The capability inventory traces literal table queries through commerce's local
REST wrapper, explicit CommonJS named exports and returned local factory methods.
Purchase and receipt pages no longer claim to have no persistent data. Remaining
route/data reviews: 300 (304 on pulled main); workspace-home destination fallbacks:
96. These are static inventory review counts, not a count of proven broken
customer screens. No destination gaps were relabelled as resolved.

Falsification: restoring the three original runtime files made all 11 added
recovery tests fail by name. Restoring the original inventory scanner and
regenerating made six commerce lineage checks fail by name. Working files and
generated inventories were restored with byte checksums verified. The negative
lineage test keeps unrelated version files and approvals out of the purchases
page's confirmed table set.

Full suite: 6,171 passing, 6 existing browser-media checks pending. Focused
commerce recovery: 137 passing. Inventory lineage: 7 passing. Frozen installation, moderate audit, typecheck, lint, build, route smoke,
API, repository database/tenant contracts and client-secret scan passed. The broader
release gates passed after generated inventory/handoff refresh. Native PostgreSQL
migration replay was explicitly skipped because its binaries are absent. Chromium
installation was attempted; the provider returned an invalid download archive, so
the six browser-media checks remain pending. No check was weakened.

Read-only production verification: both commerce migrations are recorded; all
eight queried commerce tables exist with RLS enabled, and merchant payment
columns are present. Connected seller accounts, published marketplace entries,
marketplace orders, grants, merchant orders and merchant payment events are all
zero. No seller, listing, transaction or production credential was fabricated.
This is schema evidence, not a real purchase or native-device proof.

Remaining convergence work includes inventory reservation/fulfillment,
Marketplace provider reconciliation, social delivery/conversion proof,
authenticated provider connections, worker execution, native devices and the
other P1/P2 priorities. Local tests stub Stripe and Storage; they prove code
behaviour, not settlement, deployment or real customer/device evidence.


## 2026-10-06 - Claude - Connected-account commerce: marketplace sale chain, then storefront payment and reconciliation

- PR #436 (draft) takes the Creator Studio marketplace through the whole chain:
  pinned delivery file -> Stripe Checkout as a direct charge on the seller's
  connected account -> signed Connect webhook -> licence grant -> private
  download -> refund/dispute revokes -> every Stripe event recorded. Migration
  `20261005010000_a_sale_is_a_licence_delivered.sql` is NOT applied to production;
  `production-deploy-dry-run` stays red until the owner applies it.
- Same branch, next: the Business Builder storefront takes payment through the
  same Connect checkout and the same webhook, then an owner reconciliation page
  compares every order with Stripe's own record (gross, fee, net, refunds).
- **Shared contract, so the two of us do not build it twice** -- written into
  `docs/CODEX_HANDOFF_SKILLS_FORMULAS_AGENTS.md` section 12: one Connect webhook
  endpoint and secret (`STRIPE_CONNECT_WEBHOOK_SECRET`), dispatched by
  `metadata.sonara_kind`; one checkout opener (`lib/sonara-connected-checkout.cjs`);
  fulfilment only from a signed event or a server-side read of Stripe's own
  object; zero application fee; refunds recorded, never issued.
- Process alignment found while reading this log: Codex's handoff says never
  `git add -A` and stage files by name. Claude's commits on #436 used `-A` (each
  checked against `git status`); staging by name from here.
- Dependency note for Codex: `proxy-addr` is overridden to 2.0.8 for
  GHSA-jqcg-44mw-7w3h (critical, published 2026-10-05 23:30 UTC) in
  `pnpm-workspace.yaml`. `main` will fail the OSV gate until #436 or an equivalent
  override lands.

## 2026-09-18 - Codex - Node 24 production runtime / Node 26 compatibility proof

- Stacked runtime migration on top of PR #294 hardening rather than mixing scopes. Draft PR #295 keeps production and ordinary CI on Node 24, adds Node 26 as a blocking compatibility lane, and prewires Node 27 as manual/non-blocking only until an official release exists.
- Vercel project metadata confirms the SONARA project is configured for Node `24.x`; latest READY production deployment remains on merged `main` commit `6f52b33e69724ad6b8f5c6fa855a4cadc6edd879`. No deployment was triggered from this branch.
- GitHub exact-head runtime proof passed on Node `24.20.0` and Node `26.9.0`: dependency install, typecheck, lint, full test suite, and build all green in both blocking lanes. Node 27 correctly skipped on pull-request runs.
- First Node 24 dependency-scan attempt exposed a parser defect rather than failing tests: Node 24 changed the default `node --test` human-readable summary. The workflow now pins `--test-reporter=tap` and parses TAP's machine-readable count; existing suite floors were preserved. Replacement dependency-scan is green.
- Action/runtime health is green: 70 external Action references across 16 workflows resolve to seven reviewed Actions on `node24` or composite runtimes, and the network verifier reread eight upstream manifests at the exact pinned commits. No retired Node runtime is registered or referenced.
- Exact-head PR #295 workflows are green: Docker Image CI, dependency-scan, Node Runtime Compatibility, External Repository Health, and SONARA Industries CI.
- Next ordered gate: integrate PR #294 first, then retarget/rebase PR #295 onto the resulting `main`, rerun the complete exact-head matrix, and only then consider merge/deployment. No merge or production mutation was performed in this pass.

## 2026-09-18 - Codex - GitHub action v7 pin migration

- Upgraded `actions/checkout` to immutable v7.0.1 commit `3d3c42e5aac5ba805825da76410c181273ba90b1` across all workflows.
- Upgraded `actions/setup-python` to immutable v7.0.0 commit `5fda3b95a4ea91299a34e894583c3862153e4b97` across all workflows.
- Updated `scripts/verify-github-action-pins.mjs`; its supply-chain gate verifies all 64 external action references across 15 workflows.
- Did not change the Node application runtime; Node 24 migration remains a separate ordered change.

## 2026-09-14 UTC - Operations reconciliation merged; deployment held by live proof gate

- Merged current `origin/main` (`d83785fc`) into the reconciliation branch,
  committed as `74a9927f`, and merged PR #252 into `main` as `7e456965`.
- Post-merge local evidence: `pnpm test` passed 4,438 tests with 6 pending;
  build, lint, client-secret scan, route smoke, API contract, repository schema,
  OpenAPI, and governance gates passed. The repository contains 118 migrations,
  146 canonical tables, 8 operational indexes, and 7 private buckets.
- Fixed two gate findings during final verification: encoded analytics date
  filters at the PostgREST boundary, and made the request-tenant verifier
  portable across Windows and POSIX path separators. Updated migration counts
  in shared and owner documentation.
- Controlled production run `34815661993` started from merged main and passed
  protected credentials, dependencies, build, tests, secret scan, and lint. It
  stopped before migration or Vercel deployment at live member-read proof
  because `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SONARA_VERIFY_USER_JWT` were not present
  in the protected workflow environment. No secrets were added or printed.
- Remaining owner-controlled proof: provide the protected Supabase verification
  values, apply the two new append-only migrations through the controlled
  workflow, then rerun the Stripe live-price, catalog, storage, and production
  alias checks. Media providers/workers remain setup-required by design.

## 2026-09-13 UTC - Deterministic operations, media planning, and governance

- Rebased the launch reconciliation branch onto `origin/main` at `f5f57ab3`
  and merged the complete operations/media branch without removing current
  catalog or launch work.
- Added organization-scoped business analytics, reservation resources,
  waitlists, consent-aware mapping, employee PWA access, allowlisted automation,
  and truthful Creator Studio music/video workflow planning.
- Added a commercial integration activation policy covering terms review, rate
  limits, organization scope, server-only secrets, operator approval, and
  optional-only AI. Invalid connections remain disconnected.
- Added deterministic purchase-order approval, owner/manager role separation,
  fulfillment blocking, rate limiting, and a service-only atomic audited RPC in
  append-only migration `20260913190000_purchase_order_approval_controls.sql`.
- Updated OpenAPI and shared contracts. Focused tests, the 300-operation API
