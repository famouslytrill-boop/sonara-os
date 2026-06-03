# Stripe Production Setup

Stripe is server-side only. Do not expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`.

## Required Vercel Env

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_CORE`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_AGENCY`

## Webhook Endpoint

Create a Stripe webhook endpoint:

- URL: `https://your-production-domain.com/api/stripe/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in Vercel.

## Test Mode Checklist

1. Use Stripe test keys.
2. Confirm `/pricing` links to checkout only for paid tiers.
3. Sign in as a test user.
4. Start checkout.
5. Complete checkout with Stripe test card.
6. Confirm Stripe webhook is received.
7. Confirm duplicate webhook events are ignored through `webhook_events`.
8. Confirm subscription state updates in Supabase.
9. Confirm customer portal opens only for the signed-in user's Stripe customer.

## Live Mode Checklist

Move to live mode only after test mode passes. Confirm products, prices, webhook endpoint, tax settings, support contacts, refund policy, and legal review.
