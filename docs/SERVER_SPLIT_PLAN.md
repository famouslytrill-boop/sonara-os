# Splitting server.js

**Status:** in progress, in the background. 5,119 → 4,462 lines.

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

**That check is not sufficient, and it is important to know why.** It has now
been proven insufficient twice:

- Step 1 broke `apply-growth-studio-public-positioning.cjs`, which never
  mentions `productLandingActions` — it anchors on
  `linkAction("/growth-studio/dashboard", "Open dashboard")`, a line *inside*
  the function body.
- Step 2 broke `apply-paid-launch-finalization.cjs`, which never mentions
  `getReadiness` — it anchors on two lines of the readiness object literal
  inside it.

Both extractions looked clean by every function name involved. No amount of
name matching sees either coming.

The authoritative check is empirical: run `pnpm run apply:runtime` twice and
confirm the tree is unchanged. `verify:generated` does this in CI. **Never skip
step 5 below on the grounds that the unit test passed.**

## The order

Ordered by risk, lowest first. Each step is its own commit and its own release.

| Step | What moves | Lines | Generators touching it | Status |
| --- | --- | ---: | ---: | --- |
| 1 | Product page definitions and action bars | 158 | 0 | **done** — `lib/sonara-product-pages.cjs` |
| 2 | Readiness computation — 27 functions | 288 | 4 (calls only) | **done** — `lib/sonara-readiness.cjs` |
| 3 | Domain module records (`buildDomainModuleRecord`) | ~61 | 0 | next |
| 4 | Admin action bars and forms (`adminActions`) | ~40 | 3 | ready |
| 5 | Stripe and billing records — 15 functions | 212 | 1 (boundary) | **done** — `lib/sonara-billing.cjs` |
| 6 | Auth and sessions | ~700 | many | needs generator work first |
| 7a | Leaf rendering helpers — 12 functions | 100 | 0 | **done** — `lib/sonara-shell.cjs` |
| 7b | `layout`, `renderHomepageContent`, `responsePage`, `adminRowsPage` | ~150 | 11 | **do not attempt** until the homepage generator is retired |

Step 6 is the largest remaining region and is gated on the generators, not on
the code. The honest sequence is to retire or rewrite the generators that own
it first; moving the code underneath them is the expensive way to find that out.

### Step 5 was also mis-graded, and differently

Graded "~600 lines, many generators, needs generator work first". Both halves
were wrong, and not in the same direction as step 7.

Exactly **one** generator constrains billing:
`apply-customer-ready-production-experience.cjs` uses
`async function getCustomerPaidEntitlement(user, productKey) {` as the *end
boundary* of a `replaceBetween`. That declaration line has to stay in
`server.js` verbatim or the generator fails, so `getCustomerPaidEntitlement`
stayed. Nothing else in the region is anchored on at all.

The real constraint was the dependency surface. Moving all of billing meant a
factory with **eighteen** injected dependencies — which does not reduce
coupling, it relocates it into a wiring surface where a typo surfaces as
`undefined is not a function` mid-checkout. So the cut is at the HTTP seam
instead: `handleCheckoutSessionRequest` and `handleStripeWebhook` stayed in
`server.js`, and with them go nine dependencies that exist only to turn a result
into a response (`acceptsHtml`, `wantsJson`, `responsePage`,
`sendSetupRequired`, `resolveCustomerSession`, `getCustomerPrimaryOrganization`,
and the three readiness statuses). Everything that knows about Stripe or writes
a billing record moved, on nine dependencies.

The general lesson, which applies to step 6 as well: when a region resists
extraction, check whether it is the generators or the dependency count. They
need different fixes, and the plan had been recording only the first.

### Step 7 was mis-graded, and the reason matters

The row above originally read "Rendering shell (`layout`,
`renderHomepageContent`) — ~250 lines — 26 generators — do not attempt". That
grade came from counting how many generators *mention* `layout`.

Twenty-six do. **None of them contains `function layout(`.** They mention it
because they emit `layout({ ... })` call sites — which stay in `server.js`
either way and are unaffected by where the definition lives. Grading by
mentions is the same mistake steps 1 and 2 had already disproved from the other
direction, where the generator that broke never mentioned the function at all.

The question that actually predicts breakage is narrower:

> Does any generator anchor on a string **inside this function's body**?

Asked that way the shell splits cleanly in two. Twelve leaf helpers —
`escapeHtml`, `brandCard`, `linkAction`, `authForm` and the rest — have zero
generators anchoring inside them, and moved as step 7a. Five do not: `  </head>`
alone is a replacement target for four generators (`apply-advanced-builder-ui`,
`apply-cohesive-2027-ui`, `apply-premium-access-experience`,
`apply-premium-ui-final`), `apply-motion-brand-system` rewrites the loader
markup, and six more anchor elsewhere in the same region. `layout` is the anchor
magnet, not the shell.

A first attempt moved `layout` with the rest. It cascaded into five generator
repairs before a scan found six more, and was reset rather than pushed. Step 7b
stays gated for exactly the reason originally stated — it just applies to a
quarter as much code as the row claimed.

Step 4 shrank as a side effect: `contactForm` and `authForm` were on its list
and are now in `lib/sonara-shell.cjs`.

## How to do one

1. Pick a function group and check the right thing. A generator *naming* the
   function is not a blocker — `layout` is named by 26 and defined by none. What
   blocks a move is a generator anchoring on a string **inside the body**. Take
   the two or three most distinctive literals from each function and
   `grep -l` those across `scripts/apply-*.cjs`, then read every hit rather than
   counting it: most are unrelated markup that happens to share a class name.
2. Move it to `lib/sonara-<area>.cjs`. Take dependencies as a factory argument
   when it genuinely has them — anything the generators anchor on stays in
   `server.js` and is **injected**, which is the shape `routes/*.cjs` uses. When
   a group depends on nothing outside itself, as `lib/sonara-shell.cjs` does,
   export the functions directly; a factory with an empty dependency object is
   one more binding to place wrongly.
3. Bind the factory near the top of `server.js`, but **after anything it reads
   that is itself a `const`**. Route registration runs at module load and
   receives these as dependencies, and a `const` is not hoisted — putting the
   binding where the functions used to sit throws
   `Cannot access '<name>' before initialization` (step 1), and putting it
   above `STRIPE_PLANS` throws the same for that (step 2). Injected *function*
   declarations are hoisted and can be referenced from anywhere — until they are
   themselves extracted, at which point they become consts too. That is what
   step 7a did to `linkAction` and `logoutAction`, which is why the shell require
   sits above the `createProductPages` call that consumes them.
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
