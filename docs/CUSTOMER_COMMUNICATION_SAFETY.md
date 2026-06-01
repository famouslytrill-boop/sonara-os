# Customer Communication Safety

Customer communication must stay owner-reviewed and permission-aware.

## Rules

- Do not send automatically.
- Do not message customers without permission status.
- Respect opt-out status.
- No hidden tracking.
- No automatic win-back, review request, booking reminder, or campaign sends.
- No customer data should appear on public pages unless explicitly approved through a future safe publish flow.

## Permission States

- `opted_in`: follow-up drafts can be queued for owner review.
- `unknown`: drafts can be created, but sending is blocked until permission is confirmed.
- `opted_out`: sending is blocked.

## Approval

Follow-up drafts use the automation safety model. Customer-facing sends require owner review. Opt-out and no-outreach preferences are blocked and cannot be treated as approved sends.

## Future Requirements

- Organization-scoped database persistence.
- RLS policies for customer records and follow-up drafts.
- Audit events for follow-up creation, approval, rejection, and send attempts.
- Rate limits and unsubscribe handling before any real messaging integration.
