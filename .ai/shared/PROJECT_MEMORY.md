# SONARA Project Memory

Durable facts both agents must not re-derive. Update only with evidence.

## Identity

- Parent: SONARA Industries. Platform: SONARA OS.
- Products: Business Builder, Creator Studio, Growth Studio.
- Repo: `famouslytrill-boop/sonara-os`, default branch `main`.
- Production: `https://sonaraindustries.com` on Vercel.
- Supabase project ref: `yqncsonkxgwhcxedgevk`.
- Resend domain `sonaraindustries.com`: verified and sending-enabled; friendly-name sender validation is repaired in PR #27.
- Package manager: `pnpm@11.1.1` only. Never add `package-lock.json`.
- Canonical Supabase inventory: 3 schemas, 71 tables, 10 functions, 8 operational indexes, 7 private buckets.
- Production Supabase ledger is verified at 42/42 repository migrations as of 2026-07-18; linked production schema lint passed.
- Previously disclosed production access must be replaced through approved private configuration surfaces and never copied into repository or handoff files.

## Production runtime

- Root Express app in `server.js`, exported by `api/index.js`.
- Vercel rewrites traffic to `/api`; serverless function bundles `public/**`, `routes/**`, and `lib/**`.
- Nested `frontend/`, `my-app/`, `sonara-industries/`, and alternate `app/` trees are not the production runtime without a full-parity ADR.
- Pages are server-rendered by `layout()` with progressive enhancement from `public/sonara-*.js`.

## Database migration truth

- Migrations 40 and 41 harden Data API privileges and install the service-only database readiness contract.
- Migration 42 reconciles the legacy live `billing_subscriptions` table with the current Stripe webhook/query contract and installs reviewed indexes.
- Migration 42 preserves compatible legacy identifiers but does not invent organization ownership for unmapped historical rows.
- A one-time guarded workflow applied and verified the remote ledger, then was removed.

## Commercial truth

- Pricing owner approval: Free $0; Starter $7/month; Core $19/month; Pro $39/month; Business Builder setup one-time. Do not change without new owner approval.
- Stripe, webhook, prices, and checkout report configured. Paid access still requires persisted active/trialing state or explicit owner/admin authorization.
- Full Stripe lifecycle proof remains pending.
- Resend validation is repaired; real production delivery proof remains pending.
- Legal pages are an owner-approved launch baseline, not attorney-reviewed, not legal advice, and still require qualified legal review.

## Non-negotiables

- Truthful states only; no simulated success.
- Credentials stay server-side. RLS and webhook signatures stay enabled.
- Checkout redirects never grant paid access.
- The word `shell` must not appear in public HTML.
- Retired public names must not render.
- Required gates include `pnpm run verify:launch`, dependency audit, documentation checks, and diff validation.
