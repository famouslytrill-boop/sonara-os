# Paid Launch Readiness

Launch-prep date: 2026-06-11

This checklist reflects what the repository can enforce in code and what still requires owner/provider setup. Do not launch paid traffic until the manual items are verified in production.

## Code Checklist

| Area                           | Status                        | Evidence                                                                                                                                           |
| ------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node/Vercel engine             | Pass                          | Root `package.json` uses `22.x`.                                                                                                                   |
| Package manager                | Pass                          | `packageManager` is pnpm and no npm lockfile is required.                                                                                          |
| Auth configuration diagnostics | Pass                          | Browser auth reads `NEXT_PUBLIC_SUPABASE_URL` and disables Google until public flags and Supabase URL are valid.                                   |
| Session persistence policy     | Pass                          | No route/startup code calls logout; logout is user-triggered by the visible app-shell button.                                                      |
| Logout button                  | Pass                          | Private app navigation renders `Log out` and invokes the manual logout controller only on click.                                                   |
| Admin route metadata           | Pass                          | `/admin`, `/admin/support`, `/admin/contact-requests`, `/admin/email-readiness`, `/admin/env-readiness`, and app admin routes are `admin-ready`.   |
| Admin API protection           | Pass with provider dependency | `/api/admin/contact-requests` verifies a Supabase bearer token and `SONARA_ADMIN_EMAILS` before reading support records.                           |
| Contact form                   | Pass with provider dependency | `/contact` renders a real form posting to `/api/contact`.                                                                                          |
| Contact storage                | Pass with provider dependency | `/api/contact` writes `support_requests` through server-only Supabase env vars.                                                                    |
| Resend notification            | Pass with provider dependency | `/api/contact` sends via Resend only when server-only email env vars are configured.                                                               |
| Email failure behavior         | Pass                          | DB save remains accepted and row is updated to `email_failed` when notification fails.                                                             |
| Stripe catalog                 | Pass                          | Centralized catalog includes current recurring and setup products.                                                                                 |
| Stripe checkout safety         | Pass with provider dependency | Checkout route resolves server env `price_` IDs and rejects missing or invalid values.                                                             |
| Stripe webhook safety          | Pass with database follow-up  | Webhook route verifies signatures and handles required event types; database entitlement persistence still requires final production table wiring. |
| Legal dates                    | Pass                          | Legal templates use 2026-06-11 and keep legal-review warnings.                                                                                     |
| Public legacy routes           | Pass                          | Old public product routes redirect to current SONARA products.                                                                                     |

## Manual Dashboard Setup Checklist

### Vercel Production

- Add `NEXT_PUBLIC_SITE_URL`.
- Add `NEXT_PUBLIC_APP_URL`.
- Add `APP_URL`.
- Add `NEXT_PUBLIC_SUPABASE_URL`.
- Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Add `SUPABASE_SERVICE_ROLE_KEY`.
- Add `SONARA_ADMIN_EMAILS`.
- Add `RESEND_API_KEY`.
- Add `RESEND_FROM_EMAIL`.
- Add `SUPPORT_EMAIL` or `SUPPORT_TO_EMAIL`.
- Add `PRIVACY_EMAIL` and `SECURITY_EMAIL`.
- Add `STRIPE_SECRET_KEY`.
- Add `STRIPE_WEBHOOK_SECRET`.
- Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Add every launch `STRIPE_PRICE_*` value as a Stripe Price ID beginning with `price_`.

### Supabase

- Confirm `NEXT_PUBLIC_SUPABASE_URL` matches Project Settings -> API -> Project URL.
- Enable Google provider in Authentication -> Providers -> Google.
- Add Google Client ID and Client Secret in Supabase, not in source code.
- Set production redirect URL `/auth/callback`.
- Apply migrations and verify `support_requests` and `support_email_delivery_attempts`.
- Create the first owner user and active owner organization membership.

### Google Cloud Console

- OAuth client type: Web application.
- Authorized JavaScript origin: production origin.
- Authorized redirect URI for Supabase Auth: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`.
- Add localhost origin/callback only for local development.

### Stripe

- Create recurring monthly prices for Starter, Core, Creator Studio, Growth, Pro, and Agency/Scale.
- Create one-time prices for Profile Setup, Business Launch Setup, Premium Setup, and Complete Launch Setup.
- Put Price IDs, not Product IDs or dollar values, into Vercel env vars.
- Create webhook endpoint `/api/stripe/webhook`.
- Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
- Send a test checkout and test webhook event in the target environment.

### Resend and Email

- Verify sending domain or sender.
- Confirm SPF, DKIM, and DMARC.
- Confirm support inbox receives mail.
- Submit a production contact request and verify the row and email status.

## Commands

Run before merge/deploy:

```sh
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
pnpm run check:auth-config
pnpm run check:support-readiness
pnpm run check:stripe-prices
pnpm run check:vercel-env-docs
```

`pnpm run check:stripe-prices` requires the production or test Stripe env values to be loaded. It intentionally fails when values are missing or are not `price_` IDs.

## Production Smoke Test

1. Open the homepage, pricing, contact, legal terms, privacy, refund, security, login, signup, and admin readiness routes.
2. Confirm Google login starts only after `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` and `NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY=true`.
3. Confirm refresh/navigation does not log out a signed-in user.
4. Click the visible `Log out` button and confirm that is the only path that signs out.
5. Submit `/contact` and record the reference ID.
6. Verify `support_requests.email_delivery_status`.
7. Open `/api/admin/contact-requests` with a valid Supabase bearer token for an email in `SONARA_ADMIN_EMAILS`.
8. Click every enabled pricing checkout button and verify Stripe Checkout opens with the expected mode.
9. Send a Stripe webhook test and verify signature validation.
10. Hard-refresh the browser and verify title, favicon, navigation, and old route redirects.

## Launch Recommendation

No paid launch until Vercel env vars, Supabase Auth, Google OAuth, Resend delivery, Stripe Checkout, Stripe webhooks, owner/admin membership, legal review, privacy review, and mobile/desktop smoke tests pass in production.
