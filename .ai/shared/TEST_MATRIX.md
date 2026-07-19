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

`verify:launch` includes deterministic runtime application, build, tests, client-secret scan, lint, route smoke, database verification, configuration/route-registry verification, and OpenAPI drift verification.

## PR #30 payload-size coverage and release evidence

- `scripts/apply-payload-size-guard.cjs` applies idempotently and is part of `apply:runtime` and the Vercel build chain.
- A 96 KiB JSON object reaches normal routing, proving requests above the former 64 KiB ceiling are accepted.
- A structured JSON body above 1 MiB returns HTTP `413`, `ok=false`, `code=payload_too_large`, and `maxBytes=1048576`.
- Oversized failures are not wrapped or mislabeled as HTTP 400.
- The 413 guidance directs file/media bytes to approved signed private-storage uploads rather than embedding binary/base64 data in JSON.
- Stripe raw-body webhook parsing and signature verification remain unchanged.
- Exact PR #30 head `06215268470bfb5e9c7c64e3816e0810e6607b7a` passed:
  - SONARA Industries CI
  - dependency scan
  - Docker Image CI
  - frozen-lockfile install
  - dependency audit
  - typecheck, lint, complete test suite, and build
  - Supabase preview/migration validation
  - Vercel preview `dpl_2ZaFinPnMLsW77rLsxWgbCa2ENSK` READY
- PR #30 merged as `af25aabd73a2df94a5c30bd157a8e1bbd1fc6c6f`.
- Production deployment `dpl_3S2YokV2p4Bn9UY7k1Xidp5PQG8f` is READY and live `/api/health` reports the exact merge SHA on `main` in `production`.
- Live `/api/readiness` remains configured for Supabase, Stripe, webhook, Resend, admin/founder protection, checkout, email delivery, and approved plan prices.

## Production database evidence

- Production ledger remains 42/42 repository migrations.
- Linked schema lint passed.
- Migration 42 billing compatibility and eight operational indexes remain applied and verified.
- No migration or storage policy changed in PR #30.

## Billing and access coverage

- Paid entitlement/subscription selection remains organization-scoped, status-filtered, deterministic, and fail-closed for unknown mappings.
- Paid access derives from persisted active/trialing state or documented owner/admin authorization.
- Checkout redirects never grant paid access.
- Stripe configuration may report ready while `paidStatus` remains `not_verified` until the authenticated lifecycle is proven.

## PWA and security coverage

- Public pages alone register the service worker in allowed contexts.
- Authenticated/private routes, APIs, `private`/`no-store`/cookie-bearing/opaque responses remain outside cache handling.
- Client-secret scanning remains mandatory.
- Admin routes and provider-dependent features continue to fail closed when configuration is absent.

## Evidence boundaries

- Payload-size code, CI, preview, merge, deployment, live health, and readiness are proven.
- Direct-storage upload behavior for a specific large customer file was not fabricated; provider/global and bucket-specific object limits remain separate controls.
- One real Resend delivery with persisted provider evidence remains pending.
- The authenticated Stripe checkout/cancellation/relock lifecycle remains pending.
- Qualified legal review, credential replacement, PWA install/offline proof, and physical-device vibration remain pending.
