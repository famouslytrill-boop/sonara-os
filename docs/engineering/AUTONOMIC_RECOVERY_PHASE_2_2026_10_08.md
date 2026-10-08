# SONARA Autonomic Recovery — Engineering Pass 2 (2026-10-08)

**Status:** Implemented on draft PR #510 for review. Not merged, migrated, deployed or enabled in production. No sensitive or financial operations can be authorized by this recovery system.

## New code in this pass

- supabase/migrations/20261008150000_autonomic_repair_fenced_claims.sql creates a private PostgreSQL claim table and append-only events table. Browser roles have no grants. Only protected Supabase service_role callers can execute its public RPCs; they use SECURITY DEFINER with an empty search path, and private tables have RLS enabled.
- lib/sonara-postgres-repair-ledger.cjs adapts the server-only RPC client to the existing deterministic supervisor without credentials, external network calls or activation on import.
- lib/sonara-self-healing-supervisor.cjs now demands a winning UUID claim token and positive integer fencing number before any action-specific handler executes; the handler and verifier both receive them.
- tests/sonara-postgres-repair-ledger.test.js tests malformed claims, RPC failure, fencing propagation and no-action failure paths.
- tests/sql/autonomic-repair-role-matrix.sql exercises real PostgreSQL role privileges, exclusive claim, duplicate suppression, pre-action audit, verified renewal after simulated cooldown, stale-token refusal and no automatic recovery after failed/ambiguous side effects. Test changes run in a rolled-back transaction.
- scripts/verify-migration-replay.mjs invokes the new native SQL probe after full disposable migration replay.
- supabase/applied-migration-checksums.json pins the new migration hash without rewriting existing migrations.

## Repair state machine

    unseen -> claimed [exclusive insert or conditional verified/cooldown renewal]
           -> started [durable pre-action audit]
           -> verified | unverified | failed [one terminal outcome]

Only verified claims may be reclaimed, and only after cooldown. A crashed worker remaining in claimed or started, and a failed/unverified action, remain blocked pending operator reconciliation. This deliberately sacrifices some recovery speed to avoid retrying an ambiguous side effect. Fencing increases on a new verified/cooldown claim; an old owner cannot record an event using its former token.

Important residual requirement: the business-side worker must additionally verify idempotency and current fencing against the authoritative job. The claim ledger prevents duplicate supervisor decisions; it cannot guarantee that an external provider's business side effect occurred only once.

## Research and implementation priorities

1. PostgreSQL INSERT ... ON CONFLICT DO UPDATE ... WHERE supports an atomic conditional claim; a process-local mutex cannot coordinate multiple service replicas.
2. Supabase Queues (pgmq) gives durable queue visibility semantics, not automatic end-to-end exactly-once external effects.
3. Multiwindow SLO error-budget burn is preferable to reacting to isolated errors or small samples.
4. OpenTelemetry should correlate versioned runbooks, claims and customer outcomes while excluding sensitive tenant values from metric labels.
5. Agents may propose patches on isolated branches, but must not authorize merges, schema changes, secrets or payment operations.
6. A durable delayed retry scheduler is **not yet wired**. An automatic provider retry must honor jitter and Retry-After in a persisted queue rather than invoking provider handlers immediately. Do not connect live retry handlers without enforcing that schedule.

Sources:
- https://www.postgresql.org/docs/current/transaction-iso.html
- https://supabase.com/docs/guides/queues
- https://sre.google/workbook/alerting-on-slos/
- https://opentelemetry.io/docs/

## Acceptance

The draft is not promotable until exact-head CI (typecheck, lint, build, tests, security, coverage), migration checksums, native PostgreSQL 16/17/18 replay, true role/fencing checks, current production database identification, idempotent worker proof and independent health checks pass. Automatic execution stays disabled, with no production trigger. One approved low-risk tenant can be used for a monitored canary only after the release and operator authorization gates.

Next: trusted incident ingestion from provider/worker registries, durable delayed scheduler, adapter-level fencing and tenant validation, dual-window SLO alerts, manual reconciliation UI, fault injection, and rollback/failure drills.
