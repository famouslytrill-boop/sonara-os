# Current State — updated 2026-07-19 by Codex (Agent A)

## Production deployment and application baseline

- PR #30 merged the payload-size repair to `main` as `af25aabd73a2df94a5c30bd157a8e1bbd1fc6c6f`.
- Vercel production deployment `dpl_3S2YokV2p4Bn9UY7k1Xidp5PQG8f` is `READY` for that exact SHA and aliases `sonaraindustries.com`.
- Live `/api/health` reports commit `af25aabd73a2df94a5c30bd157a8e1bbd1fc6c6f`, branch `main`, environment `production`, and the Express runtime.
- Live `/api/readiness` continues to report Supabase, Stripe, Stripe webhook, Resend, admin/founder protection, checkout, email delivery, and every approved checkout plan configured.
- Legal state remains explicit: owner-approved baseline, `legalPages=review_required`, and `legalReviewBoundary=not_attorney_reviewed`.

## Payload-size repair — merged and deployed

- The root Express runtime previously capped structured JSON requests at `64kb`.
- JSON and URL-encoded structured request bodies now accept up to 1 MiB.
- Requests above 1 MiB return HTTP `413` with `code=payload_too_large` and `maxBytes=1048576`; the application no longer exposes the failure as an HTTP 400 wrapper.
- A 96 KiB JSON regression fixture proves normal structured objects clear the former limit.
- File bytes, base64 media, archives, audio, and video remain outside general JSON bodies. Large uploads must use approved signed direct-to-private-storage URLs.
- Stripe raw-body webhook registration and signature verification remain unchanged.
- PR #30 exact head passed SONARA Industries CI, dependency scan, Docker Image CI, Supabase preview/migration validation, full tests, build, and Vercel preview before merge.
- The repair changed no Supabase migration, bucket policy, RLS policy, provider configuration, pricing, legal content, paid-access rule, secret, or customer data.

## Production database and access contract

- Production Supabase migration ledger remains 42/42 with linked schema lint passed.
- Canonical inventory remains three schemas, 71 application tables, 10 functions, eight operational indexes, and seven private storage buckets.
- Paid access requires persisted active/trialing billing state or the documented owner/admin path. Checkout redirects never grant paid access.
- Pricing owner approval remains Free $0, Starter $7/month, Core $19/month, Pro $39/month, and the configured Business Builder one-time setup offer.
- Google OAuth remains deferred.

## Launch evidence boundary

- Database migration completion, payload-size application deployment, exact-SHA live health, and provider readiness are proven.
- Resend code and configuration readiness are proven; one real production delivery with a persisted provider result remains required before operational delivery is claimed.
- Stripe, webhook, prices, and checkout configuration are proven; the authenticated checkout → signed webhook → persisted entitlement → unlock → cancel → relock lifecycle remains unproven.
- Legal content is owner-approved but not attorney-reviewed; qualified legal review remains required.
- Previously disclosed Supabase server access still requires replacement outside chat before paid public launch.
- PWA install/update/offline and physical haptics still require reproducible browser/device evidence.

Detailed evidence is in `HANDOFF_LOG.md`, `TEST_MATRIX.md`, the API, database, and security contracts, GitHub workflow evidence, and Vercel deployment metadata.
