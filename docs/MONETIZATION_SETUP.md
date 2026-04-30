# Monetization Setup

Use real Stripe products only. Do not wire fake payments or fake active subscriptions.

## Stripe Setup

1. Create a Stripe account.
2. Create monthly subscription products:
   - SONARA OS™ Creator
   - SONARA OS™ Pro
   - SONARA OS™ Label
3. Copy the monthly recurring price IDs.
4. Add the required environment variables in Vercel:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_CREATOR_MONTHLY_PRICE_ID=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_LABEL_MONTHLY_PRICE_ID=
NEXT_PUBLIC_APP_URL=https://sonaraindustries.com
```

5. Add the webhook endpoint:

```text
https://sonaraindustries.com/api/stripe/webhook
```

6. Subscribe the webhook to these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
7. Run the Supabase subscription migration.
8. Test checkout success, cancel, subscription update, and deletion in Stripe test mode.
9. Repeat in live mode only after test mode passes.

## Safety Rules

- Do not commit secrets.
- Do not place environment variables in `vercel.json`.
- Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` server-only.
- Web Stripe subscriptions are for the website and PWA.
- Later Android native subscriptions may require Google Play Billing.
- Later iOS native subscriptions may require Apple IAP.
