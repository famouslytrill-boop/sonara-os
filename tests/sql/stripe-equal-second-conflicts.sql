-- Executed by scripts/verify-migration-replay.mjs against a disposable
-- PostgreSQL with all migrations applied, never against production.
-- These are real BEFORE UPDATE trigger results, not migration-text assertions.
begin;

insert into public.billing_subscriptions
  (provider, provider_subscription_ref, status, plan_slug, provider_customer_ref, provider_event_at, metadata)
values
  ('stripe','sub_same_second_terminal_probe','active','workspace_monthly','cus_probe','2026-01-02T00:00:00Z','{"workspace":"creator_studio"}'::jsonb);

-- Two changes in one Unix second. Cancellation must prevail regardless
-- of whether an active snapshot arrives as a retry after the cancellation.
update public.billing_subscriptions
  set status='canceled', provider_event_at='2026-01-02T00:00:00Z'
  where provider_subscription_ref='sub_same_second_terminal_probe';
update public.billing_subscriptions
  set status='active', provider_event_at='2026-01-02T00:00:00Z'
  where provider_subscription_ref='sub_same_second_terminal_probe';
select 'same_second_terminal_' || status from public.billing_subscriptions
  where provider_subscription_ref='sub_same_second_terminal_probe';

-- Terminal state must also block any newer-stamped resurrection.
update public.billing_subscriptions
  set status='active', provider_event_at='2026-01-03T00:00:00Z'
  where provider_subscription_ref='sub_same_second_terminal_probe';
select 'newer_stamped_terminal_' || status from public.billing_subscriptions
  where provider_subscription_ref='sub_same_second_terminal_probe';

-- A payment failure beats an indistinguishable-time access grant.
insert into public.billing_subscriptions
  (provider, provider_subscription_ref, status, plan_slug, provider_event_at, metadata)
values
  ('stripe','sub_same_second_failure_probe','active','workspace_monthly','2026-02-01T00:00:00Z','{"workspace":"creator_studio"}'::jsonb);
update public.billing_subscriptions set
  status='past_due', provider_event_at='2026-02-01T00:00:00Z'
  where provider_subscription_ref='sub_same_second_failure_probe';
update public.billing_subscriptions set
  status='active', provider_event_at='2026-02-01T00:00:00Z'
  where provider_subscription_ref='sub_same_second_failure_probe';
select 'same_second_failure_' || status from public.billing_subscriptions
  where provider_subscription_ref='sub_same_second_failure_probe';

-- A genuine later event can recover a nonterminal past_due subscription.
update public.billing_subscriptions set
  status='active', provider_event_at='2026-02-02T00:00:00Z'
  where provider_subscription_ref='sub_same_second_failure_probe';
select 'next_second_recovery_' || status from public.billing_subscriptions
  where provider_subscription_ref='sub_same_second_failure_probe';

-- Identical replay changes no privilege, and remains allowed.
insert into public.billing_subscriptions
  (provider, provider_subscription_ref, status, plan_slug, provider_event_at, metadata)
values
  ('stripe','sub_same_second_duplicate_probe','active','workspace_monthly','2026-03-01T00:00:00Z','{"workspace":"creator_studio"}'::jsonb);
update public.billing_subscriptions set
  status='active', plan_slug='workspace_monthly',
  metadata='{"workspace":"creator_studio"}'::jsonb,
  provider_event_at='2026-03-01T00:00:00Z'
  where provider_subscription_ref='sub_same_second_duplicate_probe';
select 'same_second_duplicate_' || status from public.billing_subscriptions
  where provider_subscription_ref='sub_same_second_duplicate_probe';

-- Ambiguous same-second workspace or plan change: quarantine, don't hand
-- privilege to whichever event happened to arrive last.
update public.billing_subscriptions set
  metadata='{"workspace":"growth_studio"}'::jsonb,
  provider_event_at='2026-03-01T00:00:00Z'
  where provider_subscription_ref='sub_same_second_duplicate_probe';
select 'workspace_collision_' || status || '_' ||
  coalesce(metadata->>'same_second_conflict','missing')
  from public.billing_subscriptions
  where provider_subscription_ref='sub_same_second_duplicate_probe';

-- A newer authoritative state can clear a *nonterminal* quarantine.
update public.billing_subscriptions set
  status='active', metadata='{"workspace":"creator_studio"}'::jsonb,
  provider_event_at='2026-03-02T00:00:00Z'
  where provider_subscription_ref='sub_same_second_duplicate_probe';
select 'workspace_recovery_' || status from public.billing_subscriptions
  where provider_subscription_ref='sub_same_second_duplicate_probe';

insert into public.billing_subscriptions
  (provider, provider_subscription_ref, status, plan_slug, provider_event_at, metadata)
values
  ('stripe','sub_same_second_plan_probe','active','workspace_monthly','2026-04-01T00:00:00Z','{}'::jsonb);
update public.billing_subscriptions set
  plan_slug='team_monthly', provider_event_at='2026-04-01T00:00:00Z'
  where provider_subscription_ref='sub_same_second_plan_probe';
select 'plan_collision_' || status from public.billing_subscriptions
  where provider_subscription_ref='sub_same_second_plan_probe';

-- An entitlement projection can be written by *different subscriptions*.
-- Its same-second disabled state must not become active just because a
-- different delivery arrived last. The subscription reader is authoritative.
insert into public.billing_entitlements
  (entitlement_key, status, source, provider_event_at, metadata)
values
  ('equal_second_probe','active','billing','2026-05-01T00:00:00Z',
   '{"provider_subscription_ref":"sub_a","workspace":"creator_studio"}'::jsonb);
update public.billing_entitlements set
  status='disabled', provider_event_at='2026-05-01T00:00:00Z'
  where entitlement_key='equal_second_probe';
update public.billing_entitlements set
  status='active', provider_event_at='2026-05-01T00:00:00Z'
  where entitlement_key='equal_second_probe';
select 'entitlement_same_second_' || status from public.billing_entitlements
  where entitlement_key='equal_second_probe';

update public.billing_entitlements set
  status='active', metadata='{"provider_subscription_ref":"sub_a","workspace":"creator_studio"}'::jsonb,
  provider_event_at='2026-05-02T00:00:00Z'
  where entitlement_key='equal_second_probe';
select 'entitlement_new_second_' || status from public.billing_entitlements
  where entitlement_key='equal_second_probe';

-- Cross-subscription active updates at the same second quarantine the
-- projection even if both source subscription statuses are active.
update public.billing_entitlements set
  status='active', metadata='{"provider_subscription_ref":"sub_b","workspace":"creator_studio"}'::jsonb,
  provider_event_at='2026-05-02T00:00:00Z'
  where entitlement_key='equal_second_probe';
select 'entitlement_collision_' || status || '_' ||
  coalesce(metadata->>'same_second_conflict','missing')
  from public.billing_entitlements
  where entitlement_key='equal_second_probe';

-- Original strictly older stamp defense still works.
update public.billing_subscriptions set
  status='canceled', provider_event_at='2025-01-01T00:00:00Z'
  where provider_subscription_ref='sub_same_second_duplicate_probe';
select 'older_event_kept_' || status from public.billing_subscriptions
  where provider_subscription_ref='sub_same_second_duplicate_probe';

rollback;
