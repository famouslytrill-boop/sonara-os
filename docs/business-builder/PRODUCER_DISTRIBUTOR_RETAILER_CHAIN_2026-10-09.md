# Producer → Distributor → Retailer: controlled physical supply chain

**Research date:** 2026-10-09. **Application:** SONARA One / Business Builder™.
**Status:** deterministic domain functions plus a proposed append-only procurement-receipt migration committed to draft PR #566. Not deployed, not exposed as a paid-customer route, and not proven against a disposable migrated database.

## Problem and architecture decision

SONARA has purchase-order approvals, merchant orders, inventory items, reservations and
a stock-consuming fulfillment transition. It does not follow that a producer,
distributor and retailer can already exchange orders and verified custody records
across separate organizations. Do not create another per-channel order/stock system.

One trade item should retain internal product UUID, customer SKU, optionally verified
GS1 GTIN, unit, lot/serial provenance and owner-specific locations. Separate the
seller's dispatch from the buyer's receipt and separate financial settlement from
physical acceptance.

```text
producer: material availability → approved production run → quality release
      → outbound sales order / shipment → dispatch evidence
distributor: independently approved trading partner → PO → incoming ASN
      → goods receipt (accepted / rejected / quarantined) → storage / picking
      → outbound sale → proof of delivery
retailer: approved supplier → replenishment draft → PO → goods receipt
      → available-to-promise → POS / online order → fulfillment → return
shared: identity + custody events + immutable receipts + scoped permissions
      + audit trails + external payment references + reconciliation
```

A B2B transfer across organizations is **not** an internal warehouse transfer.
Each organization owns its own inventory and accounting books. Never grant a
partner direct access to the other tenant's tables merely because it knows a
product, purchase-order or shipment ID.

## Implemented deterministic boundary

`lib/sonara-physical-supply-chain.cjs` implements five pure functions:

| Function | Role | Guarantee / boundary |
| --- | --- | --- |
| `isValidGtin` | All | Validates 8/12/13/14-digit GTIN check digits; does not issue or verify ownership of a GTIN |
| `normalizeTradeItem` | All | Preserves SKU/GTIN/lot/unit without inventing GS1 IDs |
| `proposeProductionRun` | Producer | Computes BOM base-unit material requirements, duplicate detection and shortfalls without consuming inventory |
| `proposeShipmentReceipt` | Distributor and buyer | Checks lot/quantity consistency, partial receipts and idempotency payload conflicts against an authoritative receipt snapshot; never writes a stock movement |
| `proposeReplenishment` | Retailer | Computes stock available to promise and a draft reorder quantity without creating a PO or spending money |

The corresponding tests are `tests/physical-supply-chain.test.js`.
Count quantities are nonnegative safe integers measured in **one explicit base
unit per stock item**. Gram/ml/each conversion must occur in a separately reviewed
unit-of-measure contract; never silently mix kilograms, grams, cases and units.

`available_to_promise = max(0, on_hand - reserved - quarantined - safety_stock)`

`projected_available = available_to_promise + approved_incoming`

`draft_reorder = projected_available <= reorder_point
  ? max(0, target_stock - projected_available) : 0`

Incoming quantities must be undelivered, approved and not double-counted as
on-hand. Quarantined and reserved values must refer to non-overlapping stock.
A customer-reported estimate is not authoritative inventory.

## Engineering Phase 2: staged atomic procurement receiving (2026-10-09)

Source: `supabase/migrations/20261009153000_procurement_receipts_exactly_once.sql`.

A **single-organization buyer** may receive a line on an already-sent,
owner-approved purchase order through a proposed service-role-only PostgreSQL
function. The transaction:

1. Locks the buyer's PO, PO line and inventory item in order.
2. Verifies organization, location, unit, approval evidence and available
   ordered quantity before accepting an event.
3. Refuses incompatible historical `quantity_received` until the prior data
   is reconciled. It does not invent backfilled receipts.
