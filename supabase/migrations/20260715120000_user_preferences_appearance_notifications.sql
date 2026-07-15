-- Additive account preference fields for appearance and notification controls.
-- No account rows, credentials, or provider values are seeded here.

alter table public.user_preferences
  add column if not exists appearance_mode text not null default 'system',
  add column if not exists notifications_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_preferences_appearance_allowed_chk'
      and conrelid = 'public.user_preferences'::regclass
  ) then
    alter table public.user_preferences
      add constraint user_preferences_appearance_allowed_chk
      check (appearance_mode in ('system','light','dark')) not valid;
  end if;
end $$;

comment on column public.user_preferences.appearance_mode is
  'User-selected system, light, or dark appearance. System is the default.';
comment on column public.user_preferences.notifications_enabled is
  'Master account-notification preference. Delivery still requires provider readiness.';
