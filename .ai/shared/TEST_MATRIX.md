# Test Matrix

Updated: 2026-07-18T06:15:00Z by Codex (Agent A)

## Required repository gates

- `pnpm install --frozen-lockfile`
- `pnpm audit --audit-level moderate`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm test` (current baseline: 255 Mocha tests)
- `pnpm run build`
- `pnpm run verify:launch`
- `pnpm run test:docs`
- `git diff --check`

`verify:launch` now runs: deterministic runtime asset application, build, tests, client-secret scan, lint, route smoke, repository database verification, launch configuration/public-route registry verification, and OpenAPI drift verification.

## Contract and inventory gates

- `pnpm run verify:api`: 85 documented operations across 62 paths must exactly match the registered Express `/api` stack; operation IDs must be unique.
- `pnpm run verify:config`: launch configuration plus 124 required GET / 347 total registration public-route registry.
- `pnpm run verify:db`: 39 migration files, 15 required launch tables, seven private storage bucket declarations.
- `pnpm run scan:client-secrets`: browser-delivered secret-pattern gate.

## Existing suites

Server routes, auth/admin, pricing/legal truthfulness, billing/webhook behavior, frontend markers/tokens/service-worker version, route registry, SaaS upgrade behavior, formulas, ecosystem, launch readiness, entity security smoke, and creator music configuration.

## Browser evidence

- The committed frontend audit reports 124 canonical routes at 390 and 1440 pixels (248 checks), with zero application overflow, dead links, console errors, or retired-name leaks.
- The audit harness is not committed and is not currently reproducible from this repository. Treat it as dated local evidence, not production evidence.
- After frontend preference repairs, Agent B must run a reproducible interaction loop covering theme activation and haptics no-op before opt-in and under reduced motion.

## Current-run results

- `pnpm install --frozen-lockfile`: pass; lockfile already current under pnpm 11.1.1.
- `pnpm audit --audit-level moderate`: pass; no known vulnerabilities.
- `pnpm run typecheck`: pass.
- `pnpm run lint`: pass.
- `pnpm test`: pass; 255 tests.
- `pnpm run build`: pass.
- `pnpm run verify:launch`: pass, including 255 tests, secret scan, route smoke, 39/15/7 database declaration checks, 124/347 public route registry, and 85/62 OpenAPI drift check.
- `pnpm run test:docs`: pass.
- External `redocly lint openapi/sonara.yaml`: valid OpenAPI document; recommendation-level notices remain for public operations that intentionally have no modeled 4xx response and for the registered GET checkout method that intentionally returns 405 only.
- `git diff --check`: pass before commit; rerun after lock release.
