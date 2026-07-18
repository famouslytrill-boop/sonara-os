# Test Matrix

Updated: 2026-07-18T07:20:09Z by Codex (Agent A)

## Required repository gates

- `pnpm install --frozen-lockfile`
- `pnpm audit --audit-level moderate`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm test` (current baseline: 265 Mocha tests)
- `pnpm run build`
- `pnpm run verify:launch`
- `pnpm run test:docs`
- `git diff --check`

`verify:launch` now runs: deterministic runtime asset application, build, tests, client-secret scan, lint, route smoke, repository database verification, launch configuration/public-route registry verification, and OpenAPI drift verification.

## Contract and inventory gates

- `pnpm run verify:api`: 85 documented operations across 62 paths must exactly match the registered Express `/api` stack; operation IDs must be unique.
- `pnpm run verify:config`: launch configuration plus 124 required GET / 347 total registration public-route registry.
- `pnpm run verify:db`: 41 migration files, legacy 15-table launch checks, the canonical 71-table/10-function/3-schema contract, seven private storage bucket declarations, and Data API/readiness privilege assertions.
- `pnpm run verify:supabase-contract`: canonical inventory, historical table/function definitions, service-only readiness RPC, safe local config, private bucket limits, and read-only credential-free MCP config.
- `pnpm run scan:client-secrets`: browser-delivered secret-pattern gate.

## Existing suites

Server routes, auth/admin, pricing/legal truthfulness, billing/webhook behavior, frontend markers/tokens/service-worker version, route registry, SaaS upgrade behavior, formulas, ecosystem, launch readiness, entity security smoke, and creator music configuration.

## Browser evidence

- The committed frontend audit reports 124 canonical routes at 390 and 1440 pixels (248 checks), with zero application overflow, dead links, console errors, or retired-name leaks.
- The audit harness is not committed and is not currently reproducible from this repository. Treat it as dated local evidence, not production evidence.
- Preference repair browser proof: local Chrome at 390x844 and 1440x900 under system-dark resolved canonical `data-theme=dark`, computed the expected dark surface, showed no horizontal overflow/framework overlay/console warnings or errors, and preserved command-palette focus.
- Preference behavior is repository-reproducible through executable VM tests; physical-device vibration remains untested.

## Current-run results

- `pnpm install --frozen-lockfile`: pass; lockfile already current under pnpm 11.1.1.
- `pnpm audit --audit-level moderate`: pass; no known vulnerabilities.
- `pnpm run typecheck`: pass.
- `pnpm run lint`: pass.
- Targeted preference suites: pass; 36 tests covering pre-paint resolution, runtime theme changes, default-off/reduced-motion haptics, and positive opt-in control.
- Targeted Supabase privilege suite: pass; five tests covering opt-in default grants, anonymous denial, signed-in/service execution, locked search paths, and global-admin source.
- Rollback-only migration execution against local Supabase Postgres: pass, including migration-native privilege assertions; transaction rolled back and left no fixture state.
- `pnpm test`: pass; 262 tests.
- `pnpm run build`: pass.
- `pnpm run verify:launch`: pass, including 262 tests, secret scan, route smoke, 40/15/7 database declaration checks, 124/347 public route registry, and 85/62 OpenAPI drift check.
- `pnpm run test:docs`: pass.
- External `redocly lint openapi/sonara.yaml`: valid OpenAPI document; recommendation-level notices remain for public operations that intentionally have no modeled 4xx response and for the registered GET checkout method that intentionally returns 405 only.
- `git diff --check`: pass before coordination commit; rerun after lock release.

## Supabase contract current-run evidence

- `pnpm run verify:supabase-contract`: pass; 3 schemas, 71 tables, 10 functions, 7 private buckets, and 19 approval-gated agent/automation tables.
- Rollback-only PostgreSQL execution of migration 41: pass; snapshot returned 3/71/10 checks, every fixture table was available with RLS, and rollback removed the function.
- `pnpm exec supabase db lint --local --level error`: pass; no schema errors.
- `pnpm run verify:all`: pass; 265 tests, build, lint, client-secret scan, route smoke, 41-migration database gate, 124/347 route registry, and 85/62 OpenAPI gate.
- `pnpm run test:docs`: pass.
- Production apply: not run; required Supabase operator credentials are absent from this session.
