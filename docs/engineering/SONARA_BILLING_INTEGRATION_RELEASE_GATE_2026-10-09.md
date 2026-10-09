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
