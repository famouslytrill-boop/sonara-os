-- Phase 0 hardening: durable, cross-instance rate limiting for authentication
-- routes.
--
-- Context: the application runs as Vercel serverless functions, so an
-- in-process counter is not a rate limit -- each concurrent instance would
-- keep its own tally and an attacker gets N times the budget. The counter has
-- to live somewhere shared. This uses Postgres rather than introducing a new
-- vendor, secret, and failure mode for a Phase 0 fix.
--
-- The consume function is the only interface. The table is never read or
-- written directly by the application.
--
-- No customer data is modified by this migration.

create table if not exists public.sonara_auth_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.sonara_auth_rate_limits is
  'Shared counters backing authentication rate limits. Written only by public.sonara_consume_rate_limit().';

-- Supports the opportunistic prune below.
create index if not exists sonara_auth_rate_limits_window_idx
  on public.sonara_auth_rate_limits (window_started_at);

-- Fail closed for the Data API. The application reaches this table only through
-- the service role, which bypasses RLS; anon and authenticated get nothing.
alter table public.sonara_auth_rate_limits enable row level security;

revoke all on table public.sonara_auth_rate_limits from anon, authenticated;

-- Atomically consume one unit from a fixed window and report the outcome.
--
-- The insert-on-conflict is a single statement, so concurrent callers serialize
-- on the primary key rather than racing a read-then-write. A fixed window (not
-- a sliding one) is deliberate: it is one row and one statement, and for login
-- throttling the burst-at-boundary weakness is not worth the extra cost.
create or replace function public.sonara_consume_rate_limit(
  p_bucket_key text,
  p_window_seconds integer,
  p_max_attempts integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window timestamptz;
  v_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) = 0 then
    raise exception 'bucket key is required';
  end if;
  if coalesce(p_window_seconds, 0) <= 0 or coalesce(p_max_attempts, 0) <= 0 then
    raise exception 'window and attempt ceiling must both be positive';
  end if;

  insert into public.sonara_auth_rate_limits as c (bucket_key, window_started_at, attempt_count, updated_at)
  values (p_bucket_key, v_now, 1, v_now)
  on conflict (bucket_key) do update
    set attempt_count = case
          when c.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1
          else c.attempt_count + 1
        end,
        window_started_at = case
          when c.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now
          else c.window_started_at
        end,
        updated_at = v_now
  returning c.attempt_count, c.window_started_at into v_count, v_window;

  allowed := v_count <= p_max_attempts;
  remaining := greatest(p_max_attempts - v_count, 0);
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds)) - v_now))::integer,
      1
    )
  end;

  -- Opportunistic prune keeps the table bounded without depending on pg_cron
  -- being enabled. Roughly one call in 200 pays for cleanup; the rest are a
  -- single upsert. Rows older than a day cannot affect any live window.
  if random() < 0.005 then
    delete from public.sonara_auth_rate_limits
    where window_started_at < v_now - interval '1 day';
  end if;

  return next;
end;
$$;

-- Only the server-side service role may consume budget. Exposing this to anon
-- or authenticated would let a caller burn another principal's budget by
-- guessing bucket keys.
revoke execute on function public.sonara_consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.sonara_consume_rate_limit(text, integer, integer)
  to service_role;

-- Self-verify, matching the pattern from 20260718064853.
do $$
declare
  v_allowed boolean;
  v_remaining integer;
  v_retry integer;
  v_key text := 'migration-self-test:' || gen_random_uuid()::text;
begin
  select allowed, remaining, retry_after_seconds
    into v_allowed, v_remaining, v_retry
  from public.sonara_consume_rate_limit(v_key, 60, 2);
  if not v_allowed or v_remaining <> 1 then
    raise exception 'rate limit self-test: first call should be allowed with 1 remaining (got %, %)', v_allowed, v_remaining;
  end if;

  perform public.sonara_consume_rate_limit(v_key, 60, 2);

  select allowed, retry_after_seconds
    into v_allowed, v_retry
  from public.sonara_consume_rate_limit(v_key, 60, 2);
  if v_allowed then
    raise exception 'rate limit self-test: third call should have been denied';
  end if;
  if v_retry < 1 then
    raise exception 'rate limit self-test: denied call must report a positive retry_after (got %)', v_retry;
  end if;

  delete from public.sonara_auth_rate_limits where bucket_key = v_key;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'sonara_auth_rate_limits' and c.relrowsecurity
  ) then
    raise exception 'public.sonara_auth_rate_limits must have row level security enabled';
  end if;
end $$;
