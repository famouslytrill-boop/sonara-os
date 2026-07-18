# ADR-0008: Deployment

Status: Accepted

## Decision

Use Vercel for the current customer web deployment: `pnpm install --frozen-lockfile`, `pnpm run build`, output `packages/web/dist`, `/api/*` functions, and SPA fallback to `/index.html`. GitHub is the primary source/CI; GitLab may be a non-conflicting mirror/secondary pipeline.

## Consequences

- Do not change Vercel root/output/routing without parity and rollback evidence.
- Docker/Rancher are reserved for workers/heavy services unless a new ADR changes the web runtime.
- Deployment status requires live commit verification, not local inference.

