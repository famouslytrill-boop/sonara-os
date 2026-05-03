# Dependency Audit and Launch Tooling

SONARA OS™ uses lightweight local scripts for launch checks.

## Scripts

```powershell
npm run check:software
npm run bootstrap:local
npm run audit:deps
npm run verify:launch
npm run launch:local-check
```

## `check:software`

Checks whether key local tools are available:

- Node.js
- npm
- Git
- Vercel CLI
- Stripe CLI
- Supabase CLI
- Python
- FFmpeg
- Ollama

Missing optional tools are warnings, not build failures.

## `bootstrap:local`

Installs project dependencies from `package-lock.json` using `npm ci`.

## `audit:deps`

Runs a moderate-level npm audit. It reports findings without running automatic fixes. Do not use `npm audit fix --force` without reviewing changes.

Current audit note:

- npm reports a moderate PostCSS advisory through Next.js.
- `npm view next version` currently reports `16.2.4`, matching the installed Next.js version.
- npm suggests `npm audit fix --force`, but that would install a breaking Next.js version according to the audit output.
- Do not force-downgrade or force-rewrite the dependency tree. Track the upstream Next.js patch and update normally when a safe release is available.

## `launch:local-check`

Runs:

1. software check
2. route/file verification
3. lint
4. production build

This is the safest pre-deploy check before pushing or redeploying.
