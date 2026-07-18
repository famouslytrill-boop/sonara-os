# Locks

LOCK: openapi/sonara.yaml, .ai/shared/API_CONTRACT.md, .ai/shared/decisions/ADR-0009-openapi-runtime-contract.md, reports/BACKEND_REPORT.md, package.json, scripts/verify-openapi-contract.mjs
OWNER: Codex (Agent A)
PURPOSE: Phase 0 backend audit and Phase 1 canonical OpenAPI contract
STARTED: 2026-07-18T01:57:47-04:00
EXPECTED RELEASE: after contract verification and logical commit

LOCK: .ai/shared/CURRENT_STATE.md, .ai/shared/TASK_BOARD.md, .ai/shared/HANDOFF_LOG.md, .ai/shared/CHANGELOG_AI.md, .ai/shared/TEST_MATRIX.md, .ai/shared/OPEN_QUESTIONS.md, .ai/shared/RISKS.md
OWNER: Codex (Agent A)
PURPOSE: Reconcile the completed Agent A contract work and Agent B review into shared state
STARTED: 2026-07-18T02:05:00-04:00
EXPECTED RELEASE: after final verification and logical commit

LOCK: .ai/shared/DATABASE_CONTRACT.md, .ai/shared/decisions/ADR-0003-database-model.md, .ai/shared/decisions/ADR-0004-authentication.md
OWNER: Codex (Agent A)
PURPOSE: Replace Agent A stubs with the verified existing database and authentication baseline
STARTED: 2026-07-18T02:10:00-04:00
EXPECTED RELEASE: after final verification and logical commit

History:
- RELEASED: reports/AGENT_B_PHASE0_REVIEW.md - Agent B frontend subagent, completed 2026-07-18T02:03-04:00 with a source-only Phase 0 review and no product changes.
- RELEASED: shared patch-integration handoff files - Codex, completed 2026-07-18T04:10Z after full local verification.
- RELEASED: frontend route-surface audit — Claude, completed 2026-07-18T04:55Z with reports/FRONTEND_AUDIT_REPORT.md (248 checks; zero real defects; 503 fail-closed admin routes expected).
- RELEASED: server.js — Claude, layout()/renderHead/footer presentation rewrite (commit "Redesign visual system"). Route handlers untouched; 255-test suite green.
