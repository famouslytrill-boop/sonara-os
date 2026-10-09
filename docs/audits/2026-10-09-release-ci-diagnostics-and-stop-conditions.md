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

