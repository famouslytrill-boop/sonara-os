# Supabase Live Readiness Report

## Current migration files

- `0001_auth_organization_scaffold.sql`
- `0002_launch_mvp_core_tables.sql`

## Membership dependency

This repo currently uses `public.organization_members` as the organization membership table. Policies in the existing migrations reference that table after it is created.

## RLS status

- Organization-scoped launch tables include `organization_id`.
- RLS is enabled in migration SQL.
- Private organization reads depend on membership helper functions.
- Anonymous public reads are limited to explicitly public records such as published proof/profile, active links, or approved reviews.

## Not locally proven

The migration SQL has not been applied to a linked local Supabase project in this run. Production and preview verification require Supabase credentials, project linkage, and owner approval.

## Human-required validation

- Rerun Supabase Preview.
- Apply migrations to a disposable preview database.
- Test anonymous, active member, admin, owner, and non-member access.
- Confirm no service-role key is available in browser bundles.
