# Auth And RLS

This document defines the foundational auth and organization scaffold for SONARA One. It is preparation only; no live authentication provider is enabled by this change.

## Models

### user_profiles

Owner-facing profile record keyed by the authenticated user id once Supabase Auth is wired.

Fields:

- `id`
- `display_name`
- `email`
- `created_at`
- `updated_at`

### organizations

Organization record for businesses, creators, agencies, and internal teams.

Fields:

- `id`
- `name`
- `slug`
- `kind`: `business`, `creator-studio`, `agency`, `internal`
- `status`: `active`, `setup`, `suspended`, `archived`
- `created_by`
- `created_at`
- `updated_at`

### organization_members

Connects users to organizations.

Roles:

- `owner`
- `admin`
- `member`
- `viewer`
- `developer`
- `support`

Fields:

- `id`
- `organization_id`
- `user_id`
- `role`
- `status`
- `created_by`
- `created_at`
- `updated_at`

### audit_logs

Append-oriented audit records for organization-scoped changes.

Fields:

- `id`
- `organization_id`
- `created_by`
- `event_type`
- `entity_type`
- `entity_id`
- `metadata`
- `created_at`

## Audit Metadata Convention

Organization-scoped records should include:

- `organization_id`
- `created_by`
- `created_at`
- `updated_at`

The TypeScript helper is `createAuditMetadata`.

## Permission Helpers

Typed helpers live in `packages/web/src/lib/auth`.

- `roleHasPermission`
- `canManageOrganization`
- `canAccessAdminArea`
- `canAccessProtectedRoute`

Protected routes use existing route metadata:

- `public`
- `auth-ready`
- `admin-ready`

Until real auth exists, private routes render setup-mode guard UI instead of private content.

## RLS Policy Stub

The initial SQL stub is:

```text
supabase/migrations/0001_auth_organization_scaffold.sql
```

It defines:

- `user_profiles`
- `organizations`
- `organization_members`
- `audit_logs`
- RLS enablement
- member-scoped organization reads
- owner/admin organization management
- same-organization membership visibility
- admin/support/developer audit-log reads
- member audit-log inserts

Review the migration before applying it to any live Supabase project.

## Security Requirements

- Service-role keys stay server-only.
- Do not use `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
- Browser code may only use public anon-key configuration.
- Admin routes require a real user, active organization membership, and an admin-capable role before private data is shown.
- Public routes must not read organization-private records.

## Privacy Requirements

- Customer records, intake submissions, booking requests, billing setup, and audit logs are organization-private by default.
- Public profile routes must expose only explicit public fields.
- No private customer data should appear in debug logs or public route payloads.

## Launch Gate

Before enabling writes:

- Apply and manually verify RLS in Supabase.
- Confirm `auth.uid()` maps to `user_profiles.id`.
- Confirm non-members cannot read or write organization data.
- Confirm public routes expose only approved public fields.
- Run `pnpm run typecheck`.
- Run `pnpm run build`.
- Run `pnpm run smoke`.
