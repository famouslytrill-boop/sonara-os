# SONARA Autonomic Recovery — Phase 4: PostgreSQL Due Claims

**Date:** 2026-10-08. **Review-only:** draft PR #510. No production migration, scheduler, polling loop, external adapter, or traffic is activated.

## Research conclusions and chosen architecture

- The current recovery plan computes bounded jitter and provider Retry-After delays, but a process-local timer cannot survive a crash or prove due-time admission across replicas.
- PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` is intended for queue-like consumers under contention. The row transition must **commit before** any provider side effect, because a DB transaction must not remain open while awaiting a provider.
- The Supabase PGMQ extension supports delayed visibility and visibility leases, but a visible-again message is not proof an outside payment/provider action did not occur. A private table with no automatic lease recycling is deliberately simpler and safer for SONARA's small, optional provider recovery lane. Supabase Queues can later carry *wake-up hints*, not authoritative permission to retry.
- A retry is not authorized by the queue row alone. The worker must revalidate tenant, provider idempotency, operation state and fence immediately before calling a provider.
- A started job is **never** automatically returned to the queue. A provider may have accepted the request immediately before the worker died. Another attempt requires operator reconciliation and provider-level idempotency evidence.
- If an incident is economically or legally material (payments, refunds, publication, privileged identity, secrets, migrations, deployment) no autonomous adapter may be registered.

## Implemented code (not deployed)

| Artifact | Purpose |
| --- | --- |
| `supabase/migrations/20261008160000_autonomic_delayed_retry_due_claims.sql` | Private durable scheduling table, append-only transition log, strict service-role-only enqueue/due/terminal RPCs |
| `lib/sonara-recovery-scheduling.cjs` | Adds the deterministic attempt number to the persistence envelope |
| `lib/sonara-postgres-delayed-retry.cjs` | Validates the exact tenant/resource, due time, deadline, attempt/dedupe, fenced due claim and terminal RPC response |
| `lib/sonara-due-recovery-worker.cjs` | Disabled by default; processes at most one DB-claimed job with authority, idempotency, fence and independent recovery checks |
| `tests/sonara-delayed-retry-worker.test.js` | Synthetic refusal and success paths, missing adapters, failed audit, forged scope, ambiguous provider result |
| `tests/sql/autonomic-delayed-retry-role-matrix.sql` | Disposable PostgreSQL due-time/role/tenant/dedupe/fencing/transition proof, rolled back |
| `scripts/verify-migration-replay.mjs` | Runs SQL behavior fixture in native replay |
| `supabase/applied-migration-checksums.json` | Pins SHA-256 for unshipped migration, without editing previous migrations |

## State machine

`queued` (not_before, deadline, tenant, operation, dedupe) → `started` (DB due claim + token + audit) → `verified | unverified | failed`.

Never automatically transition `started` back to `queued`. Never overwrite a terminal event. Multiple workers cannot claim a row already started, and a per-tenant/operation unique constraint prevents changing attempt numbers to race the same external operation. Reject dates too far in the past or future; do not schedule expired or sensitive work. Successful retries must be **independently verified**, not inferred from a provider HTTP 2xx.

## Math and operational thresholds

- Retry backoff = `max(Retry-After, min(30 s, 1 s × 2^attempt) × stable jitter)`, with a cap of 3 eligibility attempts at the planning boundary. Database admission uses a maximum ~31-second horizon.
- Exclude any retry whose due time plus one-second safety margin reaches its deadline.
- SLO burn = observed 5xx rate ÷ (1 − success SLO). Dual 5m/1h and 30m/6h rule outputs are **alert candidates**, not rollback or repair permission.
- Recovery control KPIs: mean time to detect (MTTD), p95 time-to-admit due work, 99th-percentile backlog age, duplicate suppression ratio, incidents escalated because of invalid authority, ambiguous provider outcomes, audit completeness, false-positive SLO paging and cost per verified recovery.
- Run synthetic single and competing-tenant retries, clock-skew and deadline injection, process death before/after provider acceptance, duplicate sensor records, DB outage and PostgreSQL crash/restore drills.

## Live activation prohibitions

There is **no** connected cron, worker scheduler, event consumer, provider handler, signed sensor ingest or external approval UI in this change. Merely importing modules does nothing. Never turn this on until: exact-commit GitHub CI is green, native PostgreSQL replay passes, live target schema is reconciled, service-role grants audited, fault-injection proof passes, operator deploy control is enforced, and one explicitly approved low-risk tenant is selected for a monitored canary.

**Known limitation:** even this durable queue does not guarantee external exactly-once side effects. Any provider handler must use a genuine provider idempotency token plus an authoritative operation fence. A false-negative verification remains ambiguous and is escalated.

## Sources

- PostgreSQL locking: https://www.postgresql.org/docs/current/sql-select.html
- Supabase Queues and PGMQ visibility: https://supabase.com/docs/guides/queues/pgmq
- SRE multiwindow burn-rate alerts: https://sre.google/workbook/alerting-on-slos/
- OpenTelemetry observability: https://opentelemetry.io/docs/
