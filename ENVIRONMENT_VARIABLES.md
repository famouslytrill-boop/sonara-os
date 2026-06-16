# SONARA Industries Environment Variables

Configure production values in Vercel Project Settings -> Environment Variables. Do not commit real values.

## Public site

- `PUBLIC_SITE_URL`: Public base URL used for OAuth and checkout redirects. Server-read, safe to disclose as a URL.

## Supabase

- `SUPABASE_URL`: Server-side Supabase project URL used by Express REST calls.
- `SUPABASE_ANON_KEY`: Public Supabase anon key for future browser-safe clients. Do not use for privileged server writes.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only key for support queue, billing audit, and admin reads. Never expose to browser code.

Configure these from Supabase Project Settings -> API.

## Google OAuth

- `GOOGLE_CLIENT_ID`: OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: Server-only OAuth secret.
- `GOOGLE_REDIRECT_URI`: Callback URL, normally `https://sonaraindustries.com/auth/callback`.

Configure these in Google Cloud Console OAuth credentials and, if Supabase Auth is used, in Supabase Auth provider settings.

## Stripe

- `STRIPE_SECRET_KEY`: Server-only restricted or secret key for Checkout Sessions.
- `STRIPE_WEBHOOK_SECRET`: Server-only webhook signing secret.
- `STRIPE_PRICE_STARTER_MONTHLY`: Stripe price ID for Starter monthly.
- `STRIPE_PRICE_CORE_MONTHLY`: Stripe price ID for Core monthly.
- `STRIPE_PRICE_PRO_MONTHLY`: Stripe price ID for Pro monthly.
- `STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME`: Stripe price ID for one-time Business Builder purchase.
- `STRIPE_SUCCESS_URL`: Checkout success redirect.
- `STRIPE_CANCEL_URL`: Checkout cancel redirect.

Configure these in Stripe Dashboard and Vercel. Checkout remains blocked until all required values exist.

## Resend

- `RESEND_API_KEY`: Server-only Resend API key.
- `RESEND_FROM_EMAIL`: Verified sender address.
- `SUPPORT_TO_EMAIL`: Internal support recipient.

Configure these in Resend after domain verification.

## Admin

- `ADMIN_ACCESS_TOKEN`: Temporary server-only admin gate until OAuth-backed admin sessions are complete.
- `ADMIN_EMAILS`: Comma-separated owner/admin emails for future OAuth authorization.

Never display or expose `ADMIN_ACCESS_TOKEN`.
