# Authentication Live Setup

SONARA uses Supabase Auth for login, signup, magic links, password reset, and OAuth redirects.

## Required Public Env

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These are browser-safe Supabase public values. They must match Supabase Project Settings -> API.

## Required Server Env

- `SUPABASE_SERVICE_ROLE_KEY`

This key is server-only and must never be imported by client components or emitted into public build artifacts.

## Live Checks

1. Add the public Supabase URL and anon key to Vercel.
2. Add server-only Supabase values to Vercel and GitHub Actions where required.
3. Configure Supabase Auth redirect URLs for production and preview domains.
4. Test `/signup`, `/login`, `/forgot-password`, `/reset-password`, and `/auth/callback`.
5. Create the first owner membership before relying on admin routes.