4. Inserts immutable `procurement_receipt_entries` (accepted and rejected
   amounts, lot, actor, idempotency key, before/after accepted total).
5. Increases `inventory_items.quantity` only for accepted goods, then records
   that delta in `inventory_procurement_receipt_ledger`.
6. Transitions the PO to partially received or fully received only if all
   ordered lines are fully **accepted**.
7. Returns the original receipt on exact duplicate retry; refuses changed
   payloads reusing a key.

RLS is on, authenticated and anonymous roles have no table grants, and
trigger-side references verify that tenant/PO/line/item/ledger lineage agrees.
New tables have no direct UPDATE/DELETE grants to service_role. The function
is `SECURITY INVOKER` and does not run on behalf of a browser without
the separately required server-side tenant and actor authorization.

**Boundaries:** This is not cross-tenant B2B exchange, lot-bin reconciliation,
full supply-chain event capture, all-channel inventory accounting, payment
settlement, or real provider sync. Other stock mutation paths still need ledger
integration. The existing `inventory_movements` relation appears in old
repository SQL, but was absent from the project's read-only live schema inspection
on October 9. Do not assume historic migrations and live state agree.

**Validation:** `tests/procurement-receipt-sql-contract.test.js` checks source
security and transaction structure, not live isolation or PostgreSQL execution.
The mandatory native replay in `scripts/verify-migration-replay.mjs` now loads
`tests/sql/procurement-receipt.sql` in a rolled-back fixture and independently
races two PostgreSQL sessions using `tests/sql/procurement-receipt-concurrency.sql`.
The suite must demonstrate exact-once receipt, accepted/rejected stock logic,
foreign-tenant denial, approval gating, idempotency payload conflict and
ordered-quantity serialization. These are **written tests**, not reported
passing PostgreSQL results until hosted CI executes them successfully.
A disposable database must run migration replay, tenant-negative tests, two
concurrent sessions, exact replay, changed-payload replay, wrong-unit, partial
receipt, rejection, damaged/expired lot, zero-stock, cancellation and deletion
checks before CI approval. The Supabase CLI is unavailable in the current
execution container; SQL migration-file generation and live DB replay were
not performed by this pass.

**Release policy:** Keep the PR draft. Require exact-head green checks,
controlled migration review, rollback evidence and a deliberately approved
one-tenant pilot before activation. The SQL file's presence does not mean it
has been applied.

## Phase 4: supplier invoice three-way match, draft only

Implemented `lib/sonara-procurement-three-way-match.cjs` and
`tests/procurement-three-way-match.test.js`, with **no runtime payment authority**.
One deterministic decision compares:

1. **Approved PO:** same organization/vendor/currency, timestamped approver
   and version, ordered quantities, units and agreed unit costs.
2. **Accepted goods receipt:** same PO/line/tenant, unique receipt IDs and
   accepted-only quantities; rejected/returned goods cannot be used to approve
   billed quantities.
3. **Supplier invoice:** explicit PO linkage, vendor/currency/unit agreement,
   invoice quantities not exceeding either the PO or **unbilled accepted** stock,
   line arithmetic, subtotal/total and controlled fee/tax review.
4. **Previous approved/scheduled/paid invoices:** authoritative invoice
   allocation history is mandatory, even when empty, and blocks the same
   accepted goods being billed twice across separate invoices.

Quantities use integer thousandths of each declared item unit; prices and
subtotals are integer cents with BigInt interim multiplication, with half-up
rounding per invoice line. For now only selected two-decimal currencies are
supported; never infer tax, currency conversions or case/weight equivalence.
Disagreements return `hold_for_review`. A clean result returns
`ready_for_human_review` **not** approval or payment execution.

**Required integrations still missing:** `vendor_invoices` and
`vendor_invoice_lines` in the currently inspected schema do not establish a
verified immutable PO-line allocation and complete invoice history. A trusted
server-side source loader, invoice-to-PO mapping, vendor agreement grants,
separate approvals, immutable allocation ledger and provider-settlement
reconciliation are required before wiring this module into customer routes.

