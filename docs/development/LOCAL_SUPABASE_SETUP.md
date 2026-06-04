# Local Supabase Setup

Supabase remains the primary backend contract. Local Supabase is for development and migration validation only.

## Install and Login

```powershell
winget install --id Supabase.CLI -e
supabase login
supabase --version
```

## Start Local Services

```powershell
docker --version
docker compose version
supabase start
```

## Reset Local Database

```powershell
supabase db reset
pnpm run verify:db
pnpm run verify:supabase
```

## Auth Redirects

Configure these in Supabase Auth URL settings for local testing:

- `http://localhost:5173/auth/callback`
- `http://localhost:5173/reset-password`
- `http://localhost:5173/app/settings/security`

Production must use the real domain and must match Vercel `NEXT_PUBLIC_SITE_URL`.

## Required Environment Values

Local `.env.local` should contain local or preview-safe values only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- server-only values only when testing server-side scripts locally

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or public docs.
