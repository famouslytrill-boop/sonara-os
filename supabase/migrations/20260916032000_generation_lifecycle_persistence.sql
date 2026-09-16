-- Durable, provider-neutral generation lifecycle persistence.
--
-- This control plane is intentionally separate from creator_generation_*.
-- Creator Studio keeps its product-specific workflow; these tables provide the
-- cross-product execution evidence required by the governed adapter lifecycle.
-- No provider/model/runtime is enabled by this migration.

create extension if not exists pgcrypto;

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  request_id text not null,
  idempotency_key text not null,
  state text not null default 'planned' check (state in (
    'planned','submitted','queued','running','succeeded','failed','canceled','expired'
  )),
  version bigint not null default 1 check (version >= 1),
  adapter_key text,
  modality text,
  operation text,
  input_references jsonb not null default '[]'::jsonb check (jsonb_typeof(input_references) = 'array'),
  input_digests jsonb not null default '[]'::jsonb check (jsonb_typeof(input_digests) = 'array'),
  deadline_at timestamptz,
  submitted_at timestamptz,
  queued_at timestamptz,
  started_at timestamptz,
  terminal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generation_jobs_org_id_id_key unique (organization_id, id),
  constraint generation_jobs_org_idempotency_key unique (organization_id, idempotency_key)
);

create table if not exists public.generation_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  attempt_number integer not null check (attempt_number >= 1),
  adapter_key text not null,
  provider_request_id text,
  state text not null default 'planned' check (state in (
    'planned','submitted','queued','running','succeeded','failed','canceled','expired'
  )),
  error_code text,
  error_category text,
  error_retryable boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generation_attempts_job_fk foreign key (organization_id, job_id)
    references public.generation_jobs(organization_id, id) on delete cascade,
  constraint generation_attempts_org_id_id_key unique (organization_id, id),
  constraint generation_attempts_job_number_key unique (organization_id, job_id, attempt_number)
);

create table if not exists public.generation_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  attempt_id uuid,
  storage_ref text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  media_type text not null,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  constraint generation_artifacts_job_fk foreign key (organization_id, job_id)
    references public.generation_jobs(organization_id, id) on delete cascade,
  constraint generation_artifacts_attempt_fk foreign key (organization_id, attempt_id)
    references public.generation_attempts(organization_id, id) on delete set null (attempt_id),
  constraint generation_artifacts_org_storage_key unique (organization_id, storage_ref)
);

create table if not exists public.generation_callback_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  attempt_id uuid,
  provider_key text not null,
  provider_event_id text not null,
  auth_verified boolean not null default false,
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  replay_status text not null default 'received' check (replay_status in (
    'received','applied','duplicate','rejected','failed'
  )),
  received_at timestamptz not null default now(),
  applied_at timestamptz,
  constraint generation_callback_events_job_fk foreign key (organization_id, job_id)
    references public.generation_jobs(organization_id, id) on delete cascade,
  constraint generation_callback_events_attempt_fk foreign key (organization_id, attempt_id)
    references public.generation_attempts(organization_id, id) on delete set null (attempt_id),
  constraint generation_callback_events_provider_event_key unique (organization_id, provider_key, provider_event_id)
);

create table if not exists public.generation_cost_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  attempt_id uuid,
  cost_type text not null check (cost_type in ('estimated','authorized','final')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  source text not null,
  created_at timestamptz not null default now(),
  constraint generation_cost_events_job_fk foreign key (organization_id, job_id)
    references public.generation_jobs(organization_id, id) on delete cascade,
  constraint generation_cost_events_attempt_fk foreign key (organization_id, attempt_id)
    references public.generation_attempts(organization_id, id) on delete set null (attempt_id)
);

create table if not exists public.generation_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  attempt_id uuid,
  event_type text not null,
  actor_type text not null default 'system' check (actor_type in ('system','user','provider','worker')),
  actor_ref text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  constraint generation_audit_events_job_fk foreign key (organization_id, job_id)
    references public.generation_jobs(organization_id, id) on delete cascade,
  constraint generation_audit_events_attempt_fk foreign key (organization_id, attempt_id)
    references public.generation_attempts(organization_id, id) on delete set null (attempt_id)
);

-- Tenant-first indexes. Every operational tenant query begins with organization_id.
create index if not exists generation_jobs_org_state_created_idx
  on public.generation_jobs (organization_id, state, created_at desc);
create index if not exists generation_attempts_org_job_number_idx
  on public.generation_attempts (organization_id, job_id, attempt_number desc);
create unique index if not exists generation_attempts_org_provider_request_idx
  on public.generation_attempts (organization_id, adapter_key, provider_request_id)
  where provider_request_id is not null;
create index if not exists generation_artifacts_org_job_created_idx
  on public.generation_artifacts (organization_id, job_id, created_at desc);
create index if not exists generation_callbacks_org_job_received_idx
  on public.generation_callback_events (organization_id, job_id, received_at desc);
create index if not exists generation_cost_events_org_job_created_idx
  on public.generation_cost_events (organization_id, job_id, created_at desc);
