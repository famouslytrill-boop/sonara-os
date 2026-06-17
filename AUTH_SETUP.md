# Auth Setup

SONARA uses email-first Supabase Auth readiness in code. Google OAuth is deferred and disabled in the normal login flow until owner configuration is complete.

## Required variables

- `AUTH_PROVIDER=supabase`
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` server-only
- `PUBLIC_SITE_URL` or `NEXT_PUBLIC_SITE_URL`
- `ADMIN_ACCESS_TOKEN` for temporary founder access
- `ADMIN_EMAILS` or `ADMIN_EMAIL` for future role authorization

## Current code behavior

- `/login` and `/signup` render customer-safe account pages.
- Login and signup password fields include a show/hide password control.
- `POST /auth/login` and `POST /auth/signup` return `setup_required` when Supabase is missing.
- No logged-in session is faked.
- `/logout` and `POST /auth/logout` are user-triggered only.
- Customer dashboard routes redirect browser traffic to `/login` until Supabase-backed sessions are configured and a bearer session token is available.
- Admin routes accept Supabase bearer sessions only when `public.user_roles` marks the user as `owner` or `admin`.
- Admin routes also keep temporary server-only `ADMIN_ACCESS_TOKEN` header/cookie access for owner break-glass operations.

## Owner role promotion

After the owner signs up, promote the owner account from Supabase SQL Editor. Replace the email value before running:

```sql
insert into public.user_roles (user_id, role)
select id, 'owner'
from auth.users
where email = 'OWNER_EMAIL_HERE'
on conflict (user_id, role) do nothing;
```

Do not place owner emails, tokens, or credentials in migrations.

## Owner work

Enable Supabase email auth, configure production URLs, apply migrations, promote the owner account, then smoke test customer sessions and role-gated admin access before replacing the temporary admin token gate.
