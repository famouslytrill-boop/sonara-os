# Administrator Command Center

Date: 2026-05-21

Status: admin-ready setup-mode.

The Administrator Command Center is the owner/admin dashboard for reviewing the full SONARA Industries platform after launch. It is designed to monitor the system without exposing secrets or pretending placeholder systems are live.

## Routes

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

All routes are `admin-ready` and must require owner/admin access in production.

## Main Dashboard

The main command center shows setup-mode cards for:

- total users
- active organizations
- active subscriptions
- monthly recurring revenue placeholder
- setup-service revenue placeholder
- failed payments
- pending owner approvals
- pending customer campaigns
- pending AI media approvals
- security warnings
- reliability warnings
- recent audit activity
- support tickets
- Stripe webhook status
- domain/SSL status placeholder

No card claims live data unless the underlying system is wired and verified.

## Safety Boundaries

- No Stripe secret keys, webhook secrets, API keys, payout data, tokens, raw card numbers, or CVV values display in the UI.
- Billing and revenue cards are placeholders until verified Stripe subscription, invoice, setup-service, and payout records exist.
- Critical financial/security actions require owner role only.
- Sensitive actions route through Owner Confirmation Lock.
- Unknown sensitive actions default to owner review.
- Audit log deletion remains blocked.

## Owner Review Coverage

The owner review queue covers:

- money movement approvals
- refund approvals
- price change approvals
- payout setting approvals
- legal/policy publishing approvals
- customer campaign approvals
- security setting approvals
- data deletion approvals
- proof/review publishing approvals
- AI voice output approvals
- AI visual output approvals
- AI video output approvals

## UI Components

Shared admin components live in `packages/web/src/ui/admin-components.ts`:

- `AdminShell`
- `AdminSidebar`
- `AdminHeader`
- `MetricCard`
- `RiskBadge`
- `StatusBadge`
- `ApprovalCard`
- `AuditLogTable`
- `SystemHealthCard`
- `RevenueSummaryCard`
- `RecentActivityFeed`
- `EmptyState`
- `LoadingState`

## Launch Requirements

Before relying on this dashboard for production operations:

- connect real auth and role checks;
- verify organization-scoped database/RLS behavior;
- verify Stripe test/live mode, webhook signatures, and customer portal;
- verify source leak scans and security headers;
- verify domain/SSL and deployment health;
- confirm audit logs are durable and append-only;
- confirm sensitive actions cannot execute without owner approval.
