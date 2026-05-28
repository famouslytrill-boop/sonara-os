-- Support and contact intake tables.
-- Additive only. Public inserts are allowed, reads/updates remain restricted by RLS.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  organization_name text,
  category text not null check (
    category in (
      'general_question',
      'sales_pricing',
      'billing_refund',
      'technical_support',
      'security_report',
      'legal_privacy',
      'partnership'
    )
  ),
  subject text not null,
  message text not null,
  urgency text not null default 'normal' check (urgency in ('low', 'normal', 'urgent')),
  status text not null default 'new' check (status in ('new', 'triaged', 'in_review', 'waiting', 'closed')),
  source_path text,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feedback_type text not null check (
    feedback_type in (
      'bug_report',
      'feature_request',
      'confusion_friction',
      'pricing_feedback',
      'mobile_issue',
      'accessibility_issue',
      'general_feedback'
    )
  ),
  page_path text,
  rating integer check (rating is null or (rating >= 1 and rating <= 5)),
  message text not null,
  email text,
  user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'organizations'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'support_requests_organization_id_fkey'
  ) then
    alter table public.support_requests
      add constraint support_requests_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete set null;
  end if;
end $$;

create index if not exists support_requests_created_at_idx
  on public.support_requests (created_at desc);

create index if not exists support_requests_status_idx
  on public.support_requests (status);

create index if not exists support_requests_category_idx
  on public.support_requests (category);

create index if not exists feedback_reports_created_at_idx
  on public.feedback_reports (created_at desc);

create index if not exists feedback_reports_type_idx
  on public.feedback_reports (feedback_type);

alter table public.support_requests enable row level security;
alter table public.feedback_reports enable row level security;

drop policy if exists "Anonymous users can insert support requests" on public.support_requests;
create policy "Anonymous users can insert support requests"
  on public.support_requests
  for insert
  to anon
  with check (
    name is not null
    and email is not null
    and category is not null
    and subject is not null
    and message is not null
  );

drop policy if exists "Authenticated users can insert own support requests" on public.support_requests;
create policy "Authenticated users can insert own support requests"
  on public.support_requests
  for insert
  to authenticated
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "Authenticated users can read own support requests" on public.support_requests;
create policy "Authenticated users can read own support requests"
  on public.support_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage support requests" on public.support_requests;
create policy "Service role can manage support requests"
  on public.support_requests
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Anonymous users can insert feedback reports" on public.feedback_reports;
create policy "Anonymous users can insert feedback reports"
  on public.feedback_reports
  for insert
  to anon
  with check (
    feedback_type is not null
    and message is not null
  );

drop policy if exists "Authenticated users can insert own feedback reports" on public.feedback_reports;
create policy "Authenticated users can insert own feedback reports"
  on public.feedback_reports
  for insert
  to authenticated
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "Authenticated users can read own feedback reports" on public.feedback_reports;
create policy "Authenticated users can read own feedback reports"
  on public.feedback_reports
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage feedback reports" on public.feedback_reports;
create policy "Service role can manage feedback reports"
  on public.feedback_reports
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.support_requests is
  'Public support and contact requests. Inserts are allowed; reads and management stay authenticated/server-side.';

comment on table public.feedback_reports is
  'Beta feedback reports for bugs, features, friction, pricing, mobile, accessibility, and general feedback.';
