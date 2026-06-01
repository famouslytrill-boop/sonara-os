# Environment Variables

Use `.env.example` as the safe template. Empty values are placeholders only.

## Public values

`NEXT_PUBLIC_*` values are browser-visible. Keep them limited to non-secret configuration such as site URLs, public Supabase URL, and public Supabase anon key.

## Server-only values

Server-only values include:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GITHUB_TOKEN`

These must stay in the hosting provider or server environment only.

## Optional providers

Email, payment, GitHub sync, and provider-specific integrations are optional until configured. Missing optional variables should lock only the related module, not the full static build.
