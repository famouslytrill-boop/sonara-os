# SONARA Billing and Webhook Report

Date: 2026-07-15

## Preserved behavior

- Stripe Checkout sessions are created server-side.
- Customer Portal sessions are created server-side.
- Both Stripe webhook endpoints retain raw-body parsing before JSON middleware.
- Webhook signatures are verified with the configured signing secret.
- Billing events are recorded idempotently.
- Active/trialing subscription or entitlement records, not checkout redirects, unlock paid access.
- Cancellation/failure events do not grant access.
- Stripe secret values are excluded from client assets and status responses.

## Release impact

This upgrade added required billing page aliases and route metadata but did not replace the existing payment engine. The full tests still cover invalid plans, missing provider configuration, customer authentication, browser and JSON checkout behavior, Portal creation, invalid signatures, failure events, and active subscription synchronization.

## Manual production work

Confirm real price IDs, live/test mode separation, Customer Portal settings, webhook endpoint configuration, signing secret, delivery history, replay handling, and downgrade/cancellation behavior in Stripe. No live charge or production webhook was triggered in this local run.
