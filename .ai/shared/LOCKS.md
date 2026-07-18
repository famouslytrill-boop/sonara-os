# Locks

History:
- RELEASED: canonical Supabase database/agent contract, safe local/read-only MCP config, service-only metadata RPC, protected runtime readiness, verification/tests/docs/shared handoff - Codex, completed 2026-07-18T03:20-04:00 after rollback-only 3/71/10 PostgreSQL execution, local Supabase lint, 265 tests, and the full launch gate passed. Production migrations 40/41 remain owner-dependent.
- RELEASED: Supabase Data API privilege hardening migration/verifier/tests and database/security handoff contracts - Codex, completed 2026-07-18T02:56-04:00 in commit `4acb355` after rollback-only local Postgres execution, 262 tests, and the full launch gate passed. Production application remains owner-dependent.
- RELEASED: preference safety renderer/assets/tests/report - Agent B frontend subagent, completed 2026-07-18T02:28-04:00 in commit af18a6f after behavioral tests, full gates, and local 390/1440 Chrome checks passed.
- RELEASED: ADR-0010 membership compatibility inventory and shared contract/handoff reconciliation - Codex, completed 2026-07-18T02:28-04:00 in commit 0182d32 after full local verification.
- RELEASED: Agent A Phase 0/1 backend audit, OpenAPI/runtime contract, accepted database/auth baselines, and shared handoff files - Codex, completed 2026-07-18T02:14-04:00 in commit 61dae0a after all required local gates passed.
- RELEASED: reports/AGENT_B_PHASE0_REVIEW.md - Agent B frontend subagent, completed 2026-07-18T02:03-04:00 with a source-only Phase 0 review and no product changes.
- RELEASED: shared patch-integration handoff files - Codex, completed 2026-07-18T04:10Z after full local verification.
- RELEASED: frontend route-surface audit — Claude, completed 2026-07-18T04:55Z with reports/FRONTEND_AUDIT_REPORT.md (248 checks; zero real defects; 503 fail-closed admin routes expected).
- RELEASED: server.js — Claude, layout()/renderHead/footer presentation rewrite (commit "Redesign visual system"). Route handlers untouched; 255-test suite green.
