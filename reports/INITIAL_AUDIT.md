# SONARA Complete Platform Upgrade - Initial Audit

Date: 2026-07-15
Branch: `launch/sonara-complete-platform-upgrade`
Baseline: local `main` was four commits ahead of `origin/main`; one pre-existing untracked file, `debug-session.cjs`, was preserved and excluded.

## Architecture at intake

- Root Express 4 application in `server.js`.
- Vercel entry in `api/index.js`; all traffic rewritten to `/api`.
- Six mounted route modules plus server-local routes.
- Supabase REST/Auth, Stripe Checkout/Portal/signed webhooks, and Resend delivery are server-side.
- Server-rendered HTML with progressive CSS/JavaScript and PWA assets under `public/`.
- Additive Supabase SQL migrations with RLS policies.

Path A was selected: stabilize the existing Express/Vercel application. See `docs/SONARA_ARCHITECTURE_DECISION.md`.

## Baseline proof

- `pnpm install --frozen-lockfile`: passed.
- `pnpm run verify:launch`: passed.
- 240 tests passed.
- Client-secret scan passed.
- 305 route registrations, 237 unique GET routes, zero duplicate method/path registrations.

## Verified initial gaps

- 35 required GET routes missing.
- No required-route metadata registry or sitemap proof.
- No forgot/reset password interface.
- No system/light/dark preference or persisted appearance setting.
- Haptics defaulted on unless explicitly disabled.
- Notification route/schema mismatch (`status` versus `read_at`).
- Audit writer/schema mismatch (`admin_audit_events.actor_user_id` versus `admin_audit_logs.actor_id`).
- Mixed npm/pnpm deployment commands and failure-masking verification scripts.
- Current audit, architecture decision, route map, and focused competitive research documents absent at the required paths.

## External state not proven locally

Production Supabase migrations/RLS, Stripe prices/webhook delivery, Resend sender verification, Vercel environment values, DNS, and the active production commit require authorized provider access and post-deployment checks.
