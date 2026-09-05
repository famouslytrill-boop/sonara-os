# Ship readiness

What is done, what is deliberately still closed, and the three things that
cannot be closed from inside this repository.

Written to be read before launch and then again a month later, when the reason
something was left open has been forgotten.

---

## The state of the paid path

All twenty-three catalog products execute. None is restricted.

That took three passes and only one of them was a fix to the boundary itself.

First, the catalog defined "paid access is verified" as `planFloor === "free"`,
which made every paid product permanently unreachable — not pending a check
somebody could run, but false by construction — while the deploy printed "paid
execution remains restricted until positive production entitlement
verification" on every release, which reads like pending work rather than a
definition that could never come true. Fixing that opened thirteen of
thirty-four.

Second, eight of the remaining twenty-one were only mislabelled: platform
products priced on a plan `sonara_industries` enforces nothing for, and Growth
Studio products whose pages were built and whose lifecycle field still said
otherwise. Repricing and relabelling them opened those.

Third, the last eleven described work that does not exist — pages that deliver
a setup checklist under a name promising exports, features named for tables
nothing writes to. They were removed from the catalog rather than relabelled,
and `supabase/migrations/20260812120000_retire_removed_catalog_products.sql`
retires their published rows, because `/service-catalog` merges the database
over the code and would otherwise have gone on serving all eleven.

**The one thing still unproven,** stated precisely because the looser version was
wrong. This document said until 20 August 2026 that "nobody has completed a paid
signup in production end to end". Read against the live Stripe account, somebody
did:

| What happened | When | Outcome |
| --- | --- | --- |
| `ch_3TTE970dKtlEU3lA1AhwsqRQ`, $9.99, prepaid card | 30 Apr 2026 | **Succeeded**, subscription created, then fully refunded |
| `sub_1TTE9A0dKtlEU3lAzDzMonyq` on a $9.99 price | 30 Apr 2026 | Cancelled **29 minutes** after it was created |
| `py_3TjPg00dKtlEU3lA08bSZpcL`, $7.00, via Link | 17 Jun 2026 | **Failed** -- insufficient funds |

So the charge path, the subscription creation and the refund all work, and have
been observed working. Four things are still true and are what the pending status
actually means:

- **Both customers are the owner.** One email across both, one postal code. No
  third party has ever attempted a purchase.
- **Neither price still exists.** The $9.99 and the $7.00 are both `active: false`
  and predate the August ladder. **No plan currently on the pricing page --
  $19, $39 or $79 -- has ever been bought.**
- **Net revenue is zero, and the balance is negative.** The one successful charge
  was refunded; the processing fee on it was not. The account balance is
  **-$0.67**.
- **The entitlement half was never observed.** A subscription that lives 29
  minutes and is refunded does not demonstrate that a paid plan opens a workspace
  and keeps it open across a renewal.

`positiveSubscribedUserTest` should keep reporting `"pending"` until a purchase on
a current price is made and left running.

---

## Closed 17 August 2026: /admin/database could stall — and so could 224 other routes

Recorded here on 13 August as an open, undiagnosed finding: a request to
`/admin/database` whose metadata catalog returned a *usable* snapshot did not
complete, twice in a row, through eight-second deadlines, while requests whose
catalog failed answered in milliseconds. It was written up rather than left in a
test comment because a console that can hang is worse than the summary bug that
was being fixed.

**The cause was not in that route.** Express 4 ignores the promise an async
handler returns. A handler that throws — or awaits something that rejects —
never reaches `next(error)`, so nothing writes a response and the request stays
open until the client gives up. Probed directly against this application, a
throwing async handler produced `UNHANDLED REJECTION` on the process and no
response at all through a five-second deadline. There are **225 async handlers**
here; `/admin/database` was where it happened to be noticed, and the healthy
path is simply the branch with more code in it to fail.

**Why it was worth more than a try/catch.** A stall is not a slow 500. The
customer sees a spinner, so they retry instead of reporting. A serverless
function is billed until its own timeout rather than until the error. And the
page it was found on is the one an owner opens when they already suspect
something is broken.

**The fix is at registration, not at call sites.** `lib/sonara-async-route-safety.cjs`
patches `app.get/post/put/patch/delete/use/all` once, before any route exists,
so a rejected handler becomes `next(error)`; a terminal error handler registered
last answers 500 with a branded page, or JSON on `/api/`, carrying no error text
and no stack. 225 handlers cannot be individually remembered, and the 226th
would be written by somebody who never read the file.

