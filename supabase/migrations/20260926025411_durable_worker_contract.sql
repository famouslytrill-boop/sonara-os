-- Durable worker contract. Safe to replay; activation remains disabled until a
-- worker and one-tenant canary have passed the release gates.
alter table public.platform_jobs add column if not exists idempotency_key text;
alter table public.platform_jobs add column if not exists attempts integer not null default 0;
alter table public.platform_jobs add column if not exists max_attempts integer not null default 5;
alter table public.platform_jobs add column if not exists next_attempt_at timestamptz not null default now();
alter table public.platform_jobs add column if not exists locked_at timestamptz;
alter table public.platform_jobs add column if not exists locked_by text;
alter table public.platform_jobs add column if not exists last_error text;
alter table public.platform_jobs add column if not exists dead_lettered_at timestamptz;

create unique index if not exists platform_jobs_idempotency_key_idx
  on public.platform_jobs (idempotency_key) where idempotency_key is not null;
create index if not exists platform_jobs_claim_idx
  on public.platform_jobs (status, next_attempt_at, priority desc, created_at);

create table if not exists public.platform_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.platform_jobs(id),
  event_type text not null check (event_type in ('enqueued','claimed','succeeded','retry_scheduled','dead_lettered','recovered')),
  attempt integer not null default 0,
  trace_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_job_events_job_idx on public.platform_job_events(job_id, created_at desc);

alter table public.platform_job_events enable row level security;
drop policy if exists "service role manages platform job events" on public.platform_job_events;
create policy "service role manages platform job events" on public.platform_job_events
  for all to service_role using (true) with check (true);
revoke all on public.platform_job_events from public, anon, authenticated;
grant select, insert on public.platform_job_events to service_role;

create or replace function public.claim_platform_job(p_worker_id text, p_job_type text default null)
returns setof public.platform_jobs
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker id is required';
  end if;
  return query
  with candidate as (
    select id from public.platform_jobs
    where status in ('queued','retryable')
      and next_attempt_at <= now()
      and (p_job_type is null or job_type = p_job_type)
      and attempts < max_attempts
    order by priority desc, created_at
    for update skip locked limit 1
  )
  update public.platform_jobs j
  set status = 'processing', attempts = j.attempts + 1,
      started_at = coalesce(j.started_at, now()), locked_at = now(), locked_by = p_worker_id
  from candidate where j.id = candidate.id
  returning j.*;
end;
$$;

comment on function public.claim_platform_job(text,text) is
  'Claims one eligible job atomically with row locking; workers must be idempotent.';

revoke all on function public.claim_platform_job(text,text) from public, anon, authenticated;
grant execute on function public.claim_platform_job(text,text) to service_role;

create or replace function public.enqueue_platform_job(
  p_job_type text,
  p_idempotency_key text,
  p_input jsonb default '{}'::jsonb,
  p_priority integer default 5,
  p_max_attempts integer default 5
)
returns public.platform_jobs
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  result public.platform_jobs;
  created boolean;
begin
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'idempotency key is required';
  end if;
  insert into public.platform_jobs(job_type, status, priority, input, idempotency_key, max_attempts, next_attempt_at)
  values (p_job_type, 'queued', greatest(0, p_priority), coalesce(p_input, '{}'::jsonb), p_idempotency_key, greatest(1, p_max_attempts), now())
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning * into result;
  created := found;
  if not created then
    select * into result from public.platform_jobs where idempotency_key = p_idempotency_key;
  end if;
  if result.id is null then
    raise exception 'could not resolve idempotent job';
  end if;
  if created then
    insert into public.platform_job_events(job_id, event_type, attempt, metadata)
    values (result.id, 'enqueued', result.attempts, '{}'::jsonb);
  end if;
  return result;
end;
$$;

comment on function public.enqueue_platform_job(text,text,jsonb,integer,integer) is
  'Idempotent durable enqueue. Repeated keys return the original job instead of creating duplicates.';

revoke all on function public.enqueue_platform_job(text,text,jsonb,integer,integer) from public, anon, authenticated;
grant execute on function public.enqueue_platform_job(text,text,jsonb,integer,integer) to service_role;
