# Vercel Production Deployment

## Required Env

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- support/contact/billing/security/privacy/legal email addresses
- outbound email provider key and sender when email sending is enabled

## Optional Env

- `GITHUB_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Launch Rules

- Missing optional providers must lock only their own module.
- Missing required production env must show setup/readiness gates.
- Server-only values must never appear in public artifacts.
- Deploy only after CI, route smoke, Supabase checks, and owner review pass.
