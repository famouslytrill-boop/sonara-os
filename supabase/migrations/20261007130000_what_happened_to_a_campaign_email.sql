-- What happened to a campaign email after the provider accepted it.
--
-- growth_campaign_sends records that Resend ACCEPTED a message: the request
-- succeeded and the provider will try to deliver it. That is where the Growth
-- chain stopped. Whether the message reached the inbox, bounced, was marked as
-- spam, was opened or had a link followed was never recorded, so a campaign's
-- page could say "accepted" and nothing after it, and "accepted" reads as
-- "delivered" to anybody who has not read this comment.
--
-- Resend reports each of those as a signed webhook. POST /api/webhooks/resend
-- (routes/sonara-email-receipt-routes.cjs) verifies the signature, finds the
-- send by the provider's message id, and inserts one row here per event.
--
-- ## Append-only, keyed on the provider's event id
--
-- `provider_event_id` is the webhook's `svix-id`, which stays the same when the
-- provider resends the same event. The unique constraint makes a resend a
-- duplicate rather than a second bounce. No update and no delete: a row says
-- the provider reported something, and that cannot be edited afterwards.
--
-- ## What is deliberately not kept
--
-- An open or click event from the provider carries the reader's IP address and
-- user agent, and a click carries the link. None of that is stored: the
-- campaign's question is whether people engaged, not who was where. The
-- recipient's address is kept because the send row already holds it and an
-- owner needs to know which address bounced.
--
-- ## The grant is not optional
--
-- Dated after 20260718064853_data_api_privilege_hardening, so the server's
-- access is declared rather than inherited. anon and authenticated get nothing:
-- RLS on, no policy, service_role select and insert only.
--
-- No customer data is modified by this migration.

create table if not exists public.growth_email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.growth_campaigns(id) on delete cascade,
  provider_message_id text not null,
  provider_event_id text not null,
  event_type text not null,
  -- For a bounce only: permanent (the address will not work) or transient (it
  -- might, later). Undetermined when the provider did not say.
  bounce_type text,
  email text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),

  constraint growth_email_delivery_events_event_once unique (provider_event_id),
  constraint growth_email_delivery_events_type_known
    check (event_type in ('delivered', 'delivery_delayed', 'bounced', 'complained', 'opened', 'clicked', 'failed', 'suppressed')),
  constraint growth_email_delivery_events_bounce_type_known
    check (bounce_type is null or (event_type = 'bounced' and bounce_type in ('permanent', 'transient', 'undetermined'))),
  constraint growth_email_delivery_events_email_present
    check (length(btrim(email)) > 0)
);

create index if not exists growth_email_delivery_events_org_campaign
  on public.growth_email_delivery_events (organization_id, campaign_id, event_type);

-- The webhook finds the send a receipt belongs to by the provider's message id.
-- Accepted rows only carry one, and only those can have a receipt.
create index if not exists growth_campaign_sends_provider_message
  on public.growth_campaign_sends (provider_message_id)
  where provider_message_id is not null;

alter table public.growth_email_delivery_events enable row level security;

grant select, insert on table public.growth_email_delivery_events to service_role;
revoke all on table public.growth_email_delivery_events from anon, authenticated;

comment on table public.growth_email_delivery_events is
  'Append-only record of what the email provider reported after accepting a campaign message: delivered, delayed, bounced, complained, opened, clicked, failed or suppressed. One row per provider event, unique on its id. Organization-scoped; service role only.';

notify pgrst, 'reload schema';

do $$
begin
  if to_regclass('public.growth_email_delivery_events') is null then
    raise exception 'public.growth_email_delivery_events was not created';
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'growth_email_delivery_events' and c.relrowsecurity) then
    raise exception 'public.growth_email_delivery_events does not have row level security enabled';
  end if;
  if exists (select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'growth_email_delivery_events'
               and grantee in ('anon', 'authenticated')) then
    raise exception 'public.growth_email_delivery_events is reachable by anon or authenticated';
  end if;
  if exists (select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'growth_email_delivery_events'
               and grantee = 'service_role' and privilege_type in ('UPDATE', 'DELETE')) then
    raise exception 'public.growth_email_delivery_events grants UPDATE or DELETE; what the provider reported cannot be rewritten';
  end if;
end $$;
