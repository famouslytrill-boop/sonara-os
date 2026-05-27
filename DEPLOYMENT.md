# Deployment

This repo deploys from the repository root as a pnpm-based Next.js app.

## Vercel

Use the repo root as the project root.

- Framework preset: Next.js
- Install command: `corepack enable && corepack prepare pnpm@11.1.1 --activate && pnpm install --frozen-lockfile`
- Build command: `pnpm run build`
- Output directory: Next.js default

`vercel.json` currently defines the weekly maintenance cron at `/api/cron/sonara-maintenance`. The route exists and is included in the production build.

## Required Environment Variable Names

Do not paste real secrets into this file or into source control.

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `DATABASE_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
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

Product-specific price IDs used by the current pricing code are also listed in `.env.example`.

## Preview Verification

Before trusting a Vercel preview:

1. Confirm GitHub Actions pass on the branch.
2. Confirm Vercel uses pnpm and `pnpm-lock.yaml`.
3. Confirm no `package-lock.json` is present.
4. Open `/`, `/pricing`, `/account/billing`, `/api/stripe/checkout`, and `/api/stripe/webhook` behavior.
5. Confirm Stripe routes return setup errors when secrets are missing instead of exposing stack traces or secret values.

## Production Cutover

Production launch still requires manual setup:

- Connect the production domain.
- Add production environment variables in Vercel.
- Link Supabase and push migrations.
- Configure Stripe products, prices, and webhook endpoint.
- Run the launch checklist in `LAUNCH_CHECKLIST.md`.
