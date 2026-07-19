# Current State — updated 2026-07-18 by Codex (Agent A)

## Paid-launch finalization — PR #27

- Production Supabase migration ledger now confirms all 42 repository migrations applied, including Data API privilege hardening, the canonical database readiness contract, and the operational query/index contract.
- The guarded production migration run verified the exact project reference, performed a dry run, applied only approved migration 42, confirmed migrations 40–42 in the remote ledger, and passed linked schema linting.
- The first attempt failed safely because the live `billing_subscriptions` table lacked canonical organization/provider columns. Migration 42 now reconciles that legacy table additively, preserves compatible identifiers, creates the idempotent provider/subscription key, and adds the reviewed operational indexes.
- Resend friendly-name sender validation is repaired while malformed and placeholder addresses remain rejected.
- The existing pricing catalog is recorded as owner-approved without changing Free, $7, $19, $39, or the configured one-time setup price.
- Legal pages are recorded as an owner-approved launch baseline while `legalPages` remains `review_required`; the interface states that qualified legal review remains required and does not claim attorney review.
- Stripe secret, webhook, all checkout prices, and checkout readiness remain configured. Paid access still requires persisted active/trialing billing state or the documented owner/admin path.
- Final implementation head before shared-memory reconciliation passed SONARA Industries CI, dependency scan, Docker Image CI, Supabase preview/migration validation, and the complete test suite.

## Production baseline

- Root Express application: `server.js` exported by `api/index.js`; Vercel rewrites traffic to `/api`.
- Current production application main remains `f72056e0ddb7a788c8fcd540d99fe8d564c777bc` until PR #27 merges and the exact merge SHA deploys.
- Production database is now at 42/42 repository migrations.
- Canonical inventory remains three schemas, 71 application tables, 10 functions, eight operational indexes, and seven private storage buckets.
- Google OAuth remains deferred.

## Launch evidence boundary

- Database migration completion is proven.
- Resend configuration validation is fixed in code; one real production delivery still must be observed before delivery is called proven.
- Stripe and checkout configuration are proven; the full test-mode checkout → signed webhook → persisted entitlement → unlock → cancel → relock lifecycle remains unproven.
- Pricing is owner-approved.
- Legal content is owner-approved but not attorney-reviewed; qualified legal review remains required.
- Previously disclosed Supabase server access still requires replacement outside chat before paid launch.
- PWA install/update/offline and physical haptics still require reproducible browser/device evidence.

Detailed evidence is in `reports/PAID_LAUNCH_FINALIZATION_2026-07-18.md`, `HANDOFF_LOG.md`, `TEST_MATRIX.md`, the database contract, and the migration diagnostics retained temporarily by GitHub Actions.
