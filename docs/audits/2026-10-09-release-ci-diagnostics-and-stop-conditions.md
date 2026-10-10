# Release gates: source-license false positive, generated handoff count and remaining blockers
**Verified October 9, 2026; source:** actual GitHub Actions job logs for PRs #574, #576 and #577.
**Status:** two deterministic documentation repairs plus staging-only read diagnostics; full release remains blocked.

## Evidence and decisions

| Gate | Observed source-backed failure | Safe response | Scope |
| --- | --- | --- | --- |
| `pnpm test` | `tests/the-handoff-counts-what-mocha-runs.test.js` reports 513 in the committed generated handoff, versus 518 files on PR #574, 517 on PR #576 and 519 on PR #577 | Recompute the output from `.mocharc.json` test-file discovery; base `main` has **516** runnable `.js`/`.mjs` files. Correct main's generated handoff to 516; each feature branch must regenerate against its own head before merging | In this branch: `docs/HANDOFF_PROMPT.md` |
| `verify:source-licence` | `ios/README.md` says `open-source XcodeGen` as an upstream tool; checker misclassifies this as a claim SONARA's own source is permissively licensed | Identify XcodeGen as a **separately licensed third-party project**, without changing license rules, public rights or tool dependencies | In this branch: `ios/README.md` |
| `verify:migration-replay` | `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` fails `P1 policy definition drift on 25 policies; abort`, reproduced across all 9 inspected Node/Postgres matrix jobs | Preserve the abort. Compare 25 expected `pg_policies` rows with actual replayed fixture policies and the selected active preview project; distinguish missing policies from normalized `qual`, `with_check` and role text mismatches before any SQL proposal | **Not changed** |
| Browser Quality | Chromium passed on PR #577; Firefox and WebKit failed. WebKit logs include public UI skip-link/mobile-nav assertions and failure to load `/creator-image-core.js` | Reproduce with server/asset response evidence in the affected engines; do not rewrite the visual system, drop assertions or infer a deployment fix from Chromium | **Not changed** |
| `verify:coverage-floor` | Workflow failed, but captured log did not contain an actionable coverage summary; a long HTTP request trace appears before the generic exit code | Read the coverage verifier or generated artifact and capture concise failure output and the exact source-level percentage before diagnosing | **Not changed** |

### Exact head examples
- PR #574 SONARA Industries CI: https://github.com/famouslytrill-boop/sonara-os/actions/runs/37906670204 — `the handoff says 513 test files; mocha's own spec matches 518`.
- PR #576 SONARA Industries CI: https://github.com/famouslytrill-boop/sonara-os/actions/runs/37907485584 — same 513 vs 517.
- PR #577 SONARA Industries CI: https://github.com/famouslytrill-boop/sonara-os/actions/runs/37909510472 — 513 vs 519; Build was skipped after test failure.
- PR #577 release diagnoses: https://github.com/famouslytrill-boop/sonara-os/actions/runs/37909510681 — `verify:source-licence` and `verify:coverage-floor` failed.
- PR #577 migration replay: https://github.com/famouslytrill-boop/sonara-os/actions/runs/37909510528 — policy drift failure.
- PR #577 browser tests: https://github.com/famouslytrill-boop/sonara-os/actions/runs/37909510523 — Chromium pass; Firefox/WebKit failures.

### Count verification

The checked repository's `.mocharc.json` selects `tests/**/*.js` and `tests/**/*.mjs`. `main` lists 516 top-level matching JavaScript test files; `tests/fixtures`, `tests/helpers` and `tests/sql` contain no additional `.js`/`.mjs` files under those glob patterns. Hence a generated-document count of 516 is correct at this baseline. PR #574 adds 2; #576 adds 1; #577 adds 3. A branch-specific count **must not** be manually copied across PRs: use `node scripts/generate-handoff-prompt.mjs` in that branch after code integration and verify via its `--check` mode. The CI branch updates only the existing derived count; the generator itself remains unchanged.

## Safe RLS investigation before any repair

The staging-only P1 SQL starts a transaction and intentionally ends in `ROLLBACK`. It compares 25 explicitly enumerated policy names and `pg_policies` attributes. Failing that precondition is evidence that the candidate alteration must **not** execute.

