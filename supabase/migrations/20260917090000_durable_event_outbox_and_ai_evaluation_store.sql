-- Durable delivery and AI-evaluation evidence for the event contracts.
--
-- The event and LLM observability modules were deliberately introduced before
-- a broker or observability vendor. That avoided an accidental vendor decision,
-- but it left their records in memory: a process could validate an event and
-- then vanish before a worker saw it; an evaluation could be calculated and
-- then be unavailable to an owner investigating a regression.
--
-- This migration is the smallest durable layer behind those contracts:
--
--   * event_outbox holds an event until a worker settles it.
--   * event_delivery_attempts is append-only evidence of each outcome.
--   * llm_observations stores the intentionally sanitized measurement record.
--   * agent_evaluation_runs stores golden-dataset results, never production
--     prompts or responses.
--
-- It is not a message broker, a public API, a customer-visible agent runtime,
-- or permission to run a provider. The only functions are server-role worker
-- primitives. Browser roles receive no privileges; RLS remains enabled and no
-- policy turns these operational records into a customer data export.
--
-- The event payload is for identifiers and reviewed structured data only. It
-- must already satisfy lib/sonara-event-driven-agent-contract.cjs, which
-- rejects obvious secret-bearing fields. Raw prompt/response material is not
-- accepted by llm_observations and is rejected again by database constraints.

create table if not exists public.event_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- `event_id` is text because the provider-neutral contract permits an
  -- upstream-generated ID. It is still unique within the tenant and paired
  -- with an idempotency key that prevents a producer retry from adding another
  -- side-effect candidate.
  event_id text not null,
  topic text not null,
  kind text not null,
  action text,
  actor_id text not null,
  producer text not null,
  correlation_id text not null,
  causation_id text,
  idempotency_key text not null,
  authority text not null check (authority in ('low_risk', 'owner_review')),
  payload jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,

  state text not null default 'ready'
    check (state in ('ready', 'claimed', 'delivered', 'dead_lettered')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  claimed_by text,
  claimed_at timestamptz,
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),

  constraint event_outbox_event_id_present check (length(btrim(event_id)) > 0),
  constraint event_outbox_idempotency_key_present check (length(btrim(idempotency_key)) > 0),
  constraint event_outbox_claim_has_owner check (
    state <> 'claimed' or (claimed_by is not null and claimed_at is not null)
  ),
  constraint event_outbox_delivery_has_time check (
    state <> 'delivered' or delivered_at is not null
  ),
  unique (organization_id, event_id),
  unique (organization_id, idempotency_key),
  unique (id, organization_id)
);

create index if not exists event_outbox_ready_claim_idx
  on public.event_outbox (organization_id, available_at, created_at)
  where state = 'ready';

create index if not exists event_outbox_correlation_idx
  on public.event_outbox (organization_id, correlation_id, created_at desc);

create table if not exists public.event_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_outbox_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  consumer text not null,
  outcome text not null check (outcome in ('delivered', 'retry', 'dead_lettered')),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint event_delivery_attempts_event_scope_fk
    foreign key (event_outbox_id, organization_id)
    references public.event_outbox (id, organization_id)
    on delete restrict,
  unique (event_outbox_id, attempt_number)
);

create index if not exists event_delivery_attempts_org_event_created_idx
  on public.event_delivery_attempts (organization_id, event_outbox_id, created_at desc);

create table if not exists public.llm_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trace_id text not null,
  span_id text not null,
  operation text not null,
  provider text not null,
  model text not null,
  outcome text not null check (outcome in ('ok', 'error', 'blocked', 'needs_review')),
  duration_ms numeric not null default 0 check (duration_ms >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  provider_called boolean not null default false,
  prompt_fingerprint text not null,
  source_refs jsonb not null default '[]'::jsonb,
  evaluations jsonb not null default '{}'::jsonb,
  error_code text,
  retention_class text not null default 'operational'
    check (retention_class in ('operational', 'security_audit')),
  tags jsonb not null default '[]'::jsonb,

  -- These fields exist so database evidence can prove their absence. They are
  -- not feature flags: a true value is invalid until a separate encrypted,
  -- reviewed secure-debug architecture is approved.
  raw_prompt_stored boolean not null default false check (raw_prompt_stored = false),
  raw_response_stored boolean not null default false check (raw_response_stored = false),
  secret_material_stored boolean not null default false check (secret_material_stored = false),
  created_at timestamptz not null default now(),

  unique (organization_id, trace_id, span_id)
);

create index if not exists llm_observations_org_created_idx
  on public.llm_observations (organization_id, created_at desc);

create index if not exists llm_observations_org_operation_created_idx
  on public.llm_observations (organization_id, operation, created_at desc);

create table if not exists public.agent_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_key text not null,
  prompt_template_id text not null,
  dataset_version text not null,
  case_id text not null,
  behavior_matched boolean not null,
  policy_matched boolean not null,
  grounded boolean not null,
  no_secret_leak boolean not null,
  passed boolean not null,
  note text,
  production_input boolean not null default false check (production_input = false),
  created_at timestamptz not null default now(),

  constraint agent_evaluation_runs_note_length check (note is null or length(note) <= 500)
);

create index if not exists agent_evaluation_runs_org_agent_created_idx
  on public.agent_evaluation_runs (organization_id, agent_key, created_at desc);

alter table public.event_outbox enable row level security;
alter table public.event_delivery_attempts enable row level security;
alter table public.llm_observations enable row level security;
alter table public.agent_evaluation_runs enable row level security;

