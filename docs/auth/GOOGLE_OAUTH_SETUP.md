# Google OAuth Setup

Google sign-in is required in production and is hosted by Supabase Auth. SONARA uses server-side PKCE and the existing HttpOnly customer session; it does not maintain a second Google session system.

## Google Cloud callback

The OAuth Web Client's Authorized redirect URI is the Supabase provider callback:

```text
https://yqncsonkxgwhcxedgevk.supabase.co/auth/v1/callback
```

Do **not** put `https://sonaraindustries.com/auth/callback` in Google Cloud as the provider callback. Google returns to Supabase first.

## Supabase provider

Open Supabase Dashboard -> Authentication -> Providers -> Google:

1. Enable Google.
2. Enter the Google Web Client ID.
3. Enter the Google Client Secret.
4. Save.

Google credentials live here only. Do not duplicate them into Vercel environment variables.

## SONARA application callback

Set the Supabase Site URL to:

```text
https://sonaraindustries.com
```

Allow this production redirect:

```text
https://sonaraindustries.com/auth/callback
```

For local development, also allow:

```text
http://localhost:5000/auth/callback
```

## Required production result

The release gate runs `scripts/verify-google-oauth-provider.mjs --require` against the production Supabase settings. If `external.google` is not enabled, deployment stops before database migration or Vercel deployment.

The live application must report `services.googleOAuth = "configured"`; `deferred` is no longer a valid runtime state.
