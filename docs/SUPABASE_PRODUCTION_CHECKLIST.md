# Supabase Production Checklist

Run database changes before launch and verify schema in the Supabase SQL Editor.

## Required Tables

- `stripe_customers`
- `subscriptions`
- `stripe_events`
- `sonara_projects`
- `sonara_sound_assets`
- `sonara_sound_sources` if sound discovery sync is used
- `sonara_sound_sync_runs` if sound discovery sync is used
- `sonara_user_subscriptions` if the legacy SONARA subscription table remains in use

## Security

- Enable RLS on production tables.
- Add policies before production data is stored.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Use the service role key only from server routes and trusted backend jobs.
- Rotate the service role key immediately if it is ever committed.
- Run migrations before launch and avoid duplicating tables.
- Keep Stripe webhook writes server-only after Stripe signature verification.
- Confirm `organizations` and `organization_memberships` exist before organization-scoped Research Lab policies are applied.
- Confirm research intake policies require active organization membership and do not expose private records publicly.

## Verification

- Confirm login works with Supabase Auth if auth is enabled.
- Confirm saving a project writes to `sonara_projects`.
- Confirm listing projects only returns the signed-in user's rows.
- Confirm deleting a project cannot delete another user's row.
- Confirm subscription webhook updates run only from the server.
- Confirm Stripe webhook events insert or update rows in `stripe_events`, `stripe_customers`, and `subscriptions`.

## Available Migrations

- `003_sonara_subscriptions.sql`
- `004_sonara_final_launch.sql`
- `005_sonara_sound_discovery.sql`
- `006_sonara_generation_history.sql`
- `007_platform_infrastructure_ops.sql`
- `008_entity_agent_operations.sql`
- `010_sonara_platform_current_schema.sql`
- `20260528071000_sonara_vector_memory_schema.sql`
- `20260528071400_fix_organization_memberships_dependency.sql`
- `20260528071500_sonara_platform_redesign_schema.sql`
- `20260528093000_support_contact_paths.sql`
- `20260528100000_fix_research_intake_membership_policies.sql`

Public pages must render without Supabase environment variables. Persistent generation history, vector memory, Research Lab storage, and support/contact storage are optional until auth/RLS are verified.

## Master Sprint Addendum

- Apply append-only migrations only after review.
- Confirm provider registry, feature flags, observability events, workflow runs, agent action logs, and GitHub Radar tables in preview before production.
- Do not manually edit rows in `supabase_migrations.schema_migrations`.

## Organization Membership Dependency

`20260528071400_fix_organization_memberships_dependency.sql` is a prerequisite repair migration for branch previews where `organization_memberships` is missing before Research Lab policies compile. It remains append-only and does not manually alter Supabase migration history.

## Support And Contact Tables

- `support_requests` allows public inserts only; reads and management stay authenticated/server-side.
- `feedback_reports` allows public inserts only; reads and management stay authenticated/server-side.
- Email delivery is optional and must not be claimed active unless a reviewed provider adapter and real provider env vars are configured.
