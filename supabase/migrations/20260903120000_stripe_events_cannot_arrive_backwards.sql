-- A Stripe event that arrives late must not overwrite newer state.
--
-- Stripe does not guarantee delivery order. It says so plainly, and it retries
-- on any non-2xx and on a timeout, so out-of-order arrival is not an edge case
-- for a webhook endpoint -- it is a normal Tuesday.
--
-- Until this migration, `synchronizeBillingFromStripeEvent` upserted
-- `billing_subscriptions` on (provider, provider_subscription_ref) with
-- PostgREST's `resolution=merge-duplicates`, which is `on conflict do update`
-- and always overwrites. There was no version column and no comparison. The
-- last request to land won, whatever it said.
--
-- What that costs, concretely. A customer upgrades and then cancels within the
-- same minute, which is a thing people do. Two events fire. If the `updated`
-- carrying status=active is delivered after the `deleted` carrying
-- status=canceled, the row ends `active` -- and `lib/sonara-paid-access.cjs`
-- reads exactly that column, so a cancelled customer keeps paid access with
-- nothing anywhere recording that it happened. The reverse is worse to be on
-- the receiving end of: a stale `updated` lands after a reactivation, the row
-- says `canceled`, and somebody who has paid is locked out of their own
-- business records.
--
-- ## Why the guard is here and not in the application
--
-- The obvious fix is to read the row first and skip the write if what we hold
-- is newer. That is a read-then-write race, and the thing racing is two
-- deliveries of the same subscription arriving at once -- which is precisely
-- what Stripe's retry behaviour produces. Both requests read the old row, both
-- decide they are newer, both write.
--
-- PostgREST cannot express a conditional upsert; `merge-duplicates` has no
-- `where` clause to hang the comparison on. So the comparison goes where the
-- row lock already is. A `before update` trigger sees OLD and NEW inside the
-- same statement, under the same lock, and a stale write is discarded whatever
-- order the requests arrived in and however many are in flight.
--
-- ## The three cases, and why each behaves as it does
--
--   OLD is null    the row predates this column. Apply -- otherwise the first
--                  event after deploy is discarded and the row never recovers.
--   NEW is null    a caller that does not send the stamp. Apply. A silent
--                  no-op because a code path has not been taught a column yet
--                  is exactly the failure this migration exists to prevent.
--   equal          apply. Stripe stamps `created` in whole seconds, so two
--                  events in the same second cannot be ordered by it, and
--                  last-write-wins within one second is what already happens.
--
-- The explicit null branch below is **redundant today**, and this is written
-- down because the first draft of this comment claimed otherwise. `null < x`
-- and `x < null` both evaluate to null in SQL, which is not true, so both null
-- cases already fall through to `return new` without any branch at all. Deleting
-- the branch changes no behaviour, and the replay probe cannot tell the two
-- apart -- it was run with the branch removed and stayed green, which is how
-- this was found rather than reasoned about.
--
-- It is kept because the realistic way this breaks is not deletion. It is
-- somebody folding the two ifs into one and reaching for coalesce:
--
--     coalesce(new.provider_event_at, '-infinity') < coalesce(old..., '-infinity')
--
-- which reads as a tidy-up and silently discards every unstamped write. That
-- rewrite WAS applied here, and the probe caught it by name
-- (`unstamped_gave_past_due`). So the third marker guards the outcome against
-- the change that would really happen, and the branch states the intent the
-- coalesce version quietly drops.
--
-- Discarding by returning OLD means `updated_at` is not bumped either, so a
-- discarded write leaves no trace of having been considered. That is deliberate:
-- the row did not change, and a timestamp saying it did would be a third thing
-- reporting an event that had no effect.

alter table public.billing_subscriptions add column if not exists provider_event_at timestamptz;
alter table public.billing_entitlements add column if not exists provider_event_at timestamptz;

comment on column public.billing_subscriptions.provider_event_at is
  'When the provider stamped the event this row was last written from. A write carrying an older stamp is discarded by sonara_reject_stale_provider_event.';
comment on column public.billing_entitlements.provider_event_at is
  'When the provider stamped the event this row was last written from. A write carrying an older stamp is discarded by sonara_reject_stale_provider_event.';

-- security invoker, deliberately. This reads and returns the row the caller is
-- already updating and needs no privilege the caller does not have; a definer
-- function here would be a privilege the schema does not need and
-- scripts/verify-definer-exposure.mjs would rightly ask why it exists.
create or replace function public.sonara_reject_stale_provider_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.provider_event_at is null or old.provider_event_at is null then
    return new;
  end if;
  if new.provider_event_at < old.provider_event_at then
    -- Returning OLD performs the update with the values already stored, which
    -- is a no-op. The statement still reports success, because from the
    -- caller's side nothing went wrong: a duplicate or late delivery of an
    -- event whose state is already recorded is exactly the case where doing
    -- nothing is correct.
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists billing_subscriptions_reject_stale_event on public.billing_subscriptions;
create trigger billing_subscriptions_reject_stale_event
  before update on public.billing_subscriptions
  for each row execute function public.sonara_reject_stale_provider_event();

drop trigger if exists billing_entitlements_reject_stale_event on public.billing_entitlements;
create trigger billing_entitlements_reject_stale_event
  before update on public.billing_entitlements
  for each row execute function public.sonara_reject_stale_provider_event();
