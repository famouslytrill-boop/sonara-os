# SONARA OSâ„¢ Manual Dashboard Setup

This checklist is for dashboard setup only. Do not paste real secret values into source code, docs, screenshots, GitHub, Codex, or chat.

## Stripe

1. Rotate or revoke any exposed Stripe live secret key.
2. Create a new live secret key.
3. Store the new live secret key only in Vercel as `STRIPE_SECRET_KEY`.
4. Copy Stripe Price IDs, not Product IDs.
5. Required Stripe price IDs:
   - `STRIPE_CREATOR_MONTHLY_PRICE_ID=price_1TS4jf0dKtIEU3IAgEX2tjV2`
   - `STRIPE_PRO_MONTHLY_PRICE_ID=price_1TS4l70dKtIEU3IAgmuQmmYO`
   - `STRIPE_LABEL_MONTHLY_PRICE_ID=price_...`
6. Do not use `prod_...` values for price env vars.
7. Do not use `price_...` as the env var key/name. Use the env var names above and put the Price ID in the value field.

## Vercel

## Vercel

Add these Vercel Environment Variables using the exact key names from your app setup:

- Public app URL = https://sonaraindustries.com
- Stripe public browser key = your live publishable Stripe value
- Stripe private server credential = your newly rotated live Stripe server value
- Stripe webhook signing credential = your Stripe webhook signing value
- Creator monthly Stripe Price ID = price_1TS4jf0dKtIEU3IAgEX2tjV2
- Pro monthly Stripe Price ID = price_1TS4l70dKtIEU3IAgmuQmmYO
- Label monthly Stripe Price ID = your Label price value from Stripe

Important:
- Do not use product IDs for price env vars.
- Do not use Stripe Price IDs as the env var key/name.
- Use the correct env var names in Vercel, then place the Stripe Price ID in the value field.
- After env var changes, redeploy without build cache.
After env var changes, redeploy without build cache.

## Stripe Webhook

Endpoint:

`https://sonaraindustries.com/api/stripe/webhook`

Events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Supabase

- Apply `supabase/migrations/003_sonara_subscriptions.sql`.
- Confirm RLS is enabled.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code.

## 403 Vercel Fix

If preview or production shows 403:

- Check Vercel Deployment Protection.
- Check Project â†’ Settings â†’ Domains.
- Confirm the custom domain points to this project.
- Check middleware/auth rules.

## Never Do This

- Never paste `sk_live_`, `whsec_`, or `SUPABASE_SERVICE_ROLE_KEY` into Codex.
- Never commit `.env.local`.
- Never put real secrets in `vercel.json`.
- Never put real secrets in screenshots.
- Never paste secrets into chat.
