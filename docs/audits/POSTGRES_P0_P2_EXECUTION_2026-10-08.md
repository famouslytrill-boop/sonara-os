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

## 2. P1 — 25 remaining RLS initplan warnings

Read the Supabase advisor and `pg_policies` together; 25 actual affected
policies on 25 tables, divided into:

- **21** `auth.role()` predicates, mostly service-role only. These may be
  expensive when evaluated row-by-row, but semantics are important:
  `(select auth.role())` should be tested as a scalar InitPlan, **not**
  changed into a blanket `USING(true)` grant.
- **4** `auth.uid()` ownership predicates in
  `business_employee_profiles`, `sonara_platforms`,
  `user_notifications`, and `user_preferences`. Keep comparison
  against the row's `user_id`.
- `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` is a **guarded
  staging-only proposal**, not an applied migration. It verifies exact
  old predicate text, policy role scope and command, tests 25 scalar
  rewrites inside a disposable transaction and rolls back.
- Before production: review output of exact-head PG 17 replay; verify
  A/B write/deny and role grants on populated test tables; then create
  a forward migration with the Supabase CLI. Do not edit historic migration.

### Follow-on correction, October 10, 2026 — native replay expectations

The full migration history now includes `20261008100000_tighten_service_role_rls_policies.sql`, which postdates this October 8 snapshot's older P1 proposal. GitHub's PostgreSQL 16 and 18 native-replay logs demonstrated that all 25 expected pre-hardening policies **no longer match** the replay catalog: 21 pure service-role predicates are now `TO service_role USING (true)` (with `WITH CHECK (true)` for ALL), and four ownership policies already use a `SELECT auth.uid()` initPlan. Re-running the old `ALTER POLICY` statements would regress the policy design.

The remediation branch `fix/p1-rls-guarded-replay-current-baseline-20261010` updates the staging-only SQL probe to require **exactly those 25 hardened definitions** and verifies the canonical migration-defined `subscriptions_select_member` policy without modifying it. The two duplicate subscription policies are live-preview-only drift, not present in checked-in migration definitions. It does not create another production migration, drop or rewrite any of the 25 protected policies, change grants, or remove the abort-on-drift check. The entire probe ends with `ROLLBACK`; the separate P0 synthetic two-tenant role/write-deny matrix continues to run first. **This is an unverified draft until native replay succeeds at the exact PR SHA.** Security reviewers must still inspect production identity, migration history, and live Supabase advisors before any activation.


### Native-replay subscription drift resolution, October 10, 2026

The exact-head #617 native replay on PostgreSQL 16/17/18 now passed the 25-policy hardened baseline check, then failed with `subscriptions duplicate policy definitions drifted; abort`. Research of checked-in migration SQL identified `subscriptions_select_member` in `011_sonara_saas_launch_system.sql` but **neither** of the two extra `Users can view ... subscription` policies. The preview has the two extra policies, while the canonical member/admin policy is absent from the earlier preview read of `pg_policies`; that divergence is not resolved by a replay fixture.

The updated replay fixture checks for `subscriptions_select_member` under the authenticated role, a member-or-admin predicate, a SELECT command and absent WITH CHECK, and fails if either unexpected preview-only duplicate exists. It does not write subscription policies and ends with `ROLLBACK`. **Exact-head CI verification remains pending.** Preview cleanup is a separate security/DB-ownership change requiring read/deny tests and migration reconciliation, not an implicit effect of testing Creator Studio.

### Connected Supabase preview read-only verification, October 10, 2026

Source: Supabase project `yqncsonkxgwhcxedgevk` (`preview` release channel, PostgreSQL 17.6). **Not verified production.** No DDL or customer-data queries were run.

- Supabase's migration ledger returned **163 entries**, ending with `20261008100000_tighten_service_role_rls_policies`.
- Executed a **read-only** query that joined the exact `expected_rls_p1` 25-row baseline from `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` against `pg_policies` and compared schema/table/policy name, permissiveness, role array, command, `qual`, and `with_check` using `IS DISTINCT FROM`. Result: **25 expected policy rows; 0 mismatches**.
- Queried only `pg_policies` metadata for the two `subscriptions` SELECT policies. Result: **2 expected policy names; 1 distinct definition**. Both are scoped to `{authenticated}`, command `SELECT`, predicate `(( SELECT auth.uid() AS uid) = user_id)`, with no `WITH CHECK`. This supports, but does not execute, the existing transaction-rolled-back duplicate-policy proof.
- Current preview Supabase security advisors reported **10 WARN** findings: one `extension_in_public`, eight `authenticated_security_definer_function_executable`, and one `auth_leaked_password_protection`. They also reported **66 INFO** `rls_enabled_no_policy` findings. These must be triaged against actual roles/grants, deliberate internal-only tables, and the Auth configuration; **do not bulk-add permissive policies or revoke helpers without role/tenant regression proof**. Official remediations: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public , https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable , https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- A separate read-only `pg_proc` review of all **8 advisor-flagged SECURITY DEFINER function signatures** found `SECURITY DEFINER=true`, `search_path=""`, `anon EXECUTE=false`, and `authenticated EXECUTE=true` for each. This is consistent with intentionally callable membership helpers; it does **not** independently prove authorization logic inside their function bodies is correct. Their per-tenant allow/deny semantics remain part of the explicit role matrix; do not revoke `authenticated` merely to hide the advisory.
- Acceptance is still conditional on **exact-head native PostgreSQL 16/17/18 replay, synthetic role-write/deny tests, full CI, protected-main governance, and separate production migration identity verification**. Read-only preview comparison alone is not a green release.

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
The earlier staging-only draft attempted to drop one duplicate policy, but
the native PostgreSQL migration replay does not create either of these two
preview-only policy names. The actual repo migration
`011_sonara_saas_launch_system.sql` defines
`subscriptions_select_member` for `public.subscriptions`.
The corrected replay now asserts the canonical member/admin policy is present
and refuses unexpected preview-only policy names. It performs **no subscription
policy DDL**. The two identical live preview policies remain unchanged.
A separate approved forward migration is required for live duplicate cleanup
after production database identity and owner/member allow/deny proof.

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
