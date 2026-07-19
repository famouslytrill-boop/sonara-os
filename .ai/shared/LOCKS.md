# Locks

Active:
- None.

History:
- RELEASED: payload-size request handling — Codex, completed 2026-07-19 in PR #30 after structured JSON/form limits moved from 64 KiB to 1 MiB, stable HTTP 413 handling and direct-storage guidance were added, regression tests passed, SONARA CI/dependency/Docker/Supabase/Vercel gates passed, merge `af25aabd73a2df94a5c30bd157a8e1bbd1fc6c6f` deployed READY as `dpl_3S2YokV2p4Bn9UY7k1Xidp5PQG8f`, and live health reported the exact SHA.
- RELEASED: retry verification and shared-state reconciliation — Codex, completed 2026-07-19 after all 30 current `.ai/shared/` files were read, the absent local mount and prior model/Exit 144 failure were classified correctly, exact workflow and production evidence were verified, and stale security/deployment records were corrected.
- RELEASED: paid-launch finalization — Codex, completed 2026-07-18 in PR #27 after production ledger 42/42 verification, linked schema lint, billing compatibility reconciliation, Resend validation repair, pricing/legal state separation, Stripe regressions, CI, Docker, Supabase preview, tests, reports, and shared synchronization.
- RELEASED: operational database query/index hardening — Codex, completed 2026-07-18 in PR #25.
- RELEASED: canonical PWA contract and production handoff — Codex, completed 2026-07-18 in PR #23.
- RELEASED: PR #21 production verification and launch-risk handoff — Codex, completed 2026-07-18.
- RELEASED: canonical Supabase database/agent contract and Data API privilege hardening — Codex, completed 2026-07-18.
- RELEASED: preference safety renderer/assets/tests — Agent B, completed 2026-07-18.
- RELEASED: ADR-0010 membership compatibility and OpenAPI runtime baseline — Codex, completed 2026-07-18.
- RELEASED: frontend route-surface audit and Clark presentation rewrite — Claude, completed 2026-07-18.
