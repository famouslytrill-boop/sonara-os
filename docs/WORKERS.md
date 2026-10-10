# Workers

SONARA One keeps the web application as the request/runtime surface. Workers are optional server-only or CI-operated systems for durable jobs that should not block a customer request.

## Current worker surfaces

- `platform_jobs` — durable service-role-only job queue
- `platform_job_events` — enqueue/claim/retry/dead-letter/recovery evidence
- `claim_platform_job` — atomic `FOR UPDATE SKIP LOCKED` claim
- `enqueue_platform_job` — idempotent enqueue
- `lib/sonara-event-consumer.cjs` — governed event-outbox consumer
- `scripts/run-event-consumer-canary.mjs` — synthetic one-tenant event canary
- `lib/sonara-platform-job-worker.cjs` — fenced settlement and stale-lease recovery over `platform_jobs`
- `scripts/run-integration-readiness-worker.mjs` — bounded read-only integration readiness canary
- `python/sonara_ops/main.py` — optional operations tooling

## Implemented queue controls

The durable `platform_jobs` contract already provides:

- idempotency keys;
- bounded attempts;
- priority and next-attempt scheduling;
- atomic claims with row locks and `SKIP LOCKED`;
- worker lock identity;
- retryable and terminal states;
- dead-letter timestamps;
- job-event evidence.

The application-side worker adapter additionally:

- recovers expired `processing` leases;
- fences settlement on the current `locked_by` worker;
- refuses stale-worker settlement as `claim_lost`;
- applies bounded exponential retry delay;
- dead-letters an expired lease when its final allowed attempt was already consumed.

These controls are source architecture. They are not proof that a production worker host is continuously running.

## Integration readiness canary

The first integration job with a runnable worker is `provider_readiness_probe`.

It reads SONARA's own provider catalog and tenant connection-state rows and writes a bounded readiness receipt. It does **not** call an external provider, refresh OAuth credentials, publish, send, bill, or mutate a provider account.

Activation is default-off and requires:

- `SONARA_INTEGRATION_READINESS_WORKER_ENABLED=true`;
- an exact `SONARA_INTEGRATION_READINESS_CANARY_ORG_ID`;
- the manual `Integration Readiness Worker Canary` workflow or another separately reviewed worker host.

The durable queue job type includes the canary organization UUID before claim, and the payload organization is checked again after claim.

## Rules

- Jobs must be idempotent.
- Jobs must log bounded status without secrets.
- Queue scope is not customer authorization; handlers must re-check tenant and action authority.
- High-risk, financial, destructive, publishing, security, legal, or bulk-customer actions require their own reviewed authority path.
- Provider credentials remain server-only and are never queue payloads or customer-visible receipts.
- Connectors use official provider APIs/protocols after explicit provider-specific implementation and review.
- A research catalog entry or provider metadata row is not an executable connector.
- No worker may silently widen from a read-only canary into provider mutation.

## Verification

Targeted source tests:

```bash
pnpm exec mocha --config .mocharc.targeted.json \
  tests/platform-job-worker.test.js \
  tests/integration-readiness-worker.test.js \
  tests/integration-readiness-route-contract.test.js \
  --reporter dot
```

Existing media smoke:

```bash
pnpm run workers:smoke
```

The integration readiness canary is manual:

```bash
pnpm run integration-readiness:run-once
```

Do not run it until the explicit one-organization canary environment is configured and approved.

## Production work still open

- Choose and operate a durable worker host or separately approved scheduler for supported job classes.
- Add monitoring/alerts for dead letters, stale leases, repeated retries, queue age, and worker health.
- Run the one-tenant read-only readiness canary and retain exact-SHA evidence.
- Implement provider-specific OAuth/credential custody before any external provider API execution.
- Add provider-specific reconciliation, revocation, rate-limit, timeout, webhook and mutation evidence one connector at a time.
- Prove worker logs/metrics, restore/recovery behavior, and incident runbooks in the deployed environment.

Do not describe the presence of queue code as an active production worker network.
