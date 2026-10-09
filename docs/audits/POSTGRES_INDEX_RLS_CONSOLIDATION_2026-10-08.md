> **Post-deployment update — 2026-10-08:** Migration `20261008090000` is now
> applied to active preview project `yqncsonkxgwhcxedgevk` (162 migrations).
> Live advisor reports 0 duplicate-index warnings, 25 auth RLS initplan
> warnings, 581 unused-index warnings and 1,292 overlapping-policy warnings.
> This document's original pre-deployment counts and staging steps are retained
> as historical evidence, not the current state. See
> [P0–P2 execution ledger](POSTGRES_P0_P2_EXECUTION_2026-10-08.md).
> The active preview project is not confirmed to be production.

> **Replay probe correction — 2026-10-09:** The GitHub PostgreSQL 16/17/18 replay matrix initially failed because `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` still asserted the 25 pre-hardening RLS definitions. The separately applied forward migration `20261008100000_tighten_service_role_rls_policies.sql` already changed 21 service-only policies to `TO service_role USING (true) WITH CHECK (true)` and four authenticated ownership policies to scalar `(SELECT auth.uid())` checks. The old probe must not rewrite them back to `auth.role()`. The revised **rollback-only** probe asserts all 25 hardened policy definitions exactly, then tests one identical subscriptions SELECT policy deletion inside a transaction that ends in `ROLLBACK`. A read-only `pg_policies` comparison against the connected preview database found 25/25 policies and zero mismatches. This is **not** fresh PostgreSQL 16/17/18 replay proof; wait for exact-head CI. No migration was edited or applied, and no live policy or data was changed.
>
# Supabase PostgreSQL performance consolidation — 8 October 2026

Status: **draft, not deployed**. Database remains unchanged. This repair targets the active Supabase preview project `yqncsonkxgwhcxedgevk`, **not** inactive `sonara-industries-prod` (`ltzpppffnwopdxbchajr`).

## Live evidence (2026-10-08, PostgreSQL 17.6)

- Repository `main` has **161 migration files**. The active database reports **161 applied migrations**; all timestamp-version pairs matched. The newest applied version is `20261007130000`.
- 418 public tables, 1,172 indexes, about 14 MB total public relations (10 MB indexes). Estimated 872 live tuples; 384 estimated-empty tables. These figures are planner **estimates**, not exact counts.
- Supabase performance advisor: 379 missing FK covering indexes; only two on tables with nonzero estimated rows (17 audit events, 1 workspace). **583** unused index warnings are not drop commands.
- **28** `auth_rls_initplan` policy warnings, **1,292** `multiple_permissive_policies` warnings and one exact duplicate index pair.
- `employee_schedules_org_starts_at_idx` exactly duplicates `employee_schedules_organization_starts_at_idx`: same relation, keys, opclasses, collations, options and predicate; both nonunique, 8 KB each, zero tracked scans, unconstrained. Keep the latter.
- `entities_slug_idx` duplicates access provided by **constraint-backed unique** `entities_slug_key`, which must remain.
- The three selected policy rules currently compare `auth.uid()` to `user_id` or `follower_user_id`. `(SELECT auth.uid())` is a noncorrelated InitPlan optimization, not a permission expansion.
- `pg_stat_statements`: `sonara_database_deep_snapshot()` 31 calls / 507.29 ms average, and active service-catalog API read 19 calls / 4.09 ms average. The highest overall queries are predominantly catalog and schema introspection.
- Catalog `EXPLAIN` shows a sequential scan of `service_catalog_items` at ~53 rows; the planner's choice is currently appropriate.

## Proposed change

`supabase/migrations/20261008090000_consolidate_postgres_index_rls_hygiene.sql`:
1. Abort if definitions have drifted, or if locks cannot be obtained in 2 seconds.
2. Drop only the two redundant nonconstraint indexes. Preserve all unique constraints.
3. Rewrite exactly three RLS predicates with scalar InitPlans, keeping the original role scope, ownership checks, commands and policy names.
4. Assert expected postcondition; the transaction rolls back on error.