**What the test asserts, and why its first case is a failure.**
`tests/a-failing-route-answers-instead-of-hanging.test.js` first asserts that an
unpatched Express 4 app *does* stall. Without that, the four passing assertions
would prove nothing about a framework that never had the problem. It then checks
the answer for a page, for an API caller, that no error text or stack reaches
the customer, that a synchronous throw is caught too, and that a response
already sent is left alone — a 500 written over work that succeeded is worse
than the stall. Two further assertions read the real application's router stack:
that every registered route handler is wrapped, and that the terminal handler is
last.

**What remains unknown, and is now harmless.** The specific condition that made
`/admin/database` throw was never identified, and no longer reproduces — the
healthy-catalog render answers in 2ms inside the full suite and 40ms standalone.
That is worth stating plainly: an unidentified throw is still an unidentified
throw. The difference is that it can no longer take a request down with it, and
if it returns it arrives as a 500 in the logs with a stack, rather than as
silence.

## Three things only the owner can close

### 1. A positive subscribed-user test in production

Buy a plan in production with a real card, confirm the entitlement lands, and
confirm the product it unlocks actually opens. Nothing in this repository can do
this, and no amount of test coverage substitutes for it.

### 2. Supabase leaked-password protection

Still disabled, reported by the security advisor on 2026-07-27. It is a
dashboard toggle: **Authentication → Providers → Password**.

The application already refuses breached passwords on its own at signup and
password reset (`lib/sonara-leaked-password.cjs`), so the paths in this
repository are covered. The dashboard setting covers every path Supabase Auth
serves, which is a wider guarantee.

After enabling it, set `SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true`. Until
that variable is set, the deploy prints a warning and passes either way — so a
green deploy currently tells you nothing about whether the toggle is on.

### 3. Twelve authorization functions are callable by any signed-in user

> **Updated 19 August 2026.** The four that existed in the live database and in
> no migration were supplied by the owner and are now recorded verbatim in
> `supabase/migrations/20260819050000_record_undeclared_authorization_functions.sql`.
> They are readable, they are correctly hardened with `search_path`, two of them
> are byte-identical to each other, two depend on tables that exist nowhere in
> this repository, and no policy in any migration calls any of them. The grant
> itself is unchanged and still the owner's decision — see
> `docs/owner/OWNER-STEPS.md` items 3 and 4.


Replaces the legal review that sat here. That was not a shipping step — it is a
decision about engaging counsel, and parking it on this list meant the list had
a permanent item nobody could close. The legal position is unchanged and stated
where it belongs: every legal page says the terms are not legal advice,
`tests/server.test.js` asserts that and asserts no page ever claims attorney
review, and `/readiness` still carries both the "Legal pages" and "Legal review
boundary" cards.

**Followed through on 13 August 2026.** Removing the item from this list left
`/readiness` still reporting `legalPages: review_required`, so the permanent
open item had moved rather than gone — same sentence, different surface. It now
reports `published_with_disclaimer`, derived from the pages carrying the
disclaimer rather than declared as a literal, so deleting the disclaimer changes
what the page says. `legalReviewBoundary: not_attorney_reviewed` is untouched,
and `docs/legal/LEGAL_REVIEW_REQUIRED.md` still holds the review itself.

What replaces it is real, current, and came from the live project rather than
from this repository. Supabase's security advisor reports:

**Twelve `SECURITY DEFINER` functions are executable by the `authenticated`
role over `/rest/v1/rpc/`.** These are the authorization primitives themselves:

    is_admin()                     is_current_user_admin()
    has_org_role(...)  (x2)        is_org_member(...)
    has_scope(...)                 is_org_owner_or_admin(...)
    has_company_access(...)        is_entity_member(...)
    has_entity_role(...)           can_manage_entity(...)
    sonara_has_org_role(...)       sonara_is_org_member(...)

A `SECURITY DEFINER` function runs with its owner's privileges, so it is not
subject to the row level security that would otherwise apply. Each of these
appears to answer a question about the caller and return a boolean, which is why
this is a warning rather than an open door — but they are the functions every
RLS policy in the schema depends on, and they are reachable directly.

**This has not been changed, deliberately.** Revoking `EXECUTE` from
`authenticated` is the advisor's suggested remediation, and it is exactly the
change that could silently break every RLS policy that calls them: a policy
evaluates as the calling role, so removing the grant can turn a working policy
into a denial. Verifying that needs a database somebody can break — a preview
branch — not a guess. It is written down here rather than acted on because
acting on it wrongly locks customers out of their own records.

