# SONARA Operational Lifecycle, Alerting and Maintenance Contract

Status: **read-only engineering policy in a draft pull request**. This file does not authorize starting, stopping, pausing, resuming, deleting, scanning, restoring, restarting, or altering any live service.

Parent: SONARA Industries. Applies conceptually to SONARA One, Business Builder, Creator Studio and Growth Studio. Implementation extends the existing backend operations policy rather than establishing a second worker system.

## Prime directives

1. **Protect tenant/customer data, identity and legal holds first.** Missing or self-asserted authorization is not trustworthy evidence.
2. **Never bypass exact-head CI, human approvals, provider verification or tenant isolation.** A security scanner blocks/alerts; it cannot grant permission.
3. **Contain, then recover deliberately.** Pause new work before drain; reconcile and verify before resuming. Never restart healthy containers because an optional provider or readiness dependency is degraded.
4. **Changes must be observable, bounded, reversible where possible and auditable.** Repeat operations cannot duplicate business effects.
5. **No automatic customer deletion or destructive database compaction.** A cleanup recommendation is not a deletion permit. Backups must be restorable and separately protect Storage objects.
6. **Respect intentional offline state.** No state planner, cron, diagnostic or alert may reactivate a site without owner approval and release proof.

## What is implemented

New pure functions in `lib/sonara-backend-operations-intelligence-2026.cjs`:

- `operationalTransitionDecision`: reviews a transition between `active`, `paused`, `maintenance`, `lockdown` and `offline`. It requires operator scope and authorization, owner approval, matching expected/current revision and target-specific evidence. It never changes runtime state.
- `maintenanceActionDecision`: classifies only allowlisted, bounded diagnostic, scan, backup, restore-drill, cache review, retention, PostgreSQL maintenance and restart-request categories. Arbitrary commands, paths, force flags, unidentified scopes and over-budget requests are refused. No task is actually run.
- `operationalAlertDecision`: creates an advisory alert candidate from one of seven recognized security, storage, backup, CI, provider or worker-health signals. Signal severity is fixed by the catalog rather than lowered by callers. Trusted scope/evidence, a failure threshold, a cooldown and bounded counters are required. It emits no notification and does not lock down anything.

These functions **consume caller-provided booleans and revision values as hypotheses only**. A future trusted control-plane handler must establish them from server-side session identity, canonical tenant membership, authorization policy, signed approval receipts, durable revision history and actual provider/database responses. Never pass customer-controlled JSON directly as proof.

## Lifecycle state map

```text
active ----> paused ----> maintenance
   |            |              |
   +----------> lockdown <-----+
   |            ^              |
   +----------> offline <------+

lockdown -> paused only (incident clearance + verified recovery)
offline  -> paused only (incident clearance + verified recovery)
paused or maintenance -> active only (fresh health and exact-head release gates)
```

- Every eligible transition returns `requiresDurableCompareAndSwap: true` and `requiresAuditReceipt: true`, but no database CAS is implemented.
- The expected revision must exactly match the observed revision. Invalid or overflowing revisions are rejected. This is a *proposal-level* stale-state check, not an atomic transaction.
- Maintenance entry requires drained in-flight jobs; normal offline/shutdown also requires a reviewed shutdown plan and drained jobs. Emergency incident containment is represented as a **lockdown candidate**, not an unreviewed force-termination command.
- A security incident must be independently confirmed before a lockdown candidate. Leaving lockdown/offline is a two-step process: reviewed recovery to paused, then health/CI-gated activation.
- Restart or startup of the website is not granted by a health check or an alert. Kubernetes distinguishes startup, readiness and liveness probes; a readiness failure is not itself proof that restarting will help.

## Detection, scanning, alerts and bypass resistance

Keep existing SONARA security pipeline: code scanning and dependency/secret checks, tenant adversarial tests, CI release evidence and owner review. New `security_scan` and `debug_diagnostics` are **bounded classification labels**, not subprocess commands.

Alert inputs include `scopeVerified`, `evidenceVerified`, integer `consecutiveFailures`, threshold, explicit clock and last-alert timestamp, and a 1-second–24-hour cooldown. Identical repeated signals inside cooldown yield `alert_cooldown_active`. The decision is not a durable deduplication store and is not a promise of email, SMS or push delivery. A separate trusted alert adapter and durable per-tenant signal key are required.

Suggested future evidence schema (proposal only): incident UUID, tenant scope, immutable actor identity, signal class, provider/run correlation ID, event time and sequence, observed state revision, intended/actual transition, independent approval receipt, alert-deduplication key, delivery receipt and reconciliation status. Never include raw secrets or customer content in alert titles or metric labels.

