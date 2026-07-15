# SONARA Database Report

Date: 2026-07-14

## Access pattern

All Express data access is server-side `fetch` against Supabase REST with
the service-role key; the anon key is used only for `/auth/v1` flows. No
Supabase credentials ever reach client JavaScript (client-secret scan
enforces this). Every read/write helper degrades to `setup_required` naming
the exact missing dependency; nothing fakes a save.

## Migrations added this session (both idempotent, additive, RLS-enabled)

1. `20260714120000_sonara_service_lifecycle_runtime_tables.sql`
   - Service lifecycle: service_catalog_items, service_requests,
     service_request_events, service_deliverables, service_comments.
   - Runtime alignment (tables server.js already used but no migration
     created): module_outputs, billing_subscriptions, billing_entitlements,
     billing_webhook_events, user_roles, business_memberships,
     business_employee_invites — with the exact unique constraints the
     PostgREST upserts target.
2. `20260714150000_sonara_notifications_and_integrations.sql`
   - user_notifications (user-scoped RLS: read own, mark own read).
   - integration_statuses (service-role only registry).

## Reuse decisions (no duplicate table purposes)

| Requested structure | Served by existing table |
| --- | --- |
| customer_workspaces | organizations |
| workspace_memberships | organization_memberships |
| saved_tool_outputs | module_outputs |
| service_tasks | launch_checklist_items / employee_tasks |
| service_files | files / creator_assets |

## RLS and role posture

- Every new table: RLS enabled; service-role manage policies; org-member
  read policies via `public.is_org_member`; user-scoped policies for
  notifications and user_roles.
- Existing RLS assumptions untouched; no policies weakened or dropped.
- Roles: founder/admin via env allowlist + user_roles rows (owner/admin);
  business_memberships carries owner/manager/employee; customers are
  organization-scoped through organization_memberships. Server routes
  enforce access (requireAdmin / requireWorkspaceAccess /
  requirePaidOrOwnerAccess / requireBusinessManager); client code is never
  trusted.

## Tenant and product isolation

- All record reads filter `organization_id` server-side; product record
  reads additionally filter `product_key` (verified in module code and by
  the product-requests tests).
- Admin cross-organization visibility exists only behind requireAdmin.
- No web-based SQL executor exists; /admin/database is a read-only
  readiness view naming each missing table.

## Setup-required behavior

`REQUIRED_OPERATION_TABLES` (34 tables) is probed live; `/admin/database`
and `/api/admin/database-readiness` name each missing table exactly.
Customer-facing pages translate these to plain language with a next action.

## Manual steps

1. `npm run db:push` to apply both new migrations to the live project.
2. Create the seven storage buckets (avatars, business-assets,
   creator-assets, music-stems, release-packages, support-attachments,
   exports) in Supabase Storage.
3. Optionally seed service_catalog_items and integration_statuses.
