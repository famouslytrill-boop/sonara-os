# AI Changelog

- 2026-07-18 Codex `5d333b1` - Added the canonical Supabase application contract, safe local and read-only MCP configuration, service-only database readiness RPC, protected admin runtime integration, contract verifier, SQL/route tests, and operator documentation. All local gates pass; production migrations remain owner-dependent.

- 2026-07-18 Codex `4acb355` - Added append-only Supabase Data API privilege hardening, corrected global admin authorization to use `user_roles`, locked helper search paths, removed anonymous RPC access, and added local SQL plus repository regression gates. Production application remains pending owner review.

- 2026-07-18 Agent B `af18a6f` - Repaired system/light/dark initialization and haptics consent, synchronized service-worker assets, added executable preference regressions, and verified local mobile/desktop rendering. No backend/provider/schema change.
- 2026-07-18 Codex - Accepted ADR-0010: organization membership is canonical customer tenancy; Business Builder workforce and internal entity memberships remain separate domains. No migration or runtime change.

- 2026-07-18 Codex - Added the complete registered-runtime OpenAPI baseline and drift gate; completed the Agent A backend audit; accepted the existing API, database, and authentication contracts; reconciled the independent Agent B Phase 0 review. No runtime behavior, schema, provider, or secret change.

- 2026-07-18 Codex 6d8346e - Applied the owner-supplied four-commit Clark redesign patch onto `github/main` on `codex/integrate-clark-redesign`; verified 255 tests, launch gates, dependency audit, docs, and served public assets. No provider, database, auth, or billing behavior changed.

- 2026-07-18 Claude 0791c75 — Clark visual redesign: warm editorial light system, dark admin console, 4 CSS layers consolidated (−1,236 net lines), SW v clark-ui-20260717. 255 tests green; 65 browser checks clean.
- 2026-07-16 Claude 6c46ea9 — Runbook reconciled to applied-migration state.
- 2026-07-16 Claude 0562edc — Production migrations applied (owner-approved); verification report updated with live proof.
- 2026-07-16 Claude a753dc9 — Paid-launch verification report (Vercel/Supabase/Resend/Stripe evidence; launch call: NOT CLEARED).
