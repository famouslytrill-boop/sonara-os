# Stripe Live Setup

Use environment variable names only. Do not paste real keys into source code, docs, GitHub, screenshots, or chat.

1. Rotate the exposed old live secret key.
2. Create live Stripe products:
   - SONARA OS Creator
   - SONARA OS Pro
   - SONARA OS Label
3. Create monthly recurring prices:
   - $9.99/month
   - $19.99/month
   - $49.99/month
4. Copy Price IDs, not Product IDs.
5. Add Vercel environment variables:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_CREATOR_MONTHLY_PRICE_ID`
   - `STRIPE_PRO_MONTHLY_PRICE_ID`
   - `STRIPE_LABEL_MONTHLY_PRICE_ID`
   - `NEXT_PUBLIC_APP_URL=https://sonaraindustries.com`
6. Create webhook endpoint:
   - `https://sonaraindustries.com/api/stripe/webhook`
7. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
8. Redeploy Vercel without build cache.
9. Test checkout.
10. Test webhook delivery.
11. Confirm subscription row updates in Supabase if Supabase admin is configured.

## Safety Notes

- Web subscriptions are for website/PWA.
- Native Android subscriptions may require Google Play Billing later.
- Native iOS subscriptions may require Apple IAP later.
- Do not show fake active subscriptions.
- Do not enable paid access until checkout, webhook, and entitlement handling are verified.
