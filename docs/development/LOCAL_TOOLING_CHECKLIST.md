# Local Tooling Checklist

Run from the repo root in Windows PowerShell.

```powershell
pnpm run check:local-dev
pnpm run check:local-tools
```

Required for basic repo work:

- Git: `git --version`
- Node 22: `node -v`
- pnpm: `pnpm -v`
- `package.json` present
- no `package-lock.json`
- `node_modules` present after `pnpm install --frozen-lockfile`

Recommended for provider-backed local launch testing:

- GitHub CLI: `gh --version`
- Docker Desktop: `docker --version`
- Docker Compose: `docker compose version`
- WSL2: `wsl -l -v`
- Supabase CLI: `supabase --version`
- Vercel CLI through pnpm: `pnpm dlx vercel login`
- Stripe CLI: `stripe --version`
- FFmpeg: `ffmpeg -version`
- Java/JDK for Android builds if needed: `java -version`

Warnings in the local tool check mean the local machine is not fully launch-test ready. They do not mean provider setup has been completed.