**The blast radius is now measured rather than feared.**
`scripts/report-security-definer-exposure.mjs` reads the 111 migrations, finds
every `SECURITY DEFINER` function, and maps each one to the RLS policies that
call it — 505 policies across the schema. Run it with `--check`; the release
does. The answer is not one answer:

- **Seven of the eight in-repository functions are load-bearing.**
  `is_org_member` is called by **202 policies across 64 tables**.
  `is_entity_member` by 25, `can_manage_entity` by 15, `is_org_owner_or_admin`
  and `sonara_is_org_member` by 9 each, `has_org_role` by 7, `has_entity_role`
  by 4. Revoking `EXECUTE` on any of these is the dangerous case the paragraph
  above describes, and 197 is the number that makes a preview branch the only
  responsible way to try it.

- **One is called by no policy**: `sonara_has_org_role`. It appears to be a
  superseded twin of `has_org_role`, and it is the only part of the advisor's
  remediation this repository can say is safe on its own evidence.

- **Four of the twelve are defined by no migration**: `is_admin`,
  `is_current_user_admin`, `has_scope`, `has_company_access`. They exist in the
  live database and not in version control. This is a different finding from
  the one the advisor reported and a worse one: an authorization primitive
  nobody can read is one nobody can review, and no amount of care about the
  `EXECUTE` grant compensates for not knowing what the function does. It is
  also proof that policies and functions get created outside migrations, which
  is the limit on everything above.

Two limits, stated because the report is only as good as what it can see. It
reads migrations, so anything created outside version control is invisible to
it — and those four undefined functions are the evidence that path is in use.
Separately, the five functions this application calls over `/rest/v1/rpc/` all
call with the service-role key rather than as `authenticated`, so the server
itself is unaffected either way. That was checked in the code, not assumed.

The first version of this report was wrong in the direction that costs the most.
Its policy pattern could not read a quoted multi-word policy name — which is
most of them — so it saw 191 policies where there were then 497, and reported
that six of these functions, including ones with dozens of dependents, were safe
to lock down. (Both figures are as they stood that day; the schema has grown
since, and the count above is the live one.) It now runs two independent checks: the policy parse above, and a
paren-balancing scan of every `using` and `with check` expression that does not
know what a policy is and so cannot fail the same way. A disagreement between
them fails the release rather than being resolved quietly.

**Leaked password protection is still disabled**, confirmed against the live
project rather than assumed. Item 2 above covers it.

### The agent tables use a different tenancy model from everything else

Found while building `lib/sonara-agent-runner.cjs`, and recorded rather than
worked around.

`entity_action_runs` is scoped by `entity_id`. `entities` has **no
`organization_id`** — the nineteen `entity_*` agent tables scope by entity
membership, while every other table in this product scopes by organization.
There is no join between the two. Those nineteen tables are still unwritten,
and the architectural decision — give organizations entities, or re-scope the
agent tables — is still one somebody should make on purpose.

**What this section used to say, and why it was too broad.** It said a run had
nowhere correct to go and the runner therefore persisted nothing. That was true
of the `entity_*` tables and not true of the schema: `agent_action_logs` carries
`organization_id`, has an `(organization_id, created_at desc)` index, and was
read and written by nothing. The check had stopped at the tables whose names
began with `entity_`. `lib/sonara-agent-action-log.cjs` now writes every run
there and `/owner/agent-activity` reads them back.

**The gap that is actually still open is a different one: nothing re-runs an
action after approval.** The runner is called per request by the page that wants
work done; there is no queue consuming approvals. A gated action is classified,
refused, and recorded as pending, and that is where it stops.

This is deliberately not being closed by building a queue, because there is
nothing for a queue to execute. No handler in this repository performs a refund,
a payout change, a policy publication or a customer send — the seven categories
that need approval are categories no code implements. A queue over them would be
the frame of a mechanism with no contents, and `/owner/agent-activity` would
gain an approve button whose only effect was to change a word in a log. The
runner already reports `unimplemented` for exactly this case, which is the
honest answer until a handler exists.

The order is therefore: build a gated capability first, then the approval path
it needs. Not the reverse.

### A table the application queries that no migration creates

`product_modules` is counted twice in `server.js` and is created by no
migration. It is the same class of finding as the four authorization functions
above, and it was found the same way — by something noticing it could not
classify a name, rather than by anybody reading.

