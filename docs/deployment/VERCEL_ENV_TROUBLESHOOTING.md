# Vercel Environment Troubleshooting

## Signup fails with "Failed to fetch"

Check `NEXT_PUBLIC_SUPABASE_URL` in Vercel. It must match Supabase Project
Settings -> API -> Project URL exactly, using the format:

`https://<project-ref>.supabase.co`

Do not use dashboard URLs, OAuth callback URLs, REST paths, guessed hosts,
query strings, or fragments.

## Google sign-in disabled

Keep `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false` until the Supabase Google provider
is enabled and redirect URLs are configured. After provider setup, update the
Vercel variable to `true` and redeploy.

## Duplicate env variable errors

Use `vercel env update NAME production` when a value already exists. Do not keep
adding duplicate values.

## Secret safety

`NEXT_PUBLIC_*` variables are browser-visible. Never expose service-role keys,
OAuth client secrets, provider API keys, database URLs, or webhook secrets in
public variables or client-side code.
