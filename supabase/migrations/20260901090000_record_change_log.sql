-- Who changed a record, and when.
--
-- Until today nothing in the Business Builder owner pages could change a saved
-- record. Twenty-seven pages could create and read; none could update. So there
-- was nothing to record, and the absence of a change log was not a gap.
--
-- Two changes on 1 September 2026 ended that. `lib/sonara-record-status.cjs`
-- lets an owner move a record through its status, and `lib/sonara-record-edit.cjs`
-- lets them correct any field the create form declares -- on twenty-five pages,
-- through `requireBusinessManager`, which is owners **and managers**. A business
-- with two people can now have a price changed and no way to find out by whom.
--
-- This table is that record. It exists because of those two changes rather than
-- in anticipation of them, which is why it arrives now and not with the schema.
--
-- ## What it deliberately does not hold
--
-- **No values. Not the old one, not the new one.** Only the names of the fields
-- that changed.
--
-- That is a deliberate trade and it costs something real: "the price was 4500
-- and is now 450" is a better answer than "somebody changed the price". It is
-- refused for two reasons.
--
-- The first is that these records hold people's contact details. A log carrying
-- before-and-after values would be a **second copy** of every customer's phone
-- number and email, in a table with different retention and a different read
-- path. `/account/data` promises what is kept and for how long, and erasure here
-- is a request a person handles rather than an automated wipe -- so a second
-- copy is a second place that person must remember to clear, and the one they
-- will not think of.
--
-- The second is that the question a business actually asks is "who changed this
-- and when". What it was before is answered by asking them, and the log is what
-- tells you who to ask.
--
-- **No prose.** `changed_fields` is an array of column names, not a sentence.
-- A summary written at insert time is a copy of the renderer's wording frozen
-- into the database, and it goes stale the first time anybody rewrites the
-- sentence.

create table if not exists public.record_change_log (
  id uuid primary key default gen_random_uuid(),

  -- The tenant boundary. Every read filters on this, and the service role key
  -- bypasses row level security, so it is the only thing separating one
  -- business's history from another's.
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Which table and which row. Text rather than a foreign key: this one table
  -- covers twenty-seven of them, and twenty-seven nullable references would be
  -- a wider row and a worse index for the same fact.
  record_table text not null,
  record_id uuid not null,

  -- Who did it. Nullable, and nullable on purpose: a change made through a path
  -- that cannot identify the person must still be recorded. A log that drops
  -- the rows it cannot attribute is a log with holes that reads as complete.
  changed_by uuid,

  -- What kind of change. Two today; the check constraint is what makes a third
  -- arrive as a migration rather than as an unrecognised string.
  change_kind text not null check (change_kind in ('status', 'fields')),

  -- The columns that changed. Never empty -- a row saying nothing changed is
  -- not a change, and the write path does not create one.
  changed_fields text[] not null check (array_length(changed_fields, 1) >= 1),

  created_at timestamptz not null default now()
);

-- The read: this record's history, newest first.
create index if not exists record_change_log_record_idx
  on public.record_change_log (organization_id, record_table, record_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security.
-- ---------------------------------------------------------------------------
--
-- Enabled with no policies, matching call_sessions, push_subscriptions and
-- business_payment_accounts. Every route reading this goes through the service
-- role and carries its own organization_id filter.
--
-- There must never be a public read. A list across tenants is a map of which
-- businesses are active, which records they touch and when their people work.
alter table public.record_change_log enable row level security;

comment on table public.record_change_log is
  'Who changed which record and when, for the Business Builder owner record pages. Holds the names of the fields that changed and no values: these records carry contact details, and a second copy in a table with different retention is a second place erasure must reach.';
