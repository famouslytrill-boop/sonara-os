-- A sale is a licence delivered: orders, entitlements and immutable delivery files
-- for the Creator Studio marketplace.
--
-- Until this, a listing could be cleared to sell and nobody could buy it.
-- docs/COMMERCE_UPLOAD_READINESS.md wrote down what buying has to mean, and this
-- schema is that document's first four steps:
--
--   1. an order bound to a signed-in buyer and a listing cleared at the moment of
--      purchase, with a snapshot of exactly what was bought;
--   2. a hosted Stripe Checkout on the SELLER's connected account (a direct
--      charge -- the money never enters SONARA's account);
--   3. fulfilment only from a signed webhook, verified against the order before an
--      entitlement exists -- the success page grants nothing;
--   4. a short-lived download of the recorded version, for that buyer only.
--
-- ## The invariant: what was bought is what is delivered
--
-- A version recorded a checksum and no file. The asset carries ONE file, and the
-- seller can replace or remove it at any time -- so "deliver version 3" meant
-- "deliver whatever the asset holds today", which might be version 5, or nothing.
-- creator_version_files pins a copy of the file to the version when it is listed.
-- It is insert-only: the grants below withhold UPDATE and DELETE, and the
-- assertions check that, so a sold version's file cannot be swapped by any path in
-- this application.
--
-- ## The invariant: an exclusive licence is sold once
--
-- `exclusive_transfer` hands the buyer the exclusive right. Two buyers paying for
-- it would be two people told they own the only copy. A partial unique index
-- allows at most one live (pending or paid) exclusive order per listing, so the
-- second checkout cannot even be started while the first is open. A pending order
-- carries `expires_at` -- the Checkout session's own expiry -- and is released
-- when it passes. `processing` is the state between a completed checkout and the
-- arrival of a delayed payment (a bank debit, say): it keeps the hold and is never
-- released by expiry, because the buyer has already done everything they can.
--
-- ## What this does not do, deliberately
--
--   * **No card data.** Payment happens on Stripe's hosted page. These tables hold
--     Stripe identifiers and an amount snapshot, and the assertions refuse a card,
--     cvv or pan column.
--   * **No automated refund.** AGENTS.md puts refunds behind owner approval. A
--     refund the seller issues in Stripe arrives here as an event and is recorded;
--     nothing in this application issues one.
--   * **No commission.** marketplace fees are zero (lib/sonara-creator-marketplace.cjs
--     MARKETPLACE_FEES). There is no application fee column, so taking one is a
--     migration somebody writes and a reviewer sees.
--   * **No deletion.** An order, a grant and a payment event are the record of a
--     sale. They change state; they are never removed.

create table if not exists public.creator_version_files (
  version_id uuid primary key references public.creator_asset_versions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bucket text not null,
  -- The pinned copy, under the organization's own prefix. Unique: two versions
  -- never share a delivery object, so removing one can never take another's file.
  object_path text not null,
  filename text not null,
  content_type text not null,
  bytes bigint not null check (bytes > 0),
  -- The object this copy was made from, for the audit trail. Not used to deliver.
  copied_from_path text,
  pinned_by uuid,
  pinned_at timestamptz not null default now(),
  constraint creator_version_files_path_unique unique (object_path),
  constraint creator_version_files_filename_length check (char_length(filename) between 1 and 255)
);

create table if not exists public.creator_marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  -- The SELLER's organization. Resolved on the server from the listing; never
  -- taken from a buyer's form.
  organization_id uuid not null references public.organizations(id) on delete cascade,
  listing_id uuid not null references public.creator_listings(id) on delete restrict,
  version_id uuid not null references public.creator_asset_versions(id) on delete restrict,
  -- The signed-in buyer. No foreign key to auth.users: a buyer deleting their
  -- account must not delete the seller's record of a sale.
  buyer_user_id uuid not null,
  -- The snapshot. A seller editing the listing after this row exists changes
  -- nothing about what this buyer bought or paid.
  title text not null,
  licence text not null check (licence in ('personal_use', 'commercial_single', 'commercial_unlimited', 'exclusive_transfer')),
  price_cents integer not null check (price_cents > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  -- The seller's connected account at the moment of purchase. The webhook that
  -- fulfils this order must come from this account.
  stripe_account_id text not null check (stripe_account_id ~ '^acct_[A-Za-z0-9]{8,}$'),
  checkout_session_id text,
  payment_intent_id text,
  state text not null default 'pending'
    check (state in ('pending', 'processing', 'paid', 'payment_failed', 'expired', 'refunded', 'disputed')),
  expires_at timestamptz not null,
  paid_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_marketplace_orders_session_unique unique (checkout_session_id),
  -- A paid order says when; anything else does not claim to be paid.
  constraint creator_marketplace_orders_paid_has_time check ((state in ('paid', 'refunded', 'disputed')) = (paid_at is not null))
);

-- At most one live exclusive order per listing. The whole guarantee behind
-- "exclusive", enforced by the database rather than remembered by a route.
create unique index if not exists creator_marketplace_orders_exclusive_once
  on public.creator_marketplace_orders (listing_id)
  where licence = 'exclusive_transfer' and state in ('pending', 'processing', 'paid');

-- One open checkout per buyer per listing, so a double-click reuses the session it
-- started rather than opening a second one -- and a buyer whose delayed payment
-- is still on its way cannot pay twice.
create unique index if not exists creator_marketplace_orders_one_pending
  on public.creator_marketplace_orders (listing_id, buyer_user_id)
  where state in ('pending', 'processing');

