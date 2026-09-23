-- Replay compatibility bridge for the historical public.files relation.
--
-- 010_sonara_platform_current_schema.sql defines public.files, but that legacy
-- non-timestamp migration is not present in a fresh Supabase Preview replay.
-- The already-recorded 20260923020000 work-order migration references
-- public.files(id), so a fresh replay stops before it can create the work-order
-- evidence table.
--
-- The recorded work-order migration is immutable. This bridge sorts immediately
-- before it and recreates only its missing precondition. Production uses
-- supabase db push --include-all, so an earlier compatibility version can be
-- recorded safely. If public.files already exists, this migration is a true
-- no-op and does not change that table's privileges, policies, columns, or data.
--
-- On a fresh replay the restored relation uses the exact historical shape.
-- It remains server/service-role only here; files is tenant-scoped but is not an
-- authenticated member-read table in the current policy generator.

do $bridge$
begin
  if to_regclass('public.files') is not null then
    raise notice 'files replay bridge: public.files already exists; no change required';
    return;
  end if;

  execute $create$
    create table public.files (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      name text not null,
      storage_path text,
      status text not null default 'private',
      created_by uuid,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      metadata jsonb not null default '{}'::jsonb
    )
  $create$;

  execute 'alter table public.files enable row level security';
  execute 'revoke all on table public.files from public, anon, authenticated';
  execute 'grant select, insert, update, delete on table public.files to service_role';

  if to_regclass('public.files') is null then
    raise exception 'files replay bridge failed: public.files was not created';
  end if;
end
$bridge$;
