# Admin Bootstrap

SONARA owner/admin status is granted server-side. Do not hardcode owner emails in public or client code.

## Required Env

- `SONARA_ADMIN_EMAILS`: comma-separated owner/admin emails.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Steps

1. Add the first owner email to `SONARA_ADMIN_EMAILS` in Vercel.
2. Redeploy the app.
3. Open `/signup`.
4. Create the first account with the matching email.
5. Complete email confirmation if Supabase requires it.
6. Sign in.
7. Visit `/auth/callback?next=/app/dashboard` if the app does not redirect automatically.
8. Confirm the dashboard shows an active workspace and owner role.
9. Verify Supabase tables have:
   - one `profiles` row for the auth user
   - one `organizations` row
   - one `organization_memberships` row with `role = owner` and `status = active`
10. Verify `/app/admin` and `/app/owner` unlock for the owner account.

## Safety

- Keep `SONARA_ADMIN_EMAILS` server-only.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Remove stale owner emails from Vercel when access should be revoked, then manage memberships in Supabase with audited admin workflows.