Use a read-only staging query or dump to collect `schemaname`, `tablename`, `policyname`, `permissive`, `roles`, `cmd`, `qual`, `with_check` for the named rows, then compare exactly against `expected_rls_p1`. Record exact PostgreSQL version and source migration SHA. Only then produce an audited reversible fix with two-tenant, anonymous and service-role adversarial tests. Do not disable the guard, delete the migration, broaden a role, or declare rollback proof green without execution.

## Release and authority

- This work is a separate CI-only change; no production database, schema, app behavior, customer content, billing or code licensing changes.
- Protected `main` rules have **not** been enabled. GitHub documentation recommends required status checks, PR reviews and bypass restrictions. That is an administrative action and must be verified separately.
- No claim of overall green CI, merger readiness or deployment follows from correcting two individual deterministic failures.
- CI jobs and the docs may change concurrently; rerun against the final commit before changing status.

**Sources:** https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches and https://www.postgresql.org/docs/current/view-pg-policies.html.


### Staging-only diagnostic addition

The test-only SQL file `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` now emits a read-only diff of policy names and mismatched attribute labels (`policy_missing`, `permissive`, `roles`, `command`, `using_expression`, `check_expression`) before the existing `DO $drift$` guard raises an error. It deliberately does **not** print full policy predicates, expand grants, or apply the proposed changes on a drifting database. The guard still aborts on a nonzero difference and the file retains its final `ROLLBACK`.

Success criterion for this diagnostic: on the next exact-head native replay, the job must show actionable table+policy mismatch classifications and still fail closed when drift exists. This is not a policy fix or a successful migration replay. No PostgreSQL execution of this edited probe was available from the connected tooling before PR creation.



### Exact-head follow-up (October 9, 2026)

PR #580 at the earlier head `7e56221200c9953ad3a26f1183b4781f467ad83b` passed Node compatibility, SONARA One Validation, Docker, dependency scan and other initial checks. SONARA Industries CI failed at `verify:capability-coverage` instead of the previous handoff count. Its job output reported **61 documented formula definitions versus 59 actually imported from `lib/sonara-formula-library.cjs`**; the formula table itself already has precisely 59 matching keys. The header was corrected in `docs/CAPABILITY_ROUTE_SCHEMA_COVERAGE.md` without adding or removing formula implementation.

The edited SQL P1 diagnostic ran on that prior head but its output never appeared in the error log, because `scripts/verify-migration-replay.mjs` handled failure as `result.stderr || result.stdout`. PostgreSQL correctly wrote the abort on stderr, hiding diagnostic rows on stdout. The runner now prints **at most 30 pipe-delimited P1 diagnostic lines, each at most 320 characters**, followed by the same PostgreSQL stderr and nonzero exit. Other SQL probes do **not** log arbitrary stdout. `tests/native-migration-replay-installer-resilience.test.js` asserts the bounded filter, P1 scope, and required replay protections. Four targeted static workflow tests passed in a JavaScript harness, but real PostgreSQL rerun on this new exact head is required.

The original RLS policy definitions and authorization boundaries remain unchanged. The P1 probe must still fail closed while drift persists. No diagnostic output is an approval to apply P1 schema changes without a resolved role/policy comparison, two-tenant access matrix and controlled staging review.

**Evidence:** https://github.com/famouslytrill-boop/sonara-os/actions/runs/37957454863 and https://github.com/famouslytrill-boop/sonara-os/actions/runs/37957454864.


### Read-only Supabase preview policy reconciliation — 2026-10-09

The connected Supabase project `yqncsonkxgwhcxedgevk` identifies itself as **ACTIVE_HEALTHY**, PostgreSQL 17.6 and **release_channel: preview**. It is not confirmed as customer production. No mutation was performed.

Read-only SQL constructed the **exact 25 expected named policies** from `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql` in a `WITH expected_rls_p1 ... AS (VALUES ...)` expression, then joined against `pg_policies` by `public` schema, table and policy name. The output was an aggregate only, with no table-row or customer-data access:

