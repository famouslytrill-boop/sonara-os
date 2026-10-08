# SONARA Self-Healing Engineering — Pass 6 (2026-10-08)

**Status:** Draft PR #510. No merge, staging/production migration, provider activation, cron, polling loop, or live auto-repair.

## Research and observed blockers

- PostgreSQL SELECT FOR UPDATE SKIP LOCKED is appropriate for contending queue consumers, but its existence alone does **not** prove two independent workers cannot claim the same work. A real two-session race test is now required during native migration replay.
- A process-local pause flag must never be the implicit default when automatic recovery is enabled. The worker must require an explicit control-plane pause adapter and fail closed if absent.
- Deadline checks can grow stale across *any* awaited callback, not just authorization. Check again after awaiting the kill-switch status and immediately before the external provider effect.
- GitHub API inspection at this pass showed the PR's 13 latest required-workflow candidates queued/pending, not green; public rulesets collection was empty. Branch protection API was inaccessible to the GitHub integration (HTTP 403), so **do not claim main is protected or unprotected based only on that API**.
- The repository has very high GitHub Actions volume and other workflow runs are being queued/cancelled. A queue/backlog cause has not been established. Inspect GitHub account Actions limits, concurrency groups, billing/runner supply and run history in the repository settings before assuming a code defect.

## Code and contracts implemented

1. lib/sonara-due-recovery-worker.cjs: removes the permissive `isPaused = async () => false` default. An enabled worker requires a supplied operator pause adapter, and rechecks the deadline after that asynchronous call. Failed or absent controls prevent the provider effect.
2. tests/sonara-delayed-retry-worker.test.js: updates enabled-worker fixtures to supply an explicit pause adapter and adds tests for missing control-plane adapter and deadline expiry while the pause read is running.
3. scripts/verify-migration-replay.mjs: seeds one synthetic due retry and runs TWO independent PostgreSQL connections in parallel against public.sonara_claim_due_autonomic_retry(). It fails unless exactly one returns an actual claimed job and the committed database shows exactly one started job.
4. Existing tenant/identity/idempotency, ledger, signed-ingestion and reconciliation components remain disabled by default, with no external side effects on import.

## Verification and limitations

- Isolated Node 22 worker fault-injection script: **7/7 passed**, including late deadline, operator pause, absent pause adapter, ambiguous provider outcome and post-pause expiry.
- Existing isolated recovery suite: **33/33 passed** in the local mirror. This does not establish full repository test/coverage/build success on the PR SHA.
- Syntax of the added two-session replay block: checked in JavaScript parser. This does not prove PostgreSQL replay, role checks, contention behavior or a CI run succeeded.
- Actual GitHub workflows and PostgreSQL native replay: pending at last inspection; release remains blocked.
- Two independent database connections are used in the disposable replay; synthetic test data is confined to its throwaway cluster.

## Next execution and evidence

1. Stop uncontrolled rapid pushes while collecting exact-SHA CI; diagnose workflow queue and any required-runner bottleneck.
2. Run PostgreSQL 16/17/18 full native replay; inspect both SQL and permission-check results. Repair actual red checks without bypassing them.
3. Review live migration history, DATABASE TARGET, RLS advisor warnings, private schema privileges, approved rollback and staging restore.
4. Wire a real authenticated server-only monitor signature verifier and trusted resource registry, with per-tenant/operator feature flag and a **remote fail-closed pause adapter**.
5. Connect one optional idempotent provider with side-effect fencing and immutable provider reconciliation evidence; fault-inject lost responses/crashes.
6. Release only after exact-commit CI, tenant authorization, payment isolation, operator approval and a monitored canary.

## Source references

- PostgreSQL row locks: https://www.postgresql.org/docs/current/sql-select.html
- PostgreSQL transaction isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- Supabase queue visibility: https://supabase.com/docs/guides/queues/pgmq
- Google SRE multiwindow burn: https://sre.google/workbook/alerting-on-slos/

**Risk policy:** payments, refunds, secrets, auth/identity, privileged grants, destructive schema changes, legal actions and production deployment remain human-approved and out of automatic repair scope.
