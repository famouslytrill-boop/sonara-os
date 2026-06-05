# Supabase Auth Setup

Browser auth must use only these public values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`NEXT_PUBLIC_SUPABASE_URL` must exactly match Supabase Dashboard > Project Settings > API > Project URL for the active project. It should look like `https://<project-ref>.supabase.co` and must not include `/auth/v1`, query strings, a stale project ref, or localhost in production.

Server-side admin operations use `SUPABASE_SERVICE_ROLE_KEY`. Keep that key server-only and never expose it in client code, docs, screenshots, or `NEXT_PUBLIC_*` variables.

## Vercel Production Values

- `NEXT_PUBLIC_SITE_URL=https://sonaraindustries.com`
- `NEXT_PUBLIC_APP_URL=https://sonaraindustries.com`
- `NEXT_PUBLIC_SUPABASE_URL=<Project Settings API Project URL>`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon public key>`
- `SUPABASE_SERVICE_ROLE_KEY=<server-only key>`

After changing auth env values in Vercel, redeploy production.

## Failure Diagnostics

If signup or OAuth returns `Failed to fetch`, check `NEXT_PUBLIC_SUPABASE_URL` first. If Chrome shows `DNS_PROBE_FINISHED_NXDOMAIN` for a `*.supabase.co` host, the Vercel production public URL is likely pointing at a stale or invalid Supabase project ref.
