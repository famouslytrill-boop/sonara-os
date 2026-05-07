# Monetization Plan

SONARA OSâ„¢ monetization stays web-first and Stripe-first. Checkout must stay disabled until real products, prices, webhooks, and Supabase subscription storage are configured.

## Subscription Tiers

- SONARA OSâ„¢ Free: $0/month
- SONARA OSâ„¢ Creator: $9.99/month
- SONARA OSâ„¢ Pro: $19.99/month
- SONARA OSâ„¢ Label: $49.99/month

## Entitlement Rules

- Free: basic prompt builder and starter project planning.
- Creator: advanced prompt builder, Runtime Target Engine, and External Generator Settings.
- Pro: full bundle exports, sound rights exports, release packs, and Vault workflow tools.
- Label: brand governance, label workspace, and store product workflow.

## Stripe Environment Variables

Add these names in Vercel, with real values only in the dashboard: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_CREATOR_MONTHLY_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_LABEL_MONTHLY_PRICE_ID`, and `NEXT_PUBLIC_APP_URL`.

## Launch Requirements

- Create Stripe subscription products and recurring monthly prices.
- Add environment variables in Vercel, not in `vercel.json`.
- Configure the webhook endpoint at `https://sonaraindustries.com/api/stripe/webhook`.
- Subscribe the webhook to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
- Run the Supabase subscription migration before enabling paid checkout.
- Test checkout, cancel, webhook update, and billing-page states in Stripe test mode.

## Later Native Billing

Web Stripe subscriptions are for the website and PWA. Native Android digital subscriptions may require Google Play Billing, and native iOS digital subscriptions may require Apple IAP. Do not route around app store billing rules inside native apps.
# 2026 Monetization Update

Subscriptions:

- SONARA OSâ„¢ Free: $0
- SONARA OSâ„¢ Creator: $9.99/mo
- SONARA OSâ„¢ Pro: $19.99/mo
- SONARA OSâ„¢ Label: $49.99/mo

Future optional:

- SONARA OSâ„¢ Studio: $99/mo future
- Enterprise: custom/contact us

Store products:

- Prompt Pack Export
- Release Readiness Bundle
- Metadata + Rights Sheet Export
- Full Project Bundle
- Creator Brand Kit
- OBS Broadcast Kit Export
- Personal Vault Kit Export
- Marketplace Listing Builder
- Genre Pack Metadata Bundle
- Vault Stack Export

Safe to sell now:

- Subscriptions only after Stripe env vars, products/prices, checkout, webhook, and Supabase subscription table are verified.
- Export products only after product files, license terms, refund/support notes, and rights status are complete.

Metadata-only:

- Open sound discovery.
- Genre pack metadata.
- Future marketplace listing builder.

Blocked until license review:

- Any raw sound export with unknown, non-commercial, research-only, music-use-only, no-derivatives, or unproven commercial-license rights.
