# Signal OS / SONARA One Workspace

This repository is a pnpm-managed TypeScript workspace for Signal OS and SONARA foundation modules. It is not a root Next.js application in this checkout; the browser shell is compiled from `packages/web/src` into `packages/web/dist`.

## Requirements

- Node.js 22 for CI parity.
- pnpm 11.1.1 via `packageManager`.
- `pnpm-lock.yaml` with no `package-lock.json`.

## Local Development

Install dependencies:

```sh
pnpm install
```

Run the static web shell locally:

```sh
pnpm run dev
```

The dev command builds `packages/web` and serves `packages/web/dist` at `http://localhost:4173`. Set `PORT=####` to use a different port.

## Validation

Run focused checks:

```sh
pnpm run validate:infrastructure
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm test
```

Run the full repository gate:

```sh
pnpm run check
```

`pnpm run check` runs lint, Prettier format verification, tests, typecheck, build, and smoke checks.

## Environment

Copy `.env.example` for local configuration when needed. `NEXT_PUBLIC_*` values are browser-exposed. Server secrets, including `SUPABASE_SERVICE_ROLE_KEY`, must stay server-only and must not be imported into browser code.

The workspace is designed to build without Supabase, Stripe, Docker, Qdrant, Python workers, or production provider credentials.

## Database Migrations

Supabase migrations live in `supabase/migrations` and should be applied in filename order:

1. `0001_auth_organization_scaffold.sql`
   - Creates `user_profiles`, `organizations`, `organization_members`, and `audit_logs`.
   - Enables foundational RLS for user, organization, member, and audit access.
2. `0002_launch_mvp_core_tables.sql`
   - Creates launch MVP tables for customer records, proof profiles, payment options, booking links, intake forms, offers, reviews, money path events, file records, external connections, feature flags, and approval events.
   - Enables RLS and organization-scoped access policies for sensitive tables.

Review migrations before applying them to any live Supabase project. Do not store raw card numbers, CVV, full bank credentials, or plain-text provider secrets.

## Safety Rules

- Do not add product features during stabilization work.
- Do not expose service-role secrets through `NEXT_PUBLIC_*`.
- Do not bypass Provider Gateway safety for AI/provider calls.
- Do not reintroduce retired export tiers.
- Do not run automated audit-fix commands or create `package-lock.json`.
- Do not hide validation failures; document unresolved blockers in `docs/KNOWN_ISSUES.md`.

## More Documentation

- `docs/REPO_MAP.md`: package, script, CI, and infrastructure map.
- `docs/LOCAL_DEV.md`: local setup and validation workflow.
- `docs/KNOWN_ISSUES.md`: current unresolved issues and warnings.
