# Human Approval Rules

Human approval is required when an action could affect money, refunds, pricing, payout settings, legal or policy text, customer-facing campaigns, security settings, data deletion, proof/review publishing, or public AI-generated media.

## Owner Approval Required

- Move money or create payment transfer logic.
- Issue refunds.
- Change subscription, setup-service, offer, coupon, or campaign pricing.
- Change payout account, Stripe account, connected bank, payment provider, or payout schedule settings.
- Publish terms, privacy, refund policy, disclaimers, contract language, compliance claims, or business policy pages.
- Send emails, SMS, review requests, win-back messages, referral campaigns, offer campaigns, ads, or public announcements.
- Change roles, owner lock, provider keys, AI provider settings, security gates, RLS policies, MFA/passkey settings, domain settings, webhook secrets, or admin access.
- Delete customer, organization, file, billing, legal, proof, or asset records.
- Publish proof profiles, proof cards, trust badges, testimonials, review highlights, customer proof, verification claims, or proof pages.
- Approve AI-generated voice, visual, or video output for public or commercial use.

## Always Blocked

- Change payout destination through background automation.
- Remove owner.
- Disable security gates through routine automation.
- Delete audit logs.
- Send legal notices.
- Send deceptive claims.
- Publish fake reviews or proof.

## Unknown Actions

Unknown sensitive action categories default to owner review. They must not default to safe.

## Enforcement

The reusable enforcement model lives in `packages/owner-confirmation-lock`. Every sensitive action must call the Human Approval Gate before execution. The post-launch operations dashboard in `packages/web/src/lib/post-launch-operations/operations.ts` remains a setup-mode queue surface and cannot bypass Owner Confirmation Lock.
