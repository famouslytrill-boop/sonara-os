# Supabase Auth Fix

This repo now uses Supabase Auth for email link, email/password, Google OAuth, and phone OTP code paths. Code can start the flows, but provider setup must be completed in the Supabase dashboard before production login works.

## Likely Causes Of "Failed To Fetch"

- `NEXT_PUBLIC_SUPABASE_URL` is missing in the Vercel Production environment.
- `NEXT_PUBLIC_SUPABASE_URL` points at the wrong Supabase project ref.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing in the Vercel Production environment.
- The production app still points at localhost or an old Supabase project URL.
- Supabase Authentication URL Configuration does not include the Vercel production URL.
- Email/password signups are disabled in Supabase Auth providers.
- Browser/network/CORS failure blocks the Supabase auth request.
- Vercel was not redeployed after env vars changed.

The login UI now reports configuration and network failures without printing secret values. For malformed or unreachable-looking project URLs, the browser-facing message is:

```text
Supabase public URL is misconfigured. Check NEXT_PUBLIC_SUPABASE_URL in Vercel.
```

## Supabase Dashboard Steps

1. Open Supabase Dashboard.
2. Go to Project Settings -> API.
3. Copy the Project URL exactly.
4. In Vercel, set `NEXT_PUBLIC_SUPABASE_URL` to that Project URL. It should look like `https://<project-ref>.supabase.co` and must not include `/auth/v1`, query strings, or a stale project ref.
5. Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the public anon key from the same Supabase project.
6. Go to Authentication -> URL Configuration.
7. Set Site URL to the production Vercel URL.
8. Add redirect URLs:
   - `https://sonaraindustries.com/auth/callback`
   - `https://sonaraindustries.com/login`
   - `https://sonaraindustries.com/onboarding`
   - `http://localhost:3000/auth/callback` for local development
   - `http://localhost:3000/login` for local development
   - `http://localhost:3000/onboarding` for local development
9. Go to Authentication -> Providers.
10. Enable Email provider.
11. Confirm email/password signup is enabled.
12. If using Google login, enable Google provider.
13. If using phone login, enable Phone provider and configure an SMS provider.
14. Refresh Vercel env vars after dashboard changes.
15. Redeploy Vercel after env changes.

If Chrome shows `DNS_PROBE_FINISHED_NXDOMAIN` for a `*.supabase.co` host, the Vercel `NEXT_PUBLIC_SUPABASE_URL` value likely contains a stale or incorrect project ref. Replace it with the Project Settings -> API Project URL from the active Supabase project.

Do not hardcode the real Supabase project URL in source code. Keep it in Vercel environment variables and local untracked `.env.local` files.

## Required Vercel Env

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SONARA_ADMIN_EMAILS`

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in browser/client code.
