# SONARA Industries Environment Variables

Configure production values in Vercel Project Settings -> Environment Variables. Do not commit real values.

## Public site

- `APP_URL`: Production app URL. Use `https://sonaraindustries.com`.
- `PUBLIC_SITE_URL`: Public base URL used for OAuth and checkout redirects. Use `https://sonaraindustries.com`.
- `NEXT_PUBLIC_APP_URL`: Browser-safe app URL alias for future frontend clients.
- `NEXT_PUBLIC_SITE_URL`: Browser-safe site URL alias for future frontend clients.

## Supabase

- `SUPABASE_URL`: Server-side Supabase project URL used by Express REST calls.
- `SUPABASE_ANON_KEY`: Public Supabase anon key for future browser-safe clients. Do not use for privileged server writes.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only key for support queue, billing audit, and admin reads. Never expose to browser code.
- `NEXT_PUBLIC_SUPABASE_URL`: Browser-safe Supabase URL alias for future frontend clients.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Browser-safe Supabase anon key alias.
- `SUPABASE_DB_URL`: Direct database URL for owner migration tooling only. Do not expose to browser code.

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
- `STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY`: Alias accepted for Business Builder monthly pricing.
- `STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY`: Alias accepted for Creator Studio monthly pricing.
- `STRIPE_PRICE_ID_GROWTH_STUDIO_MONTHLY`: Alias accepted for Growth Studio monthly pricing.
- `STRIPE_PRICE_ID_BUSINESS_BUILDER_ONETIME`: Alias accepted for Business Builder one-time setup pricing.
- `STRIPE_SUCCESS_URL`: Checkout success redirect.
- `STRIPE_CANCEL_URL`: Checkout cancel redirect.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Browser-safe publishable key reserved for future client-side Stripe Elements. Checkout Sessions do not require it.

Configure these in Stripe Dashboard and Vercel.

Validation rules:

- `STRIPE_SECRET_KEY` must start with `sk_live_` or `sk_test_`.
- `STRIPE_WEBHOOK_SECRET` must start with `whsec_`.
- Every `STRIPE_PRICE_*` variable must start with `price_`.
- Do not paste `sk_live_`, `sk_test_`, `prod_`, or `cus_` values into `STRIPE_PRICE_*`.
- Checkout is enabled per plan. A missing Pro or one-time setup price must not block Starter or Core if their own price IDs are valid.
- Never place Stripe secrets in `NEXT_PUBLIC_*` variables.

## Resend

- `RESEND_API_KEY`: Server-only Resend API key.
- `RESEND_FROM_EMAIL`: Verified sender address.
- `SUPPORT_TO_EMAIL`: Internal support recipient.
- `CONTACT_TO_EMAIL`: Alias accepted for the internal contact recipient.

Configure these in Resend after domain verification.

## Admin

- `ADMIN_ACCESS_TOKEN`: Temporary server-only admin gate until OAuth-backed admin sessions are complete.
- `ADMIN_EMAILS`: Comma-separated owner/admin emails for future OAuth authorization.
- `ADMIN_EMAIL`: Single-admin alias for future OAuth authorization.

Never display or expose `ADMIN_ACCESS_TOKEN`.

`ADMIN_ACCESS_TOKEN` must not be all `A` characters and should be at least 32 characters.

## Optional Vercel runtime

- `VERCEL_OIDC_TOKEN`: Use only if a future Vercel OIDC flow explicitly needs it.
