# Supabase Branching and Preview

Supabase Preview should run only when GitHub Actions has:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`

If those secrets are missing, the workflow should skip with a clear message. If the secrets exist, migration errors must fail the check. Do not fake preview success and do not edit `supabase_migrations.schema_migrations` rows manually.
