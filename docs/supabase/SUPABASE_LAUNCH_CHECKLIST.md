# Supabase Launch Checklist

- Verify `NEXT_PUBLIC_SUPABASE_URL`.
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Add `SUPABASE_SERVICE_ROLE_KEY` only in server-side hosting secrets.
- Add GitHub Actions secrets for Supabase Preview if preview migrations should run.
- Rerun Supabase Preview.
- Confirm migrations are append-only and have no duplicate versions.
- Confirm RLS with anonymous, member, non-member, admin, and service-role cases.
- Confirm owner bootstrap user and organization membership.
- Confirm storage buckets are private by default.
- Confirm no service-role key appears in browser bundles.
