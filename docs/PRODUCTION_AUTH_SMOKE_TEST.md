# Production Auth Smoke Test

Run this after Vercel env vars, Supabase Auth URL configuration, and migrations are applied.

1. Open production `/signup`.
2. Enter matching passwords, verify both Show password controls switch to Hide password and back, then submit.
3. If the UI reports a fetch/config failure:
   - verify `NEXT_PUBLIC_SUPABASE_URL`
   - verify `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - verify Supabase Site URL
   - verify Supabase redirect URLs
   - check browser console and Network tab
   - check Vercel env Production scope
   - redeploy after env changes
4. Confirm Supabase Auth Users count increases from 0 to 1.
5. Confirm `profiles` row exists.
6. Confirm `organizations` row exists.
7. Confirm `organization_memberships` row exists with owner/admin role.
8. Confirm `user_preferences` row exists.
9. Test password login and its Show password control.
10. In browser storage, confirm the access and refresh cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production; their values must not appear in page source, response JSON, or browser JavaScript.
11. Leave the session open beyond the access-token lifetime, refresh a protected page, and confirm the session rotates without exposing either token.
12. Test logout and confirm both customer cookies are removed.
13. Test Google login after Google provider setup.
14. Test phone OTP login after SMS provider setup.
15. Test protected `/dashboard` and all three product dashboards.
16. Change language in `/settings`.
17. Refresh and confirm language persists.

Do not use production user data for smoke tests.
