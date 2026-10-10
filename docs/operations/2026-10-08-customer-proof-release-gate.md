# SONARA — Operational, adoption and commercial proof contract

**Prepared:** 2026-10-08
**State:** Research and source-implementation review only. This document is not a deployment authorization, live payment proof, or customer traction claim.
**Base reviewed:** `9d141e68d1ec14c037f92d1eebb3c2718d583c0a`

## Decision

Improve three outcomes together, without treating source breadth, a successful build, a support request, an activity log, or a Stripe object as proof that a real customer received value. Production and customer assertions must be reproducible from independent evidence, dated population definitions, owner-approved provider records, and the exact deployed commit.

## Checked external surfaces (2026-10-08)

- GitHub `main` included merged PR #507, whose review description still required exact-head security and release proof. GitHub commit checks were observed queued; "no legacy commit statuses" is not the same as passing GitHub Actions.
- Vercel `sonara-os` reported `live: false`, and the newest two production deployment records were `BLOCKED`. A prior deployment had `READY`; this is not exact-main live proof.
- Supabase project `yqncsonkxgwhcxedgevk` reported `ACTIVE_HEALTHY`. Its inventory included 418 public tables. Inventory counts at observation time: profiles 4, organizations 2, support requests 21, `subscriptions` 0, `purchases` 0, `billing_entitlements` 0, `activity_events` 5. A support message is not an adopted customer or successful paid transaction.
- Supabase security advisor listed 66 RLS-enabled tables with no policy; classify each as deliberately server-only, missing migration, or missing legitimate user policy before changing any grants.
- The linked Stripe live account listed one canceled subscription, one successful charge and one failed charge. Account-to-SONARA billing linkage and live product attribution were not verified. Stripe Sigma reporting was not available on that account. No revenue, ARR or retention claim follows from these counts.

These are historical observations, not a permanent dashboard. Recheck source and provider state before any release.

## Pillar A — verified operations: release every claim with an evidence packet

| Gate | Required proof | Block condition |
| --- | --- | --- |
| Change governance | Required checks + reviewer enforcement on protected main, attempted red-merge test | Unprotected merge or unverifiable settings |
| Code and supply chain | Exact-head Node 22/24 tests, build, lint, typecheck, secret/CodeQL/dependency scans | Skipped, pending, failed or wrong SHA |
| Database | Migration history reconciled, signed review, staging apply/rollback, tenant RLS denials and privileged-function grant audit | Wrong project, missing proof or cross-tenant access |
| Service | Post-deploy commit proof, independent smoke journeys, error budget and incident drill | Deployment BLOCKED, paused or wrong SHA |
| Payments | Stripe signed webhook, dedupe, entitlement authorization, refund/cancel/failure replay in testmode | Client redirect alone grants access |

Starter SLO proposals (**targets, not achieved observations**): 99.9% monthly success for essential authenticated requests; >=99% successful completed checkout-to-entitlement reconciliations; p95 first useful page action <=3 seconds from agreed supported devices. Measure at the user boundary, include errors/denominators and define low-traffic treatment before reporting.

Reliability: `good / total` over valid transactions. Monthly error budget = `total * (1 - objective)`. Error-budget exhaustion should freeze nonessential releases until recovered. Any customer-money, security, consent or tenant-leak issue is a manual hold regardless of budget.

## Pillar B — real adoption: tenant-scoped and cohort-based

Canonical event source remains `public.activity_events` and `lib/sonara-activity-taxonomy.cjs`. Do not add a duplicate funnel table. Use server-emitted canonical events only, after the organization creation milestone and no later than the observation cutoff.

- Business Builder first win: real lead -> accepted job/booking -> completed work -> invoice/verified payment reference. An intake form alone is not a completed money workflow.
- Creator Studio first win: customer obtains a usable export with required rights/provenance. An internal render does not prove customer receipt.
- Growth Studio first win: recorded attributed conversion or independently evidenced downstream outcome. A campaign draft is not a conversion.

**Definitions:** Activated organizations / eligible distinct new organizations; First value / eligible distinct new organizations; Verified paid conversion / eligible distinct new organizations with reconciled provider payment and granted entitlement. Report cohort start/end and evidence snapshot cutoff, exclude internal/test identities using governed server-side identifiers, and use null (not zero percent) for empty denominators. No cross-tenant joins for dashboards.

