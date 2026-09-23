# SONARA Commerce + Omnichannel Market Advancement — 2026-09-22

## Decision

SONARA should build a **Canonical Commerce Graph** inside Business Builder and shared Nexus services, then expose it through owned storefront, POS, kiosk, B2B, social/marketplace, fulfillment and agentic-commerce adapters.

Do **not** build separate order, customer, inventory or pricing systems for every channel.

The customer-facing model should be:

```text
one merchant
→ one catalog
→ one inventory truth
→ one customer/company graph
→ one cart/checkout contract
→ one order lifecycle
→ one fulfillment/return/refund lifecycle
→ many controlled sales channels
```

This document is research and architecture only. It installs nothing, activates no provider, captures no payment, changes no production secret, runs no migration, publishes no product feed and grants no agent spending authority.

Machine-readable companion: `lib/commerce-market-radar-2026.cjs`.

## Why this matters now

The U.S. Census Bureau reported seasonally adjusted ecommerce sales of $340.2B in Q2 2026, representing 17.1% of total retail sales. Ecommerce is large and still growing, but it is not the entire market.

NRF/IBM's 2026 consumer work found that physical stores remain heavily used while AI-assisted shopping is expanding. SONARA therefore needs **converged commerce**, not an online-only store builder.

### Market direction

The current leaders converge on the same architectural pattern:

- Shopify: unified customer/order/inventory state across ecommerce, retail and B2B.
- Square: SMB POS + payments + inventory + purchase orders + customer/loyalty + online selling.
- Toast: restaurant POS + kiosk + KDS + QR ordering + online ordering + retail hybrid.
- Lightspeed: multi-location POS + inventory + suppliers + transfers + landed cost + forecasting + ecommerce.
- Amazon Buy with Prime: merchant-owned storefront with external checkout/fulfillment capability.
- Google UCP: open agentic-commerce primitives designed for business/payment interoperability.
- OpenAI ACP: merchant-owned order, payment, fulfillment, return and support lifecycle exposed to an AI shopping surface.
- Visa/Mastercard/Stripe: emerging identity, intent, token, policy and machine-payment infrastructure for agents.
- GS1 Digital Link: physical-product identity moving toward richer 2D barcode use cases at POS and across the supply chain.

Sources:
- https://www.census.gov/retail/ecommerce.html
- https://nrf.com/research/own-the-agentic-commerce-experience
- https://www.shopify.com/blog/unified-commerce
- https://squareup.com/us/en/retail
- https://pos.toasttab.com/products/point-of-sale
- https://www.lightspeedhq.com/pos/retail/inventory-management-software/
- https://buywithprime.amazon.com/
- https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/
- https://openai.com/index/buy-it-in-chatgpt/
- https://www.visa.com/en-us/solutions/intelligent-commerce
- https://www.mastercard.com/us/en/news-and-trends/press/2026/september/mastercard-gives-merchants-a-simpler-way-to-build--connect-and-s.html
- https://stripe.com/blog/machine-payments-protocol
- https://www.gs1us.org/industries-and-insights/gs1-digital-link/for-retailers

## Canonical Commerce Graph

### Merchant + channel

- organization / tenant
- merchant profile
- brand
- sales channel
- physical location
- warehouse
- register
- kiosk/device
- staff/cashier session
- opening/closing state
- receipt sequence
- evidence event

### Customer + B2B

- customer
- addresses
- consent
- customer segment
- loyalty account
- gift-card reference
- company account
- company buyer
- price list
- payment terms
- quantity rules
- tax-exemption evidence where applicable

### Catalog

- catalog
- product
- variant
- bundle/composite product
- modifier/options
- unit of measure
- SKU
- GTIN
- PLU
- barcode identities
- lot/serial references
- GS1 Digital Link reference
- images/media
- channel visibility
- lifecycle state

### Pricing

- base price
- price list
- location price
- B2B price
- scheduled price
- promotion
- coupon
- automatic discount
- employee/manual override
- tax reference
- service charge
- tip
- store credit

Price changes must preserve actor, reason, effective period and evidence.

### Inventory

Use explicit stock movements, never an unexplained integer overwrite.

```text
supplier receipt
transfer in/out
sale
return
damage
theft/loss
cycle-count correction
production/assembly
reservation
reservation release
fulfillment
cancellation
```

Core inventory state:

- on hand
- reserved
- safety stock
- blocked/quarantined
- available to promise
- incoming
- in transfer
- committed to supplier/customer
- unit cost
- landed cost
- aging
- last count
- count confidence

Internal formula:

```text
available_to_promise = max(0, on_hand - reserved - safety_stock - blocked)
```

This is a deterministic system formula, not an AI prediction.

### Procurement

