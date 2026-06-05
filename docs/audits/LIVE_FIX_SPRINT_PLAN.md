# SONARA Industries Live Fix Sprint Plan

## Current State

- Repo: `C:\Users\AXPAY\signal-os`
- Branch: `main`
- Package manager: `pnpm@11.1.1` from `package.json`
- Node baseline: local Node v22.x is supported and should remain supported.
- Live domain target: `https://sonaraindustries.com`

## Baseline Checks

- `pnpm run check:env-safety`: passed before changes.
- `pnpm run typecheck`: passed before changes.
- `pnpm run build`: passed before changes.
- `pnpm run check:risky-features`: failed because the scanner treated docs, policy files, migrations, registries, and blocked-use safety copy as unsafe implementation.

## Current Live Routes

The local smoke test checks public support, legal, auth, product, research, and app route files. The live smoke script adds HTTP checks for `/`, `/login`, `/onboarding`, `/contact`, `/support`, `/help`, `/feedback`, `/pricing`, `/trust`, product routes, Research Lab, and legal privacy/terms pages.

## Env Status

- `.env.example` contains placeholder names and public inbox addresses only.
- `.env.local` must remain uncommitted and must not be printed.
- Public browser auth must read only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server-only keys include `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, Stripe secret keys, webhook secrets, and provider credentials.

## Email Status

- Support/contact/feedback forms exist and already validate input, use consent, and include a honeypot field.
- Outbound support email was stubbed before this sprint. The fix adds a server-only Resend HTTP adapter that sends only when `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the routed recipient are configured.
- Because a prior Resend key was exposed externally, docs must require rotation and Vercel sensitive env storage.

## Login/Auth Status

- Auth diagnostics already detect missing or malformed public Supabase config.
- Browser auth must show `Supabase public URL is misconfigured. Check NEXT_PUBLIC_SUPABASE_URL in Vercel.` for fetch/malformed URL failures.
- Login previously defaulted redirects through `/os`; the fix moves default login completion to `/onboarding`.
- Google OAuth provider setup remains a Supabase dashboard task.

## Supabase/SQL Status

- Server admin client files use `import "server-only"`.
- Migrations include `organization_memberships` dependency repairs and production workspace RLS hardening.
- Owner/admin bootstrap needs a safe SQL script that first verifies the auth user exists and does not rely on missing conflict constraints.

## Files Planned For Change

- `package.json`
- `.gitignore`
- `.github/workflows/*`
- `components/LoginForm.tsx`
- `components/support/*`
- `lib/email/*`
- `lib/support/*`
- `lib/readiness/production.ts`
- `scripts/check-risks.mjs`
- `scripts/verify-email-env.mjs`
- `scripts/test-email-config.mjs`
- `scripts/smoke-live-routes.mjs`
- `scripts/sql/*`
- launch/auth/email/admin/docs and final audit reports

## Manual Dashboard Actions Still Required

- Rotate any exposed Resend key and confirm the old key is revoked.
- Add the new `RESEND_API_KEY` as a sensitive server-only Vercel env var.
- Confirm Resend domain verification and SPF/DKIM/DMARC records.
- Confirm Supabase Google provider is enabled.
- Add the Supabase callback URL in Google Cloud and Supabase Auth redirect URLs.
- Sign in once with the owner email before running owner bootstrap SQL.
- Rerun Supabase Preview and GitHub Actions before merge.
- Final human review before deployment or production confidence claims.
