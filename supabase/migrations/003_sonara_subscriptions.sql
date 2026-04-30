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
