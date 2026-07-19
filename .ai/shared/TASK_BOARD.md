# Shared Task Board

Updated: 2026-07-19 by Codex (Agent A)

## In progress

- [Codex] Payload-too-large repair on `codex/fix-payload-too-large`: raise structured JSON/form bodies from 64 KiB to 1 MiB, return a stable HTTP 413 contract, keep file bytes on direct signed storage uploads, pass required CI/Vercel gates, then merge and verify production.

## Blocked / owner-dependent

- [Owner, immediate] Replace previously disclosed Supabase server access outside chat through approved secret-management surfaces.
- [Owner + Codex] Complete one authenticated Stripe test-mode lifecycle: checkout, signed webhook, persisted active entitlement, paid unlock, cancellation, and relock.
- [Owner + Codex] Complete one approved production Resend support/contact delivery and verify the persisted provider state.
- [Owner/legal counsel] Qualified legal review of the owner-approved launch baseline remains required; engineering cannot provide attorney approval.
- [Owner] Final refund, provider-account, tax, and operational policy sign-off remains a business responsibility.

## Ready for Codex (Agent A)

1. Run the approved Stripe lifecycle when an authenticated test customer is available.
2. Verify one approved Resend delivery and persistence audit.
3. Review hosted query/index telemetry after production workload accumulates.
4. Tighten the highest-risk generic OpenAPI payloads without changing deployed shapes.
5. Measure membership fallback usage and Business Builder referential integrity before proposing constraints.

## Ready for Agent B

1. Add the repository-owned browser harness for mobile/desktop PWA, accessibility, overflow, console, theme, and command-palette checks.
2. Verify production install, update, and offline behavior without intercepting authenticated/private responses.
3. Continue authenticated application-frame expansion as a separate bounded frontend task using existing route/backend contracts.
4. Keep Canvas scenes, sound, maps, and physical-device validation as separately approved work.

## Done

- [Codex] Retried after the prior Claude selected-model outage and Exit 144 without assuming the failed invocation completed or treating it as an application failure.
- [Codex] Confirmed the requested local mount was unavailable in that runner, then read all 30 current `.ai/shared/` files from GitHub `main`, including ADR-0001 through ADR-0010, before making changes.
- [Codex] Verified exact PR #27 head CI, dependency scan, and Docker workflow success; verified production deployment evidence, live health/readiness, and no recent Vercel runtime error clusters.
- [Codex] Corrected stale shared security and deployment evidence in PR #29; no application code, migration, provider configuration, price, legal text, RLS policy, or customer data changed.
- [Codex] PR #27 merged as `88ee2d5dbf359972fc5eee64b322fed17192cbdf`; production Supabase ledger confirms 42/42 migrations and linked schema lint passed.
- [Codex] Resend friendly-name sender validation repaired with placeholder and malformed-address regressions.
- [Owner + Codex] Existing Free, $7, $19, $39, and one-time pricing catalog recorded as owner-approved without price changes.
- [Owner + Codex] Legal pages recorded as owner-approved baseline while keeping qualified legal review required and attorney-review claims prohibited.
- [Codex] Stripe secret, webhook, plan-price, checkout, and paid-state boundaries preserved and regression-tested.
- [Codex] PR #25 merged deterministic membership and selective paid-access query hardening; Vercel deployed the exact merge SHA.
- [Codex] PR #23 merged the canonical PWA contract and private-cache exclusions.
