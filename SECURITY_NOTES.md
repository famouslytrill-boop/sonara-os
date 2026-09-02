# Security Notes

## Dependency Audit

No audit threshold was lowered in this sprint.

`pnpm audit --audit-level moderate` previously failed because Next.js stable `16.2.6` declares `postcss@8.4.31`, which is affected by GHSA-qx2v-qp2m-jg93. The repo now uses pnpm workspace overrides to resolve PostCSS to `8.5.15` across the workspace while keeping Next on the latest stable version.

Additional moderate findings were resolved by:

- Updating `stripe` to `22.1.1`, removing the vulnerable `qs` path from the Stripe dependency tree.
- Updating the pnpm override for `brace-expansion` to `5.0.6`.
- Keeping a single `postcss@8.5.15` version in the dependency graph.
- Raising the `js-yaml` override from `4.3.0` to `4.3.1` for GHSA-5p4m-2wfm-xmqj
  (CVE-2026-59870, quadratic CPU consumption resolving `!!omap`). The previous
  override pinned `>=4.0.0 <4.1.2` to `4.3.0` for an earlier advisory; `4.3.0`
  is itself inside the new vulnerable range, so the range moved with it. Both
  paths are development-only -- `mocha` and `@vercel/node` -- and no runtime
  code in this repository parses YAML, so nothing served to a customer was
  exposed. It was still a real patch rather than an exemption: the version in
  the tree changed, no threshold moved, and the audit is clean at moderate
  again.

### 2 September 2026 -- `qs` and `body-parser`, reached through `express`

`pnpm audit --audit-level moderate` began failing on three advisories, all of
them in the one production dependency's own tree:

- **GHSA-4mjr-xmp4-gh2g** -- `qs` denial of service via attacker-controlled
  `isBuffer`, affecting `>=2.2.5 <6.16.0`. Reached by `express > qs`,
  `express > body-parser > qs` and `supertest > superagent > qs`.
- **GHSA-x5fp-wj9c-mxmx** -- `qs` array-limit bypass via bracket-key comma
  parsing, affecting `>=6.14.2 <=6.15.3`. Same paths.
- `body-parser` denial of service when an invalid `limit` value silently
  disables size enforcement, affecting `<1.20.6`, via `express > body-parser`.

The first two are the ones that matter here, because `express` parses query
strings on every request this application serves, and `body-parser` reads every
request body. The tree resolved `qs@6.15.2` and `qs@6.15.3` and
`body-parser@1.20.5`.

Fixed by pnpm workspace overrides, following the pattern already in
`pnpm-workspace.yaml`:

    "qs@<6.16.0": "6.16.0"
    "body-parser@<1.20.6": "1.20.6"

Both are patch and minor moves inside the ranges `express@^4.18.2` already
accepts, which is why no dependency needed changing. Verified rather than
assumed: `pnpm install --frozen-lockfile` succeeds, `pnpm audit` reports no
known vulnerabilities at `--audit-level low` as well as `moderate`, and the
whole release chain passes -- 3545 tests and the route smoke, which exercises
express's own query and body parsing across 8 public and 5 protected routes.

**No audit threshold moved and no check was weakened.** The versions in the
tree changed. The advisories were newly published against a dependency tree
this branch had not touched: the branch's only `package.json` change is to the
`scripts` block, and its `pnpm-lock.yaml` was byte-identical to `main` before
this fix.

## Permissions-Policy: microphone moved from `()` to `(self)`

**Date:** 27 August 2026. **Header:** `server.js`, the same `app.use` as below.

`microphone=()` denies the feature to every origin including this one, so
`navigator.mediaDevices.getUserMedia({ audio: true })` fails on our own pages.
It is now `microphone=(self)`. **`camera=()` is unchanged** and stays denied:
calling here is audio only, and a camera permission nothing uses is a permission
worth not having.

**Why it was changed.** `/business-builder/owner/customers/:recordId/call` and
`/call/:token` place a browser-to-browser call. The audio is peer to peer and
never reaches this application; without microphone access there is nothing to
send.

**What it does not do.** `(self)` is permission to *ask*. The browser shows its
own prompt, and `public/sonara-call.js` calls `getUserMedia` only inside a click
handler -- there is no capture on load, and nothing starts a microphone without
somebody pressing a button on a page that has already explained what it is for.

**Nothing is recorded.** There is no recording, transcript or audio column
anywhere in `call_sessions` or `call_signals`, and no endpoint accepts audio.
Recording a call is a consent decision in most jurisdictions this product is
used in, which AGENTS.md puts behind owner review rather than behind a default.

**No audit threshold moved and no check was weakened.**
`tests/a-call-never-passes-through-us.test.js` asserts the header still denies
the camera, still scopes the microphone to `self` rather than `*`, and that the
call client asks for audio only.

## Permissions-Policy: geolocation moved from `()` to `(self)`

**Date:** 27 August 2026. **Header:** `server.js`, the one `app.use` that sets
security headers for every response.

`geolocation=()` denies the feature to every origin including this one, so
`navigator.geolocation.getCurrentPosition` fails with a permission error on our
own pages. It is now `geolocation=(self)`: this origin may ask, and no embedded
third party may. `camera=()` and `microphone=()` are unchanged.

**Why it was changed.** `location_events` (migration 015), `POST
/api/location/events`, `/staff/location`, and the GPS helpers in
`public/sensory-device-client.js` all existed and none of them could ever run:
the header made the capture impossible, so the page promising a person their own
check-in history was guaranteed to be empty for ever.

**What it does not do.** `(self)` is permission to *ask*. The browser still
shows its own prompt, the person still has to grant it, and a refusal is
final and ours to respect. Nothing captures a position without a click:
`public/sonara-check-in.js` calls `getCurrentPosition` inside a submit handler
and nowhere else, and there is no `watchPosition` on any page. That satisfies
AGENTS.md -- location is off until a person turns it on, per request, and is
never on in the background.

**The narrower alternative, and why not.** A per-response header allowing
geolocation only on `/staff/location` would be tighter. It was not taken because
the header is set once for every response by design, and a policy that varies by
path is a policy whose current value nobody can state -- which is worse than a
slightly broader one everybody can read in a single line. If a second page ever
needs it, the line does not change.

**No audit threshold moved and no check was weakened**; `pnpm audit
--audit-level moderate` and `scripts/verify-security.mjs` are unaffected.
`tests/a-check-in-records-only-what-was-asked-for.test.js` asserts the header
still denies camera and microphone, still scopes geolocation to `self` rather
than `*`, and that no page starts a position watch.

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
