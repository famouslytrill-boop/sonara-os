# Stripe Checkout mode-to-entitlement authorization boundary

**Status:** Draft engineering fix, awaiting exact-head CI and independent review. No production or live-money action.

## Verified issue and impact

`lib/sonara-billing.cjs` previously wrote a `billing_entitlements`
record with `status: active` whenever a signed
`checkout.session.completed` or `checkout.session.async_payment_succeeded`
event reported `mode: payment` and `payment_status: paid`, as long as a
`metadata.plan` string was present. It did **not** enforce that the named
plan was actually a one-time Checkout product. A payment-mode event carrying
`workspace_monthly`, `all_three_monthly` or `team_monthly` could therefore
write an entitlement with no subscription lifecycle guaranteeing ongoing
collection. This is an authorization-contract defect even though webhook
signatures are checked separately.

The current canonical `STRIPE_PLANS` defines only subscription-mode
self-service paid products, with a retired/quoted setup product. No current
self-service one-time SKU qualifies for automatic Checkout fulfillment.
Historical paid orders need reconciliation against provider and customer
records; they must not be auto-upgraded to a subscription entitlement by
pretending their mode is a subscription.

## Code behavior

- Ignore subscription-mode Checkout completion events here. The
  `customer.subscription.*` handler retains responsibility for paid
  subscription state and cancellation.
- For a payment-mode event with `payment_status: paid`, refuse missing
  session ID, organization ID or plan key with `checkout_metadata_missing`.
- Validate the plan key against the canonical catalog **before** any purchase
  or entitlement database write.
- The plan must explicitly declare `mode: "payment"` and be neither
  `quoted` nor `retired`. Otherwise refuse with
  `checkout_plan_mode_mismatch` and return a retryable result.
- This does **not** enable arbitrary one-time items. A future one-time
  product still needs approved catalog, Stripe price, customer mapping,
  fulfillment, refund and rights rules, plus regression and sandbox proof.
- The webhook HTTP handler treats `{ok:false}` as a 503, so unrecognized
  paid events cannot silently be logged as successfully fulfilled. Operators
  must reconcile unsupported historical events; do not ignore persistent
  retries without evidence.

## Test matrix

`tests/billing-delivery-reliability.test.js` covers:
1. A payment-mode receipt naming recurring monthly or yearly plans is
   refused before **any** database request.
2. Unknown, free and retired/quoted plans are refused.
3. Missing checkout ID, organization or plan metadata is not acknowledged.
4. A hypothetical explicitly configured, non-retired one-time SKU still
   writes the purchase and entitlement after a paid event.
5. Failure to persist the purchase leaves the event retryable.
6. Subscription-mode and unpaid Checkout Sessions never trigger one-time
   fulfillment.

The isolated sandbox function harness is not a full integration test.
Required focused test: `pnpm exec mocha tests/billing-delivery-reliability.test.js`.
Required full checks: `pnpm run verify:launch`, generated inventory checks,
tenant-adversarial RLS, migration replay and exact-head CI.

## Research

Stripe Checkout Session mode and line-item behavior:
https://docs.stripe.com/api/checkout/sessions/create

Stripe webhook handling and event ordering:
https://docs.stripe.com/webhooks

## Integration and release

This branch is based on `main` and edits `lib/sonara-billing.cjs`, which is
also edited by draft PR #555 (canonical-origin and billing-summary reliability).
Rebase or intentionally integrate after #555, preserving **both** the URL
boundary and the mode-to-entitlement boundary. Do not merge an unresolved
overlap or bypass branch protection. PR #558 for shared customer billing
navigation is separately open and must be reviewed for compatibility.

No production deployment, paid subscription transition, database migration,
tenant state change, live charge, merge or website unpause was performed.


## Customer-to-tenant ownership verification (next engineering gate)

A valid Stripe signature authenticates the event sender, not the tenant selected
by `metadata.organization_id`. Provider metadata is contextual. Before
`billing_subscriptions`, `purchases` or `billing_entitlements` changes:

1. Require an unexpanded Stripe Customer ID with the `cus_` identifier shape.
2. Read the server-side `public.stripe_customers` customer mapping by its
   globally unique `stripe_customer_id`, limiting the result to two rows.
3. Accept **exactly one** parsed row where the stored customer ID and
   organization ID both match the webhook payload and stored owner tenant.
4. When a paid one-time Checkout Session has `metadata.user_id`, match it
   against the stored mapping's `user_id` as well.
5. Reject absent customer identifiers, missing or cross-tenant mappings,
   multiple rows, HTTP/database outages and malformed JSON **before any writes**.
6. Never auto-create customer associations using values from inbound webhook
   metadata. Creation still belongs to the authenticated checkout flow.

Source: `verifyWebhookCustomerBinding` in `lib/sonara-billing.cjs`.
The table already has a unique `stripe_customer_id` constraint in
`supabase/migrations/20260619035605_functional_saas_operational_tables.sql`,
so this step adds no database migration.

New adversarial tests check forged organization metadata, conflicting
one-time checkout users, duplicate or absent customer mappings, malformed
HTTP-200 responses, network failure and cancellation-path refusal on mapping
failure. Existing subscription, Stripe webhook HTTP retry, billing period and
shared checkout tests now supply explicit fake customer mappings.

**Failure semantics:** the signed webhook HTTP handler returns a retryable 503
for an unresolved customer mapping. It is an operational incident to reconcile
through the real provider and internal customer records; ignoring it is unsafe.
A missing customer association on a canceled subscription may delay revocation
until recovered, so rollback/replay monitoring remains a launch gate.

Research: Stripe's metadata documentation explicitly says metadata is not
used by Stripe to authorize charges:
https://docs.stripe.com/api/metadata

**Verification:** isolated execution of ten relevant real test callbacks
passed; JavaScript syntax was checked for five changed runtime/test files.
These results are not a full Mocha or end-to-end payment test. All exact-head
CI, RLS adversarial evidence, sandbox cancellation/recovery and release gates
must pass before merge/deploy.
