# SONARA Current State Audit

Date: 2026-05-27
Branch: `feat/sonara-platform-redesign`
Base: `origin/main` at `3cebbe4`

## Repo Reality

- Package manager: pnpm, `packageManager` is `pnpm@11.1.1`.
- Framework: Next.js App Router, root app under `app/`.
- Workspace: root app plus `frontend` in `pnpm-workspace.yaml`.
- Backend folders present: `backend/`, `python/`, `services/`, and nested `sonara-industries/`.
- Database scaffolding present: `supabase/migrations/` and `infra/db/`.
- Prisma: no root `prisma/` folder found.
- Deployment config: `vercel.json`, `.vercelignore`, `next.config.mjs`, GitHub Actions.

## Commands Run

- `pnpm install --frozen-lockfile`: passed.
- `pnpm audit --audit-level moderate`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.

## Current Public Pages

Observed root App Router pages include:

- `/`
- `/about`
- `/account/billing`
- `/admin`
- `/brand`
- `/brand-system`
- `/contact`
- `/dashboard`
- `/docs`
- `/legal`
- `/lineready`
- `/login`
- `/noticegrid`
- `/pricing`
- `/privacy`
- `/settings`
- `/support`
- `/terms`
- `/trackfoundry`
- `/trust`

Production build currently generates 65 app routes.

## Old Public Copy Found

Public UI and metadata still reference old public product architecture:

- `TrackFoundry`
- `LineReady`
- `NoticeGrid`
- `Signal OS`
- `signal-os`
- `Independent systems. Shared infrastructure. Stronger markets.`

Important active locations:

- `app/page.tsx`
- `app/layout.tsx`
- `components/PublicShell.tsx`
- `components/BrandLegalFooter.tsx`
- `lib/brand/brand-system.ts`
- `lib/entities/config.ts`
- `lib/houseBrands.ts`
- `public/manifest.webmanifest`
- `app/trackfoundry/*`
- `app/lineready/*`
- `app/noticegrid/*`

## Old Routes Found

Active old product routes exist:

- `/trackfoundry`
- `/trackfoundry/app`
- `/trackfoundry/features`
- `/trackfoundry/how-it-works`
- `/trackfoundry/pricing`
- `/trackfoundry/resources`
- `/trackfoundry/security`
- `/trackfoundry/signup`
- `/lineready`
- `/lineready/app`
- `/lineready/features`
- `/lineready/how-it-works`
- `/lineready/pricing`
- `/lineready/resources`
- `/lineready/security`
- `/lineready/signup`
- `/noticegrid`
- `/noticegrid/app`
- `/noticegrid/features`
- `/noticegrid/how-it-works`
- `/noticegrid/pricing`
- `/noticegrid/resources`
- `/noticegrid/security`
- `/noticegrid/signup`

`next.config.mjs` redirects old legacy aliases into old names:

- `/music` -> `/trackfoundry`
- `/tableops` -> `/lineready`
- `/alertos` -> `/noticegrid`
- `/civicsignal` -> `/noticegrid`

These should redirect to the new current routes.

## Old Assets Found

Old public brand assets exist under `public/brand`:

- TrackFoundry icons/logos.
- LineReady icons/logos.
- NoticeGrid icons/logos.
- Manifest shortcuts for old products.

These should be replaced with SONARA Industries, Business Builder, Creator Studio, and Growth Studio assets, or moved to `docs/archive/`.

## Missing Or Incomplete Pages

Current public architecture is missing or incomplete for:

- `/business-builder`
- `/creator-studio`
- `/growth-studio`
- `/onboarding`
- `/app`
- `/app/dashboard`
- `/app/business-builder`
- `/app/creator-studio`
- `/app/growth-studio`
- `/legal/refund-policy`
- `/legal/acceptable-use`
- `/legal/cookie-policy`
- `/legal/accessibility`
- `/legal/security`
- `/legal/data-processing-addendum`
- `/legal/subprocessors`
- `/legal/ai-usage`
- `/legal/billing-terms`
- `/legal/service-levels`
- `/settings/notifications`

## Infrastructure And CI Risks

- `.github/workflows/dependency-scan.yml` uses pnpm correctly.
- `.github/workflows/sonara-industries-ci.yml` uses pnpm for the nested workspace.
- `.github/workflows/docker-image.yml` currently contains duplicate YAML content and must be repaired.
- Vercel build from repo root is compatible based on local `pnpm run build`.
- Stripe checkout/webhook routes exist and build.
- Supabase migrations exist, but they are oriented around older platform naming and need current SONARA scaffolding.

## Deployment Risks

- Public production UI does not match current company architecture.
- Old product pages are still buildable and linkable.
- Manifest and metadata still expose old names.
- Legal pages are incomplete for paid launch.
- Admin/app shells are not aligned with the current platform route structure.
- Supabase/Stripe require real dashboard configuration by a human before production usage.

## Human-Required Dashboard Tasks

- Add real Vercel environment variables.
- Add real Supabase project URL, anon key, service role key, project ID, and database password.
- Link Supabase and push reviewed migrations.
- Add real Stripe keys and price IDs.
- Configure the Stripe webhook endpoint.
- Test checkout and webhook handling in Stripe test mode.
- Review legal/policy pages with counsel before paid public launch.
- Connect domain and confirm SSL.
