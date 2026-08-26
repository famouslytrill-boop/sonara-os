-- Defining a good customer, capturing one, scoring it, and giving it to somebody.
--
-- growth_leads has existed since migration 012 with name, email, phone, source
-- and a status vocabulary, and lib/sonara-formula-library.cjs has carried
--
--   lead_score = fit_score + urgency_score + engagement_score - risk_score
--
-- for just as long -- over four numbers nothing ever computed. What was missing
-- was not the lead table. It was everything that turns a stranger into a row in
-- it: somewhere to write down what a good customer looks like, a front door a
-- stranger can walk through, and somewhere to put the answer and the owner.
--
-- ## Four tables, and why not fewer
--
-- The profile and the widget are separate because scoring has to work for a lead
-- that never touched the widget -- one typed in, imported from a spreadsheet, or
-- arriving from a campaign. A profile that only existed as widget settings would
-- make "what is a good customer" a property of one acquisition channel.
--
-- The transcript is jsonb on the conversation rather than a fifth table. It is
-- read as a whole and never queried by message, which is the same reasoning that
-- put opening_hours on public_booking_pages instead of fourteen columns. A
-- widget conversation is a dozen messages; the check constraint keeps it that.
--
-- Routing rules are a table rather than jsonb because they are ordered, edited
-- one at a time, and referenced by id in the decision recorded on the lead. A
-- rule id that is an array index changes meaning when somebody deletes the rule
-- above it, and every past decision then points at the wrong rule.
--
-- ## Nothing here publishes anybody
--
-- Every `enabled` defaults to false and every `slug` defaults to null, the same
-- shape as shared_links, public_handle and public_booking_pages. A column that
-- defaulted to a generated slug would put every organization in the database on
-- a public URL the moment this deploys.

-- ---------------------------------------------------------------------------
-- What a good customer looks like.
-- ---------------------------------------------------------------------------
--
-- Read by lib/sonara-lead-scoring.cjs, and by lib/sonara-lead-capture-script.cjs
-- to work out what to ask. Both read the same row, which is the point: the
-- questions cannot drift from the criteria if there is only one list.
--
-- Every criterion is nullable, and a null one is not scored. A profile with
-- nothing filled in scores fit as unknown rather than as a perfect match -- the
-- application enforces that, and it matters more than it looks: a vacuous match
-- would mark every stranger who opened the widget as an ideal customer.
create table if not exists public.lead_icp_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text,
  -- Free text, because an industry list this product imposed would be wrong for
  -- somebody within a week. Matched case-insensitively against what a lead says.
  industries text[] not null default '{}',
  regions text[] not null default '{}',
  team_size_min integer check (team_size_min is null or team_size_min >= 0),
  team_size_max integer check (team_size_max is null or team_size_max >= 0),
  -- Integer cents. No float goes near a figure somebody is quoted against.
  budget_min_cents bigint check (budget_min_cents is null or budget_min_cents >= 0),
  budget_max_cents bigint check (budget_max_cents is null or budget_max_cents >= 0),
  -- The horizon a good customer is working to, in days. Urgency is scored
  -- against this, so a profile without it has no urgency reading at all rather
  -- than a default one.
  timeline_days integer check (timeline_days is null or timeline_days > 0),
  -- Terms that should stop somebody picking a lead up. Only what is declared
  -- here counts, so a business that declares none gets a true zero risk rather
  -- than an unevaluated one.
  disqualifiers text[] not null default '{}',
  -- How much each component is worth in the composite. Defaults match
  -- DEFAULT_WEIGHTS in lib/sonara-lead-scoring.cjs; a weight of zero drops the
  -- component out of the score rather than counting it as nothing.
  fit_weight integer not null default 40 check (fit_weight between 0 and 100),
  urgency_weight integer not null default 25 check (urgency_weight between 0 and 100),
  engagement_weight integer not null default 20 check (engagement_weight between 0 and 100),
  risk_weight integer not null default 15 check (risk_weight between 0 and 100),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- One profile per organization. A second would make "the profile" ambiguous in
-- the scorer, the widget and the pipeline at once.
create unique index if not exists lead_icp_profiles_organization_key
  on public.lead_icp_profiles (organization_id);

