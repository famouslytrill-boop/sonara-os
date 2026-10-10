# Exact-head SONARA release failures — 2026-10-08, main 9d141e68

**Status: CI remediation proposed, NOT production approval.**

## Reproduced failure inventory

GitHub Actions checked SHA `9d141e68d1ec14c037f92d1eebb3c2718d583c0a`.

- Nine native replay matrix jobs (Node 22/24/26 × PostgreSQL 16/17/18) reported: `P1 policy definition drift on 25 policies; abort`. The stack originated in `tests/sql/p1-rls-initplan-policy-dedup-rollback.sql`. The earlier P0 synthetic two-tenant RLS proof ran before this staging-only P1 probe.
- Node 26 blocking compatibility failed after 7,083 passing tests because `docs/HANDOFF_PROMPT.md` reported **513** Mocha files but the independently measured test suite now contains **516**. The handoff generator reads `.mocharc.json`; do not modify its count algorithm or downgrade the test.
- Primary `sonara-industries` CI also failed during the test phase; exact-head green CI cannot be claimed while it is red.
- `main.protected=false` and zero GitHub repository rulesets remained observed; a successful workflow alone would not enforce safe merges.

## Cause: P1 probe checks obsolete policy preimages

An immutable repository migration, `20261008100000_tighten_service_role_rls_policies.sql`, already hardens pure `auth.role()='service_role'` policies to `TO service_role USING (true) WITH CHECK (true)`, narrowing evaluated roles instead of applying a generic public predicate. It also optimizes four `auth.uid()` owner selectors with scalar `SELECT`.

The older P1 **rollback-only proof** assumed the unoptimized/historical state for all 25. Its preflight correctly aborted: it should not silently edit a database whose definitions differ from its fixture. The remediation is to **update the probe's expected state**, not to roll back the actual hardening migration or blindly drop policies.

A read-only SQL comparison of all 25 hardened fixture entries to `pg_policies` in active target `yqncsonkxgwhcxedgevk` returned **zero differences**. This proves that precise fixture comparison for that target at inspection time; it does not prove the full replay or customer tenant isolation.

## Corrective changes proposed in PR #519

1. Update the P1 fixture to the 21 exact service-only policies and four exact authenticated ownership InitPlans. Compare policy name, table, permissive mode, roles, operation, USING and WITH CHECK; fail closed on any missing policy or drift.
2. Remove 25 now-obsolete `ALTER POLICY` attempts from the staging-only probe. This is not permission to remove RLS permissions; the already-applied migration remains canonical and immutable.
3. Keep a strict equality check on the *two identical* `subscriptions` SELECT policies; verify the impact of dropping only one inside `BEGIN ... ROLLBACK`, with no persistent schema change.
4. Refresh the one generated handoff test-count field from 513 to 516 and retain the independent Mocha file-count test.
5. Extend existing tests to assert 21 + 4 policy fixture coverage, no `ALTER POLICY`/grants/commits, and an explicit final rollback. No new test file is added so the Mocha count remains stable.

## Native verification before merge

- Execute `node scripts/verify-migration-replay.mjs` with `SONARA_MIGRATION_REPLAY_REQUIRED=1` and PostgreSQL binaries; require the P0 synthetic tenant matrix, P1 staging rollback proof and complete migration replay to pass in all blocking Node/PG combinations.
- Run `pnpm exec mocha tests/postgres-optimization-keeps-ownership.test.js tests/the-handoff-counts-what-mocha-runs.test.js`.
- Run `pnpm run verify:handoff`, `pnpm run verify:applied-migrations`, `pnpm run verify:db`, `pnpm run verify:launch` and all exact-head required GitHub checks. A queued, cancelled or failed check does not establish green.
- Preserve evidence of the actual commit SHA, migration filenames and hashes, PostgreSQL versions, replay snapshots, denied cross-tenant read/writes, 401/403/5xx behavior, restore plan and reviewer approval. Never accept passing static tests as proof of real external provider connectivity.

## Independent release blocks

**Admin-owned:** An active branch ruleset targeting main with required PR reviews/status checks and bypass restrictions; a protected production environment with real reviewers and self-review prevention. Official reference: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository and https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments

**Database:** migration provenance review for version `20260919032950` and isolated two-user RLS testing; live matching policy text is insufficient to approve unverified historical SQL.

**Payments:** a verified Stripe test/sandbox account, seller-scope signing and webhook/refund/reconciliation, idempotent stock and licensed delivery; the connected live-mode account must NOT be used for trial charges.

**Mobile/social:** Play-signed Android internal track and device evidence, iOS Xcode build/secure signing/TestFlight review, StoreKit/Play Billing policy and provider proof, moderated opt-in social pilot. Static registry, iOS shell or billing classifier source does not prove store readiness.

**Production:** Vercel production remains intentionally offline; no deploy, migration, live money operation, public social activation or app-store submission is authorized by this audit.

The release decision is based on passing exact-head checks and real isolation/provider proof—not merely eliminating all database advisor warnings.
