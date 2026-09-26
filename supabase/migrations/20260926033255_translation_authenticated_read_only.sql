-- Authenticated users may read only through their membership-scoped RLS
-- policies. The service role remains the only writer for translation assets.
revoke all privileges on table public.translation_records, public.translation_glossary_terms
  from public, anon, authenticated;

grant select on table public.translation_records, public.translation_glossary_terms
  to authenticated;
grant all privileges on table public.translation_records, public.translation_glossary_terms
  to service_role;
