-- When a customer's agents run.
--
-- Until now nothing proposed work on a schedule: the runner was called per
-- request by the page that wanted something done, and docs/SPRINT_LOG.md said
-- so in as many words. The owner has asked for agents to run on a schedule, and
-- for the schedule to belong to the customer rather than to the platform.
--
-- The safety property that must survive this, and does: a scheduled run goes
-- through lib/sonara-agent-runner.cjs like every other run, so
-- decideExecution still refuses any of the seven gated categories without an
-- approval. A schedule can therefore start work; it cannot approve it. A gated
-- action reached on a schedule lands in agent_pending_actions and waits for the
-- owner exactly as it would if a person had asked for it.
--
-- Per organization, not per platform. Two businesses want their week reviewed
-- on different days, and a single global cron that ran everybody's work at
-- 03:00 UTC would be the platform's schedule wearing the customer's name.

create table if not exists public.agent_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action_type text not null,
  -- What to run it with, the same shape agent_pending_actions carries.
  payload jsonb not null default '{}'::jsonb,
  -- The customer's own words for why this exists, shown back to them.
  label text,
  cadence text not null default 'weekly' check (cadence in ('daily', 'weekly', 'monthly')),
  -- Local wall-clock intent. Stored as the customer set it, with the zone
  -- beside it, because "every Monday at 9" means a different instant in
  -- Auckland and in Lisbon and storing only UTC loses which one they meant.
  hour_of_day integer not null default 9 check (hour_of_day between 0 and 23),
  day_of_week integer check (day_of_week is null or day_of_week between 0 and 6),
  day_of_month integer check (day_of_month is null or day_of_month between 1 and 28),
  time_zone text not null default 'UTC',
  enabled boolean not null default true,
  -- Set after a run so the next tick can tell "already ran today" from "due".
  last_run_at timestamptz,
  last_run_result text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_schedules_due_idx
  on public.agent_schedules (enabled, last_run_at);
create index if not exists agent_schedules_org_idx
  on public.agent_schedules (organization_id, created_at desc);

alter table public.agent_schedules enable row level security;

-- Service role only. A customer edits their schedule through the Express
-- permission checks; a policy letting `authenticated` write this table directly
-- would let one customer schedule work in another's organisation.
drop policy if exists "service role manages agent_schedules" on public.agent_schedules;
create policy "service role manages agent_schedules" on public.agent_schedules
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agent_schedules' and column_name = 'time_zone') then
    raise exception 'agent_schedules.time_zone is missing, so a schedule could not mean a local time';
  end if;
end $$;
