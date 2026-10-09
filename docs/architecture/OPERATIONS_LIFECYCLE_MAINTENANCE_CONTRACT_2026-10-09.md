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

## Revision-bound operational receipts (pass 6)

The pure **reviewOperationalTransitionLedger** function validates an ordered stream of *proposed* lifecycle receipts against the existing lifecycle state machine. It has NO database adapter, signed-approval verification, or runtime execution authority.

**Input contract:** scope (platform/tenant), canonical organization ID where tenant-scoped, known initial mode and nonnegative integer revision, plus at most 512 event deliveries. Events contain a safe event ID, canonical actor UUID, exact scope, from/to modes, exact next revision, a timestamp, evidence flags and a structured approval.

**Approval binding:** Each approval identifies its approver, scope/tenant, exact from/to transition, expected prior revision and issued/expiry timestamps, with a validity interval capped at 15 minutes. The receipt must still be valid at transition time. One approval ID cannot be reused across distinct transitions. Duplicate event IDs are accepted only if their replay-relevant fields match exactly. The function rejects cross-tenant scope, changed approval data, event revision gaps, timestamp reversal and forbidden mode transitions. The existing lockdown and resume gates are re-evaluated for every unique event.

**Output:** current reconstructed mode and revision, unique/duplicate event counts, and explicit false values for transitionExecuted, authorizationVerified and durableConsistencyProven. The result describes proposed history consistency, **not** the current database or production state. Unsigned caller-provided flags or receipt objects are not trustworthy evidence of authentication or owner consent.

### Database consistency contract (planned, not applied)

Before creating tables, inspect the existing SONARA control-plane checks, tenant audit events, incident records and RLS policy inventory. A single canonical control state row must be associated with its exact environment, tenant scope, immutable incident/owner-approved action and revision.

The trusted transaction must validate the actual actor and tenant permission, independently fetch/verify the approval and release evidence, check the incident/recovery state, and then conditionally update the state only if mode and revision still match the observed values. Insert a unique immutable audit receipt inside that same transaction. If the conditional update matches zero rows, rollback and reread: **never reuse the stale approval to blindly retry**.

Illustrative SQL pattern (not runnable until canonical schema/role review):

~~~sql
UPDATE authorized_control_state
SET mode = :next_mode, revision = revision + 1
WHERE scope_key = :scope_key
  AND mode = :expected_mode
  AND revision = :expected_revision
RETURNING revision;
-- Require exactly one row and append the audit receipt
-- in this transaction; otherwise rollback.
~~~

PostgreSQL conditional UPDATE/RETURNING is a suitable atomic compare-and-swap foundation (https://www.postgresql.org/docs/current/sql-update.html). NIST SP 800-61 Revision 3 (https://csrc.nist.gov/pubs/sp/800/61/r3/final) informs incident containment and verified recovery. Neither reference establishes that SONARA has deployed this storage contract.

### Adversarial proof requirements

- Verify scope and actor from the *server session*, not JSON booleans.
- Verify authenticated owner approval, approved action, revision binding, source and expiry using durable signed or authorization-controlled records.
- Test two conflicting operators, duplicate delivery, reused approval, cross-tenant writes, stale incident clearance, altered audit evidence, long-duration maintenance, missed audit insert and transaction rollback.
- Reject any direct path from lockdown/offline to active. Keep intentional offline deployment and customer data untouched until owner-approved exact-head release proof and one reversible canary pass.

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

## Read-only Supabase schema reconciliation — 2026-10-09

The connected Supabase project is an **active preview-channel database**, not independently established as SONARA's canonical production database. I inspected table metadata, migration history and security advisors **read-only**. Do not equate a connected/healthy preview project with a production authorization.

The preview schema listed 418 `public` tables and 163 applied migrations, through `20261008100000` at the inspection. Existing relevant tables are:
- `public.sonara_control_plane_checks`: check definitions/status metadata (`check_key`, `check_type`, `target_key`, `expected_result`, `status`) but **no scoped mode revision or append-only authorized transition history**. This table is a registry; it must not be repurposed as an operational state lock.
- `public.platform_jobs` and `public.platform_job_events`: general-purpose worker records and events; their inspected columns do not expose a tenant-scoped workflow-run version, immutable operation revision or fencing epoch. Their current global idempotency key is insufficient for tenant-specific lifecycle authorization.
- `public.system_audit_events`: audit records with `actor_id` and flexible metadata, but not a canonical `(environment, scope, tenant, revision)` uniqueness/transaction contract.
- `public.entity_incidents`: incident records tied to an entity and status, not necessarily the authorized platform shutdown/restore state.

The security advisor reported informational findings for 66 RLS-enabled tables without policies (which may be intentionally private/deny-all), warnings involving eight callable security-definer functions, one public extension location and leaked-password protection. These are **review candidates**, not proof of exploitable access. Follow the advisor remediation guides, least-privilege grant review and adversarial tests before changing access policies.

**Migration decision:** no live DDL was applied; no SQL migration was committed in this pass because the repository-local Supabase CLI and an approved isolated replay database were not available to run `supabase migration new`, security advisers, and `supabase test db` in the prescribed order. This prevents inventing a migration filename, diverging preview/production history or silently mutating an unapproved project.

**Next verified database deliverable:** an additive, migration-replay-tested tenant/platform state record and immutable transition receipts, with RLS enabled, explicit grants revoked for `anon`/`authenticated`, trusted server-derived scope, atomic CAS state+audit writes, one-use approval identity, tenant isolation and historical recovery tests. Keep the connection's production target unconfirmed until an operator independently reconciles Vercel/Supabase environment identity and backup recovery.

Relevant guidance: https://supabase.com/docs/guides/database/postgres/row-level-security and https://www.postgresql.org/docs/current/sql-update.html .

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
