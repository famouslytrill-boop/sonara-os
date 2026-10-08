# SONARA — Autonomic Recovery Engineering Pass 3 (2026-10-08)

**Authority:** Engineering proposal only; draft PR #510. Not merged, activated, deployed or wired to production resources.

## Research conclusions

- Google SRE recommends paired short and long windows when measuring SLO error-budget burn. Low-traffic applications should avoid trusting one failure as an actionable high-severity outage. https://sre.google/workbook/alerting-on-slos/
- Supabase Queues (pgmq) supports visibility timeouts and delaying message delivery, but a consumer can see a message again once the visibility window expires. Exactly-once external business effects still require application-level idempotency. https://supabase.com/docs/guides/queues/pgmq
- PostgreSQL's guarded atomic claim and explicit fencing are needed when multiple workers compete. The existing Pass 2 ledger retains failed/ambiguous actions instead of automatically reclaiming them. https://www.postgresql.org/docs/current/transaction-iso.html
- Authenticated monitor provenance must be established *before* authorization. An event body cannot tell SONARA that it came from a trusted tenant or has owner consent. Production integrations should verify signed webhooks or an authenticated internal collector before using the new admission interface.

## Code implemented and unit-tested

1. `lib/sonara-self-healing-supervisor.cjs`: **fail-closed fix** — direct `retry_idempotent` execution now refuses with `durable_due_claim_required`. Existing zero-delay, lower-risk actions remain behind the durable claim, audit, fenced handler, verification and disabled-by-default policy.
2. `lib/sonara-recovery-scheduling.cjs`: computes a deterministic `notBeforeMs` that respects per-operation Retry-After, backoff, deadline and attempt cap; passes a minimal, deduplicable scheduling envelope to an injected persistence interface. It never calls a provider. Missing/unverified scheduling fails closed.
3. `lib/sonara-slo-burn-control.cjs`: read-only 5-minute/1-hour and 30-minute/6-hour burn-rate evaluations with 14.4x/6x thresholds and default minimum 30 short-window / 100 long-window request samples. Returns an **alert candidate**, not rollback authority. Windows require valid timestamps and typed outcomes.
4. `lib/sonara-trusted-incident-admission.cjs`: requires the caller-supplied registry to cryptographically/transport authenticate the **entire** observation via `verifyObservation`, bind sensor and resource identity, resolve the server-owned resource registry and verify tenant scope. Client- or model-supplied claims of idempotency/authority/sensitivity are ignored.
5. Three corresponding test files cover no-immediate-retry, Retry-After preservation, unavailable scheduler, missing signatures, cross-tenant mismatch, sparse SLO traffic, stale and future-dated timestamps and healthy traffic.

## Critical remaining implementation boundaries

This pass **does not implement** a real durable scheduler, queue consumer, cryptographic signature verification, provider adapter, public incident-ingress route, or live alarm/paging integration. `scheduler.schedule`, `registry.lookup` and `registry.verifyObservation` are server-side interfaces, **not** functional production adapters. Their trusted implementations must be accepted and exercised independently before any activation. In particular, no retry handler is allowed to run before a database-verified not-before timestamp and winning due claim exist.

The Pass 2 PostgreSQL ledger and SQL replay probe still require native PostgreSQL CI on the PR's **exact final commit**. Do not merge, apply database migrations, run a production repair, modify security settings, or interpret skipped/queued CI as green.

## Next engineering sequence

1. Implement a **server-only** scheduled retry message store using approved pgmq/durable queue APIs and a transactional dedupe ledger. Enforce not-before, expiry, lease fencing and deadlines inside the database, not just JavaScript.
2. Implement a purpose-specific worker that consumes only *due*, authenticated, idempotent work, rechecks tenant ownership, and records before/after evidence. Ambiguous provider outcomes go to human reconciliation.
3. Bind trusted observation provenance to real OpenTelemetry/monitor ingress; do not accept web or agent strings directly.
4. Add synthetic customer-journey probes, service- and tenant-level error budgets, p95/p99 latency and alert suppression. Measure detection time, false positive rate, MTTR, queue age and duplicate effects.
5. Run controlled fault injection, native PostgreSQL replay across approved versions, multi-replica race and crash tests; then request a one-tenant canary under an explicit kill switch and approved rollout.

## Acceptance criteria

- Full exact-SHA CI green: typecheck, lint, tests, coverage, build, native migration replay, RLS/service-role matrix, release controls and security scans.
- No automatic action from unsigned telemetry, stale evidence, wrong tenant, unknown signal, sensitive domain, unproven idempotency, missing durable scheduler or failed audit.
- Stable dedupe identity across monitor replicas; no duplicate external effects.
- No claim of production self-healing or SLA until verified live probes and documented recovery exercises exist.
