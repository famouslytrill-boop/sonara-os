# Supabase Setup

Supabase is optional for local static preview, but required for subscription records and production data writes.

## Link Project

1. Install and authenticate the Supabase CLI outside the repo if needed.
2. Set Vercel/GitHub secrets, never source-control values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_PROJECT_ID`
   - `SUPABASE_DB_PASSWORD`
   - `DATABASE_URL`
3. Link the project locally:
   - `pnpm exec supabase link --project-ref <project-ref>`

## Migrations

Migration files are under `supabase/migrations`. Additional database reference SQL exists under `infra/db`.

Recommended production order:

1. Review migrations locally.
2. Confirm RLS policies before adding public traffic.
3. Push migrations:
   - `pnpm run db:push`

> Step 4 of this list used to read *"Regenerate types if local Supabase is
> running: `pnpm run db:types`"*. There is no `db:types` script in
> `package.json` and there never has been in this repository -- the runtime here
> is CommonJS JavaScript, not generated TypeScript, which
> `docs/DATABASE_SCHEMA.md` already records. An operator following this file
> during setup got "Command \"db:types\" not found" as the last step of
> bringing a database up. Corrected 18 September 2026, found by Codex on
> PR #297, and `scripts/verify-doc-pnpm-scripts.mjs` now reads the repository
> root as well as `docs/`, so a live instruction naming a dead command fails the
> release here too.

## RLS Reminder

Do not add broad public policies for private data. Service-role access must remain server-only. Client code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Storage Reminder

If file uploads are enabled, create and document the storage bucket before launch. Keep private uploads private by default, and do not expose release files or customer records through public buckets without an explicit policy review.
