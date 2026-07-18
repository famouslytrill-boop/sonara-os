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

`verify:launch` runs deterministic runtime asset application, build, tests, client-secret scan, lint, route smoke, repository database verification, launch configuration and public-route registry verification, and OpenAPI drift verification.

## Contract and inventory gates

- `pnpm run verify:api`: every registered Express `/api` method and path must match `openapi/sonara.yaml` bidirectionally; operation IDs must be unique.
- `pnpm run verify:config`: launch configuration plus the required public route registry.
- `pnpm run verify:db`: migration inventory, launch baseline, canonical database and function contract, eight operational indexes, private storage declarations, and privilege assertions.
- `pnpm run verify:supabase-contract`: canonical schema, table, function, operational-index, and bucket inventory; service-only readiness contract; safe local config; and credential-free read-only MCP config.
- `pnpm run scan:client-secrets`: browser-delivered secret-pattern gate.

## Operational database query coverage

- `tests/database-query-contract.test.js` runs the database query patch twice and requires idempotent success.
- Active organization and Business Builder compatibility membership lookups must use deterministic creation-time and UUID ordering before `limit=1`.
- Business Builder manager lookup must use deterministic creation-time and workspace ordering.
- Paid entitlement and subscription candidate filtering must occur in PostgREST by organization, allowed key, and active state.
- Unknown product entitlement mappings must fail closed before issuing an empty Data API `in.()` filter.
- The canonical operational-index list must contain eight unique indexes that reference canonical tables.
- The operational-index migration must create and assert every declared index, add no tables or grants, and never disable RLS.

## PWA executable coverage

- `tests/pwa-contract.test.js` executes the shipped `public/sonara-experience.js` in a VM.
- Public pages register the service worker; `/dashboard`, `/account`, and `/admin` do not.
- Non-local insecure contexts do not register; localhost development may register.
- `/site.webmanifest` is canonical; `/manifest.webmanifest` redirects permanently.
- Every manifest and shortcut icon resolves through the Express app.
- The service worker leaves private application navigation outside its response path and excludes private, no-store, cookie-bearing, and opaque responses from cache writes.
- The service-worker cache version remains synchronized with the rendered asset query token.

## Existing suites

Server routes, authentication and admin, pricing and legal truthfulness, billing and webhook behavior, frontend markers, tokens, preferences, service worker, route registry, SaaS workflows, formulas, ecosystem, launch readiness, entity security, creator music configuration, database privileges, and OpenAPI drift.

## PR #25 evidence

- Implementation head `41ddf5cc26a72c423e7ddbef06bb40a34a5941e3`:
  - SONARA Industries CI: pass.
  - `pnpm install --frozen-lockfile`: pass.
  - `pnpm audit --audit-level moderate`: pass.
  - Typecheck: pass.
  - Lint: pass.
  - Test suite, including database query contract regressions: pass.
  - Build: pass.
  - Supabase CLI and migration validation: pass.
  - Dependency scan: pass.
  - Docker Image CI: pass.
  - Vercel preview: success.
- No hosted database apply, storage mutation, provider setting, payment action, or RLS change was part of this verification.

## PR #23 and production evidence

- Final PR #23 head `a108e19019604983b67e11dd5a727c119128d592` passed SONARA Industries CI, dependency scan, Docker Image CI, Supabase repository migration and config validation, and Vercel preview.
- Merge commit `277c3bb6c58bfe29399265a0dae52830c02d1d99` merged successfully to `main`; Vercel production status succeeded for the exact SHA.
- The first PWA CI attempt exposed assertions tied to a superseded duplicate manifest and legacy icon contract. The branch corrected the contract and assertions rather than skipping tests; the subsequent run passed.

## Production evidence boundary

- Production database remains last verified at 39 applied migrations; repository migrations 40, 41, and 42 remain pending approved application.
- Existing multi-viewport redesign and focused preference browser evidence remains recorded in the reports directory.
- PWA installation, update prompting, offline fallback, private-route non-interception in a live browser, and physical vibration still require reproducible post-merge browser or device proof before they can be called production-verified.
