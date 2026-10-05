# Managed PostgreSQL upgrade readiness

Checked: 2026-10-05 UTC.
Review by: 2026-10-12
Evidence expires before an upgrade begins: repeat the
read-only checks, confirm the current main SHA and review the provider's offered
target and warnings. PostgreSQL 18 replay is compatibility evidence only; it
does not establish that this managed project offers PostgreSQL 18.

## Observed production baseline

| Measurement | Read-only observation |
| --- | --- |
| PostgreSQL | 17.6 |
| Applied migrations | 152 |
| Public tables | 409 |
| Public tables with RLS disabled | 0 |
| Invalid or unready indexes | 0 |
| Database size | 38 MB |
| Logical replication slots | 0 |
| Public columns using reg* types | 0 |
| Database collation version mismatch | 0 |
| Named collation version mismatches | 0 |
| Custom operator estimators flagged for restore review | 0 |
| Cron execution history size | 16 kB |
| ltree or floating-point GiST indexes flagged by current upgrade notes | 0 |

Installed extension versions were recorded: pg_cron 1.6.4, pg_net 0.20.4,
pg_stat_statements 1.11, pgcrypto 1.3, pgmq 1.5.1, plpgsql 1.0,
supabase_vault 0.3.1, uuid-ossp 1.1 and vector 0.8.2. The provider must confirm
their support on the exact offered target. These measurements do not prove
row-level tenant authorization, backup restorability or provider eligibility.

## Before the provider operation

1. Record the exact offered PostgreSQL and service versions, provider eligibility
   warnings and estimated downtime from the project's upgrade screen. Check for
   read replicas separately; a primary database query cannot establish their absence.
2. Confirm a fresh restorable database backup, its timestamp and restore procedure.
   The release workflow's schema-only rollback dump is not a customer-data backup.
   Keep full backups private; do not commit customer records or credentials.
3. Verify extension compatibility, logical replication slots, reg* columns,
   custom roles and release-note-specific index/restore caveats. Do not drop
   extensions, slots, replicas or records automatically to pass a check.
4. Run the exact candidate's CI, native replay, tenant-isolation tests and linked
   migration dry run. Nine replay lanes cover Node 22/24/26 with PostgreSQL
   16/17/18; every lane must execute the entire migration history. Empty-database
   replay does not validate a physical pg_upgrade of existing customer data.
5. Agree on the maintenance window and record the owner go/no-go decision after
   the offered target, backup proof and downtime estimate are concrete. The
   provider upgrade takes the project offline. Do not pause/restore the project
   as an upgrade shortcut or change production credentials.

## After the provider operation

Record the actual server and extension versions, migration list and the exact
released application SHA. Run `pnpm run verify:production-supabase` with the
existing protected server-side environment, then the production catalog and
live connectivity checks from the controlled workflow. The deep verifier now
probes every active table with `limit=0` and at most four concurrent requests;
it does not download customer rows. Its summary records table assertions,
transport attempts and successfully recovered requests. Permanent authorization
failures still fail immediately; transient retries remain bounded.

Compare pre/post schema, policies, grants, constraints and indexes. Validate
critical record counts or checksums in a private, consistent snapshot with
writes quiesced; ordinary live counts can change while customers are writing.
Run tenant-scoped record creation/update/read assertions in the approved canary
workspace, never by fabricating production customer records. Recheck cron,
queues, record-change logging, integration checkpoints and webhook reconciliation.
If validation fails, use the recorded provider restore procedure and application
rollback runbook. Never downgrade a database in place as a guessed recovery.

## Bounded adaptation and record keeping

Recovery counters are evidence of successful retries, not authority to alter
schemas or permissions. Reconciliation must retain tenant scope, idempotency,
provenance and delivery receipts. Repeated permanent failures require review.
The learning/memory control plane now rejects unknown sensitivity labels,
including misspellings, even if approval is supplied. Credentials remain blocked;
preferences, patterns and sensitive memory retain their existing approval rules.
This increment does not enable a new persistent customer learning runtime.

## Primary guidance

- [Supabase managed upgrade procedure and caveats](https://supabase.com/docs/guides/platform/upgrading)
- [PostgreSQL 18 compatibility changes](https://www.postgresql.org/docs/18/release-18.html)
- [Production rollback runbook](PRODUCTION_ROLLBACK_RUNBOOK.md)

The connected Supabase tools expose no managed-version upgrade operation.
Backup proof, the project's offered target, replica eligibility and the downtime
decision remain provider-side prerequisites, not facts inferred from green CI.
