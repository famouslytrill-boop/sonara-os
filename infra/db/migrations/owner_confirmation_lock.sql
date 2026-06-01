-- Owner Confirmation Lock migration.
-- Review before applying to any live database.
-- Approval previews must redact secrets, payout details, webhook secrets, tokens, and private customer data.

create extension if not exists pgcrypto;

create table if not exists public.sensitive_action_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  action_category text not null check (
    action_category in (
      'money_movement',
      'refunds',
      'price_changes',
      'payout_settings',
      'legal_policy_text',
      'customer_facing_campaigns',
      'security_setting_changes',
      'deleting_data',
      'publishing_proof_reviews',
      'ai_voice_output',
      'ai_visual_output',
      'ai_video_output',
      'unknown'
    )
  ),
  action_key text not null,
  product_area text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null default 'queued_for_owner_review' check (
    approval_status in (
      'draft',
      'queued_for_owner_review',
      'approved',
      'rejected',
      'expired',
      'blocked',
      'executed_after_approval'
    )
  ),
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  rejected_by uuid references public.user_profiles(id),
  rejected_at timestamptz,
  blocked_reason text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.owner_review_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  action_category text not null,
  action_key text not null,
  product_area text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null default 'queued_for_owner_review',
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  rejected_by uuid references public.user_profiles(id),
  rejected_at timestamptz,
  blocked_reason text,
  sensitive_action_record_id uuid references public.sensitive_action_records(id) on delete cascade,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.owner_approval_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  action_category text not null,
  action_key text not null,
  product_area text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null,
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  rejected_by uuid references public.user_profiles(id),
  rejected_at timestamptz,
  blocked_reason text,
  event_type text not null,
  sensitive_action_record_id uuid references public.sensitive_action_records(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.blocked_action_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  action_category text not null,
  action_key text not null,
  product_area text not null,
  risk_level text not null default 'critical' check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null default 'blocked',
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  rejected_by uuid references public.user_profiles(id),
  rejected_at timestamptz,
  blocked_reason text not null,
  sensitive_action_record_id uuid references public.sensitive_action_records(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.confirmation_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  action_category text not null,
  action_key text not null,
  product_area text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null default 'queued_for_owner_review',
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  rejected_by uuid references public.user_profiles(id),
  rejected_at timestamptz,
  blocked_reason text,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.owner_confirmation_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  action_category text not null,
  action_key text not null,
  product_area text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null,
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  rejected_by uuid references public.user_profiles(id),
  rejected_at timestamptz,
  blocked_reason text,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists sensitive_action_records_org_status_idx
on public.sensitive_action_records(organization_id, approval_status, created_at desc);

create index if not exists owner_review_queue_org_status_idx
on public.owner_review_queue(organization_id, approval_status, created_at desc);

create index if not exists owner_approval_events_org_created_idx
on public.owner_approval_events(organization_id, created_at desc);

create index if not exists blocked_action_records_org_created_idx
on public.blocked_action_records(organization_id, created_at desc);

create index if not exists confirmation_tokens_org_expires_idx
on public.confirmation_tokens(organization_id, expires_at);

create index if not exists owner_confirmation_audit_logs_org_created_idx
on public.owner_confirmation_audit_logs(organization_id, created_at desc);

alter table public.sensitive_action_records enable row level security;
alter table public.owner_review_queue enable row level security;
alter table public.owner_approval_events enable row level security;
alter table public.blocked_action_records enable row level security;
alter table public.confirmation_tokens enable row level security;
alter table public.owner_confirmation_audit_logs enable row level security;

create policy "sensitive_action_records_org_members"
on public.sensitive_action_records
for all
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "owner_review_queue_owner_admin"
on public.owner_review_queue
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "owner_approval_events_owner_admin"
on public.owner_approval_events
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "blocked_action_records_owner_admin"
on public.blocked_action_records
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "confirmation_tokens_owner_admin"
on public.confirmation_tokens
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "owner_confirmation_audit_logs_read_owner_admin"
on public.owner_confirmation_audit_logs
for select
using (public.is_org_admin(organization_id));

create policy "owner_confirmation_audit_logs_insert_owner_admin"
on public.owner_confirmation_audit_logs
for insert
with check (public.is_org_admin(organization_id));
