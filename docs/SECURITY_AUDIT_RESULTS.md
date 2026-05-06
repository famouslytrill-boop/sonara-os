# Security Audit Results

Date: May 6, 2026

This is a code and migration audit, not a live Supabase dashboard audit.

| Area / Table | RLS Enabled | Policy Summary | Risk | Fix Applied | Manual Verification Needed |
| --- | --- | --- | --- | --- | --- |
| `sonara_user_subscriptions` | Yes | Authenticated users can read their own subscription. Webhook writes use server-only service role. | Medium | Existing policies preserved; no anonymous writes. | Confirm unrelated users cannot read rows. |
| `song_fingerprints` | Yes | Owner-scoped via `auth.uid() = owner_id`. | Low | Existing owner policy preserved. | Test owner vs unrelated user. |
| `release_plans` | Yes | Owner-scoped via `auth.uid() = owner_id`. | Low | Existing owner policy preserved. | Test owner vs unrelated user. |
| `sonara_projects` | Yes | Owner-scoped policies in launch migration. | Low | Existing user/owner indexes preserved. | Test project access across users. |
| `sonara_memory_records` | Yes | User-owned read/insert; service role policy uses `auth.role() = 'service_role'`. | Medium | No public policy. | Confirm service role key stays server-only. |
| `sonara_sound_sources` | Yes where migration applies | Public metadata read may be intentional for source registry; writes are not anonymous. | Medium | No weakening applied. | Confirm only intended metadata is public. |
| `sonara_sound_assets` | Yes where migration applies | Rights classification data must not expose private files. | Medium | Existing rights-oriented migration preserved. | Test asset visibility. |
| `system_audit_events` | Yes | Authenticated users read only rows where `actor_id = auth.uid()`. No anonymous access. | Low | Removed broad service-role `USING (true)` policy; service role bypasses RLS by design. | Apply migration and test actor-scoped reads. |
| `platform_jobs` | Yes | No user policy; locked down for service-role/server-side operations. | Low | Removed broad service-role policy. | Confirm authenticated users cannot read/write. |
| `db_health_snapshots` | Yes | No user policy; locked down for trusted ops only. | Low | Removed broad service-role policy. | Confirm no public/auth read. |
| `creator_activity_events` | Yes | Authenticated users can read their own events only. | Low | Removed broad service-role policy. | Test user-specific reads. |
| `entities` | Yes in migration 008 | Public only when `is_public`; private rows require membership. | Low | Added entity-scoped policy helpers. | Test non-member cannot read private entities. |
| `entity_memberships` | Yes in migration 008 | Members can read entity membership; owner/admin can manage. | Medium | Added owner/admin role checks. | Test viewer cannot add members. |
| `entity_settings` | Yes in migration 008 | Members can read; owner/admin can manage. | Medium | Added scoped management policy. | Test operator/viewer cannot update settings. |
| `entity_audit_logs` | Yes in migration 008 | Members can read; members can append only scoped logs. No update/delete policies. | Low | Append-only policy added. | Test unrelated user cannot read logs. |
| Entity browser, notes, heartbeats, actions, agents, automations, connectors | Yes in migration 008 | Records are scoped by entity membership; high-risk configuration requires owner/admin. | Medium | Added RLS and security docs. | Test cross-entity access and approval restrictions. |
| `storage.objects` / `sonara-releases` | Yes when storage migration applies | Folder ownership policy. | Medium | Existing private bucket intent preserved. | Test upload/read/delete as owner and unrelated user. |

## Security Definer Review

`public.set_updated_at()` is not security definer.

Any future `SECURITY DEFINER` helper must:

- set a locked `search_path`
- avoid dynamic SQL where possible
- not grant regular users broad admin behavior
- be documented in this file

## Frontend Secret Review

- Service role access is isolated to `lib/supabaseAdmin.ts` and server-only DB/storage helpers.
- No frontend component should import `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `SUPABASE_DB_URL`.
- `npm run scan:secrets` must pass before deployment.

## Fixes Applied

- Removed broad service-role `USING (true)` / `WITH CHECK (true)` policies from `007_platform_infrastructure_ops.sql`.
- Added environment verification and DB verification scripts.
- Added storage validation helpers with explicit MIME and size checks.
- Added entity agent infrastructure migration with scoped RLS and no broad true policies.

## Manual Verification Needed

Use `docs/RLS_MANUAL_TESTS.md` after applying migrations to Supabase.
