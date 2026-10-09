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


## Read-only snapshot adapter (2026-10-08 follow-up)

The reviewed draft now also includes `lib/sonara-cohort-snapshot-reader.cjs` with `readCohortFromSnapshot({connect, from, to, asOf, classifyEligibility})` and `tests/cohort-snapshot-reader.test.js`.

- `connect` **must** return one dedicated, operator-approved database connection that supports `query` and `release`; a connection pool's individual `query` method is not sufficient.
- The adapter begins one PostgreSQL `REPEATABLE READ READ ONLY` transaction, enforces a 5-second statement timeout, checks `transaction_read_only=on`, records the database's transaction timestamp, and refuses cutoffs later than that timestamp.
- It reads a bounded, deterministic, minimal-column set from `public.organizations` and `public.activity_events` through parameterized queries; cap-plus-one overflow, driver row-count mismatch and out-of-roster events cause a fail-closed result.
- Every organization is processed through an **externally approved synchronous eligibility policy**. Neither the function nor an operator-supplied boolean is independent proof of a legitimate customer.
- Rollback is attempted even after ambiguous BEGIN errors. A rollback/release failure suppresses an otherwise successful result. No raw SQL error, organization ID or event row is returned to the caller.
- These source contracts were checked against the live project's read-only `information_schema.columns` response: `organizations(id, created_at)` and `activity_events(id, organization_id, event_type, created_at)` exist with the assumed PostgreSQL types.
- Ten focused in-isolate source-backed tests passed, including read-only enforcement, transaction-clock cutoff, truncation, classification, cross-scope, ambiguous BEGIN, rollback error and raw-error redaction. These are **not** full repository Mocha or live PostgreSQL tests.

**Not yet wired or authorized:** No production connection string, reporting role, pg driver, scheduled task, web route, migration, or customer-facing dashboard was added. A trusted operator must independently provision a least-privilege reporting role, verify table/RLS permissions, and run a real database transaction and adversarial test under approved nonproduction conditions before this adapter is used with real data. Never pass customer-owned caller data as `connect`, `classifyEligibility` or `source.authorized` without the server-side authority boundary.

**Important historical limitation:** `asOf` is an event-time cutoff, *not* a reconstruction of database state at an earlier historical time. Events inserted after that timestamp with backdated `created_at` may be observed by the current database snapshot. Independent immutable ingestion-time provenance is needed for historical reproducibility.

## Database authorization gate (additional P0 evidence, 2026-10-08)

**Observed administrative role:** A read-only, metadata-only query to the connected Supabase project returned `connection_role=postgres`, `rolbypassrls=true` and RLS inactive for that connection on both reporting tables. **Do not use the connected administrative SQL executor, owner/database admin, `service_role`, or other bypass-RLS identities as the cohort reader.** No credential or customer row was exposed, and no database role was created or modified.

The snapshot adapter now requires a trusted server-side `approvedReportingRole`, uses `current_user` AND `session_user`, and fails before any customer table SELECT unless:
- Both effective and authenticated database session identity **exactly equal** the reviewed dedicated role.
- The database role is not a superuser and does not have `BYPASSRLS`.
- `row_security_active('public.organizations'::regclass)` and `row_security_active('public.activity_events'::regclass)` are **both true for that session**.
- Transaction read-only proof also passes.

This role check is a necessary safeguard **but not sufficient authorization proof**: an RLS-enabled table can still have an overly broad policy. Do not invent or install a blanket `USING (true)` policy. A legitimate review must prove the dedicated role is allowed to read **only an explicit approved reporting population** and that the eligibility policy removes internal/test organizations. Since RLS filters the organizations used by the activity join, the allowed reporting scope must be consistent on both tables.

### Nonproduction acceptance procedure (no production SQL changes)

