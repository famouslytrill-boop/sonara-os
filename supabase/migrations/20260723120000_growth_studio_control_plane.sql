-- SONARA Growth Studio operating-system control plane.
-- Additive, tenant-scoped, consent-aware, attribution-honest, and provider-neutral.

create extension if not exists pgcrypto;

create table if not exists public.growth_provider_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider_key text not null,
  external_account_id text,
  connection_status text not null default 'setup_required' check (connection_status in ('setup_required','connected','degraded','disabled','revoked')),
  approved_scopes jsonb not null default '[]'::jsonb,
  credential_reference text,
  configuration jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_key, external_account_id)
);

create table if not exists public.growth_audience_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  description text,
  segment_definition jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  estimated_count integer check (estimated_count is null or estimated_count >= 0),
  last_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_contact_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  lead_id uuid references public.growth_leads(id) on delete cascade,
  channel text not null check (channel in ('email','sms','push','whatsapp','phone','personalization','analytics')),
  purpose text not null,
  consent_status text not null check (consent_status in ('granted','denied','withdrawn','expired','unknown')),
  source text not null,
  evidence_reference text,
  granted_at timestamptz,
  expires_at timestamptz,
  withdrawn_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_touchpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  lead_id uuid references public.growth_leads(id) on delete set null,
  provider_key text,
  event_name text not null,
  channel text,
  source text,
  medium text,
  campaign_key text,
  content_key text,
  anonymous_id text,
  external_event_id text,
  deduplication_key text,
  value numeric(18,4),
  currency text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, provider_key, deduplication_key)
);

create table if not exists public.growth_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  lead_id uuid references public.growth_leads(id) on delete set null,
  touchpoint_id uuid references public.growth_touchpoints(id) on delete set null,
  conversion_type text not null,
  external_conversion_id text,
  value numeric(18,4),
  currency text default 'usd',
  attribution_model text not null default 'unattributed' check (attribution_model in ('unattributed','first_touch','last_touch','linear','position_based','data_driven','provider_reported','custom')),
  attribution_confidence text not null default 'unknown' check (attribution_confidence in ('unknown','low','medium','high','provider_reported')),
  source text,
  medium text,
  campaign_key text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, external_conversion_id)
);

create table if not exists public.growth_content_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  provider_connection_id uuid references public.growth_provider_connections(id) on delete set null,
  channel text not null,
  content_type text not null check (content_type in ('social_post','email','sms','push','ad','landing_page','blog','video','other')),
  title text,
  body text,
  media_references jsonb not null default '[]'::jsonb,
  audience_segment_id uuid references public.growth_audience_segments(id) on delete set null,
  scheduled_for timestamptz,
  approval_status text not null default 'draft' check (approval_status in ('draft','review_required','approved','rejected')),
  publish_status text not null default 'not_scheduled' check (publish_status in ('not_scheduled','scheduled','queued','publishing','published','failed','cancelled','manual_required')),
  provider_content_id text,
  provider_response jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_provider_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  content_id uuid references public.growth_content_queue(id) on delete set null,
  provider_key text not null,
  capability text not null,
  operation text not null,
  idempotency_key text not null,
  request_payload jsonb not null default '{}'::jsonb,
  provider_job_id text,
  provider_response jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','submitted','running','completed','failed','cancelled','setup_required','approval_required','manual_required')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  approval_required boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  error_code text,
  error_message text,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists public.growth_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  provider_key text,
  report_type text not null,
  date_start date,
  date_end date,
  metrics jsonb not null default '{}'::jsonb,
  dimensions jsonb not null default '[]'::jsonb,
  sampled boolean not null default false,
  data_freshness text,
  provider_metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.growth_experiment_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  experiment_id uuid not null references public.growth_experiments(id) on delete cascade,
  variant_key text not null,
  name text not null,
  allocation_weight numeric(7,4) not null default 0.5 check (allocation_weight >= 0 and allocation_weight <= 1),
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','paused','winner','loser','archived')),
  exposures integer not null default 0 check (exposures >= 0),
  conversions integer not null default 0 check (conversions >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experiment_id, variant_key)
);

