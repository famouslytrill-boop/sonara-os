# POS, Unified Commerce, Storefront, and Brick-and-Mortar Architecture

**Research snapshot:** 2026-09-22  
**Scope:** SONARA Commerce / Business Builder retail and store operations.  
**Authority:** architecture, deterministic operating rules, product requirements, and proof gates.  
**Runtime effect:** none by itself. This plan does not activate a processor, move money, change a database, grant an agent financial authority, or turn research-only software into a supported integration.

## Executive conclusion

SONARA should not build "a web store" and "a POS" as separate products. The target is a **unified commerce operating layer** in which every sales surface uses the same tenant-scoped product, price, customer, order, inventory, payment-reference, fulfillment, return, and audit contracts.

The physical store is one channel and one inventory location in the same operating graph as:

- owned web storefronts;
- mobile/PWA storefronts;
- staff POS;
- self-service kiosks;
- pickup and curbside;
- ship-from-store and warehouse fulfillment;
- approved social/catalog feeds;
- approved marketplace adapters;
- B2B/wholesale portals;
- subscriptions, memberships, services, and mixed carts where the product contract allows them.

The competitive pattern in 2026 is consistent across Shopify, Square, Toast, Odoo, Stripe, Lightspeed, Medusa, Saleor, and similar systems: the moat is not a checkout button. It is synchronized commerce state across channels.

## 2026 market signals

### Unified commerce

Shopify documents one back office spanning online and in-person selling, synchronized inventory, customer profiles, order management, pickup, ship-to-customer, and cross-channel operations.

Square for Retail combines POS, payments, product scanning, inventory counts, low-stock workflows, vendors, purchase orders, refunds/exchanges, and multi-location inventory.

Toast combines POS, kiosk/self-order, loyalty, kitchen routing, restaurant/retail inventory, SKU data, receiving, and reporting.

Odoo combines web/POS commerce with product variants, stock, barcode/GS1 workflows, replenishment, purchasing, and manufacturing.

**SONARA implication:** one canonical commerce model should serve all channels. Channel-specific UI must not create channel-specific truth.

### In-person payment infrastructure

Stripe Terminal supports custom POS applications, readers, Tap to Pay, offline-capable provider flows, refunds, saved payment methods, receipts, and Connect platform patterns.

**SONARA implication:** SONARA owns the order, policy, approval, reconciliation, and audit state. A payment provider owns card credential handling, acquiring, authorization, settlement rails, and provider-specific offline rules.

### Product identity and discovery

GS1 GTINs provide standardized product identity. A UPC-A barcode carries a GTIN-12. Google Merchant Center expects the correct assigned GTIN where one exists and expects distinct variants to use their correct identifiers.

**SONARA implication:** keep SKU, GTIN, barcode symbology, supplier item number, and internal product UUID as separate fields. Never invent a GTIN. A barcode is an encoding of an identifier, not the canonical database key.

### Physical + digital demand

U.S. Census quarterly retail data continues to show a large and growing ecommerce share while the majority of retail still includes physical-world commerce.

**SONARA implication:** brick-and-mortar and ecommerce are complementary channels. Build one inventory and customer operating system rather than optimizing for only one.

## Canonical commerce domain

Before adding more store pages, SONARA should converge on the following tenant-scoped domain.

### Organization, brand, and channel

- organization
- brand
- legal entity reference
- location
- sales channel
- storefront
- register
- kiosk/device
- warehouse/stock location
- fulfillment zone
- currency and locale
- tax configuration reference
- channel availability policy

A business may operate multiple brands and locations, but organization membership, permissions, entitlements, and audit authority remain canonical.

### Catalog and product master

- product
- product variant
- SKU
- GTIN when legitimately assigned
- barcode encoding/symbology
- category/collection
- attributes/options
- units of measure
- package size
- product media
- product status
- channel publication status
- supplier item references
- cost basis
- tax category/code
- age/restriction flags where legally relevant
- lot/serial tracking policy
- recipe/BOM linkage where relevant

Products, services, digital deliverables, memberships, bundles/kits, and made-to-order items can share a catalog contract but must declare fulfillment and inventory semantics explicitly.

### Price and promotion

- pricebook
- channel/location price
- customer/B2B price
- compare-at/reference price where lawful
- time-bounded promotion
- coupon/promotion code
- bundle discount
- quantity/tier pricing
- employee/approved discount
- tax-inclusive vs tax-exclusive display policy

