# Deterministic Sequencing and Trace Replay Contract

Status: planning-only implementation on a draft branch, **not activated in production**.
Product scope: SONARA One, Business Builder, Creator Studio and Growth Studio.
Baseline: main at `9d141e68d1ec14c037f92d1eebb3c2718d583c0a`.

## Problem and boundaries

SONARA has event durability, observability, formulas, bounded loops, and product-specific workflows. Those facilities must not be misrepresented as a single end-to-end transactional scheduler. This addition provides a small deterministic **decision layer** inside the existing `lib/sonara-september19-pattern-convergence.cjs` module.

It does not execute a step, call providers, persist events, grant access, authorize payment, confirm webhook settlement, publish content, or perform autonomous remediation. `eligible` means only *dependency eligible*, not authorized to execute. Approval, tenant identity, actor scopes, idempotent state mutations, receipts and deployed telemetry stay with the canonical production workflow.

## Inputs and algorithms

`planWorkflowSequence(steps)` takes objects with:

- `id`: lowercase ASCII identifier (1-64 characters, beginning with a letter);
- `dependsOn`: zero or more prerequisite step IDs;
- `estimatedMs`: optional nonnegative integer estimate (maximum seven days per step);
- `maxAttempts`: optional integer retry ceiling between 1 and 20 (default 1).

The planner validates IDs, duplicates, unknown dependencies, self-dependencies and cycles. It uses staged topological ordering with a stable lexical tie-break, then dynamic programming over the DAG to compute an **estimated critical path**. Independent nodes may be eligible in the same stage; the planner does **not** claim actual concurrency or scheduling guarantees.

```text
earliest_finish(v) = estimated_ms(v) + max(earliest_finish(u) for u in dependencies(v))
critical_path_duration = max(earliest_finish(v) for all v)
```

Bounds: 1–128 steps; at most 32 direct dependencies per step, 1,024 edges overall. Every graph is checked for cycles and valid prerequisites. Bounds also cap CPU and memory spent interpreting untrusted proposed workflows.

`replayWorkflowTrace(plan, events)` deterministically reconstructs step states from ordered records `{eventId, stepId, action, attempt}` where action is one of `started`, `succeeded` or `failed`.

- Starts require all dependencies to have succeeded and an available attempt.
- Success/failure require a matching in-flight start and attempt.
- Repeated identical `eventId` records within a replay are deduplicated; conflicting reuse is rejected.
- The result reports state by step, dependency-eligible steps, exhausted attempts, unique accepted events and duplicate events.
- Trace replay is bounded to 4,096 supplied events.
- Input ordering is authoritative for this *in-memory* replay; a production event store must guarantee a stable per-run ordering and enforce tenant scope, append-only writes and durable deduplication separately.

## Usage example (read-only)

```js
const { planWorkflowSequence, replayWorkflowTrace } =
  require("./lib/sonara-september19-pattern-convergence.cjs");

const plan = planWorkflowSequence([
  { id: "ingest", estimatedMs: 2000 },
  { id: "review", dependsOn: ["ingest"], maxAttempts: 2 },
  { id: "publish", dependsOn: ["review"] }
]);

const snapshot = replayWorkflowTrace(plan, [
  { eventId: "evt-1", stepId: "ingest", action: "started", attempt: 1 },
  { eventId: "evt-2", stepId: "ingest", action: "succeeded", attempt: 1 }
]);
// snapshot.eligible includes review, but no publication authority is granted.
```

## Bounded retry decision (pass 2)

`evaluateWorkflowRetry(input)` is a pure, read-only decision function. It replays the supplied graph and event history before considering a new attempt. It **does not enqueue, sleep, call a provider, grant permission, verify a token, or commit an idempotency key**.

Required caller-provided inputs include: `plan`, `events`, `stepId`, opaque `runId`, `startedAtMs`, `nowMs`, positive `maxElapsedMs`, `failureKind`, and explicit safety assertions `authorizationConfirmed`, `effectReplaySafe`, and `budgetApproved`. An upstream component must independently prove those assertions for the current actor, tenant, operation and attempt; never expose them as customer-controlled request flags.

The function stops for any non-failed step, exhausted attempt budget, requested cancellation, expired time budget, permanent/unknown failure, missing authorization, uncertain idempotency or missing resource budget. An allowed retry receives `nextAttempt`, `remainingAttempts`, `delayMs`, `notBeforeMs` and `deadlineMs`.

