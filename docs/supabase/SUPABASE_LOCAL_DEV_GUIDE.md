# Supabase Local Development Guide

Local builds must pass without configured Supabase credentials. Developer machines may run Supabase CLI and local Docker for migration reset testing, but that is optional for this workspace.

When local Supabase is available:

- Run migration validation before preview.
- Confirm no duplicate migration versions.
- Confirm RLS is enabled on tenant tables.
- Do not edit `supabase_migrations.schema_migrations` rows manually.

When local Supabase is unavailable, CI and Supabase Preview remain the source for migration execution validation.
