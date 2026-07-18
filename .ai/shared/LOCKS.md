# Locks

Active:
- LOCK: `.ai/shared/CURRENT_STATE.md`, `.ai/shared/TASK_BOARD.md`, `.ai/shared/HANDOFF_LOG.md`, `.ai/shared/CHANGELOG_AI.md`, `.ai/shared/RISKS.md`, `.ai/shared/TEST_MATRIX.md`
- OWNER: Codex (Agent A)
- PURPOSE: record PR #23 merge and exact-SHA Vercel production release evidence
- STARTED: 2026-07-18
- BRANCH: `codex/pwa-release-handoff`

History:
- RELEASED: canonical manifest, public-only service-worker registration, cache privacy, executable PWA tests, and shared handoff — Codex, completed 2026-07-18 in PR #23 after application CI, dependency, Docker, Supabase validation, and Vercel preview passed.
- RELEASED: PR #21 merge/production verification and credential-rotation handoff — Codex, completed 2026-07-18 after green main checks, exact-SHA Vercel production proof, route smoke, runtime-error inspection, and read-only DNS inventory.
- RELEASED: canonical Supabase database/agent contract, safe local/read-only MCP config, service-only metadata RPC, protected runtime readiness, verification/tests/docs/shared handoff — Codex, completed 2026-07-18 after rollback-only PostgreSQL execution, local Supabase lint, and full launch gates. Production migrations 40/41 remain owner-dependent.
- RELEASED: Supabase Data API privilege hardening migration/verifier/tests and database/security handoff contracts — Codex, completed 2026-07-18 after rollback-only local Postgres execution and full launch gates. Production application remains owner-dependent.
- RELEASED: preference safety renderer/assets/tests/report — Agent B, completed 2026-07-18 after behavioral tests, full gates, and local mobile/desktop Chrome checks.
- RELEASED: ADR-0010 membership compatibility inventory and shared contract/handoff reconciliation — Codex, completed 2026-07-18 after full local verification.
- RELEASED: Agent A Phase 0/1 backend audit, OpenAPI/runtime contract, accepted database/auth baselines, and shared handoff files — Codex, completed 2026-07-18 after all required local gates passed.
- RELEASED: frontend route-surface audit — Claude, completed 2026-07-18 with 248 recorded checks and expected fail-closed admin behavior.
- RELEASED: server.js presentation rewrite — Claude, layout/renderHead/footer presentation only; route handlers unchanged and test suite green.
