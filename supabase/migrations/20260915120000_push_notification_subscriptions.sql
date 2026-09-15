-- User-controlled web push subscriptions. The server stores only browser subscription
-- material needed by a future VAPID sender; private VAPID credentials stay in hosting.
create table if not exists public.push_notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 1 and 2048),
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_notification_subscriptions_user_idx
  on public.push_notification_subscriptions(user_id, enabled);

alter table public.push_notification_subscriptions enable row level security;

grant select, insert, update, delete on public.push_notification_subscriptions to authenticated;
grant select, insert, update, delete on public.push_notification_subscriptions to service_role;

drop policy if exists "push_subscriptions_owner_all" on public.push_notification_subscriptions;
create policy "push_subscriptions_owner_all" on public.push_notification_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- service_role bypasses RLS by design; no broad policy is needed for the
-- server-only subscription gateway.
