# Vercel Environment Variables

Values must be configured in Vercel or the selected hosting provider. Do not commit real secrets.

## Public variables

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_MARKETING_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`
- `NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY`
- `NEXT_PUBLIC_AUTH_PHONE_ENABLED`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` optional
- `NEXT_PUBLIC_ENABLE_RESTAURANT_PACK` default `false`
- `NEXT_PUBLIC_ENABLE_RESTAURANT_AI_RECEPTIONIST` default `false`
- `NEXT_PUBLIC_ENABLE_KNOWLEDGE_BASE` default `true`
- `NEXT_PUBLIC_ENABLE_CREATOR_ASSET_LIBRARY` default `true`
- `NEXT_PUBLIC_ENABLE_GROWTH_CAMPAIGN_MEMORY` default `true`
- `NEXT_PUBLIC_ENABLE_LOCAL_VECTOR_ENGINE` default `false`
- `NEXT_PUBLIC_ENABLE_FACILITY_AUTOMATION` default `false`
- `NEXT_PUBLIC_ENABLE_WORLD_MODEL_RESEARCH` default `false`
- `NEXT_PUBLIC_ENABLE_MODEL_ROUTING` default `true`
- `NEXT_PUBLIC_ENABLE_GROWTH_TACTICS` default `true`

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
- `APP_URL` canonical production origin for server-side checkout, OAuth, and email links
- `SITE_URL` optional server-side alias for the canonical public site origin
- `SONARA_ADMIN_EMAILS` comma-separated owner/admin emails allowed to read admin support APIs
- `STRIPE_PRICE_STARTER` optional until paid launch
- `STRIPE_PRICE_CORE` optional until paid launch
- `STRIPE_PRICE_CREATOR` optional until paid launch
- `STRIPE_PRICE_SONARA_ONE_STARTER_MONTHLY` optional alias for Starter
- `STRIPE_PRICE_SONARA_ONE_CORE_MONTHLY` optional alias for Core
- `STRIPE_PRICE_CREATOR_STUDIO_MONTHLY` optional alias for Creator Studio
- `STRIPE_PRICE_GROWTH` optional until paid launch
- `STRIPE_PRICE_PRO` optional until paid launch
- `STRIPE_PRICE_AGENCY_SCALE` optional until paid launch
- `STRIPE_PRICE_SETUP_99` optional until paid launch
- `STRIPE_PRICE_SETUP_299` optional until paid launch
- `STRIPE_PRICE_SETUP_499` optional until paid launch
- `STRIPE_PRICE_SETUP_999` optional until paid launch
- `STRIPE_PRICE_BUSINESS_BUILDER_MONTHLY` optional future catalog
- `STRIPE_PRICE_BUSINESS_BUILDER_ONETIME` optional future catalog
- `STRIPE_PRICE_GROWTH_STUDIO_MONTHLY` optional future catalog
- `STRIPE_PRICE_RESTAURANT_PACK_ADDON` optional future catalog
- `STRIPE_PRICE_RESTAURANT_AI_RECEPTIONIST_ADDON` optional future catalog
- `STRIPE_PRICE_GROWTH_OUTREACH_ADDON` optional future catalog
- `GITHUB_TOKEN` optional for GitHub update reports

These are server-only. They must not appear in client bundles, static HTML, screenshots, support tickets, docs with real values, or AI prompts.

Stripe price env values must be Stripe Price IDs that start with `price_`. Do not enter dollar display values such as `$9/mo`, Product IDs such as `prod_...`, secret keys such as `sk_...`, publishable keys such as `pk_...`, webhook secrets such as `whsec_...`, or any value containing `/mo`.

## Support routing

- `SUPPORT_EMAIL`
- `SUPPORT_TO_EMAIL`
- `CONTACT_EMAIL`
- `HELP_EMAIL`
- `BILLING_EMAIL`
- `SECURITY_EMAIL`
- `PRIVACY_EMAIL`
- `LEGAL_EMAIL`
- `RESEND_FROM_EMAIL`

Inbound mail still requires DNS and provider verification. Outbound mail requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and either `SUPPORT_TO_EMAIL` or `SUPPORT_EMAIL`.

Public contact submissions post to `/api/contact`. That server route requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and either `SUPPORT_TO_EMAIL` or `SUPPORT_EMAIL` to store requests and send notification email. Admin queue reads use `/api/admin/contact-requests`, a Supabase bearer token, and `SONARA_ADMIN_EMAILS`.

## Google OAuth

The active Google auth path is Supabase Auth. Do not put `GOOGLE_CLIENT_SECRET` in Vercel public variables or client code. Configure the Google Client ID and Client Secret in Supabase Auth -> Providers -> Google.

`NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY` must stay `false` until:

- Google OAuth client type is `Web application`.
- Authorized JavaScript origins include the production origin.
- Supabase Auth redirect URI is authorized in Google Cloud:
  `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`.
- `NEXT_PUBLIC_SUPABASE_URL` exactly matches Supabase Project Settings -> API -> Project URL.

## Optional payment providers

- Stripe variables are optional until checkout and billing are enabled.
- Run `pnpm run check:stripe-prices` in an environment where Stripe vars are loaded to verify the launch price values.
- Square and PayPal credentials are optional future provider choices.
- Missing optional payment variables must not break static builds.