All monetary calculations use integer minor units or another explicit fixed-precision representation. Models do not calculate checkout totals.

### Cart, order, and line state

- cart
- cart line
- quote/estimate where applicable
- order
- order line
- source channel
- pricing snapshot
- tax snapshot
- discount snapshot
- fulfillment state
- payment state
- cancellation reason
- return eligibility
- immutable or append-only state-transition evidence where appropriate

Order state transitions must be deterministic and idempotent.

### Customer, consent, and loyalty

- customer
- contact methods
- addresses
- consent preferences and evidence
- loyalty identifier
- points/reward ledger
- gift/store-credit ledger
- channel/order history
- service/support history
- customer tags/segments
- account/guest distinction

Growth Studio may use consented customer data, but it must not create a second incompatible customer identity system.

### Inventory

- inventory item
- stock location
- on-hand quantity
- allocated/reserved quantity
- safety stock
- available-to-sell quantity
- confirmed inbound quantity
- transfer
- stock movement ledger
- adjustment reason
- cycle count
- physical count
- shrink/overage
- lot/serial/batch where required
- expiration where required
- reorder policy
- supplier lead-time evidence

Inventory mutation is deterministic. An agent may explain or recommend; it does not silently alter stock.

### Procurement

- supplier/vendor
- supplier product
- purchase order
- purchase-order line
- expected receipt
- goods receipt
- discrepancy
- landed-cost inputs
- invoice/document reference
- return-to-vendor
- supplier performance history

The existing SONARA demand-statistics, safety-stock, reorder-point, and EOQ functions should feed procurement recommendations without becoming autonomous purchase authority.

### Fulfillment

- fulfillment request
- fulfillment line
- pick
- pack
- shipment
- carrier/service reference
- pickup reservation
- curbside handoff
- ship-from-store
- warehouse shipment
- delivery proof
- tracking event
- exception
- partial fulfillment/backorder

Allocation and fulfillment must be concurrency-safe so two channels cannot sell the same final unit without an explicit backorder policy.

### Returns, exchanges, and refunds

- return authorization/RMA
- return line
- reason/disposition
- restock/quarantine/damage decision
- exchange linkage
- refund request
- provider refund reference
- store-credit alternative
- original order/payment lineage
- approval evidence

A return and a refund are related but not identical. Inventory disposition should not depend on the refund succeeding, and the refund should not be marked successful before provider confirmation.

### Register and cash operations

- register/session
- opening float
- cash sale/tender movement
- cash in/out reason
- expected drawer amount
- counted drawer amount
- variance
- shift/employee
- closeout
- receipt
- reconciliation evidence

Cash controls need role separation and audit evidence. Agent recommendations must never rewrite a drawer count.

## Own-brand / own-product-line lifecycle

SONARA should support businesses that sell products they design, source, manufacture, private-label, or assemble.

Target lifecycle:

```text
concept
  -> product brief/specification
  -> BOM/recipe/material definition
  -> supplier / contract manufacturer
  -> quote/sample
  -> approved sample
  -> purchase or production order
  -> inbound inspection / QA
  -> landed cost
  -> packaging + label + legitimate product identifiers
  -> inventory receipt
  -> channel launch
  -> sales + return + review evidence
  -> sell-through / margin / stock analysis
  -> replenishment, markdown, revision, or retirement
```

Required records should include:

- product specification and revision;
- BOM/recipe where applicable;
- supplier/manufacturer;
- minimum order quantity and lead time;
- unit, freight, duty, packaging, inspection, and landed-cost components;
- sample approval and quality evidence;
- lot/batch/serial rules where applicable;
- label/artwork/version;
- legitimate GTIN/UPC/EAN reference when assigned;
- compliance/document references where the category requires them;
- warranty/return policy;
- launch channel assortment;
- lifecycle state and retirement/replacement relationship.

SONARA should bridge specialist PLM, CAD, manufacturing, lab, certification, or regulated systems instead of claiming to replace them.

## Sales surfaces

### Owned web storefront

Minimum customer path:

```text
discover/search
  -> product detail
  -> variant/options
  -> availability
  -> cart
  -> delivery/pickup choice
  -> identity/guest
  -> tax/shipping
  -> payment authorization
  -> confirmed order
  -> receipt/status
  -> fulfillment
  -> return/support/reorder
```

