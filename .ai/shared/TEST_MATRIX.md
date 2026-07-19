# Test Matrix

Updated: 2026-07-19 by Codex (Agent A)

## Required repository gates

- `pnpm install --frozen-lockfile`
- `pnpm audit --audit-level moderate`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
- `pnpm run verify:launch`
- `pnpm run test:docs`
- `git diff --check`

`verify:launch` runs deterministic runtime application, build, tests, client-secret scan, lint, route smoke, repository database verification, launch configuration/route-registry verification, and OpenAPI drift verification.

## Payload-size repair coverage

- `scripts/apply-payload-size-guard.cjs` must apply idempotently and remain in the `apply:runtime`/Vercel build chain.
- A JSON object above the previous 64 KiB ceiling (96 KiB regression fixture) must reach normal routing rather than fail body parsing.
- A structured JSON body above 1 MiB must return HTTP `413`, `ok=false`, `code=payload_too_large`, and `maxBytes=1048576`.
- Oversized failures must not be wrapped or mislabeled as HTTP 400.
- The 413 message must direct file/media bytes to approved signed private-storage uploads rather than embedding base64/binary data in JSON.
- Stripe raw-body webhook parsing and signature verification must remain unchanged.

## Retry verification after Claude model outage / Exit 144

- The requested local mount `/home/user/sonara-os` was absent in the prior execution environment. The initial lightweight Git command bundle did not run and was not assumed complete.
- Every current file under `.ai/shared/` was read from GitHub `main`: 20 top-level files plus ADR-0001 through ADR-0010.
- The previous selected-model outage and Exit 144 were classified as execution-environment failures, not application failures.
- Exact PR #27 head `01296554209837961ca8765bc2182902cda3313b` has successful SONARA Industries CI, dependency-scan, and Docker Image CI workflow runs.
- PR #29 documentation reconciliation merged as `1472adca3beb03678272c9277285d3681b6e6688`; Vercel production deployment `dpl_Gf8df6GTsVDT7riAEJoYZGuzmAaM` was READY and live health reported the exact SHA.
- Live readiness reported Supabase, Stripe, webhook, Resend, admin/founder protection, checkout, email delivery, and all approved plan prices configured; Google OAuth deferred; legal review boundary not attorney-reviewed.
- Vercel production observability reported no runtime error clusters in the preceding 24 hours.

## Production database evidence

A guarded one-time workflow completed against exact project `yqncsonkxgwhcxedgevk`:

- exact project-ref and required credential-presence check: pass
- linked migration list: pass
- `supabase db push --linked --dry-run --include-all`: pass
- unexpected pending-migration rejection: pass
- production migration application: pass
- remote ledger verification for `20260718064853`, `20260718071148`, and `20260718193000`: pass
- `supabase db lint --linked --level error --fail-on error`: pass
- final CLI state: remote database up to date; no schema errors found

The temporary migration workflow was removed after success.

## Billing schema and query coverage

- Canonical/compatibility membership resolution is deterministic before `limit=1`.
- Paid entitlement and subscription filtering occurs in PostgREST by organization, allowed key, and active state.
- Unknown product mappings fail closed.
- Migration 42 additively reconciles all current `billing_subscriptions` fields and asserts their existence.
- Legacy Stripe customer/subscription and plan identifiers are preserved when compatible source columns exist.
- Unique `(provider, provider_subscription_ref)` upsert support is declared and asserted.
- Eight operational indexes reference canonical tables, are asserted valid/ready, add no tables or grants, and do not disable RLS.

## Paid-launch finalization coverage

- Runtime patches are idempotent.
- Resend friendly-name senders are accepted; placeholder addresses remain rejected.
- Readiness exposes pricing owner approval and legal owner approval separately from required qualified review.
- Every legal page keeps `qualified legal review`, `not legal advice`, and non-attorney-review wording.
- Pricing remains Free, $7, $19, $39, and one-time.
- Stripe, webhook, all plan prices, and checkout can report configured/enabled without changing `paidStatus: not_verified`.
- Client-secret scan remains mandatory.

## PWA executable coverage

- Public pages register the service worker only in allowed secure/local contexts.
- `/dashboard`, `/account`, `/admin`, APIs, private/no-store/cookie-bearing/opaque responses remain outside cache handling.
- Manifest, icons, shortcuts, cache version, and legacy redirect remain regression-tested.

## Evidence boundaries

- Production database migration completion and exact-SHA deployments are proven.
- Resend code and live configuration readiness are proven; a real production delivery with persisted provider evidence remains pending.
- Stripe/webhook/checkout configuration is proven; the authenticated payment/cancellation lifecycle remains pending.
- Legal owner approval is recorded, but attorney review is not claimed and qualified review remains required.
- PWA install/update/offline and physical vibration remain pending real-browser/device evidence.
