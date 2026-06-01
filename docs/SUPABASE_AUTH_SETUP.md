# Supabase Auth Setup

The static shell is ready for Supabase-backed auth, but this repository does not prove a live project is configured.

## Required

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` server-side only
- Auth redirect URLs for production and preview domains
- User profile creation path
- Organization row
- Active organization membership row

## Rules

- Do not expose service-role keys client-side.
- Do not unlock private app data without active membership.
- Keep anonymous users limited to public routes and safe public intake flows.
- Verify RLS policies against anonymous, member, admin, and non-member cases.
