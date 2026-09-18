# Node And pnpm Setup

Review by: 2027-04-22

SONARA uses pnpm only. Do not use npm, yarn, bun, `npm audit fix`, or create
`package-lock.json`.

## Supported runtime

| | version | why |
| --- | --- | --- |
| **Production / `engines.node`** | **`24.x`** | Vercel derives the serverless Node major from `engines.node`. There is no runtime pin in `vercel.json`, no `.nvmrc` and no `.node-version`, so this field *is* the production runtime. |
| **Every ordinary workflow** | 24 | `tests/the-runtime-ci-tests-is-one-production-may-run.test.js` asserts each non-compatibility workflow pins exactly 24, so CI cannot drift from production. |
| **Blocking compatibility** | 24 **and** 26 | `.github/workflows/node-runtime-compatibility.yml`, matrix `[24, 26]`, no `continue-on-error`. Node 26 reaches LTS on 2026-10-28, so it is tested ahead of that. |
| **Forward compatibility** | 27 | Prewired, manual, `continue-on-error: true`. Node 27 does not exist yet — its release is **2027-04-22** per `nodejs/Release`. |
| **Package manager** | `pnpm@11.1.1` | From `package.json`. |

**Do not widen `engines.node` to make a warning go away.** Running Node 26 prints

```
[WARN] Unsupported engine: wanted: {"node":"24.x"} (current: {"node":"v26.9.0"})
```

and that warning is correct and wanted: it is telling you the major you are
running is not the one production runs. Widening the field would change the
Vercel runtime, which is a production change. The compatibility workflow passes
`--config.engine-strict=false` for exactly this reason — it tests a newer major
without lying about the deployed one.

### What was actually verified on Node 26

Node **v26.9.0** (released 2026-09-16, not LTS) was installed locally on
18 September 2026, checksum-verified against
`https://nodejs.org/dist/v26.9.0/SHASUMS256.txt`, and the whole repository was
run under it:

- `pnpm run build` — passes
- `pnpm run typecheck` — 258 runtime files
- `pnpm run lint` — clean
- the full mocha suite — every test passing, with no skips introduced
- `pnpm run verify:launch` — **exit 0**, every command in the release chain

So Node 26 is not merely "expected to work". The previous version of this file
ended with *"If Node 22 is installed locally, do not require Node 26 until the
dependency set and Vercel runtime are verified against it."* The dependency set
is now verified. The **Vercel runtime** half is still open and is the owner's:
production stays on 24 until the host is confirmed for a newer major.

## Local setup

```powershell
node -v
pnpm -v
corepack enable
corepack prepare pnpm@11.1.1 --activate
pnpm install --frozen-lockfile
```

Install Node 24 to match production. If you are on a different major,
`pnpm install` still works but prints the unsupported-engine warning above, and
you are not testing what deploys.

## Required local checks

```powershell
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run verify:launch
```

`verify:launch` is the whole release chain and is what CI runs. The four before
it are the fast subset worth running while you work.

> This list used to name `pnpm run check:risky-features` and
> `pnpm run verify:email-env`. Neither is defined in `package.json`, so the
> setup document told a new developer to run two commands that do not exist.
> Corrected 18 September 2026, and
> `scripts/verify-doc-pnpm-scripts.mjs` now fails the release when any document
> names a `pnpm run` target that `package.json` does not define.

## Why this file carries a review date

The `Review by: 2027-04-22` line above is Node 27's release date from
`nodejs/Release`. On that date `pnpm run verify:stale-claims` will surface this
file, which is the point: the Node 27 lane in
`.github/workflows/node-runtime-compatibility.yml` is deliberately manual
*"until it exists"*, and nothing else in the repository would notice when it
does.