-- A range whose floor is above its ceiling matches nothing and reads as a
-- working filter. Refused at the table, because the form is not the only thing
-- that can write this row.
alter table public.lead_icp_profiles
  drop constraint if exists lead_icp_profiles_team_size_order;
alter table public.lead_icp_profiles
  add constraint lead_icp_profiles_team_size_order
  check (team_size_min is null or team_size_max is null or team_size_min <= team_size_max);

alter table public.lead_icp_profiles
  drop constraint if exists lead_icp_profiles_budget_order;
alter table public.lead_icp_profiles
  add constraint lead_icp_profiles_budget_order
  check (budget_min_cents is null or budget_max_cents is null or budget_min_cents <= budget_max_cents);

-- ---------------------------------------------------------------------------
-- The front door.
-- ---------------------------------------------------------------------------
--
-- /chat/:slug, resolved the same way /book/:slug is: the slug finds exactly one
-- enabled row, that row names the organization, and everything afterwards is
-- filtered on that organization id. The public page never chooses an
-- organization -- it is told one by the row its owner published.
create table if not exists public.lead_capture_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text,
  enabled boolean not null default false,
  headline text,
  -- The first thing the widget says. Not generated: a greeting this product
  -- wrote would be this product talking to somebody else's customer.
  greeting text,
  -- Shown when the script runs out. The business's own words for what happens
  -- next, because "we will be in touch" is a promise only they can make.
  closing text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists lead_capture_pages_organization_key
  on public.lead_capture_pages (organization_id);

alter table public.lead_capture_pages
  drop constraint if exists lead_capture_pages_slug_shape;
alter table public.lead_capture_pages
  add constraint lead_capture_pages_slug_shape
  check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$');

create unique index if not exists lead_capture_pages_slug_key
  on public.lead_capture_pages (slug) where slug is not null;

-- ---------------------------------------------------------------------------
-- One visitor's conversation.
-- ---------------------------------------------------------------------------
--
-- Written before anybody has given a name, and kept even if they never do. A
-- transcript with no contact details on it is not a failure -- it is the
-- business finding out what people ask before they leave, which is the one thing
-- an abandoned form has never been able to tell anybody.
create table if not exists public.lead_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capture_page_id uuid references public.lead_capture_pages(id) on delete set null,
  -- The visitor's handle on this conversation, and the only credential. Long
  -- enough that it cannot be guessed, because holding it is what lets somebody
  -- add to a conversation already in progress.
  token text not null,
  -- Answers keyed by criterion, plus `contact`. jsonb because the shape follows
  -- whatever the profile declares, and a column per criterion would need a
  -- migration every time a business changed its mind.
  answers jsonb not null default '{}'::jsonb,
  -- [{role, text, questionKey, at}]. Read as a whole, never queried by message.
  transcript jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','captured','abandoned')),
  -- Set when the conversation produced a lead. Null while it has not, which is
  -- most of them, and is not a fault.
  lead_id uuid references public.growth_leads(id) on delete set null,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists lead_conversations_token_key
  on public.lead_conversations (token);

create index if not exists lead_conversations_org_started_idx
  on public.lead_conversations (organization_id, started_at desc);

-- A widget conversation is a dozen messages. This is a cap on what one stranger
-- can make the business store, not a guess at how much anybody will say.
alter table public.lead_conversations
  drop constraint if exists lead_conversations_transcript_bounded;
alter table public.lead_conversations
  add constraint lead_conversations_transcript_bounded
  check (jsonb_typeof(transcript) = 'array' and jsonb_array_length(transcript) <= 60);

