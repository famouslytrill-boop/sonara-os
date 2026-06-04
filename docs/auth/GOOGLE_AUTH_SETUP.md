# Google Auth Setup

Google sign-in is feature-gated until the Supabase provider is configured.

## Supabase

Open Authentication -> Sign In / Providers -> Google:

1. Enable Google.
2. Add the Google Client ID.
3. Add the Google Client Secret.
4. Save.

## Google Cloud OAuth

Authorized JavaScript origins:

- `https://sonaraindustries.com`
- `http://localhost:3000`

Authorized redirect URI:

- `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

## Vercel

After provider setup is complete:

```powershell
vercel env update NEXT_PUBLIC_AUTH_GOOGLE_ENABLED production
```

Set it to `true`, redeploy, then test `/login`.
