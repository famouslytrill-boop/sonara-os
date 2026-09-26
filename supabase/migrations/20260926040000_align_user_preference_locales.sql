-- Keep the persisted account-language options aligned with the deterministic
-- interface catalogs. Canonicalize historical short codes before applying the
-- strict supported-locale constraint.

alter table public.user_preferences
  drop constraint if exists user_preferences_language_allowed_chk;

-- The runtime accepts these legacy aliases. Store their canonical values so
-- existing preferences remain valid when the new constraint is validated.
update public.user_preferences
set language = case language
  when 'en' then 'en-US'
  when 'pt' then 'pt-BR'
  else language
end
where language in ('en', 'pt');

alter table public.user_preferences
  add constraint user_preferences_language_allowed_chk
  check (language in ('en-US', 'es', 'fr', 'de', 'pt-BR')) not valid;

alter table public.user_preferences
  validate constraint user_preferences_language_allowed_chk;
