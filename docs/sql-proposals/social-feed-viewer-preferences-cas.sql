-- SONARA Industries — RESEARCH PROPOSAL ONLY, 2026-10-09.
-- NOT a numbered migration. DO NOT execute against a customer project.
-- Do NOT count this as deployed, tested, grant-reviewed or production ready.
-- First reconcile canonical production database, create a numbered migration via
-- Supabase CLI on an isolated clone, replay PostgreSQL+RLS, and secure approval.
--
-- Viewer feed preferences are PERSONAL, never scoped to workspace_id.
-- This private schema is deliberately not included in exposed PostgREST schemas.
-- Public social projections, follows, account blocks, moderation reports,
-- age/country verification and publication authorization live elsewhere.
--
-- Trust boundary: all writes here require the server to authenticate a real
-- signed-in user *before* using service_role. service_role BYPASSES RLS.
-- p_viewer_id/p_settings/p_policy_version MUST NOT come directly from browser
-- fields. Neither the SQL function nor a {verified:true} JS seam authorizes.
-- Never expose this schema or function through public/anon Data API.

create schema if not exists sonara_social_private;
revoke all on schema sonara_social_private from public, anon, authenticated;
grant usage on schema sonara_social_private to service_role;

create table sonara_social_private.viewer_feed_preferences (
  viewer_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  settings jsonb not null default
    '{"topics":[],"mutedTopics":[],"mutedKeywords":[],"hiddenContentIds":[],"discoveryOptIn":false,"aiContent":"include"}'::jsonb,
  discovery_consent_policy text,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint viewer_feed_settings_shape check (
    jsonb_typeof(settings) = 'object'
    and settings ?& array['topics','mutedTopics','mutedKeywords','hiddenContentIds','discoveryOptIn','aiContent']
    and jsonb_typeof(settings->'topics') = 'array'
    and jsonb_typeof(settings->'mutedTopics') = 'array'
    and jsonb_typeof(settings->'mutedKeywords') = 'array'
    and jsonb_typeof(settings->'hiddenContentIds') = 'array'
    and jsonb_array_length(settings->'topics') <= 200
    and jsonb_array_length(settings->'mutedTopics') <= 200
    and jsonb_array_length(settings->'mutedKeywords') <= 200
    and jsonb_array_length(settings->'hiddenContentIds') <= 200
    and jsonb_typeof(settings->'discoveryOptIn') = 'boolean'
    and settings->>'aiContent' in ('include','reduce','exclude')
    and pg_column_size(settings) <= 32768
  ),
  constraint viewer_feed_consent_required check (
    (settings->>'discoveryOptIn')::boolean is not true
    or (discovery_consent_policy is not null and consented_at is not null)
  )
);

-- Append-only record of Discover consent changes. No automatic publishing.
create table sonara_social_private.viewer_feed_consent_events (
  event_id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  opted_in boolean not null,
  policy_version text,
  changed_at timestamptz not null default now(),
  unique (viewer_id, revision),
  constraint viewer_feed_consent_event_version check (
    opted_in is not true or policy_version is not null
  )
);

alter table sonara_social_private.viewer_feed_preferences enable row level security;
alter table sonara_social_private.viewer_feed_consent_events enable row level security;

revoke all on sonara_social_private.viewer_feed_preferences from public, anon, authenticated;
revoke all on sonara_social_private.viewer_feed_consent_events from public, anon, authenticated;
grant select, insert, update, delete
  on sonara_social_private.viewer_feed_preferences to service_role;
-- Audit rows: insert and read only. No update/delete to runtime role.
grant select, insert on sonara_social_private.viewer_feed_consent_events to service_role;

-- The initializing server action is separately authenticated and reviewed:
-- provision exactly one row for the verified viewer, default Discover=OFF.
-- INSERT ... ON CONFLICT DO NOTHING is idempotent; missing row in read adapter
-- still means "preferences unavailable" until initialization is verified.
--
-- Atomic compare-and-swap. Row lock serializes concurrent writers and the
-- expected revision prevents the second writer from silently overwriting.
-- Called by a trusted server DB connection only (not a browser RPC).
create function sonara_social_private.cas_viewer_feed_preferences(
  p_viewer_id uuid,
  p_expected_revision bigint,
  p_settings jsonb,
  p_policy_version text default null
) returns table(applied boolean, next_revision bigint, result_code text)
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_revision bigint;
  v_old_opt boolean;
  v_new_opt boolean;
  v_old_settings jsonb;
  v_old_policy text;
  v_next bigint;
