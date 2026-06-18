# Vercel Production Environment

Do not commit real provider values. Configure production values in Vercel or the selected hosting provider.

## Required public values

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`
- `NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY`
- `NEXT_PUBLIC_AUTH_PHONE_ENABLED`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

`NEXT_PUBLIC_SUPABASE_URL` must match Supabase Project Settings -> API -> Project URL. It should look like `https://<project-ref>.supabase.co` and must not include `/rest/v1`, `/auth/v1`, query strings, fragments, dashboard URLs, or OAuth callback URLs.

Keep `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false` and `NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY=false` until the Supabase Google provider is enabled, the Google Cloud OAuth client is type `Web application`, and redirect URLs are verified.

## Server-only values

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `RESEND_API_KEY`
- `APP_URL`
- `SITE_URL`
- `SONARA_ADMIN_EMAILS`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_CORE`
- `STRIPE_PRICE_CREATOR`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_AGENCY_SCALE`
- `STRIPE_PRICE_SETUP_99`
- `STRIPE_PRICE_SETUP_299`
- `STRIPE_PRICE_SETUP_499`
- `STRIPE_PRICE_SETUP_999`
- `GITHUB_TOKEN`

Server-only values must not use the `NEXT_PUBLIC_` prefix and must not appear in browser bundles, static HTML, screenshots, support requests, docs, or AI prompts.

## Support and email values

- `SUPPORT_EMAIL`
- `SUPPORT_TO_EMAIL`
- `CONTACT_EMAIL`
- `HELP_EMAIL`
- `BILLING_EMAIL`
- `SECURITY_EMAIL`
- `PRIVACY_EMAIL`
- `LEGAL_EMAIL`
- `RESEND_FROM_EMAIL`

Cloudflare Email Routing handles inbound forwarding only after DNS/MX/TXT verification. Outbound support email requires a configured provider such as Resend or Postmark, a verified sender, and either `SUPPORT_TO_EMAIL` or `SUPPORT_EMAIL`.

The contact form posts to `/api/contact`. The server stores the request in `support_requests`, sends Resend notification email when configured, and marks the row `pending_email`, `email_sent`, or `email_failed`. The admin queue endpoint `/api/admin/contact-requests` requires a verified Supabase bearer token whose email appears in `SONARA_ADMIN_EMAILS`.

## Google OAuth settings

The active auth path is Supabase Auth. Add the Google Client ID and Client Secret in Supabase Auth provider settings, not in Vercel public env vars.

- Google OAuth client type: `Web application`
- Authorized JavaScript origin: production origin
- Supabase redirect URI in Google: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

## Stripe price values

Stripe price env vars must contain Price IDs beginning with `price_`. Dollar display values, Product IDs, keys, webhook secrets, and `/mo` strings are invalid and keep checkout disabled.

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
