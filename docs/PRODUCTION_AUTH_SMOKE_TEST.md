# Production Auth Smoke Test

Run this after Vercel env vars, Supabase Auth URL configuration, and migrations are applied.

1. Open production `/login`.
2. Sign up with email/password.
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
9. Test password login.
10. Test Google login after Google provider setup.
11. Test phone OTP login after SMS provider setup.
12. Test logout.
13. Test protected `/os`.
14. Change language in `/app/settings`.
15. Refresh and confirm language persists.
16. Change unit system in `/app/settings`.
17. Refresh and confirm unit system persists.

Do not use production user data for smoke tests.
