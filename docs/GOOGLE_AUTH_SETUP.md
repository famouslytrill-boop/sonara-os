# Google Auth Setup

Google sign-in is a required SONARA production authentication method. The application uses Supabase Auth as the Google OAuth provider boundary and completes the login server-side with PKCE before issuing the same HttpOnly SONARA session cookies used by email/password login.

## Redirect chain

There are two different callbacks and they must not be swapped:

1. **Google Cloud -> Supabase Auth provider**
   `https://yqncsonkxgwhcxedgevk.supabase.co/auth/v1/callback`
2. **Supabase Auth -> SONARA application**
   `https://sonaraindustries.com/auth/callback`

SONARA never stores the Google Client ID or Client Secret in Vercel. Those credentials belong only in Supabase Authentication -> Providers -> Google.

## Google Cloud

1. Open the Google Cloud project used for SONARA Industries.
2. Configure the OAuth consent screen.
3. Create or open the OAuth 2.0 Web Client.
4. Add this exact Authorized redirect URI:
   `https://yqncsonkxgwhcxedgevk.supabase.co/auth/v1/callback`
5. Save.

## Supabase

1. Open Authentication -> Providers -> Google.
2. Enable Google.
3. Paste the Google OAuth Web Client ID and Client Secret.
4. Set the Site URL to `https://sonaraindustries.com`.
5. Add `https://sonaraindustries.com/auth/callback` to the allowed Redirect URLs.
6. For local development, also allow `http://localhost:5000/auth/callback`.
7. Save.

## SONARA behavior

- `GET /auth/google` verifies the live Supabase provider before starting OAuth.
- SONARA generates a PKCE verifier and keeps it only in a short-lived HttpOnly cookie.
- Supabase returns a one-time code to `/auth/callback`.
- SONARA exchanges the code server-side, then runs the resulting session through the existing two-factor checkpoint.
- Successful login uses the same access/refresh cookies and authorization middleware as password login.
- Unsafe external `next` URLs are discarded.
- Production deployment fails before migration/deploy if Supabase does not report Google enabled.

## Production proof

1. Confirm `/api/readiness` reports `services.googleOAuth = "configured"`.
2. Open `/login` and click **Continue with Google**.
3. Complete Google sign-in.
4. Confirm return through `/auth/callback`.
5. Confirm the browser lands on `/dashboard` or the requested safe SONARA path.
6. If the account has SONARA two-factor enabled, confirm the TOTP/recovery-code challenge appears before the session is issued.
7. Confirm the user appears in Supabase Auth Users.
