create extension if not exists pgcrypto;

do $$
begin
  create type public.entity_type as enum (
    'parent_company',
    'creator_music_technology',
    'business_operations',
    'community_public_information'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.entity_member_role as enum ('owner', 'admin', 'operator', 'viewer');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  entity_type public.entity_type not null,
  description text not null,
  status text not null default 'setup_required',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_memberships (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.entity_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, user_id)
);

create table if not exists public.entity_settings (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id)
);

create table if not exists public.entity_audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  action_type text not null,
  action_summary text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.entity_browser_sessions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  start_url text,
  current_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_browser_bookmarks (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_research_notes (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text,
  title text not null,
  note_body text not null,
  tags text[] not null default '{}'::text[],
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_heartbeats (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  heartbeat_type text not null,
  status text not null default 'unknown',
  health_score numeric,
  message text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.entity_incidents (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  severity text not null default 'warning',
  title text not null,
  description text not null,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  resolved_at timestamptz null,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists public.entity_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  total_score numeric not null,
  status text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.entity_proactive_actions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  title text not null,
  description text not null,
  action_type text not null,
  priority text not null default 'medium',
  status text not null default 'proposed',
  proposed_by uuid null references auth.users(id) on delete set null,
  assigned_to uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  requires_approval boolean not null default true,
  approval_status text not null default 'pending',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_action_runs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  proactive_action_id uuid null references public.entity_proactive_actions(id) on delete set null,
  run_type text not null,
  status text not null default 'queued',
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  summary text,
  logs_json jsonb not null default '[]'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists public.entity_action_approvals (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  proactive_action_id uuid not null references public.entity_proactive_actions(id) on delete cascade,
  requested_by uuid null references auth.users(id) on delete set null,
  approved_by uuid null references auth.users(id) on delete set null,
  status text not null default 'pending',
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz null
);

create table if not exists public.entity_agents (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  name text not null,
  agent_type text not null,
  description text not null,
  status text not null default 'setup_required',
  permissions_json jsonb not null default '[]'::jsonb,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_agent_runs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  agent_id uuid null references public.entity_agents(id) on delete set null,
  run_status text not null default 'queued',
  run_goal text not null,
  plan_json jsonb not null default '[]'::jsonb,
  result_summary text,
  logs_json jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists public.entity_agent_memory (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  agent_id uuid null references public.entity_agents(id) on delete set null,
  memory_type text not null,
  memory_key text not null,
  memory_value text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, agent_id, memory_type, memory_key)
);

create table if not exists public.entity_agent_tool_registry (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  tool_name text not null,
  tool_type text not null,
  description text not null,
  enabled boolean not null default false,
  requires_approval boolean not null default true,
  config_json jsonb not null default '{"status":"setup_required"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, tool_name)
);

create table if not exists public.entity_automations (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  name text not null,
  description text not null,
  schedule_cron text null,
  trigger_type text not null default 'manual',
  status text not null default 'setup_required',
  action_template_json jsonb not null default '{}'::jsonb,
  requires_approval boolean not null default true,
  last_run_at timestamptz null,
  next_run_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_automation_runs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  automation_id uuid not null references public.entity_automations(id) on delete cascade,
  status text not null default 'queued',
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  result_summary text,
  logs_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists public.entity_connectors (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  connector_type text not null,
  display_name text not null,
  status text not null default 'setup_required',
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_connector_events (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  connector_id uuid null references public.entity_connectors(id) on delete set null,
  event_type text not null,
  status text not null,
  summary text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists entities_slug_idx on public.entities (slug);
create index if not exists entities_entity_type_idx on public.entities (entity_type);
create index if not exists entity_memberships_entity_id_idx on public.entity_memberships (entity_id);
create index if not exists entity_memberships_user_id_idx on public.entity_memberships (user_id);
create index if not exists entity_audit_logs_entity_id_idx on public.entity_audit_logs (entity_id);
create index if not exists entity_audit_logs_created_at_idx on public.entity_audit_logs (created_at desc);

create index if not exists entity_browser_sessions_entity_idx on public.entity_browser_sessions (entity_id, updated_at desc);
create index if not exists entity_browser_bookmarks_entity_idx on public.entity_browser_bookmarks (entity_id, created_at desc);
create index if not exists entity_research_notes_entity_idx on public.entity_research_notes (entity_id, created_at desc);
create index if not exists entity_heartbeats_entity_idx on public.entity_heartbeats (entity_id, checked_at desc);
create index if not exists entity_incidents_entity_idx on public.entity_incidents (entity_id, opened_at desc);
create index if not exists entity_proactive_actions_entity_idx on public.entity_proactive_actions (entity_id, priority, status);
create index if not exists entity_action_runs_entity_idx on public.entity_action_runs (entity_id, started_at desc);
create index if not exists entity_agents_entity_idx on public.entity_agents (entity_id, status);
create index if not exists entity_agent_runs_entity_idx on public.entity_agent_runs (entity_id, started_at desc);
create index if not exists entity_automations_entity_idx on public.entity_automations (entity_id, status);
create index if not exists entity_connectors_entity_idx on public.entity_connectors (entity_id, status);
create index if not exists entity_connector_events_entity_idx on public.entity_connector_events (entity_id, created_at desc);

create or replace function public.is_entity_member(target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.entity_memberships memberships
    where memberships.entity_id = target_entity_id
      and memberships.user_id = auth.uid()
  );
$$;

create or replace function public.has_entity_role(target_entity_id uuid, allowed_roles public.entity_member_role[])
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.entity_memberships memberships
    where memberships.entity_id = target_entity_id
      and memberships.user_id = auth.uid()
      and memberships.role = any(allowed_roles)
  );
$$;

create or replace function public.can_manage_entity(target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.has_entity_role(target_entity_id, array['owner','admin']::public.entity_member_role[]);
$$;

comment on function public.is_entity_member(uuid) is
  'Checks entity membership for RLS. Uses auth.uid() and a locked search_path.';
comment on function public.has_entity_role(uuid, public.entity_member_role[]) is
  'Checks entity role for RLS. Uses auth.uid() and a locked search_path.';
comment on function public.can_manage_entity(uuid) is
  'Owner/admin helper for entity-scoped settings and operational configuration.';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'entities',
    'entity_memberships',
    'entity_settings',
    'entity_audit_logs',
    'entity_browser_sessions',
    'entity_browser_bookmarks',
    'entity_research_notes',
    'entity_heartbeats',
    'entity_incidents',
    'entity_health_snapshots',
    'entity_proactive_actions',
    'entity_action_runs',
    'entity_action_approvals',
    'entity_agents',
    'entity_agent_runs',
    'entity_agent_memory',
    'entity_agent_tool_registry',
    'entity_automations',
    'entity_automation_runs',
    'entity_connectors',
    'entity_connector_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop trigger if exists set_entities_updated_at on public.entities;
create trigger set_entities_updated_at before update on public.entities
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_memberships_updated_at on public.entity_memberships;
create trigger set_entity_memberships_updated_at before update on public.entity_memberships
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_settings_updated_at on public.entity_settings;
create trigger set_entity_settings_updated_at before update on public.entity_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_browser_sessions_updated_at on public.entity_browser_sessions;
create trigger set_entity_browser_sessions_updated_at before update on public.entity_browser_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_browser_bookmarks_updated_at on public.entity_browser_bookmarks;
create trigger set_entity_browser_bookmarks_updated_at before update on public.entity_browser_bookmarks
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_research_notes_updated_at on public.entity_research_notes;
create trigger set_entity_research_notes_updated_at before update on public.entity_research_notes
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_proactive_actions_updated_at on public.entity_proactive_actions;
create trigger set_entity_proactive_actions_updated_at before update on public.entity_proactive_actions
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_agents_updated_at on public.entity_agents;
create trigger set_entity_agents_updated_at before update on public.entity_agents
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_agent_memory_updated_at on public.entity_agent_memory;
create trigger set_entity_agent_memory_updated_at before update on public.entity_agent_memory
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_agent_tool_registry_updated_at on public.entity_agent_tool_registry;
create trigger set_entity_agent_tool_registry_updated_at before update on public.entity_agent_tool_registry
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_automations_updated_at on public.entity_automations;
create trigger set_entity_automations_updated_at before update on public.entity_automations
  for each row execute function public.set_updated_at();

drop trigger if exists set_entity_connectors_updated_at on public.entity_connectors;
create trigger set_entity_connectors_updated_at before update on public.entity_connectors
  for each row execute function public.set_updated_at();

drop policy if exists "Members can read assigned entities" on public.entities;
create policy "Members can read assigned entities"
  on public.entities for select to authenticated
  using (is_public or public.is_entity_member(id));

drop policy if exists "Owners and admins can update entities" on public.entities;
create policy "Owners and admins can update entities"
  on public.entities for update to authenticated
  using (public.can_manage_entity(id))
  with check (public.can_manage_entity(id));

drop policy if exists "Members can read entity memberships" on public.entity_memberships;
create policy "Members can read entity memberships"
  on public.entity_memberships for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can manage entity memberships" on public.entity_memberships;
create policy "Owners and admins can manage entity memberships"
  on public.entity_memberships for all to authenticated
  using (public.can_manage_entity(entity_id))
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read entity settings" on public.entity_settings;
create policy "Members can read entity settings"
  on public.entity_settings for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can manage entity settings" on public.entity_settings;
create policy "Owners and admins can manage entity settings"
  on public.entity_settings for all to authenticated
  using (public.can_manage_entity(entity_id))
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read entity audit logs" on public.entity_audit_logs;
create policy "Members can read entity audit logs"
  on public.entity_audit_logs for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Members can append entity audit logs" on public.entity_audit_logs;
create policy "Members can append entity audit logs"
  on public.entity_audit_logs for insert to authenticated
  with check (public.is_entity_member(entity_id) and (user_id is null or user_id = auth.uid()));

drop policy if exists "Members can read browser sessions" on public.entity_browser_sessions;
create policy "Members can read browser sessions"
  on public.entity_browser_sessions for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Members can manage own browser sessions" on public.entity_browser_sessions;
create policy "Members can manage own browser sessions"
  on public.entity_browser_sessions for all to authenticated
  using (public.is_entity_member(entity_id) and (user_id = auth.uid() or public.can_manage_entity(entity_id)))
  with check (public.is_entity_member(entity_id) and user_id = auth.uid());

drop policy if exists "Members can read browser bookmarks" on public.entity_browser_bookmarks;
create policy "Members can read browser bookmarks"
  on public.entity_browser_bookmarks for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Members can manage own browser bookmarks" on public.entity_browser_bookmarks;
create policy "Members can manage own browser bookmarks"
  on public.entity_browser_bookmarks for all to authenticated
  using (public.is_entity_member(entity_id) and (user_id = auth.uid() or public.can_manage_entity(entity_id)))
  with check (public.is_entity_member(entity_id) and user_id = auth.uid());

drop policy if exists "Members can read research notes" on public.entity_research_notes;
create policy "Members can read research notes"
  on public.entity_research_notes for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Members can manage own research notes" on public.entity_research_notes;
create policy "Members can manage own research notes"
  on public.entity_research_notes for all to authenticated
  using (public.is_entity_member(entity_id) and (user_id = auth.uid() or public.can_manage_entity(entity_id)))
  with check (public.is_entity_member(entity_id) and user_id = auth.uid());

drop policy if exists "Members can read heartbeats" on public.entity_heartbeats;
create policy "Members can read heartbeats"
  on public.entity_heartbeats for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can insert heartbeats" on public.entity_heartbeats;
create policy "Owners and admins can insert heartbeats"
  on public.entity_heartbeats for insert to authenticated
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read incidents" on public.entity_incidents;
create policy "Members can read incidents"
  on public.entity_incidents for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can manage incidents" on public.entity_incidents;
create policy "Owners and admins can manage incidents"
  on public.entity_incidents for all to authenticated
  using (public.can_manage_entity(entity_id))
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read health snapshots" on public.entity_health_snapshots;
create policy "Members can read health snapshots"
  on public.entity_health_snapshots for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners admins and operators can propose actions" on public.entity_proactive_actions;
create policy "Owners admins and operators can propose actions"
  on public.entity_proactive_actions for insert to authenticated
  with check (
    public.has_entity_role(entity_id, array['owner','admin','operator']::public.entity_member_role[])
    and (proposed_by is null or proposed_by = auth.uid())
  );

drop policy if exists "Members can read proactive actions" on public.entity_proactive_actions;
create policy "Members can read proactive actions"
  on public.entity_proactive_actions for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can update proactive actions" on public.entity_proactive_actions;
create policy "Owners and admins can update proactive actions"
  on public.entity_proactive_actions for update to authenticated
  using (public.can_manage_entity(entity_id))
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read action runs" on public.entity_action_runs;
create policy "Members can read action runs"
  on public.entity_action_runs for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners admins and operators can insert action runs" on public.entity_action_runs;
create policy "Owners admins and operators can insert action runs"
  on public.entity_action_runs for insert to authenticated
  with check (
    public.has_entity_role(entity_id, array['owner','admin','operator']::public.entity_member_role[])
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists "Members can read action approvals" on public.entity_action_approvals;
create policy "Members can read action approvals"
  on public.entity_action_approvals for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can manage action approvals" on public.entity_action_approvals;
create policy "Owners and admins can manage action approvals"
  on public.entity_action_approvals for all to authenticated
  using (public.can_manage_entity(entity_id))
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read agents" on public.entity_agents;
create policy "Members can read agents"
  on public.entity_agents for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can manage agents" on public.entity_agents;
create policy "Owners and admins can manage agents"
  on public.entity_agents for all to authenticated
  using (public.can_manage_entity(entity_id))
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read agent runs" on public.entity_agent_runs;
create policy "Members can read agent runs"
  on public.entity_agent_runs for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners admins and operators can insert agent runs" on public.entity_agent_runs;
create policy "Owners admins and operators can insert agent runs"
  on public.entity_agent_runs for insert to authenticated
  with check (
    public.has_entity_role(entity_id, array['owner','admin','operator']::public.entity_member_role[])
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists "Members can read agent memory" on public.entity_agent_memory;
create policy "Members can read agent memory"
  on public.entity_agent_memory for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can manage agent memory" on public.entity_agent_memory;
create policy "Owners and admins can manage agent memory"
  on public.entity_agent_memory for all to authenticated
  using (public.can_manage_entity(entity_id))
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read agent tools" on public.entity_agent_tool_registry;
create policy "Members can read agent tools"
  on public.entity_agent_tool_registry for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can manage agent tools" on public.entity_agent_tool_registry;
create policy "Owners and admins can manage agent tools"
  on public.entity_agent_tool_registry for all to authenticated
  using (public.can_manage_entity(entity_id))
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read automations" on public.entity_automations;
create policy "Members can read automations"
  on public.entity_automations for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can manage automations" on public.entity_automations;
create policy "Owners and admins can manage automations"
  on public.entity_automations for all to authenticated
  using (public.can_manage_entity(entity_id))
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read automation runs" on public.entity_automation_runs;
create policy "Members can read automation runs"
  on public.entity_automation_runs for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners admins and operators can insert automation runs" on public.entity_automation_runs;
create policy "Owners admins and operators can insert automation runs"
  on public.entity_automation_runs for insert to authenticated
  with check (public.has_entity_role(entity_id, array['owner','admin','operator']::public.entity_member_role[]));

drop policy if exists "Members can read connectors" on public.entity_connectors;
create policy "Members can read connectors"
  on public.entity_connectors for select to authenticated
  using (public.is_entity_member(entity_id));

drop policy if exists "Owners and admins can manage connectors" on public.entity_connectors;
create policy "Owners and admins can manage connectors"
  on public.entity_connectors for all to authenticated
  using (public.can_manage_entity(entity_id))
  with check (public.can_manage_entity(entity_id));

drop policy if exists "Members can read connector events" on public.entity_connector_events;
create policy "Members can read connector events"
  on public.entity_connector_events for select to authenticated
  using (public.is_entity_member(entity_id));

insert into public.entities (slug, name, entity_type, description, status, is_public)
values
  ('parent-company', 'Parent Company', 'parent_company', 'Parent governance, security, billing, infrastructure, audit, and deployment operations.', 'setup_required', false),
  ('creator-music-technology', 'Creator/Music Technology Company', 'creator_music_technology', 'Music and creator infrastructure for projects, assets, release readiness, and creator operations.', 'setup_required', false),
  ('business-operations', 'Business Operations Company', 'business_operations', 'Operations infrastructure for restaurants, small businesses, staff workflows, vendor links, and daily systems.', 'setup_required', false),
  ('community-public-information', 'Community/Public Information Company', 'community_public_information', 'Public information aggregation, source review, community notices, and approval-gated communication workflows.', 'setup_required', false)
on conflict (slug) do update
set name = excluded.name,
    entity_type = excluded.entity_type,
    description = excluded.description,
    updated_at = now();

comment on table public.entities is
  'Four separated operating entities. Data is private by default and scoped by entity membership.';
comment on table public.entity_browser_sessions is
  'Internal browser-workspace state. Do not store credentials or scraped private data.';
comment on table public.entity_proactive_actions is
  'Approval-gated recommended actions. Destructive actions require owner/admin approval.';
comment on table public.entity_agents is
  'Agent-ready registry. Unsupported external runtimes must remain setup_required.';
comment on table public.entity_automations is
  'Automation-ready schedules and triggers. Human approval is required for destructive or high-risk work.';
comment on table public.entity_connectors is
  'Connector-ready records. Secrets must live only in environment or secret storage, never config_json.';
