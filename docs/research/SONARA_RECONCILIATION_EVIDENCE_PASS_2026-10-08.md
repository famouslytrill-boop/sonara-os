# SONARA financial evidence engineering pass — 2026-10-08 UTC

## Decision and scope

Continue the broad engineering and marketing assessment with a concrete P0 question: can a seller trust a displayed total or an “Everything agrees” result when one contributing payment amount is unavailable?

Base: `207372e40e56716199286d6ca95984eed2882b49` (includes merged PRs #448 and #450). This supplements `SONARA_ENGINEERING_MARKETING_PASS_2026-10-08.md`; it does not claim every capability in that assessment is production-ready. The website must remain temporarily offline pending the owner's separate direction.

## Evidence and contradiction review

| Claim | Evidence checked 2026-10-08 | Classification | Confidence |
| --- | --- | --- | --- |
| The merchant report substituted zero for missing provider refunds and recorded amounts | `lib/sonara-merchant-payments.cjs`, reconcile function at the base commit | Verified source fact | High |
| Seller sales totals could omit missing prices and resume accumulating after an unknown row | `routes/sonara-creator-marketplace-routes.cjs`, salesSection | Verified source fact | High |
| A charge's refund amount is an integer in its smallest currency unit | [Stripe Charge object](https://docs.stripe.com/api/charges/object), amount_refunded | Verified provider contract | High |
| Settlement currency can differ from payment currency; fees and net belong to the balance transaction | [Stripe Balance Transaction object](https://docs.stripe.com/api/balance_transactions/object), currency, exchange_rate, fee, net | Verified provider contract | High |
| These defects could understate totals or falsely reconcile incomplete records | Before/after code behavior plus negative test fixtures | Engineering inference | High |
| Live merchant data currently contains these defects | No production records inspected | Unknown | Unestablished |

Contradictions considered: zero is a valid reported refund and must stay zero; database defaults often supply it, but that does not prove an expanded provider object exists. A missing balance expansion does not prove no fee. Different-currency settlement is legitimate, so it must not be diagnosed as a corrupt payment or relabeled in the payment currency. Totals can legitimately exceed a single PostgreSQL integer column, so aggregate addition uses JavaScript's safe-integer bound while each stored row retains its existing database bound. A negative balance net can be legitimate and is retained.

## Implemented behavior

- One shared safe addition helper propagates an unknown contributor through all subsequent additions and rejects integer overflow.
- Merchant gross, refunds, recorded paid, and recorded refund totals preserve missing or invalid evidence.
- Reconciliation reports unavailable amounts and currency discrepancies instead of declaring agreement. Those rows offer no one-click missing-payment repair.
- Fees and net become unavailable when settlement currency differs, amounts are invalid, or aggregate precision would be lost. A future settlement-currency table can expose those values correctly without guessing an exchange rate.
- Creator sales aggregates validate stored prices and normalize currency grouping. A missing price keeps that currency's total unavailable in either input order.
- Customer-facing report text labels unavailable amounts clearly; discrepancy rows format the local amount with the local record's currency.

These are read/reporting changes. No migration, payment execution, refund execution, payout change, dependency, paid service, or infrastructure purchase was added.

## Business and marketing application

Recommendation: make trustworthy payment evidence part of Business Builder and Creator Studio's value proposition. A suitable claim after deployment verification is “See recorded sales, compare payment records, and spot amounts that need checking.” Do not advertise this report as audited accounting, bank settlement proof, guaranteed revenue, or a complete financial ledger.

The commercial hypothesis is fewer confusing seller support cases and more confidence completing first sales. That is an inference, not measured ROI. Measure first successful sale, reconciliation completion, discrepancy resolution time, and seller retention before making claims about conversion or savings. Keep event payloads free of buyer payment details. No campaign or analytics integration was activated in this pass.

## Broader priorities carried forward

| Area | Next evidence-bearing advancement | Completion evidence |
| --- | --- | --- |
| Commerce and inventory | Expand charge/balance provenance and settlement-currency reporting; verify refund/dispute linkage | Connected-account fixtures plus approved test-tenant end-to-end receipts |
| Identity and permissions | Verify deployed sign-in, recovery, owner/member boundaries and cross-tenant rejection | Exact deployed commit and real authorization results |
| Creator media | Bounded processing, cancellation, provenance and licensed delivery | A real job through storage, processing, receipt and authorized download |
| Growth and social | One authorized connector through publication and delivery receipt | Provider record, retry/idempotency behavior and disconnect proof |
| Mobile, offline and devices | Reconcile queued mutations and explicit camera/audio/location consent | Device tests, conflicts, revocation and recovery evidence |
| Accessibility and visual design | Keyboard, focus, screen-reader, captions, zoom and mobile reflow testing | Recorded user-journey checks on the actual screens |
| Operations and scaling | Restore drill, measured load, rate limits and service objectives | Measured recovery/load results, not architecture diagrams alone |
| Pricing and monetization | Validate entitlement and resource-cost boundaries across paid states | Current catalog, usage records and approved provider test payments |
| Templates and specialist tools | Reuse canonical records and permissions for vertical workflows | Complete input-to-result-to-record workflows with truthful limitations |

This ordering is a recommendation under a low-budget startup constraint. Adding more technology without closing these evidence gaps would not establish greater production reliability. “Free flights” remains undefined; no travel entitlement or booking capability is claimed.

## Validation and limits

The added checks exercise absent/malformed amounts, order-independent unknown propagation, valid zero, integer limits, currency mismatch, settlement fee currency, tenant-scoped sales reads, and actual rendered reconciliation responses. The handoff log records completed command results.

Remaining limits: the report still uses bounded time-window reads; full provider charge/capture/source and balance arithmetic validation is a subsequent slice. Currency-specific settlement reporting, refund/dispute ledger accounting, and production proof are not established by this change. No live provider credentials or production database access were used. Deployment, production readiness and marketing outcomes remain unverified.
