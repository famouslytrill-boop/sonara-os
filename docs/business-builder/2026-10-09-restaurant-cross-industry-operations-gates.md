# SONARA Business Builder: restaurant and cross-industry operation gates

Engineering pass: October 9, 2026. Status: **feature branch, not deployed, not compliance-certified**.

## Shipped to this feature branch

- Read-only, deterministic catering estimator: bounded integer cents, BigInt interim
  arithmetic, capped guests and 25 menu lines, individual menu yields and stock
  gaps, operating costs, user-entered service charge/tax, proposed deposit.
- Authenticated owner route GET /business-builder/owner/catering; HTML form POST
  /business-builder/owner/catering/estimate; owner-scoped JSON POST
  /api/business/catering/estimate. Integrated into existing manager middleware
  and /business-builder/owner/operations navigation.
- Authenticated business owner page GET/POST /business-builder/owner/financial-scenarios
  for transaction-cost and nonprofit disclosure planning, with no provider
  checkout, funds movement, securities trading or tax-deductibility claim.
- Owner-scoped JSON read-only scenario APIs:
  POST /api/business/finance/microtransaction-scenario,
  POST /api/business/nonprofits/contribution-review,
  POST /api/business/events/resource-scenario.
  The event engine uses interval sweep-line peak occupancy, detects overlapping
  held reservations and unknown capacity, and explicitly cannot book resources.
- Owner-scoped SEO draft APIs:
  POST /api/business/marketing/restaurant-seo-preview and
  POST /api/business/marketing/event-seo-preview. They use whitelisted fields,
  Google-documented restaurant menu property, HTTPS public URL constraints,
  accurate time/date validation and no fabricated ratings or ticket offers.
  They never publish content or assert Google eligibility or verification.
- Cross-workspace navigation from catering to existing recipes, bookings, staff
  schedules, Growth Studio events and Creator Studio.
- No database migration, stock reservation, payment collection, automatic
  emails, booking, tax certification or external provider activity.
- An absent stock quantity or venue capacity is unknown, not zero. All estimates
  remain draft owner reviews, including when all numeric inputs appear valid.

## October 9 follow-up: canonical quote handoff and security hardening

- Reused the existing public.quotes table and its existing manager-only POST
  /api/business/quotes rather than creating a duplicate catering quote table.
  Following an estimate, the owner may explicitly press "Save draft quote
  summary". Until that POST succeeds, nothing is saved. Only a title, a total
  in integer cents and forced draft state are carried to the existing quote.
- Existing quotes.amount_cents is a PostgreSQL 32-bit integer. The handoff
  refuses nonpositive totals and sums above 2147483647 cents; no truncation or
  monetary overflow is allowed. This is a summary, NOT itemized/versioned
  catering quote persistence. The detailed menu, equipment, tax assumptions
  and provenance must await audited quote-line storage and revision schema.
- Strengthened generic quote creation: unknown client columns/acceptance
  markers removed, status forced to draft, amount format/range validated,
  referenced customer UUID verified against the active organization BEFORE
  the service-role insert. The tenant identity and creator are server-derived.
- Quote acceptance must remain a separate audited actor action before
  work-order/invoice conversion. This branch does NOT enable an agent,
  customer, or visitor to accept quotes, book events, send emails, move stock,
  issue payments, or change payout destinations.
- Added negative tests for forged acceptance, unauthorized customer binding,
  invalid/overflow amounts, explicit owner-save form, and invalid estimate
  refusal. Run full Node24 Mocha and migration contract checks on exact head.

### CI bottleneck observed

GitHub Actions has a significant queued-run backlog, with numerous cancelled
runs and some in-progress runs. Diagnose account runner/billing availability,
concurrency cancellation, and high workflow fan-out before treating a queued
workflow as tested. Do not bypass required checks or merge because a workflow
was merely created. GitHub currently reports main.protected=false; P0 issue
#460 remains blocking. A build cannot be certified until final-commit checks
pass, even when targeted pure-function checks pass.

## Design invariants for the next engineering waves

