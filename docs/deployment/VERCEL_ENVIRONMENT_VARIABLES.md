# Vercel Environment Variables

Values must be configured in Vercel or the selected hosting provider. Do not commit real secrets.

## Public variables

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_MARKETING_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`
- `NEXT_PUBLIC_AUTH_PHONE_ENABLED`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` optional

`NEXT_PUBLIC_*` values are browser-visible. Never put service-role, webhook, payment, or provider secrets in a public variable.

`NEXT_PUBLIC_SUPABASE_URL` must exactly match Supabase Project Settings -> API -> Project URL. Use the full `https://<project-ref>.supabase.co` value. Do not use a Supabase dashboard URL, OAuth redirect URL, REST endpoint path, guessed hostname, query string, or fragment.

## Server-only variables

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY` optional
- `STRIPE_WEBHOOK_SECRET` optional
- `GITHUB_TOKEN` optional for GitHub update reports

These are server-only. They must not appear in client bundles, static HTML, screenshots, support tickets, docs with real values, or AI prompts.

## Support routing

- `SUPPORT_EMAIL`
- `CONTACT_EMAIL`
- `HELP_EMAIL`
- `BILLING_EMAIL`
- `SECURITY_EMAIL`
- `PRIVACY_EMAIL`
- `LEGAL_EMAIL`
- `RESEND_FROM_EMAIL`

Inbound mail still requires DNS and provider verification. Outbound mail requires a selected provider such as Resend and a verified sender.

## Optional payment providers

- Stripe variables are optional until checkout and billing are enabled.
- Square and PayPal credentials are optional future provider choices.
- Missing optional payment variables must not break static builds.
