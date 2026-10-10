-- DESIGN PROPOSAL ONLY — NOT A MIGRATION, NOT APPLIED.
-- Requires migration CLI generation, independent schema review, rollback,
-- cross-tenant replay and approved provider/project identification.
-- Reuses creator_artist_profiles and creator_follows instead of duplicate users.
-- This must be deployed BEFORE enabling SONARA_SOCIAL_USER_SAFETY_ENABLED.

create table if not exists public.sonara_social_user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  source_profile_id uuid references public.creator_artist_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  constraint social_block_not_self check (blocker_user_id <> blocked_user_id)
);
create index if not exists sonara_social_user_blocks_target_idx
 on public.sonara_social_user_blocks(blocked_user_id, blocker_user_id);
alter table public.sonara_social_user_blocks enable row level security;
revoke all on public.sonara_social_user_blocks from PUBLIC, anon, authenticated, service_role;
grant select, insert, delete on public.sonara_social_user_blocks to service_role;

create table if not exists public.sonara_social_profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  subject_profile_id uuid not null references public.creator_artist_profiles(id),
  subject_user_id uuid references auth.users(id) on delete set null,
  request_id uuid not null,
  reason text not null check (
    reason in ('spam','harassment','hate','violence','sexual','illegal','impersonation','privacy','other')
  ),
  detail text check (detail is null or char_length(detail) <= 500),
  state text not null default 'open'
    check (state in ('open','under_review','escalated','dismissed','actioned')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (reporter_user_id, request_id)
);
create index if not exists sonara_social_profile_reports_queue
 on public.sonara_social_profile_reports(state, created_at);
alter table public.sonara_social_profile_reports enable row level security;
revoke all on public.sonara_social_profile_reports from PUBLIC, anon, authenticated, service_role;
grant select, insert, update on public.sonara_social_profile_reports to service_role;
-- Reporting alone does not remove content. Platform-owned review and appeals
-- require a separate authorization grant and decision audit in a future wave.

-- Locks the same actor pair in both follow and block paths. This is deliberately
-- restrictive: a blocked relationship must not re-follow during a race.
create or replace function public.sonara_social_lock_pair(p_one uuid, p_two uuid)
returns void language plpgsql security invoker
set search_path = ''
as $$
declare
  a text := least(p_one::text, p_two::text);
  b text := greatest(p_one::text, p_two::text);
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a, 19693));
  if a <> b then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(b, 19693));
  end if;
end;
$$;

-- This database trigger catches any direct follow-table insert, including
-- older routes that bypass the new safety API. No request metadata is trusted.
create or replace function public.sonara_creator_follow_block_guard()
returns trigger language plpgsql security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner
    from public.creator_artist_profiles where id = new.artist_profile_id;
  if v_owner is null then return new; end if;
  if v_owner = new.follower_user_id then return new; end if;
  perform public.sonara_social_lock_pair(new.follower_user_id, v_owner);
  if exists (
    select 1 from public.sonara_social_user_blocks b
     where (b.blocker_user_id = new.follower_user_id and b.blocked_user_id = v_owner)
        or (b.blocker_user_id = v_owner and b.blocked_user_id = new.follower_user_id)
  ) then
    raise exception 'social_relationship_blocked' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists sonara_creator_follow_block_guard on public.creator_follows;
create trigger sonara_creator_follow_block_guard
before insert on public.creator_follows
for each row execute function public.sonara_creator_follow_block_guard();

-- The service-role server supplies its session-verified actor and a PUBLIC
-- creator profile id. The database resolves target user_id privately.
-- On block, revoke both directions of creator follow relationships immediately.
create or replace function public.sonara_social_profile_action(
  p_actor_user_id uuid,
  p_profile_id uuid,
  p_action text,
  p_reason text default null,
  p_detail text default null,
  p_request_id uuid default null
)
returns text language plpgsql security invoker
set search_path = ''
as $$
declare
  v_profile record;
  v_existing record;