Proposed pilot: recruit 5–10 consenting design partners across the three product areas; measure setup intervention, first-value success, median/p90 time-to-value, support resolution and day-7 re-engagement. Targets to validate, not promises: >=80% first-value completion for a specifically defined pilot task after product onboarding stabilizes, median <=15 min for the first small win. Publish results only with sample size and explicit permissions.

## Pillar C — repeatable paid-customer delivery

A customer outcome is **complete** only when the following evidence chain is recorded for the same authorized organization, price, customer, provider and release:

`qualified visit -> signup -> authenticated organization -> primary task -> checkout -> signed Stripe event -> reconciled billing state -> authorized entitlement -> paid service completed -> support/recovery path -> repeat usage -> renewal/cancel handling`

Pre-launch controlled proof:

1. Test-mode canonical $29 single workspace, $59 all-three and $109 Team tiers against configured prices, plus expired/canceled/failure cases.
2. Test duplicate and reordered webhooks, asynchronous payment, retries, failed payment, canceled subscription, one-time purchase and restored access; no grant from checkout redirect.
3. Confirm exactly-once business effect via idempotent DB keys and outbox/reconciliation evidence; distinguish webhook delivery from the business result.
4. Reconcile transaction IDs, amount/currency, tenant, entitlement, invoice and support audit without exposing sensitive payment data.
5. Complete three independent staging runs with recorded before/after state, injected failures, rollback and signed review. Only after checks and explicit owner approval perform one low-risk real-customer canary.
6. Repeat the same journey without engineering or founder intervention and measure cost-to-serve, customer tickets and time to resolution.
7. Maintain customer exports and cancellation/refund records; merchant funds belong to the customer's authorized processor, not a SONARA wallet.

## Commercial metrics and guardrails

- **Activation rate:** `eligible activated organizations / eligible new organizations`
- **First-value rate:** `eligible organizations with an observed canonical first-value milestone / eligible new organizations`
- **Paid conversion:** `new paying organizations with provider and entitlement reconciliation / eligible new organizations`
- **Retention D7:** `mature eligible activated organizations with qualifying day-7 activity / mature eligible activated organizations`
- **Contribution per paid account:** `realized subscription revenue - processing - metered generation - infrastructure allocation - support - refund/chargeback reserve`
- **CAC payback:** `validated acquisition cost per customer / measured monthly contribution per customer`, undefined for zero or negative contribution
- **Reconciliation accuracy:** `matched eligible payable events / all eligible provider events` with unresolved exceptions separately reported

Do not multiply a scenario conversion rate by hypothetical traffic and call it forecast revenue. Avoid revenue, testimonials, savings or ROI claims without measurement, permission and attribution caveats. ChartMogul's 2026 report across 200 B2B software products found an 8% median free-to-paid conversion, with different cohorts/trials; it is an external reference, not SONARA's current conversion.

## Next engineering sequence

1. Verify exact main-head CI and enforce protected-merge rules through an administrator-approved GitHub settings change. Do not assume an empty rulesets API response proves branch-protection absence: the connector could not read branch protection (403).
2. Fix source-level activation counting so pre-workspace, missing-timestamp and future milestones do not inflate first value or paid conversion (separate reviewed PR).
3. Add authenticated server-only cohort aggregation and tamper-resistant event provenance in a follow-on PR. Explicitly document observation windows and exclude test/internal tenants before exposing customer numbers.
4. Reconcile Supabase migration history, database server-only tables, permission grants and dual-tenant read/write denials in reviewed staging. Apply no speculative production RLS grants.
5. Configure approved Stripe staging evidence, exercise complete payment lifecycle with test clocks, and verify transactional entitlement/reversal.
6. Perform controlled design-partner onboarding. Fix the highest-friction step before buying paid traffic.
7. Require owner approval, independent reviewer proof, exact-live-SHA verification, monitoring and rollback plan before enabling production checkout or deployment.

## Reference standards

- Google SRE error budget: https://sre.google/workbook/error-budget-policy/
- GitHub repository rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- Stripe test clocks: https://docs.stripe.com/api/test_clocks
- ChartMogul 2026 conversion report: https://chartmogul.com/reports/saas-conversion-report-2/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

**Authority:** This document and source test evidence never authorize merge, migrations, release, payout, review publication or customer-data export. Owner-approved independent verification is still mandatory.
