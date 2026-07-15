-- SONARA Industries SaaS launch system.
-- Review before production. This migration creates the real SaaS tables requested for
-- Business Builder, Creator Studio, Growth Studio, billing, admin, and support.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_id uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migration 010 creates the shared organizations table first. Reconcile the
-- launch-specific ownership fields when upgrading that earlier table instead
-- of relying on CREATE TABLE IF NOT EXISTS to add them.
alter table public.organizations
  add column if not exists slug text,
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create unique index if not exists organizations_slug_key
  on public.organizations (slug)
  where slug is not null;

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('customer','paid_customer','owner','admin','founder')),
  created_at timestamptz default now(),
  unique(organization_id, user_id)
);

create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  organization_id uuid references public.organizations(id),
  stripe_customer_id text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  organization_id uuid references public.organizations(id),
  stripe_subscription_id text unique,
  stripe_customer_id text,
  status text,
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  organization_id uuid references public.organizations(id),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  product_key text,
  price_id text,
  status text,
  created_at timestamptz default now()
);

create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  user_id uuid references auth.users(id),
  company_name text,
  contact_name text,
  email text,
  phone text,
  industry text,
  budget text,
  timeline text,
  goals text,
  current_website text,
  needed_services text[],
  status text default 'new',
  created_at timestamptz default now()
);

create table if not exists public.launch_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  user_id uuid references auth.users(id),
  category text,
  title text,
  description text,
  status text default 'todo',
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  user_id uuid references auth.users(id),
  event_type text,
  event_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  user_id uuid references auth.users(id),
  subject text,
  message text,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text,
  target_type text,
  target_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists organization_memberships_org_user_idx on public.organization_memberships (organization_id, user_id);
create index if not exists organization_memberships_user_idx on public.organization_memberships (user_id);
create index if not exists stripe_customers_org_idx on public.stripe_customers (organization_id);
create index if not exists subscriptions_org_idx on public.subscriptions (organization_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists purchases_org_idx on public.purchases (organization_id);
create index if not exists purchases_product_idx on public.purchases (product_key);
create index if not exists intake_requests_org_idx on public.intake_requests (organization_id, created_at desc);
create index if not exists launch_checklist_items_org_idx on public.launch_checklist_items (organization_id, created_at desc);
create index if not exists activity_events_org_idx on public.activity_events (organization_id, created_at desc);
create index if not exists support_requests_org_idx on public.support_requests (organization_id, created_at desc);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

drop trigger if exists set_launch_checklist_items_updated_at on public.launch_checklist_items;
create trigger set_launch_checklist_items_updated_at before update on public.launch_checklist_items for each row execute function public.set_updated_at();

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_organization_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

create or replace function public.is_admin_or_founder()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.user_id = auth.uid()
      and m.role in ('owner','admin','founder')
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.purchases enable row level security;
alter table public.intake_requests enable row level security;
alter table public.launch_checklist_items enable row level security;
alter table public.activity_events enable row level security;
alter table public.support_requests enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin_or_founder());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member" on public.organizations for select to authenticated using (public.is_org_member(id) or public.is_admin_or_founder());

drop policy if exists "organizations_insert_owner" on public.organizations;
create policy "organizations_insert_owner" on public.organizations for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "organizations_update_owner_admin" on public.organizations;
create policy "organizations_update_owner_admin" on public.organizations for update to authenticated using (public.has_org_role(id, array['owner','admin','founder'])) with check (public.has_org_role(id, array['owner','admin','founder']));

drop policy if exists "memberships_select_org_member" on public.organization_memberships;
create policy "memberships_select_org_member" on public.organization_memberships for select to authenticated using (public.is_org_member(organization_id) or public.is_admin_or_founder());

drop policy if exists "memberships_manage_owner_admin" on public.organization_memberships;
create policy "memberships_manage_owner_admin" on public.organization_memberships for all to authenticated using (public.has_org_role(organization_id, array['owner','admin','founder'])) with check (public.has_org_role(organization_id, array['owner','admin','founder']));

drop policy if exists "stripe_customers_select_member" on public.stripe_customers;
create policy "stripe_customers_select_member" on public.stripe_customers for select to authenticated using (public.is_org_member(organization_id) or public.is_admin_or_founder());

drop policy if exists "subscriptions_select_member" on public.subscriptions;
create policy "subscriptions_select_member" on public.subscriptions for select to authenticated using (public.is_org_member(organization_id) or public.is_admin_or_founder());

drop policy if exists "purchases_select_member" on public.purchases;
create policy "purchases_select_member" on public.purchases for select to authenticated using (public.is_org_member(organization_id) or public.is_admin_or_founder());

drop policy if exists "intake_requests_select_member" on public.intake_requests;
create policy "intake_requests_select_member" on public.intake_requests for select to authenticated using (public.is_org_member(organization_id) or user_id = auth.uid() or public.is_admin_or_founder());

drop policy if exists "intake_requests_insert_member" on public.intake_requests;
create policy "intake_requests_insert_member" on public.intake_requests for insert to authenticated with check (user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists "intake_requests_update_owner_admin" on public.intake_requests;
create policy "intake_requests_update_owner_admin" on public.intake_requests for update to authenticated using (public.has_org_role(organization_id, array['owner','admin','founder'])) with check (public.has_org_role(organization_id, array['owner','admin','founder']));

drop policy if exists "checklist_select_member" on public.launch_checklist_items;
create policy "checklist_select_member" on public.launch_checklist_items for select to authenticated using (public.is_org_member(organization_id) or public.is_admin_or_founder());

drop policy if exists "checklist_insert_member" on public.launch_checklist_items;
create policy "checklist_insert_member" on public.launch_checklist_items for insert to authenticated with check (user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists "checklist_update_member" on public.launch_checklist_items;
create policy "checklist_update_member" on public.launch_checklist_items for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists "checklist_delete_owner_admin" on public.launch_checklist_items;
create policy "checklist_delete_owner_admin" on public.launch_checklist_items for delete to authenticated using (public.has_org_role(organization_id, array['owner','admin','founder']) or user_id = auth.uid());

drop policy if exists "activity_select_member" on public.activity_events;
create policy "activity_select_member" on public.activity_events for select to authenticated using (public.is_org_member(organization_id) or public.is_admin_or_founder());

drop policy if exists "support_select_member" on public.support_requests;
create policy "support_select_member" on public.support_requests for select to authenticated using (public.is_org_member(organization_id) or user_id = auth.uid() or public.is_admin_or_founder());

drop policy if exists "support_insert_member" on public.support_requests;
create policy "support_insert_member" on public.support_requests for insert to authenticated with check (user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists "support_update_owner_admin" on public.support_requests;
create policy "support_update_owner_admin" on public.support_requests for update to authenticated using (public.has_org_role(organization_id, array['owner','admin','founder'])) with check (public.has_org_role(organization_id, array['owner','admin','founder']));

drop policy if exists "admin_audit_select_admin" on public.admin_audit_logs;
create policy "admin_audit_select_admin" on public.admin_audit_logs for select to authenticated using (public.is_admin_or_founder());

comment on table public.stripe_customers is 'Server-managed Stripe customer mapping. Do not expose Stripe secret keys to clients.';
comment on table public.subscriptions is 'Stripe webhook synchronized subscription state. Client checkout creation alone must not unlock paid access.';
comment on table public.purchases is 'Stripe webhook synchronized one-time purchase state.';
comment on table public.admin_audit_logs is 'Admin/founder audit records. Never store raw secrets in metadata.';

-- No anonymous policies are intentionally added.
-- Supabase service role bypasses RLS by design and must stay server-only.
