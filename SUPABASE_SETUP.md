# Supabase Setup

Supabase is the primary backend for support queue and billing audit readiness.

## Find project values

In Supabase Dashboard -> Project Settings -> API:

- Project URL -> `SUPABASE_URL` and optional browser-safe alias `NEXT_PUBLIC_SUPABASE_URL`
- anon public key -> `SUPABASE_ANON_KEY` and optional browser-safe alias `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service role key -> `SUPABASE_SERVICE_ROLE_KEY`
- database URL -> `SUPABASE_DB_URL` for owner migration tooling only

The service role key is server-only. Never expose it to browser code.

## Vercel variables

Add the three Supabase variables in Vercel Project Settings -> Environment Variables.

## Auth URL configuration

In Supabase Dashboard -> Authentication -> URL Configuration:

Production Site URL:

- `https://sonaraindustries.com`

Allowed Redirect URLs:

- `https://sonaraindustries.com/auth/callback`
- `https://sonaraindustries.com/**`
- `https://sonaraindustries.com/login`
- `https://sonaraindustries.com/dashboard`

Vercel preview redirect patterns:

- `https://*.vercel.app/auth/callback`
- `https://*.vercel.app/**`

Local development:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/**`

The app callback route is `/auth/callback`.

## Apply migrations manually

Apply only the clean intentional migrations:

- `supabase/migrations/0001_auth_organization_scaffold.sql`
- `supabase/migrations/0002_launch_mvp_core_tables.sql`
- `supabase/migrations/0003_agent_growth_rag_foundation.sql`
- `supabase/migrations/0004_support_email_delivery_status.sql`
- `supabase/migrations/0005_current_app_schema_hardening.sql`
- `supabase/migrations/0006_platform_accounts_modules_and_usage.sql`
- `supabase/migrations/0007_launch_roles_and_preferences.sql`
- `supabase/migrations/0008_billing_webhook_events_and_integrity.sql`
- `supabase/migrations/20260617214513_business_builder_employee_portal.sql`

Do not apply remote sync dumps or data backups.

## Role and preference tables

The launch schema includes:

- `public.user_roles` for `owner`, `admin`, and `customer` authorization.
- `public.profile_settings` for language and unit preferences.
- `public.billing_webhook_events` for Stripe webhook idempotency and audit.
- `public.admin_audit_events` for server-side founder/admin access logging.
- `public.business_workspaces`, `public.business_memberships`, and `public.business_employee_invites` for Business Builder owner/manager/employee access.

Business Builder employee invite records store `token_hash` only. They must never store raw invite tokens or employee passwords. Employees set their own password through Supabase Auth during invite acceptance.

After the owner signs up, use Supabase SQL Editor to promote the owner account:

```sql
insert into public.user_roles (user_id, role)
select id, 'owner'
from auth.users
where email = 'OWNER_EMAIL_HERE'
on conflict (user_id, role) do nothing;
```

Replace the email before running. Do not add real emails to migrations.

## API grants and RLS

RLS is enabled on customer and organization tables. Service-role policies are server-side permissions, not secrets. If Supabase Data API access is used directly, confirm table grants and RLS policies are both present before production launch.

## Health checks

- `/api/health` returns app health.
- `/api/readiness` returns non-secret readiness flags and missing variable names.
