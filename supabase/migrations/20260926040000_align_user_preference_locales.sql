-- Keep the persisted account-language options aligned with the deterministic
-- interface catalogs. The replacement is repeatable and is validated before
-- the application offers German as a saved preference.

alter table public.user_preferences
  drop constraint if exists user_preferences_language_allowed_chk;

alter table public.user_preferences
  add constraint user_preferences_language_allowed_chk
  check (language in ('en-US', 'es', 'fr', 'de', 'pt-BR')) not valid;

alter table public.user_preferences
  validate constraint user_preferences_language_allowed_chk;
