# Current State — updated 2026-07-19 by Codex (Agent A)

## Paid-launch finalization — merged and deployed

- PR #27 merged to `main` as `88ee2d5dbf359972fc5eee64b322fed17192cbdf`.
- Vercel production deployment `dpl_DL1TXnuFjVZfT46pUPsEJT51XLAg` is `READY` for that exact merge SHA.
- Live `/api/health` reports commit `88ee2d5dbf359972fc5eee64b322fed17192cbdf`, branch `main`, environment `production`.
- Live `/api/readiness` reports Supabase, Stripe, Stripe webhook, Resend, admin protection, founder access, and every approved checkout plan configured; checkout and email delivery report enabled.
- Live readiness also reports `ownerLegalApproval=owner_approved`, `pricingCatalog=owner_approved`, `legalPages=review_required`, and `legalReviewBoundary=not_attorney_reviewed`.
- Production Supabase migration ledger confirms all 42 repository migrations applied, including Data API privilege hardening, the database readiness contract, and the operational query/index contract; linked schema lint passed.
- Migration 42 reconciles the legacy `billing_subscriptions` table additively, preserves compatible identifiers, creates the idempotent provider/subscription key, and installs the reviewed operational indexes without inventing organization ownership.
- Paid access still requires persisted active/trialing billing state or the documented owner/admin path. Checkout redirects do not grant access.

## Production baseline

- Root Express application: `server.js` exported by `api/index.js`; Vercel rewrites traffic to `/api`.
- Current production application main: `88ee2d5dbf359972fc5eee64b322fed17192cbdf`.
- Production database: 42/42 repository migrations.
- Canonical inventory: three schemas, 71 application tables, 10 functions, eight operational indexes, and seven private storage buckets.
- Pricing owner approval remains Free $0, Starter $7/month, Core $19/month, Pro $39/month, and the configured Business Builder one-time setup offer.
- Google OAuth remains deferred.

## Launch evidence boundary

- Database migration completion and exact-SHA production deployment are proven.
- Resend configuration and live readiness are proven configured/enabled; one real production delivery with a persisted provider result remains required before delivery is called operationally proven.
- Stripe, webhook, prices, and checkout configuration are proven; the full authenticated test-mode checkout → signed webhook → persisted entitlement → unlock → cancel → relock lifecycle remains unproven.
- Legal content is owner-approved but not attorney-reviewed; qualified legal review remains required.
- Previously disclosed Supabase server access still requires replacement outside chat before paid public launch.
- PWA install/update/offline and physical haptics still require reproducible browser/device evidence.

Detailed evidence is in `reports/PAID_LAUNCH_FINALIZATION_2026-07-18.md`, `HANDOFF_LOG.md`, `TEST_MATRIX.md`, the database contract, and the successful Vercel deployment metadata.