Required quality:

- mobile-first and keyboard accessible;
- structured product metadata;
- server-authoritative price and inventory;
- canonical product URLs and SEO;
- image optimization and accessible alternatives;
- clear shipping/return/subscription terms;
- no false scarcity or fabricated inventory;
- clear setup/error/empty states;
- performance budgets and Core Web Vitals evidence.

### Staff POS

POS is a channel over the canonical order contract. It needs:

- barcode/GTIN/SKU search;
- customer lookup;
- cart and held carts;
- discounts with role policy;
- tax;
- tender selection;
- provider payment status;
- returns/exchanges;
- receipts;
- staff attribution;
- inventory effects;
- shift/register reconciliation;
- resilient setup and provider-degraded states.

### Self-service kiosk

Kiosk uses the same product/order/payment contracts with a narrower authority surface:

- large touch targets and accessible interaction;
- kiosk-safe authentication/device binding;
- restricted navigation;
- product/modifier selection;
- order status;
- loyalty identification where appropriate;
- provider-hosted or approved payment UX;
- receipt/order number;
- staff-assistance path;
- automatic session reset and privacy cleanup.

### Social, search, and marketplace feeds

Use explicit adapters for product publication and order intake. Normalize:

- product identity;
- variant identity;
- price;
- inventory/availability;
- media;
- destination URL;
- policy/restriction flags;
- channel status;
- order/source attribution.

Do not treat third-party catalog presence as proof that SONARA owns the transaction or customer relationship.

## Omnichannel workflows SONARA must prove

### Buy online, pick up in store

```text
online order
  -> location eligibility
  -> atomic stock reservation
  -> provider-confirmed payment state
  -> pick task
  -> ready notification
  -> verified handoff
  -> reservation release / inventory settlement
```

### Buy online, return in store

```text
original order lookup
  -> eligibility
  -> item condition/disposition
  -> return record
  -> inventory quarantine/restock decision
  -> refund approval
  -> provider refund confirmation
  -> customer receipt
  -> reconciliation
```

### Endless aisle / buy in store, ship to customer

A store employee can sell an item not stocked locally only after the system proves another eligible fulfillment location or supplier path. Never decrement a location that did not fulfill the item.

### Ship from store

Routing should consider available-to-sell inventory, promised service level, pick capacity, distance/carrier cost, store reserve/safety stock, and split-shipment cost. Optimization may recommend; the fulfillment transition remains deterministic.

### Offline / degraded operation

- distinguish app offline from payment-terminal offline;
- queue only operations safe to queue;
- assign idempotency keys before retry;
- surface unresolved payment/stock state visibly;
- reconcile when connectivity returns;
- never display an unconfirmed processor authorization as final success;
- never let two offline devices assume the same scarce stock without a documented conflict policy.

## Deterministic retail metrics

The formulas below are decision-support calculations over explicit source data.

### Available to sell

```text
raw_available = on_hand - allocated - safety_stock
available_to_sell = max(0, raw_available)
```

Confirmed inbound can be displayed as projected availability but is not on-hand stock.

### Sell-through

```text
sell_through = units_sold / (starting_units + received_units)
```

The period and treatment of returns/transfers must be stated.

### Inventory turnover

```text
average_inventory_cost = (beginning_inventory_cost + ending_inventory_cost) / 2
inventory_turnover = COGS / average_inventory_cost
```

### Days inventory on hand

```text
DIOH = average_inventory_cost / COGS * period_days
```

### Gross margin return on inventory

```text
GMROI = gross_margin / average_inventory_cost
```

### Stock variance

```text
variance_units = counted_units - book_units
shrink_units = book_units - counted_units
variance_rate = (counted_units - book_units) / book_units
```

A negative variance is shrink; a positive variance is overage. A zero book denominator must not produce a fake percentage.

### Weeks of supply

```text
weeks_of_supply = available_units / average_weekly_demand
```

The repository's existing statistical safety-stock and reorder-point functions remain authoritative for demand variability and service-level buffering.

## Agentic AI boundary

### Good uses

Agents/models may:

- draft product titles/descriptions from approved product facts;
- classify products into candidate categories;
- suggest merchandising;
- summarize reviews/support themes;
- explain slow/fast movers;
- propose replenishment quantities using deterministic formula outputs;
- flag likely stock anomalies;
- recommend markdown candidates;
- draft supplier/customer messages;
- propose store labor or campaign actions;
- answer tenant-scoped RAG questions with provenance;
- propose fulfillment exception resolutions.

