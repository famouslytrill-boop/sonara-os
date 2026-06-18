# Stripe Setup

Do not commit real Stripe keys or price IDs. Configure them only in Vercel Production, Vercel Preview, or a local `.env.local` file that is not committed.

## Products and Prices

Create these launch products and prices in Stripe:

| Plan                    |             Price | Mode                           | Environment variable        |
| ----------------------- | ----------------: | ------------------------------ | --------------------------- |
| Free                    |                $0 | No checkout                    | none                        |
| SONARA One Starter      |             $9/mo | Recurring monthly subscription | `STRIPE_PRICE_STARTER`      |
| SONARA One Core         |            $29/mo | Recurring monthly subscription | `STRIPE_PRICE_CORE`         |
| Creator Studio          |            $29/mo | Recurring monthly subscription | `STRIPE_PRICE_CREATOR`      |
| SONARA One Growth       |            $59/mo | Recurring monthly subscription | `STRIPE_PRICE_GROWTH`       |
| SONARA One Pro          |            $99/mo | Recurring monthly subscription | `STRIPE_PRICE_PRO`          |
| SONARA One Agency/Scale | $199/mo or custom | Recurring monthly subscription | `STRIPE_PRICE_AGENCY_SCALE` |
| Profile Setup           |               $99 | One-time payment               | `STRIPE_PRICE_SETUP_99`     |
| Business Launch Setup   |              $299 | One-time payment               | `STRIPE_PRICE_SETUP_299`    |
| Premium Setup           |              $499 | One-time payment               | `STRIPE_PRICE_SETUP_499`    |
| Complete Launch Setup   |              $999 | One-time payment               | `STRIPE_PRICE_SETUP_999`    |

`STRIPE_PRICE_SONARA_ONE_STARTER_MONTHLY`, `STRIPE_PRICE_SONARA_ONE_CORE_MONTHLY`, and `STRIPE_PRICE_CREATOR_STUDIO_MONTHLY` are accepted aliases for compatibility, but the centralized catalog uses `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_CORE`, and `STRIPE_PRICE_CREATOR`.

Every Stripe price variable must contain a Stripe Price ID that starts with `price_`. Values that start with `$`, `prod_`, `sk_`, `pk_`, `whsec_`, or contain `/mo` are invalid and keep checkout disabled.

## Required Secret Values

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `APP_URL` or `NEXT_PUBLIC_APP_URL`

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are server-only. Never expose them in static HTML, client code, docs with real values, screenshots, or support messages.

## Checkout

The pricing page posts only the plan slug to:

```text
/api/stripe/checkout
```

The server resolves the plan slug to an environment-backed `price_` ID, chooses `subscription` for recurring plans and `payment` for one-time setup services, and creates a Stripe Checkout Session. The browser never sends or receives Stripe secret values.

## Webhook

Create a Stripe webhook endpoint:

```text
https://sonaraindustries.com/api/stripe/webhook
```

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Webhook processing must verify `STRIPE_WEBHOOK_SECRET` against the raw request body before trusting the event. Subscription database updates must be idempotent by Stripe event ID.

## Local Verification

Load the environment values and run:

```sh
pnpm run check:stripe-prices
```

Missing values or malformed values must be fixed in the environment provider, not hardcoded in source code.
