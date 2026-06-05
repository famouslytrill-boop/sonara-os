# Google OAuth Setup

Google sign-in will show a setup message until the Supabase Google provider is enabled and callback URLs are aligned.

## Supabase Dashboard

1. Open Supabase Dashboard > Authentication > Providers > Google.
2. Enable Google.
3. Add the Google Client ID.
4. Add the Google Client Secret.
5. Save provider settings.

## Google Cloud

Add the Supabase callback URL to Google Cloud Authorized redirect URIs. The exact callback URL is shown in the Supabase Google provider panel and usually has this shape:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Do not use a stale project ref.

## SONARA Redirect URLs

Set Supabase Auth Site URL:

```text
https://sonaraindustries.com
```

Add redirect URLs:

```text
https://sonaraindustries.com/auth/callback
https://sonaraindustries.com/login
https://sonaraindustries.com/onboarding
```

For local development, add:

```text
http://localhost:3000/auth/callback
http://localhost:3000/login
http://localhost:3000/onboarding
```

## Expected App Behavior

If Google is not enabled, the login screen should show:

```text
Google sign-in is not enabled in Supabase yet. Enable Google in Supabase Auth Providers and add the callback URL.
```
