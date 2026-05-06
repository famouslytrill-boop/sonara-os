# Database Infrastructure

SONARA OS uses Supabase-managed PostgreSQL as the production database. The app should not introduce a second primary database for production persistence.

## Production Shape

- Next.js runs on Vercel.
- Stripe Checkout and Stripe webhooks run through Next.js API routes.
- Supabase/PostgreSQL stores subscription state, product data, audit events, jobs, health snapshots, and creator activity.
- Python is used only for local, CI, analytics, audit, export, and migration verification workflows.

## Migration Management

Schema changes live in `supabase/migrations/`.

The platform operations migration is:

```text
supabase/migrations/007_platform_infrastructure_ops.sql
```

It adds:

- `public.system_audit_events`
- `public.platform_jobs`
- `public.db_health_snapshots`
- `public.creator_activity_events`

The migration is additive. It does not drop existing Stripe, Supabase, subscription, or RLS tables.

## RLS Rules

RLS is enabled on all new platform operations tables.

- Anonymous users receive no read or write policies.
- Authenticated users can read their own `actor_id` audit rows.
- Authenticated users can read their own creator activity rows.
- `platform_jobs` and `db_health_snapshots` are service-role-only.
- The Supabase service role key must remain server-only.

## Stripe Persistence Flow

Stripe webhook events must verify the Stripe signature before changing database state.

Expected production tables include:

- `public.stripe_customers`
- `public.subscriptions`
- `public.stripe_events`
- `public.sonara_user_subscriptions`

The new audit and job tables complement that flow but do not replace existing webhook persistence.

## Local Commands

```powershell
npm run db:diff
npm run db:push
npm run db:types
npm run verify:db
```

Only run `db:push` against the intended Supabase project. Never paste database passwords or service role keys into source files, docs, screenshots, or chat.
