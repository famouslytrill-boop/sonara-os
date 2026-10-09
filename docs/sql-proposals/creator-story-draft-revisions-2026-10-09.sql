-- SONARA Industries — REVIEW-ONLY proposal. NOT an executable or applied migration.
-- This must NOT be moved into supabase/migrations until ancestor World Bible SQL
-- is repaired/replayed and PostgreSQL 16/17/18, RLS and concurrency tests pass.
-- Requires creator_projects and creator_world_bibles from upstream approved changes.
-- Limits story snapshots to 100 revisions per project; no automated pruning.
begin;

create table public.creator_story_drafts (
  project_id uuid primary key,
  organization_id uuid not null,
  world_fingerprint text not null check (world_fingerprint ~ '^[a-f0-9]{64}$'),
  revision bigint not null default 1 check (revision between 1 and 100),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  story jsonb not null check (
    jsonb_typeof(story) = 'object'
    and octet_length(story::text) <= 65536
    and story->>'schema' = 'sonara.interactive-story.v1'
    and (story->>'version') = '1'
    and jsonb_typeof(story->'scenes') = 'array'
    and jsonb_array_length(story->'scenes') between 1 and 64
    and jsonb_typeof(story->'state') = 'array'
    and jsonb_array_length(story->'state') <= 16
  ),
  last_editor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_story_drafts_parent_fk
    foreign key (project_id, organization_id)
    references public.creator_projects (id, organization_id) on delete cascade,
  constraint creator_story_drafts_project_org_unique unique (project_id, organization_id)
);
create index creator_story_drafts_org_updated_idx
  on public.creator_story_drafts (organization_id, updated_at desc);

create table public.creator_story_draft_revisions (
  project_id uuid not null,
  organization_id uuid not null,
  revision bigint not null check (revision between 1 and 100),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  world_fingerprint text not null check (world_fingerprint ~ '^[a-f0-9]{64}$'),
  story jsonb not null check (
    jsonb_typeof(story) = 'object'
    and octet_length(story::text) <= 65536
    and story->>'schema' = 'sonara.interactive-story.v1'
    and jsonb_typeof(story->'scenes') = 'array'
  ),
  editor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (project_id, revision),
  constraint creator_story_revisions_draft_fk
    foreign key (project_id, organization_id)
    references public.creator_story_drafts(project_id, organization_id)
    on delete cascade
);
create index creator_story_revisions_org_idx
  on public.creator_story_draft_revisions
  (organization_id, project_id, revision desc);

alter table public.creator_story_drafts enable row level security;
alter table public.creator_story_draft_revisions enable row level security;
-- Server-exclusive API; there is NO direct browser table read or write policy.
revoke all on public.creator_story_drafts from public, anon, authenticated, service_role;
revoke all on public.creator_story_draft_revisions from public, anon, authenticated, service_role;
grant select, insert, update on public.creator_story_drafts to service_role;
grant select, insert on public.creator_story_draft_revisions to service_role;

-- Each PostgREST RPC runs in one PG transaction. Lock the parent and World Bible
-- rows so concurrent archive and World Bible updates cannot invalidate a save.
-- SECURITY INVOKER, not SECURITY DEFINER; only service_role can call the RPC.
create function public.sonara_save_story_draft(
  p_project_id uuid,
  p_organization_id uuid,
  p_editor_id uuid,
  p_expected_revision bigint,
  p_world_fingerprint text,
  p_fingerprint text,
  p_story jsonb
)
returns table (
  revision bigint,
  fingerprint text,
  world_fingerprint text,
  updated_at timestamptz
)
language plpgsql volatile security invoker
set search_path = pg_catalog, public, pg_temp
as $sonara_rpc$
declare
  v_rev bigint;
  v_world_fingerprint text;
begin
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 100 then
    raise sqlstate 'PT409' using message = 'revision limit or invalid expected revision';
  end if;
  if p_fingerprint !~ '^[a-f0-9]{64}$' or p_world_fingerprint !~ '^[a-f0-9]{64}$'
    or p_story is null or p_story->>'schema' is distinct from 'sonara.interactive-story.v1'
    or p_story->>'worldFingerprint' is distinct from p_world_fingerprint
    or octet_length(p_story::text) > 65536 then
    raise sqlstate 'PT400' using message = 'invalid story snapshot';
  end if;
  perform 1 from public.creator_projects p
    where p.id = p_project_id and p.organization_id = p_organization_id
      and p.archived_at is null
    for share;
  if not found then raise sqlstate 'PT409' using message = 'project archived or missing'; end if;

  select w.fingerprint into v_world_fingerprint
    from public.creator_world_bibles w
    where w.project_id = p_project_id and w.organization_id = p_organization_id
    for share;
  if not found or v_world_fingerprint is distinct from p_world_fingerprint then
    raise sqlstate 'PT409' using message = 'World Bible changed or unavailable';
  end if;

  if p_expected_revision = 0 then
    insert into public.creator_story_drafts as d
      (project_id, organization_id, world_fingerprint, revision, fingerprint, story, last_editor_id)
    values (p_project_id, p_organization_id, p_world_fingerprint, 1,
      p_fingerprint, p_story, p_editor_id)
    on conflict (project_id) do nothing
    returning d.revision into v_rev;
  else
    update public.creator_story_drafts as d
      set revision = d.revision + 1, fingerprint = p_fingerprint,
          story = p_story, last_editor_id = p_editor_id, updated_at = now()
    where d.project_id = p_project_id and d.organization_id = p_organization_id
      and d.revision = p_expected_revision
      and d.world_fingerprint = p_world_fingerprint
    returning d.revision into v_rev;
  end if;
  if v_rev is null then
    raise sqlstate 'PT409' using message = 'story draft revision conflict';
  end if;

  insert into public.creator_story_draft_revisions
    (project_id, organization_id, revision, world_fingerprint, fingerprint, story, editor_id)
  values (p_project_id, p_organization_id, v_rev, p_world_fingerprint,
    p_fingerprint, p_story, p_editor_id);
  return query select d.revision, d.fingerprint, d.world_fingerprint, d.updated_at
    from public.creator_story_drafts d
    where d.project_id = p_project_id and d.organization_id = p_organization_id;
end;
$sonara_rpc$;
revoke all on function public.sonara_save_story_draft(
  uuid, uuid, uuid, bigint, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.sonara_save_story_draft(
  uuid, uuid, uuid, bigint, text, text, jsonb
) to service_role;

comment on table public.creator_story_drafts is
  'PROPOSED: 100-revision bounded latest story snapshots; writes only via approved service-role RPC. Never client accessible.';
comment on table public.creator_story_draft_revisions is
  'PROPOSED: private append-only saved story revision snapshots; no user-facing automatic publishing.';
commit;
