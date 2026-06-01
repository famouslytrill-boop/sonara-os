# Owner Daily Review

The owner daily review keeps post-launch operations safe and lightweight.

## Daily Steps

1. Open `/admin/command-center`.
2. Review top-level health, setup-mode warnings, Stripe webhook status, domain/SSL status, and reliability warnings.
3. Open `/admin/owner-review` and review money, refund, pricing, payout, legal/policy, campaign, security, deletion, proof/review, and AI media approvals.
4. Open `/admin/operations` for customer follow-up, review request, billing alert, failed webhook, onboarding, support, security, and reliability queues.
5. Approve or reject customer-facing, payment, pricing, refund, generated-content, and policy-copy actions.
6. Confirm blocked actions remain blocked.
7. Record unresolved issues in the launch or operations backlog.

## Command Center Review

Use `/admin/command-center` as the daily starting point. Treat every `No live data yet`, `Placeholder`, `Setup required`, or `Manual review` card as an operational warning, not as a completed system.

Critical items to check first:

- failed payments and Stripe webhook status;
- pending owner approvals;
- pending customer campaigns;
- pending AI media approvals;
- security warnings;
- reliability warnings;
- support tickets;
- domain/SSL status;
- recent audit activity.

## Do Not Automate

Do not automate customer messages, payment changes, refunds, legal notices, security gate changes, audit log deletion, owner-role changes, deceptive claims, or public proof/review publishing.

## Escalation

Escalate critical security warnings, failed billing/webhook events with customer impact, and reliability incidents that affect public routes or payment setup.

## Secret Handling

Admin review pages must never display Stripe secret keys, webhook secrets, API keys, payout data, tokens, raw card numbers, CVV values, or private customer records.
