# SONARA Project Memory

Durable facts both agents must not re-derive. Update only with evidence.

## Identity
- Parent: SONARA Industries. Platform: SONARA OS.
- Products: Business Builder, Creator Studio, Growth Studio.
- Repo: `famouslytrill-boop/sonara-os`, default branch `main`.
- Production: https://sonaraindustries.com (Vercel).
- Supabase project ref: `yqncsonkxgwhcxedgevk` (us-east-2, ACTIVE_HEALTHY).
- Resend domain `sonaraindustries.com`: verified, sending enabled.
- Package manager: pnpm@11.1.1 ONLY. Never npm, never package-lock.json.

## Production runtime (verified 2026-07-16/18 — see ADR-0001)
- Root Express app in `server.js` (~4.5k lines), exported by `api/index.js`.
- Vercel rewrites ALL traffic to `/api`; functions bundle `public/**,routes/**,lib/**`.
- The nested `frontend/`, `my-app/`, `sonara-industries/`, `app/` folders are NOT
  the production runtime. Do not deploy them without a full-parity ADR.
- Pages are server-rendered by the shared `layout()` helper in server.js;
  progressive enhancement via `public/sonara-*.js`.

## Non-negotiables (from owner directives; enforced by tests)
- Truthful states only; no simulated success. Paid access = active/trialing DB
  subscription or explicit owner/admin override; never a checkout redirect.
- Secrets server-side only. RLS stays on. Signature checks stay on.
- The word "shell" must never appear in public HTML (tests reject /shell/i).
- Retired names (SONARA OS as public name, Signal OS, TrackFoundry, LineReady,
  NoticeGrid) must not render in public UI.
- Verification gates: `pnpm run verify:launch` (255+ mocha tests, build, lint,
  client-secret scan, route smoke, schema verify, route registry), `pnpm audit
  --audit-level moderate`, `pnpm run test:docs`, `git diff --check`.

## Pricing (do not change without approval — Stripe live values verified)
Free $0 · Starter $7/mo · Core $19/mo · Pro $39/mo · Business Builder setup
(one-time). All checkout-enabled in production readiness.
