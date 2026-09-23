# Database + Integration Hardening Gate — 2026-09-23

## Scope

This gate is the first execution slice after the 2026 platform advancement research wave.

It covers:

1. production database policy/index cleanup;
2. the canonical integration cursor/checkpoint contract.

It does **not** activate a provider, widen agent authority, move money, mutate production schema, or install an external repository.

## Live production findings

The active Supabase project was inspected directly on 2026-09-23.

Observed state:

- 379 public base tables.
- RLS enabled on all 379 public base tables.
- `pg_cron`, `pg_net`, `pgmq`, and `vector` are installed.
- 9 duplicate-index groups exist.
- 55 tables still carry a legacy policy named `tenant_members_modify` declared `FOR ALL`.
- 238 policy records still expose service-role logic through `PUBLIC` policy expressions rather than a dedicated `TO service_role` policy boundary.
- `user_notifications` has two equivalent authenticated SELECT policies.
- legacy broad table grants still include privileges such as `TRUNCATE`, `TRIGGER`, and `REFERENCES` for browser roles on some tables.

These findings are engineering debt, not proof of exploitation. The hardening plan separates mechanical cleanup from authorization-semantic changes so production behavior is not changed merely to reduce advisor counts.

## Duplicate index groups

The live database currently reports these redundant index groups:

- `employee_schedules(organization_id, starts_at)`
- `entities(slug)`
- `feature_flags(key)`
- `github_repositories(repo_url)`
- `integration_statuses(integration_key)`
- `organization_members(org_id, user_id)`
- `provider_registry(slug)`
- `sonara_user_subscriptions(stripe_subscription_id)`
- `user_roles(user_id, role)`

Where one member is a constraint-backed unique index, the unique/constraint index is the authority and the redundant ordinary index is the removal candidate. For `employee_schedules`, the migration review should retain one of the two ordinary indexes and remove the other.

## Policy cleanup classes

### Mechanical

These changes should preserve intended application behavior and can be checked structurally:

- remove duplicate non-authoritative indexes;
- remove one of the equivalent `user_notifications` SELECT policies;
- revoke browser-role `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges where no explicit product contract requires them;
- keep service-role server access explicit.

### Authorization-semantic

These require route/read/write verification before migration:

- converting `PUBLIC + auth.role() = 'service_role'` policies to `TO service_role`;
- splitting legacy `FOR ALL` policies into action-specific SELECT/INSERT/UPDATE/DELETE policies;
- narrowing any `PUBLIC` policy to `authenticated`;
- removing direct browser write privileges from tables that have moved behind server-mediated routes.

The migration must not use advisor count reduction as a substitute for proving customer/member/admin/service-role behavior.

## Canonical integration checkpoint contract

The executable contract is:

`lib/sonara-integration-checkpoint-contract.cjs`

The intended persistence table is:

`public.integration_sync_cursors`

The migration is intentionally not present yet because SONARA policy requires new migrations to be created through the Supabase CLI workflow before SQL is written into `supabase/migrations/`.

Required checkpoint identity:

- organization;
- connection;
- provider;
- stream.

Required invariants:

- provider cursor values are opaque outside the adapter;
- checkpoint identity never mutates in place;
- checkpoint version increments once per committed advance;
- stale writers fail on version conflict;
- event/source watermark never moves backwards;
- completed backfills do not silently reopen;
- secret-looking values are rejected from checkpoint metadata;
- replay/reconciliation evidence remains separate from cursor persistence.

## Intended persistence shape

The reviewed migration should create a tenant-scoped table equivalent to:

- `organization_id uuid not null`
- `connection_id uuid not null`
- `provider_key text not null`
- `stream_key text not null`
- `cursor_type text not null`
- `cursor_value text`
- `watermark_at timestamptz`
- `checkpoint_version bigint not null default 0`
- `backfill_state text not null default 'not_started'`
- `schema_fingerprint text`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

with a unique identity across organization, connection, and stream, explicit RLS, no browser write access by default, and server-role access declared alongside the table.

The exact foreign-key target for `connection_id` must be chosen during migration review. SONARA currently has more than one historical integration/connection table, so the migration should not silently bless the wrong one.

## Verification requirements

Before production application:

1. create the migration through the current Supabase CLI;
2. replay the entire migration chain on a clean database;
3. run Supabase security and performance advisors;
4. run positive owner/member tests;
5. run anonymous and cross-tenant negative tests;
6. test service-role reads/writes;
7. test stale checkpoint version rejection;
8. test duplicate/replay behavior;
9. run repository launch gates;
10. capture exact preview/production migration and commit evidence.

## Preview branch status

A new isolated Supabase preview branch would cost **$0.01344/hour** for the connected organization at the time of this audit. No new branch was created because cost confirmation is required before incurring it.

An existing Supabase preview branch belongs to a different feature PR and is not reused for this hardening work.

## Next step

Once branch cost is explicitly approved, create an isolated Supabase development branch, generate the append-only migration through the supported CLI workflow, apply the hardening migration there, run advisors and authorization tests, then attach the evidence to this engineering PR before production deployment.
