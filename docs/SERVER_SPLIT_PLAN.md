# Splitting server.js

**Status:** in progress, in the background. 5,119 → 5,047 lines.

This runs alongside feature work and must never be the reason a release is
held. Every step leaves the tree shippable; the split can stop after any one of
them without leaving anything half-migrated.

## Why it is not simply a matter of moving code

44 `scripts/apply-*.cjs` generators mutate `server.js` in place. Between them
they anchor on **765 distinct strings** in the file — replacement targets,
`requireAnchor` assertions, `replaceBetween` boundaries. Move one of those and
the build breaks at `apply:runtime`, not at the diff.

That is not hypothetical. During the plain-language work,
`apply-catalog-helper-scope.cjs` reinserted a helper that had been edited in
place, leaving **two definitions of `catalogActions` in the same file**. The
file parsed. The tests passed. The later definition silently won, and the
change appeared to have been reverted by nothing.

So the rule is:

> Extract only what no generator anchors on, and prove it in the same commit.

`tests/server-split.test.js` gives an early warning: a generator that names an
extracted function must also open the module it moved to.

**That check is not sufficient, and it is important to know why.** Step 1 broke
`apply-growth-studio-public-positioning.cjs`, which never mentions
`productLandingActions` at all — it anchors on
`linkAction("/growth-studio/dashboard", "Open dashboard")`, a line *inside* the
function body. No amount of name matching sees that coming.

The authoritative check is empirical: run `pnpm run apply:runtime` twice and
confirm the tree is unchanged. `verify:generated` does this in CI. **Never skip
step 5 below on the grounds that the unit test passed.**

## The order

Ordered by risk, lowest first. Each step is its own commit and its own release.

| Step | What moves | Lines | Generators touching it | Status |
| --- | --- | ---: | ---: | --- |
| 1 | Product page definitions and action bars | 158 | 0 | **done** — `lib/sonara-product-pages.cjs` |
| 2 | Readiness computation (`getReadiness`, `getAdminEnvReadiness`, `buildDatabaseReadinessResult`) | ~135 | 3 | next |
| 3 | Domain module records (`buildDomainModuleRecord`) | ~61 | 0 | ready |
| 4 | Admin action bars and forms (`adminActions`, `contactForm`, `authForm`) | ~61 | 3 | ready |
| 5 | Billing and Stripe (`STRIPE_PLANS`, checkout, webhook) | ~600 | many | needs generator work first |
| 6 | Auth and sessions | ~700 | many | needs generator work first |
| 7 | Rendering shell (`layout`, `renderHomepageContent`) | ~250 | 26 | **do not attempt** until the homepage generator is retired |

Steps 5–7 are the bulk of the file and are gated on the generators, not on the
code. The honest sequence is to retire or rewrite the generators that own those
regions first; moving the code underneath them is the expensive way to find
that out.

## How to do one

1. Pick a function group with no generator references. Confirm it:
   `grep -l "<functionName>" scripts/apply-*.cjs` must return nothing.
2. Move it to `lib/sonara-<area>.cjs` as a factory that takes its dependencies.
   Helpers that generators anchor on — `linkAction`, `layout`, `brandCard`,
   `escapeHtml` — stay in `server.js` and are **injected**. This is the shape
   `routes/*.cjs` already uses.
3. Bind the factory near the top of `server.js`. Route registration runs at
   module load and receives these as dependencies; a `const` is not hoisted,
   and putting the binding where the functions used to sit throws
   `Cannot access '<name>' before initialization`. (Found the hard way in
   step 1.)
4. Add the module and its functions to `EXTRACTED` in
   `tests/server-split.test.js`.
5. Run, in this order, and do not skip the third:
   - `pnpm test`
   - `pnpm run build`
   - `pnpm run apply:runtime` twice, confirming the tree is unchanged the
     second time. This is what catches a generator quietly putting the old
     definition back.
6. Raise the line ceiling in `tests/server-split.test.js` only downward.

## What this is not

It is not a rewrite, a framework migration, or a change in behaviour. Nothing
below the extraction boundary changes. If a step needs a behaviour change to
work, it is the wrong step.