**Live schema concern found in read-only review (October 9, 2026):**
`authenticated` retains table-level `UPDATE` grants on
`inventory_items`, and the inventory Business Builder resource still exposes
quantity as an editable field. Tenant RLS limits who can change a row, but
such edits can bypass a procurement-only receipt ledger. Do not call stock
ledger authoritative until a reviewed stock-adjustment path exists and direct
quantity mutations are blocked or journaled without breaking customer workflows.

**Validation:** 16 focused matching-engine tests passed in an isolated JS
execution harness. They are not proof of customer data provenance, full Mocha
CI, database replay, multi-session concurrency, or external payment correctness.

## Phase 5: controlled stock reconciliation (October 9, 2026)

Implemented `lib/sonara-stock-reconciliation.cjs` and
`tests/stock-reconciliation.test.js` as a **pure, unconnected** stock discrepancy
preflight. It compares physical cycle count in thousandths of the declared
inventory unit with the same-tenant stock snapshot and held reservations.

Deterministic invariants:

- Physical stock correction must not reduce on-hand below committed reservations.
  Even a zero-variance count is blocked if holds already exceed on-hand.
- Cross-tenant counts, mismatched SKU/item IDs or units, stale `stockVersion`,
  invalid/noninteger quantities, unsupported adjustment reasons and self-review
  are rejected without inventing a correction.
- Absolute discrepancy value is calculated with BigInt in integer cents, with
  half-up rounding. Amount or quantity above configured organization thresholds
  raises `dual_approval_required`; damage, expiry or shrinkage raises a custody
  / quarantine review flag.
- The result has `effect: proposal_only` and
  `authorizesStockMutation: false`. It cannot grant permissions or trust
  caller-provided role/approval IDs and NEVER posts a stock change.

**Read-only connected schema inspection:** `inventory_count_sessions` and
`inventory_count_lines` exist with actor, count, quantity and unit fields;
`inventory_items` has `quantity` and `updated_at`, but **no
`stockVersion` counter**. There is no verified irreversible stock-adjustment
transaction, and `inventory_items.quantity` can still be changed through
existing authorized CRUD. The preflight must not be wired to customer writes.

**Next exact engineering order:** (1) add an explicit, monotonically incremented
stock version on an appropriately reviewed migration; (2) reconcile current
manual stock values against historical storefront fulfillment and job usage
without deleting data; (3) implement a service-only, tenant-bound,
idempotent adjustment journal with expected-version compare-and-swap and a
durable independent approval record; (4) redirect inventory adjustments away
from generic CRUD while retaining permitted catalog edits; (5) under a single
item row lock, recalculate held reservations, adjust stock and append immutable
audit evidence atomically; (6) test cross-tenant forgery, duplicate request
keys, lost updates, two reviewers, no-negative available-to-promise, recall/
expiry quarantine, rollback and snapshot replay; (7) enable one-tenant
flag only after exact-head green CI and an approved controlled database rollout.

**Standards / controls:** GS1 EPCIS 2.0 models source, destination, disposition
and time for upstream/downstream visibility; do not claim EPCIS conformance
from an internal stock count record. NIST SP 800-161 Rev. 1 frames third-party
supply-chain risk; invoice matching guidance distinguishes approved purchase
orders, accepted receipts and vendor invoice lines. Neither standard gives
permission to move stock or funds. Current sources:
- https://www.gs1.org/standards/epcis
- https://csrc.nist.gov/pubs/sp/800/161/r1/upd1/final
- https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/three-way-matching-policies

**Verification:** 15 focused stock-reconciliation test assertions were executed
in an isolated JavaScript harness and passed. The full Node/Mocha test suite,
real PostgreSQL replay, migration-derived inventories, and production gates
remain independently required. No live rows or schema were modified by this work.

