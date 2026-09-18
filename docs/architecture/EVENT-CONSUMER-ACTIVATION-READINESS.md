# Durable Event Consumer Activation Readiness

Status: **source implementation under review; production consumer remains disabled**

This gate exists between the durable outbox foundation and the first live event
consumer. A green deployment of the tables and RPCs is not permission to start a
worker. Activation requires proof that the worker can fail, retry, recover, and
remain tenant-scoped without turning one transient failure into a duplicate
customer side effect.

## Activation boundary

The runtime switch is:

`SONARA_EVENT_CONSUMER_ENABLED=false`

The default is off. Enabling it without
`SONARA_EVENT_CONSUMER_CANARY_ORG_ID` set to an explicit organization UUID is
rejected.

The repository contains **no scheduled consumer workflow**. The only production
execution path added by this phase is the manual
`Event Consumer Activation Readiness` workflow in `production_canary` mode.
That path processes only synthetic events written for that exact canary run and
only inside the configured canary organization.

## What the worker proves

### Idempotent claim and settlement

`lib/sonara-event-consumer.cjs` gives every invocation a unique claim-owner
token. The same token must settle the row. If an old invocation wakes up after a
lease was reclaimed, its settlement no longer matches `claimed_by` and is
refused.

Handlers receive the producer's `idempotencyKey`. Any future handler that
performs an external side effect must use that key at the side-effect boundary.
The outbox provides at-least-once delivery; it cannot manufacture exactly-once
behavior in a third-party system that ignores idempotency.

### Concurrency safety

Migration
`20260917200000_event_consumer_activation_readiness.sql` adds
`claim_sonara_event_outbox_filtered`.

The function:

- requires one organization id;
- requires explicit kind and producer allowlists;
- claims with `FOR UPDATE SKIP LOCKED`;
- reclaims a claim only after a five-minute lease has expired;
- remains executable only by `service_role`.

A worker handler is bounded to 30 seconds by default, leaving a large safety
margin under the five-minute database lease.

### Retry and backoff

Transient failures are rescheduled with deterministic exponential backoff:

- attempt 1: 5 seconds;
- attempt 2: 10 seconds;
- attempt 3: 20 seconds;
- attempt 4: 40 seconds;
- bounded at 5 minutes.

The delivery policy remains five attempts. A retryable failure on attempt five
is dead-lettered. A permanent handler refusal can be dead-lettered immediately.

### Dead-letter behavior

A dead-letter settlement changes the durable row state and appends the normal
delivery-attempt evidence. Error **codes** may be stored; raw exception messages,
tokens, request bodies, prompts, and provider responses are not copied into the
worker telemetry.

### Observability and SLO-ready metrics

Every attempted delivery emits a structured `event.consumer` record through
the existing structured-log boundary. The record carries:

- tenant scope;
- event kind;
- correlation id;
- delivery outcome;
- attempt count;
- queue age;
- handler duration;
- retry backoff when applicable.

The general consumer SLO definition in source is:

- delivery ratio >= 99%;
- dead-letter ratio <= 1%;
- p95 handler duration <= 10 seconds.

Those are operational objectives, not proof that the product is ready to scale.
The first activation gate is deliberately stricter.

## One-tenant synthetic canary

The manual production canary writes **20 synthetic events** into one explicitly
configured organization. Each run uses a unique producer name, so it cannot pick
up an earlier run or a customer-originated event.

Four worker lanes claim those 20 events concurrently. The canary passes only
when all of these hold:

- at least 20 measured samples;
- 100% delivered;
- 0 retries;
- 0 dead letters;
- p95 handler duration <= 5 seconds.

A disabled flag, missing tenant id, empty queue, retry, dead letter, settlement
failure, or insufficient sample count is not a green canary.

## Engineering sequence

1. Open the readiness PR.
2. Require the normal repository CI matrix plus the offline
   `Event Consumer Activation Readiness` job to be green.
3. Run the controlled production deployment so the additive filtered-claim
   migration is applied and verified.
4. Re-run production connectivity and exact-commit proof.
5. Set the production environment variable
   `SONARA_EVENT_CONSUMER_CANARY_ORG_ID` to the chosen canary organization.
6. Set `SONARA_EVENT_CONSUMER_ENABLED=true` **only for the controlled canary
   exercise** and manually dispatch `production_canary`.
7. Require the 20-sample activation gate to pass.
8. Turn the flag back off after the canary until a real consumer handler has its
   own idempotency proof and owner-approved activation plan.
9. Only then add or enable the first real production consumer. Do not add a
   schedule before that decision.

## Current non-goals

This phase does not add a broker, a fleet-wide scheduler, multi-consumer fanout,
or an automatic customer-facing side effect. It does not claim exactly-once
delivery. It does not enable the durable event consumer in production.

The purpose of this phase is narrower: make activation measurable and reversible
before activation is allowed.