begin
  if p_actor_user_id is null or not exists (
    select 1 from auth.users where id = p_actor_user_id
  ) then return 'denied'; end if;
  if p_action not in ('block','unblock','report') then return 'denied'; end if;
  select id, user_id, public_handle, published_at, status
    into v_profile from public.creator_artist_profiles where id = p_profile_id;
  if not found then return 'denied'; end if;
  if v_profile.user_id = p_actor_user_id then return 'denied'; end if;

  if p_action = 'report' then
    if v_profile.public_handle is null and v_profile.published_at is null then return 'denied'; end if;
    if p_request_id is null or p_reason is null or p_reason not in
      ('spam','harassment','hate','violence','sexual','illegal','impersonation','privacy','other')
      or p_detail is null or char_length(p_detail) > 500
    then return 'denied'; end if;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_actor_user_id::text, 74531));
    select subject_profile_id, reason, detail into v_existing
      from public.sonara_social_profile_reports
      where reporter_user_id = p_actor_user_id and request_id = p_request_id;
    if found then
      if v_existing.subject_profile_id = p_profile_id
         and v_existing.reason = p_reason
         and v_existing.detail is not distinct from p_detail
      then return 'already_reported'; end if;
      -- A repeated receipt for a different person, reason or evidence must
      -- NOT falsely claim that the new report was submitted.
      return 'idempotency_conflict';
    end if;
    if (
      select count(*) from public.sonara_social_profile_reports
       where reporter_user_id = p_actor_user_id
         and created_at > now() - interval '24 hours'
    ) >= 10 then return 'rate_limited'; end if;
    insert into public.sonara_social_profile_reports
      (reporter_user_id, subject_profile_id, subject_user_id,
       request_id, reason, detail)
    values (p_actor_user_id, p_profile_id, v_profile.user_id,
      p_request_id, p_reason, p_detail);
    return 'reported';
  end if;

  if v_profile.user_id is null then return 'no_account_owner'; end if;
  -- Serialise each person's block cap against their other blocks, rather than
  -- relying solely on the target-pair lock. Concurrent distinct targets must
  -- not evade the account cap.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_user_id::text, 74531));
  perform public.sonara_social_lock_pair(p_actor_user_id, v_profile.user_id);
  if p_action = 'block' then
    if v_profile.status <> 'active' or v_profile.public_handle is null then return 'denied'; end if;
    if not exists (
      select 1 from public.sonara_social_user_blocks
       where blocker_user_id = p_actor_user_id and blocked_user_id = v_profile.user_id
    ) then
      -- Prevent unbounded bulk-block creation by one account.
      if (select count(*) from public.sonara_social_user_blocks
           where blocker_user_id = p_actor_user_id) >= 200
      then return 'rate_limited'; end if;
      insert into public.sonara_social_user_blocks
        (blocker_user_id, blocked_user_id, source_profile_id)
      values (p_actor_user_id, v_profile.user_id, p_profile_id)
      on conflict (blocker_user_id, blocked_user_id) do nothing;
    end if;
    delete from public.creator_follows f using public.creator_artist_profiles ap
     where f.artist_profile_id = ap.id
       and ((f.follower_user_id = p_actor_user_id and ap.user_id = v_profile.user_id)
         or (f.follower_user_id = v_profile.user_id and ap.user_id = p_actor_user_id));
    return 'blocked';
  end if;
  delete from public.sonara_social_user_blocks
    where blocker_user_id = p_actor_user_id and blocked_user_id = v_profile.user_id;
  return 'unblocked';
end;
$$;

-- A user's list remains accessible if a creator deletes or unpublishes a
-- profile, and contains only public-safe labels.
create or replace function public.sonara_my_social_blocks(p_actor_user_id uuid)
returns jsonb language sql stable security invoker
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'blocked_user_id', b.blocked_user_id,
     'handle', p.public_handle,
     'name', case when p.public_handle is not null and p.status = 'active'
       then left(p.artist_name,120) else null end
  ) order by b.created_at desc), '[]'::jsonb)
  from public.sonara_social_user_blocks b
    left join public.creator_artist_profiles p on p.id = b.source_profile_id
  where b.blocker_user_id = p_actor_user_id
$$;

create or replace function public.sonara_unblock_social_user(p_actor_user_id uuid, p_target_user_id uuid)
returns boolean language plpgsql security invoker
set search_path = ''
as $$
begin
  if p_actor_user_id is null or p_target_user_id is null then return false; end if;
  perform public.sonara_social_lock_pair(p_actor_user_id, p_target_user_id);
  delete from public.sonara_social_user_blocks
   where blocker_user_id = p_actor_user_id and blocked_user_id = p_target_user_id;
  return true;
