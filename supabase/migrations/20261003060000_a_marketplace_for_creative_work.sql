-- Creator Studio's marketplace: one listing per thing somebody is selling.
--
-- The owner's brief: "Creator studio comes with a Marketplace. Where users can
-- sell and monetize the audio and video creations and generations, pictures and
-- art."
--
-- ## The rule the shape enforces
--
-- A listing points at a **version**, not at an asset. `creator_asset_versions`
-- already exists for exactly this reason (20261002010000): approving "the asset"
-- approves whatever it becomes next, and selling "the asset" sells whatever it
-- becomes next. A buyer paid for the thing they heard.
--
-- lib/sonara-creator-marketplace.cjs decides whether a listing may be offered,
-- and it composes publishReadiness from the approval graph rather than restating
-- it: selling is never easier than publishing.
--
-- ## Three attestations, each nullable on purpose
--
-- `rights_attested` and `consent_attested` are nullable booleans and they must
-- stay that way. Yes, no, and **nobody has answered** are three states:
--
--   `Boolean(row.rights_attested)` reads the third as the second, which is the
--   safe direction, and `row.rights_attested !== false` reads it as the first,
--   which is not. The module refuses on `not_recorded` either way, and the column
--   has to be able to hold it for the module to see it.
--
-- They are separate columns because they are separate questions. Holding the
-- copyright in a recording of somebody's voice does not mean you may sell a
-- synthetic version of it. AGENTS.md asks for provenance, consent and anti-clone
-- safety as three things; this keeps two of them apart where it would be easiest
-- to collapse them.
--
-- ## No money moves here
--
-- `price_cents` is what the creator is asking. There is no paid, settled, or
-- payout column and no card data anywhere -- the assertion block below checks the
-- live catalogue for that rather than trusting this comment, because AGENTS.md
-- forbids storing card data and a comment cannot enforce it. Taking payment needs
-- the owner's commerce credentials; until then a ready listing says so.

create table if not exists public.creator_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- The version, not the asset. A listing whose version is deleted goes with it:
  -- the thing being sold stopped existing, and a listing pointing at nothing is a
  -- storefront page that takes money for a file nobody can produce.
  version_id uuid not null references public.creator_asset_versions(id) on delete cascade,
  title text not null,
  medium text,
  -- Null means nobody set a price. Deliberately NOT `not null default 0`, which
  -- is the shape lib/sonara-merchant-storefront.cjs was written around: with a
  -- default of zero an unpriced listing and a free one are the same row, and the
  -- storefront offered unpriced things at nothing.
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency text,
  -- What the buyer may do with it. Constrained, because a free-text licence is
  -- one nobody can compare or enforce, and because the page has to be able to say
  -- what each means in a sentence.
  licence text check (licence is null or licence in ('personal_use', 'commercial_single', 'commercial_unlimited', 'exclusive_transfer')),
  state text not null default 'draft' check (state in ('draft', 'listed', 'withdrawn', 'sold_exclusively')),
  -- Nullable on purpose. See the header: three states, and the module refuses on
  -- the third.
  rights_attested boolean,
  consent_attested boolean,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.creator_listings is
  'One thing a creator is selling, pointing at a version rather than an asset so a buyer gets what they heard. lib/sonara-creator-marketplace.cjs decides whether it may be offered and composes the approval graph: selling is never easier than publishing.';
comment on column public.creator_listings.price_cents is
  'Null means nobody set a price, which is not the same as free. No default of zero -- that shape made unpriced things look free in the merchant storefront.';
comment on column public.creator_listings.rights_attested is
  'Null means nobody answered. Not false. lib/sonara-creator-marketplace.cjs refuses to list on null as well as on false.';
comment on column public.creator_listings.consent_attested is
  'Separate from rights on purpose: holding the copyright in a recording of a voice is not permission to sell a synthetic version of it.';

create index if not exists creator_listings_org_state_idx
  on public.creator_listings (organization_id, state, updated_at desc);
create index if not exists creator_listings_version_idx
  on public.creator_listings (version_id);

alter table public.creator_listings enable row level security;
grant select, insert, update on table public.creator_listings to service_role;

-- ---------------------------------------------------------------------------
-- creator_marketplace_entries: the public catalogue
-- ---------------------------------------------------------------------------
--
-- What a stranger browsing /marketplace reads, and the ONLY thing they read.
--
-- The first version of this marketplace read creator_listings directly from the
-- public page, one query across every organization's rows.
-- tests/cross-tenant-isolation.test.js refused it, and was right to: that test
-- holds that a signed-in route never queries a tenant-scoped table without an
-- organization, and has no exemption list, deliberately. A public browse page is
-- the one place that genuinely needs every seller's listings at once -- so instead
-- of an exemption, the public side gets a table that is not tenant data at all.
--
-- **It has no organization_id, and no column a buyer may not see.** A public
-- query against it cannot leak a private field because there is none to leak,
-- which is a stronger property than a public query that remembered to leave one
-- out. The assertion block below checks the column set is exactly this one, so a
-- column added later fails the migration instead of quietly becoming public.
--
-- A row exists only while a listing is on sale. It is written by
-- routes/sonara-creator-marketplace-routes.cjs at the moment the listing is
-- cleared -- listingReadiness is asked again then, not remembered from when the
-- page was drawn -- and removed when the listing is withdrawn, when an edit makes
-- it unsellable, or when its version's approval is withdrawn or re-opened for
-- review on the approval graph. It is a snapshot of what was cleared, which is
-- what a buyer is entitled to see; the creator's page re-checks live and says when
-- something on sale has stopped being cleared.

