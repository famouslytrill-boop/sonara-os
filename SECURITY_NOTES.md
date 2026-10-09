# Security Notes

## CodeQL and the rate limiter it cannot see, 1 October 2026

No check was weakened, no alert was dismissed, and no threshold moved. This
records two CodeQL high-severity alerts that were real and are fixed, and two
that are a limitation of the model rather than of the code -- with a measurement
in place of the assurance, because "it is rate-limited" is worth nothing as a
claim.

PR #405 added `lib/sonara-business-passcode.cjs` and
`routes/sonara-business-security-routes.cjs`, the business owner's management
passcode. CodeQL raised four high-severity alerts on the first push.

### The two that were fair, and are fixed

`js/weak-password-hashing`, on both call sites. The construction peppered before
stretching -- `scrypt(HMAC(pepper, passcode), salt)` -- so the passcode's first
stop was HMAC-SHA-256, a deliberately fast hash, with scrypt further down. The
security property is the same either way, and the alert was still right: "the
slow part is further down this file" is a property of the file rather than of the
line, and whoever next moved the `scryptSync` call would take the protection with
it in silence.

It is now `HMAC(pepper, scrypt(passcode, salt))` -- the passcode goes straight
into scrypt and nowhere else, the pepper is applied over the digest. Same cost,
same property, and it reads as what it is. Two tests hold the order, and the
second holds the pepper too, so the first cannot be satisfied by deleting it.

### The two that are a model limitation

`js/missing-rate-limiting`, on the two handlers that verify a passcode: *"This
route handler performs authorization, but is not rate-limited."*

Both handlers **are** rate-limited. CodeQL's model recognises rate limiting from
a short list of npm packages; this repository uses its own `createRateLimiter`
from `lib/sonara-rate-limit.cjs`, backed by the `sonara_consume_rate_limit`
PostgreSQL function and the `sonara_auth_rate_limits` table, which the scanner has
no model for. Adding `express-rate-limit` to satisfy a scanner would mean a
tenth production dependency for a capability the codebase already has, and
AGENTS.md puts that behind an explicit architecture decision.

**Measured rather than asserted.** `tests/a-management-passcode-is-a-second-thing-to-know.test.js`
wires the real limiter into the real routes with the RPC counter mocked, and
proves:

- the eleventh attempt in the five-minute window is refused with 429 and
  `rate_limited`, and the ten before it are not;
- the refused attempt never reaches the credential read -- ten reads for eleven
  attempts, so a guess costs nothing to reject;
- `Retry-After: 300` is sent, so a caller is told how long to wait;
- two buckets are consumed per request, one keyed on the address and one on the
  signed-in person -- the half that the five-wrong-answers lockout does not
  cover, because that counter is per credential and bounds guesses against one
  business rather than requests from one caller across all of them;
- `/passcode` and `/lock` are throttled too, not only `/unlock`.

Each was falsified: taking the limiter off `/unlock` fails four of them, dropping
the `subject` scope fails the per-person case, and raising `maxAttempts` to
10,000 fails three.

One real weakness was found while writing that, and it was in this repository's
code rather than in CodeQL's reading. The limiter's fallback was
`(req, res, next) => next()` when no `createRateLimiter` was supplied -- so a
deployment that forgot to pass it would have served an unthrottled
passcode-guessing endpoint while every line of the module still read as
rate-limited. It refuses now, with `rate_limiter_unavailable`, and a test asserts
that all three endpoints answer 503 rather than running.

The two alerts stay open on the PR. They are not dismissed and not suppressed:
dismissing them would remove the only visible record that this pattern exists,
and a future handler that genuinely has no limiter would raise the same alert and
look like the same accepted noise. The decision to make them actionable --
whether to adopt a scanner-visible limiter across the application -- is the
owner's, and it belongs to every route in the codebase, not to this one feature.

