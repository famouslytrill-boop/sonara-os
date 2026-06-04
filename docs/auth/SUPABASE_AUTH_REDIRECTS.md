# Supabase Auth Redirects

Configure redirects in Supabase Authentication settings before launch.

## Production

- Site URL: `https://sonaraindustries.com`
- Callback URL: `https://sonaraindustries.com/auth/callback`
- Password reset URL: `https://sonaraindustries.com/reset-password`

## Preview

Add approved Vercel preview domains when testing OAuth or magic links from preview deployments.

## Common Failure

If browser auth redirects to an old or malformed Supabase host, verify `NEXT_PUBLIC_SUPABASE_URL` in Vercel and confirm it matches Supabase Project Settings -> API Project URL. Do not hardcode the production URL into source code.
