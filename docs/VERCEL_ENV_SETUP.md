# Vercel Environment Setup

Environment variables must be added in the Vercel dashboard or with the Vercel CLI. Do not commit secrets to GitHub and do not put environment variables in `vercel.json`.

After changing environment variables, redeploy without the build cache.

## Required

Set `SONARA_AI_PROVIDER` to `local_rules`, then add `SONARA_CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` with real values in Vercel.

## Optional OpenAI BYOK

Add `OPENAI_API_KEY` only if BYOK mode is enabled.

OpenAI is optional. SONARA must build and run with `SONARA_AI_PROVIDER=local_rules` and no `OPENAI_API_KEY`.

## Stripe

Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_CREATOR_MONTHLY_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_LABEL_MONTHLY_PRICE_ID`, and `NEXT_PUBLIC_APP_URL`.

## Safety Notes

- `NEXT_PUBLIC_` variables are visible to the browser.
- `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret keys, webhook secrets, and cron secrets are server-only.
- If a service role key is ever committed, rotate it immediately.
- Confirm public pages render even when Supabase and Stripe variables are missing.