**Pure deterministic jitter:** The exponential window reuses SONARA's existing `retryDelayMs` backend primitive rather than duplicating its calculation. `window_ms = min(cap_delay_ms, base_delay_ms * 2^(completed_attempts - 1))`; a SHA-256-derived fraction of an opaque `runId`, `stepId` and completed-attempt number determines a stable delay between 1 ms and the window. The delay is reproducible for a given input; it is not a random security token. The default base delay is 1 second and cap 30 seconds. The final timestamp must not exceed the explicit end-to-end deadline.

**Rate-limit behavior:** A `rate_limited` failure requires a previously validated positive provider `providerRetryAfterMs` interval. SONARA never proposes a retry earlier than that interval. If it exceeds the configured delay cap, the recommendation is to stop instead of violating the provider's backoff instruction. Upstream code must parse provider headers safely, cap untrusted input and respect platform/global token buckets.

**Cancellation:** `cancellationRequested: true` refuses *new retries*; this is not cancellation of an already in-flight request, nor a durable cancellation transition. Those are separate worker responsibilities.

**Execution contract:** Persist the scheduled retry transactionally with a database uniqueness constraint for `(tenant, run, step, next_attempt)`, original event versions and lease ownership. Re-check authorization, cancellation, provider state and idempotency at claim time; a precomputed recommendation alone cannot be an execution permit.

## Scoped event replay decision (pass 3)

`replayScopedWorkflowTrace({ plan, organizationId, runId, events })` enforces the *shape and replay consistency* of a complete proposed event stream before passing its canonical events to the existing deterministic state machine. It is still advisory and performs no I/O.

- `organizationId` is a canonical lowercase UUID; `runId` is an opaque, syntax-constrained identifier. Neither is a proof of identity or authorization. The trusted database/provider must establish their ownership.
- Every event carries **both** organization and run IDs. A cross-organization or cross-run event is refused rather than silently filtered.
- A non-duplicate event has a contiguous, 1-based integer `sequence` within its run. Reordering or missing sequence numbers is rejected rather than producing a silently incomplete replay.
- Repeated deliveries of the same `eventId` and `sequence` must have identical replay-relevant fields, including optional `traceId`; otherwise the replay is refused. Genuine repeat deliveries are deduplicated.
- Optional trace IDs must be nonzero, lowercase, 32-character hex strings. The trace ID is **correlation metadata, never an authorization credential**. W3C Trace Context explicitly calls out privacy and adversarial input concerns.
- Total presented delivery records and sequences are limited to 4,096. Real production histories longer than this require a *separately proven* snapshot/checkpoint system; this prototype rejects them.
- Output includes `organizationId`, `runId`, `lastSequence`, `acceptedEvents` and `replayedEvents`, alongside the underlying workflow state.

**Database reconciliation blocker (observed from repository migrations):**

The existing `public.platform_jobs` table in `007_platform_infrastructure_ops.sql` is a general operational job table without a declared organization ID. The `20260926025411_durable_worker_contract.sql` migration adds a globally unique `idempotency_key`, an atomic `claim_platform_job` using `FOR UPDATE SKIP LOCKED`, and `platform_job_events` containing job ID, attempt, event type, optional trace ID and creation timestamp. Neither table currently declares an enforceable per-run sequence or organization-scoped workflow event uniqueness. Therefore do **not** attach tenant-owned business automations directly to the shared global queue or claim that the scoped replay validator is already backed by these records.

**Separate future migration proposal (not included or applied here):**

1. Decide whether to extend the existing general operational queue or create a dedicated tenant workflow run/event family. Prefer the latter if legacy system jobs intentionally remain unscoped.
2. Store tenant ID, run ID, immutable event ID, consecutive `bigint` sequence, step ID, action and attempt with unique constraints for `(organization_id, run_id, sequence)` and `(organization_id, run_id, event_id)`. Enforce validated foreign keys, minimal grants and hostile-tenant RLS tests.
3. Serialize new event assignment by locking the **run row in one transaction** and allocating its next sequence. Do not compute the next sequence via an unsafe read-then-insert pattern.
4. Claim with row locking and `SKIP LOCKED` only as queue coordination, not as isolation proof. Introduce bounded lease expiry and a **monotonic fencing epoch**, and accept completion only when expected tenant, run, worker and epoch still match.
5. Persist retry suggestions with transactional uniqueness on tenant, run, step and next attempt. Recheck cancellation, rights, provider scopes, credits and idempotency at execution claim time.
6. Verify duplicate webhooks, two-worker races, stale-worker completion after lease recovery, missing sequence, rejected cross-tenant writes, crash/replay, expired retries and rollback. Prove provider-side reconciliation separately before activation.

