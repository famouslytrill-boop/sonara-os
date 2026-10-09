-- REVIEW PROPOSAL ONLY. Not a numbered migration. DO NOT apply in production.
-- Requires isolated Supabase migration replay, grants/RLS audit, cross-tenant tests
-- and owner-approved feature activation before creating a real migration.
begin;

-- PostgreSQL needs the exact pair as a unique FK target; existing id remains PK.
create unique index if not exists creator_projects_id_org_uq
  on public.creator_projects (id, organization_id);

create table if not exists public.creator_world_bibles (
  project_id uuid primary key,
  organization_id uuid not null,
  last_editor_id uuid not null references auth.users(id),
  revision bigint not null default 1 check (revision > 0),
  draft jsonb not null check (
    jsonb_typeof(draft) = 'object'
    and octet_length(draft::text) <= 65536
    and draft ?& array['title', 'medium', 'entities', 'scenes', 'resources']
    and jsonb_typeof(draft->'entities') = 'array'
    and jsonb_typeof(draft->'scenes') = 'array'
    and jsonb_typeof(draft->'resources') = 'object'
    and jsonb_array_length(draft->'entities') <= 128
    and jsonb_array_length(draft->'scenes') between 1 and 64
  ),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_world_bibles_parent_fk
    foreign key (project_id, organization_id)
    references public.creator_projects (id, organization_id)
    on delete cascade
);
create index if not exists creator_world_bibles_org_idx
  on public.creator_world_bibles (organization_id, updated_at desc);

-- The application checks archival status before writing, but that read can
-- race another tab archiving the parent. The trigger takes a shared row lock
-- before every World Bible write so archive and save cannot cross undetected.
-- Run this on an isolated PostgreSQL branch and verify lock behavior first.
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
    raise exception 'active Creator Project required' using errcode = '23503';
  end if;
  return new;
end;
$;
revoke execute on function public.sonara_world_bible_parent_write_guard()
  from public, anon, authenticated;
grant execute on function public.sonara_world_bible_parent_write_guard()
  to service_role;
drop trigger if exists creator_world_bibles_parent_write_guard on public.creator_world_bibles;
create trigger creator_world_bibles_parent_write_guard
  before insert or update on public.creator_world_bibles
  for each row execute function public.sonara_world_bible_parent_write_guard();

alter table public.creator_world_bibles enable row level security;
revoke all on public.creator_world_bibles from public, anon, authenticated;
grant select on public.creator_world_bibles to authenticated;
grant select, insert, update on public.creator_world_bibles to service_role;
drop policy if exists creator_world_bibles_org_read on public.creator_world_bibles;
create policy creator_world_bibles_org_read
  on public.creator_world_bibles for select to authenticated
  using (public.sonara_is_org_member(organization_id));

comment on table public.creator_world_bibles is
  'DRAFT PROPOSAL: one validated and revision-checked World Bible per Creator Project; no direct browser mutations; not a media-rendered or rights-cleared artifact.';
commit;