| Check | Actual preview result |
| --- | ---: |
| Expected named policies | 25 |
| Missing named policies | 0 |
| Role sets differ | 16 |
| Policy command differs | 0 |
| `USING` text differs | 25 |
| `WITH CHECK` text differs | 21 |

Examples from read-only inspection: `agent_pending_actions` has a `{service_role}` policy with `true` predicates in preview, whereas the P1 probe expects `{public}` using `auth.role() = 'service_role'`. `business_employee_profiles_select_own` and `user_preferences_select_own` already use `(SELECT auth.uid())` in preview, whereas the P1 probe expects direct `auth.uid()` calls. A text mismatch can signify intentionally hardened roles or previously applied optimization; it is **not evidence that new permissions should be granted or that expressions should be rewritten back**.

These facts do not by themselves prove the exact state of the *disposable database replayed from migrations*, nor that every textual difference affects effective access. The CI replay must now emit the bounded policy diagnostic on its newest exact commit and security reviewers must compare the replayed and preview baselines before any policy change. Preserve the fail-closed guard and perform two-user, anonymous and service-role deny/allow regression tests after any staged proposal.

The optimization technique of wrapping row-independent auth calls in a scalar `SELECT` is documented by Supabase, but does not justify changing policy scopes or bypassing role checks: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv . Column semantics are defined by PostgreSQL: https://www.postgresql.org/docs/17/view-pg-policies.html .


## P1 rollback probe reconciliation — October 10, 2026

Exact-head PR #580 at `c500b83e7395ffee1a58444ef5131461263f2e3c` yielded two remaining failed workflows (of nine). The detailed native PostgreSQL 17 job log (Node 24) showed all 25 policies present; 21 service-role policies had the already-restricted role and `true` predicates; four user-owned SELECT policies had a scalar `(SELECT auth.uid())` ownership check. The **old** P1 test expected `TO public` + `auth.role() = 'service_role'` for many policies and nonoptimized `auth.uid()` calls for four others, so every comparison failed. Those expected values were obsolete and changing actual RLS to satisfy them would risk loosening the database.

I compared the **full, explicit 25-policy expected snapshot** used in the revised staging SQL against connected preview project `yqncsonkxgwhcxedgevk`, using a read-only CTE joined to `pg_policies`. Its response: `policies=25`, `mismatches=0`, `duplicate_subscription_policies=2`. This is a database catalog comparison, not a role-based positive/negative write test or proof of production environment identity.

The staging-only SQL now checks 25 exact names, role sets, commands, predicates and checks: 21 `{service_role}` / `ALL` / `true` policies, plus four `{authenticated}` / `SELECT` / optimized owner-only policies. Drift still raises an exception. It no longer attempts **any** of the obsolete 25 `ALTER POLICY` rewrites. The only DDL it performs is a single `DROP POLICY` of one *exact* subscriptions duplicate, following proof both policies are identical, before a second check of the unrelated 25. The trial ends in `ROLLBACK`, and no permanent migration has been created or applied.

`tests/native-migration-replay-installer-resilience.test.js` now checks the unchanged required native replay, diagnostic bounds, exact reviewed baseline and no unintended `ALTER POLICY`/grant/permission changes. Six cases passed in a dependency-stubbed JavaScript test harness; a real 9-job PostgreSQL 16/17/18 CI matrix is necessary before calling the P1 probe green.

**Separate CI failure also fixed:** `verify:capability-coverage` was still failing after the corrected count because the industry formula listing omitted `activation_rate` and `retention_rate`. It was regenerated in the exact 40-item order of `lib/sonara-industry-algorithm-expansion.cjs`, not hand-approximated.

**Stop conditions:** Do not merge or deploy until full exact-head checks pass. A passing *rolled-back* duplicate-policy simulation does not authorize dropping the duplicate in production. Require tenant isolation deny/allow tests, reviewed grants, migration generation with approved CLI procedure, rollback rehearsal, and a verified target project for any future database change. Existing applied migrations remain untouched.

References: https://github.com/famouslytrill-boop/sonara-os/actions/runs/37961827643, https://supabase.com/docs/guides/database/postgres/row-level-security, https://www.postgresql.org/docs/current/view-pg-policies.html .
