-- Support request delivery state used by the Express support workflow.
-- Additive and idempotent: no provider credentials or customer seed data.

alter table public.support_requests
  add column if not exists reference_id uuid not null default gen_random_uuid(),
  add column if not exists consent_accepted boolean not null default false,
  add column if not exists email_delivery_status text not null default 'pending',
  add column if not exists email_error_summary text,
  add column if not exists email_retry_count integer not null default 0;

create unique index if not exists support_requests_reference_id_idx
  on public.support_requests (reference_id);

create table if not exists public.support_email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  support_request_id uuid not null references public.support_requests(id) on delete cascade,
  delivery_status text not null,
  provider text not null,
  sanitized_error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists support_email_delivery_attempts_request_idx
  on public.support_email_delivery_attempts (support_request_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_requests_email_delivery_status_check'
      and conrelid = 'public.support_requests'::regclass
  ) then
    alter table public.support_requests
      add constraint support_requests_email_delivery_status_check
      check (email_delivery_status in ('pending', 'email_sent', 'email_failed')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'support_requests_email_retry_count_check'
      and conrelid = 'public.support_requests'::regclass
  ) then
    alter table public.support_requests
      add constraint support_requests_email_retry_count_check
      check (email_retry_count >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'support_email_delivery_attempts_status_check'
      and conrelid = 'public.support_email_delivery_attempts'::regclass
  ) then
    alter table public.support_email_delivery_attempts
      add constraint support_email_delivery_attempts_status_check
      check (delivery_status in ('email_sent', 'email_failed')) not valid;
  end if;
end $$;

alter table public.support_email_delivery_attempts enable row level security;

drop policy if exists "service role manages support email delivery attempts"
  on public.support_email_delivery_attempts;
create policy "service role manages support email delivery attempts"
  on public.support_email_delivery_attempts
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.support_email_delivery_attempts from anon, authenticated;
grant select, insert, update, delete on public.support_email_delivery_attempts to service_role;

comment on table public.support_email_delivery_attempts is
  'Server-only delivery audit for support notifications. Stores sanitized errors and no provider credentials.';
