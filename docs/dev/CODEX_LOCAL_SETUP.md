# Codex Local Setup

Codex CLI availability is a local workstation issue, not a SONARA runtime
dependency.

## Check local availability

Run these commands in a local terminal:

```powershell
where codex
codex --version
```

If the command is not recognized, install or repair Codex using the official
owner-approved installation path for the workstation. Do not add Codex as a
production app dependency and do not commit local tool tokens.

## Repo command standard

This repo is pnpm-only:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm run verify:all
```

Do not use npm, do not create `package-lock.json`, and do not use package
manager fallbacks to bypass dependency or security checks.
