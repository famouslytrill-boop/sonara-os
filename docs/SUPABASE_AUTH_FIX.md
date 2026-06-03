# Supabase Auth Fix

This repo now uses Supabase Auth for email link, email/password, Google OAuth, and phone OTP code paths. Code can start the flows, but provider setup must be completed in the Supabase dashboard before production login works.

## Likely Causes Of "Failed To Fetch"

- `NEXT_PUBLIC_SUPABASE_URL` is missing in the Vercel Production environment.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing in the Vercel Production environment.
- The production app still points at localhost or an old Supabase project URL.
- Supabase Authentication URL Configuration does not include the Vercel production URL.
- Email/password signups are disabled in Supabase Auth providers.
- Browser/network/CORS failure blocks the Supabase auth request.
- Vercel was not redeployed after env vars changed.

The login UI now reports configuration and network failures without printing secret values.

## Supabase Dashboard Steps

1. Open Supabase Dashboard.
2. Go to Authentication -> URL Configuration.
3. Set Site URL to the production Vercel URL.
4. Add redirect URLs:
   - `http://localhost:3000/**`
   - `https://*.vercel.app/**`
   - the exact current production Vercel URL
   - the custom domain URL when available
5. Go to Authentication -> Providers.
6. Enable Email provider.
7. Confirm email/password signup is enabled.
8. If using Google login, enable Google provider.
9. If using phone login, enable Phone provider and configure an SMS provider.
10. Refresh Vercel env vars after dashboard changes.
11. Redeploy Vercel after env changes.

## Required Vercel Env

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SONARA_ADMIN_EMAILS`

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in browser/client code.
