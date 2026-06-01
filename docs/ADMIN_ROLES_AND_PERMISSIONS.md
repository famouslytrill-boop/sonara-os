# Admin Roles And Permissions

Date: 2026-05-21

Status: policy draft for implementation and launch review.

## Role Model

| Role      | Intended access                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------- |
| owner     | Full organization/admin access and required approval authority for critical financial/security actions.   |
| admin     | Admin access for operations, support, audit review, billing review, and non-critical platform management. |
| member    | Product workspace access only.                                                                            |
| viewer    | Read-only product workspace access.                                                                       |
| developer | Internal developer utility and security-read access.                                                      |
| support   | Support and limited security-read access.                                                                 |

## Admin Route Requirements

These routes require owner/admin role in production:

- `/admin/command-center`
- `/admin/users`
- `/admin/organizations`
- `/admin/billing`
- `/admin/payments`
- `/admin/owner-review`
- `/admin/autopilot`
- `/admin/support`
- `/admin/audit-logs`
- `/admin/system-health`
- `/admin/settings`
- `/security-center`
- `/admin/reliability-center`

## Owner-Only Critical Actions

Critical actions require owner role and Owner Confirmation Lock:

- money movement;
- refunds;
- live price changes;
- payout setting changes;
- security setting changes;
- owner role changes;
- deleting data;
- publishing legal/policy text;
- publishing proof/reviews;
- sending customer-facing campaigns;
- approving public/commercial AI voice, visual, or video outputs.

## Admin Safety Rules

- Unknown sensitive actions default to owner review.
- Critical financial/security changes must not be executed by background automation.
- Audit log deletion is always blocked.
- Payout destination changes are not routine automation and require step-up owner review.
- No admin page may display secrets, tokens, payout data, raw card numbers, CVV values, or private customer details.

## Production Verification

Before launch:

- verify signed-out users cannot access admin routes;
- verify members/viewers cannot access admin routes;
- verify admins can review non-critical admin surfaces;
- verify owner role is required for critical financial/security actions;
- verify RLS matches organization membership;
- verify audit logs record approval, rejection, and blocked events.
