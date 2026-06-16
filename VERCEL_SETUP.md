# Vercel Setup

Use Framework Preset: Other.

## Settings

- Root Directory: repository root
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`
- Output Directory: blank
- Development Command: `pnpm start`

The Express app is served through `api/index.js`, and `vercel.json` rewrites all traffic to `/api`.
