# Test Matrix

Updated: 2026-07-18 by Codex (Agent A)

## Required repository gates

- `pnpm install --frozen-lockfile`
- `pnpm audit --audit-level moderate`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
- `pnpm run verify:launch`
- `pnpm run test:docs`
- `git diff --check`

`verify:launch` runs deterministic runtime asset application, build, tests, client-secret scan, lint, route smoke, repository database verification, launch configuration/public-route registry verification, and OpenAPI drift verification.

## Contract and inventory gates

- `pnpm run verify:api`: every registered Express `/api` method/path must match `openapi/sonara.yaml` bidirectionally; operation IDs must be unique.
- `pnpm run verify:config`: launch configuration plus the required public route registry.
- `pnpm run verify:db`: migration inventory, launch baseline, canonical database/function contract, private storage declarations, and privilege assertions.
- `pnpm run verify:supabase-contract`: canonical schema/table/function/bucket inventory, service-only readiness contract, safe local config, and credential-free read-only MCP config.
- `pnpm run scan:client-secrets`: browser-delivered secret-pattern gate.

## PWA executable coverage

- `tests/pwa-contract.test.js` executes the shipped `public/sonara-experience.js` in a VM.
- Public pages register the service worker; `/dashboard`, `/account`, and `/admin` do not.
- Non-local insecure contexts do not register; localhost development may register.
- `/site.webmanifest` is canonical; `/manifest.webmanifest` redirects permanently.
- Every manifest and shortcut icon resolves through the Express app.
- The service worker leaves private application navigation outside its response path and excludes private/no-store/cookie-bearing/opaque responses from cache writes.
- The service-worker cache version remains synchronized with the rendered asset query token.

## Existing suites

Server routes, authentication/admin, pricing/legal truthfulness, billing/webhook behavior, frontend markers/tokens/preferences/service worker, route registry, SaaS workflows, formulas, ecosystem, launch readiness, entity security, creator music configuration, database privileges, and OpenAPI drift.

## Current branch evidence

- Implementation head `a616aa604b5e298ad19d24a060bc9da067b1d314`:
  - SONARA Industries CI: pass.
  - Dependency scan: pass.
  - Docker Image CI: pass.
  - Supabase repository migration/config validation: pass.
  - Vercel preview: ready.
- The first CI attempt exposed existing assertions tied to the superseded duplicate manifest and legacy icon contract. The branch corrected those assertions/contracts rather than skipping tests; the subsequent run passed.
- No hosted database apply, storage-policy mutation, provider setting, payment action, or production deployment was part of this PWA verification.

## Prior production evidence

- Main merge `4dccd10994656573ce18adcc4e4b30805cbac3f1`: main CI, dependency, Docker, and Vercel production checks passed.
- Production route smoke passed for the recorded public/auth/legal/product set.
- Production database remains last verified at 39 applied migrations; repository migrations 40/41 remain pending approved application.

## Browser evidence boundary

- Existing multi-viewport redesign and focused preference browser evidence remains recorded in the reports directory.
- PWA install/update/offline behavior and physical vibration still require reproducible post-merge browser/device proof before they can be called production-verified.