### Deterministic or human-authorized operations

Models do not directly own:

- price arithmetic;
- tax arithmetic;
- payment/refund/payout state;
- inventory decrements/reservations;
- order settlement;
- customer consent;
- role changes;
- external purchases;
- product recall/compliance decisions;
- destructive bulk edits;
- cash reconciliation.

Consequential actions pass through structured proposals, schema validation, policy/authority classification, approval where required, idempotent execution, and audit evidence.

## Payment, tax, and regulated boundary

SONARA should minimize PCI scope:

- raw card data stays in provider-controlled SDKs/readers/hosted fields;
- SONARA stores provider customer/payment/intent/refund references and reconciled state, not PAN/CVC;
- webhooks require signature verification and replay protection;
- all financial mutation endpoints require idempotency;
- refunds/payouts remain approval-gated;
- provider success is authoritative for processor state;
- tax calculation/registration/filing capabilities stay provider- or specialist-backed unless separately validated.

Stripe Terminal, Connect, Billing, Tax, and Radar are appropriate integration candidates where they match the customer's account and workflow. Square/Toast/other processors remain adapters, not simulated compatibility claims.

## Brick-and-mortar operating blueprint

A physical store launch requires more than a POS screen.

### Site and operations

- location record and hours;
- local tax/permit/legal checklist owned by the business;
- staff roles and least privilege;
- receiving/backroom/storage layout;
- stock location/bin model;
- cycle-count cadence;
- cash policy;
- return/exchange policy;
- pickup area and handoff procedure;
- accessibility and customer-assistance process;
- incident/escalation process.

### Hardware

Treat hardware as a managed peripheral/adaptor layer:

- payment terminal;
- receipt printer;
- barcode scanner;
- cash drawer;
- customer display;
- label printer;
- optional scale;
- optional kiosk;
- optional handheld inventory device;
- network/router and backup connectivity;
- UPS where justified.

Hardware compatibility must be proven per provider/device combination. Do not advertise generic hardware support from a research list.

### Day-open / day-close workflows

Open:
- authenticate staff;
- verify register/device health;
- confirm catalog sync;
- confirm pricebook/tax state;
- confirm payment-provider readiness;
- confirm stock sync;
- count opening cash if used;
- record exceptions before first sale.

Close:
- stop/transfer unresolved carts;
- reconcile tenders against provider totals;
- count cash;
- record variance;
- review refunds/voids/discount exceptions;
- review stock exceptions;
- confirm pending/offline transactions;
- produce shift/location closeout;
- retain audit evidence.

## Storefront UX and accessibility

Use WCAG 2.2 as the accessibility baseline. Core commerce screens should specifically prove:

- visible keyboard focus;
- keyboard-complete checkout/POS management surfaces where applicable;
- minimum target-size/spacing behavior;
- screen-reader names and status announcements;
- error identification and recovery;
- 200% zoom/reflow;
- accessible product media and form labels;
- no color-only inventory/payment/error state;
- kiosk touch sizing above minimums where practical.

For high-frequency staff POS, optimize scan/tap paths without hiding approval or reconciliation evidence.

## Data, RAG, analytics, and privacy

Commerce RAG must preserve tenant and record authorization:

- organization/location filters;
- source provenance;
- current-vs-stale inventory timestamp;
- document/record ACLs;
- deletion/retention propagation;
- no secret/card-data ingestion;
- no silent model write-back.

Analytics should be event- and ledger-grounded:

- conversion;
- average order value;
- gross margin;
- sell-through;
- inventory turnover;
- weeks of supply;
- shrink/variance;
- return/refund rate;
- stockout/cancel rate;
- fulfillment cycle time;
- pickup readiness time;
- on-time fulfillment;
- repeat customer rate;
- loyalty adoption;
- channel contribution;
- discount rate;
- payment failure;
- chargeback rate;
- labor and contribution margin by location where source data is complete.

Every dashboard metric needs numerator, denominator, period, timezone, currency, source records, missing-data behavior, and reconciliation status.

## Architecture sequence

### P0 — canonical commerce truth

