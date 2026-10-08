# SONARA PostgreSQL P0–P2 execution and acceptance ledger

Date: 2026-10-08. Source: read-only inspection of active Supabase project
`yqncsonkxgwhcxedgevk` (PostgreSQL 17.6), matching GitHub migrations, and
GitHub Actions native-replay evidence. **This is the active preview project,
not verified production.** No production project was altered in this audit.

## 1. P0 delivered and evidence

- `20261008090000_consolidate_postgres_index_rls_hygiene` **applied**:
  162 total migrations. The two redundant indexes were removed and the
  unique `entities_slug_key` and employee-schedule replacement survive.
  All three rewritten ownership predicates preserve role grants.
- Native full migration replay across Node 22/24/26 and PostgreSQL 16/17/18
  succeeded for PR #477; an earlier PG signing-key network fetch failed and
  was fixed by capped retries and installer evidence.
- Live **read-only** authenticated test using two real, distinct memberships
  showed self organization/member visibility and cross-org denial for each
  user. A separate `user_preferences` test allowed only the record owner.
- All eight authenticated `SECURITY DEFINER` helpers were inspected:
  `can_manage_entity(uuid)`, `has_entity_role(uuid,entity_member_role[])`,
  `has_org_role(uuid,text[])`, `has_org_role(uuid,text)`,
  `is_entity_member(uuid)`, `is_org_member(uuid)`,
  `is_org_owner_or_admin(uuid)`, `sonara_is_org_member(uuid)`.
  Anonymous EXECUTE is denied; all set an empty `search_path`.
  Owner helpers returned true for the tester's own membership, false for
  the other organization. Three entity helpers returned false without a
  matching entity membership. These roles/functions are shared by RLS
  policies, so blanket REVOKE or SECURITY INVOKER replacements would be unsafe.
- **Not yet accepted:** anonymous, authenticated A and B, service-role,
  positive inserts, negative cross-user inserts, prohibited updates/deletes
  and creator-follow policy behavior require synthetic test fixtures.
  Fresh migration replay requires `public.profiles` for membership foreign
  keys and is currently missing authenticated table grants on
  `public.user_preferences` that the active preview database has. PR #482's
  fixture therefore seeds synthetic profiles and uses **transactional
  staging-only preference grants** before exercising RLS; the real schema
  and grant discrepancies remain open in issue #492.
  `tests/sql/p0-auth-rls-role-matrix.sql` is designed to execute only
  in the disposable native PostgreSQL replay and to finish with `ROLLBACK`.
  `scripts/verify-migration-replay.mjs` fails if its success marker is absent.
  This isolates checks from live customer records. **CI outcome controls
  whether the fixture may be counted as passing.**
- GitHub main branch metadata currently reports `protected=false` and
  no rulesets. Production workflow itself rejects `main.protected!=true`
  and requires exact-SHA green CI and manual dispatch. That protects the
  controlled deployment route, **not merging**. Administrator must configure
  protected `main` and mandatory checks; canonical tracking issue #460.
- The generated handoff PR #481 merged but an additional generated
  `docs/CAPABILITY_ROUTE_SCHEMA_COVERAGE.md` number remained stale:
  161 instead of 162 migration files; this PR refreshes the derived number.
  Re-run generator `--check` and full exact-head CI.

## 2. P1 — RLS InitPlan/service-role hardening

The advisor snapshot originally identified 25 scalar-auth policy warnings:
21 service-role predicates plus four `auth.uid()` ownership predicates.
Repository state has now advanced beyond that proposal.

- `20261008100000_tighten_service_role_rls_policies.sql` is present on
  current `main` through the 8 October integration merge. It is a forward
  migration, not a staging-only SQL experiment.
- The migration deliberately handles the full class of **pure** service-role
  predicates it finds at apply time, not only the original 21 advisor rows:
  a policy whose complete authorization condition is
  `auth.role() = 'service_role'` is narrowed to `TO service_role` and the
  redundant row predicate becomes constant `true`. Mixed member/admin OR
  service-role policies are excluded.
- The four ownership policies in `business_employee_profiles`,
  `sonara_platforms`, `user_notifications`, and `user_preferences`
  remain `TO authenticated`, keep comparison against `user_id`, and wrap
  `auth.uid()` in `SELECT` so PostgreSQL can use an InitPlan.
- `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` now verifies the
  **post-migration** invariants during native replay. It no longer expects the
  old predicates or simulates a change that already belongs to the migration
  history. The only DDL it still stages is removal of one exactly duplicated
  `subscriptions` SELECT policy, and that operation remains inside a
  transaction that ends in `ROLLBACK`.
- The active Supabase project was still applied only through
  `20261008090000_consolidate_postgres_index_rls_hygiene` at the latest
  read. Therefore the forward hardening must **not** be applied until current
  `main` is green at its exact SHA. After apply, rerun security/performance
  advisors and tenant allow/deny checks before accepting the change.

