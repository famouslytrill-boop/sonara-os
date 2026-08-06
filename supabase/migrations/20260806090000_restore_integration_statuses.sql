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
-- On a database built by replaying every migration from nothing -- a local
-- `supabase db reset`, or a rebuild from scratch -- it is gone entirely. The
-- replay runs create, then retire (moving an empty table), then drop, which
-- sees zero rows and removes it. Moving nothing back would leave that database
-- without a table production has, so when there is nothing to move this
-- recreates it, matching 20260714150000 exactly.
--
-- Rewriting 20260714150000 to skip the drop would have been tidier and is not
-- allowed: it has already been applied.
--
-- One correction worth leaving here, because the first version of this comment
-- got it wrong and the wrong version reads perfectly plausibly. It claimed the
-- Supabase preview branch would apply a different schema from production
-- without this. It would not: preview branches are cloned from production, not
-- replayed from zero. Checked rather than reasoned about -- the preview branch
-- for this pull request came up with all 23 rows present, which only happens if
-- the data came across with the schema. The recreate below is still needed, for
-- the local-reset case above, and the justification originally given for it was
-- false.

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