## Phase 6: staged versioned inventory and reviewer-backed adjustments

**Source committed; do not apply to production before release-gate success.**
Migration:
`supabase/migrations/20261009170000_versioned_stock_adjustment_journal.sql`.
It introduces `inventory_items.stock_version bigint` and three internal
service-only tables:

- `inventory_stock_events`: universal version/quantity event evidence. A
  fixed-table, schema-pinned **SECURITY DEFINER trigger** inserts opening
  snapshots and every subsequent quantity change, including unclassified
  legacy storefront/job/manual writes. Trigger-only elevation is used because
  existing authorized owner writes lack service-role INSERT grants to this
  private audit. The trigger has no dynamic SQL and is not an application API.
- `inventory_stock_adjustment_approvals`: immutable, independently recorded
  reviewer decision for one specific item, expected version, count, actor,
  reason and idempotency key. Service-role only. The backend must **actually
  authenticate the reviewer and bind their action**. A database UUID by itself
  is not proof of user consent or an approved transaction.
- `inventory_stock_adjustments`: a unique, immutable correction linked to
  both the actual quantity-change event and matching durable reviewer
  approval. A before-insert tenant/lineage trigger rejects mismatched
  references even from a privileged INSERT.

**Stock-version mechanics:** Each new item begins at version 0 and each
physical quantity update increments by exactly one. Existing items receive a
version-0 **opening snapshot with zero delta** inside the migration, not a
fabricated historical receipt. Subsequent legacy changes are marked
`unattributed_quantity_change` rather than falsely credited to procurement,
a sale or a named worker. Item-to-organization reassignment and direct version
tampering are denied. Direct deletion of an inventory item cannot erase its
event history silently.

The service-only `sonara_apply_stock_count_adjustment` transaction rechecks
active organization membership for the actor and owner/admin reviewer, loads
and locks its durable approved decision, then locks the item. It enforces
exact idempotency semantics, expected-version compare-and-swap, valid physical
count precision, nonnegative counted balance and sufficient stock against
held reservations **including for a zero-variance count**. The correction,
version increment, automatic stock event and manual adjustment evidence must
commit atomically or roll back together.

**Additional safeguards and boundaries:**

1. The default owner CRUD permission to edit inventory quantity remains active
   for compatibility. Its changes are now auditable and versioned, but **not
   yet constrained to a reviewed reason**. Do not label the journal a fully
   attributed or closed-loop inventory accounting system.
2. Stock reconciliation proposals and three-way invoice matching remain
   **test-only**: they do not perform direct stock or financial mutations.
3. Reviewer evidence must originate from a separately authorized server action
   with live identity verification, explicit reviewer consent and auditable
   separation of duties. A trusted `service_role` connection alone does not
   establish that a human approved anything.
4. This DDL adds a version column and snapshots existing rows, so production
   lock duration, backfill size, missing history, restore/rollback and
   idempotent rollout must be assessed before the change is enabled.

**Native replay tests:** `tests/sql/stock-adjustment-journal.sql` uses a
rolled-back disposable database to check journal math, opening snapshots,
privileges, approval requirements, exact retries, stale data and reservation
corruption. `tests/sql/stock-adjustment-concurrency.sql` seeds real
independent-connection races for duplicate requests and differing counts at
the same version; `scripts/verify-migration-replay.mjs` executes them.
`tests/stock-adjustment-sql-contract.test.js` contains 10 additional focused
source-level checks. These source checks passed in an isolated JS harness,
**not a completed native PostgreSQL run**.

**Release gate:** production remains unchanged until fresh native replay for
Node 22/24 and PostgreSQL compatibility lanes, authenticated grants/RLS matrix,
actual business inventory flow regression tests, backup/restore proof, owner
authorization and one-tenant controlled deployment are all demonstrably green.
Then separately migrate direct owner stock editing to the reviewed, durable
adjustment route, preserving ordinary catalog metadata edits.

