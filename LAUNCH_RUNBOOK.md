# SONARA Industries Launch Runbook

This runbook covers the remaining owner/manual steps for paid launch. The codebase is designed to run safely when external providers are missing.

## Architecture checks

- Keep Vercel Framework Preset set to `Other`.
- Keep root directory at the repository root.
- Keep `api/index.js` exporting `../server`.
- Keep `vercel.json` rewrites pointed at `/api`.
- Do not add Next.js dependencies.

## Required owner inputs

- Real Vercel environment variables.
- Real Supabase project URL, anon key, and service role key.
- Real Google OAuth client credentials and callback URL.
- Real Stripe products, prices, and webhook signing secret.
- Real Resend API key and verified sending domain.
- Qualified legal review.
- Final production smoke testing.

## Production preflight

1. Confirm `.env`, backups, logs, patches, and SQL dumps are not tracked.
2. Configure all variables from `.env.example` in Vercel.
3. Apply Supabase migrations `0001` through `0005`.
4. Submit a contact request and record the reference ID.
5. Check `/api/readiness`.
6. Test `/admin/env-readiness` with `ADMIN_ACCESS_TOKEN`.
7. Test Stripe Checkout in test mode.
8. Verify Stripe webhook delivery.
9. Verify Resend delivery from a verified domain.
10. Complete legal review before paid public launch.

## Pricing to configure

- Free: no Stripe price required.
- Starter monthly: $7.
- Core monthly: $19.
- Pro monthly: $39.
- Business Builder Setup: $99 one-time.

## Safety rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY`.
- Never display `ADMIN_ACCESS_TOKEN`.
- Do not enable live checkout until Stripe variables and price IDs are configured.
- Missing providers must show `setup_required`, not crash.
