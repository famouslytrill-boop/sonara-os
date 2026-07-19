# AI Changelog

- 2026-07-19 Codex - Diagnosed production organization setup HTTP 503 responses as a schema-compatibility defect: the hosted table requires legacy company_key and created_by fields, while the application omitted them and attempted an undefined owner_user_id field. Added an idempotent compatibility patch, deterministic retry recovery, sanitized failure evidence, and regressions without changing migrations or access policy.
- 2026-07-19 Codex - Repaired the readiness Preview UI with canonical cards, aggregate Founder/Admin protection, deployment context, and compatibility-preserving tests.
- 2026-07-19 Codex - Added 1 MiB structured request handling with stable HTTP 413 behavior and direct-storage guidance for large files.
- 2026-07-19 Codex - Retried after the prior model outage without treating execution-environment failure as an application failure.
- 2026-07-18 Codex - Verified production migrations 40–42, billing compatibility, indexes, provider configuration, pricing/legal boundaries, and fail-closed paid access.
- 2026-07-18 Codex - Released deterministic membership resolution, PWA cache privacy, the canonical database contract, and the registered-runtime OpenAPI baseline.
- 2026-07-18 Codex + Claude - Integrated the Clark visual redesign into the accepted root Express runtime.
