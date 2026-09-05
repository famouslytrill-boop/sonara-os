# SONARA One Manual Dashboard Setup

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

### The three price env vars the server actually reads

These names come from the plan table in `server.js`. Setting any other name has
no effect — the value is simply never read, and checkout reports that payments
are not set up with no indication of why.

| Plan    | Env var                      | Live Price ID                     | Amount  |
| ------- | ---------------------------- | --------------------------------- | ------- |
| Starter | `STRIPE_PRICE_STARTER_MONTHLY` | `price_1TjCkh0dKtlEU3lAsSDgFblT` | $7/mo   |
| Core    | `STRIPE_PRICE_CORE_MONTHLY`    | `price_1TjClL0dKtlEU3lAXi7RHc5j` | $19/mo  |
| Pro     | `STRIPE_PRICE_PRO_MONTHLY`     | `price_1TjClr0dKtlEU3lA0EWKaSBS` | $39/mo  |
| One workspace | `STRIPE_PRICE_WORKSPACE_MONTHLY` | `price_1U47yP0dKtlEU3lAvkakKNgm` | $19/mo |
| All three | `STRIPE_PRICE_ALL_THREE_MONTHLY` | `price_1U47yd0dKtlEU3lAeTBQ8o3D` | $39/mo |
| Team    | `STRIPE_PRICE_TEAM_MONTHLY`    | `price_1U47yp0dKtlEU3lAhPqsCS7r` | $79/mo |
| One workspace, yearly | `STRIPE_PRICE_WORKSPACE_ANNUAL` | *not created yet* | $190/yr |
| All three, yearly | `STRIPE_PRICE_ALL_THREE_ANNUAL` | *not created yet* | $390/yr |
| Team, yearly | `STRIPE_PRICE_TEAM_ANNUAL` | *not created yet* | $790/yr |

The last three are annual billing, added 5 September 2026 — two months free
against the monthly price. **Their Stripe prices do not exist yet**, unlike the
breadth ladder above them, so these are two steps rather than one: create a
recurring yearly price at each amount (lookup keys `sonara_workspace_annual`,
`sonara_all_three_annual`, `sonara_team_annual` keep them findable without this
table), then set the variables. Until then those plans are not shown at all —
the monthly twin already sells the same product, so an unbuyable yearly card
would tell a customer nothing. See `docs/pricing/2026-09-05-PRICING-STRATEGY.md`
for why two months free rather than a deeper discount.

The bottom three are the breadth ladder, and their prices now exist in the live
account — created 13 August 2026, with lookup keys `sonara_workspace_monthly`,
`sonara_all_three_monthly` and `sonara_team_monthly` so they can be found again
without this table. Creating them charges nobody; a Stripe price is inert until
a checkout session names it.

**The one step left is yours:** set those three variables in the Vercel project
and redeploy. Until they are set, those plans show as not open
for checkout. The three above them keep working exactly as they are -- Stripe
prices are immutable, so an existing subscriber goes on paying what they agreed
to and nobody is migrated by a deploy.

Business Builder setup ($197) is quoted, not sold through checkout, so it has no
price env var. It keeps a Stripe price (`price_1TjCnv0dKtlEU3lAzjxJnhLK`) only
so an invoice can be raised by hand.

### Retired prices — do not use

These were the original three plans. Both the products and the prices are
archived in Stripe as of 2026-08-04, so a checkout session built on them fails.

| Retired plan | Price ID                          | Amount    |
| ------------ | --------------------------------- | --------- |
| Creator      | `price_1TS4jf0dKtlEU3lAgEX2tjV2` | $9.99/mo  |
| Pro (old)    | `price_1TS4l70dKtlEU3lAGmuQmmYO` | $19.99/mo |
| Label        | `price_1TS4lc0dKtlEU3lAy98zUnFy` | $49.99/mo |

Until 2026-08-04 this file listed the first two as the required values, under
env var names (`STRIPE_CREATOR_MONTHLY_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`)
that the server has never read, with the IDs mistranscribed — capital `I` where
the real IDs have lowercase `l`. Anyone who followed it configured three
variables that did nothing, pointing at two prices that no longer sell. It is
recorded here rather than deleted so that a stale copy of the old instructions
can be recognised for what it is.

Archiving a price does not cancel a subscription already running on it. One
subscription ever used these, and it was cancelled in April 2026, so nothing was
billing when they were archived.

## Vercel

Add these Vercel Environment Variables. All are server-side only except the
publishable key.

- `PUBLIC_APP_URL` = https://sonaraindustries.com
- `STRIPE_PUBLISHABLE_KEY` = your live publishable value (`pk_live_...`)
- `STRIPE_SECRET_KEY` = your newly rotated live server value (`sk_live_...`)
- `STRIPE_WEBHOOK_SECRET` = your webhook signing value (`whsec_...`)
- `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_CORE_MONTHLY`,
  `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_WORKSPACE_MONTHLY`,
  `STRIPE_PRICE_ALL_THREE_MONTHLY`, `STRIPE_PRICE_TEAM_MONTHLY` = the Price IDs from the table above

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
