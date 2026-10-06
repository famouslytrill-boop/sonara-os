-- A storefront order is paid on the shop's own account, and the owner can check
-- every payment against Stripe's record of it.
--
-- (First written as 20261006010000. Supabase's preview branch rolled that back on
-- 6 October 2026: the new events table carried service-role privileges beyond the
-- select and insert granted here -- Supabase's default privileges on `public`, which
-- the local migration replay's shim does not reproduce -- and the assertion below
-- refused it. It never applied anywhere, so it is replaced under a new name rather
-- than edited in place; scripts/verify-applied-migrations.mjs pins by filename.)
--
-- 20261002120000_a_storefront_a_stranger_can_buy_from.sql gave a stranger a shop
-- to order from and deliberately took no money: an order recorded what somebody
-- wanted, and the owner collected payment however they already did. This is the
-- next step of the Business Builder chain the owner named on 5 October --
-- order -> payment -> receipt -> reconciliation -- and it follows the commerce
-- contract in docs/CODEX_HANDOFF_SKILLS_FORMULAS_AGENTS.md section 12, the same one
-- the Creator Studio marketplace follows:
--
--   * a hosted Stripe Checkout, charged directly on the shop's connected account;
--   * no application fee -- SONARA takes nothing from the sale;
--   * an order becomes paid only from a signed Connect webhook, or from a
--     server-side read of Stripe's own Checkout Session during reconciliation;
--   * a refund or dispute is recorded when Stripe reports it, and nothing here
--     issues one (AGENTS.md: owner approval).
--
-- ## Two states, not one
--
-- `status` (placed / confirmed / fulfilled / cancelled) is the shop's word about
-- the goods. `payment_state` is Stripe's word about the money. They are separate
-- columns because they are separate facts: an order can be fulfilled and unpaid
-- (paid on collection) or paid and not yet fulfilled, and a single column would
-- force one of those to lie.
--
-- ## The buyer has no account
--
-- A storefront buyer is a stranger, so the receipt page cannot be scoped by a
-- signed-in user the way a marketplace purchase is. `buyer_token_hash` is the
-- SHA-256 of a random token handed to the buyer once, in the address of their
-- receipt. The token is never stored; the hash cannot be turned back into it.
-- Anybody without it reading `/store/:slug/orders/:id` is answered exactly as if
-- the order did not exist.
--
-- ## Reconciliation needs Stripe's figures beside ours
--
-- `amount_paid_cents` is what Stripe said was paid, written from the event, so a
-- mismatch with `subtotal_cents` is visible rather than assumed away.
-- `refunded_cents` is Stripe's cumulative refunded amount and only ever rises;
-- a partial refund leaves the order paid and says how much went back.
--
-- ## What this does not do
--
--   * No card data. The existing storefront migration refuses card, cvv, pan and
--     payment_token columns; the assertions below refuse them again, plus any
--     application fee or commission column.
--   * Nothing is removed. The payment events are insert-only, and an order is
--     changed by state, never taken away.

alter table public.merchant_orders
  add column if not exists payment_state text not null default 'unpaid',
  add column if not exists buyer_token_hash text,
  add column if not exists stripe_account_id text,
  add column if not exists checkout_session_id text,
  add column if not exists checkout_url text,
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists checkout_attempts integer not null default 0,
  add column if not exists payment_intent_id text,
  add column if not exists amount_paid_cents integer,
  add column if not exists refunded_cents integer not null default 0,
  add column if not exists paid_at timestamptz;

alter table public.merchant_orders drop constraint if exists merchant_orders_payment_state_known;
alter table public.merchant_orders add constraint merchant_orders_payment_state_known
  check (payment_state in ('unpaid', 'checkout_open', 'processing', 'paid', 'refunded', 'disputed'));

alter table public.merchant_orders drop constraint if exists merchant_orders_paid_has_time;
alter table public.merchant_orders add constraint merchant_orders_paid_has_time
  check ((payment_state in ('paid', 'refunded', 'disputed')) = (paid_at is not null));

alter table public.merchant_orders drop constraint if exists merchant_orders_buyer_token_hash_shape;
alter table public.merchant_orders add constraint merchant_orders_buyer_token_hash_shape
  check (buyer_token_hash is null or buyer_token_hash ~ '^[a-f0-9]{64}$');

alter table public.merchant_orders drop constraint if exists merchant_orders_stripe_account_shape;
alter table public.merchant_orders add constraint merchant_orders_stripe_account_shape
  check (stripe_account_id is null or stripe_account_id ~ '^acct_[A-Za-z0-9]{8,}$');

