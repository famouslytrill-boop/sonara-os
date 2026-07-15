-- SONARA user notifications and integration status registry.
-- Additive and schema-only. No seed users, credentials, or provider secrets.
--
-- Reuse notes (no duplicate table purposes created):
--   saved_tool_outputs   -> served by existing public.module_outputs
--   customer_workspaces  -> served by existing public.organizations
--   workspace_memberships-> served by existing public.organization_memberships
--   service_tasks        -> served by launch_checklist_items / employee_tasks
--   service_files        -> served by public.files / creator_assets

create extension if not exists "pgcrypto";

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  category text not null default 'general',
  title text not null,
  body text,
  action_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_statuses (
  id uuid primary key default gen_random_uuid(),
  integration_key text not null unique,
  status text not null default 'setup_required',
  detail text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_notifications_user_id_idx on public.user_notifications(user_id, created_at desc);
create index if not exists user_notifications_unread_idx on public.user_notifications(user_id) where read_at is null;
create index if not exists integration_statuses_key_idx on public.integration_statuses(integration_key);

grant select, update on public.user_notifications to authenticated;
grant select, insert, update, delete on public.user_notifications to service_role;
grant select, insert, update, delete on public.integration_statuses to service_role;

alter table public.user_notifications enable row level security;
alter table public.integration_statuses enable row level security;

drop policy if exists "users can read own notifications" on public.user_notifications;
create policy "users can read own notifications"
  on public.user_notifications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users can mark own notifications read" on public.user_notifications;
create policy "users can mark own notifications read"
  on public.user_notifications
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "service role can manage user notifications" on public.user_notifications;
create policy "service role can manage user notifications"
  on public.user_notifications
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role can manage integration statuses" on public.integration_statuses;
create policy "service role can manage integration statuses"
  on public.integration_statuses
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.user_notifications is 'Per-user notifications. No secrets in titles, bodies, or metadata.';
comment on table public.integration_statuses is 'Operator-recorded integration state registry. Status labels only, never credentials.';
