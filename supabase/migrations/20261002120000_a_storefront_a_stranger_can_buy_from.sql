-- A page a stranger can open and place an order on.
--
-- Everything a storefront needs already existed. merchant_products and
-- merchant_product_variants carry names, categories and price_cents;
-- business_payment_accounts records whether the organization can take money;
-- customer_invoice_lines even has a variant_id column, added in August for this.
-- What was missing was the front door: no route, no address, and nowhere to say
-- what the shop is called.
--
-- The same gap public_booking_pages filled for appointments, and this is
-- deliberately the same shape, including the parts that look like caution:
-- `enabled` defaults to false and `slug` defaults to null, so this migration
-- publishes nobody.
--
-- ## The invariant this exists to protect: an unreadable price is not free
--
-- `merchant_product_variants.price_cents` is `not null default 0`. That default
-- was right for the catalogue -- a row has to have something -- but it means zero
-- is indistinguishable between "this is free" and "nobody has set a price yet".
-- CLAUDE.md records the version of this that already shipped here: `Number(null)`
-- is `0` and finite, which made unpriced services read as free across twenty-three
-- columns.
--
-- A storefront that offers a zero-priced variant gives stock away on the strength
-- of a half-filled form. So the rule, held in lib/sonara-merchant-storefront.cjs
-- and asserted by test, is that **a variant is offered only at a positive price**,
-- and a zero-priced one is reported to the owner as needing a price rather than
-- being sold. There is no `is_free` column, deliberately: giving something away is
-- a decision somebody should make out loud, and until there is a surface for
-- making it, inventing a flag would be inventing the decision.
--
-- ## Why a line captures the price it was bought at
--
-- `merchant_order_lines.unit_price_cents` is a copy, not a join. An order's total
-- must not change when the owner edits the price next week -- somebody agreed to a
-- figure, and a receipt that silently re-prices itself is a receipt that cannot be
-- argued with. The variant reference is kept as well, so the owner can still see
-- what was bought, but the money is frozen at the moment of the order.
--
-- ## Why the total is stored and not only computed
--
-- `subtotal_cents` on the order is written by the server from the stored prices,
-- and the lines add up to it. The reason to store it is the same as above: it is
-- what was agreed. The reason to say so here is the thing that must never happen
-- -- a total taken from the request. A posted price is a buyer naming their own,
-- and lib/sonara-merchant-storefront.cjs computes every figure from rows it read.
--
-- ## What this does not do, deliberately
--
--   * **It takes no money and stores no card.** AGENTS.md forbids storing raw card
--     data or CVV, and the way to be certain is to have nowhere to put it. There is
--     no card column, no CVV, no payment token, and no charge path. An order here
--     is a record of what somebody wants; taking payment for it runs through the
--     organization's own connected account, which business_payment_accounts
--     already governs and which an owner has to set up themselves.
--   * **It sends nothing.** Alerts are off or explicitly user-controlled by
--     default. Placing an order writes a row; nobody is emailed.
--   * **It decrements no stock.** merchant_product_variants.inventory_item_id is
--     nullable and unenforced, and the catalogue migration says so: nothing
--     decrements inventory. An order that quietly implied it had would be a claim
--     about a capability that does not exist.

create table if not exists public.merchant_storefronts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text,
  enabled boolean not null default false,
  headline text,
  intro text,
  -- Matched against each variant's own currency when a line is priced. A shop
  -- cannot total two currencies into one number, and guessing which one the buyer
  -- meant is how a figure becomes wrong by a factor.
  currency text not null default 'usd',
  -- Whether the shop takes orders at all, separate from whether it is published. A
  -- shop can be readable while closed -- a visitor is owed the sentence saying so,
  -- rather than a form that fails.
  accepts_orders boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- One storefront per organization. A second row would make "the shop" ambiguous
-- everywhere it is read, the same reason public_booking_pages carries this.
create unique index if not exists merchant_storefronts_organization_key
  on public.merchant_storefronts (organization_id);

-- Lowercase letters, digits and single hyphens, 3 to 48 characters. A slug with a
-- slash in it is a slug that changes which route matches.
alter table public.merchant_storefronts
  drop constraint if exists merchant_storefronts_slug_shape;
alter table public.merchant_storefronts
  add constraint merchant_storefronts_slug_shape
  check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$');

create unique index if not exists merchant_storefronts_slug_key
  on public.merchant_storefronts (slug) where slug is not null;

