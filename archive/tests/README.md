# Retired test files

These two test files were moved here on 2026-07-28. They had **never run**.

## Why they never ran

`package.json` ran mocha over `"tests/**/*.js"`, which does not match `.mjs`.
Seven `.mjs` test files were therefore silently skipped while the suite
reported a passing run. The glob now matches `{js,mjs}`, so the remaining five
execute.

## Why these two could not simply be switched on

Both import TypeScript modules with extensionless specifiers:

- `entity-security-smoke.test.mjs` imports `lib/entities/operations.ts`, which
  imports `./config` — Node's ESM resolver cannot resolve either without a
  TypeScript loader.
- `launch-readiness.test.mjs` imports 34 TypeScript modules the same way,
  including `lib/supabase.ts`, `lib/sonara/**`, `utils/*.ts`, and
  `app/api/stripe/checkout/route.ts`.

`typescript` is not a dependency of this project, and the deployed runtime
imports zero `.ts` files. So these tests exercised code that does not ship,
using a loader that does not exist.

## What covers the same ground now

The behaviour they gestured at is covered against the code that actually runs:

| Retired assertion | Live coverage |
|---|---|
| Stripe checkout route | Billing path in `server.js`, traced end to end in `docs/audits/2026-07-27-MARKET_READINESS.md` |
| Supabase config | `verify:db`, `verify:supabase-contract`, and production Supabase verification in the deploy |
| Entity security helpers | RLS policies plus `tests/tenant-isolation.test.js` |
| Page/route availability | `tests/all-routes-smoke.test.js` — all 366 GET routes |

## Restoring one

If the TypeScript tree is ever revived, add `typescript` as a dependency, give
the imports explicit extensions, and move the file back to `tests/`.

## monorepo-smoke.test.mjs (retired 2026-07-28)

Asserted that `sonara-industries/package.json`, its `apps/web` and `apps/api`
manifests, and one of its migrations existed at the repository root. That tree
was archived earlier the same day, so the assertions were repointed at
`archive/`.

That repoint broke production deploys. `vercel-build` re-ran the test suite
inside Vercel's build environment, where `archive/` does not exist because
`.vercelignore` excludes it — correctly, since archived code should not be
uploaded. The test therefore passed locally and in CI, and failed only inside
the deployment, taking two production deploys down with it.

The test is retired rather than repaired: it verified the shape of a monorepo
that is not deployed, which the archive README already records.

`vercel-build` no longer runs the test suite either. Tests gate the release
twice before Vercel is ever invoked — in pull-request CI and at the "Run
release test suite" step of the controlled production deployment. Running them
a third time inside the deployment, against a deliberately different file set,
could only produce false failures of exactly this kind.