This follows Supabase's current RLS guidance: scope policies with explicit
roles and wrap fixed JWT/helper calls in `SELECT` when the result is not
row-dependent. Narrowing a pure service-role policy to `TO service_role`
preserves the intended caller while avoiding needless evaluation by browser
roles; it is not equivalent to changing a mixed authorization policy to
`USING(true)`.

## 3. P1 — 1,292 overlapping permissive-policy warnings

These are **lint findings**, not 1,292 independent privacy leaks.
Read-only grouping on the active database:

| Category | Warnings |
| --- | ---: |
| Internal SQL roles (`authenticator`, `cli_login_postgres`, `dashboard_user`, `supabase_privileged_role`) | 804 |
| Client `anon`/ `authenticated` without required table privilege for the flagged operation | 160 |
| Client role with relevant privilege; needs predicate-specific review | 328 |
| **Total** | **1,292** |

The 1,292 findings span **201 tables**. Among the 328 client-role/grant
combinations, **200** include a predicate specifically checking
`auth.role() = 'service_role'` (including its InitPlan form), while
**128** have no such predicate in their permissive policy set. This
classification is based on catalog predicate text; a service-role guard is a
triage signal and does **not** prove the remaining OR conditions are safe.
The 128 without that guard deserve the earliest role/tenant semantic review.

The read-only query used for exact policy duplication, effective client grants,
RLS policy overlap and all candidate FK indexes is now checked into
`scripts/sql/postgres-p1-p2-candidate-review.sql`. Its four diagnostic SELECTs
were executed successfully against the active preview database. It performs
**no DDL** and makes no decisions to drop policies or add indexes.

Some of the 328 client-role/grant
overlaps are harmless OR combinations of a tenant check and a service-role-only
condition; others may not be. Audit action and row predicate for each before
merging/removing policies.

One **verified exact** duplication is two permissive `subscriptions` SELECT
policies for authenticated, both with
`(( SELECT auth.uid() AS uid) = user_id)`.
The staging-only P1 SQL proposal removes only one copy, after proving both
policies' permissions, role, command, and predicate are identical.
It does not drop any table, expand privileges, or alter customer rows.

Any broad policy consolidation must preserve the original OR semantics.
Do not assume similar function names prove equivalent for every user/role.

## 4. P1 — deep database snapshot

`public.sonara_database_deep_snapshot()`:
`pg_stat_statements` window began 2026-10-05 05:58 UTC;
31 calls, mean ~507.3 ms, cumulative ~15.73 seconds.
It is part of production-schema verification, **not** an ordinary
user-facing page query. With current low frequency, no cache, index,
function-contract change or throttling is justified: the safe optimization
is to run it on intentional verification, not to move it to an every-page
request. Re-evaluate with actual latency/CPU and caller evidence.

## 5. P2 — missing FK indexes, actual workload

Performance advisor: **379** missing FK index notices and **581** unused-index
notices. The latter do not mean those indexes are safe to remove.
`admin_audit_events`: ~17 estimated live rows, 5 sequential scans,
~64 KB total relation. `workspaces`: ~1 estimated row, 3 sequential scans,
~48 KB. `organization_memberships`: ~2 estimated rows, 54 sequential scans,
~112 KB. `service_catalog_items`: ~53 estimated rows, 33 sequential scans,
~200 KB. PostgreSQL sequential scans of such tiny tables are expected.
No index build is warranted today simply to silence a linter.

The conservative read-only B-tree prefix-coverage query in the new audit file
reported **385** candidate FKs versus 379 advisor warnings. Differences in
coverage definitions, index access methods, partial/expression indexes and
constraint selection must be reconciled before a build plan. All 385 candidates
had fewer than 1,000 planner-estimated child rows, maximum estimated 17.
Neither estimate is sufficient to justify 385 writes on an early-stage DB.

Future index candidate trigger: table/child cardinality grows materially,
analyzed `EXPLAIN (ANALYZE, BUFFERS)` shows FK parent-delete or tenant join
latency attributable to scanning, and measured read gain exceeds write/index
space cost. Design a narrow leading-key index, review overlapping indexes,
run on isolated staging and use a separately gated migration. Never auto-create
379 indexes or bulk-drop 581 allegedly unused indexes.

## 6. Go/no-go sequence

1. Native ephemeral PostgreSQL RLS allow/deny and guarded P1 proposal pass
   across the exact-head replay matrix, with no skipped database execution.
2. Repository gates all green on the **actual promoted commit**. Generated
   handoff, capability coverage, migration manifest and full test suite in sync.
3. Admin enforces GitHub `main` branch protection and required green checks.
4. Authorized staging (real PostgREST tokens) verifies cross-user SELECT,
   INSERT, UPDATE, DELETE allow/deny for affected tables and security-definer
   helper usage; confirm any anonymous behavior and prevent exposure of
   `service_role` credentials. No live customer test writes.
5. Only with deployment approval may a new production migration be applied.
   Compare advisor state, grants, policies and rollback afterward.

## Sources

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/postgres/row-level-security-performance
- https://supabase.com/docs/guides/database/query-optimization
- GitHub PR #475, #477, #481; issue #460; this PR's native-replay evidence.
