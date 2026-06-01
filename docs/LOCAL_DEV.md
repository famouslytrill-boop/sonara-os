# Local Development

## Install

Use npm from the repository root:

```sh
pnpm install
```

For a clean CI-like install, use:

```sh
pnpm install --frozen-lockfile
```

## Run The Web Shell

```sh
pnpm run dev
```

This builds `packages/web` and serves `packages/web/dist` at `http://localhost:4173`.

## Validate

Run the standard stabilization checks:

```sh
pnpm run validate:infrastructure
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm test
```

Run the same full gate as CI:

```sh
pnpm run check
```

## Environment Variables

Use `.env.example` as the safe template. `NEXT_PUBLIC_*` variables are exposed to browser code. Server secrets such as `SUPABASE_SERVICE_ROLE_KEY` must stay server-only.

The repository should build locally without configured Supabase, Stripe, Docker, Qdrant, Python workers, or production provider credentials.

## Dependency Audit

Use:

```sh
pnpm audit --audit-level moderate
```

Do not run automated audit-fix commands without review. Forced audit fixes can downgrade or break core dependencies.
