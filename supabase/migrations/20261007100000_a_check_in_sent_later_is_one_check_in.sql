-- A check-in sent later is still one check-in.
--
-- Field staff check in where the signal is worst: a basement plant room, a
-- rural job, a lorry park. public/sonara-check-in.js said "nothing was
-- recorded" when the request failed, which was true and left the person with
-- no record of having been there.
--
-- The browser now keeps a check-in it could not send and sends it when the
-- connection returns (public/sonara-offline-queue.js). That makes the same
-- check-in arrive more than once in ordinary use -- a send that reached the
-- server but whose answer was lost is retried -- so the server has to be able
-- to tell a repeat from a second visit. It cannot do that from the row: two
-- check-ins at the same place a minute apart are two check-ins.
--
-- So the device names each one. `client_event_id` is a UUID generated on the
-- device when the button is pressed, sent with every attempt, and unique per
-- organization. A repeat is ignored by the database rather than by a read and a
-- decision, which two concurrent retries would race.
--
-- Null for every check-in recorded before this and for any client that does
-- not send one; nulls are distinct in a unique constraint, so they never
-- collide with each other.
--
-- `captured_at` already exists. The server now accepts it from the device,
-- within a window, so a check-in sent at five o'clock says it happened at two.
--
-- No customer data is modified by this migration.

alter table public.location_events
  add column if not exists client_event_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'location_events_client_event_once'
      and conrelid = 'public.location_events'::regclass
  ) then
    alter table public.location_events
      add constraint location_events_client_event_once unique (organization_id, client_event_id);
  end if;
end;
$$;

comment on column public.location_events.client_event_id is
  'Generated on the device when the check-in button is pressed and sent with every attempt. Unique per organization, so a check-in retried after a lost connection is recorded once. Null for rows from before 7 October 2026.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'location_events' and column_name = 'client_event_id'
  ) then
    raise exception 'public.location_events.client_event_id was not added';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'location_events_client_event_once' and contype = 'u'
  ) then
    raise exception 'location_events_client_event_once is missing; a resent check-in would be recorded twice';
  end if;
end;
$$;
