# Supabase Deployment Runbook

Do not apply live migrations automatically. Use this runbook with a human operator.

## 1. Install Supabase CLI

```bash
npm install -g supabase
supabase --version
```

## 2. Login

```bash
supabase login
```

Use `YOUR_SUPABASE_ACCESS_TOKEN` only in local shell/CI secrets. Never commit it.

## 3. Link Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

## 4. Back Up Live DB Before Migration

Use Supabase dashboard backup tooling or:

```bash
pg_dump "YOUR_SUPABASE_DB_URL" --format=custom --file=backup-before-sonara-migration.dump
```

Store the backup securely. Do not commit it.

## 5. Check Migration List

```bash
supabase migration list
```

Review pending migrations, especially:

```text
007_platform_infrastructure_ops.sql
008_entity_agent_operations.sql
010_sonara_industries_v3_rls.sql
```

`010_sonara_industries_v3_rls.sql` must be reviewed for column-specific RLS policies before retrying live push. It should use `extensions.gen_random_bytes(...)` and must not apply `company_key` policies to tables that do not have that column.

## 6. Apply Pending Migrations Safely

```bash
supabase db push
```

Only run this against the intended project after backup.

## 7. Verify Migration Status

```bash
supabase migration list
```

## 8. Verify RLS Policies

Use `docs/RLS_MANUAL_TESTS.md`.

## 9. Verify Storage Buckets

Expected buckets:

- `public-assets`
- `sonara-user-assets`
- `sonara-organization-assets`
- existing launch buckets such as `sonara-releases`

## 10. Rollback / Restore Warning

Rollback is not automatic. If a migration breaks production, restore from the backup or apply a reviewed forward-fix migration.

## 11. Where To Store `SUPABASE_DB_URL`

Store `SUPABASE_DB_URL` only in:

- local `.env`
- CI secret store
- password manager

Never expose it to frontend code or `NEXT_PUBLIC_*`.

## 12. Never Commit

- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Supabase access tokens
- database backups
- `.env.local`
- screenshots containing secrets
