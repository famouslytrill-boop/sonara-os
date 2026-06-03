-- User preference persistence for language and metric/imperial settings.
-- Append-only: do not edit historical migrations or schema_migrations rows.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  language text not null default 'en-US',
  unit_system text not null default 'imperial',
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint user_preferences_language_allowed_chk check (language in ('en-US','es','fr','pt-BR')),
  constraint user_preferences_unit_system_allowed_chk check (unit_system in ('imperial','metric'))
);

alter table public.user_preferences
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists language text not null default 'en-US',
  add column if not exists unit_system text not null default 'imperial',
  add column if not exists timezone text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_preferences_language_allowed_chk'
      and conrelid = 'public.user_preferences'::regclass
  ) then
    alter table public.user_preferences
      add constraint user_preferences_language_allowed_chk
      check (language in ('en-US','es','fr','pt-BR')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_preferences_unit_system_allowed_chk'
      and conrelid = 'public.user_preferences'::regclass
  ) then
    alter table public.user_preferences
      add constraint user_preferences_unit_system_allowed_chk
      check (unit_system in ('imperial','metric')) not valid;
  end if;
end $$;

create index if not exists user_preferences_organization_id_idx
  on public.user_preferences (organization_id)
  where organization_id is not null;

alter table public.user_preferences enable row level security;

drop policy if exists "users can read own preferences" on public.user_preferences;
create policy "users can read own preferences"
  on public.user_preferences
  for select
  using (user_id = auth.uid() or auth.role() = 'service_role');

drop policy if exists "users can insert own preferences" on public.user_preferences;
create policy "users can insert own preferences"
  on public.user_preferences
  for insert
  with check (user_id = auth.uid());

drop policy if exists "users can update own preferences" on public.user_preferences;
create policy "users can update own preferences"
  on public.user_preferences
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "service role can manage user preferences" on public.user_preferences;
create policy "service role can manage user preferences"
  on public.user_preferences
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
