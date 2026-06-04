# Owner Admin Bootstrap

Owner bootstrap remains a manual Supabase admin action until a reviewed
server-only workflow exists.

## Required order

1. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Sign up or create the first owner in Supabase Auth.
3. Confirm the email exists in `auth.users`.
4. Review the organization schema with
   `supabase/bootstrap/check_organization_schema.sql`.
5. Run reviewed bootstrap SQL from `supabase/bootstrap/ensure_owner_membership.sql`
   or generate a local draft with `pnpm exec node scripts/generate-owner-bootstrap-sql.mjs`.
6. Verify a single active owner membership exists.
7. Log out and back in before testing admin routes.

If the auth user is missing, the bootstrap must stop with:

`Create/login with this email first using Supabase Auth, then rerun owner bootstrap.`

## Safety rules

- Never disable RLS.
- Never grant owner to every user.
- Never expose the service-role key in browser code.
- Never commit a real owner email in SQL files.
- Keep audit records for sensitive owner/admin changes.
