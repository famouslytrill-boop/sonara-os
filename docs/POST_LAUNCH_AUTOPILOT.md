# Post-launch Autopilot

Post-launch autopilot keeps routine work visible without giving the system authority over sensitive decisions.

## Queues

- Customer follow-ups
- Review requests
- Billing alerts
- Failed webhook alerts
- Onboarding incomplete alerts
- Support requests
- Security warnings
- Reliability incidents

## Auto Allowed

The system may create internal tasks, remind the owner or admin, draft messages, update checklist status, flag missing information, and retry safe webhook jobs.

Auto allowed actions must not contact customers, publish public content, alter prices, change payment links, issue refunds, delete data, change legal copy, or disable security gates.

## Approval Required

Owner approval is required before sending customer-facing messages, publishing offers, changing payment links, changing prices, approving generated content, issuing refunds, or changing legal/policy copy.

## Always Blocked

Routine automation must never change payout destination, remove an owner, disable security gates, delete audit logs, send legal notices, send deceptive claims, or publish fake reviews/proof.

## Current Status

`/admin/operations` is a setup-mode dashboard. It renders queues and policy rules, but it does not execute live automation.
