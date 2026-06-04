# First Owner Setup

The first owner account requires a human bootstrap step in Supabase. SONARA does
not provide a public endpoint that can grant owner access.

1. Sign up using the production `/signup` route or Supabase Auth dashboard.
2. Confirm the user exists in `auth.users`.
3. Run `supabase/bootstrap/check_auth_user_exists.sql` with a local placeholder
   replacement for the owner email.
4. Review `supabase/bootstrap/check_organization_schema.sql` so required
   organization columns are known before insert.
5. Run reviewed owner bootstrap SQL. This repo supports
   `public.organization_members` and `public.organization_memberships`
   compatibility.
6. Log out and log back in.
7. Verify `/app/admin` and `/app/admin/command-center` unlock for the owner.

If the Auth user does not exist, Supabase should report:

`Create/login with this email first using Supabase Auth, then rerun owner bootstrap.`

Do not expose the service-role key in browser code, support tickets, docs with
real values, prompts, screenshots, or client bundles.
