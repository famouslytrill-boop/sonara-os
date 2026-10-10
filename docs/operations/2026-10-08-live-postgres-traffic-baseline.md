# SONARA Industries — Read-only traffic and PostgreSQL capacity baseline
**Captured 2026-10-08 | Primary target: Supabase project yqncsonkxgwhcxedgevk, PostgreSQL 17.6 | No SQL DDL/DML executed**

## Why this inspection was necessary
The database has been tuned by adviser-warning elimination in previous changes. This is not proof of bottleneck removal. SONARA production is owner-directed OFFLINE; absent normal customer traffic, a point-in-time snapshot cannot produce peak RPS, p95 or p99 latency or quantify autoscaling headroom. This baseline describes the *measured database at inspection*, not real service capacity.

## Snapshot, observed read-only
| Observation | Value | Interpretation |
|---|---:|---|
| Configured PostgreSQL max_connections | 60 | DB server setting; not a safe or guaranteed web worker-pool size |
| pg_stat_activity rows / active / lock-waiting | 18 / 1 / 0 | A single low-activity moment; zero waits now does not exclude contention at load |
| pg_stat_database numbackends | 12 | Scope differs from pg_stat_activity all databases/background; do not falsely reconcile |
| pg_stat_statements present | Yes, in extensions schema | Supports query-cost inspection |
| pg_stat_statements tracked calls / distinct records | 56,587 / 4,862 | Cumulative across tracked sample window, **not RPS** |
| pg_stat_statements_info deallocations | 21 since 2026-10-05 05:58:24 UTC | Some query entries were evicted; statistics are incomplete historical coverage |
| pg_stat_database transactions committed / rolled back | 246,970 / 40 | Cumulative counters, not success rate for customer workflows |
| pg_stat_database blocks read / hit | 7,378 / 26,916,720 | Accumulated cache counters. High cache hit does not prove low latency |
| pg_stat_database temporary files / bytes | 6,651 / 18,127,702,078 | Cumulative temp usage since unspecified stats reset; not current disk consumption or growth rate |
| pg_stat_database deadlocks | 0 | Cumulative since reset; not proof no deadlocks in production history |
| Top retained statement by total execution | 4 calls, 50,726.54 ms cumulative, 12,681.63 ms mean, 16,865.57 ms max | Expensive *normalized statement*, not identified route or end-user page |
| Other tracked high-cost statements | 18 calls / 18,986.43 ms; 36 calls / 17,829.63 ms | Workload classification needed; do not invent slow customer APIs |
| Most temporary-block-writing tracked statement | 18 calls; 3,146 blocks written, 3,134 read | Examine in staging after classifying source; avoid blindly increasing work_mem |
| Largest listed public table | service_catalog_items: 200 kB | Very small current dataset; index/adviser counts are not scale evidence |
| Public tables with RLS | 418 of 418 | RLS switch is enabled; **policy correctness and grants still require adversarial proof** |

The difference between cumulative pg_stat_database temp bytes and retained pg_stat_statements totals is **not** proof of missing or corrupt data: their sampling windows, query retention, and accounting coverage differ. Do not subtract these counters or present either as a sustained rate.

## Engineering interpretation and next tests
1. **P0, release:** main is unprotected according to GitHub GET branch response; protect branch/ruleset and production environment. Current baseline full CI is NOT green (513-versus-516 test inventory and P1 SQL fixture drift). Select one of PRs #508/#519/#526 after tests. Owner wants site OFFLINE. Do not change production DDL to silence tests.
2. **P1, query mapping:** match the slow normalized statement(s) to the exact repository query families without printing raw query texts in public reports. Check whether they are CLI/adviser/schema inspection rather than customer routes. Capture original IDs and restricted SQL only in authorized security workspace. Use EXPLAIN (no ANALYZE of mutating statements) in staging; optimize only after validating the real query plan and logical correctness.
3. **P1, measurement:** collect two or more read-only sampled counters with timestamps under *representative approved load* and derive per-second deltas. If counters decrease or pg_stat_statements has reset, classify the interval invalid. Use p50/p95/p99 request and DB spans by low-cardinality registered route, tenant-safe counts (never include tenant IDs in high-cardinality attributes), connection-pool waits, queue age/depth, retries, cache effectiveness, CPU/memory and managed compute cost.
4. **P1, traffic controls:** build admission and load-shedding based on measured service capacity, per-industry fair budgets, bounded fanout, idempotency, provider deadlines, circuit breakers, JIT cancellation and max queue residency. Distinguish retries after genuinely failed operations from **unknown outcomes**; never double-charge, send duplicate emails or repeat published writes.
5. **P2, schema:** 379 unindexed FK INFO and 581 unused-index INFO are screening lists, not auto-apply directives. Any index add/drop must have query selectivity, pg_stat_user_indexes and storage/write-cost evidence, tenant-RLS behavior, migration/rollback and staging replay. 468 overlap-policy WARNs require semantics classification before rewrite.
6. **P2, cost:** after load testing, feed measured **aggregated** suite+industry demand to plan-industry-portfolio.mjs and simulate-industry-capacity.mjs. Do not pass individual account names, IDs or secrets. Planner cost units are user-provided scenarios; no quote or payment ledger truth.

## Safe read-only SQL for repeat checks
Only within authorized Supabase project and without exposing raw SQL text or tenant records.

```sql
select current_setting('server_version') as version,
       current_setting('max_connections')::integer as configured_max_connections,
       count(*) as all_sessions,
       count(*) filter (where state = 'active') as active_sessions,
       count(*) filter (where wait_event_type = 'Lock') as lock_waits
from pg_stat_activity;

select numbackends, xact_commit, xact_rollback, blks_hit, blks_read,
       temp_files, temp_bytes, deadlocks, stats_reset
from pg_stat_database where datname = current_database();

select dealloc, stats_reset from extensions.pg_stat_statements_info;
select calls, round(total_exec_time::numeric, 2) as total_ms,
       round(mean_exec_time::numeric, 2) as mean_ms,
       round(max_exec_time::numeric, 2) as max_ms,
       temp_blks_written, shared_blks_read
from extensions.pg_stat_statements
where dbid = (select oid from pg_database where datname = current_database())
order by total_exec_time desc limit 10;
```

## Required engineering acceptance
- A representative k6/Playwright browser/DB run yields measured RPS, p95/p99, error rates, queue age and pool waits with no private identifiers in telemetry.
- Approved query-plan improvement proves lower cost/time without cross-tenant regression and with staging rollback.
- Full exact-head Node24/26 matrix plus native PG16/17/18 replay; no skipped mandatory checks or stale artifact counts.
- Controlled release only with branch protection, environment reviews and separately granted owner go-live authorization. OFFLINE until then.

## References
- PostgreSQL 17 pg_stat_statements: https://www.postgresql.org/docs/17/pgstatstatements.html
- PostgreSQL cumulative counters: https://www.postgresql.org/docs/18/monitoring-stats.html
- Supabase inspection: https://supabase.com/docs/guides/observability/inspect
- Supabase query-performance diagnostics: https://supabase.com/docs/guides/database/extensions/pg_stat_statements
- OpenTelemetry low-cardinality semantic conventions: https://opentelemetry.io/docs/specs/semconv/general/metrics/
- AWS load shedding: https://builder.aws.com/content/3Eun1EEyX6p2e3VYNyRLSJzLuMV/using-load-shedding-to-avoid-overload
