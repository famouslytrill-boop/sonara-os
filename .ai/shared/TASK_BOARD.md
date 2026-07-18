# Shared Task Board

Updated: 2026-07-18T06:30:00Z by Codex (Agent A)

## In progress

- None after the current membership/shared-memory coordination commit completes.

## Blocked / owner-dependent

- [Shared] Paid launch: valid `RESEND_FROM_EMAIL`, Stripe test-mode lifecycle proof, unrestricted live smoke, and owner legal/pricing/refund/provider approvals.
- [Shared] Push, PR, merge, and deployment of `codex/integrate-clark-redesign` remain owner-directed; branch and browser evidence are local only.

## Ready for Codex (Agent A)

1. Stripe test-mode end-to-end proof: checkout -> signed webhook -> persisted active entitlement -> unlock -> cancel -> relock. Update the billing report; do not mutate live mode without approval.
2. After the owner configures `RESEND_FROM_EMAIL`, verify the readiness transition and one approved test delivery. Update the email report.
3. Convert the highest-risk generic OpenAPI payloads to endpoint-specific schemas, beginning with checkout, webhook errors, authorization errors, and entitlement-gated records.
4. Measure membership fallback usage and live Business Builder referential integrity before proposing any ADR-0010 hardening migration.
5. Verify and address Supabase advisor findings with append-only migrations and positive/negative RLS tests.

## Ready for Agent B

1. **AGENT-B-NEXT: PWA contract convergence.** Coordinate and lock renderer/manifest/service-worker/test files; choose the one canonical served manifest, add safe service-worker registration only where supported, and verify install/offline/update behavior without caching authenticated/private responses.
2. Commit a reproducible browser harness or documented repository-owned runner for the affected PWA flow at mobile and desktop widths.
3. Keep authenticated application-frame, Canvas scenes, sound, maps, and physical-device validation as separate later tasks.

## Done

- [Agent B] Preference safety/theme correctness in `af18a6f`: pre-paint canonical theme, opt-in/reduced-motion haptics, synchronized cache token, behavioral tests, and local 390/1440 Chrome proof.
- [Codex] ADR-0010 membership compatibility decision and source inventory; no migration or runtime behavior change.
- [Codex] Canonical OpenAPI baseline for 85 operations / 62 paths plus `verify:api` launch gate; no response-shape changes.
- [Codex] Phase 0 backend report and accepted database/auth/API contract baselines.
- [Agent B frontend subagent] Independent Phase 0 source/evidence review; no product changes.
- [Claude] Frontend route-surface audit: 124 canonical GET routes x 2 widths = 248 checks, with zero reported overflow, dead links, application console errors, or banned public-name leaks; 25 routes failed closed as expected without provider env.
- [Codex] Owner-supplied Clark redesign patch integrated and locally verified on `codex/integrate-clark-redesign`.
- [Claude] Recorded production database verification and owner-approved applied migrations on 2026-07-16.
