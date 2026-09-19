# Auth Redirects Checklist

## Production

- SONARA origin: `https://sonaraindustries.com`
- Supabase Site URL: `https://sonaraindustries.com`
- Google Cloud Authorized redirect URI:
  - `https://yqncsonkxgwhcxedgevk.supabase.co/auth/v1/callback`
- Supabase application Redirect URLs:
  - `https://sonaraindustries.com/auth/callback`

## Local development

- Supabase application Redirect URL:
  - `http://localhost:5000/auth/callback`

## Redirect safety

- Google begins at `/auth/google`.
- OAuth completion defaults to `/dashboard`.
- An explicit `next` is accepted only as a same-origin relative path.
- Absolute external URLs, protocol-relative URLs, and backslash-based redirect tricks are discarded.
- The PKCE verifier is stored only in a short-lived HttpOnly cookie and never placed in the OAuth URL.
- A completed Google session passes through SONARA's existing two-factor gate before customer session cookies are issued.

## Verification

1. Confirm Supabase Auth settings report the Google provider enabled.
2. Open `/login`; confirm **Continue with Google** is present.
3. Start Google sign-in; confirm the browser is sent through Supabase to Google.
4. Complete sign-in.
5. Confirm return to `/auth/callback`, then `/dashboard` or the requested safe SONARA route.
6. Confirm `/api/readiness` reports Google as `configured`.
7. Confirm no OAuth verifier, provider token, service-role credential, or Google client secret appears in the page or URL.
