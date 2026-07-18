# Shared Task Board

Updated: 2026-07-18 by Codex (Agent A)

## In progress

- [Codex] Finalize PR #27, deploy the Resend, legal, and pricing runtime correction, verify the exact production SHA, and inspect live readiness.

## Blocked / owner-dependent

- [Owner, immediate] Replace previously disclosed Supabase server access outside chat through approved secret-management surfaces.
- [Owner + Codex] Complete one authenticated Stripe test-mode lifecycle: checkout, signed webhook, persisted active entitlement, paid unlock, cancellation, and relock.
- [Owner + Codex] Complete one approved production Resend support/contact delivery and verify the persisted provider state.
- [Owner/legal counsel] Qualified legal review of the owner-approved launch baseline remains required; engineering cannot provide attorney approval.
- [Owner] Final refund, provider-account, tax, and operational policy sign-off remains a business responsibility.

## Ready for Codex (Agent A)

1. Verify PR #27 production readiness after merge: Resend configured/enabled, owner pricing approval, legal-review boundary, Stripe/webhook/checkout configured, and no fabricated paid state.
2. Run the approved Stripe lifecycle when an authenticated test customer is available.
3. Verify one approved Resend delivery and persistence audit.
4. Review hosted query/index telemetry after production workload accumulates.
5. Tighten the highest-risk generic OpenAPI payloads without changing deployed shapes.
6. Measure membership fallback usage and Business Builder referential integrity before proposing constraints.

## Ready for Agent B

1. Add the repository-owned browser harness for mobile/desktop PWA, accessibility, overflow, console, theme, and command-palette checks.
2. Verify production install, update, and offline behavior without intercepting authenticated/private responses.
3. Continue authenticated application-frame expansion as a separate bounded frontend task using existing route/backend contracts.
4. Keep Canvas scenes, sound, maps, and physical-device validation as separately approved work.

## Done

- [Codex] Production Supabase ledger now confirms 42/42 repository migrations; linked production schema lint passed.
- [Codex] Reconciled the legacy live `billing_subscriptions` table additively with the current Stripe webhook/query contract; no organization mapping was fabricated.
- [Codex] Removed the one-time production migration workflow after success.
- [Codex] Resend friendly-name sender validation repaired with placeholder and malformed-address regressions.
- [Owner + Codex] Existing Free, $7, $19, $39, and one-time pricing catalog recorded as owner-approved without price changes.
- [Owner + Codex] Legal pages recorded as owner-approved baseline while keeping qualified legal review required and attorney-review claims prohibited.
- [Codex] Stripe secret, webhook, plan-price, checkout, and paid-state boundaries preserved and regression-tested.
- [Codex] PR #25 merged deterministic membership and selective paid-access query hardening; Vercel deployed the exact merge SHA.
- [Codex] PR #23 merged the canonical PWA contract and private-cache exclusions.
