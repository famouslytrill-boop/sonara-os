# Google Auth Setup

Google sign-in is implemented as a Supabase Auth provider flow. This repository does not use NextAuth/Auth.js or a custom Google OAuth callback for the current production path.

## Required Vercel Variables

Public browser-safe variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`
- `NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY`

Do not add `GOOGLE_CLIENT_SECRET` to client code or any `NEXT_PUBLIC_` variable. Google Client ID and Client Secret belong in Supabase Auth provider settings, not in the browser.

## Supabase Settings

Open Supabase Dashboard -> Authentication -> Sign In / Providers -> Google:

1. Enable Google.
2. Add the Google OAuth Client ID.
3. Add the Google OAuth Client Secret.
4. Save the provider.
5. Confirm the Supabase Project Settings -> API Project URL exactly matches `NEXT_PUBLIC_SUPABASE_URL`.

The Supabase Google redirect URI must be:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

## Google Cloud Console Settings

Create an OAuth client with type `Web application`.

Authorized JavaScript origins:

- `https://sonaraindustries.com`
- `http://localhost:3000` for local development only

Authorized redirect URIs:

- `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

If a future NextAuth/Auth.js implementation is introduced, its redirect URI would be:

```text
https://<PRODUCTION_DOMAIN>/api/auth/callback/google
```

That is not the active auth path today.

## Vercel Release Gate

Keep Google disabled until the provider is verified:

```powershell
vercel env update NEXT_PUBLIC_AUTH_GOOGLE_ENABLED production
vercel env update NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY production
```

Set both to `true` only after the Supabase provider and Google Cloud OAuth client are verified. If `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` but `NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY=false`, the login button remains disabled and shows setup-required copy.
