# Admin Bootstrap

SONARA owner/admin status is granted server-side. Do not hardcode owner emails in public or client code.

## Required Env

- `FOUNDER_EMAILS` and `ADMIN_EMAILS`: comma-separated owner/admin emails. `ADMIN_EMAIL` takes a single address.

> Corrected 19 August 2026. This file named `SONARA_ADMIN_EMAILS`, which no running
> file has ever read — it was declared only in the Next.js application under `app/`
> that could not build, and which was deleted. Setting it granted nothing, and
> nothing said so. `server.js` and `lib/sonara-readiness.cjs` read the three names
> above.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Steps

1. Add the first owner email to `FOUNDER_EMAILS` in Vercel.
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

- Keep `FOUNDER_EMAILS` and `ADMIN_EMAILS` server-only.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Remove stale owner emails from Vercel when access should be revoked, then manage memberships in Supabase with audited admin workflows.
