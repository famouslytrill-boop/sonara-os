# Environment Variables

Use `.env.example` as a placeholder contract only. Real values belong in Vercel, Supabase, CI secrets, local `.env`, or a password manager.

## Public Frontend Variables

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Only `NEXT_PUBLIC_*` variables are safe for browser exposure.

## Server-Only Variables

- `SONARA_CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CREATOR_MONTHLY_PRICE_ID`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_LABEL_MONTHLY_PRICE_ID`

## Supabase Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

`SUPABASE_DB_URL` is for Python ops/local/CI only. Do not expose it to frontend code.

## Stripe Variables

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Stripe price IDs

## Storage Variables

- `PUBLIC_ASSETS_BUCKET`
- `PRIVATE_ASSETS_BUCKET`
- `ORGANIZATION_ASSETS_BUCKET`

## Worker Variables

- `REDIS_URL`
- `WORKER_CONCURRENCY`

## Python Ops Variables

- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- optional `STRIPE_SECRET_KEY`

## Monitoring Variables

- `SENTRY_DSN`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

## Optional Provider Variables

- `OPENAI_API_KEY`
- `FREESOUND_API_KEY`
- `OPENVERSE_CLIENT_ID`
- `OPENVERSE_CLIENT_SECRET`
- `DATA_GOV_API_KEY`
- `NWS_USER_AGENT`

## Validation

Run:

```bash
npm run verify:env
```

This checks for placeholder coverage and avoids printing secret values.