- supplier
- supplier item
- supplier price
- purchase order
- PO line
- partial receipt
- expected date
- backorder
- landed-cost components
- supplier return
- reorder recommendation
- approval threshold

AI may recommend. A deterministic command and configured approval policy submits the commitment.

### Cart + checkout

Cart must support:

- anonymous or identified customer
- channel + location
- currency
- product/variant/modifier lines
- price snapshot
- discount snapshot
- tax estimate/reference
- fulfillment choice
- pickup/delivery/shipping
- inventory availability
- policy disclosure
- idempotency key
- expiry

Checkout is not an order until the merchant's deterministic order command accepts it.

### Order lifecycle

Recommended state family:

```text
draft
→ pending_validation
→ accepted
→ payment_pending / payment_authorized
→ fulfillment_pending
→ partially_fulfilled
→ fulfilled
→ completed
```

Compensation states:

```text
cancel_requested
cancelled
return_requested
partially_returned
returned
refund_pending
partially_refunded
refunded
disputed
```

Do not collapse payment, fulfillment and order state into one status string.

### Fulfillment

Support:

- ship from warehouse
- ship from store
- BOPIS / click-and-collect
- curbside
- local delivery
- restaurant dine-in / takeout
- kitchen routing
- digital fulfillment
- service/job-linked fulfillment

Every fulfillment should carry location, handler, timestamps, item quantities and evidence.

### Returns + exchanges

NRF estimated $849.9B in U.S. retail returns for 2025 and a 19.3% online return rate. Returns therefore belong in the core model.

Required objects:

- return authorization
- policy snapshot
- reason
- line-level quantity
- inspection/disposition
- restock decision
- exchange
- refund reference
- fraud/risk evidence
- shipping/drop-off method
- customer communication evidence

Source:
https://nrf.com/research/2025-retail-returns-landscape

## POS

The staff POS should be a fast channel over the same commerce graph.

Required:

- product search
- barcode scan
- PLU lookup
- weighed quantity
- favorites/speed keys
- cart
- customer attach
- discounts with permission
- tax/service charge
- tender handoff
- receipt
- return/exchange
- offline/degraded state
- shift/register identity
- accessibility
- keyboard/scanner-first workflows

Do not let POS invent a second catalog or second inventory balance.

## Kiosk

Kiosk is a constrained self-service channel.

Required:

- large touch targets
- clear start/reset
- browse/search
- modifiers
- cart
- upsell rules
- loyalty/customer opt-in
- accessibility and assistance path
- dine-in/takeout/pickup mode where applicable
- tender handoff
- receipt/order number
- timeout and privacy reset
- offline/degraded state

Toast's 2026 kiosk materials reinforce the need for direct POS/kitchen integration and offline continuity.

## Owned storefront

The merchant-owned storefront should support:

- product/category pages
- search/filter
- variant availability
- rich media
- SEO/schema
- cart
- checkout handoff
- guest + account flows
- pickup/delivery/shipping
- order status
- cancellation where allowed
- return initiation
- subscriptions/memberships where applicable
- accessibility
- mobile-first performance
- localization
- consent-aware analytics

Creator Studio should be able to provide product media and campaign assets.
Growth Studio should be able to publish approved campaigns and measure acquisition.
Business Builder owns the transaction and operational lifecycle.

## B2B

Shopify's 2026 direction is a useful market signal: wholesale and DTC increasingly share the same platform.

SONARA B2B extensions:

- company account
- multiple buyers
- role/approval limits
- custom catalogs
- price lists
- volume breaks
- minimum/maximum quantity
- payment terms
- quote-to-order
- PO number
- tax exemption evidence
- net terms through approved partner boundaries
- reorder lists
- account-specific history

## Agentic commerce

### Protocol position

Do not choose one winner and hardwire SONARA to it.

Create reviewed adapters for:

- Google Universal Commerce Protocol
- OpenAI Agentic Commerce Protocol
- MCP commerce tools where appropriate
- payment-network delegated-intent standards
- future retailer/marketplace agent interfaces

### Authority boundary

Agent can safely:

- search catalog
- compare items
- read scoped availability
- assemble a draft cart
- explain policy
- recommend reorder
- draft a PO
- classify a return request

Deterministic commerce commands must control:

- inventory reservation
- order acceptance
- price mutation
- exceptional discount
- refund
- purchase-order submission
- inventory transfer
- external publication

Explicit human or configured policy authorization is required for spend and other high-impact mutations.

Never place raw card credentials, bank credentials or unrestricted payment tokens in model context.

## Physical product identity

Prepare now for 2D barcode expansion.

Model:

