# Post-launch Owner Review

The owner review process is the daily control point for high-risk automation.

## Daily Review

1. Open `/admin/owner-review`.
2. Review pending money, refund, pricing, payout, legal, customer, security, data, proof/review, and AI media actions.
3. Open action details before approving.
4. Confirm affected records, public/private impact, and money/security/legal/customer impact.
5. Approve only actions that are accurate, authorized, and safe.
6. Reject actions that need edits.
7. Confirm blocked actions remain blocked.
8. Review audit history.

## Notification Model

Owner notifications should summarize the action category, risk level, product area, trigger source, affected records, public/private impact, sensitive impact, expiration, and a redacted preview.

## Approval And Rejection

Approvals and rejections must write audit events. Rejected actions cannot execute. Approved actions may execute only after approval is recorded.

## Redaction

Approval previews must redact API keys, payout details, webhook secrets, tokens, and private customer data.