alter table public.merchant_orders drop constraint if exists merchant_orders_checkout_url_shape;
alter table public.merchant_orders add constraint merchant_orders_checkout_url_shape
  check (checkout_url is null or checkout_url like 'https://checkout.stripe.com/%');

alter table public.merchant_orders drop constraint if exists merchant_orders_amounts_sane;
alter table public.merchant_orders add constraint merchant_orders_amounts_sane
  check (
    checkout_attempts between 0 and 1000
    and (amount_paid_cents is null or amount_paid_cents >= 0)
    and refunded_cents >= 0
    and refunded_cents <= coalesce(amount_paid_cents, 0)
  );

create unique index if not exists merchant_orders_checkout_session_key
  on public.merchant_orders (checkout_session_id) where checkout_session_id is not null;
create unique index if not exists merchant_orders_payment_intent_key
  on public.merchant_orders (payment_intent_id) where payment_intent_id is not null;
create index if not exists merchant_orders_payment_state_idx
  on public.merchant_orders (organization_id, payment_state, created_at desc);

create table if not exists public.merchant_order_payment_events (
  -- Stripe's event id, or `reconciled:<checkout session id>` when the owner
  -- recorded a payment from Stripe's own record after a webhook never arrived.
  -- Primary key, so a replay is recognised as one.
  stripe_event_id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.merchant_orders(id) on delete restrict,
  event_type text not null,
  stripe_account_id text not null,
  -- What this application did with it, in a word.
  outcome text not null,
  amount_cents integer,
  received_at timestamptz not null default now()
);

create index if not exists merchant_order_payment_events_order_idx
  on public.merchant_order_payment_events (order_id, received_at);
create index if not exists merchant_order_payment_events_organization_idx
  on public.merchant_order_payment_events (organization_id, received_at desc);

alter table public.merchant_order_payment_events enable row level security;
-- Everything off first, then exactly what is meant. A plain grant adds to whatever
-- the platform's default privileges already gave the service role on a new table.
revoke all on public.merchant_order_payment_events from anon, authenticated, service_role;
grant select, insert on public.merchant_order_payment_events to service_role;
-- An order changes state and is never removed.
revoke delete, truncate on public.merchant_orders from service_role;

notify pgrst, 'reload schema';

do $$
declare
  offending text;
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'merchant_order_payment_events' and c.relrowsecurity) then
    raise exception 'public.merchant_order_payment_events does not have row level security enabled';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'merchant_order_payment_events') then
    raise exception 'public.merchant_order_payment_events carries a policy; it is reached through the service role only';
  end if;
  -- Select and insert, and nothing else: no update, no removal, no truncation. What
  -- Stripe said cannot be rewritten. The message names each privilege and who
  -- granted it, because the first version of this said only "more than select and
  -- insert" and the environment that refused it could not be inspected from here.
  select string_agg(grantee || ':' || privilege_type || ' (granted by ' || grantor || ')', ', ' order by grantee, privilege_type)
    into offending
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'merchant_order_payment_events'
     and (grantee in ('anon', 'authenticated')
          or (grantee = 'service_role' and privilege_type not in ('SELECT', 'INSERT')));
  if offending is not null then
    raise exception 'public.merchant_order_payment_events allows more than select and insert to the service role, or is reachable by anon/authenticated: %', offending;
  end if;
  offending := null;
  if has_table_privilege('service_role', 'public.merchant_orders', 'DELETE') then
    raise exception 'public.merchant_orders can be removed by the service role; an order is changed by state, never removed';
  end if;

  -- An order starts unpaid. A default of anything else would be a payment nobody made.
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'merchant_orders' and column_name = 'payment_state')
     is distinct from '''unpaid''::text' then
    raise exception 'merchant_orders.payment_state does not default to unpaid';
  end if;

  -- No card data, and no commission, on an order or its payment events.
  select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name) into offending
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('merchant_orders', 'merchant_order_payment_events')
     and (column_name like '%card%' or column_name like '%cvv%' or column_name like '%pan%'
          or column_name like '%payment_token%' or column_name like '%application_fee%'
          or column_name like '%commission%');
  if offending is not null then
    raise exception 'a storefront payment table carries %; card data is never stored and the shop pays no commission', offending;
  end if;

  -- The buyer's token is stored only as its hash.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'merchant_orders'
               and column_name in ('buyer_token', 'receipt_token', 'access_token')) then
    raise exception 'merchant_orders stores a raw buyer token; only its SHA-256 belongs here';
  end if;
end $$;