end;
$$;

-- Read-only policy result for the signed-in viewer. Never reveal that the
-- creator has blocked the viewer: simply return 'unavailable'.
create or replace function public.sonara_social_creator_state(
  p_actor_user_id uuid, p_profile_id uuid
)
returns text language sql stable security invoker
set search_path = ''
as $$
  select case
    when p.user_id is null then 'no_owner'
    when p.user_id = p_actor_user_id then 'self'
    when exists (select 1 from public.sonara_social_user_blocks b
      where b.blocker_user_id = p_actor_user_id and b.blocked_user_id = p.user_id) then 'blocked_by_me'
    when exists (select 1 from public.sonara_social_user_blocks b
      where b.blocker_user_id = p.user_id and b.blocked_user_id = p_actor_user_id) then 'unavailable'
    else 'allowed' end
  from public.creator_artist_profiles p
  where p.id = p_profile_id and p.status = 'active' and p.public_handle is not null
$$;

-- In this architecture ALL RPC calls must originate inside the trusted server.
-- API SQL functions are not available to clients, even signed-in clients.
revoke all on function public.sonara_social_lock_pair(uuid,uuid) from PUBLIC, anon, authenticated;
revoke all on function public.sonara_creator_follow_block_guard() from PUBLIC, anon, authenticated;
revoke all on function public.sonara_social_profile_action(uuid,uuid,text,text,text,uuid) from PUBLIC, anon, authenticated;
revoke all on function public.sonara_my_social_blocks(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.sonara_unblock_social_user(uuid,uuid) from PUBLIC, anon, authenticated;
revoke all on function public.sonara_social_creator_state(uuid,uuid) from PUBLIC, anon, authenticated;
grant execute on function public.sonara_social_profile_action(uuid,uuid,text,text,text,uuid) to service_role;
grant execute on function public.sonara_my_social_blocks(uuid) to service_role;
grant execute on function public.sonara_unblock_social_user(uuid,uuid) to service_role;
grant execute on function public.sonara_social_creator_state(uuid,uuid) to service_role;
-- Trigger invokes its helper as the current DB role; service-role application
-- writes require appropriate execution grants, but no grants to the public.
grant execute on function public.sonara_social_lock_pair(uuid,uuid) to service_role;
grant execute on function public.sonara_creator_follow_block_guard() to service_role;
notify pgrst, 'reload schema';

-- REQUIRED TESTS BEFORE MIGRATION PROMOTION:
-- 1. Cross-tenant identity cannot be supplied by public request; only server
--    verified session user enters the RPC payload.
-- 2. Unrelated user cannot read block/report tables through Data API.
-- 3. Block transaction removes both directions of existing creator follows;
--    direct follow inserts are rejected, including concurrent requests.
-- 4. Reports with same request_id dedupe, and >10 distinct in 24h refuse.
-- 5. No reporter, block or moderation data leaks onto public projections.
-- 6. Unblock works on unpublished targets; report works on previously
--    published suspended profiles; absent profile returns safe denied.
-- 7. Any failed SQL statement rolls back all changes atomically.
-- 8. Run psql migration replay, security advisors and rollback rehearsal.


-- ----------------------------------------------------------------------------
-- Independent platform moderation: append-only decisions, no auto-removals.
-- Moderators MUST be manually approved by a separately audited platform
-- administrator. No tenant admin receives this cross-tenant grant by default.
-- ----------------------------------------------------------------------------

create table if not exists public.sonara_social_moderator_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default false,
  approved_by_user_id uuid references auth.users(id),
  approved_at timestamptz,
  constraint social_moderator_approval check (
    not active or (approved_by_user_id is not null and approved_at is not null)
  )
);
alter table public.sonara_social_moderator_grants enable row level security;
revoke all on public.sonara_social_moderator_grants from PUBLIC, anon, authenticated, service_role;
grant select on public.sonara_social_moderator_grants to service_role;
-- Provisioning and revocation are out-of-band audited administrator operations.
-- No web client insert/update grant exists for this sensitive roster.

