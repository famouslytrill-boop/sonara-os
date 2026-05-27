# Environment Variables

Use `.env.example` as the placeholder contract. Real values belong in Vercel, Supabase, Stripe, GitHub secrets, local `.env`, or a password manager. Do not commit real secrets.

## Public Browser-Safe Variables

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_MARKETING_URL`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_COMPANY_NAME`
- `NEXT_PUBLIC_PLATFORM_NAME`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Only `NEXT_PUBLIC_*` variables are browser-exposed. Never put service-role keys, webhook secrets, database URLs, Stripe secret keys, AI provider keys, tokens, or payout details in `NEXT_PUBLIC_*` variables.

## Server-Only Variables

- `SONARA_CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_CORE`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_AGENCY`
- `STRIPE_PRICE_SETUP_99`
- `STRIPE_PRICE_SETUP_299`
- `STRIPE_PRICE_SETUP_499`

## Validation

Run:

```bash
pnpm run verify:env
pnpm run verify:stripe
pnpm audit --audit-level moderate
pnpm run typecheck
pnpm run build
```

Validation scripts must report configured/not configured states without printing raw secret values.
