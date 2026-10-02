-- Included generation is an organization pool, renewed by verified Stripe periods.
-- Reservations precede provider work; settlement and the usage ledger share a
-- transaction. No subscription price, customer record or entitlement is changed.
create table if not exists public.generation_usage_reservations (
  job_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_subscription_ref text not null,
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  reserved_minor numeric not null check (reserved_minor >= 0),
  settled_minor numeric check (settled_minor >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'settled') = (settled_minor is not null))
);
create index if not exists generation_usage_reservations_pool
  on public.generation_usage_reservations (organization_id, period_start, period_end);
alter table public.generation_usage_reservations enable row level security;
revoke all on public.generation_usage_reservations from public, anon, authenticated;
grant select, insert, update on public.generation_usage_reservations to service_role;

create or replace function public.generation_usage(
  p_organization_id uuid, p_action text, p_job_id uuid default null,
  p_amount_minor numeric default 0, p_entry jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  subscription public.billing_subscriptions%rowtype;
  reservation public.generation_usage_reservations%rowtype;
  job public.creator_generation_jobs%rowtype;
  starts timestamptz;
  ends timestamptz;
  allowance numeric;
  spent numeric;
  held numeric;
  remaining numeric;
  result jsonb;
begin
  if p_organization_id is null or p_action not in ('status', 'reserve', 'settle', 'release') then
    return jsonb_build_object('ok', false, 'code', 'invalid_generation_usage_request');
  end if;
  -- One lock per tenant, covering renewals, overlapping plan changes and retries.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('generation:' || p_organization_id::text, 0));
  if p_action <> 'status' then
    if p_job_id is null then return jsonb_build_object('ok', false, 'code', 'generation_job_required'); end if;
    select * into reservation from public.generation_usage_reservations where job_id = p_job_id;
    if found and reservation.organization_id <> p_organization_id then
      return jsonb_build_object('ok', false, 'code', 'generation_job_not_owned');
    end if;
    select * into job from public.creator_generation_jobs where id = p_job_id;
    if found and job.organization_id <> p_organization_id then
      return jsonb_build_object('ok', false, 'code', 'generation_job_not_owned');
    end if;
  end if;

  if p_action = 'release' then
    -- Never release a completed output or a running/queued job after an
    -- uncertain HTTP write. Explicit failures/cancellations release their hold.
    if job.id is not null and job.status not in ('failed', 'cancelled') then
      return jsonb_build_object('ok', false, 'code', 'generation_job_still_active');
    end if;
    update public.generation_usage_reservations set status = 'released', updated_at = now()
      where job_id = p_job_id and organization_id = p_organization_id and status = 'reserved';
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'settle' then
    if job.id is null or job.status <> 'completed' then
      return jsonb_build_object('ok', false, 'code', 'generation_job_not_completed');
    end if;
    -- Jobs submitted before this migration keep their existing ledger path.
    if reservation.job_id is null then return jsonb_build_object('ok', true, 'legacy', true); end if;
    if reservation.status = 'settled' then return jsonb_build_object('ok', true, 'alreadyRecorded', true); end if;
    if p_entry->>'organization_id' is distinct from p_organization_id::text
      or p_entry->>'idempotency_key' is distinct from 'generation:' || p_job_id::text
      or p_entry->>'entry_kind' is distinct from 'draw'
      or p_entry->>'capability' is distinct from 'media_generation'
      or p_entry->>'unit' is distinct from 'gpu_second'
      or p_amount_minor is null or p_amount_minor < 0 or p_amount_minor > 100000
      or (p_entry->>'amount_minor')::numeric is distinct from p_amount_minor
      or (p_entry->>'units')::numeric is null or (p_entry->>'units')::numeric <= 0 then
      return jsonb_build_object('ok', false, 'code', 'invalid_generation_draw');
    end if;
    insert into public.usage_credit_ledger
      (organization_id, actor_user_id, entry_kind, capability, unit, units, amount_minor, cost_minor, margin_minor, idempotency_key, metadata)
    values (p_organization_id, (p_entry->>'actor_user_id')::uuid, 'draw', 'media_generation', 'gpu_second',
      (p_entry->>'units')::numeric, p_amount_minor, (p_entry->>'cost_minor')::numeric, (p_entry->>'margin_minor')::numeric,
      'generation:' || p_job_id::text, coalesce(p_entry->'metadata', '{}'::jsonb)
        || jsonb_build_object('included_period_start', reservation.period_start, 'included_period_end', reservation.period_end))
    on conflict (organization_id, idempotency_key) where entry_kind = 'draw' do nothing;
    update public.generation_usage_reservations set status = 'settled', settled_minor = p_amount_minor, updated_at = now()
      where job_id = p_job_id and organization_id = p_organization_id;
    return jsonb_build_object('ok', true);
  end if;

  select * into subscription from public.billing_subscriptions
    where organization_id = p_organization_id and provider = 'stripe' and status in ('active', 'trialing')
      and plan_slug in ('workspace_monthly', 'all_three_monthly', 'team_monthly', 'workspace_annual', 'all_three_annual', 'team_annual')
      and metadata->>'source' = 'stripe_webhook'
      and (plan_slug not in ('workspace_monthly', 'workspace_annual')
        or coalesce(metadata->>'workspace', metadata->>'workspace_key') = 'creator_studio')
    order by provider_event_at desc nulls last, created_at desc limit 1;
  if subscription.id is null or subscription.current_period_end is null or subscription.metadata->>'current_period_start' is null then
    return jsonb_build_object('ok', false, 'code', 'subscription_period_unavailable');
  end if;
  starts := (subscription.metadata->>'current_period_start')::timestamptz;
  ends := subscription.current_period_end;
  if starts > now() or ends <= now() or starts >= ends then
    return jsonb_build_object('ok', false, 'code', 'subscription_period_unavailable');
  end if;
  -- Preserve the existing $5 allowance per month; yearly subscriptions include
  -- twelve months in their verified yearly period. This is usage, not a fee.
  allowance := case when subscription.plan_slug like '%_annual' then 6000 else 500 end;
  select coalesce(sum(settled_minor) filter (where status = 'settled'), 0),
    coalesce(sum(reserved_minor) filter (where status = 'reserved'), 0)
    into spent, held from public.generation_usage_reservations
    where organization_id = p_organization_id and period_start < ends and period_end > starts;
  -- Include legacy completed jobs in this period, without counting new draws twice.
  select spent + coalesce(sum(l.amount_minor), 0) into spent from public.usage_credit_ledger l
    where l.organization_id = p_organization_id and l.entry_kind = 'draw' and l.capability = 'media_generation'
      and l.created_at >= starts and l.created_at < ends
      and not exists (select 1 from public.generation_usage_reservations r
        where r.organization_id = p_organization_id and l.idempotency_key = 'generation:' || r.job_id::text);
  remaining := greatest(0, allowance - spent - held);
  result := jsonb_build_object('ok', true, 'allowanceMinor', allowance, 'spentMinor', spent,
    'reservedMinor', held, 'remainingMinor', remaining, 'periodStart', starts, 'periodEnd', ends);
  if p_action = 'status' then return result; end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 100000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_generation_estimate');
  end if;
  if reservation.job_id is not null then
    return jsonb_build_object('ok', reservation.status = 'reserved' and reservation.reserved_minor = p_amount_minor,
      'code', 'generation_reservation_exists');
  end if;
  if job.id is not null then return jsonb_build_object('ok', false, 'code', 'generation_job_already_exists'); end if;
  if p_amount_minor > remaining then
    return result || jsonb_build_object('ok', false, 'code', 'included_generation_exhausted');
  end if;
  insert into public.generation_usage_reservations
    (job_id, organization_id, provider_subscription_ref, period_start, period_end, reserved_minor)
    values (p_job_id, p_organization_id, subscription.provider_subscription_ref, starts, ends, p_amount_minor);
  return result || jsonb_build_object('remainingMinor', remaining - p_amount_minor);
exception when invalid_text_representation or datetime_field_overflow then
  return jsonb_build_object('ok', false, 'code', 'generation_allowance_unavailable');
end;
$$;
revoke all on function public.generation_usage(uuid, text, uuid, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.generation_usage(uuid, text, uuid, numeric, jsonb) to service_role;

-- This table deliberately has no authenticated policy: the server verifies the
-- primary organization and paid workspace; customers cannot mutate usage holds.
do $$ begin
  if not exists (select 1 from pg_class where oid = 'public.generation_usage_reservations'::regclass and relrowsecurity) then
    raise exception 'Generation reservations require RLS';
  end if;
  if has_table_privilege('anon', 'public.generation_usage_reservations', 'SELECT')
    or has_table_privilege('authenticated', 'public.generation_usage_reservations', 'INSERT')
    or has_function_privilege('anon', 'public.generation_usage(uuid,text,uuid,numeric,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.generation_usage(uuid,text,uuid,numeric,jsonb)', 'EXECUTE') then
    raise exception 'Generation usage must remain server only';
  end if;
end $$;