-- The service role is the only caller. It bypasses RLS, so every repository
-- and worker query still carries organization_id as the explicit tenant scope.
grant select, insert, update on table public.event_outbox to service_role;
grant select, insert on table public.event_delivery_attempts to service_role;
grant select, insert on table public.llm_observations to service_role;
grant select, insert on table public.agent_evaluation_runs to service_role;

-- One worker can claim one ready event without racing every other worker.
-- SKIP LOCKED prevents a slow event from holding up the rest of the tenant's
-- queue, and the update is the claim -- no read-then-write window exists.
create or replace function public.claim_sonara_event_outbox(
  p_organization_id uuid,
  p_consumer text,
  p_now timestamptz default now()
) returns setof public.event_outbox
language sql
set search_path = public, pg_temp
as $$
  with candidate as (
    select id
    from public.event_outbox
    where organization_id = p_organization_id
      and state = 'ready'
      and available_at <= p_now
    order by available_at asc, created_at asc
    for update skip locked
    limit 1
  ), claimed as (
    update public.event_outbox as event
    set state = 'claimed',
        claimed_by = nullif(btrim(p_consumer), ''),
        claimed_at = p_now,
        attempt_count = event.attempt_count + 1
    from candidate
    where event.id = candidate.id
      and nullif(btrim(p_consumer), '') is not null
    returning event.*
  )
  select * from claimed;
$$;

-- Settling changes the event state and appends attempt evidence in the same
-- statement. A duplicate worker cannot append a second settlement because it
-- must still hold the matching `claimed` state and consumer identity.
create or replace function public.settle_sonara_event_outbox(
  p_organization_id uuid,
  p_event_outbox_id uuid,
  p_consumer text,
  p_outcome text,
  p_error_code text default null,
  p_next_available_at timestamptz default null,
  p_now timestamptz default now()
) returns setof public.event_outbox
language sql
set search_path = public, pg_temp
as $$
  with settled as (
    update public.event_outbox as event
    set state = case p_outcome
          when 'delivered' then 'delivered'
          when 'dead_lettered' then 'dead_lettered'
          when 'retry' then 'ready'
          else event.state
        end,
        available_at = case
          when p_outcome = 'retry' then greatest(coalesce(p_next_available_at, p_now), p_now)
          else event.available_at
        end,
        claimed_by = case when p_outcome = 'retry' then null else event.claimed_by end,
        claimed_at = case when p_outcome = 'retry' then null else event.claimed_at end,
        delivered_at = case when p_outcome = 'delivered' then p_now else event.delivered_at end,
        last_error_code = case when p_outcome = 'delivered' then null else nullif(left(coalesce(p_error_code, ''), 120), '') end
    where event.id = p_event_outbox_id
      and event.organization_id = p_organization_id
      and event.state = 'claimed'
      and event.claimed_by = nullif(btrim(p_consumer), '')
      and p_outcome in ('delivered', 'retry', 'dead_lettered')
    returning event.*
  ), attempt as (
    insert into public.event_delivery_attempts (
      organization_id, event_outbox_id, attempt_number, consumer, outcome, error_code
    )
    -- `settled.claimed_by` is intentionally cleared for a retry. The audit
    -- record must still retain the worker that held the claim, so use the
    -- caller value that was also required in the settlement predicate.
    select organization_id, id, attempt_count, nullif(btrim(p_consumer), ''), p_outcome,
      nullif(left(coalesce(p_error_code, ''), 120), '')
    from settled
  )
  select * from settled;
$$;

revoke all on function public.claim_sonara_event_outbox(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.settle_sonara_event_outbox(uuid, uuid, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_sonara_event_outbox(uuid, text, timestamptz) to service_role;
grant execute on function public.settle_sonara_event_outbox(uuid, uuid, text, text, text, timestamptz, timestamptz) to service_role;

comment on table public.event_outbox is
  'Organization-scoped durable outbox for validated SONARA events. A producer retry is deduplicated by organization_id/idempotency_key; workers claim through claim_sonara_event_outbox and settle through settle_sonara_event_outbox.';

comment on table public.event_delivery_attempts is
  'Append-only evidence of an event-outbox delivery attempt. It never stores the event payload, prompt, response, token, credential, or private media.';

comment on table public.llm_observations is
  'Sanitized provider-neutral LLM telemetry. Raw prompts, raw responses, and secret material are prohibited by database constraints as well as application contracts.';

comment on table public.agent_evaluation_runs is
  'Golden-dataset evaluation outcomes for agents. Production inputs are prohibited; only reviewed cases and compact outcome evidence belong here.';

do $$
begin
  if to_regclass('public.event_outbox') is null
    or to_regclass('public.event_delivery_attempts') is null
    or to_regclass('public.llm_observations') is null
    or to_regclass('public.agent_evaluation_runs') is null then
    raise exception 'durable event and AI-evaluation tables were not created';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.event_outbox', 'SELECT')
    or not pg_catalog.has_table_privilege('service_role', 'public.event_outbox', 'INSERT')
    or not pg_catalog.has_table_privilege('service_role', 'public.event_outbox', 'UPDATE') then
    raise exception 'service_role cannot operate the event outbox';
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.event_outbox', 'SELECT')
    or pg_catalog.has_table_privilege('authenticated', 'public.event_outbox', 'SELECT')
    or pg_catalog.has_table_privilege('anon', 'public.llm_observations', 'SELECT')
    or pg_catalog.has_table_privilege('authenticated', 'public.llm_observations', 'SELECT') then
    raise exception 'browser roles may not read operational event or AI-observability records';
  end if;
end
$$;

notify pgrst, 'reload schema';
