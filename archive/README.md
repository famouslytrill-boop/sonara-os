# Archived source trees

These directories are not part of the deployed application. They were moved here
on 2026-07-27 as HIGH-3 of `docs/audits/2026-07-27-ENGINEERING_AUDIT.md`.

Nothing here is deleted — `git log --follow` still works on every file.

## What is here, and why it moved

| Directory | Was |
|---|---|
| `frontend/` | Separate frontend tree |
| `my-app/` | Separate app tree |
| `packages/` | Workspace-style package tree |
| `src/` | Config, lib, and engine modules in TypeScript |
| `sonara-industries/` | Parallel project tree, including its own `supabase/` state |

The deployed application is the Express server at the repository root
(`server.js` + `routes/*.cjs` + `lib/*.cjs`), served through `api/index.js`.
Verified at the time of the move:

- Neither `next` nor `typescript` is a dependency, so none of this compiles.
- `vercel.json` sets `"framework": null` and rewrites `/(.*)` to `/api`.
- The deployed runtime imports **zero** `.ts` files.
- Nothing executed by CI referenced any of these directories.

Keeping them in place made the repository misleading: searches returned dead
code, and the tree implied a Next.js application that is not deployed.

## What did NOT move, and why

`app/`, `components/`, `utils/*.ts`, `types/*.ts`, and the `.ts` files under
`lib/` are still in place, because two CI tests execute them:

- `tests/brand-routes.test.mjs` asserts brand copy inside `app/*.tsx` and
  `components/entities/EntityDashboardShell.tsx`.
- `tests/launch-readiness.test.mjs` transpiles and imports `lib/supabase.ts`,
  several `lib/sonara/**/*.ts` modules, `utils/*.ts`, and
  `app/api/stripe/checkout/route.ts`.

Those tests pass, but they assert on code that is **not deployed**. The brand
copy that actually ships lives in `server.js` and `lib/sonara-brand-registry.cjs`;
the Stripe path that actually runs is in `server.js`. So this is a false-assurance
problem, not a coverage problem — deleting the tests would remove a signal that
was never real, and moving the files without addressing the tests would just
relocate it.

Resolving that is a coverage decision rather than a file move, so it was left
out of this change deliberately. See HIGH-3 in the audit.

## Scripts that reference archived paths

These are **not invoked by CI** and were verified as such before the move. They
will not find their targets until their paths are updated or they are retired:

- `scripts/validate-infrastructure.mjs` (`packages/web/src`, `src`)
- `scripts/verify-db-infrastructure.mjs` (`sonara-industries/supabase/migrations/...`)
- `scripts/verify-local-launch.mjs` (many `src/config/*.ts`, `src/lib/**`)
- `scripts/validate-sonara-full-infrastructure.mjs`

## Restoring something

```bash
git mv archive/<directory> <directory>
```

If you restore a tree with the intention of deploying it, note that it will
still not compile until `next` and `typescript` are added as dependencies and
the build is changed to produce something — `build` is currently
`node --check server.js`, a syntax pass.