create table if not exists public.sonara_social_report_review_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.sonara_social_profile_reports(id),
  reviewer_user_id uuid not null references auth.users(id),
  decision text not null check (decision in ('dismiss','escalate','reopen')),
  explanation text not null check (char_length(explanation) between 1 and 500),
  decided_at timestamptz not null default now()
);
create index if not exists sonara_social_report_review_events_report_idx
  on public.sonara_social_report_review_events(report_id, decided_at);
alter table public.sonara_social_report_review_events enable row level security;
revoke all on public.sonara_social_report_review_events from PUBLIC, anon, authenticated, service_role;
grant select, insert on public.sonara_social_report_review_events to service_role;

create or replace function public.sonara_social_moderation_queue(
  p_reviewer_user_id uuid,
  p_limit integer default 40
)
returns jsonb language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_reports jsonb;
begin
  if not exists (
    select 1 from public.sonara_social_moderator_grants g
    where g.user_id = p_reviewer_user_id and g.active is true
      and g.approved_by_user_id is not null and g.approved_at is not null
  ) then return pg_catalog.jsonb_build_object('authorized', false, 'reports', '[]'::jsonb); end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', q.id, 'profile_id', q.subject_profile_id,
    'reason', q.reason, 'detail', q.detail, 'state', q.state,
    'created_at', q.created_at
  ) order by q.created_at), '[]'::jsonb)
  into v_reports
  from (
    select id, subject_profile_id, reason, detail, state, created_at
    from public.sonara_social_profile_reports
    where state in ('open','under_review','escalated')
    order by created_at asc
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
  ) q;
  return pg_catalog.jsonb_build_object('authorized', true, 'reports', v_reports);
end;
$$;

create or replace function public.sonara_social_decide_report(
  p_reviewer_user_id uuid,
  p_report_id uuid,
  p_decision text,
  p_explanation text
)
returns text language plpgsql security invoker
set search_path = ''
as $$
declare
  v_row public.sonara_social_profile_reports%rowtype;
  v_next text;
begin
  if not exists (
    select 1 from public.sonara_social_moderator_grants g
    where g.user_id = p_reviewer_user_id and g.active is true
      and g.approved_by_user_id is not null and g.approved_at is not null
  ) then return 'denied'; end if;
  if p_decision is null or p_decision not in ('dismiss','escalate','reopen') or p_explanation is null
    or char_length(trim(p_explanation)) not between 1 and 500
  then return 'denied'; end if;

  select * into v_row
    from public.sonara_social_profile_reports
    where id = p_report_id
    for update;
  if not found then return 'denied'; end if;

  v_next := case p_decision
    when 'dismiss' then 'dismissed'
    when 'escalate' then 'escalated'
    when 'reopen' then 'open'
  end;
  if v_row.state = v_next then return 'already_done'; end if;
  if p_decision = 'reopen' and v_row.state not in ('dismissed','escalated') then return 'denied'; end if;
  if p_decision = 'escalate' and v_row.state not in ('open','under_review') then return 'denied'; end if;
  if p_decision = 'dismiss' and v_row.state not in ('open','under_review','escalated') then return 'denied'; end if;

  update public.sonara_social_profile_reports
     set state = v_next, decided_at = now()
   where id = p_report_id;
  insert into public.sonara_social_report_review_events
    (report_id, reviewer_user_id, decision, explanation)
  values (p_report_id, p_reviewer_user_id, p_decision, trim(p_explanation));
  return 'reviewed';
end;
$$;

revoke all on function public.sonara_social_moderation_queue(uuid,integer)
  from PUBLIC, anon, authenticated;
revoke all on function public.sonara_social_decide_report(uuid,uuid,text,text)
  from PUBLIC, anon, authenticated;
grant execute on function public.sonara_social_moderation_queue(uuid,integer) to service_role;
grant execute on function public.sonara_social_decide_report(uuid,uuid,text,text) to service_role;
notify pgrst, 'reload schema';

-- Reviewer-verification acceptance:
-- - No provisioned reviewer => authorized:false and empty queue.
-- - Revoked grant => reviewer cannot list or decide, including cached sessions.
-- - An ordinary tenant owner/admin cannot review reports from other tenants.
-- - Concurrent conflicting decisions serialize on report FOR UPDATE.
-- - Decisions create exactly one audit row on an actual state transition.
-- - A report can be dismissed/escalated/reopened, but a report alone never
--   suspends a profile. Separate takedown and appeal policy work remains.
