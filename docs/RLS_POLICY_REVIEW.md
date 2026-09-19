# RLS Policy Review

RLS is part of the production authorization boundary, but application traffic is not allowed to rely on RLS alone. Tenant-scoped server queries must still carry an explicit `organization_id`, and signed-in Data API reads must run as the caller so Postgres can independently enforce membership.

The September 19, 2026 tenant-boundary audit found that all production tables carrying `organization_id` had RLS enabled, but live authorization drift had reintroduced an older `organization_members` identity source. Migration `20260919033000_organization_tenant_boundary_hardening.sql` restores `organization_memberships` as the canonical source, requires active membership, narrows organization-table grants, and quarantines the legacy table without dropping it.

## Required Rules

- Users can read and update their own profile.
- Organization members can read organization-scoped records.
- Organization-scoped Research Lab policies must depend on `organization_memberships` and require active membership.
- Admin-only operations require a role check through `organization_memberships`.
- Owner-only operations must be enforced in server code and database policy where possible.
- Service-role keys are server-only and bypass RLS by design.
- A service-role query to a tenant-scoped table must still carry an explicit tenant boundary enforced by `lib/sonara-tenant-guard.cjs`.
- A table absent from both generated tenant/global registries fails closed; unknown must never be interpreted as global.
- `organization_memberships` is the canonical organization identity source. Authorization helpers must not fall back to the legacy `organization_members` table.
- Anonymous callers have no direct privileges on `organizations`, `organization_memberships`, or `business_memberships`.
- Direct membership mutation is server-authoritative; authenticated users may read membership rows allowed by RLS but cannot directly change role/status through the Data API.

## Tables Requiring Private Scope

- `customers`
- `leads`
- `bookings`
- `quotes`
- `payments`
- `files`
- `reviews`
- `campaigns`
- `billing_customers`
- `subscriptions`
- `audit_log`
- `research_sources`
- `open_source_tools`
- `tool_reviews`

## Blocked Policy Patterns

- Broad `using (true)` policies on private tables.
- Public read access for customer, payment, file, legal, or audit data.
- Public read access for private `research_sources`, `open_source_tools`, or `tool_reviews`.
- Client-side use of `SUPABASE_SERVICE_ROLE_KEY`.
- Admin actions that rely only on frontend route hiding.

## Manual Test Path

1. Create two test users.
2. Put each user in a different organization.
3. Insert organization-scoped records for each organization.
4. Confirm each user can read their own organization records only.
5. Confirm non-admin members cannot perform admin-only operations.
6. Confirm service-role operations occur only from trusted server code.

## Owner Bootstrap Review

Run `scripts/sql/bootstrap-owner-safe.sql` only after the owner email exists in `auth.users`. Confirm the resulting membership is active and has role `owner` or `platform_owner` with `scripts/sql/verify-owner-bootstrap.sql`.