**A third, on 6 October 2026: `POST /api/webhooks/stripe-connect`** (PR #436),
the Creator Studio marketplace's Stripe Connect webhook. Same alert, same reading:
it is limited by `createRateLimiter` (`stripe_connect_webhook`, 600 a minute per
address, first in the route's stack), which CodeQL has no model for. Stripe
retries a 429 with backoff, so the ceiling delays a burst rather than losing a
payment. `tests/buying-a-licence-end-to-end.test.js` proves it with the counter
mocked: a refused request answers 429 with `Retry-After` before the signature is
checked or any table is read, and the buy button beside it (`marketplace_buy`,
120 per ten minutes, per address **and** per person) refuses without reaching
Stripe. Falsified: limiter removed from the webhook (three red), `subject` scope
dropped (one red), ceiling raised to 10,000 (one red). Left open on the same terms
as the two above.

**A fourth and fifth, on 7 October 2026: `POST /api/webhooks/resend`** (PR #446),
which records what happened to a campaign email after the provider accepted it.
Same alert, same reading:
- **In `server.js`:** the route is limited by `createRateLimiter`
  (`email_receipt_webhook`, 600 a minute per address, first in the route's
  stack). The sender, Svix on Resend's behalf, retries a 429 with backoff, so the
  ceiling delays a burst rather than losing a receipt.
- **In `tests/a-campaign-email-says-what-happened-to-it.test.js`:** the alert is on
  a test harness that mounts the handler on its own to exercise the signature and
  the lookup. It is not a production route.

`tests/a-campaign-email-says-what-happened-to-it.test.js` drives the real route in
`server.js` with the counter mocked. It proves the limiter is first in the stack,
and that a refused request answers 429 with `Retry-After` before the signature is
checked or any table is read. Falsified: the limiter removed from the route
fails it. Left open on the same terms as the three above.

## Shell commands built from TMPDIR, 15 September 2026

No check was weakened. This records a real fix with a verified exploit path,
because "we quoted a path" is worth nothing as a claim and everything as a
measurement.

CodeQL alert 234 on PR #258, *"Shell command built from environment values"*,
flagged `scripts/report-authorization-function-grants.mjs`. Both that script and
`scripts/verify-migration-replay.mjs` build their PostgreSQL commands as strings
handed to `/bin/sh`, interpolating `fs.mkdtempSync(path.join(os.tmpdir(), ...))`
-- and `os.tmpdir()` reads `TMPDIR`, `TMP` and `TEMP`. CodeQL flagged only the
new file, which is how pull-request scanning works; the flaw was identical in the
older one, which is in the release chain.

**Verified reachable rather than assumed.** With the `initdb` path left
unquoted and `TMPDIR` set to a directory literally named

    /tmp/pwn; touch /tmp/INJECTED-MARKER; echo x

the marker file was created. With the quoting in place and the same `TMPDIR`, it
was not. The first probe was inconclusive and is worth recording as a trap: it
aimed the injected `touch` at a root-owned scratch directory, and the command ran
under `su postgres`, so nothing was written and the run looked safe. A probe that
cannot succeed proves nothing about a defence -- the target has to be somewhere
the injected command could actually write.

Both files now route every interpolated path through a `sh()` helper that wraps
in POSIX single quotes and escapes embedded ones. Double quotes would not do:
`$` and backticks are still expanded inside them, which is most of what this
defends against. Both scripts were re-run afterwards -- 118 migrations replay and
the grant experiment reports the same result as before.

The exploit needs a hostile `TMPDIR` in an environment already running this
repository's code, which is why it was an alert and not an incident. The reason
to fix it anyway is that the only argument for leaving it is "nobody would".

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

### 5 October 2026 -- `proxy-addr`, reached through `express`

The OSV gate in `open-source-security-scans.yml` went red on
**GHSA-jqcg-44mw-7w3h** (critical, CVSS 9.1): `proxy-addr` IP spoofing via an
IPv4-mapped IPv6 address matching a trusted subnet, affecting `>=1.1.0 <2.0.8`.
OSV published it at 23:30 UTC on 5 October; the previous green scan was the same
morning. The tree resolved `proxy-addr@2.0.7` through `express > proxy-addr`, and
nothing in this repository's dependencies had changed.

Fixed by a pnpm workspace override, the existing pattern:

    "proxy-addr@<2.0.8": "2.0.8"

`2.0.8` is inside the range `express@^4.18.2` accepts (`~2.0.7`), so no direct
dependency moved. Reproduced first with the same checksum-pinned OSV Scanner 2.6.0
the workflow uses -- one critical finding -- then the same command clean after
the change.

Exposure, stated rather than assumed: `proxy-addr` decides which forwarded
addresses Express trusts, and only when `trust proxy` is set. This application
never sets it (`lib/sonara-rate-limit.cjs` explains why), so the trust function
the advisory concerns is not configured here. It is patched anyway, because
"not reachable today" lasts only until somebody sets `trust proxy`.

**No threshold moved and no check was weakened.** The version in the tree changed.

### 3 October 2026 -- `braces`, with no fixed version, removed by removing what pulled it in

`pnpm audit --audit-level moderate`, the OSV gate and the deploy dry-run's own
dependency audit all failed on **GHSA-vfj7-8cjw-p6xm** (high): `braces` stack
exhaustion through deeply nested patterns, `<=3.0.3`. The registry has no release
past `3.0.3` (May 2024) and the advisory lists no patched version, so the override
this file has used for every earlier advisory had nothing to point at. Both paths
ran through one development dependency:

```
.>@vercel/node>ts-morph>@ts-morph/common>fast-glob>micromatch>braces
.>@vercel/node>@vercel/static-config>ts-morph>@ts-morph/common>fast-glob>micromatch>braces
```

**`@vercel/node` was not used.** Nothing in the repository imports it, and the deploy
workflows run their own pinned `vercel@59.19.1` CLI. Vercel's Node.js runtime
documentation (checked 3 October 2026) says a function in `/api` needs "no
additional configuration"; the npm package is what supplies the `VercelRequest` and
`VercelResponse` types to a TypeScript handler, and `api/index.js` is JavaScript that
re-exports the Express app. So it was removed with `pnpm remove @vercel/node`, and the
audit is clean at moderate with no threshold moved and nothing ignored.

It is also the fifth advisory this one package has carried in: `js-yaml` twice,
`smol-toml`, `fast-uri` and `ajv` all arrived through it. After the removal the
overrides for `undici`, `smol-toml`, `postcss`, `fast-uri` and `tar` resolve nothing
in the tree. They are kept: an override that matches nothing does nothing, and if
one of those packages comes back through another dependency it arrives patched.

### 9 September 2026 -- `js-yaml` again, and the third stale override

The note above ends by predicting this: *when an audit names a package this file
already has an override for, check whether the override is the thing holding the
tree on the vulnerable version.* This is that third case, and it took no
investigation because the prediction named the check.

`pnpm audit --audit-level moderate` failed on GHSA-2883-xcg3-v3hh (high):
`js-yaml` `>=4.0.0 <4.3.2`, where `maxTotalMergeKeys` does not limit CPU use for
empty merge sources. The register carried `"js-yaml@>=4.0.0 <4.3.1": "4.3.1"`,
added on 3 September for GHSA-5p4m-2wfm-xmqj. `4.3.1` is inside the new
vulnerable range, so the override was pinning the tree **to** the vulnerable
version rather than away from it -- the same shape as `fast-uri` before it, and
the same shape as the `js-yaml` entry before that. Raised to
`"js-yaml@<4.3.2": "4.3.2"`, dropping the lower bound the way the `fast-uri` fix
did, so the entry cannot go stale in the same direction again.

Both paths remain development-only -- `.>mocha>js-yaml` and
`.>@vercel/node>@vercel/build-utils>@vercel/python-analysis>js-yaml` -- and no
runtime code in this repository parses YAML, so nothing served to a customer was
exposed. This is a real patch rather than an exemption: the version in the tree
changed to `4.3.2`, no audit threshold moved, and `pnpm audit` now reports no
known vulnerabilities at `--audit-level low` as well as `moderate`.
`pnpm install --frozen-lockfile` succeeds, and the 3,931 tests, lint and build
all pass on the new tree.

Three occurrences of one failure mode is a pattern rather than a coincidence.
Every override in `pnpm-workspace.yaml` that still carries a lower bound is a
candidate for the fourth, because a lower bound is what makes an entry describe
one advisory instead of a floor.

### 2 September 2026 -- `fast-uri`, and an override that had gone stale

Four **high** advisories in `fast-uri@3.1.5`, all reached the same way --
`.>@vercel/node>@vercel/static-config>ajv>fast-uri` -- and all patched in
`3.1.6`:

- **GHSA-f65p-4m7j-42xc**, server-side request forgery via malformed IPv6
  normalization (`>=3.0.0 <3.1.6`)
- **GHSA-fph4-wmhf-6fwf**, server-side request forgery via repeated hostname
  percent-decoding (`>=3.1.2 <3.1.6`)
- **GHSA-jqff-g426-hqxp**, host confusion via percent-encoded scheme
  normalization (`>=3.0.0 <3.1.6`)
- and a fourth on the same package in the same run.

Every path is `dev: true`. `@vercel/node` is a development dependency and
nothing in the served application parses URIs through it, so no customer
request reached this code. It is still a real patch rather than an exemption:
the version in the tree changed.

**The override was the problem, not the absence of one.** The register already
carried `"fast-uri@>=3.0.0 <3.1.5": "3.1.5"`, added for an earlier advisory.
Pinning to the version that was current at the time is what makes an override
go stale: the moment `3.1.5` is itself found vulnerable, the entry is pinning
the tree **to** the vulnerable version rather than away from it. Raised to
`"fast-uri@<3.1.6": "3.1.6"`.

This is the same shape as the `js-yaml` note above -- an override pinned for one
advisory sitting inside the range of the next -- and it is now the second time.
Worth stating plainly for whoever hits the third: when an audit names a package
this file already has an override for, check whether the override is the thing
holding the tree on the vulnerable version.

**No audit threshold moved and no check was weakened.** `pnpm audit` reports no
known vulnerabilities at `--audit-level low` as well as `moderate`, and
`pnpm install --frozen-lockfile` succeeds.

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
At this release it became `microphone=(self)`. Camera remained denied by default:
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
--audit-level moderate`, `pnpm run scan:client-secrets` and
`pnpm run verify:csp` are unaffected.

This sentence named `scripts/verify-security.mjs` until 30 September 2026, when
that file was deleted. It is worth recording why, because the sentence was not
merely out of date — it was never true on this tree. Nothing ran the script: no
package.json entry, no workflow, no test. And it could not run, because it
required `next.config.mjs`, `src/config/securityConfig.ts` and
`scripts/scan-secrets-local.ps1`, none of which exist here; invoked directly it
exited 1. A security document asserting that a check is unaffected, about a check
that cannot execute, is the defect `.claude/skills/checks-that-cannot-lie`
records — with the aggravation that this one sat in the file a reader opens to
find out what still holds.
`tests/a-check-in-records-only-what-was-asked-for.test.js` asserts the header
still denies camera and microphone, still scopes geolocation to `self` rather
than `*`, and that no page starts a position watch.

## An Unreachable Audit Is Not A Passing Audit, And Not A Finding Either

**No audit threshold was lowered.** `--audit-level moderate` is unchanged, and an
audit that cannot run still fails the job. Recorded here because
`AGENTS.md` requires any change to an audit check to state its exact reason.

On 3 September 2026 `frontend-dependencies` went red on four job runs across two
commits — one of which touched only markdown — each carrying:

```json
{ "error": { "code": 23, "message": "The operation was aborted due to timeout" } }
```

`pnpm audit` had not found an advisory. It could not reach npm's advisory bulk
endpoint to ask. `https://registry.npmjs.org/` itself answered 200 in under two
seconds at the same moment, and the timeout reproduced from an unrelated network,
so the outage was that endpoint rather than the registry or GitHub.

The step could not tell the two apart, because both exit non-zero:

```bash
pnpm audit --audit-level moderate --json > pnpm-audit.json
status=$?
exit $status
```

**A network failure was therefore reported as a security finding.** That is a
security problem rather than a cosmetic one, and it runs in the direction this
repository normally worries about backwards: a signal reporting *failure* without
being true. A check that cries wolf teaches people to re-run it until it goes
green and then stop reading it, and that is how a real advisory eventually gets
waved through by somebody who has learned the red means nothing.

Two changes, neither of which relaxes anything:

1. **Distinguish** — `scripts/audit-result-is-unusable.mjs` decides whether a
   real audit result was obtained at all. When it was not, the job **still
   fails**, with its own message saying nothing was audited.
2. **Bound it** — `pnpm audit` does not fail fast when that endpoint is
   unresponsive, it hangs; each CI attempt sat for four minutes. It is now
   capped at ninety seconds with `timeout -k`, so it fails *sooner* than before.

**All three call sites**, through one `scripts/audit-dependencies.mjs`:
`dependency-scan.yml`, `sonara-industries-ci.yml`, and — the consequential one —
`controlled-production-deploy.yml`, where a false security finding blocks a
production release. The first version of this fix patched only the first, which
is the same shape as the migration repair that created the tables that were
absent and ignored the ones that were present. The test derives the call sites
rather than listing them, so a fourth workflow calling `pnpm audit` bare fails.

**There is deliberately no retry.** The first version retried three times, and
running it against the live outage showed that turns a four-minute failure into
a twelve-minute one and risks pushing a job into its own timeout — the fix making
CI worse than the bug. A second version bounded each attempt and still hung,
because `spawnSync`'s own timeout kills `pnpm` while a grandchild holds the
stdout pipe. Both were found by running it rather than reasoning about it.

The rule that script encodes: **anything which is not a valid audit result means
we could not ask** — no file, empty, unparseable, or carrying an `error` key.
That rule exists because the first version, written inline in the workflow,
classified an empty and an unparseable file as *real results* — so a crashed
audit would have been reported as a security finding by the very code written to
stop a timeout being reported as one. `tests/an-audit-that-did-not-happen-is-not-a-finding.js`
drives all eight cases.

What this deliberately does **not** do: treat an unreachable audit as a pass. The
outcome is identical to before. Only the message changed.

## 10 September 2026 -- An Invite Could Name Somebody Else's Business

Nothing was weakened here. A cross-tenant hole was closed, and it is recorded
because the shape of it is the one this repository keeps finding rather than a
one-off.

`POST /api/business-builder/employees/invite` read the tenant like this:

```js
const organizationId = String(body.organizationId || body.organization_id || req.sonaraBusinessMembership?.organization_id || "").trim();
```

**The verified membership was the fallback, and the request body was the
preference.** `requireBusinessManager` authorises the caller against
`workspace_id` only -- `getBusinessWorkspaceId` never looks at the organization
at all -- so a legitimate manager of their own workspace could post
`organizationId` naming any other business and have it accepted.

It did not stop at a stray row. `acceptBusinessEmployeeInvite` copies the
invite's `organization_id` into an **active** `business_memberships` row, and
`getCustomerPrimaryOrganization` returns that column straight back as the
organization a signed-in customer belongs to. The service-role key bypasses
row-level security, so `organization_id=eq.` *is* the tenant boundary, and that
resolver is shared by eleven routes.

The practical path: a manager invites an address they control, accepts it, and
the new account -- having no `organization_memberships` row, so the resolver
falls through to `business_memberships` -- resolves into the named organization.

**How it was found.** `pnpm run report:selected-columns` listed
`organization_id` as fetched by `isBusinessManagerUser` and read by nothing. It
was in the select list the whole time, and **being selected is what made it look
checked** -- defect three in `.claude/skills/checks-that-cannot-lie`, the same
shape as the `consent_scope` case that report was written for.

**The fix.** The verified membership is now the only source for a business
manager, and a body naming a different tenant is **refused** with
`tenant_mismatch` rather than silently corrected -- a client that believes it
invited into one business and silently invited into another has been told
something false. A caller with neither a verified membership nor platform-admin
status is refused with `membership_unverified` instead of falling back to the
body. A platform admin may still name a tenant, because they administer all of
them, and that branch is asserted so the fix does not quietly remove the owner's
ability to invite anybody.

The form was the other half: it asked a manager to type their own Workspace ID
and Organization ID into required free-text boxes, which both created the vector
and made the page unusable by anyone who does not know their business's UUID.
Those fields are gone for a manager; the page now states which business the
invite joins, and the inputs appear only for the admin override, which has no
membership to derive them from.

Eleven deliberate breaks in
`tests/an-employee-invite-is-a-credential.test.js`, including reinstating the
exact original line, which fails six assertions by name.

---

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

## Local Creator capture and bounded image processing — 4 October 2026

The authenticated Creator Generation page alone overrides camera policy to
camera=(self); the server default still denies camera. Starting camera or
microphone requires user action, the saved authenticated-user opt-in and browser
permission. Camera never also requests audio. Current grants are returned through
an authenticated, private/no-store API. User IDs from requests never select the
record owner. Failed reads authorize nothing. The page-bound account must still
match the current session, with verification before and after a browser prompt
and every five seconds during continued capture. Verification has a ten-second
deadline. Stop, departure, visibility loss, track termination, revocation/read
failure and the 60-second limit release tracks; stale arriving streams are stopped.
Audio stays local with an 8 MB recording budget and a supported container.

The local editor rechecks local-compute permission before processing and during
long work. Images are limited to 20 MB, 8192 pixels per side and 16 megapixels,
reduced to 4 megapixels on devices reporting at most 2 GB. GPU/CPU work uses
bounded tiles; cancellation destroys job resources, aborts verification, clears
export links and restores originals. The original/canvas still consume memory,
and decoding precedes the dimension check. This is not constant-memory decoding,
HDR processing, arbitrary GPU execution, remote streaming or workspace upload.
Temporary output links are revoked on departure. No account permissions, provider
credentials, production data or subscription balances are modified by this update.

The image Worker rejects supplied non-empty message origins that differ from its
own location. Empty origins remain accepted for the dedicated-worker MessagePort
channel. The worker is created from a literal same-origin URL, handles only bounded
RGBA tiles and exposes no DOM, credentials, storage or network operation. The guard
and actual browser Worker processing are tested; an empty origin alone is not
described as proof of sender identity. This addresses CodeQL's handler finding
without disabling the query or suppressing a scan.

## Permissions-Policy: accelerometer and gyroscope are default-deny

**Date:** 2026-10-09

**Why it was changed.** The motion capture work initially widened `accelerometer` and `gyroscope` only on `/settings/device-feedback`, but the global header omitted both directives. That was not a real default deny: both directives have a default allowlist of `self`, so a same-origin top-level page can remain eligible when a directive is omitted. A second problem was route-specific header replacement: Creator Generation already replaces the global Permissions-Policy for camera/microphone access, so leaving motion directives out of that replacement could silently restore their default-`self` behavior.

**Control.** `lib/sonara-permissions-policy.cjs` now serializes the complete controlled feature set for every named surface. The global `default` preset uses `accelerometer=()` and `gyroscope=()`. The signed-in `device_feedback` preset changes those to `(self)` while keeping camera denied **only when the authenticated user's latest account-level `motion` decision is granted**; denied, never-asked and unreadable states receive the default sensor-deny policy. The `creator_generation` preset opens camera/microphone to this origin and explicitly keeps accelerometer/gyroscope denied. `POST /api/motion/events` re-reads the same account decision before parsing or storing a sample, so revoking Motion after page load still blocks persistence. The endpoint is rate-limited by IP and signed-in subject. Tests reject partial policies, wildcards, unknown presets and literal ad-hoc Permissions-Policy headers in server/route modules.

**Research basis.**
- MDN Permissions-Policy accelerometer: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/accelerometer
- MDN Permissions-Policy gyroscope: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/gyroscope
- W3C Permissions Policy Working Draft (22 September 2026): https://www.w3.org/TR/2026/WD-permissions-policy-1-20260922/
- MDN DeviceMotionEvent.requestPermission(): https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static

This does not make browser support universal. Device motion remains HTTPS-only where required, browser-dependent, explicitly user-initiated, foreground-bounded, and subject to the browser's own permission decision.

