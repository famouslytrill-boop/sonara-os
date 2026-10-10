# SONARA Autonomic Recovery — Phase 5: Correctness and Incident Reconciliation

**Date: 2026-10-08 | Status: draft PR #510 | Not merged, migrated, deployed or activated.**

## Research-derived engineering corrections

1. **A retry's deadline must be checked again after awaiting authorization.** A worker can claim valid work and then spend its entire remaining deadline inside an asynchronous authorization call. Phase 4 checked only before the call; Phase 5 checks a fresh server clock directly before any provider effect. Invalid/expired deadlines are terminally marked unverified and never automatically replayed.
2. **A recovery kill switch must be evaluated at the action boundary.** An operator may pause the subsystem after the worker claimed the job. The injected `isPaused(context)` callback is evaluated after authorization and before the effect; refusal and control-plane errors fail closed, with an immutable terminal record. Production still lacks the wired control-plane adapter.
3. **Signed observations must not mutate across asynchronous authentication.** Event fields are copied into a frozen snapshot before `verifyObservation`, and only the verified snapshot can be admitted for later planning. This prevents a caller from swapping a harmless error signal for a sensitive one between authentication and recovery planning.
4. **The database cross-attempt test constructed malformed JSON.** Its hand-escaped JSON key was replaced with `jsonb_build_array(k, 'operation-1', 1)::text`. This makes the native fixture reach the intended per-tenant+operation unique constraint rather than failing early in JSON validation.
5. **Authenticated ingress is now composed in one place.** `ingestAuthenticatedRecoveryEvidence` first requires registered signed sensor provenance and authoritative tenant/provider/idempotency state, then schedules only the optional-provider idempotent retry. Other actions cannot enter the delayed-retry queue through this boundary.
6. **Ambiguous work needs visibility, not blind retry.** The read-only `inspectRecoveryBacklog` classifier groups jobs into due, waiting, deadline-lapsed, in-flight, stalled, verified, unverified and failed. It returns aggregate counts and fixed manual-review codes with no tenant IDs, claim tokens, provider credentials or actionable SQL. `autoRequeueAllowed` is always false.

## Code added or corrected

- `lib/sonara-due-recovery-worker.cjs`: fresh-deadline, late-pause and pre-effect versus post-effect failure classification.
- `lib/sonara-trusted-incident-admission.cjs`: immutable event snapshot.
- `lib/sonara-recovery-incident-ingress.cjs`: authenticated sensor → registry → durable scheduler composition.
- `lib/sonara-recovery-reconciliation.cjs`: read-only operator triage; no database connection or repair.
- `tests/sonara-delayed-retry-worker.test.js`: additional fault-injection paths.
- `tests/sonara-recovery-incident-ingress.test.js`: signed versus unsigned, tenant-spoof and event mutation regression.
- `tests/sonara-recovery-reconciliation.test.js`: overdue, stalled, failed, corrupt evidence and secret redaction.
- `tests/sql/autonomic-delayed-retry-role-matrix.sql`: repair malformed dedupe test input.

## Verification

Local isolated runtime evidence: existing SONARA recovery unit suite 33/33 passed; 5/5 focused worker fault-injection cases passed; 4/4 signed-ingress integration scenarios passed; 4/4 pure reconciliation scenarios passed. These are **isolated tests only**, not an equivalent full repository `pnpm test` run, not PostgreSQL execution and not production proof. The exact final PR SHA and database replay must be green before any merge.

## Remaining hard gates

- Native PostgreSQL 16/17/18 migration replay including two independent connections contending for the same due job, and real service-role/anon/authenticated access proofs.
- Real server-only signature verification (trusted provider keys or authenticated collector), tenant/resource registry, private queue reader, and runtime kill-switch implementation.
- Provider-specific idempotency and fencing checks against the authoritative operation record; timeout and ambiguous-provider-response drills.
- Read-only operator review route using approved tenant-scoped aggregates, explicit manual reconciliation and retained evidence, without exposure of service-role keys.
- Monitor p95 queue age, duplicate-claim attempts, stale-started incidents, false-positive pages, error-budget burn, cost per verified recovery and MTTR.
- Entire exact-commit GitHub matrix; merge protection; approved staging migration and separately authorized single-tenant production canary.

## References

- PostgreSQL 18 `SELECT FOR UPDATE SKIP LOCKED`: https://www.postgresql.org/docs/current/sql-select.html
- PostgreSQL transaction isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- Google SRE multiwindow burn-rate alerting: https://sre.google/workbook/alerting-on-slos/
- Supabase Queues/PGMQ visibility: https://supabase.com/docs/guides/queues/pgmq
