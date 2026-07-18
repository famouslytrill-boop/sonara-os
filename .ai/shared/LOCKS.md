# Locks

Active:
- LOCKED: paid-launch finalization — Codex (Agent A), branch `codex/finalize-paid-launch`, started 2026-07-18. Scope: Resend sender validation, owner-approved pricing/legal launch markers, Stripe/checkout verification, one-time Supabase migration runner, tests, reports, and overlapping shared-memory files. Do not edit these areas until released.

History:
- RELEASED: operational database index contract, deterministic membership and manager resolution, selective paid-access queries, migration verifiers, regressions, research, report, and shared handoff — Codex, completed 2026-07-18 in PR #25 after application CI, dependency scan, Docker, Supabase preview and migration validation, and Vercel preview passed. Hosted migration 42 remains approval-dependent after migrations 40 and 41.
- RELEASED: PR #23 merge and exact-SHA Vercel production handoff — Codex, completed 2026-07-18 after shared current-state, task, test, risk, changelog, and handoff reconciliation.
- RELEASED: canonical manifest, public-only service-worker registration, cache privacy, executable PWA tests, and shared handoff — Codex, completed 2026-07-18 in PR #23 after application CI, dependency, Docker, Supabase validation, and Vercel preview passed.
- RELEASED: PR #21 merge and production verification plus credential-rotation handoff — Codex, completed 2026-07-18 after green main checks, exact-SHA Vercel production proof, route smoke, runtime-error inspection, and read-only DNS inventory.
- RELEASED: canonical Supabase database and agent contract, safe local and read-only MCP config, service-only metadata RPC, protected runtime readiness, verification, tests, docs, and shared handoff — Codex, completed 2026-07-18 after rollback-only PostgreSQL execution, local Supabase lint, and full launch gates. Production migrations remain approval-dependent.
- RELEASED: Supabase Data API privilege hardening migration, verifier, tests, and database and security handoff contracts — Codex, completed 2026-07-18 after rollback-only local Postgres execution and full launch gates. Production application remains approval-dependent.
- RELEASED: preference safety renderer, assets, tests, and report — Agent B, completed 2026-07-18 after behavioral tests, full gates, and local mobile and desktop Chrome checks.
- RELEASED: ADR-0010 membership compatibility inventory and shared contract and handoff reconciliation — Codex, completed 2026-07-18 after full local verification.
- RELEASED: Agent A Phase 0 and 1 backend audit, OpenAPI runtime contract, accepted database and authentication baselines, and shared handoff files — Codex, completed 2026-07-18 after all required local gates passed.
- RELEASED: frontend route-surface audit — Claude, completed 2026-07-18 with 248 recorded checks and expected fail-closed admin behavior.
- RELEASED: `server.js` presentation rewrite — Claude, layout, render head, and footer presentation only; route handlers unchanged and test suite green.
