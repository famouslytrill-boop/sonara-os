# SONARA Reliability Engineering Phase 8 — Safe Route Metrics and Background Diagnostics

Date: 2026-10-08. Review-only draft PR #510. No production deployment, worker activation, migration or provider call.

## Research and correctness
OpenTelemetry describes cardinality overflow as a measurement-dimension loss risk. SONARA's Express middleware previously concatenated req.baseUrl with a declared route, but Express baseUrl may contain RESOLVED mounted-router parameters. This risks emitting tenant/customer identifiers or unbounded metric combinations. The new helper only allows static known mount roots; anything else becomes "unmatched". Existing server-declared route templates remain identifiable.

## Implementation
- lib/sonara-safe-route-template.cjs rejects unsafe or unbounded req.baseUrl before deriving http.route.
- lib/sonara-observability.cjs now uses the bounded helper without changing metric names or allowing repair.
- lib/sonara-workflow-diagnostics.cjs defines PII-free background workflow observations and failure/p95 summaries for SONARA One, Business Builder, Creator Studio and Growth Studio.
- tests/sonara-workflow-diagnostics.test.js covers route privacy, forged observations, scarce traffic and deterministic aggregation.

The background workflow contract is PURE and presently not attached to all workers. It provides a safe integration interface for future approved event-consumer/field-sync/media/campaign observers; it is not a claim that these lanes now emit live telemetry or autonomously recover.

## Gates
Local isolated Node 22 checks pass 7/7. Exact-commit full repository CI, native PostgreSQL replay, tenant isolation, signed sensor and authoritative provider-fencing tests remain mandatory. Do not deploy before release controls are enforced.

Reference: https://opentelemetry.io/blog/2026/cardinality-limits-in-opentelemetry/
