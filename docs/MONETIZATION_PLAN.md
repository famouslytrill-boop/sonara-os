# Monetization Plan

SONARA OS™ monetization stays web-first and Stripe-first. Checkout must stay disabled until real products, prices, webhooks, and Supabase subscription storage are configured.

## Subscription Tiers

- SONARA OS™ Free: $0/month
- SONARA OS™ Creator: $9.99/month
- SONARA OS™ Pro: $19.99/month
- SONARA OS™ Label: $49.99/month

## Entitlement Rules

- Free: basic prompt builder and starter project planning.
- Creator: advanced prompt builder, Runtime Target Engine, and External Generator Settings.
- Pro: full bundle exports, sound rights exports, release packs, and Vault workflow tools.
- Label: brand governance, label workspace, and store product workflow.

## Stripe Environment Variables

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_CREATOR_MONTHLY_PRICE_ID=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_LABEL_MONTHLY_PRICE_ID=
NEXT_PUBLIC_APP_URL=https://sonaraindustries.com
```

## Launch Requirements

- Create Stripe subscription products and recurring monthly prices.
- Add environment variables in Vercel, not in `vercel.json`.
- Configure the webhook endpoint at `https://sonaraindustries.com/api/stripe/webhook`.
- Subscribe the webhook to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
- Run the Supabase subscription migration before enabling paid checkout.
- Test checkout, cancel, webhook update, and billing-page states in Stripe test mode.

## Later Native Billing

Web Stripe subscriptions are for the website and PWA. Native Android digital subscriptions may require Google Play Billing, and native iOS digital subscriptions may require Apple IAP. Do not route around app store billing rules inside native apps.
