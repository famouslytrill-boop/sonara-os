# Vercel Environment Setup

Use Vercel as the source for production and preview environment values. Do not
commit `.env.local`.

## Inspect before changing

```powershell
vercel env ls production
vercel env ls preview
```

## Update existing values

Use update when a variable already exists:

```powershell
vercel env update NEXT_PUBLIC_SUPABASE_URL production
vercel env update NEXT_PUBLIC_AUTH_GOOGLE_ENABLED production
```

Use add only for new names. Use remove only when intentionally deleting a value.

## Pull local values

```powershell
vercel env pull .env.local --yes
```

`NEXT_PUBLIC_*` values are visible to browser users. This is expected for
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server-only
values such as provider keys, service-role keys, database URLs, and webhook
secrets must not use the `NEXT_PUBLIC_` prefix.
