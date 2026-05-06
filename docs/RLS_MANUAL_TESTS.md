# RLS Manual Tests

Run these after applying migrations in Supabase. Use test accounts only.

## Roles

- Anonymous visitor
- Authenticated User A
- Authenticated User B
- Admin/service-role server process

## Subscription Tests

1. Insert a test subscription for User A through a server-only process.
2. User A can select their own subscription.
3. User B cannot select User A's subscription.
4. Anonymous users cannot read subscriptions.
5. User A cannot insert/update/delete subscription rows directly.

## Platform Ops Tables

For `system_audit_events`:

1. Insert rows for User A and User B through a server-only process.
2. User A can read only rows where `actor_id = auth.uid()`.
3. User B can read only their own rows.
4. Anonymous users read zero rows.

For `platform_jobs` and `db_health_snapshots`:

1. Authenticated users cannot read/write rows.
2. Anonymous users cannot read/write rows.
3. Server-only service role can write from trusted scripts/API routes.

For `creator_activity_events`:

1. User A can read only their own events.
2. User B cannot read User A events.
3. Anonymous users cannot read events.

## Entity Infrastructure Tests

Create two test entities and two test users. Add User A as `owner` on Entity A and User B as `viewer` on Entity B.

1. User A can read Entity A and cannot read private Entity B.
2. User B can read Entity B and cannot read private Entity A.
3. User B cannot update `entity_settings`.
4. User A can update Entity A settings.
5. User B cannot approve high-risk Entity A proactive actions.
6. User A can read Entity A audit logs.
7. User B cannot read Entity A audit logs.
8. Browser notes created by User A are not visible to non-members.
9. Connector records for one entity are not visible to another entity.
10. Anonymous users cannot read private entity records.

## Storage Tests

1. Owner uploads to their private folder.
2. Owner can read signed URL.
3. Unrelated user cannot read owner file.
4. Anonymous user cannot read private bucket.
5. Public assets bucket contains only intentionally public files.

## Failure Means Stop

If any unrelated user can read or modify private data, do not launch. Fix policy and rerun tests.
