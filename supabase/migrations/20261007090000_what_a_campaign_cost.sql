-- What a campaign cost, one row per amount the owner records.
--
-- Growth Studio records who a campaign reached (growth_campaign_sends), the
-- leads that point at it (growth_leads.campaign_id) and the conversions
-- attributed to it (growth_conversions.campaign_id, with a value and a
-- currency). It recorded nothing about what the campaign cost, so the last
-- two steps of the chain -- did it pay for itself, and what to do next -- could
-- not be answered for anybody. A return figure needs both halves; this is the
-- missing one.
--
-- ## Recorded by the owner, not fetched
--
-- Nothing here reads an ad platform. The amounts are what the owner says they
-- spent: a boosted post, a printed flyer, a fee to a promoter. The page says so
-- next to every figure it derives from them. When a provider connector reports
-- spend, it can write rows with `source` set to that provider -- a column that
-- exists now so that a row can never be mistaken for the other kind later.
--
-- ## Append-only, with corrections as rows
--
-- No update, no delete. A mistaken amount is answered by a `correction` row,
-- which may be negative, so the history of what was claimed and when stays
-- readable -- the same reasoning as usage_credit_ledger and
-- growth_campaign_sends. A `spend` row must be positive: a negative "spend" is
-- a correction that has not said so.
--
-- ## Currency is required and never converted
--
-- Three-letter lower case, as growth_conversions and merchant_orders store it.
-- There is no exchange rate in this product, so a return is worked out per
-- currency and never across them.
--
-- ## The grant is not optional
--
-- Dated after 20260718064853_data_api_privilege_hardening: a table created
-- without a declared surface lands unreadable by the server. anon and
-- authenticated get nothing; RLS is on with no policy, so every read and write
-- goes through the server, which filters on organization_id.
--
-- No customer data is modified by this migration.

create table if not exists public.growth_campaign_spend (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.growth_campaigns(id) on delete cascade,
  kind text not null default 'spend',
  amount_cents bigint not null,
  currency text not null,
  spent_on date not null,
  -- What the money paid for, in the owner's words. Required: an amount nobody
  -- can account for is the figure a return calculation should least rest on.
  description text not null,
  -- An invoice number, a receipt reference, an ad platform's order id.
  reference text,
  -- 'owner' for an amount typed in. A connector that reports spend names
  -- itself here.
  source text not null default 'owner',
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint growth_campaign_spend_kind_known
    check (kind in ('spend', 'correction')),
  constraint growth_campaign_spend_amount_signed_by_kind
    check ((kind = 'spend' and amount_cents > 0) or (kind = 'correction' and amount_cents <> 0)),
  constraint growth_campaign_spend_currency_shape
    check (currency ~ '^[a-z]{3}$'),
  constraint growth_campaign_spend_description_present
    check (length(btrim(description)) > 0)
);

-- Every read is one campaign within one organization.
create index if not exists growth_campaign_spend_org_campaign
  on public.growth_campaign_spend (organization_id, campaign_id, spent_on desc);

alter table public.growth_campaign_spend enable row level security;

grant select, insert on table public.growth_campaign_spend to service_role;

comment on table public.growth_campaign_spend is
  'Append-only record of what a Growth Studio campaign cost, as the owner recorded it (source = owner) or as a connector reported it. Corrections are rows of kind correction, never edits. Per currency; nothing here converts between currencies.';

do $$
begin
  if to_regclass('public.growth_campaign_spend') is null then
    raise exception 'public.growth_campaign_spend was not created';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.growth_campaign_spend'::regclass and relrowsecurity
  ) then
    raise exception 'public.growth_campaign_spend exists without row level security enabled';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.growth_campaign_spend', 'SELECT') then
    raise exception 'service_role cannot read public.growth_campaign_spend; no return could be worked out';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.growth_campaign_spend', 'INSERT') then
    raise exception 'service_role cannot write public.growth_campaign_spend; no spend could be recorded';
  end if;

  if pg_catalog.has_table_privilege('service_role', 'public.growth_campaign_spend', 'UPDATE')
     or pg_catalog.has_table_privilege('service_role', 'public.growth_campaign_spend', 'DELETE') then
    raise exception 'public.growth_campaign_spend must be append-only; a correction is a new row';
  end if;
end;
$$;
