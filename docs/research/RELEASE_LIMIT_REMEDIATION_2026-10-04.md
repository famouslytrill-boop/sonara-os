# Release limit remediation — 4 October 2026

## Verified change

This increment builds on third-pass commit `9d1def4`. The native replay harness now resolves one numeric Unix owner and uses it both for temporary cluster directories and SQL statement files. This closes the remaining `nobody:nobody` assumption on hosts where the primary group has a different name. Invalid or root identities are rejected. Ownership failures exit nonzero with an explicit statement that PostgreSQL has not started and no migration SQL ran. CI still requires native replay; no skip or security gate was weakened.

Required replay was attempted with PostgreSQL 16 present. The environment rejected ownership changes to `65534:65534` with `Invalid argument`. The database never started. This increment changes no migration SQL and applies no production migration.

Reference: PostgreSQL requires initdb and its server to run as a non-root user: https://www.postgresql.org/docs/16/app-initdb.html . Binary presence alone does not prove a runnable cluster.

## Remaining release requirements

| Area | Current evidence | Completion evidence required |
| --- | --- | --- |
| Native migration replay | Blocked before database startup | Required replay on a supported non-root host/CI runner, all migration files applied, schema and behavior probes passed for the candidate commit |
| Production migration | Not executed in this increment | Exact-head release checks, migration history/schema comparison, backup and rollback evidence, controlled migration and live verification |
| Marketplace checkout and private delivery | Existing marketplace explicitly states these are unavailable | Tenant-scoped immutable price/version/license snapshot, merchant account mapping, idempotent checkout, verified paid webhook, durable unique purchase grant, private expiring delivery; duplicate/unpaid/cross-tenant/refund/dispute tests |
| Provider reconciliation | Existing connected payments and invoice settlement do not establish complete reconciliation | Account/currency/amount matching, unique provider-event mapping, out-of-order and duplicate recovery, partial payments, fees, refunds/disputes and operator exception review against actual provider receipts |
| Physical devices | No physical-device test performed here | Android and Apple device records with OS/browser versions, capture/export, denial/revocation, background interruption, memory limits, keyboard/accessibility and recoverable failure results |
| Customer retention | No customer cohort evidence collected here | Consented production activation and repeat-value events, explicit cohort denominator/window, paid renewal/cancellation results and support cost; observed results separated from forecasts |
| Optional model runtime | No new runtime activated | Exact pinned source/weight licenses and hashes, representative quality and resource-budget tests, consent/deletion/tenant isolation, bounded worker, rollback and deployment evidence |

Do not promote researched candidates, mocked provider tests, browser automation or formula forecasts to live deployment, physical-device qualification or proven retention. No live payment, campaign, model activation or production database operation was performed here.

## Validation

The full server suite completed with six pending checks and one failure: its generated handoff still reported the old test-file count after this increment added a test file. The handoff was regenerated and the affected handoff tests rerun with the replay tests. Focused replay tests passed; changed JavaScript passed ESLint and syntax checking. The ownership restriction remains a release blocker, not a migration success.
