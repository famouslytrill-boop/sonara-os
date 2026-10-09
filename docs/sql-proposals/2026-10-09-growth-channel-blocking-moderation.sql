-- SONARA PROPOSAL ONLY. NOT A DEPLOYABLE MIGRATION.
-- Create a real migration with "supabase migration new" in the reviewed project
-- after production mapping, historical checksums and rollback are confirmed.
-- Run against an isolated database branch; this file was NOT executed.
--
-- Existing canonical tables reused:
-- growth_channels, growth_channel_posts, growth_post_reports, organization_memberships.
-- No changes to the anonymous growth_post_reports identity-free contract.

create table if not exists public.growth_channel_blocks (
  viewer_user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid not null references public.growth_channels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_user_id, channel_id)
);
create index if not exists growth_channel_blocks_by_channel
 on public.growth_channel_blocks(channel_id);
alter table public.growth_channel_blocks enable row level security;
revoke all on public.growth_channel_blocks from public, anon, authenticated;
grant select, insert, delete on public.growth_channel_blocks to service_role;

-- Only the server-side RPC is an application write path. A lock keyed by actor
-- serializes blocks against other channels and closes the concurrent quota race.
-- Returning distinct reason codes lets HTTP deny a full account without showing
-- a false "saved" receipt. A block cannot exceed the 500-row read boundary.
create or replace function public.sonara_growth_channel_block_action(
  p_actor_user_id uuid,
  p_channel_id uuid,
  p_action text
)
returns text language plpgsql security invoker
set search_path = ''
as $$
begin
  if p_actor_user_id is null or p_channel_id is null
    or p_action not in ('block', 'unblock')
    or not exists (select 1 from auth.users u where u.id = p_actor_user_id)
  then return 'denied'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_user_id::text, 40105));

  if p_action = 'unblock' then
    delete from public.growth_channel_blocks
     where viewer_user_id = p_actor_user_id and channel_id = p_channel_id;
    return 'unblocked';
  end if;

  if not exists (
    select 1 from public.growth_channels c
    where c.id = p_channel_id and c.state = 'public'
  ) then return 'unknown_channel'; end if;
  if exists (
    select 1 from public.growth_channel_blocks
     where viewer_user_id = p_actor_user_id and channel_id = p_channel_id
  ) then return 'blocked'; end if;
  if (
    select count(*) from public.growth_channel_blocks
    where viewer_user_id = p_actor_user_id
  ) >= 500 then return 'block_limit_reached'; end if;

  insert into public.growth_channel_blocks(viewer_user_id, channel_id)
  values (p_actor_user_id, p_channel_id);
  return 'blocked';
end;
$$;
revoke all on function public.sonara_growth_channel_block_action(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.sonara_growth_channel_block_action(uuid,uuid,text)
  to service_role;

-- Moderation history is append-only. Do not delete or edit past decisions.
create table if not exists public.growth_channel_moderation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  post_id uuid not null references public.growth_channel_posts(id),
  actor_user_id uuid not null references auth.users(id),
  action text not null check (action in ('remove','restore','dismiss')),
  created_at timestamptz not null default now()
);
create index if not exists growth_channel_moderation_events_owner
 on public.growth_channel_moderation_events(organization_id, created_at desc);
alter table public.growth_channel_moderation_events enable row level security;
revoke all on public.growth_channel_moderation_events from public, anon, authenticated;
grant select, insert on public.growth_channel_moderation_events to service_role;

-- Atomic status change and append-only audit, invoked server-side ONLY
-- after session validation. SECURITY INVOKER: no hidden privilege escalation.
-- Service-role callers cannot invent membership to obtain permissions:
-- membership is checked against current authoritative DB records.
create or replace function public.sonara_moderate_growth_post(
  p_organization_id uuid,
  p_post_id uuid,
  p_actor_user_id uuid,
  p_action text
)
returns boolean language plpgsql security invoker
set search_path = ''
as $$
declare
  v_post public.growth_channel_posts%rowtype;
begin
  if p_action not in ('remove','restore','dismiss') then return false; end if;
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = p_actor_user_id
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  ) then return false; end if;

  select * into v_post
  from public.growth_channel_posts
  where organization_id = p_organization_id and id = p_post_id
  for update;
  if not found then return false; end if;

  if p_action = 'remove' then
    -- The post lock serializes concurrent attempts. Repeat remove succeeds
    -- without a second audit event, even across two browser tabs.
    if v_post.state = 'removed' then return true; end if;
    update public.growth_channel_posts
      set state = 'removed', removed_at = now(), updated_at = now()
      where id = p_post_id and organization_id = p_organization_id;
    update public.growth_post_reports
      set state = 'actioned', decided_at = now()
      where post_id = p_post_id and organization_id = p_organization_id and state = 'open';
  elsif p_action = 'restore' then
    if v_post.state = 'published' then return true; end if;
    update public.growth_channel_posts
      set state = 'published', removed_at = null, updated_at = now()
      where id = p_post_id and organization_id = p_organization_id;
  else
    if v_post.state <> 'published' then return false; end if;
    update public.growth_post_reports
      set state = 'dismissed', decided_at = now()
      where post_id = p_post_id and organization_id = p_organization_id and state = 'open';
    if not found then return false; end if;
  end if;
  insert into public.growth_channel_moderation_events
    (organization_id, post_id, actor_user_id, action)
  values (p_organization_id, p_post_id, p_actor_user_id, p_action);
  return true;
end;
$$;
revoke all on function public.sonara_moderate_growth_post(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.sonara_moderate_growth_post(uuid,uuid,uuid,text) to service_role;
notify pgrst, 'reload schema';

-- Verification requirements on a test DB before promotion:
-- 1. Both tables have RLS, no anon/auth grants and no broad policies.
-- 2. Normal member and cross-tenant actor cannot moderate even through RPC.
-- 3. Remove/dismiss/restore status and audit commit together, replay safe.
-- 4. No report identity columns appear on growth_post_reports.
-- 5. Aborted writes create no audit and a failed audit rolls back the status.
-- 6. Run full migration replay and access grants verifier before approval.

-- Required negative tests: an actor with 500 saved blocks cannot add a 501st;
-- re-blocking one of those 500 is idempotently successful; unblock still works;
-- concurrent blocks against distinct channels cannot bypass quota; unknown
-- or private channel IDs do not create rows; direct client grants stay revoked.