1. With the owner/database administrator, provision an isolated staging role using the approved role design, minimal `SELECT` grants and **reviewed RLS policies**. Document the issuer, role, scope and expiration; do not place its credentials in the repository.
2. Under this role, run the exact metadata query in `lib/sonara-cohort-snapshot-reader.cjs` and verify all four boolean checks and exact session identity.
3. Create two **synthetic** organizations and fixture activity records *only in an approved staging instance*. Grant access to one; verify that records and aggregated results for the other are denied. Revoke/expire access and verify the next run returns no previously accessible customer facts.
4. Test concurrent writes while the reader holds a `REPEATABLE READ READ ONLY` transaction. Verify both queries reflect one stable snapshot. Check 10,001/200,001-row cap-plus-one behavior and failure rollback.
5. Run the actual `node`/Mocha focused tests, then full exact-head CI. Retain audit evidence without tenant identifiers, email, raw prompts, provider tokens or credentials.

**Current status:** 12/12 focused snapshot cases passed in a source-executing V8 test harness; the production database metadata query confirms that the admin connection **correctly would be rejected** by the new gate. A real least-privilege PostgreSQL integration test has **not yet passed** and cannot be claimed. Do not enable scheduled exports, billing analytics or public marketing based on mocked role checks.


## Authorized-roster completeness enforcement (2026-10-09 follow-up)

A read-only RLS-enabled query can return **zero rows for data a different session could read**. Consequently, a silent short result must **never** become a lower customer-activation denominator.

The snapshot reader now requires `expectedOrganizationIds` (a nonempty, case-deduplicated, validated UUID array of up to 10,000 organization IDs) from the trusted operator **before** opening its database connection. Both parameterized SQL queries are bound to that same roster with `= any($n::uuid[])`.

- The organization query rejects unexpected IDs, duplicate IDs and any missing expected organization. No denominator is published when the roster and visible rows disagree.
- The activity query also binds the roster, and every returned event must belong to the observed authorized organization set. Event completeness remains limited by the explicit 200,000-row cap and the externally reviewed source-integrity assumptions.
- A valid zero-organization cohort cannot yet be reported by this reader. A nonempty expected roster is intentional: an empty operator input must not masquerade as proof that no customers exist. Empty-cohort reporting requires a separately attested total population of zero.
- The **identity and completeness of the operator-supplied roster remain unproven in this code**. It must originate from an approved control plane with signed or otherwise independently verifiable scope and population evidence. Client-supplied or ad hoc incomplete UUID lists are not authoritative.
- The current source-level test suite covers absent/empty/invalid/duplicate/oversized rosters, a missing RLS-visible organization, unexpected or duplicated returned organizations, a complete two-organization result, role verification, clean rollback and nonleaking aggregate output.
- Two read-only `EXPLAIN (VERBOSE, COSTS OFF)` queries against the connected Supabase schema successfully parsed both `uuid[]` roster predicates and the timestamp-bounded organization/activity join. That is **SQL-shape verification only**, not role-authorized execution, a full dataset scan benchmark, or evidence of tenant isolation. PostgreSQL chose sequential scans for the currently tiny sample; do not generalize scaling cost from that plan.

**Next P0 gate:** Capture an independently authorized and auditable roster, then run the bounded adapter under a dedicated reviewed PostgreSQL reporting identity in staging. Prove two-tenant negative cases, missing IDs, snapshots under concurrent writes, timeouts and RLS policy selectivity before promotion. `READ ONLY`, an RLS-active flag and the roster predicate together are still not a substitute for a reviewed authorization policy.


## Research and implementation basis

- OpenTelemetry semantic conventions warn against high-cardinality labels and sensitive data: https://opentelemetry.io/docs/specs/semconv/general/attribute-requirement-level/
- Google SRE's reliability evidence and error-budget policy: https://sre.google/workbook/error-budget-policy/
- Stripe webhooks require raw-body signature verification and asynchronous handling; activity events alone are not payment proof: https://docs.stripe.com/webhooks
- Supabase RLS must restrict rows by tenant, not just a broad authenticated role: https://supabase.com/docs/guides/database/postgres/row-level-security

**Next owned step:** Wire the unconnected snapshot adapter to an independently approved, least-privilege PostgreSQL reporting role in a nonproduction environment, with evidence-backed eligibility and pagination/bounds validation; then separately implement Stripe entitlement reconciliation. Do not broaden marketing or unpause production until exact-head CI, security and live evidence gates are green.