create index if not exists generation_audit_events_org_job_created_idx
  on public.generation_audit_events (organization_id, job_id, created_at desc);

-- Enforce the proven state machine and compare-and-swap version rule at the
-- database boundary. Provider code cannot bypass this merely by issuing a
-- direct service-role PATCH.
create or replace function public.sonara_guard_generation_job_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.id is distinct from old.id
     or new.request_id is distinct from old.request_id
     or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'generation job identity is immutable';
  end if;

  if old.state in ('succeeded','failed','canceled','expired') then
    raise exception 'terminal generation job is immutable';
  end if;

  if new.version <> old.version + 1 then
    raise exception 'generation job version must increment exactly once';
  end if;

  if new.state is distinct from old.state then
    if not (
      (old.state = 'planned' and new.state in ('submitted','canceled','failed','expired')) or
      (old.state = 'submitted' and new.state in ('queued','running','canceled','failed','expired')) or
      (old.state = 'queued' and new.state in ('running','canceled','failed','expired')) or
      (old.state = 'running' and new.state in ('succeeded','canceled','failed','expired'))
    ) then
      raise exception 'illegal generation transition % -> %', old.state, new.state;
    end if;
  end if;

  if new.state = 'succeeded' and not exists (
    select 1
      from public.generation_artifacts artifact
     where artifact.organization_id = old.organization_id
       and artifact.job_id = old.id
  ) then
    raise exception 'durable generation artifact required before success';
  end if;

  new.updated_at := now();
  if new.state = 'submitted' and new.submitted_at is null then new.submitted_at := now(); end if;
  if new.state = 'queued' and new.queued_at is null then new.queued_at := now(); end if;
  if new.state = 'running' and new.started_at is null then new.started_at := now(); end if;
  if new.state in ('succeeded','failed','canceled','expired') and new.terminal_at is null then new.terminal_at := now(); end if;
  return new;
end;
$$;

drop trigger if exists generation_jobs_guard_update on public.generation_jobs;
create trigger generation_jobs_guard_update
before update on public.generation_jobs
for each row execute function public.sonara_guard_generation_job_update();

alter table public.generation_jobs enable row level security;
alter table public.generation_attempts enable row level security;
alter table public.generation_artifacts enable row level security;
alter table public.generation_callback_events enable row level security;
alter table public.generation_cost_events enable row level security;
alter table public.generation_audit_events enable row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'generation_jobs',
    'generation_attempts',
    'generation_artifacts',
    'generation_callback_events',
    'generation_cost_events',
    'generation_audit_events'
  ]
  loop
    execute format('drop policy if exists "generation members read %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "generation members read %1$s" on public.%1$I for select to authenticated using (public.sonara_is_org_member(organization_id))',
      relation_name
    );

    execute format('drop policy if exists "service role manages %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "service role manages %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      relation_name
    );
  end loop;
end $$;

-- The browser/user client can inspect tenant-scoped evidence but cannot create
-- or mutate provider lifecycle records. Server code establishes tenant scope.
revoke all on public.generation_jobs from anon;
revoke all on public.generation_attempts from anon;
revoke all on public.generation_artifacts from anon;
revoke all on public.generation_callback_events from anon;
revoke all on public.generation_cost_events from anon;
revoke all on public.generation_audit_events from anon;

grant select on public.generation_jobs to authenticated;
grant select on public.generation_attempts to authenticated;
grant select on public.generation_artifacts to authenticated;
grant select on public.generation_callback_events to authenticated;
grant select on public.generation_cost_events to authenticated;
grant select on public.generation_audit_events to authenticated;

revoke insert, update, delete on public.generation_jobs from authenticated;
revoke insert, update, delete on public.generation_attempts from authenticated;
revoke insert, update, delete on public.generation_artifacts from authenticated;
revoke insert, update, delete on public.generation_callback_events from authenticated;
revoke insert, update, delete on public.generation_cost_events from authenticated;
revoke insert, update, delete on public.generation_audit_events from authenticated;

-- Audit evidence is append-only for the application service role. Cascading
-- organization deletion remains a database referential-integrity operation.
revoke update, delete on public.generation_audit_events from service_role;

comment on table public.generation_jobs is 'Tenant-scoped provider-neutral generation lifecycle jobs; references/digests only, never raw prompts or credentials.';
comment on table public.generation_attempts is 'One bounded provider/runtime attempt for a generation job, including retry and sanitized failure evidence.';
comment on table public.generation_artifacts is 'Durable SONARA-controlled generation artifacts with digest, media type, and provenance.';
comment on table public.generation_callback_events is 'Authenticated provider callback dedupe/replay evidence; stores payload digests, not raw callback bodies.';
comment on table public.generation_cost_events is 'Estimated, authorized, and final generation cost evidence in minor currency units.';
comment on table public.generation_audit_events is 'Append-only generation lifecycle/approval/security evidence without raw prompts, tokens, credentials, or provider payloads.';

notify pgrst, 'reload schema';
