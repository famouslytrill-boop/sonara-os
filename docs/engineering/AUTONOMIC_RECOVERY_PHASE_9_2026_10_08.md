# SONARA Autonomic Recovery — Phase 9: SLO Evidence Sufficiency and Suite Isolation

Date: 2026-10-08. Draft PR #510; no live release, no production migration, no repair activation.

## Research finding

Google's SRE Workbook recommends combining 5m/1h and 30m/6h burn-rate thresholds for high-traffic systems, but warns that request volume and low-traffic periods affect the reliability of these signals. SONARA's initial in-memory evaluator counted 1,000 events from a five-minute span as >=100 samples in a one-hour window. A caller could interpret a five-minute spike as an established one-hour baseline despite having no evidence from earlier in the hour.

This phase adds SONARA-specific **evidence sufficiency guards**. These additional guards are a conservative decision for SONARA's diagnostic-only helper, not a claim that Google's canonical burn-alert rules universally require a 75% coverage span or six buckets. Production should use real counter-based telemetry with explicit scrape/coverage confidence and service-specific paging policies.

## Implemented

1. `lib/sonara-slo-burn-control.cjs`: every long window must have BOTH >=75% historical time span and traffic across >=6 of 12 equal-duration buckets before the burn rate is eligible as a page candidate. Both limits are configurable within strict validated bounds. The evaluator still requires the configured sample minimum in both windows.
2. Distinguish `insufficient_long_window_coverage` from `insufficient_samples`; provide fixed diagnostic `coverageRatio`, `coveredBuckets`, `countSufficient`, and `coverageSufficient` fields, without raw customer identifiers, tenant IDs, URLs or payloads. No automatic recovery permission is ever granted.
3. `tests/sonara-slo-burn-control.test.js`: distributed sustained high burn still pages as a candidate, five-minute bursts do NOT claim hour coverage, two distant bursts separated by telemetry outage are insufficient, and invalid coverage parameters fail closed. Eight tests passed in a local JavaScript harness.
4. `lib/sonara-per-suite-slo-diagnostics.cjs`: separate SONARA One, Business Builder, Creator Studio and Growth Studio observations by a closed suite enum. Each product gets an independent long-window sufficiency verdict; no global average masks a product outage. `permittedAction` is always `alert_only`. The data contract must be fed only by independently trusted server-side instrumentation.
5. `tests/sonara-per-suite-slo-diagnostics.test.js`: six isolated tests cover product isolation, low-history bursts, redaction of extraneous identifiers, unknown-label rejection, invalid evidence and alert-only handling.

## Mathematical constraints

For error budget target S, observed failure ratio E, and threshold B:

```
burn = E / (1 - S)
alert_candidate = (short_count >= minShort)
               AND (long_count >= minLong)
               AND (long_coverage_ratio >= 0.75)
               AND (long_occupied_buckets >= 6)
               AND (short_burn >= B)
               AND (long_burn >= B)
```

Fast rule: 5-minute short, 1-hour long, burn threshold 14.4.
Slow rule: 30-minute short, 6-hour long, burn threshold 6.

The coverage rule is deliberately conservative: a newly started or intermittently sampled service receives an **insufficient evidence** verdict, not a fabricated stable SLO. It does not replace external uptime checks, synthetic probes, counter-based monitoring, or alert routing.

## Verification limits and next engineering gate

- Local JavaScript harness evaluated the actual fetched CommonJS evaluator source: 8/8 SLO regression tests and 6/6 per-suite cases passed. Not the full repository suite and not CI evidence.
- Latest exact-head GitHub PR #510 workflow state: 14 queued/pending, zero reported passing conclusions; native PostgreSQL replay remains unverified.
- Rollout remains blocked by required CI, migration history, tenant/role isolation, real provider idempotency, authenticated sensor and kill-switch adapters, owner approval, and one-tenant fault-injection proof.
- NEXT: integrate server-authoritative suite-labeled request counters and explicit scrape health into a read-only operator dashboard. Do not page or repair on client-submitted metrics. Validate scrape gaps and test low-traffic policies before alert activation.

## References

- Google SRE multiwindow burn rates and low-traffic considerations: https://sre.google/workbook/alerting-on-slos/
- Google SRE monitoring and counter-based measurements: https://sre.google/workbook/monitoring/
