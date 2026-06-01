# Profitability Audit

Date: 2026-05-21

Status: needs review.

This audit documents the profit path without claiming profitability is proven. SONARA One™ has a plausible revenue model through subscriptions and setup services, but margins, churn, support load, payment fees, provider costs, and delivery capacity still need real operating data.

## Revenue Lines

| Revenue line                | Current status | Notes                                                                                  |
| --------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| Free tier                   | Planned/listed | Useful for evaluation and onboarding. Must not create high support burden.             |
| Starter subscription        | Planned/listed | `$9-$15/mo`; simple entry point for solo owners and creators.                          |
| Core subscription           | Planned/listed | `$29/mo`; likely first meaningful recurring plan for Business Builder users.           |
| Growth subscription         | Planned/listed | `$49-$59/mo`; positioned for review/referral/follow-up planning.                       |
| Pro / Business subscription | Planned/listed | `$79-$99/mo`; for stronger operating workflows and teams.                              |
| Agency / Scale subscription | Planned/listed | `$149-$199/mo or custom`; requires careful support and permissions boundaries.         |
| Profile Setup               | Planned/listed | `$99`; basic paid service and low-friction cash collection path.                       |
| Business Launch Setup       | Planned/listed | `$299`; setup service for proof, intake, booking, payment links, and launch checklist. |
| Premium Setup               | Planned/listed | `$499+`; higher-touch service for complex business, creator, or growth setup.          |

## Cost And Margin Risks

| Risk                            | Launch impact                  | Control                                                                       |
| ------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Stripe/payment fees             | Reduces net revenue            | Keep pricing docs clear; reconcile in Stripe.                                 |
| Refunds and disputes            | Can erase setup-service margin | Require owner approval and documented policy.                                 |
| Setup service labor             | Can consume margin quickly     | Define scope, timebox delivery, and avoid unlimited revisions.                |
| Support load from Free tier     | Can create negative margin     | Keep Free tier limited and route support clearly.                             |
| Provider/API pass-through costs | Can grow with usage            | Keep provider features gated and document pass-through pricing.               |
| Legal/security review           | Required before paid launch    | Keep policy pages review-ready and do not claim compliance.                   |
| Auth/database operations        | Required for production        | Do not sell live workflows until account, org, and RLS behavior are verified. |

## What Must Be Tracked After Launch

- Free-to-paid conversion rate.
- Starter-to-Core upgrade rate.
- Setup service conversion rate.
- Setup service delivery time per customer.
- Refund/dispute rate.
- Support tickets per customer.
- Provider/API costs per plan.
- Stripe fees and net payout amounts.
- Churn by plan.
- Activation completion through onboarding.

## Profit Path

1. Use Free and Starter to reduce buyer friction.
2. Convert serious users to Core or Growth once proof, payment, booking, and review setup are valuable.
3. Use Profile Setup and Business Launch Setup as early cash-flow offers.
4. Keep Premium Setup scoped to higher-touch customers with clear boundaries.
5. Add Agency/Scale only when permissions, support, billing, and customer data boundaries are production-verified.
6. Add marketplace fees only after legal/payment review and Stripe Connect design approval.

## Profitability Blockers

- Live Stripe checkout, customer portal, and webhooks are not verified in production.
- Real auth, organization membership, and role enforcement are not production-verified.
- Database/RLS behavior is not verified in a deployed Supabase project.
- Setup-service fulfillment scope and support process need owner review.
- Provider pass-through cost policy is not final.

## Profitability Verdict

Status: `needs_review`.

The revenue model is coherent, but profitability is not proven. Do not claim guaranteed profit, guaranteed customers, guaranteed growth, or guaranteed revenue. Treat this as a launch revenue hypothesis until real customer and cost data exists.
