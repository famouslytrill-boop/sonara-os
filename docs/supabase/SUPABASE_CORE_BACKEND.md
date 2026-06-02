# Supabase Core Backend

Supabase is the source-of-truth backend for SONARA Industries launch data. Public browser code may use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY`, Supabase access tokens, project IDs used for CI, and database passwords remain server-only.

Core launch tables use organization-scoped records and RLS. Anonymous access is limited to explicitly safe public intake flows after those tables exist. Private reads require an authenticated user with an active organization membership.

This repository does not contain real Supabase credentials and does not claim the production project is configured.
