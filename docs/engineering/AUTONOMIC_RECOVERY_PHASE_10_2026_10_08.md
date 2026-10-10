# SONARA Recovery Engineering — Phase 10: Offline Per-Suite SLO Evidence

**Date:** 2026-10-08 · **Scope:** draft PR #510 · **Activation:** none.

## Completed engineering process

SONARA now has a deliberately read-only entry point connecting its EXISTING
`http.request` structured server-log contract to the Phase 9 per-suite SLO
window evaluator. No new process runs on deploy, no provider calls occur,
and this does not change the HTTP middleware, database, routes, entitlements,
customer access or production environment.

Artifacts:
- `lib/sonara-offline-slo-evidence.cjs`: bounded, PII-free accumulator using
  the existing trusted *format* for server HTTP events. Input files remain
  UNVERIFIED and must not be treated as authenticated monitoring.
- `scripts/diagnose-suite-slo-evidence.mjs`: offline JSONL diagnostic CLI
  with optional fixed clock for reproducible reports.
- `tests/sonara-offline-slo-evidence.test.js`: eight bounded evidence
  cases exercising long-window coverage, product integrity, duplicate
  capture, invalid time, historical records, unclassified routes, PII
  exclusion and overflow handling.
- `tests/sonara-suite-slo-cli.test.js`: subprocess integration contracts
  for the actual CLI and real accumulator, including 0/1/2 exit codes.

## Usage

```bash
node scripts/diagnose-suite-slo-evidence.mjs --input ./structured-http.jsonl
node scripts/diagnose-suite-slo-evidence.mjs --input ./structured-http.jsonl --as-of 2026-10-08T20:00:00.000Z
```

- Exit 0: JSONL was parsed without detected corruption/duplicates/overflow
  or unmatched routes; it does NOT prove a complete or authentic traffic stream.
- Exit 1: incomplete evidence; malformed lines, contradictory product
  labels, duplicate correlations, unknown routes or >50,000 retained samples.
- Exit 2: arguments, file type/size, file-read or clock failure.

The analyzer caps input at 64 MiB, 100,000 lines, 65,536 characters per line
and 50,000 matching recent HTTP observations. Anything beyond these limits
invalidates the result instead of silently sampling a biased fraction.
Unrelated structured events are ignored; historical traffic older than six
hours is excluded. No raw routes, organization IDs, tokens, request bodies,
queries or correlation IDs are returned.

## Integrity and mathematical contract

The source HTTP log has an ISO UTC timestamp, unique request UUID, declared
route template, server product/journey labels, HTTP status and duration.
The analyzer checks that route classification agrees with the recorded product
and journey. It also checks 5xx vs. HTTP outcome and status class, detects
duplicate request UUIDs, and rejects invalid/future timestamps.

The per-product summaries apply the dual-window 5m/1h at 14.4× and 30m/6h
at 6× burn rates with sample minimums and conservative long-window
traffic-coverage requirements. Requests returning 4xx are not counted as
HTTP 5xx availability errors; that does not imply every 4xx is harmless in a
customer-journey SLI.

**Critical limitation:** An offline JSONL file can omit requests, be modified,
come from only one replica, or lack collector data. Its continuity and
provenance are NOT verified. `operationalAlert` is always false,
`authoritativeCollectorContinuity` is always false, and the report is
`diagnostics_only` even when a candidate burn alert is calculated. It is
not a substitute for OpenTelemetry/Prometheus counters, scrape-health
telemetry, synthetic transactions, or governed on-call paging.

## Verification and release gate

- Pure module checks on actual GitHub-fetched sources: 7/7 focused tests.
- Permanent accumulator contract cases: 8/8 checked in an isolated JS harness.
- The CLI grammar and CLI success/error/invalid-argument exit contracts were
  checked under Node 22 using a stubbed accumulator. The *committed*
  full-subprocess test suite is pending GitHub CI and must not be called green.
- The current PR contains native PostgreSQL replay, but release is still
  blocked until exact-head required CI, tenant authorization, migration
  integrity/rollback, real provider idempotency, kill switch, secrets and
  signed-collector integration receive passing evidence.

## Next activation gate

Use an independently authenticated collector with server-owned product
labels and a health/continuity signal. Prove provenance, missing-telemetry
alerts, low-traffic policy, rate/cost limits and operator review. Then a
separate owner-approved deployment can enable real on-call routing.
Do not let log files or client-generated data authorize self-healing.

References:
- Google SRE Workbook, SLO alerting: https://sre.google/workbook/alerting-on-slos/
- OpenTelemetry HTTP spans (low-cardinality route template):
  https://opentelemetry.io/docs/specs/semconv/http/http-spans/
- OpenTelemetry HTTP metrics:
  https://opentelemetry.io/docs/specs/semconv/http/http-metrics/
