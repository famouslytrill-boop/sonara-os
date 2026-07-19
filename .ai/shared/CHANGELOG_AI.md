# AI Changelog

- 2026-07-19 Codex - Began the readiness Preview UI repair after a screenshot showed duplicated aliases and contradictory founder/admin cards. Added a canonical human-facing readiness list, deployment-environment context, compatibility-preserving tests, and explicit Preview/Production isolation; production provider and paid-access behavior remain unchanged.
- 2026-07-19 Codex - Added a deterministic payload-size guard: structured JSON/form bodies move from 64 KiB to 1 MiB, oversized bodies return a stable HTTP 413 contract, and file/media bytes remain direct signed-storage uploads rather than function JSON payloads.
- 2026-07-19 Codex - Retried after the prior Claude selected-model outage and Exit 144; confirmed the local mount was absent rather than assuming completion; read all current shared files; verified workflow and production evidence; corrected stale shared records only.
- 2026-07-19 Codex - Merged PR #27 to `main` as `88ee2d5dbf359972fc5eee64b322fed17192cbdf`; production health and readiness confirmed the Express runtime, email and payment configuration, pricing owner approval, and the legal review boundary.
- 2026-07-18 Codex PR #27 - Applied and verified production migrations 40–42, billing compatibility, operational indexes, email validation, pricing/legal state separation, and paid-access boundaries.
- 2026-07-18 Codex - Merged PR #25 with deterministic membership resolution, selective paid-access queries, operational indexes, verifiers, and regressions.
- 2026-07-18 Codex - Merged PR #23 with the canonical PWA and cache-privacy contract.
- 2026-07-18 Codex - Merged PR #21 and verified main checks, exact-SHA production readiness, route smoke, runtime inspection, and DNS inventory.
- 2026-07-18 Codex - Added the canonical application database contract, safe local/read-only agent configuration, protected readiness, verifiers, tests, and documentation.
- 2026-07-18 Agent B - Repaired theme initialization and haptics consent, synchronized PWA assets, added regressions, and verified local responsive rendering.
- 2026-07-18 Codex - Accepted ADR-0010 membership compatibility and added the registered-runtime OpenAPI baseline and drift gate.
- 2026-07-18 Codex + Claude - Integrated the Clark visual redesign into the accepted root Express production runtime and completed responsive route audits.
