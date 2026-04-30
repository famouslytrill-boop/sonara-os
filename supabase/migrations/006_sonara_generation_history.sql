create table if not exists public.sonara_generation_history (
  id text primary key,
  user_id uuid null,
  parent_id text null,
  project_id text null,
  engine_name text not null,
  engine_version text not null,
  input_hash text not null,
  input_data jsonb not null default '{}'::jsonb,
  settings_snapshot jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  label text null,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sonara_generation_history_user_id_idx on public.sonara_generation_history (user_id);
create index if not exists sonara_generation_history_project_id_idx on public.sonara_generation_history (project_id);
create index if not exists sonara_generation_history_engine_name_idx on public.sonara_generation_history (engine_name);
create index if not exists sonara_generation_history_input_hash_idx on public.sonara_generation_history (input_hash);
create index if not exists sonara_generation_history_created_at_idx on public.sonara_generation_history (created_at);

alter table public.sonara_generation_history enable row level security;

do $$
begin
  create policy "Users can select own generation history"
    on public.sonara_generation_history
    for select
    using (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users can insert own generation history"
    on public.sonara_generation_history
    for insert
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;
