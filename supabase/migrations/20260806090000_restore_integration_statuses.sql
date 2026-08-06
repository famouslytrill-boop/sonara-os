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
-- Safe to replay: it moves the table only if it is in `retired` and nothing of
-- that name is already back in public.

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'retired' and table_name = 'integration_statuses'
  ) then
    raise notice 'restore: retired.integration_statuses is not present, nothing to move';
    return;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'integration_statuses'
  ) then
    raise warning 'restore: public.integration_statuses already exists; leaving retired.integration_statuses alone rather than colliding';
    return;
  end if;

  alter table retired.integration_statuses set schema public;
  comment on table public.integration_statuses is
    'Which external integrations are blocked, quarantined, developer-only or awaiting setup, and why. Read at /research-lab/subsystems. Retired in error on 2026-08-05 as "superseded by integration_jobs"; it is a policy register, not a work queue.';
  raise notice 'restore: integration_statuses moved back to public';
end
$$;
