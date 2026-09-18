-- Consumer activation readiness for the durable event outbox.
--
-- This migration is additive. The original 20260917090000 migration is already
-- applied in production and remains frozen. This adds a filtered claim path for
-- one explicitly scoped consumer without changing the generic claim contract.
--
-- The filtered claim is deliberately narrow:
--   * one organization id is mandatory;
--   * at least one kind and producer must be supplied;
--   * SKIP LOCKED keeps concurrent workers from claiming the same row;
--   * a claim older than five minutes may be reclaimed, because a worker that
--     dies after claiming must not strand the row forever.
--
-- A real worker uses a unique claim-owner token per invocation. When a stale
-- claim is reclaimed, the old invocation can no longer settle it because
-- settle_sonara_event_outbox also requires claimed_by to match.

create index if not exists event_outbox_filtered_ready_claim_idx
  on public.event_outbox (organization_id, kind, producer, available_at, created_at)
  where state = 'ready';

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
  with candidate as (
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
  'Claims one organization-scoped outbox row matching an explicit kind and producer allowlist. Uses SKIP LOCKED for concurrency and reclaims claims older than five minutes. Callers must use a unique claim-owner token so a stale worker cannot settle a reclaimed row.';

do $$
begin
  if to_regprocedure('public.claim_sonara_event_outbox_filtered(uuid,text,text[],text[],timestamptz)') is null then
    raise exception 'filtered event outbox claim function was not created';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_sonara_event_outbox_filtered(uuid,text,text[],text[],timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute filtered event outbox claim';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated',
    'public.claim_sonara_event_outbox_filtered(uuid,text,text[],text[],timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'authenticated browser role may not claim event outbox rows';
  end if;
end
$$;

notify pgrst, 'reload schema';
