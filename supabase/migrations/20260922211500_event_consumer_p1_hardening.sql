-- Hardening for the first durable event-consumer canary.
--
-- The original event-consumer migration is already frozen in production. This
-- replacement keeps the same RPC signature while closing the stale-claim retry
-- ceiling: an expired claim that already consumed the fifth attempt is
-- dead-lettered atomically instead of being claimed a sixth time.
--
-- The JavaScript worker remains responsible for handler policy. This migration
-- only guarantees that crash/reclaim cycles cannot run beyond the delivery
-- ceiling recorded in lib/sonara-event-driven-agent-contract.cjs.

create or replace function public.claim_sonara_event_outbox_filtered(
  p_organization_id uuid,
  p_consumer text,
  p_kinds text[],
  p_producers text[],
  p_now timestamptz default now()
) returns setof public.event_outbox
language sql
set search_path = public, pg_temp
as $$
  with exhausted_candidate as (
    select id
    from public.event_outbox
    where organization_id = p_organization_id
      and coalesce(array_length(p_kinds, 1), 0) > 0
      and coalesce(array_length(p_producers, 1), 0) > 0
      and kind = any(p_kinds)
      and producer = any(p_producers)
      and state = 'claimed'
      and claimed_at is not null
      and claimed_at <= p_now - interval '5 minutes'
      and attempt_count >= 5
    order by claimed_at asc, created_at asc
    for update skip locked
    limit 1
  ), exhausted as (
    update public.event_outbox as event
    set state = 'dead_lettered',
        last_error_code = 'claim_lease_expired_attempts_exhausted'
    from exhausted_candidate
    where event.id = exhausted_candidate.id
    returning event.*
  ), exhausted_attempt as (
    insert into public.event_delivery_attempts (
      organization_id,
      event_outbox_id,
      attempt_number,
      consumer,
      outcome,
      error_code
    )
    select
      organization_id,
      id,
      attempt_count,
      coalesce(nullif(btrim(claimed_by), ''), 'expired-claim'),
      'dead_lettered',
      'claim_lease_expired_attempts_exhausted'
    from exhausted
    on conflict (event_outbox_id, attempt_number) do nothing
    returning id
  ), candidate as (
    select id
    from public.event_outbox
    where organization_id = p_organization_id
      and coalesce(array_length(p_kinds, 1), 0) > 0
      and coalesce(array_length(p_producers, 1), 0) > 0
      and kind = any(p_kinds)
      and producer = any(p_producers)
      and (
        (state = 'ready' and available_at <= p_now)
        or (
          state = 'claimed'
          and claimed_at is not null
          and claimed_at <= p_now - interval '5 minutes'
          and attempt_count < 5
        )
      )
    order by
      case when state = 'claimed' then 0 else 1 end,
      coalesce(claimed_at, available_at, created_at) asc,
      created_at asc
    for update skip locked
    limit 1
  ), claimed as (
    update public.event_outbox as event
    set state = 'claimed',
        claimed_by = nullif(btrim(p_consumer), ''),
        claimed_at = p_now,
        attempt_count = event.attempt_count + 1,
        last_error_code = case
          when event.state = 'claimed' then 'claim_lease_expired'
          else event.last_error_code
        end
    from candidate
    where event.id = candidate.id
      and nullif(btrim(p_consumer), '') is not null
    returning event.*
  )
  select * from claimed;
$$;

revoke all on function public.claim_sonara_event_outbox_filtered(uuid, text, text[], text[], timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_sonara_event_outbox_filtered(uuid, text, text[], text[], timestamptz)
  to service_role;

comment on function public.claim_sonara_event_outbox_filtered(uuid, text, text[], text[], timestamptz) is
  'Claims one organization-scoped outbox row matching explicit kind and producer allowlists. Stale claims below five attempts may be reclaimed; stale claims at the five-attempt ceiling are atomically dead-lettered with delivery-attempt evidence.';

notify pgrst, 'reload schema';
