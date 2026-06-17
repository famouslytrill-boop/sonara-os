# Google OAuth Setup

Google OAuth is deferred for the paid-launch verification pass. The app is Express/Node and keeps `/auth/callback` safe, but `/login` uses email/password Supabase Auth readiness only.

## Google Cloud Console

1. Create or open the production Google Cloud project.
2. Configure the OAuth consent screen.
3. Create an OAuth 2.0 Client ID for a web application.
4. Add Authorized JavaScript origins:
   - `https://sonaraindustries.com`
   - any Vercel preview domains that need login testing
5. Add Authorized redirect URIs:
   - `https://sonaraindustries.com/auth/callback`
   - matching preview callback URLs if needed

## Vercel variables

Set:

- `PUBLIC_SITE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## Supabase Auth provider

If Supabase Auth is used for persistent sessions, enable Google in Supabase Dashboard -> Authentication -> Providers and add the Google client ID and secret there as well.

## Current behavior

- `/login` renders email/password login and does not show Google OAuth.
- `/auth/callback` returns a disabled/setup response until the owner explicitly re-enables Google OAuth.
- `/logout` does not auto-clear users; it only reports that no persistent Express session is active.

Do not enable Google OAuth in production until Supabase Auth email sessions, owner/admin roles, and callback URL settings are smoke-tested.
