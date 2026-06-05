# Auth Redirects Checklist

## Production

- Vercel domain: `https://sonaraindustries.com`
- Supabase Site URL: `https://sonaraindustries.com`
- Supabase Redirect URLs:
  - `https://sonaraindustries.com/auth/callback`
  - `https://sonaraindustries.com/login`
  - `https://sonaraindustries.com/onboarding`

## Local Development

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/login`
- `http://localhost:3000/onboarding`

## App Defaults

- Login completion defaults to `/onboarding`.
- Explicit `next` or `redirect` query parameters are allowed only when they are same-origin relative paths.
- Unsafe external redirects and protocol-relative paths are ignored.

## Manual Verification

1. Open `/login`.
2. Submit an email sign-in link.
3. Use Google sign-in after provider setup.
4. Confirm `/auth/callback` redirects to `/onboarding` or the requested safe relative `next` path.
5. Confirm no raw Supabase JSON, service-role markers, or secret values appear in the browser.
