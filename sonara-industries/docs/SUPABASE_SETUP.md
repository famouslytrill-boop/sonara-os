# Supabase Setup

Required env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` server-only

Steps:
1. Create the Supabase project.
2. Enable Auth providers needed for launch.
3. Apply `supabase/migrations/010_sonara_industries_v3_rls.sql`.
4. Confirm helper functions: `current_user_id`, `is_org_member`, `has_org_role`, `has_company_access`, `has_scope`.
5. Create Storage buckets: `profile-images`, `trackfoundry-media`, `lineready-documents`, `noticegrid-imports`, `public-assets`.
6. Confirm RLS blocks cross-org and cross-product access.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