-- ---------------------------------------------------------------------------
-- Who gets it.
-- ---------------------------------------------------------------------------
--
-- Ordered; the first matching rule wins. `position` rather than created_at
-- because the order is the business's decision and reordering must not require
-- deleting and recreating a rule that past decisions point at.
create table if not exists public.lead_routing_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  enabled boolean not null default true,
  -- Every condition below is optional, and a rule with none is a catch-all.
  -- min_score and max_score match only a lead that has a score: an unscored lead
  -- is not a zero-score lead, and null >= 0 is true in the language this runs
  -- in. lib/sonara-lead-routing.cjs enforces that; it is written here because
  -- the constraint cannot.
  min_score integer check (min_score is null or min_score between 0 and 100),
  max_score integer check (max_score is null or max_score between 0 and 100),
  match_unscored boolean not null default false,
  bands text[] not null default '{}',
  industries text[] not null default '{}',
  regions text[] not null default '{}',
  sources text[] not null default '{}',
  -- The person this rule names, or null for the round robin. A rule naming
  -- somebody who has since left does not stop the lead moving -- see the module.
  assign_to uuid references public.business_employee_profiles(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists lead_routing_rules_org_position_idx
  on public.lead_routing_rules (organization_id, position, created_at);

alter table public.lead_routing_rules
  drop constraint if exists lead_routing_rules_score_order;
alter table public.lead_routing_rules
  add constraint lead_routing_rules_score_order
  check (min_score is null or max_score is null or min_score <= max_score);

-- ---------------------------------------------------------------------------
-- What the lead now carries.
-- ---------------------------------------------------------------------------
--
-- All nullable, all ON DELETE SET NULL where they point somewhere. A lead that
-- was never scored is not a lead that scored zero, and a business that deletes
-- an employee has not un-assigned the work that person was given -- losing the
-- record of who was on it would destroy the evidence of what happened to it.
alter table public.growth_leads
  add column if not exists score integer check (score is null or score between 0 and 100);

alter table public.growth_leads
  add column if not exists score_band text
  check (score_band is null or score_band in ('hot','warm','nurture','cold'));

-- The working. A score somebody cannot take apart is a score they cannot argue
-- with, and the person whose commission depends on the order of this list is
-- entitled to argue with it. Holds the four components, the confidence, and the
-- per-criterion reasons.
alter table public.growth_leads
  add column if not exists score_breakdown jsonb;

-- True when the score is standing on less than half the profile. A separate
-- column rather than something derived at render time, so a list can be sorted
-- and filtered on it without every row having to be unpacked.
alter table public.growth_leads
  add column if not exists score_provisional boolean;

alter table public.growth_leads
  add column if not exists assigned_to uuid references public.business_employee_profiles(id) on delete set null;

alter table public.growth_leads
  add column if not exists assigned_at timestamptz;

-- Why this person, in the routing module's own words: which rule matched, or
-- that none did, or that the rule named somebody who has left. An assignment
-- with no explanation is the thing that makes a routing table untrustworthy.
alter table public.growth_leads
  add column if not exists routing_note jsonb;

alter table public.growth_leads
  add column if not exists conversation_id uuid references public.lead_conversations(id) on delete set null;

-- The pipeline board reads one organization's leads by stage, newest first, and
-- the routing round robin counts open leads per person. Both are on every page
-- load of the pipeline.
create index if not exists growth_leads_org_status_created_idx
  on public.growth_leads (organization_id, status, created_at desc);

create index if not exists growth_leads_org_assigned_idx
  on public.growth_leads (organization_id, assigned_to);

-- ---------------------------------------------------------------------------
-- Row level security.
-- ---------------------------------------------------------------------------
--
-- Enabled with no SELECT policy for anonymous or for members, matching
-- public_booking_pages and for the same reason. Every route that reads these
-- tables goes through the service role, which bypasses row level security, and
-- every one carries its own filter: the public widget by slug and then by the
-- organization that row names, the owner pages by organization_id. That filter
-- is the tenant boundary, as it is everywhere else in this application.
--
-- An anon read policy on lead_conversations would be the actively dangerous one.
-- It holds what strangers typed into somebody's website, including their email
-- address and phone number, and a policy-less service-role read is the only
-- thing standing between that and anyone who can reach PostgREST.
alter table public.lead_icp_profiles enable row level security;
alter table public.lead_capture_pages enable row level security;
alter table public.lead_conversations enable row level security;
alter table public.lead_routing_rules enable row level security;

-- scripts/generate-member-read-policies.cjs writes policies for the measured
-- list of tables a GET route reads with a user JWT. None of these four is on
-- that list, because nothing reads them with a user token. If a read is ever
-- switched to one, it needs a policy added there first or it will return no
-- rows -- which looks exactly like a business that has no leads.