```text
product
  ├─ internal_product_id
  ├─ SKU
  ├─ GTIN
  ├─ PLU where applicable
  ├─ lot
  ├─ serial
  ├─ UPC/EAN compatibility
  └─ GS1 Digital Link reference
```

GS1 US has a 2027 sunrise goal for broad 2D barcode acceptance at retail POS. The core model should be ready without forcing merchants to adopt it immediately.

## Offline and resilience

POS/kiosk/store operations must not assume perfect internet.

Need:

- local read cache for approved catalog/config
- append-only queued mutations
- client-generated idempotency keys
- explicit pending/offline status
- bounded offline payment behavior delegated to certified provider capability
- conflict detection
- server reconciliation
- duplicate suppression
- operator recovery screen
- audit trail

Never claim offline card authorization if the processor/hardware has not provided it.

## Analytics

Core facts:

- gross sales
- net sales
- COGS
- gross margin
- contribution margin
- units
- average order value
- conversion
- return rate
- refund rate
- sell-through
- inventory turnover
- stockout rate
- shrink
- fulfillment SLA
- purchase-order lead time
- channel economics
- customer repeat rate
- loyalty engagement
- promotion lift with experiment/evidence boundaries

Every metric should declare:

- source
- period
- timezone
- currency
- tax treatment
- return/refund treatment
- units
- confidence/quality where derived

## Own-line / private-label products

For SONARA customers creating their own line:

```text
concept
→ specification
→ supplier/manufacturer
→ sample
→ approved bill of materials/spec
→ purchase order
→ production batch
→ receiving/QA
→ product identity + packaging
→ warehouse/store allocation
→ sell
→ return/feedback
→ demand and margin analysis
→ next production decision
```

Do not attempt to replace specialist CAD, regulated manufacturing control, certified laboratory systems or safety-critical industrial control.

## Vertical composition

The same commerce graph can support:

- retail stores
- restaurant + retail hybrids
- creator merchandise/digital goods
- trades parts and materials
- cleaning/service products
- fleet/trucking supplies
- rentals
- venues
- manufacturing finished goods/spares
- professional services packages

Vertical packs should add workflow semantics without forking customer, catalog, inventory, order, payment or evidence truth.

## Build vs integrate

### SONARA owns

- canonical commerce graph
- tenant-scoped records
- workflow/state machines
- policy/approvals
- UX for owned channels
- cross-channel reconciliation
- analytics/evidence
- provider-neutral adapters
- operator recovery
- agent authority envelope

### Integrate

- payment processors/card networks
- tax engines/filing
- carriers
- marketplaces/social commerce
- banking
- credit underwriting
- certified payment hardware
- specialist ERP/accounting when needed

### Do not rebuild

- card network
- bank
- national/global parcel carrier
- tax authority
- general-purpose marketplace

## 0–30 days

1. Canonical Commerce Graph contract.
2. Reconcile existing product/catalog/order/payment/inventory objects.
3. Inventory position + reservation + movement contract.
4. Cart/checkout/order/fulfillment/return/refund state machines.
5. Channel capability negotiation.
6. POS/kiosk/storefront UX truth-state spec.
7. UCP/ACP/payment-agent adapter research contracts.
8. Deterministic commerce metrics/formulas.
9. Threat model for agentic commerce and delegated payment.
10. Exact-head tests proving research cannot enable runtime execution.

## 30–90 days

1. One owned-storefront canary.
2. One staff-POS canary.
3. One kiosk canary.
4. Supplier + purchase-order + receiving + transfer flow.
5. BOPIS/local delivery/ship-from-store.
6. Returns/exchanges/partial refunds.
7. Customer + loyalty + consent boundaries.
8. Offline queue/reconciliation tests.
9. Multi-location inventory analytics.
10. One-tenant rollout with observability and rollback.

## 90–180 days

1. B2B company accounts and price lists.
2. One marketplace/social adapter.
3. One agentic-commerce adapter after threat model and policy controls.
4. GS1/2D barcode readiness.
5. Advisory forecasting and replenishment.
6. Landed-cost and channel contribution analytics.
7. Provider-neutral fulfillment routing.
8. Vertical commerce packs.

## Release boundary

This research wave does not justify turning commerce mutations on.

Runtime activation remains:

```text
exact branch head
→ full CI/security/release matrix
→ deterministic repair of genuine failures
→ green evidence
→ review
→ merge
→ controlled deployment
→ verify exact live SHA/auth/tenant/RLS/database/catalog/billing/rollback
→ then exactly one isolated commerce canary
```

The strongest first runtime commerce canary after the current Business Builder Work Order lifecycle is proven should be **owned storefront + canonical cart/order lifecycle against existing Stripe/provider boundaries**, not simultaneous POS + kiosk + marketplaces + agents.
