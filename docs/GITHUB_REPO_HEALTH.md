# GitHub Repository Health

Last reviewed: 2026-07-19

## Authoritative repository

- Repository: `famouslytrill-boop/sonara-os`
- Default branch: `main`
- Package manager: `pnpm@11.1.1`
- Primary runtime: Node.js 22 with Express
- Deployment: Vercel
- Container runtime: Docker
- Data platform: Supabase
- Billing provider: Stripe
- Email provider: Resend

The connected GitHub installation exposes one SONARA production repository. External open-source projects are governed references or controlled integration candidates. They are not silently copied into the production tree.

## Active redesign pull request

PR #38 on `codex/advanced-builder-redesign` contains the advanced-builder redesign and infrastructure hardening. The previous exact head passed the main application CI, Supabase preview validation, Docker image build, dependency scan, and production-connectivity checks.

The remaining deployment status was caused by Vercel's temporary build-rate limit. Production must remain unmerged until the current exact head receives a successful Vercel Preview.

## Corrected repository issues

1. The Dockerfile now runs the same deterministic `apply:runtime` and build chain as Vercel.
2. Docker CI now starts the image and verifies the health endpoint, redesigned homepage marker, and advanced-builder stylesheet.
3. A registry validator now checks external repository records, package source policy, pinned Python packages, and safety metadata.
4. A scheduled workflow checks registered GitHub repositories for availability.
5. Backend CI now checks installed package compatibility, audits the pinned Python dependency set, imports FastAPI, and confirms required routes.
6. The software requirements matrix now reflects the actual Express and pnpm production runtime.

## Required merge gate

Before merging, require the exact pull-request head to pass:

```bash
pnpm install --frozen-lockfile
pnpm audit --audit-level moderate
pnpm run verify:all
pnpm run test:docs
pnpm run verify:open-source

docker build -t sonara-os:verify .
docker run --rm -p 3000:3000 sonara-os:verify
```

Also require a READY Vercel Preview, clean review status, successful container verification, and production verification after merge.
