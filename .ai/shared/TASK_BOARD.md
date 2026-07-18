# Shared Task Board

Updated: 2026-07-18 by Codex (Agent A)

## In progress

- None.

## Blocked / owner-dependent

- [Owner, immediate] Replace the previously disclosed Supabase server access outside chat and update any server-only provider reference that used it.
- [Shared] Paid launch: valid sender configuration and delivery proof, Stripe test-mode lifecycle proof, and owner legal, pricing, refund, and provider approvals.
- [Owner + Codex] Review and apply migrations 40, 41, and 42 to the hosted Supabase project in timestamp order, then rerun database and security advisors, readiness, positive and negative authorization tests, and query-index checks.
- [Owner + Codex] Authorize the read-only project-scoped Supabase MCP or provide operator credentials through an approved secure channel; do not place them in the repository or chat.

## Ready for Codex (Agent A)

1. Stripe test-mode proof: checkout -> signed webhook -> persisted active entitlement -> unlock -> cancel -> relock.
2. After sender configuration is corrected, verify readiness transition and one approved delivery.
3. Tighten the highest-risk generic OpenAPI payloads without changing deployed response shapes.
4. Measure membership fallback usage and Business Builder referential integrity before proposing additional constraints.
5. After migrations 40–42 are approved and applied, measure the eight operational indexes against actual hosted cardinality and query statistics.
6. Verify post-merge PWA production headers and routes after Agent B supplies a reproducible browser harness.

## Ready for Agent B

1. Add a repository-owned browser harness for mobile and desktop PWA, accessibility, overflow, console, theme, and command-palette checks.
2. Verify production install, update, and offline behavior without caching authenticated or private responses.
3. Continue authenticated application-frame expansion as a separate bounded task using the existing backend and route contracts.
4. Keep Canvas product scenes, sound, maps, and physical-device validation as separate bounded tasks.

## Done

- [Codex] PR #25 merged to `main` as `9ca3487d`; Vercel production status succeeded for the exact SHA. It delivers deterministic membership resolution, selective paid-access queries, eight operational indexes, verifiers, regressions, research, reports, and synchronized shared contracts. Hosted migrations remain approval-dependent.
- [Codex] Final PR #25 head `b96bd14c` passed application CI, dependency scan, Docker, Supabase preview and migration validation, and Vercel preview before merge.
- [Codex] PR #23 merged to `main` as `277c3bb6`; Vercel production status succeeded for the exact SHA. It delivers one canonical manifest, public-only secure service-worker registration, public navigation allowlisting, private-cache exclusion, product shortcuts, executable PWA tests, and synchronized shared contracts.
- [Codex] PR #21 merged the redesign, security, and database contract; GitHub checks, Vercel production, live route smoke, and runtime-error inspection passed at the recorded release SHA.
- [Codex] Canonical 71-table, 10-function, 3-schema, 7-bucket Supabase contract and protected readiness integration completed; production application remains owner-dependent.
- [Codex] Supabase Data API privilege hardening and authorization regressions completed; production application remains owner-dependent.
- [Agent B] Theme and haptics preference safety completed with executable tests and local browser proof.
- [Codex] OpenAPI runtime drift gate completed for the registered API surface.
- [Claude] Frontend route-surface audit completed with no reported real route, overflow, or console defects in the recorded run.