begin
  if p_viewer_id is null or p_expected_revision is null or
     p_expected_revision < 1 or p_settings is null then
    return query select false, null::bigint, 'invalid_argument'::text;
    return;
  end if;

  select p.revision, (p.settings->>'discoveryOptIn')::boolean,
         p.settings, p.discovery_consent_policy
    into v_revision, v_old_opt, v_old_settings, v_old_policy
    from sonara_social_private.viewer_feed_preferences as p
    where p.viewer_id = p_viewer_id
    for update;
  if not found then
    return query select false, null::bigint, 'not_initialized'::text;
    return;
  end if;
  if v_revision <> p_expected_revision then
    return query select false, v_revision, 'revision_conflict'::text;
    return;
  end if;
  -- The JS planner validates exact allowed fields, types, length, canonical
  -- UUID and keyword formats. DB constraints provide defense in depth, not
  -- permission to accept arbitrary browser JSON. Never permit extra keys.
  if jsonb_typeof(p_settings) <> 'object'
     or not (p_settings ?& array[
       'topics','mutedTopics','mutedKeywords','hiddenContentIds','discoveryOptIn','aiContent'
     ])
     or jsonb_typeof(p_settings->'discoveryOptIn') <> 'boolean' then
    return query select false, v_revision, 'invalid_settings'::text;
    return;
  end if;
  v_new_opt := (p_settings->>'discoveryOptIn')::boolean;
  if v_new_opt and not v_old_opt and
     (p_policy_version is null or
      p_policy_version !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$') then
    return query select false, v_revision, 'consent_required'::text;
    return;
  end if;
  if v_old_settings = p_settings then
    return query select true, v_revision, 'no_change'::text;
    return;
  end if;
  if v_revision = 9223372036854775807 then
    return query select false, v_revision, 'revision_exhausted'::text;
    return;
  end if;
  v_next := v_revision + 1;
  update sonara_social_private.viewer_feed_preferences as p
     set revision = v_next,
         settings = p_settings,
         discovery_consent_policy = case when v_new_opt then
           case when not v_old_opt then p_policy_version else v_old_policy end
           else null end,
         consented_at = case when v_new_opt then
           case when not v_old_opt then now() else p.consented_at end
           else null end,
         updated_at = now()
   where p.viewer_id = p_viewer_id and p.revision = v_revision;
  if not found then
    return query select false, v_revision, 'revision_conflict'::text;
    return;
  end if;
  if v_old_opt is distinct from v_new_opt then
    insert into sonara_social_private.viewer_feed_consent_events
      (viewer_id, revision, opted_in, policy_version)
    values (p_viewer_id, v_next, v_new_opt,
      case when v_new_opt then p_policy_version else v_old_policy end);
  end if;
  return query select true, v_next, 'applied'::text;
end;
$fn$;

revoke all on function sonara_social_private.cas_viewer_feed_preferences(
  uuid,bigint,jsonb,text
) from public, anon, authenticated;
grant execute on function sonara_social_private.cas_viewer_feed_preferences(
  uuid,bigint,jsonb,text
) to service_role;

-- Review checks (NOT YET RUN):
-- 1. The schema is absent from PostgREST exposed schemas.
-- 2. Anon/authenticated cannot use schema/tables/function, even with forged ID.
-- 3. A server-authenticated viewer can initialize *their own* row only.
-- 4. Two parallel expectedRevision=1 writers: exactly one applies, other conflicts.
-- 5. A stale unblock is denied; no automatic conflict retry.
-- 6. Opt-in without a consent receipt is denied; opt-out logs an append-only event.
-- 7. A failing audit insert rolls back the preference change.
-- 8. DB allows 0 third-party visibility; no cross-workspace social records.
-- 9. Rotate/revoke sessions and test post-logout writes denied by app boundary.
-- 10. SQL native replay + pgTAP + grants + RLS under isolated PostgreSQL.
