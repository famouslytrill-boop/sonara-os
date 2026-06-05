# Database Schema

SONARA uses Supabase/PostgreSQL scaffolding for organization-scoped records. The schema is additive and must be reviewed before production data is stored.

## Core Tables

- `profiles`
- `organizations`
- `organization_memberships`
- `products`
- `subscriptions`
- `billing_customers`
- `notification_preferences`
- `audit_log`
- `legal_acceptances`
- `consent_records`

## Product Tables

- `business_profiles`
- `creator_profiles`
- `growth_workspaces`
- `customers`
- `leads`
- `bookings`
- `quotes`
- `payments`
- `files`
- `reviews`
- `campaigns`

## Research And Integration Tables

- `research_sources`
- `research_snapshots`
- `open_source_tools`
- `tool_reviews`
- `integrations`
- `webhook_events`

## Organization Membership Foundation

`organization_memberships` is the required RLS dependency for organization-scoped records. The branch includes an append-only prerequisite repair migration so Research Lab policies cannot compile before the membership relation exists.

Membership reads are scoped to the signed-in user's active memberships. Organization reads require active membership. Writes and administrative changes remain server/service-role operations until production role policies are reviewed.

## Production Notes

- Service-role access must remain server-side.
- Private organization, customer, payment, file, and audit data must not have public read policies.
- Apply migrations only after backing up the target Supabase project.
- Generate TypeScript types after migration review with `pnpm run db:types`.
- Some production schemas may include a required `organizations.company_key` column. Owner bootstrap SQL sets `company_key = 'sonara'` when the column exists.
- Do not rely on `ON CONFLICT` for owner bootstrap unless a matching unique or exclusion constraint has been confirmed.