create index if not exists creator_marketplace_orders_seller_idx
  on public.creator_marketplace_orders (organization_id, state, created_at desc);
create index if not exists creator_marketplace_orders_buyer_idx
  on public.creator_marketplace_orders (buyer_user_id, created_at desc);

create table if not exists public.creator_licence_grants (
  -- One grant per order, enforced: a replayed webhook cannot grant twice.
  order_id uuid primary key references public.creator_marketplace_orders(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  buyer_user_id uuid not null,
  version_id uuid not null references public.creator_asset_versions(id) on delete restrict,
  licence text not null check (licence in ('personal_use', 'commercial_single', 'commercial_unlimited', 'exclusive_transfer')),
  granted_at timestamptz not null default now(),
  -- A refund or a dispute revokes delivery. Recorded, never deleted.
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason is null or revoked_reason in ('refunded', 'disputed'))
);

create index if not exists creator_licence_grants_buyer_idx
  on public.creator_licence_grants (buyer_user_id, granted_at desc);

create table if not exists public.creator_marketplace_payment_events (
  -- Stripe's event id. Primary key, so a replayed delivery is recognised as one.
  stripe_event_id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.creator_marketplace_orders(id) on delete restrict,
  event_type text not null,
  stripe_account_id text not null,
  -- What this application did with it: the decision, in a word.
  outcome text not null,
  received_at timestamptz not null default now()
);

create index if not exists creator_marketplace_payment_events_order_idx
  on public.creator_marketplace_payment_events (order_id, received_at);

alter table public.creator_version_files enable row level security;
alter table public.creator_marketplace_orders enable row level security;
alter table public.creator_licence_grants enable row level security;
alter table public.creator_marketplace_payment_events enable row level security;

-- Service role only. The pinned file and the payment events are insert-only; the
-- order and the grant change state but are never deleted.
grant select, insert on public.creator_version_files to service_role;
grant select, insert, update on public.creator_marketplace_orders to service_role;
grant select, insert, update on public.creator_licence_grants to service_role;
grant select, insert on public.creator_marketplace_payment_events to service_role;
revoke all on public.creator_version_files from anon, authenticated;
revoke all on public.creator_marketplace_orders from anon, authenticated;
revoke all on public.creator_licence_grants from anon, authenticated;
revoke all on public.creator_marketplace_payment_events from anon, authenticated;

notify pgrst, 'reload schema';

do $$
declare
  t text;
  offending text;
begin
  foreach t in array array['creator_version_files', 'creator_marketplace_orders', 'creator_licence_grants', 'creator_marketplace_payment_events'] loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = t and c.relrowsecurity) then
      raise exception 'public.% does not have row level security enabled', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'public.% carries a policy; sales are reached through the service role only', t;
    end if;
    if exists (select 1 from information_schema.role_table_grants
               where table_schema = 'public' and table_name = t and grantee in ('anon', 'authenticated')) then
      raise exception 'public.% is reachable by anon or authenticated', t;
    end if;
    if exists (select 1 from information_schema.role_table_grants
               where table_schema = 'public' and table_name = t
                 and grantee = 'service_role' and privilege_type = 'DELETE') then
      raise exception 'public.% grants DELETE; the record of a sale is changed by state, never removed', t;
    end if;
  end loop;

  -- 1. A pinned delivery file and a recorded payment event cannot be rewritten.
  foreach t in array array['creator_version_files', 'creator_marketplace_payment_events'] loop
    if exists (select 1 from information_schema.role_table_grants
               where table_schema = 'public' and table_name = t
                 and grantee = 'service_role' and privilege_type = 'UPDATE') then
      raise exception 'public.% grants UPDATE; it is insert-only, so what was sold or received cannot be rewritten', t;
    end if;
  end loop;

  -- 2. Exclusive is enforced by the database.
  if not exists (select 1 from pg_indexes where schemaname = 'public'
                 and indexname = 'creator_marketplace_orders_exclusive_once'
                 and indexdef like '%UNIQUE%' and indexdef like '%exclusive_transfer%') then
    raise exception 'creator_marketplace_orders has no unique index limiting an exclusive listing to one live order';
  end if;

  -- 3. One grant per order.
  if not exists (select 1 from information_schema.table_constraints
                 where table_schema = 'public' and table_name = 'creator_licence_grants'
                   and constraint_type = 'PRIMARY KEY') then
    raise exception 'creator_licence_grants has no primary key on order_id; a replayed webhook could grant twice';
  end if;

  -- 4. No card data, and no commission, anywhere in the sale.
  select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name) into offending
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('creator_version_files', 'creator_marketplace_orders', 'creator_licence_grants', 'creator_marketplace_payment_events')
     and (column_name like '%card%' or column_name like '%cvv%' or column_name like '%pan%'
          or column_name like '%application_fee%' or column_name like '%commission%');
  if offending is not null then
    raise exception 'a marketplace sale table carries %; card data is never stored, and the marketplace takes no commission', offending;
  end if;

  -- 5. An order starts pending, and a price has no default.
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'creator_marketplace_orders' and column_name = 'state')
     is distinct from '''pending''::text' then
    raise exception 'creator_marketplace_orders.state does not default to pending';
  end if;
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'creator_marketplace_orders' and column_name = 'price_cents') is not null then
    raise exception 'creator_marketplace_orders.price_cents has a default; a price is always the snapshot of a real one';
  end if;
end $$;
