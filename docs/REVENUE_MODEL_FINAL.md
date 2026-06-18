# Revenue Model Final

Date: 2026-05-21

Status: final draft for launch review, not proof of profitability.

This document defines the intended SONARA Industries™ revenue model for launch review. It does not guarantee revenue, profit, customers, or growth.

## Subscription Plans

| Plan           | Price                    | Intended customer                | Notes                                                                    |
| -------------- | ------------------------ | -------------------------------- | ------------------------------------------------------------------------ |
| Free           | `$0/mo`                  | Evaluators and early setup users | Keep limits clear to avoid high support cost.                            |
| SONARA One Starter        | `$9/mo`              | Solo owners and creators         | Entry plan for basic profile and launch setup.                           |
| Core           | `$29/mo`                 | Small businesses                 | Core proof, payment link, booking, intake, and customer setup workflows. |
| SONARA One Growth         | `$59/mo`             | Businesses improving follow-up   | Reviews, referrals, campaign setup, and growth planning.                 |
| SONARA One Pro | `$99/mo`             | Established businesses           | More complete operating workflows and team needs.                        |
| SONARA One Agency/Scale | `$199/mo or custom` | Agencies and larger teams        | Requires careful permissions, support, and customer data controls.       |

## Setup Services

| Service               | Price   | Intended scope                                                                  |
| --------------------- | ------- | ------------------------------------------------------------------------------- |
| Profile Setup         | `$99`   | Basic profile, links, proof notes, and launch checklist setup.                  |
| Business Launch Setup | `$299`  | Proof sections, intake, booking, payment link review, and launch setup support. |
| Premium Setup         | `$499+` | Expanded support for more complex business, creator, or growth workflows.       |

Setup services should have written scope, handoff expectations, and revision boundaries before public paid launch.

## Future Revenue Lines

Future monetization options require review before launch:

- Agency mode.
- Premium templates.
- Marketplace fees only after legal and payment review.
- SMS pass-through costs.
- AI/provider pass-through costs.
- Additional setup or migration services.

Do not enable marketplace payouts or third-party business payouts without a future Stripe Connect review.

## Payment Path

- SONARA billing should use hosted Stripe Checkout, Stripe Customer Portal, Stripe Payment Links, or Stripe subscriptions.
- Customer money should enter the owner Stripe account.
- Stripe deposits payouts to the owner connected bank account based on Stripe payout settings.
- SONARA should not store raw card numbers, CVV, or full bank credentials.
- Refunds and disputes are handled in Stripe and require owner approval.

## Pricing Safety Rules

- No hidden fees.
- External provider fees must be disclosed where relevant.
- No guaranteed revenue.
- No guaranteed customers.
- No guaranteed growth.
- No fake testimonials.
- No fake reviews.
- No fake customer logos.
- No deceptive urgency.
- Pricing changes require owner confirmation.

## Review Checklist Before Paid Launch

- Stripe products and prices created.
- Test-mode checkout completed.
- Webhook endpoint verified.
- `invoice.paid` and `invoice.payment_failed` behavior verified.
- Customer portal verified.
- Refund/dispute process documented.
- Owner payout documentation reviewed.
- Legal/policy pages reviewed.
- Support and setup-service scope documented.

## Revenue Model Verdict

Status: `needs_review`.

The pricing ladder and setup services are clear. Paid public launch should remain blocked until billing, legal, support, auth, database, and production environment checks are complete.
