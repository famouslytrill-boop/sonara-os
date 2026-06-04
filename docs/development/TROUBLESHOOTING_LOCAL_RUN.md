# Troubleshooting Local Run

## pnpm is missing

```powershell
winget install --id Volta.Volta -e
volta install node@22
volta install pnpm
pnpm -v
```

## Corepack is missing

Use Volta-managed pnpm. Keep `packageManager` in `package.json` as the source of truth.

## Docker is not running

Start Docker Desktop, then run:

```powershell
docker --version
docker compose version
supabase start
```

## Supabase Auth says failed to fetch

Check:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL
pnpm run check:auth-readiness
```

`NEXT_PUBLIC_SUPABASE_URL` must be the Supabase Project Settings -> API -> Project URL. Do not hardcode production project URLs into source files.

## Google OAuth redirects to a bad host

Verify the project URL in Vercel and Supabase Auth provider settings. The browser should only read `NEXT_PUBLIC_SUPABASE_URL` for auth.

## package-lock.json exists

Delete it only after confirming it was accidental, then run:

```powershell
pnpm install --frozen-lockfile
```

## Local tools check reports warnings

Warnings usually mean optional provider tooling is not installed or `.env.local` is absent. Install the missing tool only if needed for the test you are running.
