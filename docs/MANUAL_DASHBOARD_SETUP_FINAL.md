# SONARA One Manual Dashboard Setup

Review by: 2026-12-18

This checklist is for dashboard setup only. Do not paste real secret values into
source code, docs, screenshots, GitHub, or chat.

Stripe **Price IDs are not secrets** — they appear in every checkout URL — so
they are written out in full below. Everything under "Never do this" is.

## Stripe

1. Rotate or revoke any exposed Stripe live secret key.
2. Create a new live secret key.
3. Store the new live secret key only in Vercel as `STRIPE_SECRET_KEY`.
4. Copy Stripe **Price** IDs (`price_...`), not Product IDs (`prod_...`).
5. The env var **name** goes in the key field and the Price ID goes in the value
   field. `price_...` is never an env var name.

### Canonical price environment variables

These names come from `lib/sonara-stripe-plans.cjs`. The active live Stripe
account was read on 18 September 2026 before this table was updated. Each Price
below is active, recurring at the interval shown, charges the amount the SONARA
pricing table advertises, and belongs to an active Stripe Product.

| Plan | Env var | Live Price ID | Amount |
| --- | --- | --- | --- |
| One workspace | `STRIPE_PRICE_WORKSPACE_MONTHLY` | `price_1UDcAR0dKtlEU3lA6xBfzRYu` | $29/mo |
| All three | `STRIPE_PRICE_ALL_THREE_MONTHLY` | `price_1UDcB60dKtlEU3lAiTaUfXLI` | $59/mo |
| Team | `STRIPE_PRICE_TEAM_MONTHLY` | `price_1UDcC60dKtlEU3lABcH8EVw6` | $109/mo |
| One workspace, yearly | `STRIPE_PRICE_WORKSPACE_ANNUAL` | `price_1UDcdq0dKtlEU3lA6bTBV7Pk` | $290/yr |
| All three, yearly | `STRIPE_PRICE_ALL_THREE_ANNUAL` | `price_1UDcfA0dKtlEU3lAaqioX8tE` | $590/yr |
| Team, yearly | `STRIPE_PRICE_TEAM_ANNUAL` | `price_1UDcg80dKtlEU3lAoLjca1r0` | $1090/yr |

A Stripe Price is immutable. If an advertised amount changes, create a new Price
and repoint the matching canonical variable; do not change the plan key and do
not restore a retired alias. `scripts/verify-stripe-env.mjs --require-live`
checks the live amount, interval, and product state before a controlled
production deployment.

Business Builder setup remains quoted rather than self-serve. It is not part of
the recurring canonical ladder and has no checkout price environment variable.

### Retired prices

These Price IDs are **audit-only**. They are archived in Stripe and must not be
configured as active checkout values, reactivated, or copied into the canonical
price environment variables. They remain here only so an operator can recognize
and remove a stale production value:

- `price_1TS4jf0dKtlEU3lAgEX2tjV2`
- `price_1TS4l70dKtlEU3lAGmuQmmYO`
- `price_1TS4lc0dKtlEU3lAy98zUnFy`

Legacy plan names and aliases remain in `docs/archive/legacy-names.md` for
historical audit. Active setup instructions above use only the canonical price
ladder.

## Vercel

Add these Vercel Environment Variables. All are server-side only except the
publishable key.

- `PUBLIC_APP_URL` = https://sonaraindustries.com
- `STRIPE_PUBLISHABLE_KEY` = your live publishable value (`pk_live_...`)
- `STRIPE_SECRET_KEY` = your newly rotated live server value (`sk_live_...`)
- `STRIPE_WEBHOOK_SECRET` = your webhook signing value (`whsec_...`)
- `STRIPE_PRICE_WORKSPACE_MONTHLY`, `STRIPE_PRICE_ALL_THREE_MONTHLY`,
  `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_WORKSPACE_ANNUAL`,
  `STRIPE_PRICE_ALL_THREE_ANNUAL`, `STRIPE_PRICE_TEAM_ANNUAL` = the canonical Price IDs from the table above

After env var changes, redeploy without build cache.

## Stripe webhook

Endpoint, as configured in the live account:

`https://sonaraindustries.com/api/webhooks/stripe`

`/api/stripe/webhook` is served as well and reaches the same handler, so an
older endpoint configured at that path keeps working. New endpoints should use
the first form.

Events. These four are the complete set the handler acts on — see
`synchronizeBillingFromStripeEvent` in `lib/sonara-billing.cjs`, which returns
`ignored` for anything else:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Subscribing to more is harmless but pointless. Until 2026-08-04 this file listed
`invoice.payment_succeeded` and `invoice.payment_failed`, which no code has ever
handled; the live endpoint carries `payment_intent.payment_failed` and
`charge.failed`, which are likewise ignored. If failed payments should do
something, that is a handler change, not a dashboard change — adding the event
here would only deliver it to a branch that drops it.

`/readiness` reports payment updates as configured when `STRIPE_WEBHOOK_SECRET`
is present. That is a check on the environment variable, not a check on Stripe
having a live endpoint pointed at this URL — the two can disagree silently, so
confirm the endpoint in the Stripe dashboard reads `enabled` and is delivering.

## Supabase

- Apply the migrations in `supabase/migrations/`.
- Confirm RLS is enabled on every table.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code.

## If production returns 403

- Check Vercel Deployment Protection.
- Check Project → Settings → Domains.
- Confirm the custom domain points to this project.
- Check middleware and auth rules.

## Never do this

- Never paste `sk_live_`, `whsec_`, or `SUPABASE_SERVICE_ROLE_KEY` into a chat,
  an issue, or a commit.
- Never commit `.env.local`.
- Never put real secrets in `vercel.json`.
- Never put real secrets in screenshots.
