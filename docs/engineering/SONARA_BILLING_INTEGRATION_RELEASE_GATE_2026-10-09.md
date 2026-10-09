# SONARA cross-suite billing integration — gated handoff

Status: **draft integration candidate only**. No merge, deployment, payment action,
tenant migration or website state change has been authorized.

## Sources consolidated

This integration candidate is based on draft **#555** head
`bc5083c928502257b89221cf42e2196af83d3f83` and manually reconciles
changes from draft **#558** head
`16d17781aa250ee7d05e80a28963ec3f732426cb` and draft **#564** head
`dd9c16f3c811f1e38295de4efbeb1a009a98f553`.

The resulting branch incorporates all three code changes together. Reviewers
must **not merge #555/#558/#564 independently on top of this candidate** or
cherry-pick their `server.js` / `lib/sonara-billing.cjs` implementations in
a way that overwrites another protection.

## Runtime invariants

1. **Canonical public URLs:** production and hosted deployments use a
   configured HTTPS origin, never request Host or forwarded Host values.
   Stripe checkout success/cancel overrides must remain on the same origin.
2. **Shared subscription management:** `GET /billing` is a customer-authenticated
   parent-account page. Creator Studio and Growth Studio billing links can
   land there without a Business Builder-only page redirect. The Stripe Billing
   Portal `return_url` and fallback point to `/billing`.
3. **Subscription status integrity:** broken PostgREST JSON never becomes
   "No active paid plan"; if the five newest historical rows show no active plan,
   query active/trialing subscription rows for that organization before
   claiming none. Read failures remain explicitly unreadable.
4. **One-time payment mode:** signed Checkout `mode: payment` events cannot
   unlock recurring `mode: subscription` plans, quoted/retired products, or
   unknown SKU keys.
5. **Tenant ownership before fulfillment:** subscription and eligible
   one-time-payment events must pass a database-backed
   `stripe_customers` binding check for provider Customer ID and target
   organization (and user ID where present) before subscription, purchase or
   entitlement writes.
6. **Retry rather than counterfeit success:** unrecognized paid events or
   missing customer mappings return a failure so webhook delivery can retry and
   operators can reconcile the provider's state with the immutable customer
   ledger. Don't invent customer mappings from webhook metadata.
7. **Injected environment:** `lib/sonara-billing.cjs` uses the injected
   `getEnv` for NODE_ENV / VERCEL hosted flags and never reads ambient
   `process.env` directly. This preserves `tests/server-split.test.js`
   while refusing localhost redirects in hosted/production.

## Integration test paths

Focus on:
- `pnpm exec mocha tests/production-origin-must-not-follow-request-headers.test.js`
- `pnpm exec mocha tests/a-billing-page-says-what-happens-next.test.js`
- `pnpm exec mocha tests/billing-delivery-reliability.test.js`
- `pnpm exec mocha tests/server-split.test.js`
- `pnpm exec mocha tests/included-generation-periods.test.js`
- `pnpm exec mocha tests/server.test.js`

Then run `pnpm run lint`, `pnpm run verify:launch`, the
generated capability/handoff checks, exact-head Node 22/24 compatibility
and required GitHub workflow checks. The test process must have standard Node
`URL` and `URLSearchParams` globals; an isolated connector JavaScript
sandbox without those globals **cannot** validate the URL-handling tests.

## Required end-to-end test matrix

- Signed-in creator-only, growth-only, business-only and all-three customers
  reach shared billing without cross-workspace leakage.
- Unauthenticated callers cannot read any billing page's tenant records.
- Checkout with missing canonical origin refuses before contacting Stripe.
- Stripe customer and organization mapping established by authenticated
  checkout; spoofed metadata rejected prior to entitlement writes.
- Real Stripe test-mode subscription created, activated, renewed, canceled,
  retried and revoked through signed webhook deliveries and real RLS controls.
- One-time payment receipt must not make a monthly/annual plan active.
- Database outage and malformed rows must not claim "no active paid plan."
- Stale webhook replay cannot re-enable canceled subscriptions.
- An unresolvable ownership mapping is detectable and can be reconciled,
  including the risk of delayed revocation after cancellation.
- Human sign-off for production environment/price/key configuration, exact
  migration project, downtime/rollback plan, protected main merge and canary.

## Verification boundary

Static source-contract checks and syntax compilation inspect the integrated
candidate, but a successful source check **is not** full Node/Mocha integration
proof. The actual GitHub Actions matrix for the final exact commit must be
green. No release decision based on an earlier PR's checks.

See `docs/security/STRIPE_CHECKOUT_MODE_ENTITLEMENT_BOUNDARY_2026-10-09.md`
and `docs/security/SONARA_CANONICAL_ORIGIN_CHECKOUT_BOUNDARY_2026-10-08.md`.

