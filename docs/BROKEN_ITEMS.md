# Broken Items

This file records unresolved issues found during the repository truth-check pass. These are not masked as successes.

## B-001: Dependency audit reports moderate advisories

Status: resolved in the pnpm live-readiness pass.

Command:

```sh
pnpm audit --audit-level moderate
```

Result: passed with no known vulnerabilities after removing the unused Next.js dependency path from the pnpm lockfile.

Previous affected packages/advisories:

- `brace-expansion` `5.0.2 - 5.0.5`: moderate DoS advisory.
- `postcss` `<8.5.10` through `next`: moderate XSS advisory.
- `next` `9.3.4-canary.0 - 16.3.0-canary.5`: depends on vulnerable `postcss`.
- `ws` `8.0.0 - 8.20.0`: moderate uninitialized memory disclosure advisory.

Important note: do not run package-manager audit auto-fix commands without explicit dependency review.

Resolution: the static DOM shell does not require root Next.js. The unused dependency path was removed and `pnpm audit --audit-level moderate` now passes.

## B-002: Vitest/Node localStorage warning appears during tests

Status: unresolved, non-blocking.

Command:

```sh
pnpm test
```

Result: passed, but emitted repeated warnings:

```text
Warning: `--localstorage-file` was provided without a valid path
```

Recommended fix: investigate the Vitest and Node 24 interaction in a dedicated test tooling PR. Do not remove tests or suppress warnings without understanding the cause.

## B-003: Supabase migrations were validated but not applied locally

Status: unresolved, environment-dependent.

Files:

- `supabase/migrations/0001_auth_organization_scaffold.sql`
- `supabase/migrations/0002_launch_mvp_core_tables.sql`

Result: `pnpm run validate:migrations` passed. No live local Supabase database was started or migrated during this pass.

Recommended fix: in a dedicated database verification pass, start the local Supabase stack, apply migrations in filename order, and verify RLS policies manually before enabling writes.

## B-004: Browser/mobile visual verification is not automated

Status: unresolved, non-blocking.

Result: requested major routes rendered through a one-off compiled DOM smoke, and package smoke checks cover route definitions. No dedicated browser/mobile visual regression runner is configured.

Recommended fix: add a lightweight browser smoke runner or visual/accessibility audit only after the launch route surface stabilizes.
