# SONARA Customer Cohort Proof — operator-only engineering slice

Date: 2026-10-08. Status: source implementation **under review**, NOT a live customer or revenue claim.

## Why this exists

SONARA has a canonical tenant-scoped `activity_events` ledger but does not yet have independently verified production customer retention or paid-commercial delivery. This slice provides a deterministic, bounded evaluator of a specifically defined organization cohort. It deliberately does not add an exposed API endpoint, change the database, grant an entitlement or publish a metric.

## Inputs and provenance

`lib/sonara-customer-cohort-proof.cjs` requires:

- `organizations`: complete set of authorized organization rows `{id, created_at, eligible}`; `eligible` must be determined by a server-side reviewed exclusion rule (test/internal organizations, staff, consent constraints). The evaluator cannot decide whether that rule was correctly applied.
- `activityEvents`: complete, paginated, read-only `{organization_id, event_type, created_at}` event export from the canonical ledger. Do not include event payload, names, contact information, or secrets.
- `from`, `to`, `asOf`: explicit ISO-8601 timestamps with timezone offsets; `from <= created_at < to` and `asOf >= to`.
- `source`: operator attestations `{authorized:true,organizationsComplete:true,activityEventsComplete:true}`. **Attestation flags are NOT cryptographic proof** and must only be supplied after the scoped authorized export is complete.

Callers must enforce authorization, RLS, membership, pagination completion and source integrity *before* calling this library. Never expose this evaluator as a client-input aggregate API or accept users' own `authorized:true` flags as an access-control decision. An authenticated server-side loader and immutable extraction evidence must be reviewed in a separate integration.

Usage with a locally authorized complete JSON export:

```sh
node scripts/report-customer-cohort.mjs /path/to/approved-export.json
```

The script prints only aggregate counts, cohort date bounds, denominators and readiness status. Raw organization identifiers are not returned. Protect, minimize, and delete the source export under the approved data-retention policy; the script itself does not delete it.

## Definitions and limitations

| Field | Denominator / meaning |
| --- | --- |
| eligibleOrganizations | Distinct eligible organization records created inside `[from,to)` |
| activatedOrganizations | Eligible organizations with an observed `account.organization_created` metric event on or after their created timestamp |
| firstValueOrganizations | Activated organizations with a later canonical `firstValue=true` event |
| activationRate | activated / eligible; null if no eligible organizations |
| firstValueRate | first value / eligible; null if no eligible organizations |
| matureActivatedOrganizations | Activated organizations for which the full elapsed 168–192-hour window after creation is observed |
| day7RetentionRate | Mature activated organizations with canonical product-use events in that window / mature activated; null if none mature |
| median/p90 first value | Nearest-rank percentiles of seconds from recorded activation to recorded first-value event, only among organizations with first value |
| observedPurchaseEventOrganizations | Organizations with a canonical purchase-completed event *in the activity ledger*, **not** verified charge, recognized revenue, or active subscription |
| verifiedPaidConversionRate | Always null in this slice; requires independent Stripe webhook, invoice, reconciled subscription/entitlement state and refund/cancel validation |

The estimator never treats a page view, unknown event, billing-only day-7 event, or unmatched outside-tenant event as customer first value or retention. The report is not a causal statement about SONARA generating customer revenue. `eligible` exclusion and source coverage are externally supplied assumptions; honest source provenance is necessary.

## Tests and acceptance

- Focused regression test covers empty denominators, missing source proof, duplicated event observations, cross-tenant exclusion, pre-activation and future events, billing-only retention, immature D7 windows, bad timestamps, duplicate organization source rows and PostgreSQL timezone offsets.
- Local detached harness executed 7 test cases; canonical repository Mocha + exact-head GitHub checks must still pass before merge. Detached fixtures do not prove live DB performance or event authenticity.
- CI may require regeneration of its generated test-file count and handoff before merge. Do not hand-edit the generated handoff, weaken gates, or mark skipped checks as passing.
- Before a production-read adapter is added: construct a server-authorized, count-checked, snapshot-consistent export with explicit pagination and reconciliation; define the export security/retention and immutable proof packet; then run two-tenant adversarial tests and operator signoff.

## Research and implementation basis

- OpenTelemetry semantic conventions warn against high-cardinality labels and sensitive data: https://opentelemetry.io/docs/specs/semconv/general/attribute-requirement-level/
- Google SRE's reliability evidence and error-budget policy: https://sre.google/workbook/error-budget-policy/
- Stripe webhooks require raw-body signature verification and asynchronous handling; activity events alone are not payment proof: https://docs.stripe.com/webhooks
- Supabase RLS must restrict rows by tenant, not just a broad authenticated role: https://supabase.com/docs/guides/database/postgres/row-level-security

**Next owned step:** Implement a server-only, reviewed, snapshot-consistent extraction adapter and independent Stripe entitlement reconciliation; do not broaden marketing or unpause production until exact-head CI, security and live evidence gates are green.
