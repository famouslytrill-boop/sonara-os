-- The ledger that lets a metered capability be charged for.
--
-- `lib/sonara-paid-capabilities.cjs` has priced six things that cost real money
-- per use -- GPU seconds, viewer gigabytes, build minutes, CPU minutes, carrier
-- messages and minutes, payment terminals -- each against a dated cost floor,
-- and the release chain fails if a price drops below its floor. It is a complete
-- price list that charges nobody: required by exactly two files, its own release
-- check and its own test.
--
-- This is the missing half, and it is the keystone for the three capability gaps
-- against competitors. Inbound carrier calls, carrier SMS and outbound email
-- sending are the same shape -- a metered outbound channel with a per-use vendor
-- bill. Added without a meter, each is a cost centre on a product whose whole
-- advantage is zero marginal cost, and the free tier pays for strangers' phone
-- calls. Added on top of this, each is a margin line.
--
-- ## Append-only, and that is a serverless decision rather than a preference
--
-- The balance is the sum of the rows. There is deliberately no `balance` column.
--
-- Two serverless functions reading a balance, subtracting, and writing it back
-- will lose one of the two writes under any concurrency at all -- and the
-- symptom is free usage, not an error, so nothing reports it. Rows that are only
-- ever inserted cannot race. The cost is that a balance is a `sum()` rather than
-- a lookup, which for a per-organization ledger is a trade worth making.
--
-- ## The unique index is the thing that actually prevents a double charge
--
-- lib/sonara-usage-meter.cjs refuses to build a draw without an idempotency key,
-- but that is a JavaScript guard on one path. A retried request, a duplicated
-- queue message or a second function invocation for the same job would each
-- arrive with the same key and insert a second row, and the customer would be
-- charged twice for one video with no way to see it happening.
--
-- `usage_credit_ledger_draw_idempotency` makes the second insert fail. It is
-- partial, covering draws only: grants, refunds and owner adjustments are
-- legitimately repeatable and must not be collapsed by a shared key.
--
-- ## The grant is not optional
--
-- This migration is dated after 20260718064853_data_api_privilege_hardening,
-- which revoked default privileges so new public objects are opt-in. A table
-- created here without a declared surface lands unreadable by the server, which
-- is the fault that took five tables down in deployment #131.
-- tests/a-new-table-declares-its-data-api-surface.test.js enforces that offline.
--
-- No customer data is modified by this migration.

create table if not exists public.usage_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid,

  -- grant | draw | refund | adjustment. The direction of each is decided in
  -- lib/sonara-usage-meter.cjs ENTRY_KINDS and is deliberately not stored: a
  -- stored sign is a sign somebody can write wrongly, and a grant that debits
  -- would be a silent accounting error.
  entry_kind text not null,

  -- Which priced capability this concerns, and the unit it is metered in. Null
  -- for a grant, which is money in rather than usage.
  capability text,
  unit text,
  units numeric,

  -- Always non-negative. The sign comes from entry_kind, and the check is here
  -- as well as in the reader because a negative grant would invert a customer's
  -- balance and read as legitimate.
  amount_minor numeric not null check (amount_minor >= 0),

  -- What it cost us and what was made on it, recorded per draw so margin can be
  -- reconciled against the dated cost floors rather than recomputed from a
  -- price list that may since have moved.
  cost_minor numeric,
  margin_minor numeric,

  -- Required on a draw by the partial unique index below.
  idempotency_key text,

  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint usage_credit_ledger_entry_kind_known
    check (entry_kind in ('grant', 'draw', 'refund', 'adjustment')),

  -- A draw without a capability is usage of nothing, which is not a thing that
  -- can be priced, and a draw without an idempotency key is a retry waiting to
  -- charge twice.
  constraint usage_credit_ledger_draw_is_complete
    check (
      entry_kind <> 'draw'
      or (capability is not null and unit is not null and units is not null and idempotency_key is not null)
    )
);

-- One draw per key per organization. Partial, because only draws are unique:
-- two grants of the same amount are two real grants.
create unique index if not exists usage_credit_ledger_draw_idempotency
  on public.usage_credit_ledger (organization_id, idempotency_key)
  where entry_kind = 'draw';

-- Balance is a sum over one organization's rows, so that is the index it needs.
create index if not exists usage_credit_ledger_org_created
  on public.usage_credit_ledger (organization_id, created_at desc);

alter table public.usage_credit_ledger enable row level security;

-- Declare the Data API surface. anon and authenticated are deliberately not
-- granted: RLS is on with no policy, so the table stays closed to every
-- non-bypass role. A customer's credit balance is not browser-readable, and
-- there is no path by which a client should insert its own ledger row.
--
-- No delete. A ledger entry is a financial record; a mistake is corrected with
-- a refund or adjustment row, which leaves the correction visible, rather than
-- by removing the evidence.
grant select, insert on table public.usage_credit_ledger to service_role;

comment on table public.usage_credit_ledger is
  'Append-only credit ledger for metered capabilities, organization-scoped. Balance is the sum of grants, refunds and adjustments less draws; there is deliberately no balance column, because a read-modify-write from two serverless functions loses a write and the symptom is free usage. Decided in lib/sonara-usage-meter.cjs; priced in lib/sonara-paid-capabilities.cjs.';

do $$
begin
  if to_regclass('public.usage_credit_ledger') is null then
    raise exception 'public.usage_credit_ledger was not created';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.usage_credit_ledger'::regclass and relrowsecurity
  ) then
    raise exception 'public.usage_credit_ledger exists without row level security enabled';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.usage_credit_ledger', 'SELECT') then
    raise exception 'service_role cannot read public.usage_credit_ledger; the Data API surface was not declared';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.usage_credit_ledger', 'INSERT') then
    raise exception 'service_role cannot append to public.usage_credit_ledger; nothing could be charged';
  end if;

  -- The index is the double-charge guard, so its absence is a failure rather
  -- than a missing optimisation.
  if not exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public' and indexname = 'usage_credit_ledger_draw_idempotency'
  ) then
    raise exception 'the draw idempotency index is missing; a retried job would charge twice';
  end if;
end
$$;
