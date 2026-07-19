# Locks

Active:
- `scripts/apply-readiness-display-contract.cjs`, `scripts/apply-payload-size-guard.cjs`, `tests/readiness-display-contract.test.js`, the generated launch-readiness renderer, and related shared evidence — Codex on `codex/fix-readiness-preview-ui` until exact-head CI, Vercel preview, guarded merge, and production verification complete.

History:
- RELEASED: payload-size request handling — Codex, completed 2026-07-19 in PR #30 after structured request limits moved to 1 MiB, stable HTTP 413 handling and direct-storage guidance were added, all gates passed, and merge `af25aabd73a2df94a5c30bd157a8e1bbd1fc6c6f` deployed READY as `dpl_3S2YokV2p4Bn9UY7k1Xidp5PQG8f`.
- RELEASED: retry verification and shared-state reconciliation — Codex, completed 2026-07-19.
- RELEASED: paid-launch finalization — Codex, completed 2026-07-18 in PR #27.
- RELEASED: operational database query/index hardening — Codex, completed 2026-07-18 in PR #25.
- RELEASED: canonical PWA contract and production handoff — Codex, completed 2026-07-18 in PR #23.
- RELEASED: PR #21 production verification and launch-risk handoff — Codex, completed 2026-07-18.
- RELEASED: canonical database/agent contract and Data API privilege hardening — Codex, completed 2026-07-18.
- RELEASED: preference safety renderer/assets/tests — Agent B, completed 2026-07-18.
- RELEASED: ADR-0010 membership compatibility and OpenAPI runtime baseline — Codex, completed 2026-07-18.
- RELEASED: frontend route-surface audit and Clark presentation rewrite — Claude, completed 2026-07-18.
