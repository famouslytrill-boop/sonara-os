# SONARA One — bounded self-healing supervisor

**Review date:** 2026-10-08  
**Scope:** SONARA Industries, Business Builder, Creator Studio, Growth Studio.  
**Status:** Branch implementation only. Policy engine, offline diagnostics, tests and executor interface are implemented; **no live production repair is enabled**. Durable ledger, approved adapters, online scheduler, synthetic canary and production activation remain separate gated deliverables.

## Deployed vs. implemented

- Implemented: lib/sonara-self-healing-supervisor.cjs — typed fault classification, fail-closed authority, 120-second evidence freshness, retry ceiling, stable jitter, operation deadline, worker lease fencing evidence, cooldown identity, recovery verification and SLO/latency statistics.
- Implemented: scripts/diagnose-runtime-evidence.mjs — read-only diagnosis of SONARA's own structured HTTP logs; aggregate 5xx availability, p50/p95/p99, evidence completeness and error-budget burn. No external network calls and no raw secrets/tenant IDs in reports.
- Implemented: tests/sonara-self-healing-supervisor.test.js — deterministic behavior and adversarial policy tests; included in default Mocha glob.
- Not implemented by this branch: live monitoring integration; PostgreSQL claims/RLS migration; production action adapters; OpenFeature production flag; paging/incident UI; automatic merge, code rewrite, schema change, secrets rotation or autonomous monetary action.

## Exact recoverability matrix

| Incident signal | Mandatory independent evidence | Permitted action | Escalation condition |
|---|---|---|---|
| provider.timeout, provider.rate_limited | Organization scope, server-verified authorization and idempotency, stable operation ID, deadline and attempt | retry_idempotent | Sensitive domain, attempt cap, deadline failure |
| worker.lease_expired | Stable operation ID, proven idempotency, expired lease, fencing version | requeue_expired_lease | Lease active, token missing, stale evidence |
| provider.optional_unavailable | Optional dependency proven and authorized non-sensitive scope | open_optional_circuit | Auth/payment/essential provider |
| queue.optional_overload | Optional lane flag and measured depth at/above positive limit | pause_optional_lane | Essential lane or insufficient evidence |
| source/schema/security/payment/authority/unknown | Evidence collection only | None | Explicit human-reviewed operation |

Allowed actions are only named playbook interfaces, not generic shell commands. A model or public request **must not** set authorizedScope, verifiedIdempotency, sensitive, or optionalDependency directly. The trusted authorization and workload registries must derive these facts server-side. Every action adapter must independently recheck current tenant identity, state and fencing at execution time.

## How to run the new diagnostics locally

Use only logs SONARA is authorized to inspect:

    pnpm test
    node scripts/diagnose-runtime-evidence.mjs --input /path/to/sonara-structured-events.jsonl

The CLI outputs an aggregate machine-readable JSON report. It returns a nonzero status for malformed/truncated evidence; fewer than 30 good requests returns insufficient_evidence. An HTTP 4xx may be an expected authorization refusal, so the request availability measurement uses HTTP 5xx. Other customer journeys require separate SLIs.

### Reliability formulas

- Availability = 1 - failed_5xx_requests / total_requests
- Error-budget burn = observed_failure_rate / (1 - SLO_target)
- Nearest-rank p95 = sorted_latencies[ceil(0.95 × N) - 1]
- Bounded delay = max(stable_jitter(min(30s, 1s × 2^attempt)), Retry-After)
- Retry eligibility = fresh_evidence AND scoped_authority AND idempotent AND attempts < 3 AND remaining_deadline > delay + 1s
- Promotion decision = exact_SHA_tested AND RLS_verified AND rollback_proven AND sufficient_sample_size AND SLO_within_budget

The equations describe policy and measurement, not proof that the production platform already meets its SLO.

## Infrastructure blueprint: rollout in reviewable stages

