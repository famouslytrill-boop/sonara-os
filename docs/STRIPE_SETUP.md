# Stripe Setup

SONARA uses Stripe-hosted flows for billing. The app must not store raw card data or CVV.

## Required Values

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY` server-only
- `STRIPE_WEBHOOK_SECRET` server-only
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_CORE`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_AGENCY`
- `STRIPE_PRICE_SETUP_99`
- `STRIPE_PRICE_SETUP_299`
- `STRIPE_PRICE_SETUP_499`

## Local Webhook Test

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
pnpm run verify:stripe
```

The webhook route verifies Stripe signatures before processing events. Do not fulfill subscriptions or entitlements from the success URL alone.
Webhook events are recorded to `webhook_events` when Supabase admin configuration is available. If Supabase is not configured, signature verification still runs and processing is safely limited to the current route behavior.

## Supported Events

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `charge.refunded`

Refunds, payout changes, live pricing changes, and marketplace payout work require owner approval. Stripe Connect and third-party payouts are not part of MVP launch.