Nothing here invents a migration for it. Its real shape is in the live database
and guessing it would put a definition into version control that may not match
what production has, which is worse than the gap. Export it the same way as the
four functions and it can be brought in.

The queries degrade honestly in the meantime: `safeCountTable` reports a missing
table as not set up rather than failing the page.

**Fifteen tables have RLS enabled with no policy**, reported as INFO. That is
the safe state, not a gap: RLS with no policy denies everything except the
service role, which is what a service-role-only table should do. Recorded so
nobody "fixes" it by adding a permissive policy.

The Supabase MCP connection is read-only by contract
(`scripts/verify-supabase-contract.mjs` asserts `read_only=true` in the config),
so all three were read and none could be changed from here.

---

## Closed, and worth knowing why

**Stripe prices.** The three stale prices are archived. Archiving is the
complete action — Stripe Price objects cannot be deleted — and checkout already
refuses an archived price (`lib/sonara-billing.cjs`, `price_archived`), so one
cannot silently take money.

---

## What the product does not claim

These are enforced by tests rather than remembered, because each is the kind of
promise that creeps back in through ordinary copy edits:

- No revenue, ranking, compliance or security outcome is guaranteed.
- Nothing is described as AI. These are tools and checklists.
- Nothing that needs setup is described as if it already works.
- No third-party brand is named as an endorsement.
- Legal pages never claim a review that has not happened.

---

## Boundaries that must not be quietly relaxed

Each of these was a defect once. The tests exist because the failure was
invisible until production, and the comment in each test says which incident it
came from.

| Boundary | Why it is load-bearing |
| --- | --- |
| `entitlementIntegrationVerified` must never revert to `planFloor === "free"` | It defined verified access as free access and shut thirty-one paid products by construction |
| Applied migrations are never rewritten | The edit reaches the file and never reaches the database |
| `layout()`'s `surface` defaults to `"work"` | A page that forgets to declare itself comes out calm, not animated |
| Entrance styles stay behind `data-sonara-depth="ready"` | A blocked or stale script must not be able to hide the page |
| The leaked-password check fails open, and never runs on login | A third-party outage must not stop signups, and must not lock anyone out mid-recovery |
| `NEW_PASSWORD_MIN_LENGTH` 12, `EXISTING_PASSWORD_MIN_LENGTH` 8 | Raising the login floor locks out every customer whose password predates it |
| Experience preferences keep one persisted store | Two stores meant the settings dialog reported a choice it was not applying |
| Motion `"on"` maps to `"auto"` | An in-app choice must never override `prefers-reduced-motion` |
| The document makes zero third-party requests | A page load must not tell anyone else that it happened |

---

## Verifying a release

`pnpm run verify:launch` runs the chain. If it is blocked, run the steps
individually:

```
build · test · scan:client-secrets · lint · smoke:routes · verify:db
verify:config · verify:api · verify:stripe · verify:tenant-tables
verify:member-policies · verify:catalog-sync · verify:open-source
```

Production deploys only through `.github/workflows/controlled-production-deploy.yml`
— migrations first, then the catalog boundary gate, then Vercel, then the
post-deploy page gates.

**A green deploy is not proof on its own.** The post-deploy gate fetches the
catalog page; it does not fetch every asset. When a release ships something new
— a font, a page, an image — fetch it from production and confirm it is really
there. Self-hosted fonts would have 404'd silently behind system fallbacks and
every gate would still have passed.

---

## An entire Next.js application that does not build or ship

Found 19 August 2026, and recorded here because **nothing in this repository's
documentation mentioned it** — not the handoff, not `AGENTS.md`, not this file.

The repository contains **1,165 `.ts`/`.tsx` files**, including an `app/`
directory with **231 Next.js pages and 12 API routes**. None of it runs, and it
cannot:

| Fact | Where to check it |
| --- | --- |
| `next` and `react` are not dependencies | `package.json` — neither appears, and `node_modules/next` does not exist |
| There is no TypeScript build | `pnpm run build` is `node --check server.js && node -e "require('./server')"` |
| `app/` is not deployed | `vercel.json` bundles `{public/**,routes/**,lib/**}` into `api/index.js` |
| Nothing would route to it anyway | `vercel.json` rewrites `/(.*)` to `/api`, the Express app |

The shipped product is the Express CommonJS application: `server.js`, `routes/`,
`lib/`, **277 registered GET routes**, deployed as one serverless function.

