# Deployment Runbook

Primary domain: `sonaraindustries.com`

Vercel should build from the repository root.

## Vercel Settings

- Framework preset: Next.js
- Install command: `corepack enable && corepack prepare pnpm@11.1.1 --activate && pnpm install --frozen-lockfile`
- Build command: `pnpm run build`
- Output directory: Next.js default

## Required Production Checks

```bash
pnpm install --frozen-lockfile
pnpm audit --audit-level moderate
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run verify:legacy-copy
```

## Domain And SSL

- Add `sonaraindustries.com` to the production Vercel project.
- Configure DNS at the registrar.
- Wait for Vercel SSL provisioning.
- Confirm root and `www` redirect behavior.
- Confirm metadata and canonical URLs do not point to localhost.

## Manual Setup Required

- Add real Vercel env vars.
- Add real Supabase project URL and keys.
- Add real Stripe keys and price IDs.
- Configure Stripe webhook endpoint.
- Review legal pages with an attorney.
- Test live auth, checkout, and webhook handling before paid launch.
