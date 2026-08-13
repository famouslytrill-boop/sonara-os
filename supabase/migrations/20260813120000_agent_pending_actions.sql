-- The approval queue.
--
-- lib/sonara-agent-authority.cjs stops a sensitive action and says why.
-- lib/sonara-agent-runner.cjs records the refusal. Nothing re-ran it
-- afterwards, so an owner who wanted to allow something had no way to: the
-- runner is called per request by the page wanting work done, and an approval
-- had nowhere to live and nothing to consume it. /owner/agent-activity said so
-- rather than showing a button that would have written "approved" and changed
-- nothing.
--
-- agent_action_logs is the record of what happened. It cannot be the queue: it
-- deliberately stores no payload -- see lib/sonara-agent-action-log.cjs on why
-- an audit trail must not become a second copy of the data -- so a refused
-- refund in it says a refund was proposed and not which one, for how much.
-- Re-running needs the action itself.
--
-- The nineteen entity_* tables from migration 008 have the right shape and the
-- wrong tenancy: they key on entity_id, and `entities` has no organization_id,
-- so an organization's pending action would need either an invented entity per
-- organization or a null NOT NULL foreign key.
--
-- So: one organization-scoped table holding the action, its inputs, and the
-- owner's decision.

create table if not exists public.agent_pending_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_key text not null default 'unassigned',
  action_type text not null,
  -- What to re-run it with. The whole reason this table exists rather than the
  -- action log being reused.
  payload jsonb not null default '{}'::jsonb,
  -- A short line the owner reads on the approval screen: which invoice, which
  -- post, which customer. Written by whoever proposes, because only they know.
  subject text,
  -- Copied from classifyAction at proposal time so the queue can be listed
  -- without re-classifying. It is re-derived from action_type on every
  -- decision, so this copy can never be what lets something run.
  category text not null,
  reason text,
  -- `running` is the claim. Approving moves the row out of `waiting` before the
  -- action is re-run, so two clicks on one approve button cannot run it twice --
  -- the second finds nothing in `waiting` to take. It is a real state rather
  -- than a lock because a run that dies part way leaves the row in it, and the
  -- owner needs to see "this started and did not finish" rather than a row that
  -- has silently gone back to waiting or claims to have run.
  state text not null default 'waiting'
    check (state in ('waiting', 'running', 'declined', 'ran', 'unimplemented', 'failed', 'refused')),
  -- Null when an agent proposed it, a user id when a person did. decideExecution
  -- in lib/sonara-agent-authority.cjs reads this: it is what distinguishes an
  -- agent approving its own proposal from a person approving an agent's.
  proposed_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  -- What happened when it was re-run, so the page can say "you approved this
  -- and nothing implements it yet" rather than implying it was done.
  run_result text,
  run_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_pending_actions_org_state_idx
  on public.agent_pending_actions (organization_id, state, created_at desc);

alter table public.agent_pending_actions enable row level security;

-- Service role only, like every other table the Express layer owns. The browser
-- reaches this through the permission checks in routes/, never directly: a
-- policy letting `authenticated` update this table would let a customer set
-- state themselves, and setting state is the approval.
drop policy if exists "service role manages agent_pending_actions" on public.agent_pending_actions;
create policy "service role manages agent_pending_actions" on public.agent_pending_actions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'agent_pending_actions') then
    raise exception 'agent_pending_actions was not created';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agent_pending_actions' and column_name = 'payload') then
    raise exception 'agent_pending_actions.payload is missing, so nothing could be re-run';
  end if;
end $$;
