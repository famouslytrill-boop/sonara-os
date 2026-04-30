# Vercel Environment Setup

Environment variables must be added in the Vercel dashboard or with the Vercel CLI. Do not commit secrets to GitHub and do not put environment variables in `vercel.json`.

After changing environment variables, redeploy without the build cache.

## Required

```env
SONARA_AI_PROVIDER=local_rules
SONARA_CRON_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Optional OpenAI BYOK

```env
OPENAI_API_KEY=
```

OpenAI is optional. SONARA must build and run with `SONARA_AI_PROVIDER=local_rules` and no `OPENAI_API_KEY`.

## Stripe

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_CREATOR_MONTHLY_PRICE_ID=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_LABEL_MONTHLY_PRICE_ID=
NEXT_PUBLIC_APP_URL=https://sonaraindustries.com
```

## Safety Notes

- `NEXT_PUBLIC_` variables are visible to the browser.
- `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret keys, webhook secrets, and cron secrets are server-only.
- If a service role key is ever committed, rotate it immediately.
- Confirm public pages render even when Supabase and Stripe variables are missing.
