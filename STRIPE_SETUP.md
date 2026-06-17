# Stripe Setup

Checkout is enabled per plan when the server Stripe key and that plan's Stripe price ID are configured. Do not hardcode price IDs or live keys.

## Mode

Use Stripe test mode for verification. Switch to live mode only after products, prices, webhooks, legal review, and owner approval are complete.

## Products and prices

Create these prices in Stripe and copy the price IDs into Vercel:

- Starter monthly: $7/month -> `STRIPE_PRICE_STARTER_MONTHLY`
- Core monthly: $19/month -> `STRIPE_PRICE_CORE_MONTHLY`
- Pro monthly: $39/month -> `STRIPE_PRICE_PRO_MONTHLY`
- Business Builder one-time setup: $99 -> `STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME`

Accepted aliases for the house-of-brands naming model:

- Business Builder monthly -> `STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY`
- Creator Studio monthly -> `STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY`
- Growth Studio monthly -> `STRIPE_PRICE_ID_GROWTH_STUDIO_MONTHLY`
- Business Builder one-time setup -> `STRIPE_PRICE_ID_BUSINESS_BUILDER_ONETIME`

Do not create $1-$3 paid tiers unless the owner explicitly accepts the payment-fee tradeoff.

Each copied value must start with `price_`. Do not paste secret keys (`sk_live_` or `sk_test_`), products (`prod_`), or customers (`cus_`) into price variables.

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
- `STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY` optional alias
- `STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY` optional alias
- `STRIPE_PRICE_ID_GROWTH_STUDIO_MONTHLY` optional alias
- `STRIPE_PRICE_ID_BUSINESS_BUILDER_ONETIME` optional alias
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`

Recommended production redirects:

- `STRIPE_SUCCESS_URL=https://sonaraindustries.com/account`
- `STRIPE_CANCEL_URL=https://sonaraindustries.com/pricing`

If success/cancel URLs are absent, the app falls back to `APP_URL` or `PUBLIC_SITE_URL` with `/account` and `/pricing`.

## Readiness behavior

- Missing or invalid `STRIPE_SECRET_KEY` blocks Checkout Session creation.
- Missing or invalid `STRIPE_WEBHOOK_SECRET` blocks webhook processing but does not block Checkout Session creation.
- Missing optional plan price IDs only block those specific plans.
