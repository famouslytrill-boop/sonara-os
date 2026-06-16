# Stripe Setup

Checkout is blocked unless all required Stripe variables exist. Do not hardcode price IDs or live keys.

## Mode

Use Stripe test mode for verification. Switch to live mode only after products, prices, webhooks, legal review, and owner approval are complete.

## Products and prices

Create these prices in Stripe and copy the price IDs into Vercel:

- Starter monthly: $7/month -> `STRIPE_PRICE_STARTER_MONTHLY`
- Core monthly: $19/month -> `STRIPE_PRICE_CORE_MONTHLY`
- Pro monthly: $39/month -> `STRIPE_PRICE_PRO_MONTHLY`
- Business Builder one-time setup: $99 -> `STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME`

Do not create $1-$3 paid tiers unless the owner explicitly accepts the payment-fee tradeoff.

## Checkout endpoint

Server endpoint:

- `POST /api/checkout/session`

Valid plans:

- `starter_monthly`
- `core_monthly`
- `pro_monthly`
- `business_builder_one_time`

## Webhook endpoint

Stripe webhook URL:

- `https://sonaraindustries.com/api/webhooks/stripe`

Required events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Set `STRIPE_WEBHOOK_SECRET` from the webhook signing secret. The app verifies signatures before processing events.

## Required Vercel variables

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_CORE_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
