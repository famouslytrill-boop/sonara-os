# Known Issues

## Dependency audit

Command:

```sh
pnpm audit --audit-level moderate
```

Status: resolved in the pnpm live-readiness pass.

Notes:

- The root package now uses pnpm and `pnpm-lock.yaml`.
- The stale unused Next.js lockfile path was removed.
- `pnpm audit --audit-level moderate` passes with no known vulnerabilities.

Recommended next action: keep audit in CI and do not run automated audit-fix commands without dependency review.

## Test warning from Vitest/Node localStorage flag

Command:

```sh
pnpm test
```

Status: tests pass, warning remains.

Observed warning:

```text
Warning: `--localstorage-file` was provided without a valid path
```

Recommended next action: investigate the Vitest/Node 24 interaction in a dedicated test tooling PR. Do not mask the warning by removing tests.

## No database migrations are present

Status: resolved by migration stubs in `supabase/migrations`.

Current blocker: migrations were not applied locally because the Supabase local Postgres service is not running on `127.0.0.1:54322`, and Docker Desktop's Linux engine pipe is unavailable in this environment.

Commands attempted:

```sh
supabase migration list --local
supabase db lint --local
supabase status
```

Recommended next action: start Docker Desktop and Supabase local services, then apply migrations in filename order.

## Static web shell only

The runnable app surface in this checkout is the static DOM shell under `packages/web`. Files under `packages/web/src/app` are compiled as TypeScript package modules, not routed by a root Next.js application.

Recommended next action: keep the current static package build stable unless a separate framework migration is explicitly approved.

## Quality hardening follow-ups

Status: no blocking build issue found in the quality sprint.

Resolved in this pass:

- Nested routes now load root-relative `app.mjs` and `styles.css` assets from `packages/web/src/index.html`.
- The custom DOM router now renders a safe route error fallback instead of leaving a blank shell if a route renderer throws.
- `scripts/smoke-package.mjs` now smoke-checks major product, onboarding, pricing, security, and admin routes through the package entrypoint.

Remaining non-blocking items:

- No dedicated automated accessibility scanner is configured. Current checks are manual/code-review level: forms use labels, primary actions meet the existing 40px minimum target, and route error fallback uses `role="alert"`.
- Browser automation confirmed the major route pages render, but one form-save click verification timed out in the automation layer. The underlying localStorage save behavior is covered by `packages/web/src/onboarding.test.ts`.

Recommended next action: add a dedicated browser smoke runner or lightweight accessibility audit in a separate tooling PR if this static DOM shell remains the launch target.
