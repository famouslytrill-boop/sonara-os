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


## Native PostgreSQL integration proof added (2026-10-09)

**Implementation:** `tests/sql/p0-cohort-reader-rls-snapshot.sql` is now invoked by `scripts/verify-migration-replay.mjs` after the existing P0 native two-tenant replay fixture. The existing `.github/workflows/native-migration-replay.yml` runs that script against disposable PostgreSQL 16/17/18 with supported Node matrices, so no new CI runner, database dependency, production migration or server credential was introduced.

The SQL fixture, which **must not be run against a live customer database**, performs all of the following against the throwaway replay database:

1. Creates synthetic tenant A/B user, profile, organization and activity rows, plus a temporary `sonara_cohort_reader` login with `NOSUPERUSER NOBYPASSRLS NOINHERIT`.
2. Grants only the two reporting tables' SELECT permission, creates role-specific policies allowing the A fixture, and leaves all existing schema policies unchanged; a broad applicable existing policy that leaks B makes the probe fail rather than be ignored.
3. Changes both `session_user` and `current_user` to the synthetic reporter with PostgreSQL `SET SESSION AUTHORIZATION`; begins a new `REPEATABLE READ READ ONLY` transaction.
4. Asserts the reporter's role flags, active RLS on both tables, read-only state and isolation level. Verifies that A's organization and two events are accessible while B's organization and event remain invisible, **even when explicitly requested through typed UUID-array cohort filters**.
5. Asserts the time-bounded organizations/activity join sees only tenant A, emits the unique `p0_cohort_reader_rls_snapshot_passed` marker, and explicitly cleans up temporary grants, policies, synthetic rows and role. The disposable cluster is destroyed by the runner even if a check fails.

**Meaning of the evidence:** This is actual RLS SQL behavior when the native replay completes, not an assertion that an existing production reporting role has been provisioned, that the entire JavaScript adapter has connected to PostgreSQL, or that real customer tenant-isolation has been certified. The fixture specifically tests a *controlled synthetic policy* against the replayed schema. Independent testing of production policies with an owner-approved staging reporting account, and trusted signed roster provenance, remains mandatory.

**Execution status:** The fixture and replay hook have been committed and statically reviewed. The current working container has Node but no PostgreSQL `psql`, `initdb` or `pg_ctl`; **no live native replay success is claimed**. The GitHub native replay check must finish successfully on the PR's exact final head before this can satisfy its P0 gate.

See PostgreSQL's documented behavior for [row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [transaction modes](https://www.postgresql.org/docs/current/sql-set-transaction.html), and [session authorization](https://www.postgresql.org/docs/current/sql-set-session-authorization.html).

## Native replay defensive preflight and policy mutation probe (2026-10-09)

To prevent the disposable SQL fixture from being confused with a production migration, `tests/sql/p0-cohort-reader-rls-snapshot.sql` now **fails before any write** unless the connected database is named `replay`, the effective and authenticated database users are `postgres`, the connection uses a local Unix-domain socket, and the replay owner has PostgreSQL superuser status. These are safety guardrails rather than authorization to operate on any customer system; the entire file must still run only under the repository's ephemeral native migration replay.

The fixture now also includes a deliberately unsafe **transactional mutation probe**. After the normal two-tenant denial assertion succeeds, it creates temporary permissive `SELECT ... TO PUBLIC USING (true)` policies for both source tables. It then confirms that the restricted synthetic reporter would see tenant B through those policies, proving that the original negative check is sensitive to this particular permission regression. The containing transaction rolls back the deliberately insecure policies; fixture cleanup then removes temporary customer records and the reporting role. Neither a permissive policy nor a production grant is added by the branch.

An existing Mocha regression in `tests/migrations-are-replayed-not-just-read.test.js` now asserts that the native test, database/superuser/socket preflight, exact positive/negative marker, mutation block, and role cleanup remain connected to the migration-replay release chain. This **static test does not establish real PostgreSQL execution**; exact-head native CI remains mandatory.

The latest local attempt to install PostgreSQL into the isolated execution environment could not reach the system package repository because DNS was unavailable. Consequently, the native replay and its mutation probe were **not** executed locally, and no pass is claimed for them.


## Cryptographic roster approval gate (2026-10-09)

An unsigned `expectedOrganizationIds` list is no longer sufficient for the snapshot reader. `lib/sonara-cohort-roster-attestation.cjs` now verifies a **server-trusted Ed25519 signature before opening the database connection**. The snapshot reader fails closed with `roster_attestation_invalid` when the approval is missing, tampered, expired, replayed against a different reporting role/window/roster, or signed by an unknown/unsupported key.

