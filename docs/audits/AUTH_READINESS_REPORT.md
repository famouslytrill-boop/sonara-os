# Auth Readiness Report

## Completed In Code

- Browser auth reads only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Supabase public URL diagnostics detect missing, malformed, placeholder, path-bearing, and unexpected production URL shapes.
- Login maps raw fetch failures to: `Supabase public URL is misconfigured. Check NEXT_PUBLIC_SUPABASE_URL in Vercel.`
- Google provider setup errors are mapped to a Supabase provider setup message.
- Default login completion now targets `/onboarding`.
- Server admin clients remain server-only.

## Provider Setup Still Required

- Confirm the active Supabase Project Settings > API Project URL.
- Set `NEXT_PUBLIC_SUPABASE_URL` in Vercel Production to that exact URL.
- Enable Google in Supabase Auth Providers.
- Add the Supabase Google callback URL to Google Cloud Authorized redirect URIs.
- Add SONARA production and local redirect URLs in Supabase.
- Redeploy after env changes.

## Launch Blockers

- Do not claim Google login is live until a real browser login succeeds.
- Do not claim owner/admin onboarding is complete until a real Supabase auth user exists and active owner membership is verified.
