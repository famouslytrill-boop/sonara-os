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

**Pure deterministic jitter:** `window_ms = min(cap_delay_ms, base_delay_ms * 2^(completed_attempts - 1))`; a SHA-256-derived fraction of an opaque `runId`, `stepId` and completed-attempt number determines a stable delay between 1 ms and the window. The delay is reproducible for a given input; it is not a random security token. The default base delay is 1 second and cap 30 seconds. The final timestamp must not exceed the explicit end-to-end deadline.

**Rate-limit behavior:** A `rate_limited` failure requires a previously validated positive provider `providerRetryAfterMs` interval. SONARA never proposes a retry earlier than that interval. If it exceeds the configured delay cap, the recommendation is to stop instead of violating the provider's backoff instruction. Upstream code must parse provider headers safely, cap untrusted input and respect platform/global token buckets.

**Cancellation:** `cancellationRequested: true` refuses *new retries*; this is not cancellation of an already in-flight request, nor a durable cancellation transition. Those are separate worker responsibilities.

**Execution contract:** Persist the scheduled retry transactionally with a database uniqueness constraint for `(tenant, run, step, next_attempt)`, original event versions and lease ownership. Re-check authorization, cancellation, provider state and idempotency at claim time; a precomputed recommendation alone cannot be an execution permit.

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
