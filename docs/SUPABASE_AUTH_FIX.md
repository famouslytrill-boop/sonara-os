# Supabase Auth Fix

## Live symptom

If signup shows `Failed to fetch` or Google OAuth redirects to a Supabase hostname that Chrome cannot resolve, treat the issue as production environment configuration until proven otherwise.

## Required Vercel value

`NEXT_PUBLIC_SUPABASE_URL` must exactly match the Supabase dashboard value at:

Supabase Project Settings -> API -> Project URL

Use the full `https://<project-ref>.supabase.co` URL. Do not paste an OAuth redirect URL, a dashboard URL, a REST endpoint path, or a guessed project hostname.

## Safety rules

- Do not hardcode the real Supabase URL in source code.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`.
- Browser auth may read only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server-only Supabase automation may use `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, and `SUPABASE_DB_PASSWORD` only from hosting or CI secrets.

## Diagnostic behavior

The web shell reports malformed, placeholder, missing, or unexpected Supabase public URLs with:

`Supabase public URL is misconfigured. Check NEXT_PUBLIC_SUPABASE_URL in Vercel.`

This diagnostic never prints anon keys, service-role keys, tokens, or database passwords.

## Owner verification

1. Open Supabase Project Settings -> API.
2. Copy the Project URL.
3. Paste it into Vercel as `NEXT_PUBLIC_SUPABASE_URL`.
4. Confirm `NEXT_PUBLIC_SUPABASE_ANON_KEY` is present.
5. Confirm Supabase Auth redirect URLs include:
   - `https://<production-domain>/auth/callback`
   - `https://<production-domain>/reset-password`
   - `https://<production-domain>/app/settings/security`
6. Redeploy from Vercel after saving environment variables.

## Local auth redirects

For local Windows testing, use the same route paths on localhost:

- `http://localhost:5173/auth/callback`
- `http://localhost:5173/reset-password`
- `http://localhost:5173/app/settings/security`

Google OAuth, email magic links, and password recovery remain setup-gated until Supabase provider settings and redirect URLs are verified.

## Google OAuth `invalid_client`

If Google shows `Error 401: invalid_client` or `The OAuth client was not found`, verify the Google OAuth client in Google Cloud Console:

- Client type must be `Web application`.
- Authorized JavaScript origins must include the production app origin.
- Authorized redirect URI must be `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`.
- Google Client ID and Client Secret must be configured in Supabase Auth -> Providers -> Google.
- Keep `NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY=false` until the provider has been verified.
