# Supabase Setup

Supabase is the primary backend for SONARA Industries, Business Builder, Creator Studio, and Growth Studio. The repository owns the database contract through append-only migrations. Production changes still require review and an authorized operator.

## Required Values

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` server-only
- `SUPABASE_ACCESS_TOKEN` for CI or CLI operations
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `DATABASE_URL` if direct database access is used

## Canonical Contract

The runtime contract is defined in `lib/sonara-database-contract.cjs` and verified by `pnpm run verify:supabase-contract`. It currently covers:

- `public`, `auth`, and `storage` schemas
- 71 application tables grouped by identity, billing, support, services, the three products, agents/automation, operations/audit, and formulas
- 10 authorization/readiness functions
- 7 private storage buckets with file-size and MIME-type limits

The agent foundation uses the existing `entity_*`, workflow, approval, memory, job, and audit tables. It does not enable autonomous production execution. External actions remain permission-checked, approval-gated, and audited.

## Local Development

```bash
pnpm exec supabase start
pnpm exec supabase db lint --local --level error
pnpm run verify:db
```

`supabase/config.toml` keeps new Data API tables from being auto-exposed, disables unreviewed seed execution, and declares private local bucket behavior. Local state is not production state.

## Linked Production Flow

Authenticate outside the repository, then inspect before applying anything:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase migration list --linked
pnpm exec supabase db push --linked --dry-run
pnpm run verify:db
```

After human review, one authorized operator may run `pnpm exec supabase db push --linked`. Do not run concurrent migration pushes from CI, another agent, and a local terminal.

The checked-in `.mcp.json` uses the official Supabase MCP endpoint, is scoped to the linked project, and is read-only. Restart the coding client and complete Supabase OAuth before using it. Keep production MCP read-only; do not place access tokens in `.mcp.json`.

Do not add service-role keys to frontend code. Do not add broad public RLS policies for private organization, customer, billing, payment, file, agent, or audit data.

## RLS Requirements

- Enable RLS on user and organization-scoped tables.
- Users can read their own profile.
- Organization members can read records scoped to organizations they belong to.
- Admin-only operations must check role membership.
- Service-role operations must stay server-side.

## Storage Reminder

The declared buckets are `avatars`, `business-assets`, `creator-assets`, `music-stems`, `release-packages`, `support-attachments`, and `exports`. Keep them private unless an explicit, reviewed publishing flow says otherwise. Production bucket creation and policy verification remain an operator task.

## References

- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase MCP server](https://supabase.com/docs/guides/ai-tools/mcp)
