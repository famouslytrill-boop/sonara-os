<<<<<<< HEAD
create extension if not exists pgcrypto;

create table if not exists public.sonara_user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  tier text not null default 'free',
  status text not null default 'inactive',
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean default false,
  last_event_type text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sonara_user_subscriptions
  add column if not exists user_id uuid null,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists tier text not null default 'free',
  add column if not exists status text not null default 'inactive',
  add column if not exists current_period_start timestamptz null,
  add column if not exists current_period_end timestamptz null,
  add column if not exists cancel_at_period_end boolean default false,
  add column if not exists last_event_type text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists sonara_user_subscriptions_user_id_idx
  on public.sonara_user_subscriptions (user_id);

create index if not exists sonara_user_subscriptions_stripe_customer_id_idx
  on public.sonara_user_subscriptions (stripe_customer_id);

create index if not exists sonara_user_subscriptions_stripe_subscription_id_idx
  on public.sonara_user_subscriptions (stripe_subscription_id);

create unique index if not exists sonara_user_subscriptions_stripe_subscription_id_unique_idx
  on public.sonara_user_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists sonara_user_subscriptions_status_idx
  on public.sonara_user_subscriptions (status);

create index if not exists sonara_user_subscriptions_tier_idx
  on public.sonara_user_subscriptions (tier);

alter table public.sonara_user_subscriptions enable row level security;

comment on table public.sonara_user_subscriptions is
  'Stores Stripe subscription state for SONARA OS. Updates should be performed from server-only code using Supabase service role after Stripe webhook verification.';

comment on column public.sonara_user_subscriptions.stripe_subscription_id is
  'Stable Stripe subscription key used for idempotent webhook upserts.';

drop policy if exists "Users can read own subscription" on public.sonara_user_subscriptions;

create policy "Users can read own subscription"
  on public.sonara_user_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

-- Do not add anonymous write policies.
-- The Supabase service role bypasses RLS and must remain server-only.
-- Webhook updates should happen only after Stripe signature verification.
=======
create table if not exists public.sonara_user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier_id text not null default 'free',
  status text not null default 'inactive',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sonara_user_subscriptions_user_id_idx
  on public.sonara_user_subscriptions (user_id);

create index if not exists sonara_user_subscriptions_customer_idx
  on public.sonara_user_subscriptions (stripe_customer_id);

create index if not exists sonara_user_subscriptions_subscription_idx
  on public.sonara_user_subscriptions (stripe_subscription_id);

create index if not exists sonara_user_subscriptions_status_idx
  on public.sonara_user_subscriptions (status);

alter table public.sonara_user_subscriptions enable row level security;

drop policy if exists "Users can read own SONARA subscription" on public.sonara_user_subscriptions;
create policy "Users can read own SONARA subscription"
  on public.sonara_user_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage SONARA subscriptions" on public.sonara_user_subscriptions;
create policy "Service role can manage SONARA subscriptions"
  on public.sonara_user_subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

do $$
begin
  if to_regclass('public.sonara_projects') is not null then
    alter table public.sonara_projects add column if not exists user_id uuid references auth.users(id) on delete cascade;
    alter table public.sonara_projects add column if not exists project_type text not null default 'song';
    alter table public.sonara_projects add column if not exists genre text;
    alter table public.sonara_projects add column if not exists subgenre text;
    update public.sonara_projects set user_id = owner_id where user_id is null and owner_id is not null;
    create index if not exists sonara_projects_user_updated_idx
      on public.sonara_projects (user_id, updated_at desc);
  end if;

  if to_regclass('public.sonara_sound_assets') is not null then
    alter table public.sonara_sound_assets add column if not exists source_name text;
  end if;
end $$;
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
