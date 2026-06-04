# Vercel Production Environment

Do not commit real provider values. Configure production values in Vercel or the selected hosting provider.

## Required public values

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`
- `NEXT_PUBLIC_AUTH_PHONE_ENABLED`

`NEXT_PUBLIC_SUPABASE_URL` must match Supabase Project Settings -> API -> Project URL. It should look like `https://<project-ref>.supabase.co` and must not include `/rest/v1`, `/auth/v1`, query strings, fragments, dashboard URLs, or OAuth callback URLs.

Keep `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false` until the Supabase Google provider is enabled and redirect URLs are verified.

## Server-only values

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GITHUB_TOKEN`

Server-only values must not use the `NEXT_PUBLIC_` prefix and must not appear in browser bundles, static HTML, screenshots, support requests, docs, or AI prompts.

## Support and email values

- `SUPPORT_EMAIL`
- `CONTACT_EMAIL`
- `HELP_EMAIL`
- `BILLING_EMAIL`
- `SECURITY_EMAIL`
- `PRIVACY_EMAIL`
- `LEGAL_EMAIL`
- `RESEND_FROM_EMAIL`

Cloudflare Email Routing handles inbound forwarding only after DNS/MX/TXT verification. Outbound support email requires a configured provider such as Resend or Postmark and a verified sender.

## Deployment checks

Run these locally before requesting production deployment:

```sh
pnpm install --frozen-lockfile
pnpm run check:supabase-env
pnpm run check:supabase-service-role
pnpm run check:vercel-env-docs
pnpm run check:live-readiness
pnpm run build
```

Vercel production should not be approved until the owner verifies Supabase Auth redirects, email delivery, domain SSL, and the first owner/admin membership.
