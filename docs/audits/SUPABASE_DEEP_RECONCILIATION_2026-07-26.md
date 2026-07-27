# Supabase Deep Reconciliation — 2026-07-26

## Objective

Apply every pending migration to the protected production project, prove that declared tables and schemas exist, validate structural depth, and block the website deployment when the connected database is incomplete or unsafe.

## Controls added

- Linked pull-request migration dry-run and migration-list verification.
- Production `db push --include-all` before website deployment.
- Service-role-only `sonara_database_deep_snapshot()` metadata RPC.
- Automatic declared-table inventory derived from ordered migration SQL.
- Applied migration history comparison.
- RLS, primary-key, index-readiness, policy, constraint, trigger, and privilege inspection.
- Required private storage-bucket validation.
- Required public-function validation.
- Zero-row PostgREST connectivity checks.
- Production deployment blocked until the full Supabase verification passes.

## Security boundaries

- No database credentials are committed.
- The service-role key is scoped to explicit verification steps.
- The snapshot returns metadata only and no customer records.
- Pull requests may preview migrations but cannot apply them.
- Production migrations remain serialized through the controlled deployment workflow.
