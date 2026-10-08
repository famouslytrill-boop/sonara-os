-- SONARA customer/automation weighted resource budgets.
--
-- Durable shared state for expensive non-authentication work. Authentication
-- throttling remains in public.sonara_auth_rate_limits and
-- public.sonara_consume_rate_limit(); this migration deliberately does not
-- overload that security boundary.
--
-- This does NOT authorize an automation, publish content, move money, change
-- permissions or call a provider. Server authorization/approval must happen
-- separately before the caller consumes this budget and claims a lease.

create schema if not exists sonara_governance;
revoke all on schema sonara_governance from public, anon, authenticated;

create table if not exists sonara_governance.resource_budget_state (
  bucket_key char(64) primary key
    check (bucket_key ~ '^[a-f0-9]{64}$'),
  operation_key text not null
    check (operation_key ~ '^[a-z0-9_:-]{1,80}$'),
  capacity_units bigint not null check (capacity_units between 1 and 1000000000),
  refill_units_per_minute bigint not null check (refill_units_per_minute between 0 and 1000000000),
  available_units bigint not null check (available_units between 0 and 1000000000),
  last_refill_at timestamptz not null,
  daily_window_utc date not null,
  daily_used_units bigint not null default 0 check (daily_used_units between 0 and 1000000000),
  daily_limit_units bigint not null check (daily_limit_units between 1 and 1000000000),
  concurrency_limit integer not null default 1 check (concurrency_limit between 1 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists sonara_governance.resource_budget_leases (
  lease_id uuid primary key,
  bucket_key char(64) not null
    references sonara_governance.resource_budget_state(bucket_key) on delete cascade,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > acquired_at)
);

create index if not exists resource_budget_leases_bucket_expiry_idx
  on sonara_governance.resource_budget_leases(bucket_key, expires_at);

comment on table sonara_governance.resource_budget_state is
  'Service-only shared weighted resource budget state. Bucket keys are SHA-256 digests; no raw IP/email/provider secret belongs here.';
comment on table sonara_governance.resource_budget_leases is
  'Short-lived concurrency leases. Expiry self-recovers capacity after worker/process failure.';

alter table sonara_governance.resource_budget_state enable row level security;
alter table sonara_governance.resource_budget_leases enable row level security;
revoke all on sonara_governance.resource_budget_state from public, anon, authenticated, service_role;
revoke all on sonara_governance.resource_budget_leases from public, anon, authenticated, service_role;

create or replace function public.sonara_consume_resource_budget(
  p_bucket_key text,
  p_operation_key text,
  p_capacity_units bigint,
  p_refill_units_per_minute bigint,
  p_daily_limit_units bigint,
  p_cost_units bigint
)
returns table (
  allowed boolean,
  reason text,
  remaining_units bigint,
  daily_remaining_units bigint,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'UTC')::date;
  v_row sonara_governance.resource_budget_state%rowtype;
  v_elapsed_seconds numeric;
  v_refill bigint := 0;
  v_available bigint;
  v_daily_used bigint;
  v_next_day timestamptz;
  v_missing bigint;
begin
  if p_bucket_key is null or p_bucket_key !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_resource_budget_bucket';
  end if;
  if p_operation_key is null or p_operation_key !~ '^[a-z0-9_:-]{1,80}$' then
    raise exception 'invalid_resource_budget_operation';
  end if;
  if p_capacity_units is null or p_capacity_units < 1 or p_capacity_units > 1000000000
     or p_refill_units_per_minute is null or p_refill_units_per_minute < 0 or p_refill_units_per_minute > 1000000000
     or p_daily_limit_units is null or p_daily_limit_units < 1 or p_daily_limit_units > 1000000000
     or p_cost_units is null or p_cost_units < 1 or p_cost_units > 1000000000 then
    raise exception 'invalid_resource_budget_units';
  end if;

  insert into sonara_governance.resource_budget_state(
    bucket_key, operation_key, capacity_units, refill_units_per_minute,
    available_units, last_refill_at, daily_window_utc, daily_used_units,
    daily_limit_units, updated_at
  ) values (
    p_bucket_key, p_operation_key, p_capacity_units, p_refill_units_per_minute,
    p_capacity_units, v_now, v_today, 0, p_daily_limit_units, v_now
  ) on conflict (bucket_key) do nothing;

  select * into v_row
  from sonara_governance.resource_budget_state
  where bucket_key = p_bucket_key
  for update;

  if not found then
    raise exception 'resource_budget_state_missing';
  end if;
  if v_row.operation_key <> p_operation_key then
    raise exception 'resource_budget_operation_mismatch';
  end if;

  -- Apply the current server policy at the serialized boundary. Tightening a
  -- policy clamps capacity immediately; relaxing it does not invent spent
  -- budget. Refill uses the new current rate from this point.
  v_elapsed_seconds := greatest(extract(epoch from (v_now - v_row.last_refill_at)), 0);
  v_refill := floor(v_elapsed_seconds * p_refill_units_per_minute / 60)::bigint;
  v_available := least(p_capacity_units, least(v_row.available_units, p_capacity_units) + v_refill);
  v_daily_used := case when v_row.daily_window_utc = v_today then v_row.daily_used_units else 0 end;

  allowed := false;
  reason := 'weighted_rate_budget_exceeded';
  retry_after_seconds := 0;

  if v_daily_used + p_cost_units > p_daily_limit_units then
    reason := 'daily_budget_exceeded';
    v_next_day := ((v_today + 1)::timestamp at time zone 'UTC');
    retry_after_seconds := greatest(1, ceil(extract(epoch from (v_next_day - v_now)))::integer);
  elsif p_cost_units > v_available then
    if p_refill_units_per_minute = 0 then
      reason := 'budget_exhausted_no_refill';
      retry_after_seconds := 0;
    else
      v_missing := p_cost_units - v_available;
      retry_after_seconds := greatest(
        1,
        least(2147483647::numeric, ceil(v_missing * 60.0 / p_refill_units_per_minute))::integer
      );
    end if;
  else
    allowed := true;
    reason := 'within_budget';
    v_available := v_available - p_cost_units;
    v_daily_used := v_daily_used + p_cost_units;
  end if;

  update sonara_governance.resource_budget_state
  set capacity_units = p_capacity_units,
      refill_units_per_minute = p_refill_units_per_minute,
      available_units = v_available,
      last_refill_at = v_now,
      daily_window_utc = v_today,
      daily_used_units = v_daily_used,
      daily_limit_units = p_daily_limit_units,
      updated_at = v_now
  where bucket_key = p_bucket_key;

  remaining_units := v_available;
  daily_remaining_units := greatest(p_daily_limit_units - v_daily_used, 0);
  return next;
end;
$$;

create or replace function public.sonara_claim_resource_concurrency(
  p_bucket_key text,
  p_lease_id uuid,
  p_concurrency_limit integer,
  p_lease_seconds integer
)
returns table (
  allowed boolean,
  reason text,
  active_leases integer,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_existing sonara_governance.resource_budget_leases%rowtype;
  v_active integer;
  v_expiry timestamptz;
begin
  if p_bucket_key is null or p_bucket_key !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_resource_budget_bucket';
  end if;
  if p_lease_id is null then raise exception 'lease_id_required'; end if;
  if p_concurrency_limit is null or p_concurrency_limit < 1 or p_concurrency_limit > 100 then
    raise exception 'invalid_concurrency_limit';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 3600 then
    raise exception 'invalid_lease_seconds';
  end if;

  -- Serializes claims for one bucket. The budget row must already exist from a
  -- successful/attempted resource-budget evaluation.
  perform 1 from sonara_governance.resource_budget_state
  where bucket_key = p_bucket_key
  for update;
  if not found then raise exception 'resource_budget_state_missing'; end if;

  select * into v_existing
  from sonara_governance.resource_budget_leases
  where lease_id = p_lease_id;

  if found then
    if v_existing.bucket_key <> p_bucket_key then raise exception 'lease_bucket_mismatch'; end if;
    if v_existing.expires_at > v_now then
      select count(*)::integer into v_active
      from sonara_governance.resource_budget_leases
      where bucket_key = p_bucket_key and expires_at > v_now;
      allowed := true;
      reason := 'lease_reused';
      active_leases := v_active;
      lease_expires_at := v_existing.expires_at;
      return next;
      return;
    end if;
    delete from sonara_governance.resource_budget_leases where lease_id = p_lease_id;
  end if;

  delete from sonara_governance.resource_budget_leases
  where bucket_key = p_bucket_key and expires_at <= v_now;

  select count(*)::integer into v_active
  from sonara_governance.resource_budget_leases
  where bucket_key = p_bucket_key and expires_at > v_now;

  update sonara_governance.resource_budget_state
  set concurrency_limit = p_concurrency_limit, updated_at = v_now
  where bucket_key = p_bucket_key;

  if v_active >= p_concurrency_limit then
    allowed := false;
    reason := 'concurrency_budget_exceeded';
    active_leases := v_active;
    lease_expires_at := null;
    return next;
    return;
  end if;

  v_expiry := v_now + make_interval(secs => p_lease_seconds);
  insert into sonara_governance.resource_budget_leases(lease_id,bucket_key,acquired_at,expires_at)
  values (p_lease_id,p_bucket_key,v_now,v_expiry);

  allowed := true;
  reason := 'concurrency_lease_acquired';
  active_leases := v_active + 1;
  lease_expires_at := v_expiry;
  return next;
end;
$$;

create or replace function public.sonara_release_resource_concurrency(
  p_bucket_key text,
  p_lease_id uuid
)
returns table (released boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_bucket_key is null or p_bucket_key !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_resource_budget_bucket';
  end if;
  if p_lease_id is null then raise exception 'lease_id_required'; end if;

  delete from sonara_governance.resource_budget_leases
  where bucket_key = p_bucket_key and lease_id = p_lease_id;
  released := found;
  return next;
end;
$$;

revoke execute on function public.sonara_consume_resource_budget(text,text,bigint,bigint,bigint,bigint)
  from public, anon, authenticated;
revoke execute on function public.sonara_claim_resource_concurrency(text,uuid,integer,integer)
  from public, anon, authenticated;
revoke execute on function public.sonara_release_resource_concurrency(text,uuid)
  from public, anon, authenticated;

grant execute on function public.sonara_consume_resource_budget(text,text,bigint,bigint,bigint,bigint)
  to service_role;
grant execute on function public.sonara_claim_resource_concurrency(text,uuid,integer,integer)
  to service_role;
grant execute on function public.sonara_release_resource_concurrency(text,uuid)
  to service_role;

-- Migration-time proof of atomic consumption, denial, lease saturation,
-- idempotent lease reuse, release, and recovery.
do $$
declare
  v_bucket text := encode(digest('sonara-resource-budget-migration-test','sha256'),'hex');
  v_lease_a uuid := gen_random_uuid();
  v_lease_b uuid := gen_random_uuid();
  v_allowed boolean;
  v_reason text;
  v_active integer;
  v_released boolean;
begin
  select allowed, reason into v_allowed, v_reason
  from public.sonara_consume_resource_budget(v_bucket,'automation_run',10,0,20,6);
  if not v_allowed or v_reason <> 'within_budget' then
    raise exception 'resource budget self-test: first consume should pass';
  end if;

  select allowed, reason into v_allowed, v_reason
  from public.sonara_consume_resource_budget(v_bucket,'automation_run',10,0,20,6);
  if v_allowed or v_reason <> 'weighted_rate_budget_exceeded' then
    raise exception 'resource budget self-test: second consume should hit rate budget';
  end if;

  select allowed, reason, active_leases into v_allowed, v_reason, v_active
  from public.sonara_claim_resource_concurrency(v_bucket,v_lease_a,1,60);
  if not v_allowed or v_active <> 1 then
    raise exception 'resource concurrency self-test: first lease should pass';
  end if;

  select allowed, reason, active_leases into v_allowed, v_reason, v_active
  from public.sonara_claim_resource_concurrency(v_bucket,v_lease_a,1,60);
  if not v_allowed or v_reason <> 'lease_reused' or v_active <> 1 then
    raise exception 'resource concurrency self-test: replay must reuse the lease';
  end if;

  select allowed, reason into v_allowed, v_reason
  from public.sonara_claim_resource_concurrency(v_bucket,v_lease_b,1,60);
  if v_allowed or v_reason <> 'concurrency_budget_exceeded' then
    raise exception 'resource concurrency self-test: second lease should be denied';
  end if;

  select released into v_released
  from public.sonara_release_resource_concurrency(v_bucket,v_lease_a);
  if not v_released then raise exception 'resource concurrency self-test: release should remove lease'; end if;

  select allowed into v_allowed
  from public.sonara_claim_resource_concurrency(v_bucket,v_lease_b,1,60);
  if not v_allowed then raise exception 'resource concurrency self-test: capacity should recover after release'; end if;

  perform public.sonara_release_resource_concurrency(v_bucket,v_lease_b);
  delete from sonara_governance.resource_budget_state where bucket_key = v_bucket;
end $$;

notify pgrst, 'reload schema';
