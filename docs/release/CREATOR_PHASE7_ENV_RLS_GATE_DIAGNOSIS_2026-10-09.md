# Creator Studio — Phase 7 Release Gate Failure Analysis
Date: 2026-10-09. Draft-only stacked change after PR #594; do not deploy.

## Confirmed latest PR #594 CI (head `5a93f82856ebefbe9382a58e760b451bdb5f93a9`)

- Docker Image CI: successful.
- dependency-scan: successful.
- Node Runtime Compatibility: failure in Test (not in Lint).
- SONARA Industries CI: failure in Test.
- Native migration replay: failure across PostgreSQL replay matrices.

### Node failure — verified from workflow logs

The application's source reads `SONARA_INTERACTIVE_DRAFT_PREVIEW_ENABLED` and `SONARA_STORY_REVISION_PERSISTENCE_ENABLED`, and `.env.example` declares both `false`. But `scripts/verify-env.mjs` rejects any source-referenced key missing from `lib/sonara-environment-classification.cjs`. The test harness therefore failed in its before-all hook and displayed a secondary after-all cleanup error. The two flags have been added to **OPTIONAL_CAPABILITY**, not REQUIRED: paying customers are not dependent on these experimental modules; their routes explicitly fail closed when disabled.

The classification check must remain bidirectional. Do not whitelist unknown environment variables or stop executing it.

### PostgreSQL P1 failure — confirmed by workflow logs

`tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` aborts at its **preflight** with `P1 policy definition drift on 25 policies`. Native migration history replay reached that staging-only probe. This result does **not** show that the proposed Creator tables were migrated — they reside in `docs/sql-proposals` only. A single unexpected definition could change access rights; a 25-row mismatch needs exact row-by-row evidence.

In this branch, the P1 probe retains its equality checks and exception/rollback. On any mismatch it now prints each policy's name, differing dimensions (roles, command, USING, WITH CHECK, permissiveness) and both expected and observed expressions. It **does not** rewrite, skip, loosen or approve any policy. Rerun native PG16/17/18 and examine these details to decide whether the expected fixture is stale, the applied migration authority changed, or the PostgreSQL catalog formatting changed. Only then adjust the fixture or create a reviewed forward migration, preserving tenant-denial checks and a real rollback.

## Release gates

1. Prove `pnpm run verify:env`, `pnpm run lint`, `pnpm test`, typecheck and Node compatibility pass on the exact head.
2. Preserve `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` fail-closed preflight and its `ROLLBACK`. Never weaken expected count = 25 or the subscription duplicate proof simply to make CI green.
3. Compare the actual catalog fields reported by native Postgres across all tested versions with the migration authority, and reconcile before proposing any database modification.
4. Re-run P0 tenant role tests, P1 protected RLS pre/postflight, and independent story-save double-writer/archiving/rollback tests before applying any Creator story or World Bible migrations.
5. Preserve default-off `SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED`, `SONARA_INTERACTIVE_DRAFT_PREVIEW_ENABLED`, `SONARA_STORY_REVISION_PERSISTENCE_ENABLED`. Require owner-approved staging + tenant canary before activation.

References:
- Supabase RLS, grants and testing: https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgreSQL `pg_policies`: https://www.postgresql.org/docs/current/view-pg-policies.html