Design reference: PostgreSQL row locking and trigger/transaction semantics;
Supabase database functions and RLS guidance:
https://www.postgresql.org/docs/current/explicit-locking.html
https://supabase.com/docs/guides/database/functions
https://supabase.com/docs/guides/database/postgres/row-level-security

## Phase 7: audit-event provenance and custody exception fail-closed

Security review of the staged versioned-stock migration identified a way
to label an old inventory movement as a newly approved correction if a
privileged actor inserted a matching record after the movement had happened.
The migration now includes **three independent posting requirements**:

1. `inventory_stock_events.posting_xid` is stamped with
   `pg_current_xact_id()` by PostgreSQL. A correction's event must belong
   to the **same database transaction** as the correction insert.
2. The inventory item's **current** organization, `stock_version` and
   on-hand quantity must still agree with the event. An old but otherwise
   matching event cannot be reused as a new correction.
3. Every reviewer approval gets a database-controlled
   `approved_at = clock_timestamp()`, with an insert trigger that ignores
   a caller-supplied earlier timestamp. The approved event must occur
   **after** the approval's recorded time. `now()` is deliberately not used
   for this ordering because its value is fixed at the start of a
   PostgreSQL transaction. This timestamp is an additional consistency
   control, not cryptographic proof of who approved.

A separate disposable replay pair
(`tests/sql/stock-adjustment-cross-tx-prep.sql` and
`tests/sql/stock-adjustment-cross-tx-check.sql`) commits an otherwise
valid unattributed movement and then attempts to reclassify it as approved
from a second connection/transaction. A separate negative fixture checks
forged old `approved_at` values and a reviewer decision entered after the
physical movement in a single transaction. These tests were **written and
wired to mandatory native migration replay**; they are not proof of
successful PostgreSQL execution until CI runs.

**Custody safety:** `sonara_apply_stock_count_adjustment` now accepts
`cycle_count` only, even if a reviewer row exists for another reason.
`damaged`, `expired`, `shrinkage`, `customer_return` and
`supplier_correction` require their own lot/serial tracking, ownership
evidence, quarantine/return workflow and controls before affecting available
stock. The generic count RPC returns
`stock_custody_evidence_required` for those reasons. The pure JS
reconciliation engine remains proposal-only.

This is **not complete attribution or tamper-proof auditing**. A
trusted service-role backend must still bind the authenticated caller's
identity and collect genuine separate reviewer consent; existing direct
quantity edits are still journaled as `unattributed_quantity_change`.
Server key compromise or a privileged database owner can bypass ordinary
application-level controls. The next engineering release step remains
reviewed route integration, tenant-authorization adversarial tests, native
PostgreSQL replay and exact-head merge protection.

PostgreSQL reference:
https://www.postgresql.org/docs/current/trigger-definition.html
https://www.postgresql.org/docs/current/functions-info.html
https://www.postgresql.org/docs/current/functions-datetime.html

## Phase 8: snapshot identity and unit-of-measure integrity

Follow-up correctness review found that `inventory_items.stock_version`
previously incremented only when `quantity` changed. A tenant could therefore
change an inventory item's measurement unit or physical location after a
cycle-count review while the version still matched. Reusing a quantity-only
approval after an `each` to `kg` conversion, or a warehouse move, would be
incorrect.

The staged schema now captures `expected_unit` and
`expected_location_id` on every independent adjustment approval.
The service-only posting transaction locks the inventory item and rejects
approval if its actual unit or warehouse location differs, using
`stock_adjustment_item_identity_changed`. A privileged direct-insert
lineage trigger independently enforces these fields.

**Crucially**, the database-managed `stock_version` now increments when
`quantity`, `unit` **or** `location_id` changes. Pure catalog-identity
changes write `catalog_identity_change` events with **zero stock delta**;
they do not pretend goods were received, delivered or consumed. Thus changing
an item from `each` to `kg` and back cannot restore the validity of a
previously issued stock approval: the revision has still advanced twice.

