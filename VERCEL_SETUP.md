# Vercel Setup

Use Framework Preset: Other.

## Settings

- Root Directory: repository root
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`
- Output Directory: blank
- Development Command: `pnpm start`

The Express app is served through `api/index.js`, and `vercel.json` rewrites all traffic to `/api`.

## Required environment groups

- Supabase: `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and one `price_` ID for each enabled plan
- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPPORT_TO_EMAIL` or `CONTACT_TO_EMAIL`
- Admin: `ADMIN_ACCESS_TOKEN`, `ADMIN_EMAILS` or `ADMIN_EMAIL`
- Public URL: `APP_URL`, `PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, or `NEXT_PUBLIC_SITE_URL`

Never add service-role keys, Stripe secret keys, webhook secrets, Resend keys, or admin tokens to browser-exposed variables.
