-- Who a campaign actually reached, one row per recipient.
--
-- `lib/growth-studio-dispatch.cjs` has been complete and honest about this gap
-- since 15 September 2026, in its own header:
--
--   "Reaching only the remainder needs a per-recipient record of who was
--   accepted, which is also what the >1,000 cross-invocation queue needs and is
--   why both are still unbuilt."
--
-- This is that record. Without it the product had a specific, silent failure:
-- a campaign that reached 900 of 1,000 told the owner which 100 were not
-- attempted, and the only way to reach those 100 was to send the campaign
-- again -- which mails the first 900 a second time. The charge is keyed on
-- `campaign:<id>`, so the duplicate send is refused as a duplicate charge and
-- the owner is not billed, which removes the one signal that would have told
-- them it happened.
--
-- ## Append-only, per attempt, and never updated in place
--
-- Same reasoning as usage_credit_ledger, for a different reason. There is no
-- `status` to flip from failed to accepted: a retry inserts a second row. Two
-- serverless invocations updating one row would lose a write, and the symptom
-- would be a recipient who reads as unreached and gets a second email.
--
-- So the history is the rows, and "was this person reached" is a query for an
-- accepted row rather than a column somebody maintains.
--
-- ## The partial unique index is what makes the remainder computable
--
-- `growth_campaign_sends_accepted_once` covers accepted rows only, keyed on
-- (organization_id, campaign_id, lower(email)). Three properties follow:
--
--   * One accepted row per person per campaign, so `sent` cannot be
--     double-counted by a retry.
--   * The remainder is a set difference the database can answer: the recipients
--     with no accepted row.
--   * Failed and not_attempted rows are deliberately NOT covered, because a
--     recipient can legitimately fail twice and each attempt is evidence.
--
-- It is on `lower(email)` because addresses arrive with whatever case somebody
-- typed. Keying on the raw string would let Ann@example.com and
-- ann@example.com both hold accepted rows, and the second one is a duplicate
-- email to a real person.
--
-- ## What this must never be read as
--
-- **No rows for a campaign does not mean nobody was reached.** It means either
-- nothing was sent or the record write failed, and those are opposite facts. The
-- reader in lib/growth-studio-send-records.cjs carries an explicit outcome for
-- exactly this reason, and the dispatcher reports a failed write loudly rather
-- than letting a missing row become "safe to resend".
--
-- ## The grant is not optional
--
-- Dated after 20260718064853_data_api_privilege_hardening, which revoked default
-- privileges so new public objects are opt-in. A table created here without a
-- declared surface lands unreadable by the server -- the fault that took five
-- tables down in deployment #131.
--
-- anon and authenticated get nothing. A campaign's recipient list is a list of a
-- customer's customers, and RLS is on with no policy, so the table is closed to
-- every non-bypass role.
--
-- No update, no delete. A row here says an email is in somebody's inbox. That is
-- not a fact that can be edited afterwards.
--
-- No customer data is modified by this migration.

create table if not exists public.growth_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.growth_campaigns(id) on delete cascade,

  -- The lead this address came from, when there was one. Nullable rather than
  -- required: the address is the thing that was mailed, and a lead row can be
  -- deleted afterwards without making the send un-happen.
  lead_id uuid,

  -- As supplied. Matching is done on lower(email) by the index below; storing
  -- the original means an owner sees the address they actually have on file.
  email text not null,

  -- accepted | failed | not_attempted. These are the three states
  -- lib/growth-studio-dispatch.cjs already distinguishes, and the distinction
  -- is the product: a failed send was attempted and refused, a not_attempted
  -- one was never tried, and only an accepted one is in somebody's inbox.
  status text not null,

  -- The provider's id for an accepted message, so a delivery question can be
  -- traced to one request. Null for the other two states, and null for an
  -- accepted message sent through the individual endpoint, which does not
  -- return an id this path reads.
  provider_message_id text,

  -- The HTTP status for a failure, and the named reason for anything the
  -- dispatcher decided itself (no_unsubscribe_link, fallback_budget_spent).
  -- Both kept, because a 422 bad address and a 429 rate limit need different
  -- actions from the owner.
  provider_status integer,
  reason text,

  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint growth_campaign_sends_status_known
    check (status in ('accepted', 'failed', 'not_attempted')),

  -- An accepted row with no address is a claim that somebody was reached
  -- without saying who, which is the reporting defect this table exists to end.
  constraint growth_campaign_sends_email_present
    check (length(btrim(email)) > 0)
);

-- One accepted row per person per campaign. Partial and case-folded; see the
-- header for why each half matters.
create unique index if not exists growth_campaign_sends_accepted_once
  on public.growth_campaign_sends (organization_id, campaign_id, lower(email))
  where status = 'accepted';

-- The remainder query: one campaign's accepted addresses, within one
-- organization. The organization column leads because it is the tenant boundary
-- and every read is filtered on it.
create index if not exists growth_campaign_sends_org_campaign_status
  on public.growth_campaign_sends (organization_id, campaign_id, status);

alter table public.growth_campaign_sends enable row level security;

grant select, insert on table public.growth_campaign_sends to service_role;

comment on table public.growth_campaign_sends is
  'Append-only per-recipient record of what a campaign send did, organization-scoped. One accepted row per person per campaign, enforced by growth_campaign_sends_accepted_once on lower(email), which is what makes "send to the remainder" a set difference rather than a guess. No rows does NOT mean nobody was reached -- see lib/growth-studio-send-records.cjs, which carries an explicit read outcome.';

do $$
begin
  if to_regclass('public.growth_campaign_sends') is null then
    raise exception 'public.growth_campaign_sends was not created';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.growth_campaign_sends'::regclass and relrowsecurity
  ) then
    raise exception 'public.growth_campaign_sends exists without row level security enabled';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.growth_campaign_sends', 'SELECT') then
    raise exception 'service_role cannot read public.growth_campaign_sends; the remainder could never be computed';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.growth_campaign_sends', 'INSERT') then
    raise exception 'service_role cannot append to public.growth_campaign_sends; no send could be recorded';
  end if;

  -- anon and authenticated must hold nothing. This is a list of a customer's
  -- customers; a browser-readable copy would be a tenant leak by default.
  if pg_catalog.has_table_privilege('anon', 'public.growth_campaign_sends', 'SELECT')
    or pg_catalog.has_table_privilege('authenticated', 'public.growth_campaign_sends', 'SELECT') then
    raise exception 'public.growth_campaign_sends is readable by a browser role; a campaign recipient list must not be';
  end if;

  -- The index is the guarantee, not an optimisation: without it a retry inserts
  -- a second accepted row and the remainder silently shrinks.
  if not exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public' and indexname = 'growth_campaign_sends_accepted_once'
  ) then
    raise exception 'growth_campaign_sends_accepted_once is missing; a retried send would record a duplicate acceptance';
  end if;
end
$$;
