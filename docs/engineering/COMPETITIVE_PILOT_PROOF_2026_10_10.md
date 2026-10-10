# SONARA competitive pilot: service-business proof contract
**Researched:** 2026-10-10 · **Scope:** draft engineering branch only · **Production activation:** prohibited pending normal release gates.

## Competitive wedge and positioning
Target owner-operated cleaning and property-service businesses of 1–10 people, initially in Columbus, Ohio, as already defined in `lib/sonara-market-focus.cjs`. Keep Business Builder, Creator Studio and Growth Studio available as separate products on SONARA One. Do not claim SONARA already outperforms established incumbents or that infrastructure breadth proves commercial adoption.

### Incumbent baseline — official vendor documentation, not an equivalence assertion
- Jobber: customer requests, online booking, quoting, job scheduling, invoicing, payment acceptance, client portal and reminders — https://www.getjobber.com/features/ and https://www.getjobber.com/pricing/
- Housecall Pro: online booking, scheduling/dispatch, invoicing/payment and customer operations — https://www.housecallpro.com/pricing/
- Square Appointments: bookings/payment processing with plan and per-location differences — https://squareup.com/us/en/appointments/pricing
- Shopify: commerce, checkout, POS and inventory; not a substitute for field-service operations — https://www.shopify.com/pricing
- Zoho One: broad business application suite, seats and integration depth — https://www.zoho.com/one/pricing/

Market pricing and functionality change. Verify the same date, region, billing period, seats, processing fees, transaction charges, add-ons and actual testable functionality before publishing any comparative claim. No universal "cheaper" or "replaces" marketing statement is authorized by this document.

## Competitive baseline: customer job path
Pilot acceptance requires a **real, tenant-safe, mobile-usable operator workflow**:
1. Consented request becomes a lead with correctly scoped customer details.
2. The owner issues a quote, the customer accepts it, and the owner converts it into **one** draft invoice, even under duplicate/replayed requests. Enforce uniqueness and transactionality in the database; an in-memory precheck is insufficient for concurrency.
3. A confirmed booking/job has a staff assignment, completion status and an intelligible customer audit trail.
4. The payment-provider receipt matches the tenant, invoice, amount/currency and idempotency key; unknown or delayed results do not create second charges.
5. The owner may choose to export approved job media and send consented follow-up; no implicit autonomous publishing.
6. A customer can repeat the booking; verified customer data and provider receipts produce measurable commercial outcomes.

Do not equate source modules, schema tables, tests with mocked providers, or a development API route with working customer delivery. Unproven integrations remain labelled unproven.

## Proof measurement added in this draft
`lib/sonara-customer-cohort-proof.cjs` now returns D7, D30 and D60 *product-activity* retention from an authorized, complete cohort export. Denominator for each day N includes **only activated organizations with their full [creation + N days, creation + N + 1 day) window closed** by `asOf`. Numerator has an eligible real product-area event in that window after activation; cross-window use does not count. Rates are `null` if the denominator is zero, not 0%.

New aggregate fields: `matureDay30ActivatedOrganizations`, `day30RetainedOrganizations`, `day30ProductActivityRetentionRate`, `matureDay60ActivatedOrganizations`, `day60RetainedOrganizations`, `day60ProductActivityRetentionRate`. Existing D7 fields and the provider-unverified paid-conversion contract are preserved. `verifiedDay60PayingCustomerRetentionRate` is **always null**: raw activity, even `billing.purchase_completed`, cannot attest subscription settlement, reversal, cancellation or paid D60 retention.

The evaluator remains operator-only, deterministic and non-executing. It does not authenticate the export itself; actual export authorization, closed RLS, complete roster attestation, consistent snapshot and provider reconciliation are separate requirements. Do not expose untrusted client-generated inputs as proof.

## Recommended commercial thresholds (goals, not results)
Maintain the existing pilot's **15 operator interviews, 5 paying pilots, 4 verified retained paying pilots at 60 days** as hypotheses, not achievements. For a valid D60 paid-pilot KPI, use a separately authorized, complete provider-evidenced cohort: verified paid state at cohort entry and D60 (cleared charge/subscription state and reversal status), stable tenant IDs, matched reporting currency/period, complete cancellations and refunds, and an independent reconciliation record. Keep the denominator of enrolled eligible paying pilots, including churned accounts; exclude neither nonresponders nor failed payments without a documented rule.

Track accompanying guardrails: median time-to-first-value, percent of operators completing quote→invoice→verified payment, duplicate-charge incidence, 30/60-day paid retention, variable infrastructure/payment/support cost per paying organization, support tickets, accessible task completion, recovery proof, and tenant isolation. Only promote an outcome with source evidence and real cohort observation.

## Next engineering gates (in order)
- **P0:** protect main, close post-merge Node 24/26 and native Postgres replay failures, reconcile production migration history, require exact-head green test/security checks and independent review; draft #620 documents unresolved baseline failures.
- **P1:** validate a single end-to-end, two-tenant request→quote→job→invoice→provider-test-payment→approved follow-up flow on mobile. Record idempotency, webhook retries and refund failure modes without moving live money until owner-authorized.
- **P1:** implement a least-privilege **server-only**, paginated, complete provider-payment/retention reconciliation against canonical billing, and aggregate it with D60 cohort metrics. Avoid calling activity-event counts verified revenue.
- **P1:** pilot with 15 interviewed cleaning operators and obtain five real consenting, paying pilot users only after the release gate passes.
- **P2:** scale to adjacent trades when three successive cohorts show reliable economics and customer retention. Add integrations only in response to documented pilot friction.

No merge, production activation, payment, customer outreach, marketplace settlement, OAuth permission elevation or public launch is authorized by this draft.