**What it cost, before it was found.** `scripts/report-orphan-tables.mjs` counted
a table as "queried" when any `.ts` file named it. So the release chain reported
*"0 tables created and never queried"* while **ten tables were queried only by
code that cannot run** — a gate asserting a guarantee that had stopped holding.
The scan now reads only what ships (`.cjs`, `.js`, `.mjs`, `.json`), those ten
are visible as orphans, and each has a recorded decision in
`lib/sonara-orphan-tables.cjs`.

Reading those ten is worth ten minutes, because three of them are warnings rather
than opportunities:

- `sonara_user_subscriptions` is a **third** billing model, alongside the live
  `billing_subscriptions` and `billing_entitlements`. Wiring it would give paid
  access two answers.
- `sonara_projects` duplicates `music_projects`, which already has a working page.
- `system_audit_events` would be a **fifth** audit log.

And one is a genuine gap the shipped product has no answer for:
`sonara_sound_assets` models licence, redistribution and attribution for
third-party audio. `data/open-source-tools.ts` does that job for code; nothing
does it for sound.

### The decision, which is the owner's

Three options with very different costs, and **this is not an engineering
preference**:

1. **Leave it as an unbuilt reference.** Costs nothing today. The cost is that
   every future reader has to rediscover that `app/` is inert — which is what
   this section now prevents.
2. **Delete it.** ~1,165 files. Irreversible in practice, and `AGENTS.md` puts
   destructive changes behind owner approval. It would also throw away the
   licensing model above.
3. **Revive it.** Add `next` and `react`, add a real build, change the deploy.
   That forks the product into two front-ends over one database, and the Express
   side is the one with the tests, the tenant guards and the release chain.

Nothing here recommends one. What is fixed is that the release chain no longer
reports these tables as used.

## Known and deliberate

- **Fourteen entries in `data/open-source-tools.ts` still carry a generic
  `https://github.com/` placeholder.** The gate warns about each on every run.
  They are resolved one at a time with the licence read from the project, not
  assumed — Remotion turned out not to be MIT, and requires a paid company
  licence above a size threshold.
- **The language control translates roughly 12% of a page** — navigation,
  buttons and headings. It now says so before you choose. Full translation needs
  human translators.
- **No customer schedule has ever run, and the workflow reports success every
  hour.** Two independent blockers, both measured on 5 September 2026 rather
  than inferred:

  1. `SONARA_SCHEDULE_TICK_SECRET` is not set as a repository secret. The
     workflow's first step warns and exits **0** — deliberately, because an
     unconfigured scheduler is a product with no scheduled work rather than a
     broken one. Ten runs, all green, each about one second, which is far too
     fast for the HTTPS call it would otherwise make.
  2. **The deployed commit does not contain the endpoint.** Production serves
     `eebc80c` (confirmed from `/api/health`) and has since 5 August;
     `POST /api/agents/schedule/tick` returns
     `404 {"ok":false,"code":"not_found","message":"Unknown route."}`. The route
     arrived after that commit, so setting the secret alone would change a green
     no-op into a red 404.

  Both are now named by the workflow rather than left to a generic message, and
  `tests/the-deployment-config-can-actually-deploy.test.js` holds the 404 branch
  in place. **Order matters when closing this:** deploy first, then set the
  secret. Doing it the other way round turns a quiet workflow into an hourly
  failing one for no gain.

- **A finished page nobody can reach: `/free-launch-stack`.**
  `routes/free-launch-stack-routes.cjs` is 34 lines of complete markup for a
  free-tools directory. It has never been mounted in `server.js` on this
  branch's history, no test named it, and nothing claimed it worked -- so
  requesting the path returns 404 and nothing was wrong, which is exactly why
  nobody noticed. `scripts/wire-free-launch-stack-local.cjs` exists to patch
  `server.js` and add the mount; it was never run.

  **This is an owner decision, not a bug to fix on the way past.** Mounting it
  publishes a public page, and `AGENTS.md` sets a bar for what those have to
  be -- polished, dark-first, marketable. The three options are: mount it after
  reviewing the copy, delete it and the wiring script, or leave it recorded.
  `tests/a-route-module-nobody-mounts-serves-nobody.test.js` holds it in a
  two-sided register meanwhile, and would fail the day a *second* route module
  is written and never wired.

- **Thirteen tables have RLS enabled with no explicit policy**, which closes them
  to everything except the service role. That is the intent, and the deep
  verification reports it every run.
