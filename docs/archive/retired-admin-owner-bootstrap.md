> **Retired on 1 October 2026.** The operator console this describes was removed
> at the owner's instruction: 58 registered routes under `/admin` and
> `/api/admin`, the admin login and session, and the `requireAdmin` gate. Every
> path named below now answers 404, and
> `tests/the-operator-console-is-gone-and-so-is-its-bypass.test.js` keeps it that
> way. The business-owner controls that replaced the customer-facing part of this
> are at `/owner/administration`.
>
> Kept as history, in `docs/archive/` so nothing reads it as a current
> instruction. Do not follow the steps below.

# Owner Bootstrap

Use this only after the first real owner has signed in through Supabase Auth at least once.

## Required Order

1. Configure Vercel Supabase env vars.
2. Configure Supabase Auth redirect URLs.
3. Sign up or sign in with the owner email.
4. Confirm the user exists in Supabase Dashboard > Authentication > Users.
5. Copy `scripts/sql/bootstrap-owner-safe.sql`.
6. Replace `OWNER_EMAIL_HERE` with the real owner email.
7. Run the script in the Supabase SQL editor.
8. Run `scripts/sql/verify-owner-bootstrap.sql` with the same owner email.
9. Log out and back in.
10. Open `/app/admin` and confirm the dashboard unlocks.

## Safety Notes

- The script does not create an auth user.
- If the auth user is missing, it raises: `Create/sign in with this Supabase Auth user first, then rerun bootstrap.`
- The script does not use `ON CONFLICT`.
- The script fills required organization fields including `company_key` when that column exists.
- The script creates or updates an active `owner` organization membership.
- Do not run this for unverified emails.
- Do not create hidden admins.
- Do not disable RLS for bootstrap.

## Verification

Run `scripts/sql/verify-owner-bootstrap.sql` after bootstrap. The expected `bootstrap_status` is:

```text
ready
```