1. map existing customer/catalog/inventory/order/invoice/payment/location/vendor tables before creating new schema;
2. define canonical product/variant/SKU/GTIN/channel/location contracts;
3. define order/payment/fulfillment/return state machines;
4. define stock movement + reservation semantics;
5. define register/shift reconciliation contract;
6. add commerce metrics as deterministic tested functions;
7. instrument business events without inventing adoption numbers.

### P1 — sell through owned channels

8. owned storefront over canonical catalog;
9. cart/checkout using server-authoritative price/inventory;
10. one payment-provider web flow;
11. order status, receipts, customer history;
12. one-location inventory and fulfillment;
13. returns/refund approval;
14. accessibility/mobile/performance proof.

### P2 — physical store canary

15. one location;
16. one approved terminal/device set;
17. barcode/SKU lookup;
18. POS cart/order;
19. provider-confirmed payment;
20. receipt;
21. deterministic inventory movement;
22. register closeout;
23. refund/return;
24. one-tenant/location canary with rollback.

### P3 — omnichannel

25. BOPIS;
26. buy in store/ship to customer;
27. cross-channel return;
28. transfers and multi-location replenishment;
29. ship-from-store;
30. loyalty/store credit;
31. Google Merchant/local-product feed;
32. approved social/marketplace adapters.

### P4 — own-line and supply chain depth

33. product specification/revision;
34. BOM/recipe/kit;
35. sampling/QA;
36. supplier/manufacturer scorecards;
37. landed cost;
38. purchasing/receiving;
39. lot/serial/expiry where required;
40. light production/work orders;
41. recall/quarantine evidence where appropriate;
42. forecasting and constrained replenishment recommendations.

### P5 — scale and ecosystem

43. connector SDK/manifests;
44. partner sandbox;
45. additional payment/POS/ERP/accounting/3PL adapters;
46. load/spike/soak testing;
47. per-tenant and per-location resource budgets;
48. offline conflict drills;
49. multi-region/provider resilience only after measured need;
50. publish only verified integration and reliability evidence.

## Open-source and external-software posture

Existing research on Medusa, Saleor, Vendure, Odoo, ERPNext, Bagisto, and other commerce systems remains **reference/research material** unless each candidate passes SONARA's repository-intake, licence, security, tenant-fit, operations, upgrade, rollback, and product-gap requirements.

Preferred rule:

1. reuse SONARA's proven primitive when it already exists;
2. use provider APIs/adapters for regulated or specialist capabilities;
3. adopt an external component only when it closes a measured gap better than maintaining the equivalent capability internally;
4. pin versions and preserve provenance/licensing;
5. canary before customer activation;
6. never count a researched repository as an installed or supported SONARA feature.

## Proof gates before claiming "unified commerce"

SONARA should not use that claim as a production fact until there is dated evidence for:

- one canonical product/variant identity across web and POS;
- one customer identity/history across channels;
- atomic or otherwise proven inventory reservation under concurrency;
- provider-confirmed online and in-person payment paths;
- idempotent payment/order/stock mutations;
- multi-location inventory reconciliation;
- BOPIS happy path and cancellation/expiry path;
- cross-channel return/refund reconciliation;
- register/tender closeout;
- offline/degraded-state reconciliation;
- barcode/GTIN validation;
- tax configuration/provider proof;
- accessible storefront/POS/kiosk paths;
- tenant/location isolation;
- audit evidence and rollback;
- one-tenant/one-location canary before expansion.

## Reference sources

- U.S. Census Quarterly Retail E-Commerce Sales, 2026: https://www.census.gov/retail/ecommerce.html
- Shopify unified commerce / POS: https://www.shopify.com/pos
- Shopify developer platform / Storefront APIs: https://shopify.dev/
- Square for Retail: https://squareup.com/us/en/point-of-sale/retail
- Toast POS / retail: https://pos.toasttab.com/
- Stripe Terminal: https://docs.stripe.com/terminal
- Stripe Connect: https://docs.stripe.com/connect
- Stripe Tax: https://docs.stripe.com/tax
- Odoo POS: https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale.html
- Odoo Inventory: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory.html
- GS1 GTIN: https://www.gs1.org/standards/id-keys/gtin
- Google Merchant product data specification: https://support.google.com/merchants/answer/7052112
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Medusa commerce modules: https://docs.medusajs.com/resources/commerce-modules
- Saleor core concepts: https://docs.saleor.io/developer/
- Lightspeed Retail: https://www.lightspeedhq.com/pos/retail/
