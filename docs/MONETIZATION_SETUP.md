# Monetization Setup

SONARA OSâ„¢ uses real Stripe products only. Do not wire fake payments or fake active subscriptions.

## Stripe Setup

1. Rotate any exposed Stripe live key before production redeploy.
2. Create monthly subscription products:
   - SONARA OSâ„¢ Creator
   - SONARA OSâ„¢ Pro
   - SONARA OSâ„¢ Label
3. Copy the monthly recurring Price IDs.
4. Add the required environment variable names in Vercel:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_CREATOR_MONTHLY_PRICE_ID`
   - `STRIPE_PRO_MONTHLY_PRICE_ID`
   - `STRIPE_LABEL_MONTHLY_PRICE_ID`
   - `NEXT_PUBLIC_APP_URL`
5. Add the webhook endpoint: `https://sonaraindustries.com/api/stripe/webhook`.
6. Subscribe the webhook to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
7. Run the Supabase subscription migrations.
8. Test checkout success, cancel, subscription update, and deletion.

## Safety Rules

- Do not commit secrets.
- Do not place environment variables in `vercel.json`.
- Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` server-only.
- Paid CTAs must show setup-required behavior until checkout and webhooks are verified.
- Web Stripe subscriptions are for the website and PWA.
- Later Android native subscriptions may require Google Play Billing.
- Later iOS native subscriptions may require Apple IAP.

See `docs/STRIPE_LIVE_SETUP.md` for the exact live setup checklist.
