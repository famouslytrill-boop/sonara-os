# Supabase RLS Launch Review

Current migrations use `public.organization_members` as the active membership table. That is the repository equivalent of the organization membership dependency described in prior Supabase Preview failures.

Launch checks:

- `public.organizations` exists before organization policies reference it.
- `public.organization_members` exists before helper functions and member policies reference it.
- Private tenant tables enable RLS.
- Private tenant policies use `public.is_org_member` or `public.is_org_admin`.
- No private tenant policy uses broad `USING (true)`.
- Anonymous users cannot select tenant records.

Production migration review remains a human-required task.