References:
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks

## Controlled subscription-deletion recovery (additional P0 hardening)

The original strict `stripe_customers` binding prevented access grants from
unmapped customer IDs, but also prevented *revocation* when that customer
mapping had been legitimately deleted while a paid subscription record
remained. Stripe documents `customer.subscription.deleted` as an event sent
when the subscription ends. Customer mapping and cancellation reliability
must not be a circular dependency.

This integration now treats `customer.subscription.deleted` as a
**revocation-only** event when the object reports `status: "canceled"`.
Before any update it fetches one `billing_subscriptions` record using both
`provider=stripe` and the unique provider subscription ID. It requires an
exact match for the persisted provider customer ID and subscription ID,
a stored organization ID and canonical subscription plan. If the incoming
event still carries organization/plan/workspace metadata, those claims may
not conflict with the persisted record. Missing event metadata is recovered
only from the already persisted subscription row, never invented.

The saved organization/plan/workspace are then used to persist a canceled
subscription and a disabled entitlement, with the existing `provider_event_at`
stamp and SQL stale-event ordering protections unchanged. The fallback
**cannot** activate paid access, is **not** used by `subscription.updated`,
and cannot create a new tenant mapping. An absent, malformed, duplicate or
unreadable existing subscription fails for operational reconciliation; a
disagreement about provider customer or tenant identity fails without a write.

New tests prove recovery after customer-map deletion, recovery when incoming
metadata is absent, refusal of cross-tenant or conflicting plan/workspace
claims, refusal of ambiguous or missing historical rows, no fallback for
`subscription.updated`, and retry on entitlement write failure. In isolated
mocked callback execution, 16 selected billing tests passed. This remains
**unverified against real PostgreSQL, Stripe sandbox and full Mocha/CI**.

Follow-up release gates: simulate customer-map removal before cancellation in
Stripe test mode; verify `customer.subscription.deleted` status, event stamp,
real historical subscription ID and customer ID; check PostgREST select shape,
RLS and idempotent retry, stale event replay, and operator reconciliation on
missing legacy records. Do not backfill an account association from webhook
metadata alone.

Reference: https://docs.stripe.com/api/events/types


## P0 recurring-plan entitlement integrity and multiple subscriptions

Additional integration review found two authorization defects in
`lib/sonara-paid-entitlement.cjs`:

1. The customer-paid-access reader previously trusted `billing_entitlements`
   `status=active` for *recurring* subscription keys, even if the actual
   `billing_subscriptions` row had since been canceled. A late webhook or
   competing-subscription update can leave that projection stale.
2. Both the entitlement and active subscription reads ended in `limit=1`.
   With multiple valid single-workspace subscriptions, the first returned
   row could be for another workspace. It denied access even when a second
   active subscription entitled the customer to the requested product.

Implementation:

- Active subscription rows become the authoritative evidence for recurring
  plans. The `billing_entitlements` path still recognizes a separately
  granted historical non-recurring purchase (for example,
  `business_builder_one_time`) but never treats an active recurring projection
  as proof that the provider subscription remains active.
- Tenant, status and approved plan-key filters remain server-side in
  PostgREST; every returned row is checked against the requested product and
  its workspace policy. An unrelated workspace cannot unlock a product.
- The subscription scan is deterministic
  (`updated_at.desc,provider_subscription_ref.asc`) with a bounded
  `SUBSCRIPTION_SCAN_LIMIT = 101`. The extra row signals overflow.
  If no eligible subscription was found and the bound is exhausted,
  return HTTP 503 / `subscription_scan_incomplete` rather than falsely
  demanding a second payment. Never infer "unpaid" from a truncated list.
- Entitlement rows are uniquely keyed by `(organization_id, entitlement_key)`,
  so the query limit is proportional to the supplied catalog plan keys,
  plus an overflow sentinel.
- Malformed, out-of-filter or incomplete rows return an unreadable state.
  Database outages produce HTTP 503, never a mistaken upgrade demand.
- Competing subscription webhooks still write the `billing_entitlements`
  projection independently. This change corrects the **access enforcement
  read path**, not historical ledger drift or production reconciliation.
  Subscription writes retain their existing database stale-event guards.

Regression proof:

- Extended `tests/a-paying-customer-is-not-shown-a-paywall.test.js` to
  17 cases: stale recurring entitlement cannot grant access, surviving
  second active subscription opens its own workspace, wrong-workspace plans
  cannot open another product, matching all-three plan takes precedence
  over an unrelated single-workspace row, older/historical one-time access
  remains recognized, outages fail closed and overflow does not trigger
  an incorrect paywall.
- Updated `tests/database-query-contract.test.js` to insist on the
  new bounded query shapes, not `limit=1`. Verified both source-match
  assertions on the current integration branch.
