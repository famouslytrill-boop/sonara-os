# Security Notes

## Dependency Audit

No audit threshold was lowered in this sprint.

`pnpm audit --audit-level moderate` previously failed because Next.js stable `16.2.6` declares `postcss@8.4.31`, which is affected by GHSA-qx2v-qp2m-jg93. The repo now uses pnpm workspace overrides to resolve PostCSS to `8.5.15` across the workspace while keeping Next on the latest stable version.

Additional moderate findings were resolved by:

- Updating `stripe` to `22.1.1`, removing the vulnerable `qs` path from the Stripe dependency tree.
- Updating the pnpm override for `brace-expansion` to `5.0.6`.
- Keeping a single `postcss@8.5.15` version in the dependency graph.

## Package Manager Boundary

The repo uses pnpm only. `package-lock.json` files were removed, and CI installs from `pnpm-lock.yaml` with `pnpm install --frozen-lockfile`.

## Secret Handling

No real secrets should be committed. `.env.example` contains variable names and empty placeholders only. Service-role keys, Stripe secrets, webhook secrets, and database passwords must stay server-side.

## Entitlement Gate Scan Scope

`scripts/verify-production-product-catalog.mjs` enforces a fail-closed contract
on paid access: nine markers must be present in the deployed runtime, covering
`requirePaidOrOwnerAccess`, `getCustomerPaidEntitlement`, the two billing
PostgREST reads, the `status=in.(active,trialing)` filter, the per-product
entitlement key lists, and the locked-access copy.

The scan read `server.js` alone. It now reads `server.js` plus every `.cjs`,
`.js` and `.mjs` under `lib/` and `routes/` — the same set `vercel.json`
bundles.

**This is a scope correction, not a relaxation.** No marker was removed,
softened, or made optional; all nine are still required, and the failure is
still fatal to the deploy. What changed is where they are allowed to live.
Splitting `server.js` moved `getPaidEntitlementKeys` into
`lib/sonara-billing.cjs`, and three markers went with it. The enforcement was
intact and shipped, but the gate could not see it, so the production deploy
failed on correct code one directory over.

Narrowing the scan back to `server.js` would not make the check stricter — it
would make it blind to most of the runtime, which is the direction the split
keeps moving code.

`tests/product-catalog-production-boundary.test.js` now resolves each marker
against that same source, so this fails in the test suite rather than at the
post-deploy gate. The marker list is parsed out of the verifier rather than
copied, so the two cannot drift into agreeing with each other.

## Catalog Boundary Text On The Live Page

The same deploy gate asserts that `/service-catalog` visibly tells a customer
when a product is not open, why, and how to ask about it.

It required five literal strings, among them `execution: restricted until
lifecycle evidence and launch approval are complete`. That is the vocabulary the
plain-language work removed from every customer-facing screen, and that
`AGENTS.md` forbids reintroducing to active UI. The gate therefore demanded copy
the codebase is not allowed to contain, and failed on a page that states the
boundary correctly in words a customer can read.

The list now lives in `lib/sonara-plain-language.cjs` as `CATALOG_BOUNDARY_TEXT`
and is read by the gate and by
`tests/product-catalog-production-boundary.test.js`, so the enforcement follows
the vocabulary rather than pinning it, and the two cannot disagree.

**Still five required strings, still fatal to the deploy, still asserted against
the live page.** Nothing about paid access was unguarded at any point; the
restriction is enforced in code and in database constraints, and this check is
about what the customer is told. What changed is that the words are the ones the
application actually uses.

The reason to fix rather than delete it: a gate that can only pass by
reintroducing retired wording invites being removed instead, and then nothing
checks that the page says anything at all.

## Retiring The Code Generators

56 `scripts/apply-*.cjs` and `scripts/prepare-*.cjs` generators mutated
`server.js`, `routes/`, `lib/`, the public client bundles, the CSS and the
OpenAPI document in place. They have been deleted, along with the 34 `apply:*`
npm scripts, `scripts/verify-generated-output-committed.mjs`, the
`verify:generated` npm script, and the CI steps that ran it.

**The check that was removed, and why it is not a weakening.**
`verify:generated` ran the full generator chain twice and asserted the tree was
unchanged, proving the committed output still matched what the generators
produce. It guarded a subsystem that no longer exists. Keeping it would have
meant keeping the generators; keeping it *without* them would have made it a
check that cannot fail, which is worse than none because it still reports
success.

**Why deleting them could not change what ships.** The repository was already
under a codegen freeze: generator output was committed, and `apply:runtime`
produced a zero-byte diff. That was verified immediately before deletion — the
full chain ran clean with `git status --porcelain` empty. Deleting a generator
whose output is already committed removes the ability to regenerate that code;
it does not change the code.

**What is lost.** Those regions of `server.js` can no longer be regenerated from
a script. They are ordinary hand-maintained code now and must be edited
directly. This is the intended trade: the generators anchored on hundreds of
strings across the file, broke two extractions during the split by anchoring on
lines *inside* function bodies, and once left two definitions of `catalogActions`
in the same file — which parsed, passed the tests, and silently took the later
definition.

**What replaced the safety.** Tests that executed generators to prove
idempotency were removed rather than left asserting over nothing. Tests that
assert on the *resulting* code were kept and still run — they now guard
hand-maintained source, which is what they were really checking. The vacuous
generator-collision checks in `tests/server-split.test.js` were deleted for the
same reason.