The read-only source tests assert the revised trigger, approval bindings and
replay fixture. The transactional behavior fixture verifies a unit-only
change advances the revision and creates exactly one zero-delta event; its
adversarial change is rolled back to a savepoint so subsequent approved
receiving/correction scenarios retain their expected baseline.

**Important remaining boundary:** generic owner inventory quantity edits are
still permitted and labeled `unattributed_quantity_change`; unit conversions
are NOT implemented by this change, and no conversion formula or custody move
is performed automatically. Any `unit` or location change to a quantity
carrying actual physical stock still requires separately governed conversion,
transfer and reservation integrity controls before customer rollout.
Native PostgreSQL replay, backfill timing, data migration checks and
authenticated actor-reviewer proof remain release blockers.

### Deterministic count preflight alignment

`lib/sonara-stock-reconciliation.cjs` also requires the caller to provide
**explicit `item.locationId` and `count.locationId`** (either a UUID or
an explicit `null` for unassigned). A missing location is rejected as
`warehouse_snapshot_missing`; two different sites fail with
`warehouse_snapshot_mismatch`. The proposal now returns the checked
`locationId` so an eventual server approval can store
`expected_location_id` without guessing. Existing reservation records are
still item-scoped, and the backend must independently check that held
quantities represent the authoritative organization/item balance.

**Verification:** 17 focused stock preflight tests and 16 staged journal
source contract tests passed in an isolated JavaScript harness. Alongside the
three earlier focused suites, **71 assertions passed**. None of these results
establish a passing native PostgreSQL migration or external tenant-authorization
test. The native database replay includes revised approval fixtures with
`expected_unit` and `expected_location_id`, plus a savepoint-based unit
change/rollback probe.

## Required integration work before customer activation

### 1. Canonical transaction and database migration

Review existing inventory, procurement, checkout and fulfillment SQL
against the live migration history before authoring an **append-only** change.
These records are conceptual; do not create duplicates if source tables already
provide the required contract:

- `trading_partner_grants`: organization, counterparty, scope,
  status, approver, expiry; each party independently authorizes data exchange.
- `product_lots`: organization, inventory product, lot/serial,
  producer reference, quantity unit, expiry, QC/quarantine status.
- `b2b_shipments` and `b2b_shipment_lines`: seller-owned dispatch
  linked to a seller order, product version/identity and shipping label/SSCC.
- `b2b_receipt_lines`: buyer-owned immutable accepted/rejected quantities,
  server-issued receipt ID, provider/actor evidence and idempotency key.
- `inventory_ledger_entries`: immutable tenant/location/product/lot deltas
  with event type, source, timestamp, actor, correlation ID and reversal link.
- `b2b_invoice_matches`: separate PO, receipt, invoice, tax/currency and
  verified external-payment status; never represent a self-reported transfer as paid.

Every `organization_id` foreign key and row-level security policy must be
tenant safe. For multi-tenant references use matching composite
organization/record keys where the existing schema allows. Revoke direct
authenticated writes to authoritative stock and receipts. Deny browser-supplied
tenant IDs; resolve organization, role and relationship on the server.
Do not create broad service-role access paths.

### 2. Receipt and stock commit

The receiving action must use one transaction to lock the shipment and its
previous receipts, confirm the authenticated buyer and approved counterparty
relationship, bind idempotency key to payload, reject over-receipts, insert
immutable receipt evidence and post any allowed accepted-stock delta.
A retry with the same receipt and key must return the existing persisted result.
A retry with changed quantities must fail. No stock increase for damaged,
rejected or quarantined units unless a separately approved disposition exists.

Track manufacturer-originating transformation/lot genealogy. A shipped
quantity and received quantity are **not automatically equal**, and rejected
goods require disposition, supplier claims or corrective adjustments.

### 3. Customer and provider journeys

