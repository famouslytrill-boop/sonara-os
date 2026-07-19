# Shared Task Board

Updated: 2026-07-19 by Codex (Agent A)

## In progress

- None.

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

- [Codex] PR #30 fixed payload-too-large request handling, passed application CI/dependency/Docker/Supabase/Vercel gates, merged as `af25aabd73a2df94a5c30bd157a8e1bbd1fc6c6f`, and deployed READY as `dpl_3S2YokV2p4Bn9UY7k1Xidp5PQG8f`.
- [Codex] Structured JSON/form bodies now support 1 MiB; oversized bodies return HTTP 413 with a stable contract; large file/media bytes remain direct signed-storage uploads.
- [Codex] Retried after the prior Claude selected-model outage and Exit 144 without assuming the failed invocation completed or treating it as an application failure.
- [Codex] Read all 30 current `.ai/shared/` files, including ADR-0001 through ADR-0010, before changes.
- [Codex] Corrected stale shared security and deployment evidence in PR #29.
- [Codex] PR #27 completed paid-launch application/database finalization; production Supabase ledger remains 42/42 with linked schema lint passed.
- [Codex] Resend friendly-name validation, Stripe paid-state boundaries, deterministic membership queries, operational indexes, and PWA cache privacy remain regression-tested.
