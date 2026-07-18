# Shared Task Board

Updated: 2026-07-18 by Codex (Agent A)

## In progress

- Release-evidence reconciliation for merged PR #23 only. No product files are locked.

## Blocked / owner-dependent

- [Owner, immediate] Rotate the previously disclosed Supabase server credential outside chat and update any server-only provider reference that used it.
- [Shared] Paid launch: valid sender configuration and delivery proof, Stripe test-mode lifecycle proof, and owner legal/pricing/refund/provider approvals.
- [Owner + Codex] Review and apply migrations 40 and 41 to the hosted Supabase project in order, then rerun database/security advisors and positive/negative authorization checks.
- [Owner + Codex] Authorize the read-only project-scoped Supabase MCP or provide operator credentials through an approved secret channel; do not place them in the repository or chat.

## Ready for Codex (Agent A)

1. Stripe test-mode proof: checkout -> signed webhook -> persisted active entitlement -> unlock -> cancel -> relock.
2. After sender configuration is corrected, verify readiness transition and one approved delivery.
3. Tighten the highest-risk generic OpenAPI payloads without changing deployed response shapes.
4. Measure membership fallback usage and Business Builder referential integrity before proposing additional constraints.
5. Verify post-merge PWA production headers/routes after Agent B supplies a reproducible browser harness.

## Ready for Agent B

1. Add a repository-owned browser harness for mobile/desktop PWA, accessibility, overflow, console, theme, and command-palette checks.
2. Verify production install/update/offline behavior at merge `277c3bb6c58bfe29399265a0dae52830c02d1d99` without caching authenticated/private responses.
3. Keep authenticated application-frame expansion, Canvas product scenes, sound, maps, and physical-device validation as separate bounded tasks.

## Done

- [Codex] PR #23 merged to `main` as `277c3bb6`; Vercel production status succeeded for the exact SHA. It delivers one canonical manifest, public-only secure service-worker registration, public navigation allowlisting, private-cache exclusion, product shortcuts, executable PWA tests, and synchronized shared contracts.
- [Codex] Final PR head `a108e190` passed application CI, dependency scan, Docker, Supabase repository validation, and Vercel preview before merge.
- [Codex] PR #21 merged the redesign/security/database contract; GitHub checks, Vercel production, live route smoke, and runtime-error inspection passed at the recorded release SHA.
- [Codex] Canonical 71-table/10-function/3-schema/7-bucket Supabase contract and protected readiness integration completed; production application remains owner-dependent.
- [Codex] Supabase Data API privilege hardening and authorization regressions completed; production application remains owner-dependent.
- [Agent B] Theme and haptics preference safety completed with executable tests and local browser proof.
- [Codex] OpenAPI runtime drift gate completed for the registered API surface.
- [Claude] Frontend route-surface audit completed with no reported real route/overflow/console defects in the recorded run.
