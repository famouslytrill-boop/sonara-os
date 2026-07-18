# Shared Task Board

Updated: 2026-07-18 by Codex (Agent A)

## In progress

- PR #23 review/merge decision for the verified public-only PWA contract. No product files remain locked after this handoff.

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
5. After PR #23 review, verify the merged production PWA manifest, public registration, offline fallback, and private-route non-interception on a real browser.

## Ready for Agent B

1. Add a repository-owned browser harness for mobile/desktop PWA, accessibility, overflow, console, theme, and command-palette checks.
2. Perform post-merge install/update/offline browser proof without caching authenticated/private responses.
3. Keep authenticated application-frame expansion, Canvas product scenes, sound, maps, and physical-device validation as separate bounded tasks.

## Done

- [Codex] PR #23 PWA convergence implementation: one canonical manifest, public-only secure service-worker registration, public navigation allowlist, private-cache exclusion, product shortcuts, and executable contract tests. Implementation head `a616aa604b5e298ad19d24a060bc9da067b1d314` passed application CI, dependency scan, Docker, Supabase repository validation, and Vercel preview.
- [Codex] PR #21 merged to `main`; GitHub checks, Vercel production, live route smoke, and runtime-error inspection passed at the recorded release SHA.
- [Codex] Canonical 71-table/10-function/3-schema/7-bucket Supabase contract and protected readiness integration completed; production application remains owner-dependent.
- [Codex] Supabase Data API privilege hardening and authorization regressions completed; production application remains owner-dependent.
- [Agent B] Theme and haptics preference safety completed with executable tests and local browser proof.
- [Codex] OpenAPI runtime drift gate completed for the registered API surface.
- [Claude] Frontend route-surface audit completed with no reported real route/overflow/console defects in the recorded run.
