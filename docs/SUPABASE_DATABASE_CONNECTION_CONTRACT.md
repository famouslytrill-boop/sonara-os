# Supabase Database Connection Contract

## Purpose

SONARA uses one Supabase Postgres project as the primary source of truth. The Express runtime connects through server-only Supabase credentials. Browser code may use only the public project URL and anonymous key, and row-level security remains mandatory for browser-accessible data.

## Inventory

`lib/sonara-database-contract.cjs` is the canonical runtime inventory for identity, organizations, billing, support, service lifecycle, Business Builder, Creator Studio, Growth Studio, agents, automation, audit, formulas, integrations, sensory feedback, storage, and shared prompt records.

Additional reviewed migrations provide bounded control-plane domains such as Business Builder ownership, Creator Studio generation, Product Lifecycle, Market Intelligence, reference intelligence, and the governed Hugging Face metadata catalog.

The production verifier does not rely on a manually maintained total alone. It derives the complete declared table set from every ordered SQL migration, merges that set with the canonical runtime contract, and compares the result with the connected production database.

## Runtime Readiness

Migration `20260722170000_complete_ecosystem_database_contract.sql` introduced the service-role-only `public.sonara_database_contract_snapshot()` for canonical schema, table, RLS, and function readiness.

Migration `20260726232000_deep_database_reconciliation.sql` adds `public.sonara_database_deep_snapshot()`. It returns metadata only and reports:

- required schemas
- every public application table
- RLS and forced-RLS state
- policy, column, primary-key, foreign-key, check-constraint, index, and trigger counts
- invalid or unready indexes
- service-role table privileges
- public functions
- private storage buckets
- installed PostgreSQL extensions
- versions recorded in `supabase_migrations.schema_migrations`

The function is `SECURITY DEFINER` with an empty search path, accepts no arguments, returns no customer rows, and is executable only by `service_role`.

## Production Deployment Gate

Every controlled deployment now performs this sequence:

1. Run the full application, security, route, database, storage, and OpenAPI test suite.
2. Link the exact protected Supabase project.
3. Execute `supabase db push --linked --include-all --dry-run`.
4. Apply all pending migrations once.
5. List the linked migration history.
6. Call the deep production snapshot with a step-scoped service-role key.
7. Compare every local migration version and declared table with production.
8. Verify RLS, primary keys, index readiness, service-role access, required functions, and private buckets.
9. Perform zero-row PostgREST connectivity checks against representative operational tables.
10. Deploy to Vercel only after the database gate passes.

Pull-request CI also links the protected project and runs a dry-run plus migration-list check when the required GitHub secrets are available. It does not apply migrations from pull requests.

## Agent Boundary

The connected agent foundation stores entity-scoped agents, runs, memory, tool registrations, action approvals, automations, connectors, workflow runs, jobs, and audit records. It does not run arbitrary code, contact customers, charge payments, publish content, deploy, or mutate production without separate permission, approval, and execution layers.

## MCP Boundary

`.mcp.json` configures the official Supabase MCP server for the linked project in read-only mode. It contains no credential. Production writes remain in the reviewed migration workflow, not in an unreviewed interactive MCP session.

## Verification

Local and static verification:

```bash
pnpm run verify:supabase-contract
pnpm run verify:db
pnpm exec supabase db lint --local --level error
```

Linked preview without writes:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_ID" --password "$SUPABASE_DB_PASSWORD"
supabase db push --linked --include-all --dry-run --password "$SUPABASE_DB_PASSWORD"
supabase migration list --linked --password "$SUPABASE_DB_PASSWORD"
```

Production metadata verification after migrations are applied:

```bash
node --env-file=.env.production scripts/verify-production-supabase.mjs
```

A successful local or pull-request verification does not prove that production received pending migrations. Production is considered reconciled only after the controlled deployment applies migrations and the deep connected verification passes.