Official references: [PostgreSQL locking and SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html), [W3C Trace Context security](https://www.w3.org/TR/trace-context/#security-considerations), [Temporal workflow deterministic constraints](https://docs.temporal.io/workflow-definition).

## Immutable definition fingerprint and replay pinning (pass 4)

SONARA's DAG planner now computes `definitionHash` for its **normalized** workflow definition. This is SHA-256 of the domain-separated prefix `sonara.workflow.definition.v1:` concatenated with JSON of the canonical steps (sorted by ID, with dependency IDs sorted and default estimates/attempt budgets explicitly normalized).

- Reordering input steps or dependency declaration order does **not** change the hash.
- Changing a dependency, estimate, step, or attempt budget changes the hash.
- Every scoped replay now requires an explicit `input.definitionHash` and the *same* `definitionHash` on each event. It rejects mismatches against the freshly calculated canonical plan before state reconstruction.
- The scoped result includes the validated definition hash, enabling tracing from an immutable run definition to its event history.
- The legacy unscoped `replayWorkflowTrace` and `evaluateWorkflowRetry` APIs remain **advisory only** and do not enforce definition pinning. Callers requiring a durable execution guarantee must use the scoped validator and later a single atomic database transition, not two separate untrusted client-side checks.
- A bare hash is **not a signature or identity proof**. A malicious caller could change both the definition and hash. The run definition must be stored server-side behind trusted authorization, the run row must be immutable/versioned, and every event writer must be authorized.

**Storage contract to implement only in a separately approved migration:** persist `definition_hash` (lowercase 64-hex), `definition_version`, `organization_id`, `run_id` on the immutable run record. In the same transaction that allocates each event sequence, derive its definition hash from the locked parent run row rather than trusting a request field. Reject appends for historical runs if the active definition differs; continue replaying them using their original definition snapshot. A code deployment changing DAG shape must either retain an old worker definition or deliberately migrate/restart runs under a new version with explicit review. See [Temporal workflow versioning](https://docs.temporal.io/workflow-definition) and [replay testing guidance](https://docs.temporal.io/develop/safe-deployments).

## Proof requirements before connecting to live jobs

1. Independently validate run identity, organization/workspace authorization and owner approvals before each production side effect.
2. Adopt immutable, tenant-scoped event IDs, ordered per-run sequence numbers and provider receipt IDs for durable replay; never rely on this in-memory deduplication as the transactional barrier.
3. Link span/trace IDs to durable events through existing observability and redaction, without embedding user identifiers in span names or high-cardinality metric attributes.
4. Preserve at-least-once delivery with database-enforced idempotency on financial, publishing, media and inventory effects.
5. Define timeout, cancellation, backoff/jitter, dead-letter and replay-after-deploy policies separately from this ordering primitive.
6. Run adversarial tenant-isolation, fault-injection and provider reconciliation tests before any runtime integration.
7. Keep main merge, database migrations and production deployment gated on passing exact-head CI.

## Verification

New cases extend the pre-existing `tests/september19-pattern-convergence.test.js` rather than adding a new Mocha file (which would require regenerated file-count inventories). Cases cover order determinism, stages, critical path, cycles, unknown IDs, duplicate IDs, invalid budgets, dependency gates, duplicate replay events, conflicting events, failed-attempt exhaustion and no out-of-order transitions.

Focused local algorithm checks passed before commit. **Repository-wide pnpm checks, GitHub Actions exact-head checks and production proofs remain pending.**

## Design references

- PostgreSQL recursive-query cycle detection: https://www.postgresql.org/docs/current/queries-with.html
- OpenTelemetry tracing API and span links: https://opentelemetry.io/docs/specs/otel/trace/api/
- Temporal workflow determinism and replay contract: https://docs.temporal.io/workflow-execution
- GitHub release-gate and protected deployment guidance: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments
