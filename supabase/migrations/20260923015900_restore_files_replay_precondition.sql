-- Replay compatibility bridge for the historical public.files relation.
--
-- 010_sonara_platform_current_schema.sql defines public.files, but that legacy
-- non-timestamp migration is not present in a fresh Supabase Preview replay.
-- The already-recorded 20260923020000 work-order migration references
-- public.files(id), so a fresh replay needs the relation before that migration.
--
-- This migration has not been applied to the launch production project as of
-- 2026-09-23. Keep the table declaration statically parseable so SONARA's
-- tenant-scope generator can classify it and so migration replay evidence
-- reflects the actual schema rather than dynamic SQL hidden inside EXECUTE.
--
-- files is tenant-scoped but is intentionally service-role-only here; it is not
-- an authenticated member-read table in the current policy generator.

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  storage_path text,
  status text not null default 'private',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.files enable row level security;
revoke all on table public.files from public, anon, authenticated;
grant select, insert, update, delete on table public.files to service_role;
