-- Stripe Event.created is an integer Unix second. Two distinct events for
-- the same subscription can share it, even though delivery order is arbitrary.
-- A strictly-less-than timestamp trigger prevents older-second replay but
-- allowed same-second updates to resurrect canceled/disabled access.
--
-- This migration deliberately replaces the existing trigger FUNCTION, not the
-- already-applied migration 20260903120000 or its trigger bindings. Updates
-- still run under the PostgreSQL row lock and therefore cannot race through a
-- read-then-write check in the application.
--
-- Policy: favor denying access where the provider order cannot be proved.
-- Terminal canceled subscriptions never regain access at the same timestamp.
-- An actual later-second provider event may restore nonterminal statuses.
-- For incompatible active-state snapshots (plan/customer/workspace/period),
-- quarantine the affected subscription as paused; the access reader only
-- accepts active/trialing subscription rows. Reconciliation against Stripe
-- must then emit a newer stamped event or use an approved operator process.
-- A competing shared entitlement projection is disabled on ambiguity; source
-- billing_subscriptions rows remain the access authority for recurring plans.
--
-- Important limitation: a first, uncontradicted event has no collision
-- evidence. This trigger does NOT prove Stripe delivery ordering, and
-- it cannot provide access immediately during conflicting same-second
-- transitions without potentially granting an outdated subscription plan.
--
-- Preserve the legacy null-stamp semantics for non-webhook writers. Webhook
-- ingestion independently requires a non-null Event.created before writes.
create or replace function public.sonara_reject_stale_provider_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_workspace text;
  new_workspace text;
  old_period text;
  new_period text;
begin
  if new.provider_event_at is null or old.provider_event_at is null then
    return new;
  end if;

  if new.provider_event_at < old.provider_event_at then
    return old;
  end if;

  -- A canceled Stripe subscription cannot be reactivated under the same
  -- provider subscription ID, even by an event stamped in a later second.
  -- Future purchases create a new subscription ID. Keep the prior row
  -- terminal unless an explicitly approved reconciliation bypasses this
  -- trigger under a separate controlled operation.
  if tg_table_name = 'billing_subscriptions' and
     old.status = 'canceled' and new.status <> 'canceled' then
    return old;
  end if;

  if new.provider_event_at = old.provider_event_at then
    old_workspace := coalesce(old.metadata->>'workspace', old.metadata->>'workspace_key');
    new_workspace := coalesce(new.metadata->>'workspace', new.metadata->>'workspace_key');
    old_period := old.metadata->>'current_period_end';
    new_period := new.metadata->>'current_period_end';

    if tg_table_name = 'billing_subscriptions' then
      -- Stripe cancellation is terminal for this subscription ID: another
      -- event in the same second cannot reenable that canceled subscription.
      if old.status = 'canceled' then
        return old;
      end if;
      if new.status = 'canceled' then
        return new;
      end if;

      -- A failure/restriction beats an access grant at an indistinguishable
      -- timestamp. If this suppresses a genuinely later paid recovery, the
      -- operator must reconcile from authoritative Stripe subscription state.
      if old.status in ('active', 'trialing') and
         new.status not in ('active', 'trialing') then
        return new;
      end if;
      if old.status not in ('active', 'trialing') and
         new.status in ('active', 'trialing') then
        return old;
      end if;

      -- Both snapshots look paid, but not for the same effective access.
      -- Quarantine instead of letting arrival order choose a tenant/plan.
      if old.status in ('active', 'trialing') and
         new.status in ('active', 'trialing') and (
           old.organization_id is distinct from new.organization_id or
           old.provider_customer_ref is distinct from new.provider_customer_ref or
           old.plan_slug is distinct from new.plan_slug or
           old_workspace is distinct from new_workspace or
           old_period is distinct from new_period or
           old.current_period_end is distinct from new.current_period_end
         ) then
        new.status := 'paused';
        new.metadata := coalesce(new.metadata, '{}'::jsonb) ||
          jsonb_build_object('same_second_conflict', true);
        return new;
      end if;
    elsif tg_table_name = 'billing_entitlements' then
      -- Entitlements are a derived projection keyed by (org, plan), possibly
      -- written by different subscriptions. Same-second disabled wins.
      if old.status = 'disabled' and new.status = 'active' then
        return old;
      end if;
      if old.status = 'active' and new.status = 'disabled' then
        return new;
      end if;
      if old.status = 'active' and new.status = 'active' and (
           old.metadata->>'provider_subscription_ref' is distinct from
             new.metadata->>'provider_subscription_ref' or
           old_workspace is distinct from new_workspace or
           old_period is distinct from new_period
         ) then
        new.status := 'disabled';
        new.metadata := coalesce(new.metadata, '{}'::jsonb) ||
          jsonb_build_object('same_second_conflict', true);
        return new;
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.sonara_reject_stale_provider_event() is
  'Rejects older Stripe event writes and fails closed on same-second conflicting access snapshots. Runs in existing BEFORE UPDATE row lock; provider reconciliation is required for ambiguous states.';
