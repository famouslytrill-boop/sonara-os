# Test Matrix

Updated: 2026-07-18 by Codex (Agent A)

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

## Final branch evidence before shared-memory reconciliation

Implementation head `32cdd6656fcbad98b179ccacfbc32b38fd366fd6` passed:

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

## PWA executable coverage

- Public pages register the service worker only in allowed secure/local contexts.
- `/dashboard`, `/account`, `/admin`, APIs, private/no-store/cookie-bearing/opaque responses remain outside cache handling.
- Manifest, icons, shortcuts, cache version, and legacy redirect remain regression-tested.

## Evidence boundaries

- Production database migration completion is proven.
- Resend code/configuration readiness is regression-tested; a real production delivery remains pending.
- Stripe/checkout configuration is proven; the end-to-end payment/cancellation lifecycle remains pending.
- Legal owner approval is recorded, but attorney review is not claimed.
- PWA install/update/offline and physical vibration remain pending real-browser/device evidence.
