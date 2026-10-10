# Integration Readiness Worker — 9 October 2026

**Status:** source implementation and controlled-canary architecture. Not production-enabled, not scheduled, and not evidence that any external provider account is connected.

## Problem closed by this slice

SONARA already had:

- a global `integration_providers` catalog;
- tenant-visible `integration_jobs`;
- business-scoped `business_integration_connections`;
- durable server-only `platform_jobs` with idempotent enqueue and atomic `FOR UPDATE SKIP LOCKED` claim.

But `integration_jobs` had no consumer. The generic create route therefore correctly used `manual_required`; a queued status would have claimed automation that did not exist.

This slice adds **one** runnable integration job type:

`provider_readiness_probe`

Its only purpose is to read SONARA's own provider and connection-state records and produce a redacted readiness receipt. It does not contact the external provider and cannot publish, send, bill, refresh credentials, mutate an external account, or grant a connection.

## Read-only live schema reconciliation

A read-only inspection of the connected Supabase project on 9 October 2026 found:

- PostgreSQL 17;
- `integration_jobs`, `integration_providers`, `business_integration_connections`, and `platform_jobs` present with RLS enabled;
- 0 current `integration_jobs` rows;
- 36 provider-catalog rows;
- 0 current `business_integration_connections` rows;
- the older `organization_integrations` table is not present;
- all 36 live `provider_key` values satisfy the bounded lowercase identifier grammar used by this implementation.

No SQL, provider credential, production row, or environment setting was changed by that inspection.

## Architecture

### Customer-visible request and receipt

`integration_jobs` remains the customer-visible record. A readiness request contains:

- authenticated organization;
- selected provider key;
- `job_type = provider_readiness_probe`;
- status;
- bounded output receipt or safe error code.

Arbitrary jobs submitted to the older generic `/api/integrations/jobs` route remain `manual_required`. This canary does not widen their authority.

### Durable execution transport

`platform_jobs` remains the server-only execution queue. The new worker repository reuses the existing database functions:

- `enqueue_platform_job` for idempotent enqueue;
- `claim_platform_job` for atomic `FOR UPDATE SKIP LOCKED` claim.

The application adds the missing lifecycle around those functions:

- stale `processing` lease recovery;
- tenant-keyed job types;
- worker-id fencing on settlement;
- exponential retry scheduling;
- final-attempt dead-letter;
- claimed/recovered/succeeded/retry/dead-letter event receipts.

No new database migration is required for this slice.

### Tenant selection before payload parsing

`platform_jobs` does not have an `organization_id` column. To keep a one-tenant canary from even claiming another organization's job, the durable job type is scoped before claim:

`integration.provider_readiness_probe:<organization UUID>`

The canary worker calls `claim_platform_job` for that exact job type. The organization id inside the job payload is checked again after claim.

### Connection aggregation

`business_integration_connections` is business-scoped, so an organization may have multiple rows for one provider. The readiness result aggregates all matching rows without selecting business ids, credential references, settings, tokens, or secrets.

The receipt contains only:

- provider key/status/declared connection mode;
- number of matching business connection rows;
- aggregate connection state;
- most recent safe `last_checked_at`;
- readiness classification;
- receipt timestamp.

If any matching business connection is `connected`, account-level readiness reports that at least one connection is connected. Otherwise error/setup/disabled/not-connected states remain visible.

## Activation controls

The worker is disabled unless both are configured:

`SONARA_INTEGRATION_READINESS_WORKER_ENABLED=true`

and

`SONARA_INTEGRATION_READINESS_CANARY_ORG_ID=<exact organization UUID>`

The web page and worker enforce the same organization. `SONARA_INTEGRATION_READINESS_MAX_JOBS` is bounded to 1–20.

`/account/integrations` shows provider and connection status to signed-in customers. The **Check readiness** form is rendered only for the explicitly enabled canary organization.

`POST /api/integrations/readiness-probes` is:

- customer-authenticated;
- rate-limited by IP and signed-in subject;
- canary-organization checked;
- idempotent for the form's request UUID;
- read-only with respect to external providers.

## Worker entry point

`scripts/run-integration-readiness-worker.mjs` processes a bounded number of jobs.

`.github/workflows/integration-readiness-worker.yml` is `workflow_dispatch` only, uses the protected `production` environment, and requires an explicit boolean confirmation. It has no push, pull-request, cron, or schedule trigger.

The workflow does not make an external provider request. It reads/writes only SONARA database records needed for the queue lifecycle and readiness receipt.

## Failure behavior

- Durable enqueue unavailable → visible job becomes `manual_required`, not falsely queued.
- Temporary SONARA database read failure → visible job returns to `queued`, platform job becomes `retryable`, bounded exponential backoff applies.
- Exhausted attempts → both records become terminal failure; the platform job is dead-lettered.
- Worker crash → stale lease is recovered. If attempts remain, it becomes retryable; if the final attempt was already consumed, it is dead-lettered.
- Stale worker after recovery → settlement matches `id + job_type + status=processing + locked_by`; no matching row means `claim_lost`.
- Cross-tenant durable row → not selected because the queue job type is organization-scoped before claim.

## Research basis

PostgreSQL documents `SKIP LOCKED` as unsuitable for general querying but useful to avoid lock contention with multiple consumers of a queue-like table:

- https://www.postgresql.org/docs/current/sql-select.html

Supabase's queue guidance uses durable Postgres-backed queues and a visibility window so workers can recover messages after failed processing:

- https://supabase.com/docs/guides/queues
- https://supabase.com/docs/guides/database/extensions/pgmq

SONARA does not adopt a second queue system here. Those references validate the queue semantics; the implementation reuses the existing `platform_jobs` contract.

## Claim boundary

This work establishes a **read-only internal readiness worker canary**. It does not establish:

- OAuth authorization;
- token refresh;
- provider API execution;
- webhook processing;
- bidirectional sync;
- provider-side mutation;
- production connector coverage;
- customer adoption;
- external-provider uptime;
- automatic scheduling.

Each provider action must get its own authority, credential, scope, idempotency, retry, reconciliation, revocation, and canary evidence before becoming runnable.