The operator control plane is responsible for securely generating an approval. It must supply an envelope with exactly `{ keyId, payloadB64, signatureB64 }`. `payloadB64` is unpadded base64url of UTF-8 JSON whose keys are exactly:

```json
{
  "asOf": "2026-09-15T00:00:00.000Z",
  "audience": "sonara.cohort.snapshot.v1",
  "evidenceSha256": "<64 lowercase hexadecimal characters>",
  "expiresAt": "<UTC timestamp with .sssZ>",
  "from": "2026-09-01T00:00:00.000Z",
  "issuedAt": "<UTC timestamp with .sssZ>",
  "organizationIds": ["<lowercase sorted UUID>", "<additional IDs>"],
  "reportingRole": "sonara_cohort_reader",
  "to": "2026-09-02T00:00:00.000Z"
}
```

The Ed25519 signature is over the **original decoded JSON bytes**, not a reserialized object. The verifier accepts only a pinned server-provided public Ed25519 KeyObject or PEM `BEGIN PUBLIC KEY` trust anchor. It rejects private keys, unknown `keyId`, unsupported algorithms, extra fields, invalid base64url, unsorted/mismatched/duplicate IDs, invalid dates, evidence digests of the wrong shape, approvals issued in the future, expired approvals and signatures valid for longer than 24 hours. The maximum signed JSON payload is 500 KB; the maximum distinct organization population is 10,000.

**Authority boundary:** The signing private key belongs in an independently permissioned and audited control plane or KMS, **never** in the repository, client, environment dumps or the reader's `trustedRosterPublicKeys`. Server startup policy must pin the trusted public keys with a revocation/rotation procedure; the caller must not accept keys supplied in user requests. Public-key signature authenticity proves the approved *bytes* came from the pinned key, **not** that the underlying organization universe or eligibility classification is complete. `evidenceSha256` references separately retained source evidence; this module does not fetch or independently verify that evidence. A missing/invalid proof is not a legitimate zero-customer cohort.

**Tests:** The cryptographic verifier has been executed with native Node 22 Ed25519 keys against an exact-source-matched local copy. Seventeen positive/adversarial cases passed after resolving a real Node 22 `createPublicKey(public KeyObject)` incompatibility; source blob hashes were checked against the committed GitHub file. The Mocha regression suite includes key-object/PEM acceptance, explicit rejection of private-key custody, signature tampering, unknown keys, altered scope and expiration. **Full exact-head GitHub CI and real reporting-role PostgreSQL integration remain unverified.**

## Source-manifest integrity: signed evidence must exist (2026-10-09)

The verifier previously checked the **syntax** of the signed `evidenceSha256` but did not require matching bytes. An approval could therefore refer to a nonexistent, different, or modified source manifest. This is now fixed without adding a live service, migration or client API.

The server-only snapshot adapter requires `sourceEvidenceBytes` as a Node.js `Buffer` **before establishing a database connection**. `lib/sonara-cohort-roster-attestation.cjs` computes `SHA-256(sourceEvidenceBytes)` and requires an exact match to the Ed25519-signed `evidenceSha256`. The verifier strictly parses and checks the signed manifest bytes against the role, timestamps, sorted organization roster, population size and claimed extraction query. It rejects missing, overlarge, tampered, wrongly scoped or temporally impossible manifests, **even if a signature validates over the roster approval**.

An immutable source manifest is UTF-8 JSON (the SHA-256 is over the **original exact bytes**, not a reserialization) with exactly these keys:

```json
{
  "asOf": "2026-09-15T00:00:00.000Z",
  "audience": "sonara.cohort.snapshot.v1",
  "complete": true,
  "exportedAt": "2026-10-01T00:00:00.000Z",
  "from": "2026-09-01T00:00:00.000Z",
  "organizationIds": ["11111111-1111-4111-8111-111111111111"],
  "reportingRole": "sonara_cohort_reader",
  "scope": "eligible-organization-creation-cohort-v1",
  "sourceQuerySha256": "<64 lowercase hexadecimal characters>",
  "to": "2026-09-02T00:00:00.000Z",
  "totalOrganizations": 1
}
```

The manifest's `exportedAt` must be a strict UTC timestamp with milliseconds **at or after `asOf`**, no later than the signature's `issuedAt`, and no later than the verifier's clock. The approval remains valid for no more than 24 hours. `organizationIds` must exactly match the sorted authorized roster and the declared count. The manifest is bounded to 600 KB; the signing body is separately bounded to 500 KB. The reader returns aggregate data and opaque evidence SHA only, never the raw manifest or organization IDs.

