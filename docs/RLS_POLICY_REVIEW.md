# RLS Policy Review

This project is RLS-ready, not production-verified. Review every policy in Supabase before storing real customer, payment, file, legal, or audit data.

## Required Rules

- Users can read and update their own profile.
- Organization members can read organization-scoped records.
- Organization-scoped Research Lab policies must depend on `organization_memberships` and require active membership.
- Admin-only operations require a role check through `organization_memberships`.
- Owner-only operations must be enforced in server code and database policy where possible.
- Service-role keys are server-only and bypass RLS by design.

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
