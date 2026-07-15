# SONARA Database Report

Date: 2026-07-15

## Current pattern

The Express runtime calls Supabase Auth and PostgREST from the server. Service-role credentials remain server-only. Customer and administrator route middleware determines which server operation may run; RLS remains a second database boundary.

## Release changes

- Added `20260715120000_user_preferences_appearance_notifications.sql`.
- Added `20260715110223_support_delivery_state.sql` for support reference IDs, consent state, delivery outcomes, retry counts, and server-only delivery-attempt auditing.
- Added `user_preferences.appearance_mode` with `system`, `light`, and `dark` validation.
- Added `user_preferences.notifications_enabled` with a truthful default.
- Reused the existing `user_preferences` and `user_notifications` tables instead of creating overlapping structures.
- Aligned notification reads to `category` and `read_at` as defined by the existing migration.
- Aligned administrator audit inserts to `admin_audit_logs.actor_id`.
- Preserved existing RLS and service-role policies; the new migration is additive and seeds no user or credential data.
- Reconciled historical `organizations`, `organization_memberships`, `user_roles`, and `support_requests` migration ordering so a fresh Supabase preview can replay from an empty schema.

## Validation

- Syntax and route tests pass.
- Account preference and notification routes require a verified customer session.
- Administrator audit views require `requireAdmin`.
- No SQL execution endpoint was added.

## Manual production work

The migration was not applied to a production Supabase project in this local run. An authorized operator must review it, apply it through the normal migration workflow, and perform real user/admin/cross-organization RLS checks before release.
