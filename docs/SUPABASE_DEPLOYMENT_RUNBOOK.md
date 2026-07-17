# Supabase Production Deployment Runbook

Production project ref: `yqncsonkxgwhcxedgevk`

Production API origin: `https://yqncsonkxgwhcxedgevk.supabase.co`

Migration ledger at the 2026-07-16 verification: **39 versions**, matching the 39 files in `supabase/migrations/**` and ending at `20260716130000`.

Do not apply live migrations automatically. Use this runbook with an authorized human operator, a current backup, and the intended project visible in every command.

## Current production baseline

The following migrations were applied with owner approval on 2026-07-16 and must not be re-created or edited:

```text
20260714120000_sonara_service_lifecycle_runtime_tables.sql
20260714150000_sonara_notifications_and_integrations.sql
20260715110223_support_delivery_state.sql
20260715120000_user_preferences_appearance_notifications.sql
20260716130000_launch_storage_buckets.sql
```

The canonical production ledger and repository history were reconciled at 39 versions. A new schema change must be a forward-only migration with a new version.

## 1. Run the Supabase CLI through pnpm

Do not install the CLI globally and do not use npm in this repository.

```bash
pnpm dlx supabase@latest --version
pnpm dlx supabase@latest --help
```

Discover command flags through `--help` before using them because CLI behavior can change.

## 2. Authenticate without committing credentials

```bash
pnpm dlx supabase@latest login
```

Keep the access token in the local credential store, CI secret store, or an approved password manager. Never put it in source, documentation, screenshots, logs, or chat.

## 3. Link the intended project

```bash
pnpm dlx supabase@latest link --project-ref yqncsonkxgwhcxedgevk
```

Before continuing, confirm the dashboard URL and CLI output identify `yqncsonkxgwhcxedgevk`. Do not use the historical preview project ref `negegqiequrclmxuvsuy` for production proof.

## 4. Back up production before a future schema change

Use the Supabase dashboard backup tooling or an approved `pg_dump` workflow. Store backups encrypted outside the repository.

Never commit:

- database URLs or passwords
- Supabase access tokens
- service-role or secret keys
- database dumps
- `.env` or `.env.local`
- screenshots containing credentials

## 5. Compare local and remote migration history

```bash
pnpm dlx supabase@latest migration list
```

Expected baseline:

- local migration count: 39
- remote migration count: 39
- final version: `20260716130000`
- no duplicate versions
- no pending migration from the five-file applied set above

If the ledger differs, stop. Reconcile the intended project and migration history before any push. Do not rewrite applied migration files.

## 6. Apply a future migration safely

Only after backup, review, preview validation, and owner approval:

```bash
pnpm dlx supabase@latest db push
```

Afterward, rerun `migration list`, the repository verification gates, RLS tests, and the product flow affected by the migration. Rollback is not automatic; use a reviewed forward-fix migration or restore from backup.

## 7. Verify support delivery schema

Run read-only SQL in the intended production project:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'support_requests'
  and column_name in (
    'reference_id',
    'consent_accepted',
    'email_delivery_status',
    'email_error_summary',
    'email_retry_count'
  )
order by column_name;

select to_regclass('public.support_email_delivery_attempts') as delivery_attempts_table;
```

Expected: five support columns and `public.support_email_delivery_attempts`.

## 8. Verify private launch storage

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in (
  'avatars',
  'business-assets',
  'creator-assets',
  'music-stems',
  'release-packages',
  'support-attachments',
  'exports'
)
order by id;
```

Expected: seven rows and `public = false` for every row.

Verify the eight launch object policies:

```sql
select policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'users can read own avatar objects',
    'users can create own avatar objects',
    'users can update own avatar objects',
    'users can delete own avatar objects',
    'organization members can read launch assets',
    'organization members can create owned launch assets',
    'asset owners can update launch assets',
    'asset owners can delete launch assets'
  )
order by policyname;
```

Expected: eight rows. Avatar paths are owner-scoped by the first path segment. Organization assets use `<organization_id>/<owner_user_id>/<filename>` and require active membership through `public.is_org_member`.

## 9. Verify RLS and anonymous isolation

Review `docs/RLS_MANUAL_TESTS.md` and test with separate approved organizations. As a read-only baseline, verify RLS is enabled:

```sql
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'organizations',
    'organization_memberships',
    'support_requests',
    'service_requests',
    'billing_subscriptions'
  )
order by c.relname;
```

Do not treat `TO authenticated` alone as tenant authorization. Policies must also enforce ownership or active organization membership. Keep service-role access server-only.

## 10. Required repository verification

```bash
pnpm install --frozen-lockfile
pnpm run verify:db
pnpm run verify:launch
pnpm run test:docs
git diff --check
```

Local parsing and preview CI confirm repository safety, not production application. Production proof requires the read-only checks above and an approved real user flow.

## 11. Evidence and approvals

Record for every production migration:

- project ref
- reviewed migration versions
- backup confirmation
- operator and approver
- migration-list result
- RLS/storage verification result
- affected application smoke result
- rollback or forward-fix note

Never include credential values or customer data in the evidence record.
