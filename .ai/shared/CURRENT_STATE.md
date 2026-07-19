# Current State — updated 2026-07-19 by Codex (Agent A)

## Production deployment and application baseline

- PR #27 merged the paid-launch application/database finalization to `main` as `88ee2d5dbf359972fc5eee64b322fed17192cbdf`.
- PR #28 merged shared production evidence as the documentation-only commit `68bab71c5b98ad16692285a87549a3a09d10e492`.
- Current Vercel production deployment `dpl_zBcP14sv6UumFxagChpFYSG15LjJ` is `READY` for exact `main` SHA `68bab71c5b98ad16692285a87549a3a09d10e492`.
- Live `/api/health` reports commit `68bab71c5b98ad16692285a87549a3a09d10e492`, branch `main`, environment `production`, and the Express runtime.
- The deployed runtime/application behavior remains the PR #27 baseline; PR #28 changed shared documentation only.
- Live `/api/readiness` reports Supabase, Stripe, Stripe webhook, Resend, admin protection, founder access, and every approved checkout plan configured; checkout and email delivery report enabled.
- Live readiness also reports `ownerLegalApproval=owner_approved`, `pricingCatalog=owner_approved`, `legalPages=review_required`, and `legalReviewBoundary=not_attorney_reviewed`.
- Vercel production observability reports no runtime error clusters in the last 24 hours at the time of this retry verification.

## Production database and access contract

- Production Supabase migration ledger confirms all 42 repository migrations applied, including Data API privilege hardening, the database readiness contract, billing compatibility reconciliation, and the operational query/index contract; linked schema lint passed.
- Migration 42 reconciles the legacy `billing_subscriptions` table additively, preserves compatible identifiers, creates the idempotent provider/subscription key, and installs the reviewed operational indexes without inventing organization ownership.
- Canonical inventory: three schemas, 71 application tables, 10 functions, eight operational indexes, and seven private storage buckets.
- Paid access requires persisted active/trialing billing state or the documented owner/admin path. Checkout redirects never grant paid access.
- Pricing owner approval remains Free $0, Starter $7/month, Core $19/month, Pro $39/month, and the configured Business Builder one-time setup offer.
- Google OAuth remains deferred.

## Retry verification after the failed Claude session

- The previous selected-model outage and Exit 144 are treated as execution-environment failures, not application failures.
- The requested local mount `/home/user/sonara-os` was absent in this execution environment, so the initial repository inspection command did not run and was not assumed complete.
- Every current file under `.ai/shared/` was read from GitHub `main`: 20 top-level files plus ADR-0001 through ADR-0010.
- Exact PR #27 head `01296554209837961ca8765bc2182902cda3313b` has successful SONARA Industries CI, dependency-scan, and Docker Image CI workflow runs.
- No Chromium, Playwright, Node server, or background process was started because no local checkout/memory baseline was available and no browser failure was reproduced.
- No production code or migration was changed. The confirmed repository defect was stale shared security/deployment documentation, which is being reconciled only.

## Launch evidence boundary

- Database migration completion, current exact-SHA deployment, live health/readiness, and absence of recent Vercel runtime errors are proven.
- Resend code and live configuration readiness are proven; one real production delivery with a persisted provider result remains required before delivery is called operationally proven.
- Stripe, webhook, prices, and checkout configuration are proven; the full authenticated test-mode checkout → signed webhook → persisted entitlement → unlock → cancel → relock lifecycle remains unproven.
- Legal content is owner-approved but not attorney-reviewed; qualified legal review remains required.
- Previously disclosed Supabase server access still requires replacement outside chat before paid public launch.
- PWA install/update/offline and physical haptics still require reproducible browser/device evidence.

Detailed evidence is in `reports/PAID_LAUNCH_FINALIZATION_2026-07-18.md`, `HANDOFF_LOG.md`, `TEST_MATRIX.md`, the database and security contracts, GitHub workflow evidence, and Vercel production metadata.
