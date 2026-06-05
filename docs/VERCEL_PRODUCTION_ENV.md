# Vercel Production Environment

Use Vercel project settings for real values. Do not commit secrets.

## Public Client Safe

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPPORT_CONTACT_LABEL`

`NEXT_PUBLIC_SUPABASE_URL` must match Supabase Project Settings -> API -> Project URL for the active project. It should be the root project URL, for example `https://<project-ref>.supabase.co`, not an auth endpoint, not localhost in production, and not a stale project ref from another Supabase project.

## Server Only

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` if used
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CONTACT_EMAIL`
- `SUPPORT_EMAIL`
- `HELP_EMAIL`
- `BILLING_EMAIL`
- `SECURITY_EMAIL`
- `PRIVACY_EMAIL`
- `LEGAL_EMAIL`
- `SONARA_ADMIN_EMAILS`
- `SONARA_CRON_SECRET` if used
- `OPENAI_API_KEY` if used

## Vercel Build Settings

- Framework: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm run build`
- Output directory: default/blank

After changing env vars, redeploy production. Disable build cache after major env/package changes or if Vercel appears to use stale auth/build state.

If signup fails with "Failed to fetch" or Google OAuth opens a `*.supabase.co` host that returns `DNS_PROBE_FINISHED_NXDOMAIN`, replace `NEXT_PUBLIC_SUPABASE_URL` in Vercel Production with the current Supabase Project Settings -> API Project URL and redeploy.

## Email Production Values

Set public inbox routing values in Vercel:

- `CONTACT_EMAIL=contact@sonaraindustries.com`
- `SUPPORT_EMAIL=support@sonaraindustries.com`
- `HELP_EMAIL=help@sonaraindustries.com`
- `BILLING_EMAIL=billing@sonaraindustries.com`
- `SECURITY_EMAIL=security@sonaraindustries.com`
- `PRIVACY_EMAIL=privacy@sonaraindustries.com`
- `LEGAL_EMAIL=legal@sonaraindustries.com`
- `RESEND_FROM_EMAIL=SONARA Industries <no-reply@sonaraindustries.com>`

`RESEND_API_KEY` is sensitive and server-only. If a Resend key was exposed in a screenshot or copied anywhere public, revoke it, create a new key, update Vercel, and redeploy.

Cloudflare Email Routing only confirms inbound forwarding. Outbound support/contact form notifications require Resend or another verified outbound provider.

Run after env changes:

```powershell
pnpm run verify:email-env
pnpm run build
```
