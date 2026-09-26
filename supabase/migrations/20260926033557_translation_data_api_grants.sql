-- Declare each post-hardening table explicitly for the server-side Data API.
grant all privileges on table public.translation_records to service_role;
grant all privileges on table public.translation_glossary_terms to service_role;
