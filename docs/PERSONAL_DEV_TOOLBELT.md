# Personal Dev Toolbelt

This is the owner workstation checklist for SONARA Industries development. Install tools locally; do not paste production secrets into any utility, terminal transcript, AI prompt, or third-party collection.

## Recommended Tools

- Git: source control.
- GitHub CLI: repository status, pull requests, and workflow inspection.
- Node LTS: app scripts and package builds.
- npm: this checkout uses pnpm workspaces and `pnpm-lock.yaml`.
- pnpm: optional for adjacent repos that explicitly use pnpm.
- VS Code: editor and terminal.
- Docker Desktop: local container experiments only unless production hosting is explicitly approved.
- Vercel CLI: deployment inspection and environment management after owner approval.
- Supabase CLI: local database and migration work.
- Stripe CLI: webhook testing in test mode only.
- Bruno: local API request collections with no committed secrets.
- Python: utility scripts and analysis.

## Install Command Examples

Windows package managers vary by machine. Use trusted vendor installers or a managed installer such as winget where appropriate:

```powershell
winget install Git.Git
winget install GitHub.cli
winget install OpenJS.NodeJS.LTS
winget install Microsoft.VisualStudioCode
winget install Docker.DockerDesktop
winget install Vercel.VercelCLI
winget install Supabase.CLI
winget install Stripe.StripeCLI
winget install Bruno.Bruno
winget install Python.Python.3.12
```

Verify:

```powershell
git --version
gh --version
node --version
npm --version
docker --version
vercel --version
supabase --version
stripe --version
python --version
```

## Safety Rules

- Keep production deploys owner-approved.
- Keep service-role, Stripe, Supabase, AI provider, database, webhook, and token secrets out of public and client code.
- Use Stripe test mode for billing verification.
- Keep research repositories outside the SONARA Industries repo.
- Do not grant unknown tools production repository, cloud, Stripe, Supabase, or payout access.
