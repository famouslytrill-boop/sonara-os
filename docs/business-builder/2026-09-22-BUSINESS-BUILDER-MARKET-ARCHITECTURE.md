# Business Builder — 2026 Market Architecture and Product Expansion

**Research snapshot:** 2026-09-22  
**Scope:** Business Builder only. Creator Studio and Growth Studio remain connected products, not feature dumping grounds.  
**Authority:** Research and product architecture. This document does not enable providers, grant agent authority, move money, modify customer records, or override release/security gates.

## Executive conclusion

Business Builder should become a **small-business operating layer**, not a collection of unrelated mini-apps.

The strongest current products converge on a small number of deeply connected operating loops:

1. lead or enquiry -> customer
2. offer/catalog -> quote, order or booking
3. quote/order -> scheduled job or fulfillment
4. job/fulfillment -> invoice or payment
5. payment -> reconciliation and reporting
6. inventory -> procurement and reorder
7. schedule -> time -> labor cost
8. completed work -> review, retention and follow-up

Odoo, Zoho One, Dynamics 365 Business Central, HubSpot, Square, Toast and ServiceTitan differ by market, but the reusable lesson is the same: the value comes from **one record becoming the next record without re-entry**.

SONARA should therefore expand by strengthening a shared operating spine and composing vertical packs over it. It should not fork the product into a separate codebase for every trade.

## Current Business Builder strengths already in the repository

The current runtime already contains useful primitives:

- customers and enquiries
- quotes, invoices, receivables and payment-state handling
- bookings and calendar export
- staff, schedules, time entries and tasks
- inventory, vendors, purchase operations and stock counts
- recipes, menu items, food cost and restaurant operating records
- locations, vehicles and maintenance
- accounting exports and account portability
- deterministic planning/formula tools
- market intelligence and scored opportunities
- business vertical starter templates
- organization/tenant boundaries and paid entitlements

These should be treated as the canonical starting blocks. New work should reuse them before creating new tables or parallel workflows.

## 2026 competitor patterns to copy structurally, not cosmetically

### Odoo and Zoho One — unified suite pattern

Both products demonstrate the value of a broad suite sharing business data across CRM, finance, sales, inventory, projects, support and operations.

**SONARA implication:** keep one customer, one organization, one catalog, one transaction lineage and one audit/evidence spine. A vertical pack should change defaults, terminology, dashboards and workflows, not duplicate the underlying customer or payment model.

Sources:
- https://www.odoo.com/page/all-apps
- https://www.zoho.com/one/

### Microsoft Dynamics 365 Business Central — ERP depth pattern

Business Central connects finance, sales, purchasing, inventory, projects, service and supply-chain operations.

**SONARA implication:** Business Builder needs stronger record transitions and reconciliation before it needs more isolated feature pages. The source record and resulting record should stay linked: quote -> order/job -> invoice -> payment -> export/report.

Source:
- https://www.microsoft.com/en-us/dynamics-365/products/business-central

### HubSpot — customer-system pattern

HubSpot’s advantage is a shared CRM layer feeding sales, service, marketing, content, data and commerce.

**SONARA implication:** customer identity and timeline must be reusable by Business Builder and Growth Studio without copying customer truth into two incompatible stores.

Source:
- https://www.hubspot.com/products/crm

### Square — commerce and local-business pattern

Square connects in-person/online payments with POS, appointments, invoices, staff, customer records, loyalty and reporting.

**SONARA implication:** treat POS as a commerce surface over canonical catalog, order, payment, customer and inventory records. Do not build a second disconnected POS database.

Source:
- https://squareup.com/us/en

### Toast — restaurant operating-system pattern

Toast ties restaurant POS and payments to ordering, menus, labor, scheduling and back-office operations.

**SONARA implication:** SONARA’s existing menu, recipe, inventory, labor and daily-profit records should converge into one restaurant pack with one daily operating dashboard and exception queue.

Source:
- https://pos.toasttab.com/

### ServiceTitan — field-service operating-chain pattern

ServiceTitan makes the service lifecycle explicit: lead generation, booking, dispatch, job performance, invoice/payment and back-office operations.

**SONARA implication:** trades, HVAC, electrical, plumbing, carpentry, cleaning and similar businesses should share a field-service pack rather than receive separate products.

Source:
- https://www.servicetitan.com/

### Stripe — regulated commerce infrastructure pattern

Stripe exposes online payments, subscriptions, platform/marketplace payments, in-person Terminal, tax and fraud tooling through provider APIs.

**SONARA implication:** SONARA should own business workflow, approval, entitlement and reconciliation state while leaving card credentials, acquiring, payout rails and regulated payment infrastructure to providers.