create table if not exists public.merchant_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- `on delete set null` rather than cascade: deleting a shop must not delete the
  -- record of what people bought from it.
  storefront_id uuid references public.merchant_storefronts(id) on delete set null,
  buyer_name text not null,
  buyer_email text not null,
  -- placed -> confirmed -> fulfilled, or cancelled from any of them. Cancelled is
  -- a state and not a delete: the buyer and the owner both need the record of an
  -- order that was called off, and who called it off.
  status text not null default 'placed'
    check (status in ('placed', 'confirmed', 'fulfilled', 'cancelled')),
  -- Written by the server from the prices it read. Never from the request.
  subtotal_cents integer not null check (subtotal_cents >= 0),
  currency text not null default 'usd',
  note text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint merchant_orders_buyer_name_length check (char_length(buyer_name) between 1 and 200),
  constraint merchant_orders_buyer_email_shape
    check (buyer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

create table if not exists public.merchant_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.merchant_orders(id) on delete cascade,
  -- Kept so the owner can see what was bought. `on delete set null` because
  -- archiving a variant must not erase the line that sold it -- which is why the
  -- name and the price are copied below rather than joined.
  variant_id uuid references public.merchant_product_variants(id) on delete set null,
  -- What it was called at the time. A variant renamed next month does not rewrite
  -- what somebody ordered.
  description text not null,
  quantity integer not null check (quantity between 1 and 999),
  -- Frozen at the moment of the order. A copy and not a join, for the reason in
  -- the header: a receipt that re-prices itself cannot be argued with.
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  currency text not null default 'usd',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint merchant_order_lines_description_length check (char_length(description) between 1 and 300)
);

create index if not exists merchant_orders_organization_idx
  on public.merchant_orders (organization_id, created_at desc);
create index if not exists merchant_orders_status_idx
  on public.merchant_orders (organization_id, status);
create index if not exists merchant_order_lines_order_idx
  on public.merchant_order_lines (order_id);
create index if not exists merchant_order_lines_organization_idx
  on public.merchant_order_lines (organization_id, created_at desc);

alter table public.merchant_storefronts enable row level security;
alter table public.merchant_orders enable row level security;
alter table public.merchant_order_lines enable row level security;

-- Service role only, and no DELETE on any of the three.
--
-- A cancelled order is a state, not an absence. Both sides need the record of an
-- order that was called off, and "destructive data changes" is an owner-approval
-- category in AGENTS.md.
grant select, insert, update on public.merchant_storefronts to service_role;
grant select, insert, update on public.merchant_orders to service_role;
grant select, insert, update on public.merchant_order_lines to service_role;
revoke all on public.merchant_storefronts from anon, authenticated;
revoke all on public.merchant_orders from anon, authenticated;
revoke all on public.merchant_order_lines from anon, authenticated;

notify pgrst, 'reload schema';

do $$
declare
  t text;
  p text;
begin
  foreach t in array array['merchant_storefronts', 'merchant_orders', 'merchant_order_lines'] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise exception 'public.% was not created', t;
    end if;

    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relrowsecurity
    ) then
      raise exception 'public.% does not have row level security enabled', t;
    end if;

    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'public.% carries a policy; these tables are reached through the service role only', t;
    end if;

    if exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = t
        and grantee = 'service_role' and privilege_type = 'DELETE'
    ) then
      raise exception 'public.% grants DELETE to service_role; a cancelled order is a recorded state and deleting it erases it', t;
    end if;

    for p in select unnest(array['SELECT', 'INSERT', 'UPDATE']) loop
      if not exists (
        select 1 from information_schema.role_table_grants
        where table_schema = 'public' and table_name = t
          and grantee = 'service_role' and privilege_type = p
      ) then
        raise exception 'public.% does not grant % to service_role', t, p;
      end if;
    end loop;

    if exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = t
        and grantee in ('anon', 'authenticated')
    ) then
      raise exception 'public.% is reachable by anon or authenticated; it must be service-role only', t;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t
        and column_name = 'organization_id' and is_nullable = 'YES'
    ) then
      raise exception 'public.%.organization_id is nullable; every row here belongs to one organization', t;
    end if;
  end loop;

  -- A line's price is frozen, so it must not be nullable: a line with no price is
  -- a line that cannot be totalled, and the whole point of copying the figure is
  -- that it is always there.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'merchant_order_lines'
      and column_name in ('unit_price_cents', 'line_total_cents', 'quantity')
      and is_nullable = 'YES'
  ) then
    raise exception 'a merchant_order_lines money or quantity column is nullable; a line that cannot be totalled must not be writable';
  end if;

  -- Nothing here holds a card. Asserted against the live catalogue rather than
  -- trusted from the create statements, because the thing worth preventing is a
  -- later migration adding one.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('merchant_storefronts', 'merchant_orders', 'merchant_order_lines')
      and (column_name like '%card%' or column_name like '%cvv%' or column_name like '%pan%'
           or column_name like '%payment_token%' or column_name like '%card_number%')
  ) then
    raise exception 'a storefront table has gained a card column; raw card data and CVV must never be stored here';
  end if;

  -- The shop is unpublished until somebody publishes it, and one address names one
  -- shop.
  if (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'merchant_storefronts' and column_name = 'enabled') <> 'false' then
    raise exception 'merchant_storefronts.enabled does not default to false; deploying would publish every organization';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'merchant_storefronts_slug_key'
  ) then
    raise exception 'merchant_storefronts.slug is not unique; one public address could name two shops';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'merchant_storefronts_organization_key'
  ) then
    raise exception 'merchant_storefronts has no unique index per organization; "the shop" would be ambiguous';
  end if;
end $$;
