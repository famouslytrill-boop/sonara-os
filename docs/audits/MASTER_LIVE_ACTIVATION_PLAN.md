# Master Live Activation Plan

## Current repo status

- Branch: `sonara-one-full-project-update-v101`
- App type: static TypeScript workspace compiled from `packages/web/src`.
- Package manager target: pnpm only.
- Current public architecture in this checkout: SONARA Industries parent with Business Builder, Creator Studio, and Growth Studio product surfaces, plus Signal OS creative workflow routes for Create, Optimize, Release, and Scale.

## Existing scripts

- Core gates: `lint`, `format`, `test`, `typecheck`, `build`, `smoke`, `validate:migrations`, `validate:infrastructure`.
- Deployment and provider checks: `deployment:check`, `env:check`, `security:sync-check`, `paywall:check`, `github:update-watch`.
- Added/required live gates: `smoke:routes`, `check:legacy`, `check:public-claims`, `check:risky-features`, `check:env-safety`, `check-license-risk`, `check-provider-registry`, `check-technology-registry`, `check:github-radar`, `check:github-radar-risk`, `check:github-radar-secrets`, `check:auto-install-disabled`, `check:vercel-env-docs`, `check:live-readiness`, `verify:db`, `verify:all`.

## Existing workflows

- `.github/workflows/ci.yml`
- `.github/workflows/open-source-update-watch.yml`

Both must use pnpm, Node 22, pnpm cache, and frozen lockfile installs.

## Routes

- Public routes already include `/`, `/about`, `/pricing`, `/contact`, `/support`, `/help`, `/feedback`, `/security`, `/business-builder`, `/creator-studio`, and `/growth-studio`.
- Protected/app routes include `/app`, product app routes, admin command routes, deployment sync routes, and security center routes.
- Added readiness route targets: `/settings/readiness`, `/app/settings/readiness`, `/admin/email-readiness`, `/app/admin/email-readiness`, `/admin/owner-bootstrap`, `/app/admin/owner-bootstrap`.

## Migrations and RLS

- Existing migrations:
  - `supabase/migrations/0001_auth_organization_scaffold.sql`
  - `supabase/migrations/0002_launch_mvp_core_tables.sql`
- Current schema uses `organization_members` as the membership table name.
- RLS exists for organization-scoped MVP tables. Target Supabase application still requires human project verification.

## Missing setup blockers

- Production Supabase project and auth redirects must be verified.
- First owner user and active organization membership must be created.
- Vercel environment variables must be entered in the hosting project.
- Cloudflare/email DNS and inbox routing require provider verification.
- Stripe/Square/PayPal remain optional and provider-gated.
- Legal/license review is still required before public claims or third-party integrations are considered final.

## What can be completed without credentials

- pnpm workspace conversion.
- CI workflow consistency.
- Local build/typecheck/test/smoke gates.
- Static readiness pages and admin setup instructions.
- Public-copy, legacy, risky-feature, env-safety, provider, technology, and GitHub watcher checks.

## Owner/provider input required

- Provider secrets.
- DNS/email provider verification.
- Supabase/Vercel account setup.
- Payment provider setup.
- Final legal/license review.
- Final production approval, merge, and deploy.