Sources:
- https://docs.stripe.com/connect
- https://docs.stripe.com/billing
- https://docs.stripe.com/terminal
- https://docs.stripe.com/tax
- https://docs.stripe.com/radar

## Target Business Builder architecture

### Layer 1 — shared business primitives

Canonical reusable entities:

- organization and membership
- roles and permissions
- locations
- customers and contacts
- leads/enquiries
- products and services
- pricebooks and packages
- quotes/estimates
- bookings/appointments
- orders and jobs/work orders
- invoices and receivables
- confirmed payments/refunds
- inventory and stock movements
- vendors and purchase orders
- staff, shifts and time entries
- assets, vehicles and maintenance
- documents/evidence/exports
- notifications and tasks
- audit events and workflow state

No vertical pack should create a duplicate customer, invoice or payment truth.

### Layer 2 — vertical packs

Build packs as terminology + defaults + forms + dashboards + formulas + workflow templates over shared primitives.

Priority packs:

1. restaurant / food / catering
2. trades / HVAC / electrical / plumbing / carpentry / field service
3. cleaning / facilities / recurring service
4. retail / store / ecommerce
5. fleet / trucking / delivery / waste
6. professional services / consulting / agency
7. property / rental / real-estate operations
8. events / venues / hire
9. memberships / subscriptions / gyms / clubs
10. light manufacturing / production / maintenance

Specialist regulated systems remain integrations where appropriate.

### Layer 3 — provider adapters

Use adapters for capabilities where a specialist ecosystem is safer or changes faster:

- payments, payouts and banking
- tax calculation/filing
- payroll filing
- accounting systems
- calendars
- email/SMS/voice
- maps/geocoding/routing
- telematics
- ecommerce marketplaces
- identity/federation
- social publishing
- analytics/data warehouse
- industrial/robot controls

Every adapter needs explicit readiness, authentication, permission scope, rate limits, retries, idempotency, observability, revocation and failure states.

## Deterministic workflow and agent architecture

### Deterministic authority

These operations must remain deterministic and policy-checked:

- authentication and authorization
- tenant selection
- entitlements
- monetary arithmetic
- booking/job/order state transitions
- inventory mutations
- invoice/payment/refund state
- permission changes
- audit/evidence writes
- provider idempotency keys
- retry/dead-letter transitions

### Appropriate model/agent work

Models may help with:

- classifying enquiries
- extracting structured fields from approved documents
- summarizing customer or operational history
- drafting quotes/messages/documents
- ranking next steps
- explaining anomalies
- planning a multi-step workflow
- proposing actions for approval
- natural-language retrieval over authorized business data

A model proposal is not execution authority.

### Approval boundary

Require an explicit human or policy approval for:

- outbound customer communications when not pre-authorized
- refunds and payouts
- external purchases
- destructive operations
- publishing
- high-impact permission changes
- legal/policy acknowledgements
- actions with unusually high financial or operational blast radius

### Durable workflow requirements

Long-running workflows need:

- explicit versioned state
- idempotency
- retry classification
- exponential backoff
- deadlines/timeouts
- dead-letter handling
- compensation/rollback where possible
- concurrency control
- human-wait states
- exact actor/tenant/tool identity
- correlated traces and business outcome metrics

Reference systems:
- Temporal durable execution: https://docs.temporal.io/
- LangGraph stateful agent orchestration: https://docs.langchain.com/oss/javascript/langgraph/overview
- OpenFeature feature-flag standard: https://openfeature.dev/
- OpenTelemetry observability: https://opentelemetry.io/

These are references until license, operational fit, security and deployment ownership are reviewed.

## RAG and business knowledge

RAG is useful only if retrieval preserves business authorization.

Required contract:

- organization filter on every retrieval
- document/record ACL propagation
- source identity and provenance
- source citations in generated answers
- freshness/staleness metadata
- retrieval trace and evaluation
- PII minimization
- secret exclusion
- deletion/retention propagation
- no silent model write-back

For SONARA’s existing Postgres/Supabase direction, pgvector is a reasonable candidate to evaluate for vector similarity because it keeps retrieval near relational tenant data. It is not authorization by itself; RLS/ACL checks still govern what may be retrieved.

Reference:
- https://github.com/pgvector/pgvector

## Analytics and deterministic formulas

Business Builder should expose formulas as transparent calculations with named inputs, period/currency assumptions and null states instead of generated guesses.

Existing formula infrastructure already covers revenue, margin, food cost, prime cost, break-even, labor, inventory turnover, reorder point, route cost, delivery profit, CAC/LTV and related measures.

