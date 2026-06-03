# Google Auth Setup

SONARA login and signup pages include a "Continue with Google" button using Supabase OAuth. It is code-ready but not live until Google and Supabase provider setup are complete.

## Google Cloud

1. Create or open the Google Cloud project for SONARA Industries.
2. Configure the OAuth consent screen.
3. Create an OAuth Web Client.
4. In Supabase Authentication -> Providers -> Google, copy the callback/redirect URI Supabase requires.
5. Add that URI to Google Cloud Authorized redirect URIs.
6. Store Google OAuth client ID and secret only in Supabase provider settings, not in the repo.

## Supabase

1. Enable Google provider.
2. Paste the Google client ID and client secret.
3. Confirm Site URL and redirect URLs match production and preview URLs.
4. Save provider settings.

## Smoke Test

1. Open production `/login`.
2. Click "Continue with Google".
3. Complete Google sign-in.
4. Confirm return to `/auth/callback`.
5. Confirm redirect into `/os` or the requested protected route.
6. Confirm Supabase Auth Users count increases.
7. Confirm `profiles`, `organizations`, `organization_memberships`, and `user_preferences` rows exist.

No additional Google scopes are requested by the app code.