## Storage/library safety and cleanup

Reuse existing `lib/sonara-file-storage-policy.cjs`, especially `storagePreflight`, `retentionDecision`, `signedAccessPlan`, `localCachePlan` and `restoreIntegrityCheck`. Those already separate server-verified metadata from untrusted declarations, quarantine pending malware scans, guard tenant-private downloads, preserve legal holds and require byte/hash evidence for restores.

- `retention_purge_review` is **never** an executable candidate: it requires the specific reviewed retention rule, legal/incident hold evaluation, data classification, canonical file ownership, customer rights and a separate approval/execution contract.
- `cache_cleanup_review` can become a bounded *review candidate* only in maintenance mode with confirmed drained jobs, verified backups, owner review, cache-only targets and explicit exclusion of retention-protected files. It still deletes nothing.
- Storage lifecycle rules should distinguish temporary generated cache from purchased/licensed creative assets, invoices, backups, legal exhibits, media masters and customer exports. Never bulk-delete by filename, bucket-wide age, folder substring or user-supplied path.
- Object storage does not expose a generic block-level disk defragmentation operation. `disk_defragmentation` is refused.
- Routine PostgreSQL `VACUUM` and `ANALYZE` support MVCC and planner health; `VACUUM FULL` rewrites tables and requires an exclusive table lock. `REINDEX` must account for index lock impact and write stalls. The policy produces a review recommendation only and contains **no SQL runner**.
- Backups and Storage objects have different restoration paths. A recorded migration timestamp is not a recoverable backup by itself. A restore drill must be performed in a verified isolated environment with independently validated data integrity.

## Sequencing, worker pooling and trace mapping

Reuse the existing queue-capacity scenario model (`lib/sonara-deterministic-capacity-planner.cjs`), the workflow DAG/trace primitives under review in PR #560 and the existing outbox/durable-worker contract. Do not introduce a redundant concurrent scheduler.

For a work rate `lambda` jobs/hour, mean service time `t` milliseconds, `c` jobs per worker and target utilization `u`, a **planning** lower bound is `ceil(lambda * t / (3,600,000 * c * u))`. This is not an SLA or measured load result. Admission control must also respect tenant quotas, idempotency, lease fencing, provider limits and queue backpressure.

Trace the sequence: monitor -> incident evidence -> proposed lifecycle state -> human review -> compare-and-swap transition -> durable audit receipt -> bounded scan/repair -> verification -> restoration evidence -> resume. Preserve `trace_id`, a non-PII correlation ID and per-run event sequence. One missed step blocks the next.

## Production readiness and release order

1. **P0:** Resolve existing GitHub runner congestion and obtain all exact-head CI checks on the changed commit, without weakening gates.
2. **P0:** Reconcile intended production environment and offline/online state; do not unpause or restart a site automatically.
3. **P1:** Implement a separate authenticated server-side control plane and durable revisioned operation record; independently prove identity, scope, approval and release evidence.
4. **P1:** Require a compare-and-swap state transition and immutable audit log, adversarial role/tenant tests, race tests and restart/lockdown bypass tests.
5. **P1:** Wire a supported alert delivery provider with opt-in preferences, severity routing, cooldown persistence, recovery notifications and no false delivered claims.
6. **P1:** Exercise one reversible canary: pause -> drain -> diagnostics -> isolated restore verification -> reviewed resume. Do not begin with destructive purge, payments, or deployment.
7. **P2:** Add measured storage reclamation, pool-size/load testing and reviewed long-term retention reporting after backup/recovery proof exists.

## Official research references

- PostgreSQL routine maintenance: https://www.postgresql.org/docs/current/maintenance.html
- PostgreSQL VACUUM and VACUUM FULL: https://www.postgresql.org/docs/current/sql-vacuum.html
- PostgreSQL REINDEX concurrency: https://www.postgresql.org/docs/current/sql-reindex.html
- Kubernetes startup/readiness/liveness probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- GitHub workflow concurrency semantics: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

## Verification boundary

Focused tests live in the existing `tests/september19-pattern-convergence.test.js` file. No test-file inventory changes. Targeted isolated V8 checks do not establish an exact-head passing pnpm, Node 24 compatibility, full Mocha, security audit, migration replay, production probe or real alert receipt. No live file deletion, backup, database compaction, service restart, shutdown, site restoration or release performed by this pass.