- Executed all 17 actual entitlement-reader test callbacks using
  isolated repository-module loading and mock PostgREST data: 17/17 passed.
  **This is not project Mocha/Node runtime proof, PostgreSQL proof, or
  provider sandbox proof.**
- Research confirmation: Stripe emits `customer.subscription.updated`
  for subscription state changes and `customer.subscription.deleted`
  when a subscription ends. See https://docs.stripe.com/api/events/types.

Remaining gates: exact-head GitHub CI; `pnpm exec mocha` for both affected
tests and all existing paid-access tests; Node 22/24 lanes; real PostgreSQL
multiple-subscription reconciliation; stale-event replay; tenant-adversarial
RLS tests; Stripe sandbox cancellation/retry checks; and protected merge review.
No production migration, deployment, real payment, or website restore.


## P0 provider-created timestamp is mandatory on subscription webhooks

The database's existing `sonara_reject_stale_provider_event` trigger
(`20260903120000_stripe_events_cannot_arrive_backwards.sql`) rejects rows
whose non-null `provider_event_at` is older than the stored stamp. For
backwards compatibility with legacy writers, the SQL trigger deliberately
permits null timestamps. Previously `synchronizeBillingFromStripeEvent`
computed `providerEventAt = null` when Stripe's `event.created` was
missing, malformed or not numeric, so an unversioned webhook could bypass
the ordering guard and overwrite a newer cancellation.

**Implementation:** the runtime now requires `Number.isSafeInteger(event.created)`
and a positive, ISO-convertible Unix-second timestamp (maximum
253402300799) on `customer.subscription.created`, `.updated` and
`.deleted`. It returns `stripe_event_timestamp_invalid` before any DB
read/write for invalid stamps, including cancellation recovery. Validated
event time is always encoded as a non-null ISO `provider_event_at` on
both subscription and recurring entitlement upserts.

This does **not** change the already-applied migration or its compatibility
path for non-webhook legacy callers. It also does **not** solve same-second
event collisions (Stripe Event.created is recorded in seconds); do not
assert complete provider state ordering until a current-Stripe-state
reconciliation strategy and its integration proof exist.

**Regression coverage:** invalid timestamp forms (missing, null, string,
fractional, NaN, infinity, negative, zero, beyond supported range and unsafe
integer) for all three subscription event types; zero database operations;
valid timestamps persisted identically to both tables; correctly signed HTTP
delivery without a timestamp returns a retryable 503 without touching the
database. Existing webhook, period and contract fixtures now provide
explicit provider-created timestamps.

**Verification:** 18/18 selected actual billing test callbacks passed in an
isolated mock executor; 6/6 inspected JS files passed syntax compilation;
6/6 source contract assertions passed. Full Node/Mocha, real PostgreSQL
ordering replay, CI and sandbox lifecycle are unverified and remain release
blockers. An invalid provider event must be reconciled, not silently marked
processed.

Official Stripe Event object `created` field:
https://docs.stripe.com/api/events/object


## P0: same-second Stripe subscription conflict quarantine (proposed additive migration)

Stripe delivers Events without guaranteed order; the Event `created` value is
a Unix-second timestamp, not a monotonically increasing per-subscription
revision. The existing 20260903120000 migration rejects **older** timestamps,
but accepted distinct events bearing the **same** second. Arrival order could
reactivate a canceled subscription or leave an incorrect workspace/plan after
out-of-order concurrent delivery.

Proposed additive SQL migration:
`supabase/migrations/20261009090000_stripe_equal_second_conflicts_fail_closed.sql`.
It **replaces the existing row-lock trigger function** without modifying pinned
historical migration files or adding tables/permissions. This is **committed
source only**; it has not been applied to production.

The conservative rules are:

- A provider subscription ID with a non-null-stamped `canceled` state is
  terminal, even if an `active` webhook later arrives with a newer or
  identical whole-second stamp. Stripe cancellation requires a new subscription
  ID for a later new purchase.
- For equal timestamps, a disabled/nonactive subscription state takes precedence
  over an active/trialing state. A genuinely later provider update in the *next*
  second may recover `past_due` or other nonterminal statuses.
- If equal-second active snapshots disagree about organization, Stripe customer,
  plan, selected workspace or billing period, the record enters SONARA's
  internal `reconciliation_required` status. **This is not a statement that
  Stripe itself paused the subscription.** Paid access ignores this status.
  The row's metadata records `same_second_conflict=true`.
- The derived `billing_entitlements` projection likewise favors disabled on
  equal-second collisions and flags conflicting active sources. The actual
  `billing_subscriptions` rows remain authoritative for recurring access.
- Identical same-second replay stays idempotent. The old SQL behavior for null
  stamps is preserved only for legacy non-webhook callers. Webhook processing
  already refuses null `Event.created`.

