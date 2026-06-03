# Vercel Production Environment

Use Vercel project settings for real values. Do not commit secrets.

## Public Client Safe

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Server Only

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` if used
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SONARA_ADMIN_EMAILS`
- `SONARA_CRON_SECRET` if used
- `OPENAI_API_KEY` if used

## Vercel Build Settings

- Framework: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm run build`
- Output directory: default/blank

After changing env vars, redeploy production. Disable build cache after major env/package changes or if Vercel appears to use stale auth/build state.
