# Shared Task Board

Updated: 2026-07-18T06:15:00Z by Codex (Agent A)

## In progress

- None after the current contract/audit commit completes.

## Blocked / owner-dependent

- [Shared] Paid launch: valid `RESEND_FROM_EMAIL`, Stripe test-mode lifecycle proof, unrestricted live smoke, and owner legal/pricing/refund/provider approvals.
- [Shared] Push, PR, merge, and deployment of `codex/integrate-clark-redesign` remain owner-directed; branch evidence is local only.

## Ready for Codex (Agent A)

1. Stripe test-mode end-to-end proof: checkout -> signed webhook -> persisted active entitlement -> unlock -> cancel -> relock. Update the billing report; do not mutate live mode without approval.
2. After the owner configures `RESEND_FROM_EMAIL`, verify the readiness transition and one approved test delivery. Update the email report.
3. Propose the membership naming compatibility ADR before any organization/workspace/business/entity membership migration or API rename.
4. Convert the highest-risk generic OpenAPI payloads to endpoint-specific schemas, beginning with checkout, webhook errors, authorization errors, and entitlement-gated records.
5. Verify and address Supabase advisor findings with append-only migrations and positive/negative RLS tests.

## Ready for Agent B

1. **AGENT-B-NEXT: Preference safety and theme correctness.** Coordinate and lock the render-head/public asset/test files; establish one theme attribute, initialize it before paint, remove unconditional vibration, and add behavioral tests proving no vibration before opt-in or under reduced motion.
2. Rerun reproducible browser interaction checks at 390 and 1440 pixels and refresh only the evidence affected by that repair.
3. Keep authenticated application-frame, PWA registration, Canvas scenes, sound, maps, and deployment as separate later tasks.

## Done

- [Codex] Canonical OpenAPI baseline for 85 operations / 62 paths plus `verify:api` launch gate; no response-shape changes.
- [Codex] Phase 0 backend report and accepted database/auth/API contract baselines.
- [Agent B frontend subagent] Independent Phase 0 source/evidence review; no product changes. Report: `reports/AGENT_B_PHASE0_REVIEW.md`.
- [Claude] Frontend route-surface audit: 124 canonical GET routes x 2 widths = 248 checks, with zero reported overflow, dead links, application console errors, or banned public-name leaks; 25 routes failed closed as expected without provider env.
- [Codex] Owner-supplied Clark redesign patch integrated and locally verified on `codex/integrate-clark-redesign`.
- [Codex] PR #20 launch verification documentation merged previously.
- [Claude] Recorded production database verification and owner-approved applied migrations on 2026-07-16.
