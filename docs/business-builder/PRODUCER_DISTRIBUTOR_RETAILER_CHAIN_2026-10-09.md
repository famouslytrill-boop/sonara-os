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
