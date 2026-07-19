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

- The runtime patch is idempotent.
- Resend friendly-name senders are accepted.
- Placeholder addresses inside friendly-name syntax remain rejected.
- Readiness exposes pricing owner approval and legal owner approval separately from required qualified review.
- Every legal page keeps `qualified legal review`, `not legal advice`, and non-attorney-review wording.
- Pricing remains Free, $7, $19, $39, and one-time.
- Stripe, webhook, all plan prices, and checkout can report configured/enabled without changing `paidStatus: not_verified`.
- Client-secret scan remains mandatory.

## PR #27 branch and production evidence

Exact PR head `01296554209837961ca8765bc2182902cda3313b` passed:

- SONARA Industries CI
- dependency scan
- Docker Image CI
- frozen-lockfile install
- dependency audit at moderate threshold
- typecheck
- lint
- complete Mocha suite
- build
- Supabase preview/migration validation
- Vercel preview

PR #27 then merged as `88ee2d5dbf359972fc5eee64b322fed17192cbdf`.

Production verification:

- Vercel deployment `dpl_DL1TXnuFjVZfT46pUPsEJT51XLAg`: `READY`
- deployment target: production
- deployment Git SHA: exact merge SHA
- `/api/health`: 200; Express runtime; branch `main`; environment `production`; exact merge SHA
- `/api/readiness`: 200
- Supabase: configured
- Stripe secret: configured
- Stripe webhook: configured
- every approved paid checkout plan: enabled/configured
- Resend: configured
- email delivery: enabled
- pricing catalog: owner-approved
- legal owner approval: owner-approved
- legal pages: review-required
- legal review boundary: not attorney-reviewed
- invalid Resend fields: none

## PWA executable coverage

- Public pages register the service worker only in allowed secure/local contexts.
- `/dashboard`, `/account`, `/admin`, APIs, private/no-store/cookie-bearing/opaque responses remain outside cache handling.
- Manifest, icons, shortcuts, cache version, and legacy redirect remain regression-tested.

## Evidence boundaries

- Production database migration completion and exact-SHA deployment are proven.
- Resend code and live configuration readiness are proven; a real production delivery with persisted provider evidence remains pending.
- Stripe/webhook/checkout configuration is proven; the authenticated payment/cancellation lifecycle remains pending.
- Legal owner approval is recorded, but attorney review is not claimed and qualified review remains required.
- PWA install/update/offline and physical vibration remain pending real-browser/device evidence.