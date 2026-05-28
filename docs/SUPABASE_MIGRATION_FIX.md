# Supabase Migration Version Conflict Fix

Date: 2026-05-28
Branch: `feat/sonara-platform-redesign-and-research-lab`

## Failure

Supabase Preview failed with:

```text
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"
Key (version)=(004) already exists.
```

Supabase stores applied migration versions by filename prefix. The branch contained two migration files with the same version prefix, so the preview database attempted to record version `004` twice.

## Duplicate Version Found

The duplicate prefix was `004`:

- `supabase/migrations/004_sonara_final_launch.sql`
- `supabase/migrations/004_sonara_vector_memory.sql`

`004_sonara_final_launch.sql` is the older historical migration and was kept at version `004`.

## Fix Applied

The vector memory migration was moved to a unique timestamped migration:

- From: `supabase/migrations/004_sonara_vector_memory.sql`
- To: `supabase/migrations/20260528071000_sonara_vector_memory_schema.sql`

The branch-added Research Lab intake migration was also moved to a timestamped migration:

- From: `supabase/migrations/011_sonara_research_intake_tables.sql`
- To: `supabase/migrations/20260528071500_sonara_platform_redesign_schema.sql`

The support/contact sprint adds a new append-only migration:

- `supabase/migrations/20260528093000_support_contact_paths.sql`

No rows were manually inserted, deleted, or updated in `supabase_migrations.schema_migrations`.

## Append-Only Rule

Migration history must be append-only because Supabase tracks migration versions independently of file contents. Reusing an old version prefix can fail previews, break branch databases, or create ambiguity about which schema change a production database has applied.

New schema changes should use a unique timestamped filename such as:

```text
supabase/migrations/YYYYMMDDHHMMSS_sonara_platform_redesign_schema.sql
```

## Safety Notes

- Existing schema SQL was preserved.
- The moved migrations use additive patterns such as `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, RLS enablement, guarded policy creation, or `DROP POLICY IF EXISTS` before policy recreation.
- No destructive drops were added.
- No secrets are required in the migration files.

## Human-Required Preview Setup

Supabase Preview still requires these GitHub secrets when preview validation is enabled:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`

If these are missing, the workflow should skip Supabase Preview with a clear message rather than failing unrelated CI.

## Rerun Supabase Preview

Push the branch and let GitHub Actions rerun the Supabase Preview job. It should now apply unique migration versions. If preview secrets are missing, the workflow should print the configured skip message instead of failing unrelated CI.

## Local Validation

Passed:

```powershell
pnpm install --frozen-lockfile
pnpm audit --audit-level moderate
pnpm run typecheck
pnpm run build
pnpm run validate:infrastructure
pnpm run verify:db
pnpm run smoke:routes
pnpm run verify:all
pnpm exec supabase --version
```

Migration prefix validation passed with no duplicate prefixes in `supabase/migrations`.

Supabase CLI was installed and reported version `2.101.0`.

Not run successfully locally:

```powershell
pnpm exec supabase migration list
pnpm exec supabase db reset
```

`supabase migration list` requires a linked Supabase project. `supabase db reset` requires `supabase start` and the local Supabase stack to be running. Those local Supabase requirements were not available in this environment.

## Current Migration Files

- `003_sonara_subscriptions.sql`
- `004_sonara_final_launch.sql`
- `005_sonara_sound_discovery.sql`
- `006_sonara_generation_history.sql`
- `007_platform_infrastructure_ops.sql`
- `008_entity_agent_operations.sql`
- `010_sonara_platform_current_schema.sql`
- `20260528071000_sonara_vector_memory_schema.sql`
- `20260528071500_sonara_platform_redesign_schema.sql`
- `20260528093000_support_contact_paths.sql`