| Domain | Canonical record lifecycle | Critical verification |
| --- | --- | --- |
| Restaurant | recipe -> versioned menu -> order -> kitchen -> fulfillment | ingredient yield, allergens, food safety |
| Catering | inquiry -> quote -> approval -> venue/crew lock -> delivery -> close | atomic capacity, transport and staffing |
| Finance | order -> payment -> dispute/refund -> settlement -> journal | signed provider event, money reconciliation |
| Microtransactions | intent -> authorization -> processor receipt -> settlement | provider minimums, fees, idempotency, safe cents |
| Logistics | PO -> receipt/lot -> stock -> transfer/waste -> depletion | tenant, units, expiry and supplier evidence |
| Operations | shift -> time log -> approval -> payroll export | overtime and jurisdiction review |
| Events | venue -> date -> guests -> tickets/RSVP -> access | accessible seating, finite capacity, consent |
| Nonprofits | donor -> designation -> receipt -> restricted allocation | actual exemption, benefit and acknowledgment data |
| Commercial/private | location -> permit -> insurance -> service dispatch | locality, review owner, expiration |
| Securities | external provider account -> read-only report | licensed activity review; trading/custody disabled |
| SEO | approved public profile -> Restaurant/LocalBusiness/Event structured data | real public dates, menu, location, URLs |
| Marketing | consent -> approved content -> delivery -> attribution | unsubscribe, no fabricated ratings, user approval |

## Recommended data architecture

Reconcile the existing recipe, menu, vendor, accounting, invoice, inventory,
employee scheduling, business bookings and order schemas before new migrations.
The restaurant should not receive a parallel customer/ledger database.
Every record must carry the trusted server-resolved organization scope, audited
actor, timestamps, version, and applicable business/location IDs. Use distinct
permissions for view, propose, approve, refund, payout change and publication.
Keep public consumer data separate from business staff data.

For ledger events, journal credits and debits must balance in the same currency.
Immutable postings use provider event IDs and tenant-scoped idempotency.
Refunds, chargebacks and reversals are compensating entries, never overwritten
history. Never equate a requested payment or estimated deposit with cash settled.

Pending provider adapters must declare read/write scope, OAuth lifecycle, key
custody, webhook signature validation, rate limit and backoff, retry
idempotency, provider disconnect, failure telemetry and data deletion.
No live adapter capability is claimed until a real provider/tenant is validated.

For catering and events, calendar records require explicit IANA timezone,
DST ambiguity handling, event revisions and resource locks. All notifications
and marketing sends default off pending user consent. Creator Studio can make
editable menus, invitations and event artwork; Growth Studio publishes SEO
data and marketing only after authorization and accessibility/claims review.

## Required regulatory gates

The FDA issued its 2026 Food Code model, but municipalities/states may adopt
different versions. Restaurant safety controls must use jurisdiction-specific
requirements and verified inspection/workflow evidence; a checklist alone
is not an inspection or health certification.

Tax calculations depend on locality and transaction classification, including
catering, service charge, tips and delivery. The estimator uses an owner-entered
tax amount; it does not determine the applicable tax.

IRS rules distinguish charitable gifts from purchases and establish written
acknowledgment and quid-pro-quo disclosures. Charity status, donor restrictions,
and receipt language require verification; no automatic tax-deductible label.

Operating brokerage, securities-trading or custody services can require SEC
registration and other licensing. Maintain read-only accounting/reference
capabilities until approved regulated-provider contracts and legal reviews exist.
The same principle applies to banking and payment account credentials.

Payment capture and refunds must continue through controlled server-side
provider flows. Do not store primary card numbers or CVV.

## Definition of done before production

- Exact-head targeted tests, full Mocha suite, lint, typecheck, build, route
  registry verification, security audit and client-secret scan pass.
- Authenticated positive tests and unauthorized/other-tenant negative tests.
- Independent accounting verification of quote and settlement math.
- Food operator, safety officer and tax adviser review per launch locality.
- Branch protection required status checks; no auto merge on red CI.
- Migrations only after schema classification/RLS/grants review and rollback
  proof; none required for the first calculation-only slice.
- Real tenant canary with provider credentials supplied and owned by the tenant,
  rollback path and explicit owner approval for sensitive actions.

## Research sources (reviewed October 9, 2026)

- FDA Food Code: https://www.fda.gov/food/retail-food-protection/fda-food-code
- Google Restaurant/LocalBusiness SEO:
  https://developers.google.com/search/docs/appearance/structured-data/local-business
- Google Event SEO:
  https://developers.google.com/search/docs/appearance/structured-data/event
- IRS charitable acknowledgments:
  https://www.irs.gov/charities-non-profits/charitable-organizations/charitable-contributions-written-acknowledgments
- SEC broker/dealers:
  https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/broker-dealers
- Supabase RLS:
  https://supabase.com/docs/guides/database/postgres/row-level-security
- PCI e-commerce security:
  https://blog.pcisecuritystandards.org/new-guidance-coming-for-e-commerce-security-requirements-in-pci-dss-v-4-x