No new indexes, new grants, table creation, policy widening, privilege changes, data deletion, or production activation. Checksums are pinned in `supabase/applied-migration-checksums.json`; old migrations are immutable.

## Release gates — mandatory

1. **No merge or deployment** until the change passes repository tests and is reviewed. Run `pnpm run verify:applied-migrations`, `pnpm test`, `pnpm run verify:db` and `SONARA_MIGRATION_REPLAY_REQUIRED=1 node scripts/verify-migration-replay.mjs` on a toolchain with PostgreSQL binaries. Failed or skipped replay is **not** a pass.
2. Apply to an isolated throwaway **staging** database at the same schema revision; there is no separate staging database proven available yet. Supabase branches can carry additional charges; obtain a cost estimate and explicit approval before creating one.
3. Run authenticated, anonymous and service-role **RLS integration tests** using two distinct test users. For `device_permission_grants`: user A sees and inserts only A's rows; user B does not see A's rows and cannot insert an A-owned row; anonymous may not read/insert. For `creator_follows`: verify owner filtering at the policy level with a deliberately controlled table grant in isolated staging only (the active project currently does not grant authenticated `SELECT`); preserve existing grant restrictions. Service-role operations remain unaffected. Do not use actual customer identities.
4. Benchmark identical queries and capture `EXPLAIN (ANALYZE, BUFFERS)` before/after in staging with realistic test volumes and RLS role impersonation. Empty-table planner results alone are inconclusive.
5. Capture Supabase advisor counts before/after, verify no 401/403/500 regression, and inspect logs for unexpected RLS denial. Merge intentionally; check migration history and live exact commit. **Do not** deploy the inactive production project as a side effect.
6. If post-deployment regression occurs, use the rollback SQL below in a **new forward migration**. Do not edit the immutable applied migration.

## Rollback SQL (only if already applied and change is still safe to undo)

```sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
CREATE INDEX IF NOT EXISTS employee_schedules_org_starts_at_idx
  ON public.employee_schedules (organization_id, starts_at);
CREATE INDEX IF NOT EXISTS entities_slug_idx
  ON public.entities (slug);
ALTER POLICY device_permission_grants_self_insert ON public.device_permission_grants
  WITH CHECK (user_id = auth.uid());
ALTER POLICY device_permission_grants_self_read ON public.device_permission_grants
  USING (user_id = auth.uid());
ALTER POLICY "people can read their own follows" ON public.creator_follows
  USING (auth.uid() = follower_user_id);
COMMIT;
```

## Next targeted investigations (not part of this migration)

**P0 – access boundaries:** Examine 1,292 overlapping permissive-policy lint entries by actual role/grant, plus eight security-definer RPC warnings. In Postgres, permissive RLS policies OR together; do not remove policies or change roles without a tested access matrix. The security advisor also reports the `vector` extension in `public` and compromised-password protection not enabled; track independently.

**P1 – snapshot:** The repository search located `sonara_database_deep_snapshot()` in production-schema verification (`scripts/verify-production-supabase.mjs`) and its defining migration/tests, **not in an ordinary customer page route**. Its ~507 ms mean is therefore not evidence of user-facing latency. Keep its audit response contract and server-only grants unchanged; investigate only if actual scheduled audit frequency or database CPU costs justify refactoring. Do not add user-table indexes to fix catalog query latency.

**P1 – FK indexes:** Reassess missing-FK coverage when rows, parent deletions, RLS membership lookups, or tenant joins become significant. Choose narrow, leading-key composite/partial indexes from actual query plans and writes. Never blindly install 379 new indexes.

**P2 – lifecycle:** Watch growth and nonzero customer traffic; collect normalized query fingerprints and performance baselines. Consider `ANALYZE` after bulk imports, keyset pagination for high-cardinality tables, appropriate pooling, and scheduled index hygiene.

## Supabase references

- https://supabase.com/docs/guides/database/query-optimization
- https://supabase.com/docs/guides/database/postgres/row-level-security-performance
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
