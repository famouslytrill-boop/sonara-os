-- Executed only in the disposable migration replay database.
begin;
insert into public.organizations(id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Generation probe A'),
  ('10000000-0000-4000-8000-000000000002', 'Generation probe B');
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000003');
insert into public.billing_subscriptions(organization_id, provider, provider_subscription_ref, plan_slug, status, current_period_end, metadata)
values ('10000000-0000-4000-8000-000000000001', 'stripe', 'sub_generation_replay', 'all_three_monthly', 'active', now() + interval '10 days',
  jsonb_build_object('source', 'stripe_webhook', 'current_period_start', now() - interval '20 days'));
do $$
declare
  org uuid := '10000000-0000-4000-8000-000000000001';
  other_org uuid := '10000000-0000-4000-8000-000000000002';
  job uuid := '10000000-0000-4000-8000-000000000004';
  second_job uuid := '10000000-0000-4000-8000-000000000005';
  r jsonb;
  entry jsonb;
begin
  r := public.generation_usage(org, 'reserve', job, 300);
  if not (r->>'ok')::boolean or (r->>'remainingMinor')::numeric <> 200 then raise exception 'reserve failed: %', r; end if;
  r := public.generation_usage(org, 'reserve', second_job, 300);
  if r->>'code' <> 'included_generation_exhausted' then raise exception 'overspent: %', r; end if;
  r := public.generation_usage(org, 'reserve', job, 300);
  if not (r->>'ok')::boolean then raise exception 'retry failed: %', r; end if;
  r := public.generation_usage(other_org, 'release', job);
  if r->>'code' <> 'generation_job_not_owned' then raise exception 'cross tenant released: %', r; end if;
  insert into public.creator_generation_jobs(id, organization_id, user_id, capability, provider_key, status)
    values(job, org, '10000000-0000-4000-8000-000000000003', 'sound_effects', 'elevenlabs', 'running');
  r := public.generation_usage(org, 'release', job);
  if r->>'code' <> 'generation_job_still_active' then raise exception 'running hold released: %', r; end if;
  r := public.generation_usage(org, 'settle', job, 200);
  if r->>'code' <> 'generation_job_not_completed' then raise exception 'premature settlement: %', r; end if;
  update public.creator_generation_jobs set status = 'completed' where id = job;
  entry := jsonb_build_object('organization_id', org, 'actor_user_id', '10000000-0000-4000-8000-000000000003',
    'entry_kind', 'draw', 'capability', 'media_generation', 'unit', 'gpu_second', 'units', 40,
    'amount_minor', 200, 'cost_minor', 100, 'margin_minor', 100, 'idempotency_key', 'generation:' || job);
  r := public.generation_usage(org, 'settle', job, 200, entry);
  if not (r->>'ok')::boolean then raise exception 'settlement failed: %', r; end if;
  r := public.generation_usage(org, 'settle', job, 200, entry);
  if not (r->>'alreadyRecorded')::boolean then raise exception 'settlement retry failed: %', r; end if;
  if (select count(*) from public.usage_credit_ledger where organization_id = org) <> 1 then raise exception 'duplicate charge'; end if;
  r := public.generation_usage(org, 'status');
  if (r->>'remainingMinor')::numeric <> 300 or (r->>'reservedMinor')::numeric <> 0 then raise exception 'double counted: %', r; end if;
  -- A plan change with an overlapping period cannot reset consumed usage.
  update public.billing_subscriptions set metadata = metadata || jsonb_build_object('current_period_start', now() - interval '1 day')
    where provider_subscription_ref = 'sub_generation_replay';
  r := public.generation_usage(org, 'status');
  if (r->>'remainingMinor')::numeric <> 300 then raise exception 'plan change reset allowance: %', r; end if;
  r := public.generation_usage(org, 'reserve', second_job, 100);
  r := public.generation_usage(org, 'release', second_job);
  r := public.generation_usage(org, 'status');
  if (r->>'reservedMinor')::numeric <> 0 then raise exception 'failed hold not released: %', r; end if;
  update public.billing_subscriptions set current_period_end = now() - interval '1 second' where provider_subscription_ref = 'sub_generation_replay';
  r := public.generation_usage(org, 'reserve', second_job, 100);
  if r->>'code' <> 'subscription_period_unavailable' then raise exception 'expired subscription used: %', r; end if;
  update public.billing_subscriptions set plan_slug = 'all_three_annual', current_period_end = now() + interval '364 days',
    metadata = jsonb_build_object('source', 'stripe_webhook', 'current_period_start', now() - interval '1 hour')
    where provider_subscription_ref = 'sub_generation_replay';
  r := public.generation_usage(org, 'status');
  if (r->>'allowanceMinor')::numeric <> 6000 then raise exception 'annual allowance wrong: %', r; end if;
  if has_function_privilege('anon', 'public.generation_usage(uuid,text,uuid,numeric,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.generation_usage(uuid,text,uuid,numeric,jsonb)', 'execute') then raise exception 'client can mutate budget'; end if;
end $$;
select 'generation_reserves_settles_and_isolates';
rollback;
