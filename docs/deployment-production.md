# Production Deployment Checklist

This repository must remain safe when provider configuration is missing. Static public pages should build, while auth, email, and payment routes must fail closed with clear setup messages.

## Required Vercel Production Environment Variables

Public browser-safe values:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`
- `NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY`
- `NEXT_PUBLIC_AUTH_PHONE_ENABLED`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Server-only values:

- `APP_URL`
- `SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPPORT_TO_EMAIL`
- `SUPPORT_EMAIL`
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

Stripe price values must be Price IDs beginning with `price_`. Do not enter dollar amounts, `prod_` Product IDs, `sk_` secret keys, `pk_` publishable keys, `whsec_` webhook secrets, or values containing `/mo`.

## Supabase Auth

`NEXT_PUBLIC_SUPABASE_URL` must match Supabase Project Settings -> API -> Project URL:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co
```

Supabase Auth redirect URLs should include:

- `https://sonaraindustries.com/auth/callback`
- `http://localhost:3000/auth/callback` for local development only

## Google OAuth

The active implementation uses Supabase Auth Google provider.

Google Cloud Console:

- OAuth client type: `Web application`
- Authorized JavaScript origins: production origin and localhost for local development
- Authorized redirect URI: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

After provider verification, set:

- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`
- `NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY=true`

## Stripe

Create these Stripe products and prices:

- Free: no Stripe checkout
- SONARA One Starter: recurring monthly price, map to `STRIPE_PRICE_STARTER`
- SONARA One Core: recurring monthly price, map to `STRIPE_PRICE_CORE`
- Creator Studio: recurring monthly price, map to `STRIPE_PRICE_CREATOR`
- SONARA One Growth: recurring monthly price, map to `STRIPE_PRICE_GROWTH`
- SONARA One Pro: recurring monthly price, map to `STRIPE_PRICE_PRO`
- SONARA One Agency/Scale: recurring monthly price, map to `STRIPE_PRICE_AGENCY_SCALE`
- Profile Setup: one-time price, map to `STRIPE_PRICE_SETUP_99`
- Business Launch Setup: one-time price, map to `STRIPE_PRICE_SETUP_299`
- Premium Setup: one-time price, map to `STRIPE_PRICE_SETUP_499`
- Complete Launch Setup: one-time price, map to `STRIPE_PRICE_SETUP_999`

Webhook endpoint:

```text
https://sonaraindustries.com/api/stripe/webhook
```

Subscribe at least to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Resend and Support Email

Configure:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPPORT_TO_EMAIL`
- `SUPPORT_EMAIL`
- `SONARA_ADMIN_EMAILS`

Verify sender/domain SPF, DKIM, and DMARC before enabling production notifications. Contact requests must remain stored and reviewable when email delivery fails.

Production contact flow:

1. Public `/contact` posts to `/api/contact`.
2. `/api/contact` writes `support_requests` through the server-only Supabase service role.
3. Resend sends the notification email if `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and a support recipient are configured.
4. The request row is updated to `pending_email`, `email_sent`, or `email_failed`.
5. Admin review reads `/api/admin/contact-requests` with a Supabase bearer token whose email appears in `SONARA_ADMIN_EMAILS`.

## Manual Deployment Gate

1. Add Vercel Production env vars.
2. Confirm Supabase Auth settings and redirect URLs.
3. Confirm Google OAuth client exists and is a Web application.
4. Confirm Stripe products, prices, and webhook endpoint.
5. Confirm Resend sender/domain verification.
6. Run `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
7. Deploy to Vercel.
8. Test signup, Google login, contact form, Stripe checkout, and legal pages.
9. Keep final launch blocked until human legal/privacy/security review is complete.
