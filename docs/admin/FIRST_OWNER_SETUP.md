# First Owner Setup

The first owner account requires a human bootstrap step in Supabase.

1. Sign up using the production `/signup` route.
2. Copy the auth user ID from Supabase Authentication.
3. Create the initial `organizations` row.
4. Create an active `organization_memberships` row for the user with owner role.
5. Log out and log back in.
6. Verify `/app/admin` and `/app/admin/command-center` unlock for the owner.

Do not expose the service-role key in browser code to automate this step.
