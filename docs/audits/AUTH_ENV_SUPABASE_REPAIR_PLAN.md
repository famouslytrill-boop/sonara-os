# Auth Env Supabase Repair Plan

Date: 2026-06-04
Branch: sonara-one-full-project-update-v101
Base commit: f6795bb

## Current Auth Routes

- `/login`
- `/signup`
- `/auth/callback`
- `/forgot-password`
- `/reset-password`
- `/app/settings/security`
- `/app/settings/readiness`
- `/app/admin/owner-bootstrap`

This repo uses a static web shell under `packages/web/src`, not a Next.js App Router runtime. Repairs are implemented in the existing route manifest and renderer.

## Current Supabase Client Files

- `packages/web/src/lib/env.ts`
- `packages/web/src/lib/supabase/admin.ts`
- `packages/web/src/lib/supabase/auth-policy.ts`
- `packages/web/src/lib/supabase/environment-check.ts`
- `packages/web/src/lib/supabase/service-role-guard.ts`

Browser-visible auth diagnostics already read only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Expected Env Vars

Public by design:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_VERCEL_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`
- `NEXT_PUBLIC_AUTH_PHONE_ENABLED`

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Bootstrap Gaps

- The auth user must exist in Supabase `auth.users` before owner/admin membership can be assigned.
- Organization inserts must account for required schema columns such as `company_key`.
- Bootstrap SQL must use placeholders and avoid committing a real personal email.

## Manual Provider Setup Still Required

- Enable Google provider in Supabase.
- Configure Google OAuth client ID and client secret.
- Configure Supabase redirect URLs.
- Update Vercel env vars rather than blindly adding duplicates.
- Verify Cloudflare Email Routing destination and DNS.
- Configure outbound email provider and test delivery.

## Fixes Being Made

1. Add explicit Google and phone auth feature flag status.
2. Add safe site URL and callback URL helpers.
3. Add auth environment and provider status UI.
4. Add auth status/admin setup routes.
5. Add schema-aware owner bootstrap SQL generator and helper SQL docs.
6. Add Vercel env update guidance, Cloudflare email routing checklist, and Supabase Google provider checklist.
7. Add smoke checks for auth config, admin bootstrap, and support readiness.
