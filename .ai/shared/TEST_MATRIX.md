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

## PR #23 and production evidence

- Final PR head `a108e19019604983b67e11dd5a727c119128d592`:
  - SONARA Industries CI: pass.
  - Dependency scan: pass.
  - Docker Image CI: pass.
  - Supabase repository migration/config validation: pass.
  - Vercel preview: ready.
- Merge commit `277c3bb6c58bfe29399265a0dae52830c02d1d99`:
  - PR merged successfully to `main`.
  - Vercel production status: success for the exact SHA.
- The first CI attempt exposed assertions tied to the superseded duplicate manifest and legacy icon contract. The branch corrected the contract and assertions rather than skipping tests; the subsequent run passed.
- No hosted database apply, storage-policy mutation, provider setting, payment action, or billing/auth API change was part of the PWA release.

## Prior production evidence

- Main merge `4dccd10994656573ce18adcc4e4b30805cbac3f1`: main CI, dependency, Docker, Vercel production, route smoke, and recorded runtime-error inspection passed.
- Production database remains last verified at 39 applied migrations; repository migrations 40/41 remain pending approved application.

## Browser evidence boundary

- Existing multi-viewport redesign and focused preference browser evidence remains recorded in the reports directory.
- PWA installation, update prompting, offline fallback, private-route non-interception in a live browser, and physical vibration still require reproducible post-merge browser/device proof before they can be called production-verified.
