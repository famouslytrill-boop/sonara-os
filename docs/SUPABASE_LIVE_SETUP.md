# Supabase Live Setup

Supabase setup must be verified before real users or customer data.

## Required Checks

- `NEXT_PUBLIC_SUPABASE_URL` configured.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured.
- `SUPABASE_SERVICE_ROLE_KEY` server-side only if used.
- Auth redirect URLs include `https://sonaraindustries.com`.
- Auth redirect URLs include local development URL.
- Database migrations applied in order.
- RLS policies reviewed for organization isolation.
- Backups and export process documented.

## Blockers

- Service-role key appears client-side.
- Organization-scoped tables lack RLS.
- Admin routes bypass membership/role checks.
