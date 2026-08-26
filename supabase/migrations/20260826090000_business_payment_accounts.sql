-- Connected payment accounts, so a business can be paid by its own customers.
--
-- Until now this application had no Stripe Connect at all. The only Stripe
-- integration was SONARA's own subscription billing, which is a completely
-- different relationship: it charges the customer *for SONARA*. There was no
-- mechanism by which a plumber could be paid for a job or a creator for a
-- product, and `lib/sonara-invoice-settlement.cjs` says so in its own comment
-- as the reason it computes a balance and stops there.
--
-- ## Why one row per organization, and why so few columns
--
-- Everything about a connected account that matters is Stripe's answer, not
-- ours: whether onboarding finished, whether charges are enabled, whether
-- payouts are. Those change on Stripe's side without telling us, so storing
-- them as the truth would be storing a copy that silently goes stale -- and a
-- stale "charges enabled" is the worst possible one, because it renders a pay
-- button over an account that cannot take money.
--
-- So this table holds the **identifier and the decision**, and the live state is
-- read from Stripe when a page needs it. The three cached columns exist only to
-- render a list without a network call per row, and every one of them is
-- nullable with `checked_at` beside it, so a reader can tell "not enabled" from
-- "never asked" -- which are different things and this repository has confused
-- them before.
--
-- ## What this table is deliberately not
--
-- It is not a ledger. No balance, no payout schedule, no transaction history.
-- Those live in Stripe, which is the system of record for money, and a second
-- copy here would be a reconciliation problem invented for no reason.
--
-- It also holds **no card data of any kind**. AGENTS.md forbids storing raw card
-- data or CVV, and the design that makes that easy to honour is the one where
-- card details never reach this application at all: onboarding happens on
-- Stripe's hosted flow, and charges are created against the connected account
-- directly.
--
-- ## Direct charges, and why that choice belongs in the schema comment
--
-- `charges_mode` records how money moves, because it is the difference between
-- this being a payment feature and this being money custody.
--
--   direct       -- the charge is created ON the connected account. Funds
--                   settle in the business's own Stripe balance and never
--                   touch SONARA's. This is the only mode this application
--                   implements, and it is the answer to the objection recorded
--                   in lib/sonara-invoice-settlement.cjs: a pay button would
--                   "take a small business's customer's money into SONARA's
--                   account with no mechanism to pay it out".
--   destination  -- the charge is created on the platform and transferred.
--                   SONARA would briefly hold the funds. Not implemented.
--
-- The column exists with a check constraint rather than being assumed, so a
-- future change to destination charges is a migration somebody has to write and
-- a reviewer can see, rather than a flag flipped in a module.

create table if not exists public.business_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Stripe's identifier for the connected account, `acct_...`. The shape is
  -- constrained below: a row carrying something that is not an account id is a
  -- row that will produce a confusing Stripe error at the worst moment.
  stripe_account_id text not null,

  -- How money moves. See the long note above; `direct` is the only implemented
  -- value and the constraint says so.
  charges_mode text not null default 'direct',

  -- Stripe's answers, cached only to render a list. Nullable on purpose:
  -- null means "never asked", false means "Stripe said no". A boolean defaulting
  -- to false would erase that difference, and "payouts disabled" and "we have
  -- not checked" lead a business owner to do completely different things.
  charges_enabled boolean,
  payouts_enabled boolean,
  details_submitted boolean,
  -- When the three above were last read from Stripe. A cached flag with no
  -- timestamp beside it is a number with nothing saying how old it is.
  state_checked_at timestamptz,

  -- Set when the owner deliberately disconnects. The row is kept rather than
  -- deleted so that a reconnect does not look like a first connection, and so
  -- that an invoice paid through the old account still has something to point
  -- at.
  disconnected_at timestamptz,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live account per organization. A business with two connected accounts has
-- no answer to "where does this payment go", and picking one silently is the
-- kind of coin-flip that is discovered by somebody's money arriving in the
-- wrong place. Disconnected rows are excluded so reconnecting is possible.
create unique index if not exists business_payment_accounts_one_live
  on public.business_payment_accounts (organization_id)
  where disconnected_at is null;

create index if not exists business_payment_accounts_organization_idx
  on public.business_payment_accounts (organization_id);

alter table public.business_payment_accounts
  drop constraint if exists business_payment_accounts_stripe_account_shape;

alter table public.business_payment_accounts
  add constraint business_payment_accounts_stripe_account_shape
  check (stripe_account_id ~ '^acct_[A-Za-z0-9]{8,}$');

alter table public.business_payment_accounts
  drop constraint if exists business_payment_accounts_charges_mode;

-- Only `direct` is implemented. Listing `destination` here and refusing it is
-- deliberate: it names the alternative so the next reader knows the choice was
-- made rather than never considered, and it fails loudly if somebody writes it.
alter table public.business_payment_accounts
  add constraint business_payment_accounts_charges_mode
  check (charges_mode = 'direct');

-- A cached state flag with no timestamp is a claim with nothing saying how old
-- it is. Either all three answers and the time they were read are present, or
-- none of them is.
alter table public.business_payment_accounts
  drop constraint if exists business_payment_accounts_state_has_time;

alter table public.business_payment_accounts
  add constraint business_payment_accounts_state_has_time
  check (
    (charges_enabled is null and payouts_enabled is null and details_submitted is null and state_checked_at is null)
    or state_checked_at is not null
  );

-- ---------------------------------------------------------------------------
-- Row level security.
-- ---------------------------------------------------------------------------
--
-- Enabled with no policies, matching scroll_sites, lead_capture_pages and
-- public_booking_pages. Every route reading this table goes through the service
-- role and carries its own `organization_id` filter, which is the tenant
-- boundary here as everywhere else.
--
-- There is no public read of any kind and there must never be one. A connected
-- account id is not a secret in the sense an API key is, but it names the
-- business's payment processor account, and a list of them across tenants is a
-- map of who takes money and who does not.
alter table public.business_payment_accounts enable row level security;

comment on table public.business_payment_accounts is
  'One connected Stripe account per organization, so a business can be paid by its own customers. Direct charges only: funds settle in the business account and never pass through SONARA. Holds no card data. lib/sonara-connected-payments.cjs is the only reader.';
