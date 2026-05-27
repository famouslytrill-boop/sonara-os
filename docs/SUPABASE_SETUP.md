# Supabase Setup

This project includes Supabase scaffolding for SONARA Industries, Business Builder, Creator Studio, and Growth Studio. The migrations are launch scaffolding and must be reviewed before production data is stored.

## Required Values

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` server-only
- `SUPABASE_ACCESS_TOKEN` for CI or CLI operations
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `DATABASE_URL` if direct database access is used

## Local Link And Migration Flow

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push
pnpm run db:types
pnpm run verify:db
```

Do not add service-role keys to frontend code. Do not add broad public RLS policies for private organization, customer, billing, payment, file, or audit data.

## RLS Requirements

- Enable RLS on user and organization-scoped tables.
- Users can read their own profile.
- Organization members can read records scoped to organizations they belong to.
- Admin-only operations must check role membership.
- Service-role operations must stay server-side.

## Storage Reminder

If files are enabled, create private buckets for organization assets and document access rules before accepting uploads. Public buckets should only serve intentional public assets.
