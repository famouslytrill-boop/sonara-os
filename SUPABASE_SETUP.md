# Supabase Setup

Supabase is the primary backend for support queue and billing audit readiness.

## Find project values

In Supabase Dashboard -> Project Settings -> API:

- Project URL -> `SUPABASE_URL`
- anon public key -> `SUPABASE_ANON_KEY`
- service role key -> `SUPABASE_SERVICE_ROLE_KEY`

The service role key is server-only. Never expose it to browser code.

## Vercel variables

Add the three Supabase variables in Vercel Project Settings -> Environment Variables.

## Apply migrations manually

Apply only the clean intentional migrations:

- `supabase/migrations/0001_auth_organization_scaffold.sql`
- `supabase/migrations/0002_launch_mvp_core_tables.sql`
- `supabase/migrations/0003_agent_growth_rag_foundation.sql`
- `supabase/migrations/0004_support_email_delivery_status.sql`
- `supabase/migrations/0005_current_app_schema_hardening.sql`

Do not apply remote sync dumps or data backups.

## Health checks

- `/api/health` returns app health.
- `/api/readiness` returns non-secret readiness flags and missing variable names.
