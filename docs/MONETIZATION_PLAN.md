# Monetization Plan

SONARA OS monetization should remain disabled until real Stripe products, prices, and webhooks are configured.

## Product Tiers

- SONARA OS™ Free
- SONARA OS™ Creator
- SONARA OS™ Pro
- SONARA OS™ Label

## Current State

- Stripe SDK is installed.
- Checkout route exists and returns a safe disabled response when keys or price IDs are missing.
- No fake payment success state should be shown.
- Subscription and kit price IDs must be configured in Vercel before checkout is promoted.

## Required Stripe Environment Variables

```env
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_PRO_ARTIST_MONTHLY=
STRIPE_PRICE_STUDIO_MONTHLY=
STRIPE_PRICE_STARTER_PROMPT_PACK=
STRIPE_PRICE_VISUAL_IDENTITY_PROMPT_PACK=
STRIPE_PRICE_AR_MARKET_AUDIT_KIT=
STRIPE_PRICE_RELEASE_PLANNER_KIT=
STRIPE_PRICE_ARTIST_OS_PRO_KIT=
STRIPE_PRICE_ALBUM_BUILDER_SYSTEM=
STRIPE_PRICE_LOCAL_BUSINESS_MARKETING_KIT=
STRIPE_PRICE_REVENUE_PATHWAY_BLUEPRINT=
```

## Before Launching Paid Checkout

- [ ] Create products and prices in Stripe test mode.
- [ ] Add Vercel environment variables.
- [ ] Add webhook endpoint and set `STRIPE_WEBHOOK_SECRET`.
- [ ] Test checkout success and cancellation.
- [ ] Test webhook signature verification.
- [ ] Test subscription state persistence after Supabase billing tables are connected.
- [ ] Repeat in live mode only after test mode passes.
