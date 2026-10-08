# SONARA controlled activation gate — 2026-10-08

**Status:** Architecture and operator checklist; **NOT** production approval. This document does not enable routes, publish apps, apply migrations, move funds, or authorize a deploy.

## Verified inspection snapshot

- GitHub repo: `famouslytrill-boop/sonara-os`; inspected main SHA `0016633f94586d0ec4c22cb87363f2773ee3fc92` (merged PR #472).
- That main snapshot reported `protected: false` and zero repository rulesets. Do not infer a protected release merely from a green workflow.
- Main SHA check runs included failed `sonara-industries`, Node 24 and Node 26 compatibility jobs, with three shared failures in `tests/free-platform-surface-policy.test.js`. Draft PR #473 addresses the canonical UUID validator defect; **verify the final PR checks before merging**.
- Vercel project `sonara-os`: latest inspected production deployment `dpl_3DD5z9MrunPXajPqJojPaDLm1AzD` was `BLOCKED`, and project metadata reported `live: false`. Historical READY deployments are not proof of currently serving that SHA.
- Supabase project named `sonara-industries-prod` (ref `ltzpppffnwopdxbchajr`) reported `INACTIVE`; separate project ref `yqncsonkxgwhcxedgevk` reported `ACTIVE_HEALTHY` on preview channel. `docs/SONARA_DEPLOYMENT_TRUTH.md` describes the latter as a launch project. **Resolve the canonical production mapping with read-only evidence before any write or restore.**
- The existence of policy, mobile packaging, merchant, or reconciliation modules is not proof that a customer-facing service has been activated.

## P0: controlled production website release

1. **Change governance.** Protect `main` with review and required status checks; disallow force push and unreviewed bypass. Preserve exact-head CI evidence and signed/verified provenance where required. Do not merge or auto-release a draft PR.
2. **Code evidence.** Require Node 24 compatibility, relevant Node 22/26 lanes per current blocking policy, `pnpm install --frozen-lockfile`, audit, `pnpm run verify:launch`, `pnpm test`, Playwright, Lighthouse/accessibility, CodeQL/secrets, licensing, tenant-adversarial tests, and schema replay. A skipped required job is **not** a pass.
3. **Backend identity.** Cross-check Vercel production project, public URL, server Supabase URL, approved Supabase project ref, migration manifest/checksums and branch; never use a green unrelated preview project to prove production readiness.
4. **Controlled migration.** Generate and review diffs on an isolated database branch; require a rollback/restore plan, additive expand/contract changes, backfill plan, RLS and cross-tenant checks, and written migration approval. Never run an unreviewed `db push` against production.
5. **Provider contracts.** With owner-controlled configuration, test live Google/email sign-in and logout, one tenant-scoped write/read, negative cross-tenant access, server-only provider secrets, signed Stripe webhook idempotency, Resend delivery, and supported rate-limit failure behavior.
6. **Release match.** Build and test the **same immutable SHA** to be deployed. Stage production with no domain alias, validate health/route and authorized end-to-end tests, then deliberately promote under operator approval. Verify the custom domain, `/api/health` SHA, logs, monitoring, and rollback target.
7. **Completion evidence.** Record SHA, environment, provider/project IDs (not secrets), CI run IDs, migration checksum/replay results, preview URLs, owner sign-off, rollback SHA, and post-deploy findings. Set status `READY` only when all required checks pass and live smoke tests succeed.

## P1: opt-in social network / Growth Studio

- Existing research policy: `lib/sonara-free-platform-surface-policy.cjs` and `lib/sonara-community-discovery.cjs`. Discovery code is **not runtime-wired** as of inspection.
- Proposed data contracts after schema review: `social_profiles`, `public_post_projections`, `social_follows`, `social_consents`, `social_reports`, `moderation_decisions`, `social_action_events`. Do not create duplicate tables if canonical equivalents exist.
- Acceptance: server-derived user/tenant identity; deny by default on invalid UUID, tenant mismatch, blocked publishers, unmoderated posts, missing rights or consent; explicit discover opt-in; private visibility never appears in public projections; reports, takedowns, and appeals; per-tenant rate limits; no synthetic customer records or covert personalization.
- A closed one-tenant sandbox pilot is the first allowed runtime milestone. Public posting, recommendation, and campaign fan-out remain flag-disabled until review and abuse monitoring pass.

## P1: Android and iOS distribution

- Android implementation currently follows `docs/ANDROID_CAPACITOR_PLAN.md` and `docs/ANDROID_TWA_DEVICE_PROOF.md`: TWA/packaging **does not** equal Play-signed release or real-device proof.
- Android gate: exact-commit packaging CI, real Play signing fingerprint and `assetlinks.json`, tested internal track, passkeys/auth callback, push opt-in, app-link routing, offline public routes only, tenant-private cache exclusion, accessibility and real-device evidence.
- iOS: choose a reviewable native shell/compiled asset plan; verify signing, entitlements, Universal Links, app privacy labels, permissions and TestFlight checks before representing an App Store release. Do not claim iOS binaries from Android/PWA packaging.
- Classify each purchase SKU by goods/service type and storefront/region. App-store billing requirements can differ from web Stripe; get provider/policy review before presenting in-app digital purchase CTAs.

## P1: customer payments and financial infrastructure

- Preserve `docs/payments/PAYMENT_SYSTEM.md`: hosted processor/customer-connected account flow, no raw card/CVV/bank credentials, no unlicensed custody, stored-value wallet, escrow, customer-to-customer transfer, or lending.
- Existing policy `lib/sonara-money-pathway-guards.cjs` explicitly flags prohibited/unreviewed flows. Do not treat a pure classification guard as real provider execution authorization.
- For merchant and creator payments: verify connected account onboarding, beneficiary authority, hosted Checkout/direct charge suitability, provider-signed webhook, idempotent order state machine, settled ledger entries, refunds/disputes requiring owner approval, reversible reconciliation exceptions, and tenant RLS.
- Proposed logical records (use canonical schema equivalents): provider account reference, order, charge, fee, payout reference, refund/dispute, idempotency key, reconciliation exception, audit event. Never assume a checkout redirect represents settlement.
- Launch cost model: `contribution_margin = collected_platform_fees - processor_costs - infra_usage - fraud_losses - support_costs`. Monitor per-tenant margin and cap media/automation usage by entitlement and approved spending budget.

## Activation control plane (specification, not shipped)

For each subsystem `web`, `social`, `android`, `ios`, `merchant_payments`:

```text
DESIGN_ONLY -> IMPLEMENTED_OFF -> EVIDENCE_PENDING -> CANARY_APPROVED
  -> CANARY_ACTIVE -> RELEASE_APPROVED -> PUBLIC_ACTIVE
                      \-> ROLLBACK / SUSPENDED
```

Allowed activation transition requires: exact environment+SHA, current owner approval, all subsystem-specific test evidence, provider credentials and permissions, policy/legal review where needed, observability, resource limits, rollback plan. Missing evidence **denies** transition. Canary cannot mutate another tenant or approve its own expansion. Administrative actions and payments are audited.

## Engineering order

- **First:** close #473 and any other failing exact-head checks; protect main; reconcile Vercel/Supabase production identity; obtain staged release evidence. **Do not override an intentionally offline website.**
- **Second:** complete marketplace/merchant order-to-cash reconciliations on sandbox connected accounts with positive and negative tests; no real payouts.
- **Third:** consent-gated social pilot; Android internal testing; iOS proof-of-concept independently, each behind separate flags.
- **Fourth:** controlled production promotion and gradually expanding canaries only after owner approval and verifiable outcomes.

**Non-goals:** invented all-green certification, implicit main merge, production migration, site restoration, auto-publishing customer posts, app-store submission, custody or wallet service, and real-money transfer.
