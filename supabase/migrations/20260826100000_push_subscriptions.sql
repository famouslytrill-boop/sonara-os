-- Where a browser can be reached, so push has somewhere to send.
--
-- `lib/sonara-web-push.cjs` can encrypt and send a notification. Until this
-- table there was nowhere to keep a subscription, so nothing could call it --
-- which is this repository's recurring defect exactly: a capability that
-- exists, passes its tests, and no customer can reach.
--
-- ## What a subscription actually is
--
-- Three values the browser hands over when a person grants permission:
--
--   endpoint  -- a URL at the browser vendor's push service. It identifies the
--                browser installation and nothing else; it is not a customer
--                identifier and it is not transferable.
--   p256dh    -- the browser's public key. Payloads are encrypted to it, which
--                is why the push service relays a message it cannot read.
--   auth      -- a 16-byte secret mixed into the key derivation.
--
-- None of the three is a credential for anything of ours, and none identifies a
-- person. But together they are a capability to make somebody's phone buzz, so
-- they are organization-scoped and read only through the service role, like
-- every other tenant row here.
--
-- ## Why the endpoint is unique and how deletion works
--
-- A browser re-subscribing produces the same endpoint. Without a unique index,
-- a person who granted permission twice gets every notification twice, and
-- there is no moment at which anybody notices -- it looks like a keen product.
--
-- Deletion is not optional and not cosmetic. `send()` returns
-- `subscription_gone` on a 404 or 410 from the push service, which is the push
-- service saying this browser is gone for ever. That row must be deleted or the
-- application spends the rest of its life sending to nobody. The distinction
-- between that and a 429 is why `lib/sonara-web-push.cjs` reports them as
-- different codes rather than as one failure.
--
-- ## What is deliberately absent
--
-- **No last_notified_at, no delivery count, no read receipt.** A push service
-- does not tell you whether a notification was seen, so a column named for that
-- would hold a guess with an authoritative name. What is here is what the
-- browser gave us and when.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Who granted permission. Kept because a person revoking on one device should
  -- not silence their colleague's, and deliberately not used for access: the
  -- subscription belongs to the organization.
  created_by uuid,

  endpoint text not null,
  p256dh text not null,
  auth text not null,

  -- What this browser agreed to hear about. A single boolean would make
  -- "notify me when an invoice is paid" and "notify me about anything" the same
  -- consent, and AGENTS.md requires alerts to be explicitly user-controlled --
  -- which means controlled per kind, not per switch.
  topics text[] not null default '{}',

  -- The browser's own description, for a settings page that has to show a
  -- person which of their devices this is. Free text from the user agent, so it
  -- is never parsed and never trusted for a decision.
  label text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per browser installation. A re-subscribe updates rather than
-- duplicates; without this a person who granted permission twice hears
-- everything twice and nothing reports it.
create unique index if not exists push_subscriptions_endpoint_unique
  on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_organization_idx
  on public.push_subscriptions (organization_id);

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_endpoint_https;

-- A push endpoint is always https. Refusing anything else here means a row can
-- never carry a target the sender would have to decide about at send time.
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_https
  check (endpoint ~ '^https://');

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_keys_present;

-- The key lengths, checked as base64url text rather than after decoding.
-- A p256dh is a 65-byte uncompressed point (87 base64url characters) and an
-- auth secret is 16 bytes (22 characters). A row that fails this would fail at
-- encryption time instead, which is later, quieter, and per-message.
alter table public.push_subscriptions
  add constraint push_subscriptions_keys_present
  check (
    p256dh ~ '^[A-Za-z0-9_-]{80,90}$'
    and auth ~ '^[A-Za-z0-9_-]{20,26}$'
  );

-- ---------------------------------------------------------------------------
-- Row level security.
-- ---------------------------------------------------------------------------
--
-- Enabled with no policies, matching business_payment_accounts, scroll_sites
-- and public_booking_pages. Every route reading this table goes through the
-- service role and carries its own `organization_id` filter, which is the
-- tenant boundary here as everywhere else.
--
-- There must never be a public read. A list of these rows across tenants is a
-- list of every browser this product can make buzz.
alter table public.push_subscriptions enable row level security;

comment on table public.push_subscriptions is
  'Browsers that granted notification permission. Holds the endpoint and the two keys the Push API provides and nothing about a person. lib/sonara-web-push.cjs is the sender; a 404 or 410 from the push service means the row must be deleted.';
