# OAuth Provider Setup

OAuth is provider-controlled and cannot be completed by repository code alone.

## Google OAuth

1. Create or verify the Google OAuth application.
2. Add the Supabase callback URL required by the Supabase dashboard.
3. Add client ID and secret inside Supabase provider settings.
4. Add production and preview redirect URLs.
5. Test login from the deployed domain.

## Safety Rules

- Do not expose OAuth client secrets in frontend code.
- Do not log provider tokens.
- Keep OAuth disabled until redirect URLs and provider settings are verified.
