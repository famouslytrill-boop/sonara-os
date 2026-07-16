# SONARA Deployment Truth

## What Vercel serves

Vercel serves the root Express application. `vercel.json` installs with `pnpm install --frozen-lockfile`, runs `pnpm run vercel-build`, bundles the Express route/runtime assets, and rewrites `/(.*)` to `/api`. The production domain is `sonaraindustries.com`.

The build does not deploy a nested frontend workspace. A green nested frontend build is not proof of production behavior; `server.js`, route tests, and post-deploy route checks are the source of truth.

## Required Vercel production variables

Public-safe:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` when browser-side Stripe.js is introduced

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- configured `STRIPE_PRICE_*` values
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPPORT_TO_EMAIL`
- `CONTACT_TO_EMAIL`
- `FOUNDER_EMAILS` or `SONARA_ADMIN_EMAILS`

Supabase preview/migration automation also needs `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, and `SUPABASE_DB_PASSWORD`. Never put these in `NEXT_PUBLIC_*` variables.

## Supabase production steps

The Supabase GitHub App currently reports preview checks against project reference `negegqiequrclmxuvsuy`. The supplied launch project reference is `yqncsonkxgwhcxedgevk`. Reconnect or reconfigure the Supabase GitHub integration before treating preview success as proof for the launch project.

1. Confirm the project reference is `yqncsonkxgwhcxedgevk` in Supabase Dashboard, Project Settings, General.
2. Set `NEXT_PUBLIC_SUPABASE_URL` to the API Project URL shown in Project Settings, API.
3. Add the anon key as public-safe configuration and the service-role key as server-only configuration.
4. Link locally with `pnpm exec supabase link --project-ref yqncsonkxgwhcxedgevk`.
5. Review `pnpm exec supabase migration list`.
6. Apply with `pnpm run db:push` only after production migration approval.
7. Verify `/api/readiness`, `/api/admin/database-readiness`, and `/api/admin/storage-readiness` using authorized access.

## Provider proof before launch

- Supabase: sign up, sign in, create/attach organization, save a product record, and verify RLS isolation.
- Stripe: create a checkout, send signed test webhook events, and confirm `billing_webhook_events` plus `billing_subscriptions`.
- Resend: verify the sender domain, submit contact/support, and confirm both database and delivered email state.
- Vercel: confirm the deployment commit SHA in `/api/health` and run `pnpm run verify:postdeploy` against the deployment URL.

Missing provider values must remain setup-required. Static/public routes should continue to render.
