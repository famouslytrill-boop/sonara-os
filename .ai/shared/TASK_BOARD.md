# Shared Task Board

Updated: 2026-07-18T07:35:16Z by Codex (Agent A)

## In progress

- Post-merge release handoff only; no product files locked.

## Blocked / owner-dependent

- [Owner, immediate] Revoke/rotate the server-side Supabase secret disclosed in chat. Replace the corresponding server-only provider/Vercel value if it was deployed anywhere, then redeploy and rerun readiness. Never send the replacement through chat or commit it.
- [Shared] Paid launch: valid `RESEND_FROM_EMAIL`, Stripe test-mode lifecycle proof, and owner legal/pricing/refund/provider approvals. Unrestricted live route smoke is now complete.
- [Owner + Codex] Review and apply `20260718064853_data_api_privilege_hardening.sql` to the hosted Supabase project, then rerun database/security advisors and positive/negative RLS checks. Production remains on 39 migrations until this occurs.
- [Owner + Codex] Authorize the read-only project-scoped Supabase MCP or provide CLI credentials outside the repo; review and apply migrations 40 and 41 in order, then verify the 71-table/10-function contract through `/api/admin/database-readiness`. No production apply occurred in the current task.

## Ready for Codex (Agent A)

1. Stripe test-mode end-to-end proof: checkout -> signed webhook -> persisted active entitlement -> unlock -> cancel -> relock. Update the billing report; do not mutate live mode without approval.
2. After the owner configures `RESEND_FROM_EMAIL`, verify the readiness transition and one approved test delivery. Update the email report.
3. Convert the highest-risk generic OpenAPI payloads to endpoint-specific schemas, beginning with checkout, webhook errors, authorization errors, and entitlement-gated records.
4. Measure membership fallback usage and live Business Builder referential integrity before proposing any ADR-0010 hardening migration.

## Ready for Agent B

1. **AGENT-B-NEXT: PWA contract convergence.** Coordinate and lock renderer/manifest/service-worker/test files; choose the one canonical served manifest, add safe service-worker registration only where supported, and verify install/offline/update behavior without caching authenticated/private responses.
2. Commit a reproducible browser harness or documented repository-owned runner for the affected PWA flow at mobile and desktop widths.
3. Keep authenticated application-frame, Canvas scenes, sound, maps, and physical-device validation as separate later tasks.

## Done

- [Codex] PR #21 merged to `main` as `4dccd109`; GitHub main CI/dependency/Docker checks passed; Vercel production is `READY` on that exact SHA; 15-route live smoke passed; Vercel reported no recent runtime errors; Cloudflare DNS zone/record-type inventory passed. No Supabase production migration or secret mutation occurred.
- [Codex] Commit `5d333b1` added the canonical 71-table, 10-function, 3-schema, 7-private-bucket Supabase contract; safe local config and read-only project-scoped MCP config; append-only service-role metadata readiness RPC; admin runtime integration; static/SQL/route regressions; and operator documentation. Rollback-only PostgreSQL execution and all 265-test launch gates pass. Production application remains owner-dependent.
- [Codex] Added append-only Data API/default-privilege hardening, corrected global-admin authorization to use `user_roles`, locked authorization helper search paths, revoked anonymous helper RPC execution, and added executable positive/negative regression gates in commit `4acb355`. Local SQL and all launch gates pass; production application remains owner-dependent.
- [Agent B] Preference safety/theme correctness in `af18a6f`: pre-paint canonical theme, opt-in/reduced-motion haptics, synchronized cache token, behavioral tests, and local 390/1440 Chrome proof.
- [Codex] ADR-0010 membership compatibility decision and source inventory; no migration or runtime behavior change.
- [Codex] Canonical OpenAPI baseline for 85 operations / 62 paths plus `verify:api` launch gate; no response-shape changes.
- [Codex] Phase 0 backend report and accepted database/auth/API contract baselines.
- [Agent B frontend subagent] Independent Phase 0 source/evidence review; no product changes.
- [Claude] Frontend route-surface audit: 124 canonical GET routes x 2 widths = 248 checks, with zero reported overflow, dead links, application console errors, or banned public-name leaks; 25 routes failed closed as expected without provider env.
- [Codex] Owner-supplied Clark redesign patch integrated and locally verified on `codex/integrate-clark-redesign`.
- [Claude] Recorded production database verification and owner-approved applied migrations on 2026-07-16.
