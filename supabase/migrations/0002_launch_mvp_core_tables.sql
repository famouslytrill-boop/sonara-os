-- SONARA One launch MVP core tables.
-- Apply after 0001_auth_organization_scaffold.sql.
-- These tables are organization-scoped and RLS-ready.
-- Do not store raw card numbers, CVV, bank credentials, or provider secrets.

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  );
$$;

create or replace function public.is_org_admin(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin', 'developer', 'support')
  );
$$;

create table if not exists public.customer_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  contact_label text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proof_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  short_description text,
  services jsonb not null default '[]'::jsonb,
  proof_points jsonb not null default '[]'::jsonb,
  contact_label text,
  contact_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  public_visibility boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_type text not null check (
    provider_type in ('stripe', 'square', 'paypal', 'cash_app', 'venmo', 'zelle', 'manual', 'other')
  ),
  display_label text not null,
  external_url text,
  instructions text,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'active', 'disabled', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_options_no_unsafe_protocol check (
    external_url is null
    or external_url ~* '^https?://'
  )
);

create table if not exists public.booking_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  public_slug text not null,
  service_types jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  owner_review_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, public_slug)
);

create table if not exists public.smart_intake_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  short_description text,
  display_price text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reviewer_display_name text,
  testimonial text not null,
  source_type text not null default 'manual' check (source_type in ('manual', 'external_link')),
  source_url text,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'hidden', 'rejected')),
  public_visibility boolean not null default false,
  permission_confirmed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_no_unsafe_source_protocol check (
    source_url is null
    or source_url ~* '^https?://'
  )
);

create table if not exists public.money_path_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_option_id uuid references public.payment_options(id) on delete set null,
  event_type text not null,
  status text not null default 'recorded' check (status in ('recorded', 'reviewed', 'archived')),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency text check (currency is null or char_length(currency) = 3),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.files_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  storage_path text,
  content_type text,
  rights_notes text,
  provenance_notes text,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'approved', 'archived')),
  public_visibility boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.external_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_type text not null,
  display_label text not null,
  status text not null default 'setup_required' check (status in ('setup_required', 'pending_review', 'connected', 'disabled', 'archived')),
  scopes jsonb not null default '[]'::jsonb,
  credentials_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  flag_key text not null,
  enabled boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'active', 'disabled', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, flag_key)
);

create table if not exists public.approval_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  approval_type text not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'revoked', 'archived')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_records_org_status_idx on public.customer_records(organization_id, status);
create index if not exists proof_profiles_org_status_idx on public.proof_profiles(organization_id, status);
create index if not exists payment_options_org_status_idx on public.payment_options(organization_id, status);
create index if not exists booking_links_org_status_idx on public.booking_links(organization_id, status);
create index if not exists smart_intake_forms_org_status_idx on public.smart_intake_forms(organization_id, status);
create index if not exists offers_org_status_idx on public.offers(organization_id, status);
create index if not exists reviews_org_moderation_idx on public.reviews(organization_id, moderation_status, public_visibility);
create index if not exists money_path_events_org_created_idx on public.money_path_events(organization_id, created_at desc);
create index if not exists files_records_org_status_idx on public.files_records(organization_id, status);
create index if not exists external_connections_org_status_idx on public.external_connections(organization_id, status);
create index if not exists feature_flags_org_key_idx on public.feature_flags(organization_id, flag_key);
create index if not exists approval_events_org_status_idx on public.approval_events(organization_id, status);

alter table public.customer_records enable row level security;
alter table public.proof_profiles enable row level security;
alter table public.payment_options enable row level security;
alter table public.booking_links enable row level security;
alter table public.smart_intake_forms enable row level security;
alter table public.offers enable row level security;
alter table public.reviews enable row level security;
alter table public.money_path_events enable row level security;
alter table public.files_records enable row level security;
alter table public.external_connections enable row level security;
alter table public.feature_flags enable row level security;
alter table public.approval_events enable row level security;

create policy "customer_records_member_all" on public.customer_records
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "proof_profiles_member_all" on public.proof_profiles
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "proof_profiles_public_select" on public.proof_profiles
for select using (status = 'published' and public_visibility = true);

create policy "payment_options_member_all" on public.payment_options
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "payment_options_public_select" on public.payment_options
for select using (status = 'active');

create policy "booking_links_member_all" on public.booking_links
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "booking_links_public_select" on public.booking_links
for select using (status = 'active');

create policy "smart_intake_forms_member_all" on public.smart_intake_forms
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "smart_intake_forms_public_select" on public.smart_intake_forms
for select using (status = 'active');

create policy "offers_member_all" on public.offers
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "offers_public_select" on public.offers
for select using (status = 'published');

create policy "reviews_member_all" on public.reviews
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "reviews_public_select" on public.reviews
for select using (
  moderation_status = 'approved'
  and public_visibility = true
  and permission_confirmed = true
);

create policy "money_path_events_member_all" on public.money_path_events
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "files_records_member_all" on public.files_records
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "files_records_public_select" on public.files_records
for select using (status = 'approved' and public_visibility = true);

create policy "external_connections_admin_all" on public.external_connections
for all using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "feature_flags_admin_all" on public.feature_flags
for all using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "feature_flags_member_select" on public.feature_flags
for select using (public.is_org_member(organization_id));

create policy "approval_events_admin_all" on public.approval_events
for all using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "approval_events_member_select" on public.approval_events
for select using (public.is_org_member(organization_id));
