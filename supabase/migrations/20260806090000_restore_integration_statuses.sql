-- Bring integration_statuses back out of `retired`.
--
-- It was classified "superseded by integration_jobs" and moved out of public
-- with the other twelve. That classification was wrong. integration_jobs is a
-- work queue -- provider, job type, status of a run. integration_statuses is a
-- policy register: which external integrations are blocked, quarantined,
-- developer-only or awaiting setup, and why. They are not the same shape and
-- one does not replace the other.
--
-- The mistake did not cost anything, and the reason is the only part of this
-- worth keeping. 20260806000000 counts rows before dropping and refuses any
-- table that has some. Twelve of the thirteen were empty and went. This one
-- held 23 rows and was refused, so the records survived a retirement decision
-- that should never have included them.
--
-- Those 23 rows are refusals. They record that omniroute_unverified is blocked
-- on unverified provenance, that asi_agent_skills is quarantined pending
-- per-skill review, that openhands is developer-only. Losing them would have
-- lost the reasons, and the next person asking "can we use this?" would have
-- had to decide again from nothing.
--
-- Two paths, because production and a fresh rebuild are in different states and
-- both have to end up the same.
--
-- In production the table is in `retired` holding 23 rows, because the drop
-- refused it. Moving it back is enough.
--
-- On a fresh database it is gone entirely. The replay runs create, then retire
-- (moving an empty table), then drop -- which sees zero rows and removes it.
-- Moving nothing back would leave a rebuilt database without a table production
-- has, and that divergence is worse than the original mistake: every later
-- migration and every gate would be reasoning about a schema that only exists in
-- one place. So when there is nothing to move, this recreates it.
--
-- The create matches 20260714150000 exactly. Rewriting that migration to skip
-- the drop would have been tidier and is not allowed -- it has already been
-- applied.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'integration_statuses'
  ) then
    raise notice 'restore: public.integration_statuses is already present, nothing to do';
    return;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'retired' and table_name = 'integration_statuses'
  ) then
    alter table retired.integration_statuses set schema public;
    raise notice 'restore: integration_statuses moved back from retired, with its rows';
  else
    -- Dropped, which is what happens on a fresh replay where it was empty.
    -- Recreated so a rebuilt database matches production.
    create table public.integration_statuses (
      id uuid primary key default gen_random_uuid(),
      integration_key text not null unique,
      status text not null default 'setup_required',
      detail text,
      metadata jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    alter table public.integration_statuses enable row level security;
    raise notice 'restore: integration_statuses recreated empty (it had been dropped)';
  end if;
  comment on table public.integration_statuses is
    'Which external integrations are blocked, quarantined, developer-only or awaiting setup, and why. Read at /research-lab/subsystems. Retired in error on 2026-08-05 as "superseded by integration_jobs"; it is a policy register, not a work queue.';
end
$$;