create table if not exists public.creator_marketplace_entries (
  listing_id uuid primary key references public.creator_listings(id) on delete cascade,
  title text not null,
  medium text,
  -- Not null, and above zero. An entry exists only for a listing that was cleared
  -- to sell, and a cleared listing has a price. This is the database's own copy of
  -- "a price nobody set is not free", on the one table the public reads.
  price_cents integer not null check (price_cents > 0),
  currency text not null,
  licence text not null check (licence in ('personal_use', 'commercial_single', 'commercial_unlimited', 'exclusive_transfer')),
  made_by_machine boolean not null,
  -- Nullable: declared AI, declared human, or nobody recorded it. Three states,
  -- because a boolean here would tell a buyer "not AI" about a work where the
  -- question was never put.
  ai_disclosed boolean,
  listed_at timestamptz not null default now()
);

comment on table public.creator_marketplace_entries is
  'The public marketplace catalogue: one row per listing on sale, holding only what a buyer may see and no organization. Public pages read this and nothing else, so a public query cannot reach tenant data.';

create index if not exists creator_marketplace_entries_listed_idx
  on public.creator_marketplace_entries (listed_at desc);

alter table public.creator_marketplace_entries enable row level security;
grant select, insert, update, delete on table public.creator_marketplace_entries to service_role;

-- ---------------------------------------------------------------------------
-- Assertions, against the live catalogue
-- ---------------------------------------------------------------------------

do $$
declare
  nullable_attestations integer;
  price_default text;
  money_columns text;
  state_check text;
  catalogue_columns text;
begin
  -- 1. Both attestations stay nullable. A not-null default would make every
  -- existing listing look attested by somebody.
  select count(*) into nullable_attestations
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'creator_listings'
     and column_name in ('rights_attested', 'consent_attested')
     and is_nullable = 'YES';
  if nullable_attestations <> 2 then
    raise exception
      'creator_listings has % of 2 nullable attestations. An unanswered attestation must be storable as unanswered, or the module cannot refuse on it.',
      nullable_attestations;
  end if;

  -- 2. price_cents has no default. `not null default 0` is the exact shape that
  -- made unpriced services read as free across twenty-three columns.
  select column_default into price_default
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'creator_listings'
     and column_name = 'price_cents';
  if price_default is not null then
    raise exception
      'creator_listings.price_cents has default %. A price nobody set would then be indistinguishable from free.',
      price_default;
  end if;

  -- 3. No settlement, no payout, no card. Read from the catalogue rather than
  -- asserted in prose: AGENTS.md forbids storing card data or CVV and a comment
  -- cannot enforce it.
  select string_agg(column_name, ', ' order by column_name) into money_columns
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'creator_listings'
     and (
       column_name like '%card%'
       or column_name like '%cvv%'
       or column_name like '%payout%'
       or column_name like '%settled%'
       or column_name like '%paid_at%'
     );
  if money_columns is not null then
    raise exception
      'creator_listings carries % -- this table records what is being asked for, not a payment. Settlement belongs where the payment provider is.',
      money_columns;
  end if;

  -- 4. The state check still refuses a buyable value nobody intended. Asserted
  -- against the stored definition, because `create table if not exists` is a
  -- no-op on an existing table -- on any database where this table already exists,
  -- everything above did nothing and only this block would notice.
  select pg_get_constraintdef(oid) into state_check
    from pg_constraint
   where conrelid = 'public.creator_listings'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%state%';
  if state_check is null then
    raise exception 'creator_listings has no state check constraint, so state accepts anything.';
  end if;
  if state_check not like '%draft%' or state_check not like '%listed%' then
    raise exception 'creator_listings state check is now %, which no longer names both draft and listed.', state_check;
  end if;

  -- 5. The public catalogue holds exactly what a buyer may see. Checked as the
  -- whole set rather than as "no organization_id", because the failure worth
  -- catching is any column at all arriving here -- a note, an attestation, a cost
  -- -- and becoming public by being added to the table the public reads.
  select string_agg(column_name, ',' order by column_name) into catalogue_columns
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'creator_marketplace_entries';
  if catalogue_columns is distinct from 'ai_disclosed,currency,licence,listed_at,listing_id,made_by_machine,medium,price_cents,title' then
    raise exception
      'creator_marketplace_entries has columns %. The public catalogue holds exactly what a buyer may see; anything added here is published by being added.',
      catalogue_columns;
  end if;
end $$;