create table if not exists public.growth_control_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  job_id uuid references public.growth_provider_jobs(id) on delete set null,
  event_type text not null,
  event_status text not null default 'recorded' check (event_status in ('recorded','success','failed','denied','approval_required','manual_required')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists growth_provider_connections_org_provider_idx on public.growth_provider_connections (organization_id, provider_key, connection_status);
create index if not exists growth_segments_org_status_idx on public.growth_audience_segments (organization_id, status, updated_at desc);
create index if not exists growth_consents_lead_channel_idx on public.growth_contact_consents (organization_id, lead_id, channel, consent_status, expires_at);
create index if not exists growth_touchpoints_campaign_time_idx on public.growth_touchpoints (organization_id, campaign_id, occurred_at desc);
create index if not exists growth_touchpoints_lead_time_idx on public.growth_touchpoints (organization_id, lead_id, occurred_at desc);
create index if not exists growth_conversions_campaign_time_idx on public.growth_conversions (organization_id, campaign_id, occurred_at desc);
create index if not exists growth_content_schedule_idx on public.growth_content_queue (organization_id, publish_status, scheduled_for);
create index if not exists growth_provider_jobs_status_idx on public.growth_provider_jobs (organization_id, status, created_at desc);
create index if not exists growth_metric_snapshots_campaign_idx on public.growth_metric_snapshots (organization_id, campaign_id, captured_at desc);
create index if not exists growth_variants_experiment_idx on public.growth_experiment_variants (experiment_id, status);
create index if not exists growth_control_events_job_idx on public.growth_control_events (job_id, created_at desc);

alter table public.growth_provider_connections enable row level security;
alter table public.growth_audience_segments enable row level security;
alter table public.growth_contact_consents enable row level security;
alter table public.growth_touchpoints enable row level security;
alter table public.growth_conversions enable row level security;
alter table public.growth_content_queue enable row level security;
alter table public.growth_provider_jobs enable row level security;
alter table public.growth_metric_snapshots enable row level security;
alter table public.growth_experiment_variants enable row level security;
alter table public.growth_control_events enable row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'growth_provider_connections',
    'growth_audience_segments',
    'growth_contact_consents',
    'growth_touchpoints',
    'growth_conversions',
    'growth_content_queue',
    'growth_provider_jobs',
    'growth_metric_snapshots',
    'growth_experiment_variants',
    'growth_control_events'
  ]
  loop
    execute format('drop policy if exists "growth members read %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "growth members read %1$s" on public.%1$I for select to authenticated using (public.sonara_is_org_member(organization_id))',
      relation_name
    );
    execute format('drop policy if exists "service role manages %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "service role manages %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      relation_name
    );
  end loop;
end $$;

-- All control-plane writes go through the authenticated SONARA server, not direct browser Data API calls.
revoke insert, update, delete on public.growth_provider_connections from anon, authenticated;
revoke insert, update, delete on public.growth_audience_segments from anon, authenticated;
revoke insert, update, delete on public.growth_contact_consents from anon, authenticated;
revoke insert, update, delete on public.growth_touchpoints from anon, authenticated;
revoke insert, update, delete on public.growth_conversions from anon, authenticated;
revoke insert, update, delete on public.growth_content_queue from anon, authenticated;
revoke insert, update, delete on public.growth_provider_jobs from anon, authenticated;
revoke insert, update, delete on public.growth_metric_snapshots from anon, authenticated;
revoke insert, update, delete on public.growth_experiment_variants from anon, authenticated;
revoke insert, update, delete on public.growth_control_events from anon, authenticated;

-- Provider secrets are never persisted here. This field stores only an opaque server-side vault reference.
revoke select (credential_reference) on public.growth_provider_connections from anon, authenticated;

comment on table public.growth_provider_connections is 'Provider account metadata and opaque vault references; never raw credentials.';
comment on table public.growth_contact_consents is 'Purpose- and channel-specific consent evidence for governed lifecycle messaging.';
comment on table public.growth_touchpoints is 'Deduplicated first-party and authorized provider touchpoints for attribution analysis.';
comment on table public.growth_conversions is 'Conversion facts with explicit attribution model and confidence metadata.';
comment on table public.growth_content_queue is 'Human-approved content scheduling and provider publishing state.';
comment on table public.growth_provider_jobs is 'Auditable provider operations with idempotency and approval boundaries.';
comment on table public.growth_metric_snapshots is 'Provider and first-party metric snapshots preserving sampling and freshness metadata.';
comment on table public.growth_control_events is 'Append-only Growth Studio operational, approval, consent, and provider evidence.';

notify pgrst, 'reload schema';
