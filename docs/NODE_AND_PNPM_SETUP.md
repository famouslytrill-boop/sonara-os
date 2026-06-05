# Node And pnpm Setup

SONARA uses pnpm only. Do not use npm, yarn, bun, `npm audit fix`, or create `package-lock.json`.

## Supported Runtime

- Node.js: `>=22 <27`
- Package manager: `pnpm@11.1.1` from `package.json`

## Windows PowerShell Setup

```powershell
node -v
pnpm -v
corepack enable
corepack prepare pnpm@latest --activate
pnpm install --frozen-lockfile
```

## Required Local Checks

```powershell
pnpm run typecheck
pnpm run build
pnpm run check:risky-features
pnpm run verify:email-env
```

If Node 22 is installed locally, do not require Node 26 until the dependency set and Vercel runtime are verified against it.
