# Auth Setup

SONARA uses email-first Supabase Auth readiness in code. Google OAuth remains documented for later enablement.

## Required variables

- `AUTH_PROVIDER=supabase`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` server-only
- `PUBLIC_SITE_URL`

## Current code behavior

- `/login` and `/signup` render customer-safe account pages.
- `POST /auth/login` and `POST /auth/signup` return `setup_required` when Supabase is missing.
- No logged-in session is faked.
- `/logout` and `POST /auth/logout` are user-triggered only.

## Owner work

Enable Supabase email auth, configure production URLs, then smoke test account cookies/session handling before enabling account-gated workflows.
