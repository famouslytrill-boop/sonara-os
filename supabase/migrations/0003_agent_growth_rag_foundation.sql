-- SONARA Industries agent, Growth Studio tactics, consent-safe outreach, and vector memory foundation.
-- Apply after 0002_launch_mvp_core_tables.sql.
-- All private records are organization-scoped and protected by RLS.

create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid references public.user_profiles(id),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  persistence_status text not null default 'server_ready' check (persistence_status in ('local_draft', 'server_ready')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool_key text not null,
  label text not null,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  enabled_by_default boolean not null default false,
  approval_required boolean not null default true,
  blocked_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tool_key)
);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid references public.agent_sessions(id) on delete set null,
  owner_user_id uuid references public.user_profiles(id),
  title text not null,
  goal text not null,
  task_type text not null,
  status text not null default 'draft' check (status in ('draft', 'queued', 'requires_approval', 'blocked', 'completed')),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  tool_ids jsonb not null default '[]'::jsonb,
  audit_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_memory_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid references public.user_profiles(id),
  namespace text not null check (namespace in ('agent_memory', 'support_knowledge', 'admin_docs')),
  summary text not null,
  sensitivity text not null default 'standard' check (sensitivity in ('low', 'standard', 'restricted')),
  source_type text not null default 'user_input' check (source_type in ('user_input', 'document', 'admin_note', 'system')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_task_id uuid references public.agent_tasks(id) on delete cascade,
  owner_user_id uuid references public.user_profiles(id),
  rating integer check (rating is null or (rating >= 1 and rating <= 5)),
  feedback_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_task_id uuid references public.agent_tasks(id) on delete set null,
  actor_user_id uuid references public.user_profiles(id),
  tool_key text not null,
  action text not null,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_state text not null default 'required' check (approval_state in ('not_required', 'required', 'approved', 'blocked')),
  result text not null default 'planned' check (result in ('planned', 'queued', 'blocked', 'completed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_search_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid references public.user_profiles(id),
  namespace text not null,
  result_count integer not null default 0 check (result_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_tactics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid references public.user_profiles(id),
  title text not null,
  category text not null,
  description text not null,
  expected_impact text,
  effort_level text not null default 'medium' check (effort_level in ('low', 'medium', 'high')),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  required_assets jsonb not null default '[]'::jsonb,
  implementation_notes text,
  status text not null default 'draft' check (status in ('draft', 'planned', 'in_progress', 'completed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tactic_id uuid references public.growth_tactics(id) on delete set null,
  owner_user_id uuid references public.user_profiles(id),
  title text not null,
  hypothesis text,
  status text not null default 'draft' check (status in ('draft', 'planned', 'in_progress', 'completed', 'stopped')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_experiment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid references public.growth_experiments(id) on delete cascade,
  event_type text not null,
  event_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_checklists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid references public.user_profiles(id),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'planned', 'completed', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  checklist_id uuid references public.growth_checklists(id) on delete cascade,
  title text not null,
  is_complete boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid references public.user_profiles(id),
  campaign_type text not null check (campaign_type in ('email', 'sms_placeholder', 'call_placeholder', 'voicemail_placeholder', 'review_request', 'social_post_reminder', 'manual_follow_up_task')),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'planned', 'requires_approval', 'blocked', 'completed')),
  consent_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  customer_record_id uuid references public.customer_records(id) on delete set null,
  contact_label text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'blocked', 'opted_out')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  channel text not null,
  subject text,
  body text not null,
  approval_status text not null default 'draft' check (approval_status in ('draft', 'requires_approval', 'approved', 'blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  event_type text not null,
  event_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_record_id uuid references public.customer_records(id) on delete set null,
  consent_source text not null,
  consent_timestamp timestamptz not null,
  channels jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.opt_outs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_record_id uuid references public.customer_records(id) on delete set null,
  channel text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  approval_status text not null default 'requested' check (approval_status in ('requested', 'approved', 'rejected', 'blocked')),
  reviewed_by uuid references public.user_profiles(id),
  review_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  action text not null,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  result text not null default 'planned' check (result in ('planned', 'queued', 'blocked', 'completed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vector_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid references public.user_profiles(id),
  namespace text not null,
  content_ref text not null,
  source_id text not null,
  source_type text not null,
  review_status text not null default 'draft' check (review_status in ('draft', 'reviewed', 'blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_sessions_org_status_idx on public.agent_sessions(organization_id, status);
create index if not exists agent_tools_org_key_idx on public.agent_tools(organization_id, tool_key);
create index if not exists agent_tasks_org_status_idx on public.agent_tasks(organization_id, status);
create index if not exists agent_memory_entries_org_namespace_idx on public.agent_memory_entries(organization_id, namespace);
create index if not exists agent_audit_logs_org_created_idx on public.agent_audit_logs(organization_id, created_at desc);
create index if not exists growth_tactics_org_status_idx on public.growth_tactics(organization_id, status);
create index if not exists growth_experiments_org_status_idx on public.growth_experiments(organization_id, status);
create index if not exists growth_checklists_org_status_idx on public.growth_checklists(organization_id, status);
create index if not exists campaigns_org_status_idx on public.campaigns(organization_id, status);
create index if not exists consent_records_org_customer_idx on public.consent_records(organization_id, customer_record_id);
create index if not exists opt_outs_org_customer_idx on public.opt_outs(organization_id, customer_record_id);
create index if not exists vector_documents_org_namespace_idx on public.vector_documents(organization_id, namespace);

alter table public.agent_sessions enable row level security;
alter table public.agent_tools enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agent_memory_entries enable row level security;
alter table public.agent_feedback enable row level security;
alter table public.agent_audit_logs enable row level security;
alter table public.agent_search_logs enable row level security;
alter table public.growth_tactics enable row level security;
alter table public.growth_experiments enable row level security;
alter table public.growth_experiment_events enable row level security;
alter table public.growth_checklists enable row level security;
alter table public.growth_checklist_items enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_contacts enable row level security;
alter table public.campaign_messages enable row level security;
alter table public.campaign_events enable row level security;
alter table public.consent_records enable row level security;
alter table public.opt_outs enable row level security;
alter table public.outreach_approvals enable row level security;
alter table public.outreach_audit_logs enable row level security;
alter table public.vector_documents enable row level security;

create policy "agent_sessions_member_all" on public.agent_sessions
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "agent_tools_admin_all" on public.agent_tools
for all using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "agent_tasks_member_all" on public.agent_tasks
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "agent_memory_entries_member_all" on public.agent_memory_entries
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "agent_feedback_member_all" on public.agent_feedback
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "agent_audit_logs_member_select" on public.agent_audit_logs
for select using (public.is_org_member(organization_id));

create policy "agent_audit_logs_admin_insert" on public.agent_audit_logs
for insert with check (public.is_org_admin(organization_id));

create policy "agent_search_logs_member_all" on public.agent_search_logs
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "growth_tactics_member_all" on public.growth_tactics
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "growth_experiments_member_all" on public.growth_experiments
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "growth_experiment_events_member_all" on public.growth_experiment_events
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "growth_checklists_member_all" on public.growth_checklists
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "growth_checklist_items_member_all" on public.growth_checklist_items
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "campaigns_member_all" on public.campaigns
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "campaign_contacts_member_all" on public.campaign_contacts
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "campaign_messages_member_all" on public.campaign_messages
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "campaign_events_member_all" on public.campaign_events
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "consent_records_member_all" on public.consent_records
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "opt_outs_member_all" on public.opt_outs
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "outreach_approvals_admin_all" on public.outreach_approvals
for all using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "outreach_audit_logs_member_select" on public.outreach_audit_logs
for select using (public.is_org_member(organization_id));

create policy "outreach_audit_logs_admin_insert" on public.outreach_audit_logs
for insert with check (public.is_org_admin(organization_id));

create policy "vector_documents_member_all" on public.vector_documents
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
