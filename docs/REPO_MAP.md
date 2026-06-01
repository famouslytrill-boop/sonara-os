# Repository Map

## Package Manager

- Package manager: pnpm
- Lockfile: `pnpm-lock.yaml`
- Workspace pattern: `packages/*`
- Node requirement: `>=20`
- CI Node version: 22

## Framework And Runtime

This checkout is a TypeScript ES module workspace with a static DOM web shell. It is not currently organized as a root Next.js app.

- Browser shell source: `packages/web/src`
- Browser shell build output: `packages/web/dist`
- Package build output: each package writes to its own `dist` folder
- The root `build` script runs `node scripts/build.mjs`; this checkout does not use a root Next.js runtime.

## Packages

- `packages/core`: shared domain types, workflow state machine, and local stores.
- `packages/runtime`: event bus and runtime adapters.
- `packages/provider-gateway`: provider routing and music-style safety.
- `packages/export`: export provenance and bundle file contracts.
- `packages/routes`: billing and admin route helpers.
- `packages/spec-driven-build-system`: internal feature specs, implementation plans, task breakdowns, acceptance criteria, drift checks, and Codex prompt generation.
- `packages/ui`: shared SONARA brand identity, logo references, theme tokens, product accents, and approved backgrounds.
- `packages/web`: static web shell, route renderers, launch readiness, media readiness, SONARA infrastructure scaffolds, and report modules.

## Apps

No `apps/` directory is present in this workspace. The only runnable app surface is the static web shell in `packages/web`.

## Services

No separate service process, worker, queue, or API service directory is present.

## Database And Migrations

Supabase migrations are present under `supabase/migrations`:

- `supabase/migrations/0001_auth_organization_scaffold.sql`
- `supabase/migrations/0002_launch_mvp_core_tables.sql`

`pnpm run validate:migrations` validates the migration scaffolds. This does not replace applying migrations against a real Supabase database and manually checking RLS policies before enabling writes.

## Important Folders

- `.github/workflows`: CI quality gate.
- `docs`: architecture, roadmap, launch foundation, and stabilization documentation.
- `scripts`: workspace build, typecheck, smoke, validation, audit, and dev-server utilities.
- `specs`: internal spec-driven build starter specs.
- `supabase/migrations`: SQL migration files for organization-scoped launch MVP tables.
- `packages/*/src`: package source.
- `packages/*/dist`: generated build output.

## Root Scripts

- `pnpm run dev`: builds and serves the static web shell locally.
- `pnpm run validate:infrastructure`: validates required SONARA infrastructure scaffolds.
- `pnpm run typecheck`: runs package type gates and TypeScript.
- `pnpm run lint`: runs ESLint.
- `pnpm run build`: builds every package into `dist`.
- `pnpm test`: runs Vitest.
- `pnpm run smoke`: runs infrastructure, typecheck, build, and package smoke checks.
- `pnpm run check`: runs the full quality gate used by CI.

## CI

The current GitHub Actions workflow is `.github/workflows/ci.yml`.

- OS: `windows-latest`
- Node: 24
- Install: `pnpm install --frozen-lockfile`
- Gate: `pnpm run check`

No Docker workflow is present in this checkout.
