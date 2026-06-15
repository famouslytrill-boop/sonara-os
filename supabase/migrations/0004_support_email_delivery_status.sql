-- Support intake queue and email delivery status.
-- Append-only migration for production contact/support fallback behavior.
-- Anonymous users may insert safe intake records only; anonymous reads are blocked by RLS.

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  reference_id text not null unique,
  category text not null check (category in ('contact', 'support', 'feedback')),
  requester_email text,
  message_preview text not null,
  consent_accepted boolean not null default false,
  email_delivery_status text not null default 'pending_email' check (
    email_delivery_status in ('pending_email', 'email_sent', 'email_failed')
  ),
  email_error_summary text,
  email_retry_count integer not null default 0 check (email_retry_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  support_request_id uuid not null references public.support_requests(id) on delete cascade,
  delivery_status text not null check (delivery_status in ('email_sent', 'email_failed')),
  provider text not null default 'resend',
  sanitized_error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists support_requests_status_created_idx
on public.support_requests(email_delivery_status, created_at desc);

create index if not exists support_requests_org_created_idx
on public.support_requests(organization_id, created_at desc);

grant insert on public.support_requests to anon;
grant select, update on public.support_requests to authenticated;
grant select, insert, update on public.support_requests to service_role;
grant select on public.support_email_delivery_attempts to authenticated;
grant insert, select on public.support_email_delivery_attempts to service_role;

alter table public.support_requests enable row level security;
alter table public.support_email_delivery_attempts enable row level security;

create policy "support_requests_public_insert" on public.support_requests
for insert to anon
with check (
  consent_accepted = true
  and email_delivery_status = 'pending_email'
  and email_retry_count = 0
);

create policy "support_requests_org_admin_select" on public.support_requests
for select to authenticated
using (
  organization_id is not null
  and public.is_org_admin(organization_id)
);

create policy "support_requests_org_admin_update" on public.support_requests
for update to authenticated
using (
  organization_id is not null
  and public.is_org_admin(organization_id)
)
with check (
  organization_id is not null
  and public.is_org_admin(organization_id)
);

create policy "support_email_attempts_org_admin_select" on public.support_email_delivery_attempts
for select to authenticated
using (
  exists (
    select 1
    from public.support_requests request
    where request.id = support_request_id
      and request.organization_id is not null
      and public.is_org_admin(request.organization_id)
  )
);