- **Producer:** BOM estimate → material reservation → owner-approved run →
  lot genealogy → QC release → outbound ASN.
- **Distributor:** supplier order → receiving → lot/bin allocation →
  FEFO or FIFO picking under merchant policy → route/carrier handoff →
  proof of delivery.
- **Retailer:** customer-specific wholesale pricing → PO →
  partial receipt → shelf/location stock → sale/return → reorder suggestion.
- **Cross-company:** purchase-order and invoice numbers, currency, terms,
  EDI/CSV imports, delivery exceptions, payment status from the merchant's
  provider, dispute/credit-note workflow and activity feed.

Use Creator Studio for owned product images/packaging and Growth Studio for
approved product campaigns. Neither gets direct authority to alter money or stock.

### 4. Release proof

Mandatory negative and concurrency tests:
1. Buyer A cannot see Buyer B's stock, pricing, invoices or receipts;
   the seller cannot access the buyer's private inventory.
2. Duplicate or concurrent receipt with one idempotency key creates exactly
   one receipt and stock entry.
3. Concurrent shipments cannot oversell the same location/lot.
4. Partial receipt, wrong lot, wrong unit, damaged goods, expiry and recall
   quarantine cannot bypass checks.
5. Return, cancellation, reversal and refund never mint or double-credit stock.
6. A manager draft cannot commit purchasing spend without the approved policy.
7. Reconciliation compares supplier PO, receipt, invoice and provider evidence.
8. Accessibility, scanner input, keyboard-only workflow, offline conflict
   handling, replay and restore evidence pass.
9. No release if exact-head CI, migrations, rollback tests or RLS adversarial
   tests fail.

Production activation: **off** until migration review, CI, security, staging
concurrency tests, one-tenant canary and an approved customer/provider flow.

## Sector nuances

Food and beverage need lot/expiry, cold-chain readings, recalls and
farm-to-table critical tracking event evidence. Manufacturing needs material
transformation, units and QC. Wholesale needs buyer-specific price lists, cases
and delivery scheduling. Retail needs barcode/PLU, store transfers, point of
sale, returns and stock counting. Regulated pharmaceuticals/medical devices
must undergo separate legal and operational review rather than inheriting
generic food/retail compliance claims.

For covered foods, the FDA says its Food Traceability Rule involves
Critical Tracking Events and Key Data Elements. The FDA currently says it
will not enforce the rule before **July 20, 2028**, in line with a 2026
Congressional directive. The FDA page also contains older text listing
January 20, 2026; use its current enforcement statement and obtain a
current industry-specific legal review before advertising compliance.

## Baseline product and operating KPIs

| Role | Leading KPIs | Don't mistake for proof |
| --- | --- | --- |
| Producer | material shortage rate; yield variance; QC failure rate; lead time | BOM plans are not production completion |
| Distributor | fill rate; on-time-in-full; receiving variance; inventory accuracy | shipping labels are not delivery proof |
| Retailer | stockout rate; sell-through; shrinkage; gross margin after returns | paid checkout alone is not reconciliation |
| Shared | duplicate-side-effect rate; traceability coverage; time to recall; tenant authorization denials | schema presence is not customer adoption |

First commercial pilot: one producer, one distributor and one retailer with
approved test tenants and synthetic products. Pass shipment → partial receipt →
stock update → sale → return → invoice reconciliation and reproduce the
audit trail from durable records. Only then add additional customers and
provider integrations.

## Primary references

- GS1 GTIN, GLN, SSCC and identification keys: https://www.gs1.org/standards/id-keys
- GS1 EPCIS 2.0 and Core Business Vocabulary: https://www.gs1.org/standards/epcis
- FDA Food Traceability Rule: https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-requirements-additional-traceability-records-certain-foods
- NIST cyber supply-chain risk: https://csrc.nist.gov/pubs/sp/800/161/r1/upd1/final

These sources establish design requirements, not SONARA regulatory
certification or live provider support.
