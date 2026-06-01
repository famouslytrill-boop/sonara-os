# Owner Confirmation Lock

Owner Confirmation Lock is the mandatory post-launch safety layer for sensitive actions.

The system may draft, queue, recommend, flag, summarize, remind, and prepare actions automatically. It must not execute high-risk actions without explicit owner confirmation.

## Requires Owner Confirmation

- Money movement.
- Refunds.
- Price changes.
- Payout settings.
- Legal or policy text.
- Customer-facing campaigns.
- Security setting changes.
- Deleting data.
- Publishing proof or reviews.
- AI-generated voice outputs.
- AI-generated visual outputs.
- AI-generated video outputs.

## Always Blocked

- Change payout destination through automation.
- Remove owner.
- Disable security gates.
- Delete audit logs.
- Send legal notices.
- Send deceptive claims.
- Publish fake reviews or proof.

## How Approval Works

1. A sensitive action is classified by category and action key.
2. Unknown categories default to owner review.
3. Blocked action keys are marked blocked and cannot execute.
4. Reviewable actions enter the Owner Review Queue.
5. The owner approves or rejects the action.
6. Approved actions may execute only after approval is recorded.
7. Rejected, expired, or blocked actions cannot execute.

## Audit Logs

Approval, rejection, blocking, queueing, expiration, and execution-after-approval events must be logged. Approval log deletion is blocked.

## Implementation

The reusable policy package is `packages/owner-confirmation-lock`. The dashboard routes are:

- `/admin/owner-review`
- `/admin/owner-review/pending`
- `/admin/owner-review/approved`
- `/admin/owner-review/rejected`
- `/security-center/human-approval-gates`
- `/security-center/sensitive-actions`
