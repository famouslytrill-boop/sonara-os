# Supabase Database Connection Contract

## Purpose

SONARA uses one Supabase Postgres project as the primary source of truth. The Express runtime connects through server-only Supabase credentials. Browser code may use only the public project URL and anonymous key, and RLS remains mandatory for browser-accessible data.

## Inventory

`lib/sonara-database-contract.cjs` is the shared application inventory. It groups 71 existing tables into:

- identity and organization access
- billing and entitlements
- support and email delivery
- service lifecycle records
- Business Builder
- Creator Studio
- Growth Studio
- agents and automation
- operations and audit
- formula definitions and results

The contract also declares 10 authorization/readiness functions, three required schemas, and seven private storage buckets. It does not create a database per customer and does not duplicate existing agent tables.

## Runtime Readiness

Migration `20260718071148_connect_database_contract.sql`:

1. Fails if a required application table is absent.
2. Fails if a required application table does not have RLS enabled.
3. Makes service-role table privileges explicit.
4. Creates `public.sonara_database_contract_snapshot()` as a metadata-only, security-invoker function.
5. Revokes the function from `PUBLIC`, `anon`, and `authenticated` and grants it only to `service_role`.
6. Reloads the PostgREST schema cache.

`GET /api/admin/database-readiness` is protected by the existing server-side admin guard. When the RPC is applied, the route reports schema, table/RLS, function, group, and agent-foundation readiness. During rollout it falls back to legacy server-side table checks and remains `setup_required`; it never invents a successful state.

## Agent Boundary

The connected agent foundation stores entity-scoped agents, runs, memory, tool registrations, action approvals, automations, connectors, workflow runs, jobs, and audit records. It does not run arbitrary code, contact customers, charge payments, publish content, deploy, or mutate production without the separate permission, approval, and execution layers required by policy.

## MCP Boundary

`.mcp.json` configures the official Supabase MCP server for the linked project in read-only mode. It contains no credential. The operator must restart the client and complete Supabase OAuth. Production writes remain in the reviewed migration flow, not MCP.

## Verification

```bash
pnpm run verify:supabase-contract
pnpm run verify:db
pnpm exec supabase db lint --local --level error
pnpm exec supabase migration list --linked
pnpm exec supabase db push --linked --dry-run
```

The linked commands require operator credentials. A successful local/static verification does not prove that production has received pending migrations.

## Production Apply Gate

Before applying migrations:

- review every pending SQL file, especially grants, RLS, and storage policies
- verify the linked project reference
- take or confirm a current backup
- run the dry-run and migration list
- ensure no other migration runner is active
- apply once with an authorized operator
- rerun database readiness and Supabase security/performance advisors
- verify authenticated tenant isolation and anonymous denial

References: [database migrations](https://supabase.com/docs/guides/deployment/database-migrations), [API security](https://supabase.com/docs/guides/api/securing-your-api), and [MCP server](https://supabase.com/docs/guides/ai-tools/mcp).
