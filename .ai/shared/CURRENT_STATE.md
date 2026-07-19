# Current State — updated 2026-07-19 by Codex (Agent A)

## Production deployment and application baseline

- PR #27 merged the paid-launch application/database finalization to `main` as `88ee2d5dbf359972fc5eee64b322fed17192cbdf`.
- PR #28 merged shared production evidence as documentation-only commit `68bab71c5b98ad16692285a87549a3a09d10e492`.
- PR #29 merged retry/shared-state reconciliation as documentation-only commit `1472adca3beb03678272c9277285d3681b6e6688`.
- Vercel production deployment `dpl_Gf8df6GTsVDT7riAEJoYZGuzmAaM` was independently verified `READY` for exact `main` SHA `1472adca3beb03678272c9277285d3681b6e6688`.
- Live `/api/health` reported that exact SHA, branch `main`, environment `production`, and the Express runtime.
- The runtime-bearing application behavior remains the PR #27 baseline until the payload-size repair branch merges and deploys; PR #28 and PR #29 changed shared documentation only.
- Live `/api/readiness` reported Supabase, Stripe, Stripe webhook, Resend, admin protection, founder access, and every approved checkout plan configured; checkout and email delivery reported enabled.
- Live readiness also reported `ownerLegalApproval=owner_approved`, `pricingCatalog=owner_approved`, `legalPages=review_required`, and `legalReviewBoundary=not_attorney_reviewed`.
- Vercel production observability reported no runtime error clusters in the preceding 24 hours at the latest verification.

## Payload-size repair — branch implementation

- A reported failure surfaced as HTTP 400 wrapping an internal `413 Payload too large` response.
- The root Express runtime was confirmed to cap structured JSON bodies at only `64kb`, below the platform's intended structured-data workload.
- Branch `codex/fix-payload-too-large` adds an idempotent runtime patch that raises JSON and URL-encoded structured bodies to 1 MiB.
- Requests above 1 MiB return an explicit HTTP `413` response with `code=payload_too_large` and `maxBytes=1048576`; they are no longer mislabeled as HTTP 400.
- File bytes, base64 media, archives, audio, and video remain prohibited in general JSON bodies. Large files must upload directly to approved private storage through signed URLs.
- The repair changes no Supabase migration, bucket policy, provider configuration, pricing, legal content, paid-access rule, or customer data.

## Production database and access contract

- Production Supabase migration ledger confirms all 42 repository migrations applied, including Data API privilege hardening, the database readiness contract, billing compatibility reconciliation, and the operational query/index contract; linked schema lint passed.
- Migration 42 reconciles the legacy `billing_subscriptions` table additively, preserves compatible identifiers, creates the idempotent provider/subscription key, and installs the reviewed operational indexes without inventing organization ownership.
- Canonical inventory: three schemas, 71 application tables, 10 functions, eight operational indexes, and seven private storage buckets.
- Paid access requires persisted active/trialing billing state or the documented owner/admin path. Checkout redirects never grant paid access.
- Pricing owner approval remains Free $0, Starter $7/month, Core $19/month, Pro $39/month, and the configured Business Builder one-time setup offer.
- Google OAuth remains deferred.

## Retry verification after the failed Claude session

- The previous selected-model outage and Exit 144 are treated as execution-environment failures, not application failures.
- The requested local mount `/home/user/sonara-os` was absent in that execution environment, so the initial repository inspection command did not run and was not assumed complete.
- Every current file under `.ai/shared/` was read from GitHub `main`: 20 top-level files plus ADR-0001 through ADR-0010.
- Exact PR #27 head `01296554209837961ca8765bc2182902cda3313b` has successful SONARA Industries CI, dependency-scan, and Docker Image CI workflow runs.
- No Chromium, Playwright, Node server, or background process was started during that retry because no local checkout/memory baseline was available and no browser failure was reproduced.

## Launch evidence boundary

- Database migration completion, exact-SHA production deployments, live health/readiness, and absence of recent Vercel runtime errors are proven.
- Resend code and live configuration readiness are proven; one real production delivery with a persisted provider result remains required before delivery is called operationally proven.
- Stripe, webhook, prices, and checkout configuration are proven; the full authenticated test-mode checkout → signed webhook → persisted entitlement → unlock → cancel → relock lifecycle remains unproven.
- Legal content is owner-approved but not attorney-reviewed; qualified legal review remains required.
- Previously disclosed Supabase server access still requires replacement outside chat before paid public launch.
- PWA install/update/offline and physical haptics still require reproducible browser/device evidence.

Detailed evidence is in `reports/PAID_LAUNCH_FINALIZATION_2026-07-18.md`, `HANDOFF_LOG.md`, `TEST_MATRIX.md`, the API, database, and security contracts, GitHub workflow evidence, and Vercel production metadata.