**Operator issuance order:** Establish the complete approved population using an independently reviewed source query and reporting purpose; record the operator identity, immutable extraction parameters, exclusion policy, snapshot/query evidence and consent authorization *outside* this module. Produce and retain a source manifest as immutable bytes. Compute its SHA-256. Have the approved KMS-backed authority sign the corresponding roster approval including that exact digest and short expiry. Pin its public key independently in the backend verifier. Revoke or rotate signing keys according to security policy. These steps are **not** built as an autonomous publisher, and the code does not permit client-provided trust keys.

**Limits:** Both `complete:true` and `sourceQuerySha256` are claims by the issuer; verifying an honest digest and signature **does not prove the issuer performed the actual full query, that there were no withheld customers, or that the user's consent was satisfied**. This requires a reviewed export control plane, independent source-of-record audit and staging authorization tests. Backfilled events can alter historical reports.

**Verification:** Updated cohort and snapshot cases passed **27/27** in a source-backed JavaScript compatibility harness using *simulated* crypto and Buffer. An independent native Node v22.16.0 smoke test of real Ed25519 public KeyObject/PEM signature verification and SHA-256 manifest-byte mismatch passed. Neither proves this entire module passed Node/Mocha CI. Full exact-head checks and native PostgreSQL/RLS role tests remain pending; do not deploy, create a production database role or claim paid conversion.


## Reviewed extraction-query and unambiguous signed JSON (2026-10-09)

**New requirement:** The snapshot verifier now requires an independently pinned server-side `approvedSourceQuerySha256` in addition to the signed roster, the evidence manifest, `sourceEvidenceBytes`, and the database role. The value must be a full 64-character lowercase SHA-256. A manifest whose `sourceQuerySha256` does not exactly equal the server-approved value is rejected **before opening a database connection**, even if its Ed25519 signature and evidence checksum are otherwise valid.

Only an explicitly reviewed, stable source-of-record cohort-extraction query may supply this digest. The trusted caller MUST load the approved hash from a separately secured deployment policy/configuration that is not writable by an end user or by arbitrary report-request parameters. **Never set `approvedSourceQuerySha256 = manifest.sourceQuerySha256` merely to make verification pass.** This would render the independent query-review gate ineffective. Changing the query must trigger policy/code review and test regeneration, not an implicit approval.

For both the signature-bearing JSON approval and the hash-bound evidence manifest, the verifier now checks that the **original UTF-8 bytes exactly equal** `Buffer.from(JSON.stringify(JSON.parse(bytes)))`. This intentionally rejects duplicate JSON object keys, alternative whitespace/escaping, and other syntactically valid but noncanonical representations where different systems might disagree about the content. Approval producers must produce compact `JSON.stringify`-equivalent JSON with the documented key ordering and no UTF-8 byte-order marker, then hash/sign the **original bytes**.

**Replay limitation:** A still-valid signed approval for the same role, exact time window, source query and roster remains reusable until expiry; this module does **not** implement one-time use or a durable nonce-revocation store. Revoke/rotate trust anchors or add an independently durable claim-consumption ledger before treating these approvals as single-use. A 24-hour maximum signing lifetime is not replay prevention.

**Execution evidence:** A focused source-backed JavaScript harness passed **29/29** cohort and reader regression cases, using simulated Buffer/hash/Ed25519 primitives; this is a source-level check, **not** native Node/Mocha, real PostgreSQL or complete signing-KMS integration. On the exact PR head, GitHub Actions remain queued. The repository currently has a substantial queue across PR branches; CI results must be observed and retained rather than assumed.

## Research and implementation basis

- OpenTelemetry semantic conventions warn against high-cardinality labels and sensitive data: https://opentelemetry.io/docs/specs/semconv/general/attribute-requirement-level/
- Google SRE's reliability evidence and error-budget policy: https://sre.google/workbook/error-budget-policy/
- Stripe webhooks require raw-body signature verification and asynchronous handling; activity events alone are not payment proof: https://docs.stripe.com/webhooks
- Supabase RLS must restrict rows by tenant, not just a broad authenticated role: https://supabase.com/docs/guides/database/postgres/row-level-security

**Next owned step:** Wire the unconnected snapshot adapter to an independently approved, least-privilege PostgreSQL reporting role in a nonproduction environment, with evidence-backed eligibility and pagination/bounds validation; then separately implement Stripe entitlement reconciliation. Do not broaden marketing or unpause production until exact-head CI, security and live evidence gates are green.