1. **Observe:** reuse existing SONARA structured logs, OpenTelemetry and HTTP monitoring. Split liveness (process), readiness (dependencies), capability health and end-to-end customer transaction SLIs. An optional provider outage must never trigger a restart cascade.
2. **Diagnose:** normalize trusted HTTP, queue, lease and provider signals into typed incidents with event time, resource identity, authenticated organization and provenance. Exclude model-generated diagnoses from authorization evidence.
3. **Plan:** call planRemediation. Classify unknown and sensitive faults as escalation, not as new autonomous capabilities.
4. **Claim:** build a PostgreSQL repair-claim ledger using atomic conditional resource-key claims, cooldown expiry, incident fingerprint, tenant scope, audit lifecycle and failure evidence. Enforce RLS and server-only access. Do not create a new migration until replay and rollback have been reviewed.
5. **Execute:** from a dedicated authenticated worker, read a server-side OpenFeature flag with false default, per-tenant ceilings and an operator kill switch. Call executeRemediation with a durable claim interface, durable pre/post-action audit, vetted action-specific adapter and independent scope-aware health verifier. No production route should call this directly.
6. **Recover:** verify fresh post-repair health, keep a record of action, checked condition, verification status and resource. Escalate unknown or ambiguous side effects; never blindly rerun them.
7. **Prove:** enforce exact-head CI, tests for two-tenant isolation and negative authorization, worker crash/replay, duplicate events, rate-limit storms, clock skew, stale evidence, disabled flags, and rollback rehearsals. Only after complete evidence consider a single-tenant canary.

The durable ledger's resource key must cover tenant + action + stable resource identity; it cannot deduplicate by incident UUID alone. Fencing must be checked atomically by the worker handler. A visibility timeout prevents immediate double pickup but does not remove the need for application-level idempotency.

## Open-source tool selection

**Already present in SONARA package.json:** OpenTelemetry SDK/exporters, OpenFeature server SDK, Mocha, Playwright. Prefer extending these before adding dependencies.

**Good candidates if capacity measurements justify them:**
- Supabase Queues/pgmq for durable jobs, visibility windows and archival under controlled server access.
- OpenTelemetry Collector, Prometheus, Alertmanager and Grafana for correlated metrics and SLO alerting.
- k6 for thresholds and fault/load tests.
- Temporal or DBOS if existing Postgres outbox/workers cannot meet long-running workflow recovery requirements.
- Kubernetes liveness/readiness/restart orchestration only if there is an actual Kubernetes deployment. SONARA's Vercel deployment does not gain Kubernetes semantics simply by adding YAML.

A new open-source service requires confirmed license, total cost of ownership, tenancy boundaries, restore drills and approved dependency changes; this implementation introduces no new dependencies.

## Acceptance and test criteria

| Fault-injection | Expected result |
|---|---|
| Same resource reported under two incident IDs | Single durable claim inside cooldown; no duplicate effect |
| Stale, future-dated or malformed evidence | Escalated without adapter invocation |
| Missing tenant, access or idempotency proof | Escalated without adapter invocation |
| Retry-After exceeds budget or deadline | No retry |
| Concurrent lease reclaim | Conditional fence blocks losing worker |
| Failed pre-action audit | No action |
| Verification fails after action | Escalation and persisted evidence, not blind replay |
| Failed monitoring collector | Business request unaffected; automation fails closed |
| Unknown error, schema/auth/payment fault | Human review only |
| Sparse traffic, one 5xx | Insufficient evidence, do not auto-roll back |
| Full test/migration release gates red | No merging, migration or production promotion |

Measure mean/median detect latency, p95 diagnosis latency, recovery success, false-repair rate, p95/p99 service latency, SLO error budget, escalation rate, duplicate side effects (zero tolerance), evidence freshness and tenant isolation. Do not claim production-level self-healing until those are measured on a controlled canary.

## Primary technical sources

- Kubernetes probe semantics: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/
- Google SRE alerting on SLOs: https://sre.google/workbook/alerting-on-slos/
- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/concepts/semantic-conventions/
- Supabase Queues: https://supabase.com/docs/guides/queues
- OpenFeature server SDK: https://openfeature.dev/docs/reference/sdks/server/javascript/
- Temporal durable retries: https://github.com/temporalio/documentation/blob/main/docs/encyclopedia/retry-policies.mdx
