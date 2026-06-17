-- SONARA Industries launch roles and user preferences.
-- Schema-only migration. No seed users, real emails, passwords, tokens, API keys, or provider secrets.
-- service_role policies grant server-side permissions; they are not secret values.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'customer')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.profile_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language_preference text not null default 'en',
  unit_preference text not null default 'us' check (unit_preference in ('us', 'metric', 'imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_roles_user_idx on public.user_roles(user_id);
create index if not exists user_roles_role_idx on public.user_roles(role);

alter table public.user_roles enable row level security;
alter table public.profile_settings enable row level security;

grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.user_roles to service_role;
grant select, insert, update on public.profile_settings to authenticated;
grant select, insert, update, delete on public.profile_settings to service_role;

drop policy if exists "user_roles_self_select" on public.user_roles;
create policy "user_roles_self_select"
on public.user_roles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "service_role_user_roles_all" on public.user_roles;
create policy "service_role_user_roles_all"
on public.user_roles
for all
to service_role
using (true)
with check (true);

drop policy if exists "profile_settings_self_select" on public.profile_settings;
create policy "profile_settings_self_select"
on public.profile_settings
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "profile_settings_self_insert" on public.profile_settings;
create policy "profile_settings_self_insert"
on public.profile_settings
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "profile_settings_self_update" on public.profile_settings;
create policy "profile_settings_self_update"
on public.profile_settings
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "service_role_profile_settings_all" on public.profile_settings;
create policy "service_role_profile_settings_all"
on public.profile_settings
for all
to service_role
using (true)
with check (true);

drop trigger if exists profile_settings_set_updated_at on public.profile_settings;
create trigger profile_settings_set_updated_at
before update on public.profile_settings
for each row execute function public.set_updated_at();

comment on table public.user_roles is 'Application roles for owner, admin, and customer authorization. Contains no credentials or secret values.';
comment on table public.profile_settings is 'Customer preferences for language and unit display. Contains no provider credentials.';
