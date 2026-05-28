do $$
begin
  create extension if not exists vector;
exception
  when others then
    raise notice 'pgvector extension is not available yet; SONARA memory will store text and metadata until enabled.';
end $$;

create table if not exists public.sonara_memory_records (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null check (
    kind in (
      'project',
      'prompt',
      'export',
      'sound_asset',
      'release_plan',
      'authentic_writer_note',
      'brand_doc',
      'support_feedback',
      'store_product',
      'research_note'
    )
  ),
  title text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from pg_type where typname = 'vector') then
    alter table public.sonara_memory_records
      add column if not exists embedding vector(1536);
    comment on column public.sonara_memory_records.embedding is
      'Placeholder 1536-dimension vector. Final dimension must match the chosen embedding model.';
  else
    alter table public.sonara_memory_records
      add column if not exists embedding jsonb;
    comment on column public.sonara_memory_records.embedding is
      'JSON fallback used when pgvector is unavailable. Enable pgvector before semantic search launch.';
  end if;
end $$;

create index if not exists sonara_memory_records_user_kind_idx
  on public.sonara_memory_records (user_id, kind, updated_at desc);

create index if not exists sonara_memory_records_kind_idx
  on public.sonara_memory_records (kind);

alter table public.sonara_memory_records enable row level security;

drop policy if exists "Users can read own SONARA memory records" on public.sonara_memory_records;
create policy "Users can read own SONARA memory records"
  on public.sonara_memory_records
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own SONARA memory records" on public.sonara_memory_records;
create policy "Users can insert own SONARA memory records"
  on public.sonara_memory_records
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Service role can manage SONARA memory records" on public.sonara_memory_records;
create policy "Service role can manage SONARA memory records"
  on public.sonara_memory_records
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
