-- SONARA Industries owner access and employee role hardening.
-- Schema-only migration. No seed users, real emails, passwords, tokens, API keys, webhook secrets, or provider credentials.
-- Durable roles remain assigned by server-side/admin processes only.

-- Fresh Supabase preview branches replay migrations from an empty public schema.
-- Create the role table here because this migration constrains it before the
-- later consolidated runtime migration verifies the same table definition.
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'user_roles'
      and constraint_name = 'user_roles_role_check'
  ) then
    alter table public.user_roles
      drop constraint user_roles_role_check;
  end if;
end $$;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('owner', 'admin', 'customer', 'employee'));

create index if not exists user_roles_user_role_idx
on public.user_roles(user_id, role);

comment on table public.user_roles is 'Application roles for owner, admin, customer, and employee authorization. Contains no credentials or secret values.';
