# Local Windows Setup

This repo is optimized for Windows PowerShell with pnpm. Do not use npm, do not create `package-lock.json`, and do not paste provider secrets into chat, docs, browser code, or screenshots.

## 1. Refresh Winget

```powershell
winget source update
winget upgrade --all
```

## 2. Core Developer Tools

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id Microsoft.VisualStudioCode -e
gh auth login
```

## 3. Docker and WSL2

```powershell
wsl --install
wsl --update
winget install --id Docker.DockerDesktop -e
docker --version
docker compose version
wsl -l -v
```

Start Docker Desktop before running Supabase locally.

## 4. Node 22 and pnpm

Recommended Windows path uses Volta:

```powershell
winget install --id Volta.Volta -e
volta install node@22
volta install pnpm
node -v
pnpm -v
```

Corepack path if available:

```powershell
corepack enable
corepack prepare pnpm@11.1.1 --activate
pnpm -v
```

If Corepack is unavailable, use Volta-managed pnpm and keep `packageManager` as the repo source of truth.

## 5. Provider CLIs

```powershell
winget install --id Supabase.CLI -e
supabase login
pnpm dlx vercel login
winget install --id Stripe.StripeCLI -e
stripe login
winget install --id Gyan.FFmpeg -e
```

Optional Android tooling:

```powershell
winget install --id Google.AndroidStudio -e
winget install --id EclipseAdoptium.Temurin.21.JDK -e
java -version
```

## 6. Repo Setup

```powershell
pnpm install --frozen-lockfile
pnpm approve-builds
pnpm run check:local-dev
pnpm run check:local-tools
pnpm dev
```

## 7. Local Supabase

```powershell
supabase start
supabase db reset
pnpm run verify:supabase
```

Local Supabase must never replace production Supabase as the source of truth. Use it for migration validation, auth redirect testing, and local form flows only.

## 8. Verification Commands

```powershell
pnpm run check:auth-readiness
pnpm run check:auth-public-copy
pnpm run check:old-branding
pnpm run check:metadata-branding
pnpm run check:legacy
pnpm run check:public-claims
pnpm run check:env-safety
pnpm run typecheck
pnpm run lint -- --quiet
pnpm run build
pnpm run smoke:routes
pnpm run verify:all
```
