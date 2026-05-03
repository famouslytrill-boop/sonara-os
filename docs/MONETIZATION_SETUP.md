# Monetization Setup

<<<<<<< HEAD
Web payments should use Stripe Checkout after manual setup is complete.

Required steps:

1. Rotate any exposed Stripe key.
2. Create Stripe products and monthly prices for Creator, Pro, and Label.
3. Add Stripe environment variables in the Vercel dashboard.
4. Add the production webhook endpoint: `https://sonaraindustries.com/api/stripe/webhook`.
5. Test checkout in Stripe test mode first.
6. Test webhook delivery before granting entitlements.
7. Do not commit secrets.

Until checkout and webhooks are verified, paid CTAs must stay in setup-required mode.

See `docs/STRIPE_LIVE_SETUP.md` for the exact live setup checklist.
=======
Use real Stripe products only. Do not wire fake payments or fake active subscriptions.

## Stripe Setup

1. Create a Stripe account.
2. Create monthly subscription products:
   - SONARA OS™ Creator
   - SONARA OS™ Pro
   - SONARA OS™ Label
3. Copy the monthly recurring price IDs.
4. Add the required environment variable names in Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_CREATOR_MONTHLY_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_LABEL_MONTHLY_PRICE_ID`, and `NEXT_PUBLIC_APP_URL`.

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
# 2026 Setup Notes

Manual setup required:

1. Create Stripe products/prices for Creator, Pro, and Label.
2. Add Stripe env vars in Vercel.
3. Add webhook endpoint: `https://sonaraindustries.com/api/stripe/webhook`.
4. Subscribe webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Run Supabase subscription migration.
6. Test checkout.
7. Test webhook fulfillment.
8. Do not commit secrets.

Later:

- Google Play Billing for native Android.
- Apple IAP for native iOS.
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
