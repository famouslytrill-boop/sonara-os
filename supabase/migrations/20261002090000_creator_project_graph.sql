-- One atomically replaceable graph snapshot per project. Existing asset files
-- stay in creator_assets/storage; this table contains references, never bytes.
-- Direct authenticated writes are deliberately absent: the server validates
-- each source against the resolved organization before it accepts a graph.
begin;
create table if not exists public.creator_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 180),
  medium text not null check (medium in ('audio', 'video', 'image', 'mixed')),
  revision integer not null default 1 check (revision > 0),
  graph jsonb not null default '{"version":1,"nodes":[],"edges":[]}'::jsonb
    check (graph ?& array['version', 'nodes', 'edges'] and jsonb_typeof(graph) = 'object' and graph @> '{"version":1}'::jsonb
      and jsonb_typeof(graph->'nodes') = 'array' and jsonb_typeof(graph->'edges') = 'array'
      and jsonb_array_length(graph->'nodes') <= 500),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_projects_workspace_updated_idx on public.creator_projects(organization_id, updated_at desc);
alter table public.creator_projects enable row level security;
revoke all on public.creator_projects from public, anon, authenticated;
grant select on public.creator_projects to authenticated;
grant all on public.creator_projects to service_role;
drop policy if exists creator_projects_member_read on public.creator_projects;
create policy creator_projects_member_read on public.creator_projects for select to authenticated
  using (public.sonara_is_org_member(organization_id));
comment on table public.creator_projects is 'Creator Project Graph v1: sources, timeline clips and captions. Mutations use a validated server module with tenant filters and expected revision; exports are manifests, not rendered media or rights clearance.';
commit;
