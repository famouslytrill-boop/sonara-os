# SONARA Current State Audit

Date: 2026-07-15  
Branch: `launch/sonara-complete-platform-upgrade`  
Deployment target: `https://sonaraindustries.com`

## Executive finding

The active application is a root Express 4 app, not the historical Next.js prototype described by the older audit under `docs/audits/`. Vercel loads `api/index.js`, which exports `server.js`, and rewrites the full web surface to that function. Supabase is accessed through server-side REST/auth calls, Stripe through server-side Checkout, Portal, and signed webhooks, and Resend through server-only delivery calls.

The correct release path is to stabilize this architecture. Replacing it would put working auth, billing, webhook, database, and route behavior at unnecessary risk.

## Repository inventory

| Surface | Current implementation | Audit result |
| --- | --- | --- |
| Web runtime | `server.js` plus injected modules under `routes/` | Active source of truth |
| Vercel entry | `api/index.js` | Exports the root Express app |
| Static UI | Server-rendered HTML plus `public/` CSS/JS/PWA assets | Functional progressive enhancement |
| Database | Additive SQL under `supabase/migrations/` | RLS and service-role patterns present; production apply is external |
| Auth | Supabase email/password and HttpOnly customer/admin cookies | Functional when provider config is valid |
| Billing | Stripe Checkout, Customer Portal, HMAC webhook verification | Functional when keys, prices, and endpoint are configured |
| Email | Resend server-side delivery | Honest setup-required fallback |
| CI | GitHub Actions with pnpm, audit, syntax, lint, tests, build | Present; branch run requires push |
| Container | Root Dockerfile for the same Express runtime | Secondary deployment path only |

## Baseline proof before this upgrade

- `pnpm install --frozen-lockfile`: passed.
- `pnpm run verify:launch`: passed.
- Tests: 240 passing.
- Client secret scan: passed.
- Tracked worktree: clean; `debug-session.cjs` was already untracked and remains excluded.
- Express inventory: 305 registered routes, 237 unique GET routes, zero duplicate method/path pairs.

## Confirmed gaps at audit time

1. Thirty-five routes named in the product contract were not registered, including recovery, tutorials, account preferences, notifications, several product modules, six administrator views, sitemap, and robots.
2. There was no central machine-readable route registry containing visibility, sitemap, provider, role, plan, and readiness metadata.
3. Haptics were effectively enabled unless a user opted out, conflicting with the repository rule that optional sensory feedback defaults off.
4. There was no persisted appearance-mode or notification preference column.
5. The notification view expected a `status` column, while the migration defines `read_at` and `category`.
6. Administrator audit writes targeted `admin_audit_events` with `actor_user_id`; the schema defines `admin_audit_logs.actor_id`.
7. Package scripts and Vercel/Docker configuration mixed npm with the repository's pnpm policy, and several verification scripts hid failures with `|| echo`.
8. The root architecture/audit/route-map documents were missing or stale.

## Implemented closure

- Added `lib/sonara-route-registry.cjs` as the required-route metadata source of truth.
- Added and mounted `routes/sonara-route-registry-routes.cjs` for the missing public, recovery, account, product, and protected administrator pages.
- Added generated public sitemap, conservative robots policy, and a customer-safe public route JSON endpoint.
- Added system/light/dark appearance, auto/full/reduced/off visual-quality settings, and default-off haptics.
- Added password-recovery fragment handling without logging or retaining the access token in the address bar.
- Added the account preference migration and aligned notification/audit queries with the actual schema.
- Added launch configuration, route registry, and HTTP smoke proof gates.
- Standardized package/Vercel/Docker commands on pnpm.

## External readiness still required

No local code change can prove production provider state. Before a production announcement, an authorized operator must:

1. Review and apply the new Supabase migration.
2. Confirm production RLS behavior with real customer, admin, and cross-organization accounts.
3. Verify the Resend domain and sender.
4. Confirm Stripe live/test keys, price IDs, Portal configuration, and webhook delivery.
5. Confirm Vercel environment variables, custom domain, deployment commit, function logs, and route smoke results.
6. Have qualified counsel review legal templates and commerce language.

## Historical material

`docs/audits/SONARA_CURRENT_STATE_AUDIT.md` records an older branch and framework state. It is retained as history and is not the current release description.
