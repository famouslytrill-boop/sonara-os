# Vercel Deployment Fix

## What Failed

The local Vercel CLI deploy failed during upload with repeated `Error: Upload aborted`, `Error: An unexpected error occurred!`, and `MaxListenersExceededWarning` messages. Local package installation, lint, typecheck, and build checks pass, so the failure is most likely a Vercel CLI upload instability or oversized local upload context rather than a Next.js build failure.

## Package Manager

This repo uses pnpm. Do not use npm for install or deploy preparation.

Evidence:

- `package.json` declares `packageManager: pnpm@11.1.1`.
- `pnpm-lock.yaml` is the committed lockfile.
- `package-lock.json` should not exist.
- CI and local verification commands use pnpm.

Using npm can create a conflicting `package-lock.json` and may fail dependency resolution against a dependency tree that was selected and locked by pnpm.

## Recommended Deployment Path

Use the GitHub-connected Vercel Dashboard deployment first. The branch is already synced, and dashboard redeploy avoids the local CLI upload path that failed.

1. Go to the Vercel project `sonara-os`.
2. Open **Deployments**.
3. Select the latest deployment or commit.
4. Click **Redeploy**.
5. Disable build cache if the option is available.
6. Watch build logs for the first real error.

## Correct Vercel Settings

- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm run build`
- Framework Preset: Next.js
- Output Directory: default / blank
- Environment Variables: configure in Vercel Dashboard; do not commit secrets.

## CLI Fallback

Use this only if dashboard deployment still cannot be used:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run build
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

The `.vercelignore` file excludes dependency folders, local caches, generated build output, logs, local env files, and audit/archive docs that are not needed at runtime. It intentionally keeps source code, public assets, config files, `package.json`, `pnpm-lock.yaml`, `next.config.mjs`, and TypeScript configuration available for the Vercel build.

## Manual Follow-Up

- Confirm the Vercel project root points to this repo root.
- Confirm dashboard environment variables are configured for production.
- Use dashboard redeploy before retrying local CLI upload.
- If CLI upload still fails, run `vercel build --prod` locally and deploy with `vercel deploy --prebuilt --prod`.