High-value next metrics to validate against existing tables before adding:

- quote/estimate win rate
- lead-to-booking rate
- schedule utilization
- job completion cycle time
- days sales outstanding / receivables age
- payment collection rate
- inventory shrink/waste rate
- vendor lead-time reliability
- recurring-service renewal/retention rate
- technician/crew utilization
- gross profit per job/order/location
- contribution margin per service/product
- refund/chargeback rate
- first-response and resolution time
- workflow exception/retry/dead-letter rate

Every metric must define numerator, denominator, period, source tables, missing-data behavior and whether it is accounting-grade or decision-support only.

## POS, kiosk and commerce

Do not build POS as a separate application database.

Target flow:

catalog -> cart/order -> tax/discount -> payment intent -> provider confirmation -> order settlement -> inventory movement -> receipt -> customer history -> daily reconciliation.

Kiosk should be a constrained front end over the same order/catalog/payment contracts.

Offline payment behavior must follow provider-specific rules and must never invent success while a payment is unconfirmed.

## Mobile, device and field work

Field-heavy packs need:

- large touch targets
- fast low-bandwidth screens
- offline-safe drafts where supported
- camera/barcode/QR only after explicit permission
- location only for clear user-approved job/route use
- visible sync state
- conflict handling
- no hidden tracking
- accessible keyboard/screen-reader/reflow behavior

Existing device/location/voice schemas remain inert until explicit consent flows and runtime contracts are proven.

## Security and governance

Business Builder should standardize:

- least privilege and tenant isolation
- passkeys/step-up authentication where supported
- server-side provider secrets
- scoped tool grants
- immutable or tamper-evident audit evidence where appropriate
- data export and deletion workflows
- rate limits and abuse controls
- dependency/SAST/secret scanning
- feature flags and one-tenant canaries
- rollback evidence
- GenAI/tool observability without logging secrets or raw sensitive content

Agent-specific risks include prompt injection, tool abuse, privilege escalation, memory poisoning, exfiltration, approval bypass and denial-of-wallet. Treat external content as untrusted input.

Reference:
- https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html

## What not to build as native substitutes

Do not claim Business Builder replaces:

- licensed accounting or tax filing systems
- banks or payment networks
- payroll filing/compliance platforms
- specialist CAD/CAE/CAM
- safety-critical industrial controls or robot controllers
- carrier-grade telematics hardware
- government identity/benefit/records systems
- unrestricted social networks, streaming networks or game engines

Integrate these domains through explicit adapters when there is a real customer workflow and provider agreement.

## Implementation sequence

### P0 — operating truth

1. keep exact-SHA CI/security/release gates green
2. keep pricing, entitlements, catalog and public copy synchronized
3. verify tenant/RLS boundaries for every Business Builder write
4. map every visible Business Builder action to a real read/write/calculate/export/report operation
5. standardize lead/customer/catalog/quote/booking-order-job/invoice/payment linkages
6. instrument workflow/business outcomes and failure states

### P1 — reusable operating engine

7. define versioned deterministic workflow contracts
8. add idempotent command boundaries and event/outbox evidence
9. add retries/backoff/dead-letter/concurrency safety
10. add approval objects for high-impact actions
11. add provider-neutral adapter contracts
12. add organization-scoped RAG evaluation and provenance contract
13. add one-tenant canary controls through feature flags

### P2 — vertical depth

14. deepen restaurant pack
15. deepen field-service/trades + cleaning/facilities pack
16. deepen retail/ecommerce/POS pack
17. deepen fleet/logistics/delivery pack
18. add professional-service and property/rental packs
19. add light-manufacturing operations around work orders, quality, assets and maintenance
20. expand analytics from operational records

### Partner/specialist boundary

21. accounting/tax/payroll providers
22. regulated financial services
23. telematics and industrial hardware
24. public-sector integrations
25. specialist engineering/CAD/robotics platforms

## Repository adoption rule

Do not install repositories simply because they are popular.

Each candidate must have:

- current maintenance evidence
- compatible license and commercial-use posture
- security review
- privacy/data-flow review
- tenant-boundary fit
- operational ownership and upgrade plan
- rollback/uninstall path
- measurable product gap it closes
- an implementation owner
- no overlap with an already proven internal primitive

Research references never become production authority automatically.

## Success definition

Business Builder is materially stronger when a small operator can move from enquiry to completed work and reconciled payment without retyping core data, while every automation is observable, every cross-tenant boundary is enforced, every risky action has explicit authority, and every vertical pack remains a composition of shared primitives rather than a new silo.
