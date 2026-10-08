# SONARA Autonomic Recovery — Operator Execution Gate (Review Only)

**Date:** 2026-10-08. **Status:** independent, unmerged branch depending on draft PR #510. No deployment, migration application, live provider call, timer, feature activation, or customer data modification.

## Why this phase exists

A signed sensor observation, durable nonce claim, and PostgreSQL due-job claim do not, individually or together, grant permission to execute a provider action. A worker needs *current* operator-level permission for the exact tenant, resource, claim token and fence. An expired, superseded, or globally paused approval must prevent the effect.

## Implemented

1. `sonara_private.autonomic_execution_control` is a singleton global switch created with `enabled=false`.
2. `sonara_private.autonomic_execution_grants` is scoped to one organization and one resource key. It defaults to denied, requires distinct requester/approver labels, and has an expiry within 24 hours of approval.
3. `public.sonara_autonomic_execution_permitted(job_id, claim_token, fencing_token)` is a read-only, `service_role`-only RPC. It independently looks up a **started** job, matching opaque claim and version, sufficient remaining deadline, global operator enablement, approved exact resource, and unexpired grant. Neither a caller-provided tenant nor unsigned event authority is trusted.
4. `lib/sonara-postgres-operator-gate.cjs` supplies the existing `runOneDueRecovery` worker's required `isPaused(context)` callback. Invalid claims, network failures, errors, partial results and any response other than explicit JSON boolean true all return paused.
5. `tests/sql/autonomic-operator-gate-role-matrix.sql` validates browser-role denial, default deny, no tenant grant, approved job, wrong token and fence, global pause and expired approval **inside a disposable PostgreSQL rollback transaction**. The native replay script now requires its proof marker.
6. `tests/sonara-postgres-operator-gate.test.js` tests the fail-closed adapter and its interaction with the worker. Migration SHA-256 is pinned to `supabase/applied-migration-checksums.json`.

7. `lib/sonara-controlled-recovery-execution.cjs` is the preferred server execution entry. It constructs the PostgreSQL operator gate itself and passes its `isPaused` method to the existing worker. An arbitrary permissive `isPaused` argument is not accepted by this composition layer. It adds no endpoint or background runner.
8. Additional JS tests prove missing operator RPC stops work before claiming, a caller-supplied always-allow pause function cannot bypass the controlled entry, and a positive DB grant still requires independent operation verification.

## Operational authorization boundaries

- The migration creates **no writable RPC** for modifying policy/grant tables and provides service_role no direct write permissions. A later approved, auditable operator administrative plane must handle grant issuance/revocation and authenticate both approving human identities. The distinct names in the table are necessary but **not sufficient evidence of two real authenticated approvers**.
- The singleton enabled switch is false at creation. Do not change it in production as part of this phase.
- Permission checks happen immediately before invoking a provider handler, but a permission can change between the database read and external side effect. True atomic cancellation would require downstream provider fencing or operation-specific transaction coordination. This is a known limitation; never claim universal revocation after external dispatch begins.
- No automatic recovery is permitted for billing, funds, security, identity, publication, schema changes, or deployment.
- Review PR #510 must merge and its native replay be proven green before this dependent branch can be considered.

## Tests, measurements and release gates

An isolated local Node 22 copy of the new adapter passed 8/8 focused deny/allow and error-path tests; this **does not** prove the repo suite or the new native PostgreSQL fixture. The final branch must pass native PostgreSQL replay, RLS/role matrix, migration-hash check, lint/typecheck/build, worker and sensor tests, and exact-head GitHub required checks. All currently remain separate release gates.

Suggested metrics: denied permission calls by reason, gate RPC latency p95/p99, grant expiry lead time, enabled tenants count, duplicate job claim suppressions, external ambiguous outcomes, stale started-job age, mean incident recovery time, and errors attributed to missing authority.
