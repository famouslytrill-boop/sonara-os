# SONARA Launch Foundation

This layer keeps launch readiness focused on stability rather than new product surface area.

## Contracts

- Route definitions live in `packages/web/src/routes/route-manifest.ts`.
- Final export tiers live in `packages/web/src/exportTiers.ts`.
- Environment defaults and validation live in `packages/web/src/lib/env.ts`.
- Service-role secret access is guarded by `packages/web/src/lib/server-secrets.ts`.
- Workflow route requirements live in `packages/web/src/workflows/workflow-guards.ts`.

## Safety

- Provider Gateway requests pass through clone-language detection before routing.
- Service-role secrets must stay server-only and must never use a `NEXT_PUBLIC_` prefix.
- Media and sound readiness remain optional and user-activated.
- Launch readiness checks are UI-only until backend services are configured.
