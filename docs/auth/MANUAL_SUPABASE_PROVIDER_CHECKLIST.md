# Manual Supabase Provider Checklist

## Before enabling the app flag

- `NEXT_PUBLIC_SUPABASE_URL` matches Project Settings -> API -> Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is configured.
- Site URL is configured.
- Redirect URLs are configured.
- Google provider is enabled.
- Google Client ID is saved.
- Google Client Secret is saved.
- Localhost redirect testing is complete.
- Production redirect testing is complete.

Only after this is complete should `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` be set to
`true`.