Replay verification is wired to the disposable PostgreSQL migration runner in
`scripts/verify-migration-replay.mjs` and uses
`tests/sql/stripe-equal-second-conflicts.sql`. It checks 12 markers across
terminal cancellation, newer-stamped attempted resurrection, access degradation,
recovery on a later second, duplicate events, workspace/plan collisions,
entitlement collisions, and strictly older replay.

**Important residual limitation:** the first event at a timestamp can be
accepted before another conflicting event appears. A timestamp alone cannot
reconstruct the provider's actual order, so this is a **fail-closed collision
mitigation**, not definitive reconciliation. An authorized operational process
must retrieve the current subscription from Stripe, compare IDs/customer/plan/
entitlements, and resolve quarantined rows with tenant-safe, auditable action.
A single late webhook with an identical timestamp cannot clear a quarantine.

**Release gates:**
1. Execute the disposable **real PostgreSQL** migration replay and all tests,
   not only static source contracts; measure the effect of the function
   replacement on historical migration history and the latest schema.
2. Exercise equal-second and concurrent delivery sequences in isolated
   PostgreSQL, then with Stripe test-mode events. Include a failed transaction,
   retry and cancelled-subscription ID that remains terminal.
3. Verify alerting for rows where `metadata->>'same_second_conflict'='true'`
   and `status='reconciliation_required'`, and design a human-approved
   reconciliation runbook that does not invent tenant/customer associations.
4. Compare pending SQL migration IDs/checksums against the **correct**
   Supabase project, capture rollout/rollback evidence, obtain owner approval
   before running production DDL, and require green exact-head protected CI.

Research:
- https://docs.stripe.com/api/events/object
- https://docs.stripe.com/api/subscriptions/object
- https://docs.stripe.com/api/subscriptions/retrieve


## Read-only Stripe reconciliation inspector (additional engineering execution)

**Implemented but not executed against customer systems:**
- `lib/sonara-stripe-reconciliation.cjs` — tenant-pinned,
  provider-backed read-only inspection with explicit `GET` and
  `redirect: "error"` on both database and Stripe requests.
- `scripts/inspect-stripe-subscription.mjs` — CLI requiring the exact
  existing SONARA organization UUID and provider subscription ID;
  no mutating endpoints, event timestamp generation, or hidden background job.
- `tests/stripe-reconciliation-readonly.test.js` — 13 adversarial
  tests (12 selected module tests executed in a mocked JS harness, passed
  12/12; CLI's real Node import test requires Node/Mocha).

**Operator usage** (only after test credentials, customer permission and
release-gate approval; never paste secret keys into a command):
```sh
# Existing secure environment configuration:
# NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
# and STRIPE_PRICE_WORKSPACE_MONTHLY / ... canonical price keys.
node scripts/inspect-stripe-subscription.mjs \
  --organization=00000000-0000-4000-8000-000000000051 \
  --subscription=sub_test123

# Only for an explicitly authorized READ-ONLY live diagnostic:
node scripts/inspect-stripe-subscription.mjs \
  --organization=<existing-organization-uuid> \
  --subscription=<existing-subscription-id> \
  --allow-live-readonly
```

**Safety contracts:** input must be a valid UUID and Stripe subscription ID;
the database URL must be an origin-only HTTPS value; the recorded subscription
must exist uniquely in precisely the requested organization and carry an
exact immutable Stripe customer ID. The canonical catalog plan must be a
subscription SKU and its configured Stripe price must match exactly the
single provider subscription item at quantity 1. Provider customer and
conflicting metadata must never reassign the customer to another tenant.

The inspector refuses all network traffic when a live Stripe key is present
without `--allow-live-readonly`. It returns only bounded, non-secret status
and decision fields: `consistent`, `reconciliation_required`,
`revocation_review_priority`, `subscription_status_differs`, or a
coded inspection refusal. It never writes billing tables, triggers a refund,
executes a cancellation, updates metadata or activates access.

**Operational workflow:** run only against a known test tenant initially,
capture the decision and correlate to a Stripe Dashboard test-mode
subscription. For any mismatch or quarantine, verify tenant identity, price,
and the provider's current record. Record an operator-approved repair ticket,
then design separately reviewed transactional reconciliation. Do **not**
run direct SQL updates or manufacture newer Stripe timestamps to clear
`same_second_conflict`. The inspector is intentionally diagnosis-only.

Remaining evidence: focused Mocha with native Node globals, actual SQL
migration replay with the new conflict fixture, Stripe test-mode and
PostgREST sandbox retrieval, restricted-key authorization validation,
branch-protection checks and an owner-approved rollback/restore exercise.
The authorized remote desktop was offline when queried; there is no
verified PostgreSQL runtime for this execution.
Stripe reference: https://docs.stripe.com/api/subscriptions/retrieve
