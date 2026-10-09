-- REVIEW-ONLY SQL PROPOSAL. DO NOT RUN ON PRODUCTION.
-- After isolated Supabase CLI migration generation and a native RLS replay,
-- promote this into a new, properly numbered migration. No application route
-- may be enabled until the real migration and verification are complete.
begin;

-- The existing project's id is unique; this nonpartial composite unique index
-- additionally lets the child FK enforce matching organization IDs.
create unique index if not exists creator_projects_id_org_world_bible_ux
  on public.creator_projects (id, organization_id);

create table if not exists public.creator_world_bibles (
  project_id uuid primary key,
  organization_id uuid not null,
  created_by uuid not null references auth.users(id),
  revision integer not null default 1 check (revision between 1 and 2147483647),
  source jsonb not null
    check (jsonb_typeof(source) = 'object'
      and octet_length(source::text) <= 65536
      and source ?& array['title','medium','scenes','entities','resources']),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_world_bibles_creator_project_fk
    foreign key (project_id, organization_id)
    references public.creator_projects (id, organization_id)
    on delete cascade
);
create index if not exists creator_world_bibles_tenant_updated_idx
  on public.creator_world_bibles (organization_id, updated_at desc);

-- Lock the parent against concurrent archive/update while a World Bible is
-- written. Application checks alone would have a read-then-archive race.
create or replace function public.sonara_world_bible_parent_write_guard()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp as $
begin
  perform 1 from public.creator_projects
    where id = new.project_id
      and organization_id = new.organization_id
      and archived_at is null
    for share;
  if not found then
    raise exception 'active creator project required' using errcode = '23503';
  end if;
  return new;
end;
$;
revoke all on function public.sonara_world_bible_parent_write_guard() from public, anon, authenticated;
grant execute on function public.sonara_world_bible_parent_write_guard() to service_role;
drop trigger if exists creator_world_bibles_parent_write_guard on public.creator_world_bibles;
create trigger creator_world_bibles_parent_write_guard
  before insert or update on public.creator_world_bibles
  for each row execute function public.sonara_world_bible_parent_write_guard();

alter table public.creator_world_bibles enable row level security;
revoke all on table public.creator_world_bibles from public, anon, authenticated, service_role;
-- Supabase Data API exposure increasingly requires explicit grants; these
-- rights intentionally do NOT allow browser writes.
grant select on table public.creator_world_bibles to authenticated;
grant select, insert, update on table public.creator_world_bibles to service_role;

drop policy if exists creator_world_bibles_org_read on public.creator_world_bibles;
create policy creator_world_bibles_org_read on public.creator_world_bibles
  for select to authenticated
  using (public.sonara_is_org_member(organization_id));

comment on table public.creator_world_bibles is
  'Source-only World Bible attachment to a Creator Project. Writes are server-validated, tenant-scoped, optimistic-CAS. No media assets, licenses, generation or publishing authority.';

commit;
