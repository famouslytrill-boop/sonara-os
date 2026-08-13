Newest first. Each entry says what changed, what was verified, and what the next
person should not have to rediscover. This is the hand-written half of
`docs/HANDOFF_PROMPT.md`; everything else in that file is generated.

### 2026-08-13 — An applied migration could be edited and nothing would notice

`scripts/generate-member-read-policies.cjs` carries this warning, in its own
words: *"Once a migration has been applied in production it is recorded as done
and never read again, so editing it changes the repo and nothing else —
silently. Every check in this repository reads the file, so they would all pass
while production sat without the policies."* It refuses to **write** an applied
migration, because the comment alone had not stopped the mistake happening once.

Nothing stopped a hand edit. Deleting all **33** `create policy` statements from
`20260728120000_member_read_policies.sql` — an applied migration — left
`pnpm run verify:launch` **completely green**, all twenty-two commands. The repo
and production would have diverged with no signal anywhere.

`scripts/verify-applied-migrations.mjs` pins the content of every migration the
repository declares applied, and `supabase/applied-migration-checksums.json`
holds the hashes. Editing one fails the build and names the only correct fix:
put the change in a new migration. Deleting one fails too — a migration that has
run cannot be un-run by removing the file.

**The first version left the same hole one file over, and was widened before it
shipped.** It pinned only the three names in `APPLIED_MIGRATIONS`, a hand-kept
list naming the member-policy migrations. But
`20260728130000_sync_published_catalog_names.sql` is a generated migration its
generator has *moved past* — it will never be rewritten, so it can only change
by hand, and a hand edit cannot reach production. It was not on the list.

So the rule is inverted. A migration is **writable** only while a generator
still owns it, and every generator names its current output — so the set is
derived rather than remembered. Everything else is frozen the moment it is
pinned: **80 migrations, not three.** Being on `main` is deliberately not used
as the test; the application deploys on merge and `supabase db push` is a
separate step, so inferring it from git history would be wrong in both
directions.

**Re-pinning by habit is refused.** `--write` adds a hash for a file that has
none and will not change one for a frozen migration. Without that this would be
a checksum anybody could rewrite, which is a check that reports success for
whatever it was last shown — and naming that risk in a comment while leaving it
open is the shape of the defect, not a guard against it.

**The empty-list case is a failure, not a pass.** An empty `APPLIED_MIGRATIONS`
would make every assertion vacuously true and report success having pinned
nothing, so it exits non-zero instead.

**Verified.** 1802 tests passing, chain now twenty-three commands. The test
removes every policy from a frozen migration and requires the checker to fail;
hand-edits the superseded generated one the narrow version missed and requires
both the check *and* the regenerate to fail; and deletes a file and requires a
failure again. A checksum file nothing compares looks exactly like one that is
compared.

### 2026-08-13 — Three Growth Studio forms that could never save

Fill in each Growth Studio create form and press the button. **Three of eight
came back 400**, and all three failed the same way: the handler required
something no form had a field for, so the refusal named a field the customer
could not see.

- **Segments** wanted `segment_definition`, an object. The form collects a name,
  a description and a status. Every submission failed, so the only way to create
  a segment was to hand-craft an HTTP request — which is exactly what
  `lib/sonara-growth-create-specs.cjs` was written to stop.
- **Experiments** wanted two variants whose weights sum to one. The form offered
  no variants at all.
- **Consents** validated `channel` against a closed list. The form rendered it as
  free text labelled "email, sms, post, phone", and **"post" has never been on
  that list** — a customer who took the label at its word got
  `consent_fields_required` naming no field.

This is the `item_name` defect again, and the reason it survived is the same:
the existing tests post a body assembled by hand, and a body you assemble
yourself cannot be missing a field.

**The fixes are not symmetrical, because the three causes are not.**

Segments: the handler now builds the definition from the words the form already
collects, stored as `{ described_as: … }`. **Not** a JSON rule box — nothing in
this product reads `segment_definition` back to work out who is in a segment, so
a rule builder would look like a filter the product applies and would not be
one. The separate key keeps that honest for whoever writes the evaluator.

Experiments: two named sides, split evenly. The split is not a field, because a
weight a customer has to get right is a weight that stops the save.

Consents: one list, exported from the specs module and imported by the handler.
Two copies of a rule is the shape every drift in this codebase has taken.

**The check that was missing.**
`tests/every-growth-form-can-actually-save.test.js` builds its bodies **out of
the rendered HTML** — every input by name, every select's first real option,
every textarea — and requires a write. It also refuses a submission that logs
an audit event and saves no record, which would otherwise satisfy "something was
written". Deleting the variant fields again fails it, naming the endpoint and
the body its own form produces.

**Three findings that were not defects, recorded so they are not re-investigated.**
`consent_basis_attested`, `primary_metric` and `assignment_unit` are form fields
with no matching column, and all three are deliberate: the handlers route them
into `provider_response` and `metadata` jsonb explicitly. A sweep that assumes
every form field is a column reports these, and they are correct as they are.

**Verified.** `pnpm run verify:launch` green, 1795 tests passing. All eight
Growth Studio forms now save what they collect; the experiments form writes the
experiment plus two variant rows at 0.5 each.

### 2026-08-13 — An approved agent action actually runs

`/owner/agent-activity` carried a card saying approving was not wired up, and it
was right: approving has to do two things, record the decision and re-run the
action, and nothing re-ran anything. The runner is called per request by the
page wanting work done, so an approval had nowhere to live and nothing to
consume it. A button that wrote `approved` and changed nothing else would have
told an owner their refund was authorised while no refund existed.

**The queue is its own table, and the reason is one column.**
`agent_action_logs` deliberately stores no payload — an audit trail must not
become a second copy of the data with different retention — so a refused refund
in it records that a refund was proposed and not which one, for how much.
Re-running needs the action's inputs. The nineteen `entity_*` tables from
migration 008 have the right shape and key on `entity_id`, which has no
organisation. So `agent_pending_actions`: organisation-scoped, holding the
action, its inputs, and the owner's decision.

**Approving asks the gate again.** `lib/sonara-agent-queue.cjs` builds the
approval and calls the same runner that refused it, with the classification
re-derived from the action type rather than read off the row — a stored
classification is a column the subject can write, which is why
`decideExecution` already refuses to trust `requires_approval`.

**Approving is not running, and the page says which happened.** Approving an
action nothing implements writes `unimplemented` and the row reads "You approved
this. Nothing in the product performs it yet, so nothing has happened and
nothing was changed." That is the whole point: the failure being avoided is a
screen reporting a job as done when it was not.

**One handler, deliberately.** `approve_scheduled_content` sets one
`growth_content_queue` row to approved, scoped by `organization_id` in the
filter and not only by id — the service key bypasses row level security, so that
filter is the tenant boundary. PostgREST answers 200 with an empty array when a
filter matches nothing, which is what another organisation's id looks like, so
an empty result is a failure here rather than a success. Registering a handler
is how a capability becomes real, so the list grows one reviewed line at a time
rather than through a generic executor that runs whatever it is handed.

**Two clicks run the action once.** `running` is a claim: approving moves the
row out of `waiting` with a conditional update before the action runs, so the
second click finds nothing to take. It is a state rather than a lock because a
run that dies part way has to be visible as "started and did not finish".

**Two things found while wiring it.** `requireCustomer` and
`requireBusinessManager` hang the signed-in user off different properties, so
reading only the page's one made every queue endpoint answer `setup_required` —
a 503 that looks like an unconfigured database and is a missing property name.
And the page returned early on an empty log, which was right while it only read
a log and wrong once it was also where an owner decides and hands an agent a
job: the one screen with something to press had nothing on it at exactly the
moment an owner had never used an agent. The empty log is a card now.

**Verified.** `pnpm run verify:launch` green, 1789 tests passing. The loop was
driven through Express: propose, queue, approve, and the `growth_content_queue`
row actually changing to approved. Both key assertions were confirmed to bite —
replacing the re-run with a bare state write fails with "the owner approved and
the record did not change", and removing the `state=eq.waiting` claim fails the
run-once check.

**Still true, and worth keeping true:** nothing proposes actions on a schedule.
An action reaches the queue because somebody asked for it. There is no
background agent, and this change does not add one.

### 2026-08-13 — The legal position stated as a disclaimer rather than a pending review

`/readiness` reported `legalPages: review_required`. It rendered as "Legal
pages: Review required", in a list beside "Payment connection: Missing" and
"Checkout: Setup required" — items somebody closes by doing something. Nobody
could close this one. A qualified legal review is a decision about engaging
counsel, made outside this repository and with a cost, and no change to this
code moves it.

`docs/SHIP_READINESS.md` had already reached that conclusion and taken the item
off the owner's list, for exactly that reason. The readiness surface had not
caught up, so the permanent open item had moved rather than gone — same
sentence, different page.

It now reports `published_with_disclaimer`: the pages are published and every
one says it is not legal advice. That is finished, and has no next step.

**Derived, not declared.** The old value was a literal nothing could make
false. `lib/sonara-legal-position.cjs` owns the disclaimer sentence, `legalPage()`
renders it, and the status is computed from the page list and the sentence — so
deleting the disclaimer changes what `/readiness` says. Three answers, not two:
an empty page list returns `no_legal_pages` rather than passing vacuously, which
is the shape this codebase keeps finding. A caller that forgets to inject the
reader gets `unknown`, not the good answer.

**The line this does not cross.** Dropping "review required" and asserting
"reviewed" are different acts, and only the first happened.
`legalReviewBoundary: not_attorney_reviewed` is untouched, every legal page is
checked to claim no attorney review, `docs/legal/LEGAL_REVIEW_REQUIRED.md` and
`COUNSEL_REVIEW_BRIEF.md` still hold the review itself, and the new test fails
if either document is deleted or emptied — taking an item off a setup list must
not quietly answer the question it asked.

`scripts/smoke-live-routes.mjs` now asserts both values against the live site
rather than one. `legalReviewBoundary` is the half somebody could drop without
anybody noticing, and it was the half nothing watched.

**Verified.** `pnpm run verify:launch` green, 1777 tests passing. Every route
serving legal text was rendered and checked for the disclaimer — the routes are
read off Express rather than from a list, so a new legal page is covered the day
it ships. Replacing the disclaimer with a sentence that does not say "not legal
advice" fails 23 tests, including the new one.

### 2026-08-13 — The artist system built, and a contract that was reading two of three directories

Migration 016 created eight tables with row level security and indexes.
`routes/creator-artist-system-routes.cjs` was the only code that read five of
them, `server.js` never required it, so its pages 404ed and the tables were
never written in production — they read as *used* because a file existed that
would have used them, had anything loaded it. The module was deleted and
`lib/sonara-orphan-tables.cjs` recorded the choice: build the workspace
properly from the real columns, or drop the tables. It is built.

**Five pages**, through the same record-page machinery as everything else, so
there is no second code path to fall out of use the way that module did:
`/creator-studio/artists`, `/sound-identity`, `/album-cycles`,
`/prompt-blueprints`, `/video-treatments`. The four children require
`artist_profile_id` — it is nullable in the schema, and a row without one would
be invisible on every page, since each lists by organisation and belongs to no
artist.

Three column kinds are deliberately absent from the forms: the jsonb rule
blocks, `keys_allowed` (text[]), and `video_treatments.track_id`. A text input
posting into jsonb or an array produces a failed insert or a shape nothing
reads back.

**The picker was going to be dead on arrival.** The creator page renderer
called `formCard(page, {}, ui)` — harmless while no creator page had a
reference field, wrong the moment one did. All four artist pickers would have
read "Nothing to choose yet — add one first" to a customer with artists. That
exact failure is recorded above `loadReferences`, where it shipped on the owner
pages. The nav was also a hand-written list of four links sitting on what is
now nine pages; it is generated from the pages themselves.

**Not a second prompt library.** `creator_prompt_blueprints` and
`sonara_prompt_templates` both hold prompt text, and the difference is not
obvious, so the page says it: the library is where a prompt lives, with
versions, provenance and licence status; a blueprint is a rule for one artist —
what a track needs before a prompt is written from it, and how long it may be.
The library has no column for either.

**The contract was reading two of three runtime directories.**
`scripts/verify-supabase-contract.mjs` scans the runtime for table references
and failed anything uncontracted. It read `server.js` and `routes/` and not
`lib/` — which is runtime, is where the record pages and record checks live,
and is the same directory the production deploy gate greps for its paid-access
markers. Widening it surfaced **seven** more tables the application reads and
this contract had never named: the detail rows under purchase orders, stock
counts, transfers and vendor invoices, plus `pos_menu_mix_items`,
`employee_wage_rates` and `reviews`.

`BUSINESS_OPERATIONS_TABLES` also turned out to pass through no create-or-RLS
check at all — it existed only to stop the runtime scan failing, so a table
could be listed as reviewed and exist nowhere. It now goes through
`verifyExtension` against the five migrations that create its members.

**Verified.** `pnpm run verify:launch` green, 1769 tests passing, 0 orphan
tables. The five pages were rendered and posted to through Express: each
returns 200, its form points at a registered endpoint, the artist picker shows
a real artist, a save reaches the right table scoped to the organisation, and a
child with no artist writes nothing. Both new checks were confirmed to bite —
a table listed under operations that no named migration creates fails, and
dropping `lib/` from the scan makes it pass while blind.

### 2026-08-13 — The pricing restructure applied, and one ladder on the page

`docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md` argued for pricing **breadth**
— how many of the three workspaces you get — instead of depth. It is applied.

**The three new plans.** `workspace_monthly` $19 (any one workspace),
`all_three_monthly` $39, `team_monthly` $79 (all three plus the staff portal).
They live in `lib/sonara-stripe-plans.cjs` and carry no Stripe price until the
owner creates one, so they render "Not open for checkout yet" and cannot break
anybody's checkout. **Starter / Core / Pro are untouched.** Stripe prices are
immutable, and an existing subscriber has to keep paying what they agreed to.

**$19 buys one workspace, not three.** `SINGLE_WORKSPACE_PLANS` and
`billingRowOpensProduct` in `lib/sonara-paid-access.cjs` are what make that
true: a `workspace_monthly` row opens a product only if
`metadata.workspace` names it. Both match points in
`lib/sonara-paid-entitlement.cjs` call it, and both selects now ask PostgREST
for `metadata`. A row with no choice recorded fails closed with
`workspace_not_chosen` and a sentence telling the customer to pick — listing
the key without this check would have made $19 buy what $39 is for.

**One ladder on the pricing page.** Listing every key put eight plans on it,
two priced $19 and two priced $39, containing different things. The obvious
half-fix — hide the old ladder — empties the page, because the new plans have
no Stripe price yet and every card would say "not open". So `offeredPlanKeys`
takes two rules: a superseded plan drops off once its replacement **can be
bought**, and a replacement stays off until it can be, for as long as any plan
it replaces still works. The page switches ladders by itself when the owner
creates the prices, and there is no state where nothing is purchasable.

The "any", rather than "its own predecessor", is deliberate: keyed to its own,
a Pro whose price variable went missing would pull All three onto the page
unbuyable beside it — two $39 plans, arriving from a misconfiguration.

`Team` is not hidden, because nothing supersedes into it. It appears saying it
is not open yet, which is what every unpriced plan does. Hiding every unpriced
plan would be a tidier page bought by making a missing price invisible.

**The prose moved with the cards.** "Pro covers all three for $39" was written
out in two places and Pro is not on the new page; the successor is called
"All three", which would have made it "All three covers all three for $39". The
sentence is now `All three cost $39 together`, derived from the cheapest offered
plan marked `coversAllThree`. "Which plan should I pick?" is built from the
plans that are actually buyable, cheapest first, and says paid plans are not
open yet when none are.

**Pro against Core.** Both open all three workspaces, so after the August
widening Pro had nothing exclusive. Locations are what separate them:
`INCLUDED_LOCATIONS` gives Core 3 and Pro unlimited, enforced at
`routes/sonara-last9-routes.cjs:706`. `all_three_monthly` inherits Pro's
unlimited rather than a fresh middle rung — the restructure doc says it *is*
Pro renamed at the same price, and giving it three would make the rename a
reduction discovered at a customer's fourth site.

**Two checks that had gone blind, found by moving the table.**
`tests/dashboard-setup-doc.test.js` parsed price env vars out of `server.js`
source with a regex; the moment the table moved it found zero, and "no env var
is missing from the doc" was true of an empty list. Its own guard caught it, and
it now reads the table object. `tests/database-query-contract.test.js` pinned a
`doesNotMatch` on a PostgREST select string that the added `metadata` column
would have slipped past.

Also: `module.exports = STRIPE_PLANS` with `offeredPlanKeys` hung off the same
object put a function into the plan table, so `Object.entries` yielded a ninth
"plan" the pricing page would have tried to render. The table is now frozen and
exported under a name.

**Verified.** `pnpm run verify:launch` green, 1745 tests passing. The pricing
page rendered under five environments — nothing connected, legacy only, legacy
with Pro misconfigured, partly switched, fully switched — and each shows one
coherent ladder with no two plans at the same price. `server.js` 4122 → 4065
lines; the ratchet came down to 4066 and was confirmed to fail at 4068.

**What the owner still has to do:** create the three Stripe price objects
(`STRIPE_PRICE_WORKSPACE_MONTHLY` $19, `STRIPE_PRICE_ALL_THREE_MONTHLY` $39,
`STRIPE_PRICE_TEAM_MONTHLY` $79) and set them in production. Nothing else is
needed — the page switches on its own.

### 2026-08-13 — The tap-target rule, checked against a class nothing renders

AGENTS.md: "Mobile layouts must avoid overflow and use large enough tap
targets." **Both rules hold.** Neither was being checked.

`tests/design-system.test.js` asserted `--sonara-tap: 44px` and
`max-width: 100%` appear in `public/sonara-design-system.css`. The token is
real. The only selector consuming it is `.sonara-ds-button`, and the
application never renders one: across six representative pages the interactive
elements are 43 bare `<button>`, 41 `a.action`, 39 bare `<input>`, 14 `<select>`
and 2 `<textarea>`. Not one `.sonara-ds-button`.

The rules that actually govern those controls live in
`public/sonara-application-ui.css`, and had nothing watching them. Strip every
`min-height` from the selectors the product renders and every control collapses
-- while the design-system assertion stays green, because it is reading a
different file about a different class.

`tests/mobile-rules-hold-on-what-is-rendered.test.js` scrapes the controls off
rendered pages and checks the served stylesheet against those, refusing to
assert about a selector the sample does not contain. It also checks the two
halves of the overflow rule that matter on a phone: the body must not scroll
sideways, and a record table -- wider than any phone -- must scroll inside
itself, or its columns are simply unreachable.

**One correction worth recording.** The first attempt to prove the new check
bites deleted the 46px rule and the check still passed, which read exactly like
a check passing for the wrong reason. It was not: a second rule gives the same
selectors 48px, so the guarantee genuinely still held and the experiment was
wrong rather than the check. Removing *every* `min-height` on those selectors
fails it, naming each control and how many of them are on the page. Being wrong
about which of the two was broken is the easy mistake here, and worth the extra
five minutes it took to find out.

The old assertion is kept and renamed to what it does -- the token is the right
place for the number, and a token quietly changed to 20px should still fail
something.

Verified: `pnpm run verify:launch` green end to end, 1,737 tests passing.

### 2026-08-13 — The document the owner reads to decide whether to launch

`docs/owner/WHAT-IS-LEFT.md` said "`pnpm test` is at 1347 passing and the
eighteen-command `verify:launch` chain is green". The suite was at 1,733 and the
chain at 21. Its by-the-numbers block was stale in five more places: 242 routes
against 248, 301 tables against 302, 66 reviewed repositories against 82, 22
owner record pages against 23.

Every figure was right when it was written. None had anything watching it, which
is the whole point: this is the document somebody reads to decide whether the
thing is ready, and it was describing a repository three weeks behind.

`scripts/verify-doc-counts.mjs` checks the two kinds of countable claim a live
document can make. A chain length must match `verify:launch`. A **passing test
count may not be stated at all** outside a generated document -- it is stale the
next time anybody adds a test, and there is no version of it a hand-written file
can keep true.

Four things had to be right for the check to be worth having, and three of them
were wrong first.

`docs/HANDOFF_PROMPT.md` is generated and embeds the sprint log verbatim, so
every historical "1,733 tests passing" reappeared in it -- the check was reading
the same history twice and calling it a live claim. Two audit files open with
"Date:" and "Verification date:", which makes them records of a day in the same
way the sprint log is; correcting their counts would make them worse records, so
the rule is a dated marker near the top rather than a list of filenames.
`1,733` was read as `733`, because the pattern did not allow a thousands
separator and the error quoted a number nobody had written. And
`**21** verification commands` never matched at all, because emphasis sits
between the word boundary and the digits -- so after the fix the check passed
having examined **zero** claims. It refuses that now: no claim found anywhere is
reported as the patterns having stopped matching, not as everything being fine.

Adding the check to the chain made the chain 22 commands and the sentence I had
just corrected wrong again, which the check caught on its first real run.

Verified: `pnpm run verify:launch` green end to end across 22 commands.

### 2026-08-13 — The write half of the outage crawl, which found nothing

The third of the outage crawls, and the one with the worst consequence if it
had found something: what a customer is told when their record could not be
**written**. They close the tab believing it saved.

**Nothing needed fixing.** Every endpoint that reaches a write reports the
failure, by redirecting back with `?problem=` or answering `ok: false`. That is
worth recording as a result rather than a non-event -- it is the half of the
application this sprint has not had to correct.

The check stays, because the shape it looks for is one line away at any time.
Making a failed insert redirect as though it saved fails it in sixty-six places.

**What it does not cover is stated rather than implied.** 74 endpoints are
create-shaped; a generic body plus every declared form field gets 40 of them as
far as a write. The other 34 reject earlier on validation of their own --
consent requirements, provider contracts, market-intelligence scoring -- and
modelling each one's valid input is a different piece of work.

That distinction is the whole reason the file exists in this shape. The first
version of the probe reported **"74 of 74 report failure honestly"**, which was
true and meaningless: 42 were being rejected before the write, so it was
measuring the validation path and calling it the write path. A hundred percent
on a check is a reason to ask what it reached, not a reason to move on.

Verified: `pnpm run verify:launch` green end to end, 1,733 tests passing.

### 2026-08-13 — The same crawl against the API, and a field called ok

The companion to the page crawl: every JSON GET, with the database answering
nothing, reading what a consumer of the API is told rather than what a page
renders.

**Four endpoints answered `ok: true` with an empty list.** They were not
careless -- they put the real outcome in a second field, `saved`, leaving `ok`
to mean "the request was handled". That is a defensible convention and it is not
the one the rest of this API uses: 68 other JSON GETs answer a failed read with
`ok: false` or a 4xx. Worse, `createChecklistItem` returns `ok: false` for the
same two setup conditions `listChecklistItems` directly above it reported as
`ok: true`, so one file answered one question two ways depending on whether you
were reading or writing. A field called ok is read as ok.

"The read failed" is now also distinguishable from "setup was never done".
`code: "setup_required"` was returned for both, and a consumer would retry one
and not the other.

**And the first version of the check was measuring four endpoints while reading
as though it covered the API.** It skipped anything without a
rows/records/items field, which was 63 of 67. Counting all of them found
`/api/growth/metrics` answering `ok: true` over a response in which every figure
was null -- honest per field, and the envelope said success. It reports
`countsRead` now and is false only when nothing at all could be counted, because
a partial read is already described precisely by the nulls.

Reintroducing both regressions fails the crawl in twelve places; that was tried
rather than assumed.

Verified: `pnpm run verify:launch` green end to end, 1,731 tests passing.

### 2026-08-13 — Rendering every page with the database down

`tests/signed-in-workspace-crawl.test.js` crawls with the database answering and
empty, which is the state a new customer is in. Nothing crawled with it
answering nothing at all, which is the state everybody is in for the few minutes
a year it happens -- and the state where a page is most likely to tell somebody
something false about their own records. 197 pages render in it. Four were
lying.

**The billing panel told a paying customer they had no plan.**
`getBillingPanelSummary` returned `{ status: "No subscription records
returned.", rows: [] }` when the read failed, and that string renders on the
billing page as a statement about the customer's subscription. Somebody paying
$39 a month, on a bad day for the database, was told no active paid plan was
found. That is the one place in the product where being wrong in that direction
costs a cancellation rather than a support ticket.

**All three workspace dashboards said "No activity yet."** The read outcome was
dropped before the card saw it -- while `countLabel` on the same card already
answered "unavailable" for a failed count, so the two halves of one card
disagreed about what a failure looks like.

**Two card headings contradicted their own bodies.** "No areas yet" and "No
consent records yet" printed above text explaining the read had failed. A
customer skims headings, and a creator reading the second could reasonably
conclude a permission they had recorded was gone.

The crawl is `tests/no-page-lies-when-the-database-is-down.test.js`, with an
excuse list for prose that matches the pattern and is not a claim about records
-- the earnings disclaimer, "nothing is sent from here", "nothing here has been
sent". Each entry says why.

Two weaknesses in the check itself, both found before trusting it. It excused
against the matched fragment rather than the surrounding sentence, so the
billing panel's own new failure wording arrived as "nothing here" and no excuse
for the full phrase could ever fire. And it examined only the **first** match on
each page, so a page whose opening safety statement is excused could carry a
real claim further down and never be looked at -- a check going blind exactly
where a page has the most to say. Reintroducing the dashboard regression now
fails it in six places; that was tried rather than assumed.

Verified: `pnpm run verify:launch` green end to end, 1,728 tests passing.

### 2026-08-13 — A scan of the whole tree, and three pickers that never worked

Swept 30,491 lines of runtime across 97 files for the failure shapes this
sprint has been finding. Most instances of `result.ok ? rows : []` turned out
to be fine -- the outcome travels in the returned object, and
`lib/sonara-cash-position.cjs` and the Creator Studio consent list both already
reason about the failure explicitly, in comments, with the right answer. What
the scan found was elsewhere.

**Three reference pickers on line forms had never worked.** `loadReferences`
read `page.form.fields` only, and `lineFormCard` called `formField` with an
empty references object, so every reference field on a child line form rendered
"Nothing to choose yet -- add one first" regardless of what the business had.
The service picker when writing an invoice line is the one that matters: it
predates this sprint by a long way, and a business with a full service catalogue
was being told to go and add a service first. The stock picker on a recipe
ingredient and the menu picker on what sold were mine, added last week and
broken from the moment they were written.

The detail handler never loaded references at all, which is the other half of
it. Both halves are fixed, and the invoice-line picker was checked through the
rendered page rather than by reading the code.

**And a picker now has three states rather than two.** A failed read collapsed
to the same empty array as a source with nothing in it, so "we could not load
your customers" and "you have no customers" were the same sentence -- and the
second one tells a business to create records it may already have hundreds of.

One note on the test harness. The first version of the picker assertion said
"although the stub returns rows for every table", and the stub did not: it
answers for parent and line tables and returned nothing for the tables behind
the pickers. The stub was strengthened rather than the claim weakened, because
the other way round is a check that passes for a reason unrelated to what it
says.

Verified: `pnpm run verify:launch` green end to end, 1,724 tests passing.

### 2026-08-13 — Rendering the day page, which nothing had done

The labour work shipped with two test files that both passed and neither of
which had run the page. `tests/what-a-day-made.test.js` calls `derivedCard`
directly with hand-built arguments; `tests/labour-cost.test.js` calls
`labourCostForDay` directly. The wiring between them -- the handler awaiting
`derivedReads`, threading its result in as a fourth argument -- was never
executed by anything, and a mistake anywhere along it leaves both files green
and the page without a figure on it. That is the defect class this repository
keeps finding, arrived at from the inside.

It does work, and now something says so.
`tests/the-day-page-renders-its-own-figures.test.js` opens
`/business-builder/owner/sales/:id` through the real handler and reads the card
off the rendered HTML. Breaking the wiring -- dropping the fourth argument --
fails three of its six checks; that was tried before trusting it.

Two things it asserts that the unit tests could not. The extra reads go out with
the service key, which bypasses row level security, so **the organization filter
in the query is the only thing between one business and another's payroll** --
checked against the query strings that actually left, not against the code that
builds them. And the hours query is bounded to the day being looked at rather
than reading every entry a business has ever recorded, which is how a page gets
slow without anybody noticing.

Verified: `pnpm run verify:launch` green end to end, 1,721 tests passing.

### 2026-08-13 — The labour half, and four ways it is not knowable

Each day under Daily sales now costs its own labour: hours from
`employee_time_entries`, rates from `employee_wage_rates`, joined on the date
the rate was in force. That completes the food-and-labour figure the restaurant
schema has held since migration 014 and nothing has ever produced.

`lib/sonara-labour-cost.cjs` is mostly refusals, and that is the point. A labour
figure is a number a business prices against, and the obvious version of this
join is confidently short in four ways:

  * a shift still clocked in has no end, so its hours are unknown, not zero
  * a salaried person cannot be divided into a day by multiplying hours -- eight
    hours times a £4,000 monthly rate is a labour cost of thirty-two thousand
  * somebody with no rate on that date costs an unknown amount, not nothing
  * a break longer than the shift is bad data, not negative work

Each is counted and named to the customer, because a figure missing three people
reads exactly like a complete one. When anything is missing the wording changes
to "labour at least X, leaving at most Y", and says which people it left out.

The card still never says profit. It says food and labour only, and that rent
and energy are not in it.

Two mechanical notes. The detail handler grew a `derivedReads` hook, because
hours and rates are not children of a sales summary; it hands the page a
**scoped** list function rather than the Supabase config, so a page cannot write
a query that forgets the organization filter -- the one mistake that would let
one business read another's payroll. And `finiteNumber` moved to
`lib/sonara-numbers.cjs`: the labour module needs it and the record pages now
need the labour module, which is a require cycle. It is re-exported from its old
home because enough modules import it from there that moving them would be
churn.

Two mistakes worth recording. The guard that was supposed to add the new require
read `if ("sonara-labour-cost" not in source)` -- and the source already
contained that string, in the comment pointing at the file, so the require was
never inserted. Second time in two changes that a check has been satisfied by
prose about itself. And a test fixture gave one employee both no rate and
impossible hours, expecting both to be reported; the hours check runs first, so
the no-rate case was never reached and the assertion for it failed. The fixture
was wrong, not the code.

Verified: `pnpm run verify:launch` green end to end, 1,715 tests passing.

### 2026-08-13 — Three more copies of the confident zero, outside the record pages

The general sweep reads column definitions, so it cannot see anything that
renders through its own formatter. Three did.

A Creator Studio generation job with no progress reported showed **0%**, which
reads as started and stalled rather than nothing has said yet. And the Growth
Studio conversion totals summed `Number(row.value || 0)` in two places, so a
sale with no value recorded counted as zero and vanished into the figure -- a
total short by however many sales are unpriced, presented as the value of every
sale. The figure now sums only the rows that carry a value and says how many it
left out, in the API's `computedOver` and in the label on the totals card.

**The first version of the check failed on its own comment.** It searched the
source for `Number(x || 0)` and matched the comment written directly above the
fix, which quotes the pattern to say what it replaced. Comments are stripped
before matching now -- the same trap `scripts/verify-open-source-registry.mjs`
hit reading a type union out of a file whose comment contained a semicolon. A
regex over source is a regex prose can satisfy.

Verified: `pnpm run verify:launch` green end to end, 1,699 tests passing.

### 2026-08-13 — What a day made, and the wage rates that were blocking it

`employee_wage_rates` had a schema, row level security and no page. That is why
labour cost is not computable anywhere in this product: hours are recorded on
`employee_time_entries`, rates were not recordable at all. It sits under Staff
now, as a child of the person it belongs to -- the same relationship recipe
ingredients have to a recipe.

With that unblocked, each day under Daily sales states its own food cost: net
sales off the day, food cost from the menu mix, and the share of sales it
represents. The card **does not call the remainder profit.** In a food business
labour is the second-largest cost after food, so a "gross profit" that quietly
omits wages is not an approximation, it is a wrong number somebody might price
against. It says "before labour" and says why labour is not in it, and there is
a test asserting the word profit never appears.

`/business-builder/owner/costs` says the narrower true thing now: the food-cost
half is on each day, and combining it with labour into one figure per day is
still not built.

Three things in the test harness were wrong and only showed up because a child
with a required *date* arrived. `requiredBody` filled every non-numeric required
field with the word "Something", so a date column was posted the string
Something -- accepted by the stub, rejected by Postgres, which means the harness
was exercising a path no real submission takes. And "will not take the
organization from the form" hand-wrote a body with `item_name` against
`WITH_LINES[0]`; adding a child changed which page came first, its form asks for
an amount and a date, and the submission was rejected before the tenant check it
exists to run could happen. It builds the body from the page's own form now,
which is the lesson this file had already learned once and applied everywhere
except there.

Verified: `pnpm run verify:launch` green end to end, 1,697 tests passing.

### 2026-08-13 — The half of the audit that nobody would have read

*Selling Your Work* is free, on the owner's instruction. The only page that does
it is a free one, so a Starter floor charged for something a signed-in customer
already had. Ten of twenty-three products are free now, three Starter, eight
Core, two Pro.

**And the audit before this one fixed the wrong half.** It trimmed nine
`capabilities` lists to what their page renders and left every `summary` alone.
`capabilities` is internal and nobody outside this repository sees it; `summary`
and `customerOutcome` are printed on the catalog card a customer reads before
paying. So "Products, services, licences, bundles, prices, delivery files,
payment links, and your refund position" stayed on a product whose page drafts
one offer and saves it, next to a capability list that had been cut to three
honest items.

Seven summaries rewritten. Research & Roadmap no longer claims scored
opportunities or live experiments; One Connected Account no longer says files
stay in one place, because `/dashboard` holds none; Landing Pages & Results no
longer describes a path through a form, a booking and a payment; Connection
Health no longer offers limits, retries, costs and where you are being
mentioned.

`tests/the-catalog-copy-claims-nothing-unbuilt.test.js` is the list of phrases
no product may use and the reason each one is not there to promise -- bundles,
delivery files, payment links, UTM, refund position, scored opportunities,
validation portfolio, referral tracking, answer-engine, renewal reminders, CSV
mapping, file storage. It reads the customer-facing fields, not the internal
one, which is the mistake it exists to catch.

It found one I had missed by hand: *Connected Accounts* still offered "safe
connections to payments, email, publishing, **file storage**, and analytics",
after the storage product itself had been rewritten. A phrase outliving the
thing it described is exactly what a hand pass misses and a list catches.

Verified: `pnpm run verify:launch` green end to end, 1,690 tests passing.

### 2026-08-13 — Opening all twenty-three products and reading what they render

Every catalog product opened as a paying customer, with its page compared to
what its row claims. **Six were pointing at the wrong page and three more were
claiming work that is not built anywhere.**

The worst was *Quotes, Invoices & Getting Paid*, at `/business-builder/billing`
-- the customer's own SONARA subscription, with "Upgrade: Starter" and "Manage
billing portal" on it. A product about invoicing their customers sent them to a
page about paying us. It goes to `/business-builder/owner/invoices` now.

*File Storage* claimed file storage, versions, approvals and provenance, at
`/dashboard`. There is no file store a customer can upload to anywhere in this
product -- the only storage path is the signed download of a Creator Studio
generation result -- and the dashboard holds no files at all. It is now what
does exist: `/account/data`, every kind of record the account holds, a download
of all of it, and an erasure request.

*Brand & Asset Library* pointed at the generic Creator Studio workspace index
rather than `/creator-studio/assets`, which is the asset catalogue.
*Logins, Team & Permissions* pointed at `/account/setup`, which renders no cards
at all -- `/account` is where an organization is created or joined. *One
Connected Account* pointed at `/products`, the public marketing index.

**And *Selling Your Work* was wrong for the second time.** The previous change
moved it off the generic setup checklist and onto `/creator-studio/offers`,
chosen because the page *definition* is titled "Offer Records". Rendering it
shows two cards -- "What this tool does" and "Access" -- with no records and no
form. Reading a definition is not reading a page, and the check that existed
asked whether the route resolved and whether the plan opened it. Both were true.
It points at `/creator-studio/offers/free` now, which drafts and saves an offer,
and the claims are cut to that: bundles, payment links and delivery files are
not built anywhere in Creator Studio and the row said all three.

Three capability lists trimmed to what their page shows. *Research & Roadmap*
claimed opportunity scoring and a validation portfolio; the page states a
thesis, a pricing position and a rule about not inventing data. *Landing Pages &
Results* claimed a UTM builder and landing-page forms; neither exists. *Connection
Health* claimed answer-engine evidence and referral tracking; it lists connected
services.

`tests/each-product-does-what-it-says.test.js` renders all twenty-three as an
entitled customer and requires each to show a card of its own -- not the
application frame, and not a placeholder describing what it would do. A page
need not have a form: several products are reports, and demanding a button of
them would be demanding the wrong thing. The card scrape has its own guard,
because a scrape that silently stops matching reports every page as healthy,
which is how the first pass through this looked fine.

Verified: `pnpm run verify:launch` green end to end, 1,686 tests passing.

### 2026-08-13 — Twenty-three columns reporting a number nobody recorded

Started as a sweep of every record column and turned into one fix in three
helpers.

`money()`, `quantity()` and `percent()` all guarded with
`Number.isFinite(Number(value))`. `Number(null)` is 0 and 0 is finite, so a
column with nothing in it printed a confident figure: `$0.00` for a service with
no price, `0` for an item nobody had counted, `0.0%` for a target nobody had set.
Twenty-three columns across the owner and growth record pages did it.
`countText()` and `percentText()` in `lib/sonara-growth-record-pages.cjs` were a
second copy of the same fault.

A stored `0` still renders as `0`. That is the point: absent and zero are
different facts and the helpers can now tell them apart.

Two more of the same shape found on the way. `lowStock` on the Business Builder
snapshot read `Number.isFinite(Number(row.reorder_level))`, which accepts null,
so an item with no reorder level was compared against a threshold of zero and
any item with no quantity recorded counted as low stock -- the headline figure
was inflated by items nobody had set a threshold for.
`lib/sonara-record-checks.cjs` asks the same question correctly with
`Number(row.reorder_level) > 0`; two modules, one question, two answers, and the
wrong one was on the dashboard. And the segments page reported "0 people" for a
segment nobody had evaluated.

**And a bug I had introduced the change before.** `percent()` multiplies by 100,
so every column feeding it holds a fraction. I stored recipe waste as a whole
number and wrote "nothing read this column before, so the convention is set
here" -- true about the column, wrong about the codebase, since every
`numeric(7,4)` percent column in migration 014 is a fraction. A 5% waste
displayed as 500.0%. The customer still types 5; the derive hook stores 0.05.

`tests/no-column-invents-a-number.test.js` is the general check. It reads each
column's fields with a Proxy rather than guessing them -- the first version
probed an all-empty row and missed the menu margin, which only lies when the
price is present and the cost is not -- then removes one numeric field at a time
and requires the column either to say it does not know or not to print a figure.
It was checked against a reintroduced `Number()` guard before being trusted.

Verified: `pnpm run verify:launch` green end to end, 1,681 tests passing.

### 2026-08-13 — A day's takings, and a menu that stopped claiming 100% margin

`/business-builder/owner/menu` has a "You keep" column that reported the whole
selling price as profit, at 100%, for every dish. `theoretical_cost_cents` is
`integer default 0` and nothing writes it, so every menu item a customer had
entered read as costing nothing to make -- on the screen a restaurant uses to
decide what to charge. Zero is read as "never costed" now, which is the same
reading `lib/sonara-record-checks.cjs` already takes when it flags a dish with a
price and no cost. A dish that genuinely costs nothing is not a case a kitchen
has.

`pos_sales_summaries` and `pos_menu_mix_items` have a page:
`/business-builder/owner/sales`, a day at a time with what sold as its lines.

And `/business-builder/owner/costs` stopped promising. Its body said the figures
were "worked out from your own records rather than entered by hand" and its
empty state said they "appear once you have sales and costs recorded" -- but
nothing writes `daily_profit_snapshots`, so they would not have appeared however
much a business recorded. The page is kept, because the table and the
calculation are real work worth doing; what was wrong was telling a customer it
was already happening. It now says which half is ready and which is not built.

**The reverse of form reachability was unguarded, and I walked straight into
it.** `tests/form-reachability.test.js` asks whether every create-shaped POST
route can be reached from a form. Nothing asked the other direction: a page
declaring `api:` for an endpoint nobody registered renders a form that posts to
a 404. The daily sales page was written that way -- the child endpoint is
registered automatically from the child spec, so only the parent was missing,
and the OpenAPI gate flagged the child while saying nothing about the parent.
The button looked exactly like the working ones.

The check for it had to learn the same lesson `lib/sonara-form-reachability.cjs`
did: a page's form may declare its own `action`, so reading `page.api` alone
reported the working time-clock page as broken. Clocking in posts to
`/api/business/time-entries/start`, because it is "start one now" rather than
"create a time entry".

Verified: `pnpm run verify:launch` green end to end, 1,677 tests passing.

### 2026-08-13 — A recipe that costs something, and a total that was short

`recipe_cards` shipped with a page. `recipe_ingredients` shipped with a schema,
row level security, an index and no way to add one, so a recipe was a name, a
yield and a block of method text. Recipe costing -- the number a food business
is actually buying, and what a $350-a-location competitor sells -- could not be
worked out from anything the product held.
`docs/2026-08-12-WHAT-ELSE-CAN-WE-SELL.md` names this table first for that
reason.

Ingredients now hang off a recipe like invoice lines hang off an invoice, using
the child-line machinery that already existed. Two things about it are
deliberate. The cost is **derived, not asked for**: quantity, unit cost and
waste are facts a person knows, and the cost is arithmetic over them, so asking
for both would let the stored number disagree with its own inputs. That is
deliberately unlike an invoice line, where `line_total_cents` is asked for and
stored, because a line total is what the business decided to charge and
recomputing it would overwrite a discount. Nobody discounts a recipe.

`waste_percent` had no reader anywhere, so the convention is set here rather
than inherited: 5 means 5%, written on the field a person types into, and
asserted -- the other reading of `numeric(7,4)` would turn a customer typing 5
into 500% waste.

**Two defects came out of writing the tests for it.**

`Number(null)` is `0` and `Number("")` is `0`, and both are finite. `linesCard`
guarded its total with `Number.isFinite(Number(row[totalFrom]))`, so a line
whose amount had never been entered counted as nothing and the total printed as
"Total of these lines" while being short by however many were blank -- with the
blank cell visible in the same table. That was live on invoices, purchase
orders, stock counts, transfers and vendor invoices. `finiteNumber` replaces the
guard at both sites.

And the detail page read its child rows as `listed.ok ? listed.rows : []`, so an
unreadable line list rendered as `spec.empty` -- "Nothing has been added to this
invoice yet" -- for an invoice whose lines could not be read. The read outcome
travels now, and an unreadable list says so instead.

A smaller one, found by making the mistake: a `reference` field naming no entry
in `REFERENCE_SOURCES` renders an empty picker rather than failing. Writing
`from: "inventory"` before the source existed produced a control that looked
like a way to choose something and offered nothing, and no check objected.
`tests/owner-record-lines.test.js` refuses a dangling source now.

The OpenAPI gate caught the new endpoint, which is the second time this session
it has been the thing that noticed a route with no operation.

Verified: `pnpm run verify:launch` green end to end, 1,673 tests passing.

### 2026-08-13 — Widened what a plan buys, and gave locations a limit

Two owner decisions applied.

**Widened rather than repriced.** Creator Studio moves down to Starter and
Growth Studio down to Core, so all seven products that advertised a plan the
server refuses now open on the plan they name. The two Growth products marked
Starter moved to Core, because `growth_studio` does not open below it. All 23
catalog products execute.

The consequence is written into `lib/sonara-paid-access.cjs` rather than left to
be discovered: **Pro $39 no longer opens a workspace Core $19 does not.** Three
workspaces and three paid tiers make a three-rung cumulative ladder, and moving
two workspaces down spends two rungs. The staff and scheduling features are the
intended answer and they already exist, given away free, against Deputy at $5 a
user. Until they move to Pro, Pro is priced above what it uniquely opens.

**Locations are limited by plan, not billed per location.** Starter 1, Core 3,
Pro unlimited, in `lib/sonara-plan-limits.cjs`, enforced when a location is
created. An add-on would have needed a Stripe price object nothing here can
create; an allowance needs the count and the plan, both already on the request.

`locationAllowance` returns three answers rather than two, and that is the part
worth keeping. A count that could not be read refuses with "we could not check"
and 503, not "you have hit your limit" and 402 -- a reachable state where the
obvious two-valued version tells a customer a definite thing nobody measured.
`null` means unlimited and is kept distinct from `0`, with a test for it,
because `included || Infinity` would turn a deliberate zero into no limit at
all.

**Three copies of the same list collapsed into one.** The deploy gate held its
own transcription of `PAID_ENTITLEMENT_KEYS`, and a test resolved it by parsing
quoted strings out of the gate's source. Widening the map meant editing the
gate by hand; deriving it instead broke the parser, which reported that the
check had gone blind -- correctly, for a reason that was not a defect. The list
is `PAID_ACCESS_RUNTIME_MARKERS` now, imported by both, and it was checked
against a deliberately reformatted mapping before being trusted.

`getCustomerPaidEntitlement` moved to `lib/sonara-paid-entitlement.cjs`, which
took server.js from 4124 lines to 4100 and absorbed the one line the plan-limit
dependency added rather than raising the split ratchet for it. Two things broke
on the move and both are the same shape: `tests/database-query-contract.test.js`
read server.js alone and failed on code that was present, correct and shipped
one directory over -- which is exactly the fault the marker check was written
for after an earlier move of this same function broke a production deploy while
the suite stayed green. It reads the whole runtime now. The const also had to be
built above its first use, because it used to be a hoisted `async function` and
the deps object reads it at module load.

Verified: `pnpm run verify:launch` green end to end, 1,660 tests passing.

### 2026-08-12 — Seven products sold on plans the server refuses

Started as a route fix on "Selling Your Work", which pointed at
`/creator-studio/launch-readiness` -- server.js's generic
`/:product/launch-readiness`, one setup checklist shared by all three products
and not even signed-in gated. The identical fault had been fixed on Business
Builder's exports product a change earlier and missed here, because the two rows
were read a week apart and nothing compared a route to what the route renders.

Checking the plan that product is sold on turned up the larger fault.
`getCustomerPaidEntitlement` matches a subscriber's plan_slug against
`getPaidEntitlementKeys(productKey)`. The catalog decided whether a product's
paid access was real with `hasEnforcedPaidAccess(productKey)` -- whether the
family enforces *anything*. Seven of fourteen paid products fell in the gap:
Creator Studio enforces core_monthly and pro_monthly while three of its products
advertised Starter, and Growth Studio enforces pro_monthly alone while four of
its products advertised Starter or Core. Buying the advertised plan and clicking
the product returned 402 upgrade_required, both halves working exactly as
written and disagreeing about the price.

Worth naming as a pattern, because it is the second time: this is the successor
to `planFloor === "free"`. That one defined verified access as free access; this
one defined it as somebody, somewhere in the family, being able to get in. Both
are true statements about something other than what the customer is being sold,
and both read as reasonable until you ask what question the code is answering.
`planFloorOpensProduct` asks the one the customer is asking.

The seven now report closed, which is honest but is not where they should stay.
Which way they open is a pricing decision -- raise the floor, or widen what a
plan buys -- so it is listed as a work queue with a note per product rather than
decided here.

Two routes also stopped colliding. "Customer & Enquiry Tracker" and "Bookings,
Staff & Day-to-Day" both pointed at `/business-builder/dashboard`; they are the
CRM and the operations hub respectively, not duplicates, and now go to
`/business-builder/owner/customers` and `/business-builder/owner`.

`tests/catalog-routes-go-somewhere-real.test.js` opens every catalog route
against the booted application rather than reading
`lib/sonara-route-registry.cjs`. The registry is hand-maintained and is not
complete -- `/readiness` is a live public page, linked from three screens, with a
plain-language title, and it appears in none of the registry's route arrays. A
check reading the registry would have called that catalog row broken while the
page was fine.

`docs/2026-08-12-WHAT-ELSE-CAN-WE-SELL.md` is the research that came out of it.
Two findings worth carrying forward. The seven are not seven mistakes: the
catalog prices on a depth ladder while `PAID_ENTITLEMENT_KEYS` gates on breadth,
and that map is already a workspace-access map wearing plan-tier clothing --
which is independent evidence for the restructure in
`docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md`, this time from a bug rather
than from a market comparison. And migration 014 is a complete restaurant margin
schema, eighteen tables with ten working record pages, sold today as two words
inside a $19 plan against a comparable at $350 per location per month.

Verified: `pnpm run verify:launch` green end to end, 1,653 tests passing.

### 2026-08-12 — Eleven products removed, and the row that would have kept publishing them

The catalog had 34 products and 21 that could not be run. Eight of those were
only mislabelled and were opened in the previous change. The remaining thirteen
were looked at one at a time. Eleven described work that does not exist: a
"Records, Renewals & Exports" product pointing at the service setup checklist,
several named for tables nothing writes to, one whose lifecycle field said
`validation_required` with no criteria that could ever be met. Those eleven are
gone. Two were fixed instead — "Research & Roadmap" was priced `pro` under
`sonara_industries`, which enforces no entitlement, so the plan bought nothing
and the product could never open; it is free now. "Records & Exports" kept the
part that exists and dropped the promises: it points at
`/business-builder/owner/accounting-exports` and no longer claims renewal
reminders or CSV import mapping, neither of which is built.

**Removing a product from the code did not remove it from the site.**
`/service-catalog` reads `service_catalog_items` where `status = 'active'` and
merges those rows over the code defaults, so the database wins. All eleven would
have gone on being published under their old names, with routes a customer could
still click. `scripts/generate-catalog-sync-migration.cjs` said "Updates only.
No row is inserted or deleted here", which was true and was the problem. It now
also retires rows the catalog no longer lists, and
`20260803180000_sync_catalog_paid_access.sql` was moved into `APPLIED_MIGRATIONS`
per that script's own rule.

The number 34 was written down in five places — the deploy gate twice, two test
files, and a hand-written document — and removing eleven products failed all
five. None of them knew the number independently; each was repeating the
catalog. The gate derives its counts now, and
`tests/published-catalog-sync.test.js` fails if a literal comes back.

**Two checks went vacuous on their own success**, which is worth recording
because both were correctly written and both still had to change. One required
the production catalog to always contain a restricted product; that reads as a
boundary check and is really a requirement that something stay unfinished. The
other asserted the "why is this closed, how do I ask" copy appears on the
rendered catalog page — true while anything was closed, and it failed on a page
that was correct once nothing was. The wording is what the production gate
reads, so relaxing it would have left it unguarded; `catalogAccessReason` and
`catalogRequestLabel` are exported and asked directly instead, against products
built to be closed.

`docs/SONARA_RECOMMENDED_PRODUCT_CATALOG_2026.md` is generated now
(`pnpm run gen:catalog-doc`, checked by `verify:launch`). The hand-written
version listed 34 products under names the code had stopped using and opened
with "SONARA Nexus Shared Operating Spine" — a retired public name AGENTS.md
forbids in launch docs. Nothing referenced the file, which is why nothing
failed.

`openSourceToolStatuses` in `data/open-source-tools.ts` ends in
`satisfies Record<OpenSourceIntegrationStatus, string>`, which reads as the
compiler guaranteeing every status has a label. It is not: `pnpm run typecheck`
is a parse check over the runtime `.js` and `.cjs` files and never compiles that
file, so the clause was decoration. `adapter_built` had been in the union and
taken by six records with no label. `verify:open-source` compares the two now,
and was checked against both a missing label and a spurious one before being
trusted.

`veedstudio/open-edit` registered, Apache-2.0 read from the LICENSE file at
`main`. `research_only`, and the reason is not the repository's licence: the
renderer it ships is VEED's own closed-source binary, "free to use" — a
permission the vendor grants and can withdraw — and it runs on Apple Silicon
macOS only, so nothing in a Linux serverless function could call it. A tool for
the owner's laptop, which is the boundary
`docs/architecture/EXTERNAL-SERVICES.md` already draws.

Verified: `pnpm run verify:launch` green end to end, 1,645 tests passing.

### 2026-08-11 — The search page nothing linked to

`/search` shipped in the previous sprint reachable only by typing the URL.
Nothing offered the way in — no dashboard action, no navigation, nothing.

This is the same defect as `/research-lab/open-source` from the other side. That
one was two links pointing at a route that did not exist, and the link checker
caught it. This is a route that exists with nothing pointing at it, and **no
check caught it**: every existing test passed, because a route that resolves is
not the same as a route somebody can get to.

Linked now from all three product dashboards and from every owner record page —
the page a customer is on is the one where they realise they cannot find the
record they came for.

`tests/page-reachability.test.js` is deliberately narrow. Not every route needs a
link: a detail page is reached from its list, an API endpoint from a form, a
legal alias exists to be linked *from* elsewhere. What it checks is the small set
of pages that are a destination in their own right, where something has to offer
the way in.

What counts as "resolves" matches `no-dead-links.test.js` rather than being
decided again — 503 is correct for a page that needs Supabase in an environment
with none, and only 404 or 500 means the link is dead.

### 2026-08-11 — Search, which this product did not have at all

`/search` finds one record among thousands, across twelve record types —
bookings, services, locations, staff, inventory, vendors, invoices, menu,
recipes, vehicles, leads, campaigns.

Until now there was nothing. No `/search` route, no `tsvector`, no index. An
owner with two years of bookings could open the bookings page, see the most
recent hundred, and have no way to find the one from March. Every record page
had the same hole, and **none of them looked broken**, which is why it went
unnoticed until reading LightRAG's record made the absence obvious.

What it is, precisely: case-insensitive substring matching across a named set of
columns per table, scoped to one organization, through PostgREST's `or` filter.
Not ranked full-text, and it does not pretend to be. Postgres full-text is free
and built in, and a `tsvector` column plus a GIN index across nineteen tables is
a schema change whose value arrives at a scale one business does not reach. A
restaurant has hundreds of menu items, not millions. The reason is written down
because "we used ilike" reads as laziness without it.

The part that mattered most to get right is the tenant filter. `organization_id`
is its own term, never inside the `or()` group — inside the group it becomes one
alternative among many, and a row matching on name would come back regardless of
which business owns it. There is a test asserting that for all twelve tables.

Three other distinctions kept: a table that could not be read is not a table
with no matches; a term under two characters is refused rather than returning
everything; and no secret-shaped column is searchable, checked independently of
the function that is supposed to check it.

Two of my own mistakes, both the same shape as before. `requireCustomer` was
never passed to the route module, so the route would have registered with
`undefined` middleware — Express accepts that and fails at request time, so the
page would have 500'd rather than never existing. Registration is now skipped
when the gate is missing, which 404s visibly instead.

And the injection test asserted the substring "neq" was absent from the built
query, which failed against working code: escaping turns the whole hostile term
into one literal search string, so "organization_id neq x" surviving as *text*
is correct. The danger is the dot-delimited operator form, which is what the
check tests now. Third time this session the check was wrong rather than the
code.

### 2026-08-11 — Nine warnings nobody could act on, now zero

`verify-external-repositories` printed nine warnings on every release for
months: register records whose `repoUrl` was `https://github.com/`. Nobody
acted on them, and the reason turned out to be that nobody *could*.

They were not repository records. "LightRAG-style reference",
"Voicebox-style voice synthesis", "OpenFang / autonomous agent OS-style
references", "Godmode-style multi-model interface" — each named a *genre*
rather than an artifact, with a licence field reading "must be verified before
use". There was nothing to verify. A register of repositories cannot hold a
record that names no repository.

Eight are removed. One turned out to be real: **LightRAG is `HKUDS/LightRAG`**,
MIT, from the EMNLP 2025 paper — now recorded properly with a verified licence.

Reading it produced a finding worth more than the record. It is reference rather
than adaptation for a *product* reason, not a licence one: **nothing in this
product can search a customer's own records at all.** No `/search` route, no
`tsvector`, no full-text index anywhere in the tree. So the first useful step is
Postgres full-text over records the business already owns — not a second index
this product would have to keep in step with them.

The placeholder check is now a **failure rather than a warning**. Nine warnings
that print every release and change nothing are worse than none: they train
whoever reads the log to skim past the section where a real problem would
appear. Verified by pointing the LightRAG record back at `https://github.com/` —
the release fails.

One process slip worth recording. After proving the new failure fires, I ran
`git checkout -- data/open-source-tools.ts` to undo the test mutation, which
also undid the seven deletions and the LightRAG rewrite in the same file. The
work had to be redone. Copy the file next time; `git checkout` does not know
which of your changes was the experiment.

### 2026-08-11 — The OSINT directory, blocked category by category

An open-source-intelligence bookmark directory came in for assessment. Recorded
as blocked, with the reasons named individually rather than as a general
objection, because three of its categories are incompatible with what this
product is in specific ways:

The **generators** produce synthetic identity documents — credit card numbers,
social security numbers, driver licences, VINs. A platform holding real customer
records has no honest use for a tool that manufactures fake ones.

The **data dumps** serve breached personal data. Building on stolen records would
contradict the consent and provenance rules this product enforces on its own
creators — the same rules `creator_voice_consents` exists to implement.

The **people-search** category assembles a profile of a named individual from
scattered sources, which is the opposite of a product where every table is
scoped to one organization and one owner.

The rest — maps, search engines, translation — are ordinary public services that
need no register entry to use.

There is exactly one item in that directory this product needs, and it is
already here and built better. `lib/sonara-leaked-password.cjs` calls Have I
Been Pwned through the k-anonymity range API: five hex characters of a SHA-1
digest, never the password and never its full hash. That is the right shape for
the whole category, and it is why the rest of the category is not needed.

### 2026-08-11 — Five dead modules, and the schema they were holding up

`scripts/report-unreferenced-modules.mjs` asks which modules under `lib/` and
`routes/` are named by nothing. This runtime has no bundler, no dynamic import
and no code generation left, so the only way into a module is a literal require
— which makes unreferenced mean *unreachable*, not merely unused.

I had flagged two dead homepage modules three times across this project and left
them each time, because noticing is free and deleting needs somebody to be sure.
The check found **five**, 758 lines:

- `lib/sonara-cohesive-homepage.cjs`, `lib/sonara-advanced-builder-homepage.cjs`
- `lib/open-source-software-catalog.cjs`
- `lib/sonara-ecosystem-registry.cjs` — note the near-twin
  `sonara-ecosystem-manifest.cjs` *is* used, which is how a dead file hides
- `routes/creator-artist-system-routes.cjs`

That last one is worse than dead. It registers `/creator-studio/artists` and
five API endpoints, and `server.js` never required it — so those routes 404ed.
Its payload is `TASHA_KEYS_TEMPLATE`: a hardcoded invented artist with a
backstory, themes and a sobriety arc. Wiring it up would have shipped fabricated
content into a product whose own About page says it does not invent activity.

**Deleting it re-orphaned five tables** — `creator_artist_profiles`,
`creator_album_cycles`, `creator_prompt_blueprints`, `creator_sonic_profiles`,
`creator_video_treatments`. That module was their only reader, and since nothing
loaded it, they were never actually written in production either. They read as
used only because a file existed that *would* have used them, had anything
loaded it. All five recorded as `keep` with the reason, so the real choice —
build the artist workspace properly, or drop the tables — is made on purpose.

Two checks composing is the point: deleting dead code surfaced dead schema, and
neither report could have found this alone.

One bug caught in the new script before it shipped: this file's own header names
two of the modules it reports on, so a comment would have counted as a
reference. `scripts/report-orphan-tables.mjs` shipped with exactly that bug
once. Comments are stripped before matching now.

### 2026-08-11 — The runner, and the gate that could be walked past

`lib/sonara-agent-runner.cjs` joins the two halves that existed separately: the
authority module that says what an agent may do, and the checks that are work an
agent can do. Classify, decide, run, record — one path.

It closes a real hole. Each assistant page called `classifyAction` itself and
then did the work regardless of the answer. That is a gate you get past by not
reading the return value, and nothing in a diff shows it. Now skipping the gate
means not calling the runner, which is visible. There is a test that fails if
`classifyAction` reappears in those routes.

Registering a handler is not permission either — a handler registered under
`delete_customer_records` still gets refused, because the name is classified
before the handler is reached.

Three distinctions the runner keeps that a simpler version would collapse.
"Allowed and unimplemented" is not "refused" — they send somebody to different
files. A handler that throws is a failed run, not a crashed page, and its
message goes through the redaction boundary because a handler talks to Supabase.
And a recorder that throws does not undo a run that succeeded: the work
happened, and losing the note about it is worse than nothing but far better than
losing the work.

**Runs are not persisted, and the reason is architectural.** `entity_action_runs`
is scoped by `entity_id`; `entities` has no `organization_id`. The nineteen
agent tables scope by entity membership while every other table in this product
scopes by organization, and there is no join between them. Writing an
organization's run there would mean inventing an entity per organization or
leaving a NOT NULL foreign key null — both invisible afterwards, because the
rows would exist and look right. The recorder is injectable and ships empty, and
`docs/SHIP_READINESS.md` records the choice that needs making.

### 2026-08-11 — Where people fall out, and the rate it refuses to invent

`/growth-studio/journey` counts how many people are at each stage of the
customer journey and where the number drops. The assistant pages say what is
broken; a business can have nothing broken and still be losing everybody between
enquiry and booking, and no check in this product would have mentioned it.

The interesting part is which drops are real.

`growth_touchpoints`, `growth_leads` and `growth_conversions` each carry
`lead_id`, so a conversion traces back to the lead it came from. That is a
funnel: one person moving through stages, and the drop between them is a
measurement.

`business_bookings` and `reviews` carry no `lead_id`. A booking is not linked to
the lead that produced it, and a review is linked to a customer. Putting them in
the same column and calling the difference a conversion rate would invent a
relationship the schema does not have — and it would look exactly like a real
number, which is the failure this codebase keeps producing. So stages carry a
`linked` flag, checked against the schema rather than trusted, and an unlinked
stage reports a count and says on screen that it is one.

`dropRate` is `null` rather than `0` where there is no relationship. Those two
render differently and mean opposite things: `0` would print "0% lost" for a
comparison that was never a funnel.

One process note, because it cost time. The container reset to a checkout from
several commits back mid-sprint, and I wrote a page against files that were not
there. `git status` showing only two untracked files against an old HEAD was the
tell. This has now happened twice in this session — worth checking `git log -1`
before editing after any gap.

### 2026-08-11 — 3D interaction, and pointing Claude at what this repository knows

The depth layer moved cards; now it lights them. A soft highlight tracks the
pointer across each card, and each workspace catches its own colour — Business
Builder green, Creator Studio violet, Growth Studio amber — so the mark, the
backdrop and the light on the card finally agree. The per-product backdrops lean
the same way. Actions gained a press that moves toward the page, inside the
perspective the cards already sit in.

It costs nothing extra per frame. `sonara-depth.js` already computed the pointer
position for the tilt, so the spotlight writes two more custom properties from
numbers it had. `tests/depth-interaction.test.js` fails if a second
`pointermove` listener appears.

What that test really protects is the exits. Every effect has to disappear under
reduced motion, under the user's own motion switch, on small screens, and in
print — and stay off work screens entirely. Each new effect is one more thing
that can forget one of those, and a forgotten exit is invisible to whoever added
it, because they are not the person with vestibular disorder or the phone.

One correction: the print check read only the first `@media print` block and
reported the spotlight as printing when it does not. The check was wrong, not
the CSS.

**`CLAUDE.md` was one line: `@AGENTS.md`.** Every session inherited the rules and
none of the accumulated facts — the agent approval rule, the register, the
recurring-defect pattern, the handoff prompt that is regenerated on every
release. It now points at all of them, so a new session starts with what this
repository has learned instead of rediscovering it.

**The register page now says where each repository lands.** It listed licence,
risk and refusals and never named the product, so it answered "may we use this?"
and not "what is it for?" — and the second is the question somebody opening that
page is usually asking. All 71 records are placed: 61 against a product, and 10
with a stated reason they are not (five blocked, one licence unresolved, three
build-time tooling, one that cannot run on this stack).

### 2026-08-11 — Rebrand: a new palette, and the marks that never matched it

New colours across the design system, and one finding that came out of doing it.

**The logos and the palette had never been the same colours.**
`--sonara-build` was `#5ec8a8`, a mint green; `business-builder-mark-v3.svg` was
a blue-to-cyan gradient of `#2563EB` and `#06B6D4`. Creator Studio's token was a
lilac and its mark ran blue through violet to pink. Growth Studio's token was
amber and its mark was teal through green to lime. Every product mark disagreed
with the colour the product is named by everywhere else in the interface.

Nothing caught it because the two live in different formats. The stylesheet's
rule that a token is declared in exactly one place is true — for CSS. An SVG
served as `<img src>` inherits no custom properties from the page embedding it,
so the hex is written into the file, and a hex written into a file is a copy.
Eighteen marks were recoloured and `tests/brand-palette.test.js` now checks the
copies.

The same disagreement was in `theme-color`, which paints the mobile address bar:
`#FAF8F4` (warm off-white) against a `#F6F7FC` (cool) light surface, and
`#0C1122` against a `#04050B` dark page. Neither was wrong enough to look
broken; both showed as a seam above the page on a phone.

**Contrast was measured, not estimated.** `text-3` — the quiet supporting line
under a heading, the text most often read on a phone outdoors — was 5.1:1, which
clears AA and not AAA. It is now 7.2:1. All three text tokens clear AAA against
the new background, and white on the new accent is 5.1:1.

The one cross-family gradient is on the parent and platform marks only. A
signature that appears on every product is not a signature, and three products
painted the same violet would be tidier while telling a customer nothing about
which workspace they are in.

### 2026-08-10 — One redaction boundary, and the sink that proved it was needed

`redactSensitiveText` lived in server.js, was applied at four call sites — all
around support requests and email failures — and was named like a boundary while
being used like a helper. Its patterns covered Stripe-shaped keys, long digit
runs and `password: value`. That covers a customer pasting a card number into a
support message, which is what it was written for.

It did not cover the thing most likely to leak from this deployment. A Supabase
service-role key is a JWT: not `sk_`-shaped, no long digit run, and it bypasses
row level security. The patterns now lead with JWTs, then Authorization headers,
URL query credentials, Stripe, Resend, Postgres connection strings, assigned
secrets, and card-like numbers last because it is the loosest.

`lib/sonara-redaction.cjs` is now the only definition, and
`tests/redaction-boundary.test.js` scans every runtime file for console calls
that print error-shaped text without going through it.

A second thing was caught, this time by the release rather than by me. The
kimi-k3-in-c record went in with `repoUrl: https://github.com/kimi-k3-in-c` — an
owner path with no owner behind it. The screenshot it came from showed the
repository name and not its owner, and I completed the URL instead of looking it
up. `verify-external-repositories` resolves every registered repository against
the GitHub API and failed the PR. It is `FareedKhan-dev/kimi-k3-in-c`.

Worth knowing for next time: that check runs with `--network` in CI and without
it in `verify:launch`, so a wrong URL passes every local gate. The register's
whole point is that its facts are checked rather than recalled, and this one was
recalled.

**It found one on its first run.** `reportDegradedRateLimit` interpolated the
caught error straight into `console.error`. The rate limiter calls
`sonara_consume_rate_limit` over PostgREST with the service-role key, so the
error it degrades on is a Supabase error carrying the URL it failed to reach —
and that URL carries an `apikey` parameter. It printed the credential into the
log on exactly the path taken when the database is already struggling.

Two things about how this went, both worth not repeating. Every pattern has a
benign string it must leave intact, because a redactor that eats everything
passes the redaction tests and destroys every error message in the product.

And while wiring the catalog route's `console.error` through the boundary, the
`require` did not land — the file does not start with `"use strict";`, which is
what the edit anchored on. The module still loaded, because the reference sits
inside a catch that only runs in test mode. Caught by grepping for the import
rather than by anything failing.

### 2026-08-06 — The assistant, extended to all three products

Twenty checks now: nine Business Builder, five Creator Studio, six Growth
Studio, one page each at `/business-builder/owner/assistant`,
`/creator-studio/assistant`, `/growth-studio/assistant`. Same engine, gated by
the same workspace-access rule as the rest of each workspace.

The Creator and Growth checks are the interesting half, because several enforce
rules this product already holds itself to and had never looked at. Voice
consent that has expired or been withdrawn while the record still reads as
attested — an expired consent is indistinguishable from a live one until
somebody checks, and nothing was checking. Consent marked attested with no
evidence reference behind it. Lyrics originality left unresolved on a track
heading for release. Content queued to go to customers without approval, which
is the case AGENTS.md's owner-approval rule exists for and the case where it
gets forgotten. Contact consent withdrawn while the record sits in the same list
as the live ones.

Those were all sentences in AGENTS.md with tables underneath and nothing
comparing the two.

Renamed on the way: `sonara-business-checks.cjs` became
`sonara-record-checks.cjs` and the route module dropped `business-` from its
name, because both had stopped being about one product.

The "has a test case for every check" assertion earned itself immediately —
eleven new checks landed with no cases and it failed rather than letting them
through untested.

### 2026-08-06 — The business assistant, and the first thing that does work

`/business-builder/owner/assistant` runs nine checks over an owner's own
records: dishes selling for less than they cost, dishes with a price and no
recorded cost, supplier invoices past due, services with no price, bookings with
no way to reach the customer, stock at its reorder level, vehicle registrations
expiring within thirty days, staff with no contact details, locations with no
address.

All of it is arithmetic over rows the business already has. No model call, no
provider, nothing metered — which is the reason it can run on every page load
without costing anyone anything, not a limitation worked around.

It consults `lib/sonara-agent-authority.cjs` rather than assuming. Reading
records and reporting is self-serve today; if `check_data_quality` ever moves
onto the sensitive list, the page stops instead of continuing under an
assumption written down once.

Two things it deliberately does not do, both of them the same mistake in
different clothes. It does not hide checks that found nothing — "we looked and
it is fine" and "we did not look" must not render identically. And it does not
count an unreachable table as zero findings; the headline says how many checks
could not run rather than rounding them down into a clean bill of health.

No column is typed from memory. `validate()` checks all forty-odd against
`supabase/migrations/`, because seventeen owner forms once shipped sending
`user_id` to tables that do not have it and every save failed in production
while the tests passed against a stub. Each check also has one row it must catch
and one it must leave alone, since a predicate that quietly stops matching
reports "nothing to fix", which is the answer an owner most wants to believe.

### 2026-08-06 — The security-definer blast radius, measured

Twelve SECURITY DEFINER functions are callable by any signed-in user over
`/rest/v1/rpc/`. SHIP_READINESS said this was unchanged deliberately, because
revoking EXECUTE can turn a working RLS policy into a denial and verifying that
needs a database somebody can break. Right about the last mile, wrong that
nothing could be learned first — the migrations say which policies call which
functions.

`scripts/report-security-definer-exposure.mjs` computes it. `is_org_member` is
called by 197 policies across 59 tables; that is the number that makes a preview
branch the only responsible way to try the change. One function,
`sonara_has_org_role`, is called by nothing and is the only safe part.

The finding nobody was looking for: four of the twelve — `is_admin`,
`is_current_user_admin`, `has_scope`, `has_company_access` — are defined by no
migration. They exist in production and not in version control, so nobody can
review them by reading this repository. That is worse than the grant.

**The first version of this report was confidently wrong.** Its policy pattern
could not read a quoted multi-word policy name, which is most of them, so it saw
191 policies instead of 497 and said six of these functions were safe to lock
down — including ones with dozens of dependents. Acting on it would have locked
customers out of their own records. It now runs two independent checks and a
disagreement between them fails the release.

If you take one thing from this entry: the report looked finished and read
plausibly at 191 policies. Nothing about its output suggested it was blind.

### 2026-08-06 — Cinematic public surfaces

Every public route is now on one of two lists with a recorded reason: twenty are
cinematic front doors, eleven stay calm. The eleven are the seven legal
documents, the accessibility page, and the three launch-readiness checklists —
somebody opens a refund policy to check a term, and parallax does not help them
find it.

`/help` and `/prompt-library` moved to the marketing surface. Both are reached
before signing up as often as after and were rendering the plain operational
frame.

The backdrop is one rule on `.sonara-stage::before` rather than markup on
eighteen pages — three colour fields in the product hues over a ruled grid,
parallaxed by the scroll variable the depth script already writes. No image
files, no library, nothing for the CSP to refuse.

Not obvious and worth keeping: `z-index: -1` with `isolation: isolate` on the
stage is the only combination that works. At `z-index: 0` an absolutely
positioned pseudo-element paints over in-flow text; without the isolation, `-1`
falls behind the body background and disappears.

The asset version token lives in four files and the service worker caches by it.
Three were updated and one was not; an existing test caught it.

### 2026-08-06 — The agent approval rule as code

`lib/sonara-agent-authority.cjs` implements the seven categories from AGENTS.md
plus the default. The nineteen agent tables have existed since migration 008
with nothing running against them, so the release gate's "no runtime" line was
the whole guarantee — a guarantee that expires the moment somebody builds one.

Four decisions that look backwards until you see why. The default is deny.
Sensitive patterns are checked before the allowlist, because `delete_draft_content`
matches both. The row's own `requires_approval` column is ignored, because it is
writable and a safety property the agent can edit is not one. And an approval
must name a person, be for that action, and not come from the requester.

The release checks all of it. Verified by flipping the unrecognised-action
default to allow — the release fails.

There is still no runtime. That is the next thing, and it should be built to
call `decideExecution` rather than around it.

### 2026-08-06 — Twenty-five repositories, licences verified

Read off each repository rather than recalled, which mattered: five turned out
reciprocal (AGPL, GPL, OSL), two declared no licence at all, two could not be
confirmed. Recalling them would have put four in the adoption path wrongly.

Two blocks that cannot be lifted from inside this project: a repository with no
licence is all rights reserved, so there is nothing to authorise.

Two corrections to earlier reasoning, both mine. The AGENTS.md anti-clone rule
sits beside provenance and consent and is implemented by `song_fingerprints` and
`creator_voice_consents` — it protects creators from being cloned, not this
project from reading open-source code. And Apache-2.0 permits derivative works
commercially; attribution is the obligation, not prohibition.

`tests/open-source-licence-terms.test.js` reads the licence sentence rather than
the risk tier, because `check-license-risk.mjs` greps for "gpl" and otherwise
trusts two hand-typed fields — and neither `OSL-3.0` nor "None declared"
contains it.

`docs/github-radar/GITHUB_RADAR_PRODUCT_INTEGRATION_MAP.md` is now generated per
repository from the register instead of being four sentences that named none of
them.

### 2026-08-11 — Pricing structure, analysed not applied

The current list — Free / Starter $7 / Core $19 / Pro $39 — prices depth. The
product's shape is breadth: three workspaces, each replacing a different tool.
The July survey puts the stack being replaced at $77 (Jobber $29 + Podia $39 +
Brevo $9), and the current price list never says so.

`docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md` recommends Free $0 / One
workspace $19 / All three $39 / Team $79, with $19 chosen specifically so no
existing Core customer pays more.

Nothing is applied. `STRIPE_PLANS` is unchanged. Billing is owner-approved
under AGENTS.md, and three things have to be true first: the positive
subscribed-user test has never been run in production, the new Stripe price
objects do not exist, and "All three" and "Team" need entitlement keys that
the catalog resolves against — so this is a code change, not only a Stripe one.

The document does not claim these prices convert better. No paid signup has
completed, so there is no conversion data, and inventing one would be the
failure this repository keeps catching.

### 2026-08-11 — Three loopholes in the tenant guard, none of them live

Hunted rather than tripped over. All three were the same shape: a check that
reports coverage it does not have.

The known-tables test scanned `server.js` and `routes/` and not `lib/`, which
also issues PostgREST requests. A table queried from `lib/` and created by no
migration would have been invisible to the test and waved through by the guard.
Nothing was actually wrong — six literal table names in `lib/`, all recognised —
but the scan could not have said so. Widened, then confirmed by planting a
`lib/` file querying a table no migration creates and watching it fail.

`inspect()` returned `{ allowed: true, unrecognised: table }` and `install()`
read only `.allowed`. The comment said "allow it and say so"; it allowed and did
not say. Now reported once per table name, not once per request, because a
warning that prints on every page load is one nobody reads.

`install()` was guarded by a module-level `installed` boolean that ignored the
target, so the first install anywhere made every later one a silent no-op. The
new test installed onto its own scope object, got `false`, exercised an
unwrapped `fetch` and passed — in isolation. It failed in the full suite only
because the test asserts the return value. Tracking targets in a `WeakSet` is
both more correct and what keeps that test honest.

The guard still allows an unrecognised table. Failing closed there trades a
quiet hole for an outage, and a stale generated list is a likelier event than a
malicious one.

### 2026-08-11 — A trades AI-tool guide, and the money table that points the wrong way

Analysed *"The Top 12 AI Tools for Trades Business Owners"* (Profitable Tradie,
2026) — a lead magnet aimed at exactly the Business Builder customer. Recorded
in `docs/market/2026-08-11-TRADES-AI-TOOL-STACK.md`. Its wording stays out of
our copy; it is someone else's brand. The market facts transfer.

Eleven distinct products, **$297/month** at entry paid tiers and **$206** at the
floor once free tiers are used. That is a second competitor stack, specific to
trades, beside the generalist $77 already recorded. The $77 stays the headline
because it is the cheapest credible one and therefore the hardest to dispute.

The finding worth acting on came from checking the schema rather than the guide.
**Every money table in this product points outward.** `vendor_invoices`,
`purchase_orders` and `bill_payment_records` are money the business owes;
`payments` and `purchases` are SONARA's own Stripe billing. There is no
accounts-receivable table, so a business can record what it owes its suppliers
and cannot record what its customers owe it.

Nothing on screen lies about this — the existing check is labelled "Supplier
invoices past due". But the guide's entire cash-flow section is about the
receivable side, and for a trades business that side is the business. Three of
its twelve tools are downstream of that one missing table.

Also corrected CLAUDE.md, which still said there is no agent runtime. There is
one; what there is not is anything that re-runs an action after approval, and
that is now what it says.

### 2026-08-11 — Accounts receivable, the side of the money that was missing

Every money table in this product pointed outward. `vendor_invoices`,
`purchase_orders` and `bill_payment_records` are what the business owes;
`payments` and `purchases` are SONARA's own Stripe billing. A business could
record a bill it had to pay and had nowhere to record a bill it had sent.

`customer_invoices` and `customer_invoice_payments`, with
`/business-builder/owner/receivables` over them. `customers` gets a page too --
it had a table, row level security and no way in, and bookings store a
customer's name as free text rather than pointing at it, so an invoice had
nobody to be addressed to.

Payments received are rows, not an `amount_paid_cents` column. A denormalised
total stops being true the first time somebody records a payment without
updating it.

No line-items table, deliberately. The owner-page framework renders one child
per page, and between line items and payments received it is payments that
answer "who owes me what". A line table with no page is schema nothing can
reach, and there is enough of that already.

Two checks: `customer_invoices_overdue` fires only on `sent`, because a draft
nobody has seen is not late and counting it would put invented pressure on a
number read as real money. `customer_invoices_sent_without_due_date` catches the
row the first check structurally cannot see -- an invoice with no due date never
goes overdue, so it leaves every chase list in silence.

Four gates caught things on the way through, all correctly: the lines test
counted 4 pages and found 5, the record-checks test refused a check with no
fixture proving it catches and ignores, the Supabase contract refused tables the
runtime referenced, and the OpenAPI contract refused unregistered routes.

The lines test asserted the string "Flour" for every page, which held while all
four line tables were stock lines with an `item_name`. Payments have a date, an
amount, a method and a reference, so one shared marker would have reported a
working page broken. Evidence is now declared per table, and a page whose table
has none fails rather than passing quietly.

### 2026-08-11 — Money due in and out, which is not a forecast

`/business-builder/owner/money-due`, over `lib/sonara-cash-position.cjs`.
Unblocked by accounts receivable: with invoices owed to the business and bills
owed out, both carrying due dates, money in and out by period is arithmetic
over the owner's own rows. No model, no provider, nothing metered. Tool six of
the twelve in the trades guide is Float or Bauwise at $49 a month.

**It is not a forecast, and the naming is the substance rather than a caveat.**
A forecast predicts revenue nobody has promised. This adds up what has been
promised in both directions. An owner deciding whether payroll clears cannot
tell an extrapolated number from a counted one once they are in the same
column, so there is no extrapolated number.

Three things it refuses to do:

A row with no due date is excluded **and reported**, above the totals rather
than in a footnote. Dropping it silently would make every figure look complete
while being short by an unknown amount, which is the shape of most of the
defects found in this repository.

There is no closing balance. No table holds the bank balance, so this reports
movement. A position computed from an opening balance of zero would read as the
money the business has.

An unreadable payments table counts as unavailable rather than reporting gross
as net. Overstating money coming in is the wrong direction to be wrong in.

Two arithmetic traps have tests because both would have been silent: an
invoice paid in full whose status was never changed off "sent" drops out
instead of counting at full value, and an overpayment clamps at zero instead of
going negative and quietly reducing another invoice's total.

### 2026-08-11 — The payment form that could never save

`customer_invoice_payments` shipped with a working form, a working button and
no way to save a row. The child POST handler read `req.body.item_name`
directly, which was true of the four line tables that existed when it was
written — all stock lines with an item name. A payment has a date, an amount, a
method and a reference. Every submission came back `missing_required` naming a
field its form never asks for.

The test suite passed because every case posted `item_name` regardless of which
page it was testing. That one shared body meant the two ownership tests were
also passing vacuously on this page: both were being rejected at the required
check long before reaching the parent-ownership check they exist to prove.

Required fields now come from the child's own form declaration, and the tests
build each submission from the same declaration. Two new cases: post exactly
what a page marks required and assert it saves, and drop one required field and
assert it does not.

Third time in this area that one shape was assumed for all children — after the
"Flour" evidence marker. The pattern is worth naming: a helper written when a
set had one member encodes that member's shape as the rule.

### 2026-08-11 — Invoice line items, and a record that can hold two kinds of child

`page.lines` was a single object, which was right while every record with
children had exactly one kind. An invoice has two: what is on it, and what has
been paid against it. `childrenOf(page)` normalises either shape, so the four
existing declarations are untouched.

`customer_invoice_lines` was deliberately left out of the receivables migration
because the framework rendered one child and payments had the slot. There is
somewhere to put it now.

Line totals are stored rather than derived, which is the opposite of the choice
made for payments, and the two are different kinds of number. What has been paid
is a fact about other rows, so deriving it keeps it true. A line total is what
the business decided to charge — a quantity times a price it may have discounted
and rounded its own way. Recomputing it on read would overwrite that decision.

Three failures on the way through, all real:

The new child was declared at `/api/business/invoice-lines`, which
`vendor_invoice_lines` already owned. Two POST handlers on one path is not a
duplicate-route error — Express registers both and the first wins, so every
invoice line would have been validated against a vendor invoice and written to
the vendor table. Nothing would have errored. There is now a test that no two
children share an endpoint.

`lib/sonara-form-reachability.cjs` read `page.lines.api`, which becomes
`undefined` against an array. Every child endpoint left the reachable set at
once and was reported as having no form while its form was on screen.

The lines test iterated pages and read `page.lines`, so it would have tested the
first child of each record and skipped the rest. It iterates (record, child)
pairs now.

### 2026-08-11 — Quote to invoice, and the button that must not fire twice

`quotes` had a table, row level security and no page.
`customer_invoices.quote_id` was a column nothing ever wrote. The step between
"they said yes" and "they have been billed" was the one an owner does at 10pm,
retyping figures they already agreed.

`/business-builder/owner/quotes`, and a convert action that produces a draft
invoice with an opening line.

**This is the owner acting, not an agent.** `lib/sonara-agent-authority.cjs`
governs what runs without a person; a person pressing a button they can see is
the person. Routing this through the runner would classify the owner's own
click as an unrecognised agent action and refuse it — the gate misfiring rather
than working. Worth writing down, because the opposite mistake is the one that
matters and the distinction is easy to blur.

Four refusals, each of which bills somebody wrongly if missed:

Only an accepted quote converts. "Sent" is the state where the answer is still
outstanding, and billing for work nobody agreed to is worse than not billing.

A quote with no customer or no amount refuses rather than producing an invoice
addressed to nobody, or for nothing.

The same quote cannot be invoiced twice. A double submit or a refresh bills one
job twice, and the second invoice looks exactly as legitimate as the first. The
check that backs it reads existing invoices first — and **an unreadable list is
not an empty one**, so a failed read refuses rather than converting.

No due date is set. Payment terms are recorded nowhere in this product, so any
date would be invented, and `customer_invoices_overdue` would then chase a
deadline nobody agreed to. The sent-without-due-date check catches the gap
instead, which is what it is for.

The opening line is written best-effort after the invoice. Failing the whole
conversion once the invoice exists would leave the owner unable to retry,
because the duplicate check would then refuse.

### 2026-08-12 — Chase drafts, and the sentences a draft may not contain

`/business-builder/owner/chase-drafts`. Tool five of the twelve is "Claude for
overdue invoices" — the message an owner puts off, because writing it while
annoyed is how a customer relationship ends.

The split it rests on was checked against `lib/sonara-agent-authority.cjs`
rather than assumed, and asserted in the test: `draft_reply` is self-serve —
"It writes a reply a person still has to send" — while `send_invoice_reminder`,
`email_customer` and `chase_overdue_invoice` all fall through to `unrecognised`
and stop at the owner. So this drafts and stops. The page says so in its own
words, not only in a comment.

**No model call.** Assembled from the owner's own rows, which keeps it free —
but that is not the main reason. A template cannot hallucinate a payment that
was never made. What it costs is range: these read like forms, because they
are, and the page says that too.

The interesting part was deciding what a draft may not say. Three things the
obvious version would have invented, each with a test that greps every stage
for it:

**How many reminders have already been sent.** Nothing records that. "As we
have already reminded you twice" is a claim that can be false to the customer's
face.

**Payment terms, interest, or a late fee.** No table holds them. A draft naming
a fee the business never agreed is a term it cannot enforce.

**Any threat of legal action, collection or credit reporting.** That is a
statement the business is held to. An owner can write it themselves; a draft
that arrives pre-written invites sending it unread.

Two other refusals. The amount is what is outstanding after payments, never the
invoice total — chasing the full amount after a part payment is the fastest way
to lose a customer, and there is a test that the total does not appear. And if
the payments table cannot be read, **no draft is written at all**, because
every figure would be one that might already have been paid.

An invoice that cannot be drafted is listed with the reason rather than
omitted. A shorter list with no explanation reads as less debt.

The message is a readonly textarea rather than a copy button: the CSP is
`script-src 'self'` with no bundler, so a button would need inline script, and
selecting text cannot fail silently the way a clipboard call can.

### 2026-08-12 — Counting what is left, and correcting what was said about it

`docs/owner/WHAT-IS-LEFT.md` and `docs/owner/OWNER-STEPS.md`.

The count is two numbers because "completely done" means two things. Shipping
what exists is **four steps, all owner-only** — no repository-side work remains,
which was verified rather than assumed: no TODOs, no unimplemented paths, 1347
tests passing, the eighteen-command chain green.

Building everything discussed has **no step count**, and quoting one would be
the most misleading thing in either document. The list is open-ended, 8 of 66
reviewed repositories cannot be incorporated at all on licence grounds, and
"fully autonomous" contradicts the seven owner-approval categories that are also
an instruction. Stated plainly rather than absorbed into an estimate.

The four owner steps are written to be run: the exact SQL, the dashboard path,
and how to tell it worked. Item 4 in particular — one `EXECUTE` revoke on a
preview branch — is the only part of the advisor's remediation this repository
can call safe on its own evidence, and the migration is deliberately **not**
written, because a migration here runs on deploy and shipping it without the
branch test would be acting past the evidence.

`SHIP_READINESS.md` still claimed the runner persists nothing. That stopped
being true when `agent_action_logs` was wired. Corrected — and the correction
names the gap that is actually still open, which is that nothing re-runs an
action after approval.

**That gap is deliberately not being closed.** No handler in this repository
performs a refund, a payout change, a policy publication or a customer send, so
a queue over the seven gated categories would be the frame of a mechanism with
no contents, and the approval screen would gain a button whose only effect was
to change a word in a log. The runner already reports `unimplemented`, which is
the honest answer until a handler exists. Build a gated capability first, then
the approval path it needs.

### 2026-08-12 — The first repository that is actually installed

The register had 66 reviewed repositories and no way to say any of them was in
use. Its most advanced status was `optional_adapter_after_review` — "you may
build one" — so 66 reviewed with nothing built and 66 reviewed with every
adapter built were indistinguishable. A vocabulary that cannot express the
finished state makes the work look permanently undone.

`adapter_built` added, and Ollama moved to it, because there is now an adapter.

**Nothing in this product called a model.** `lib/optional-ai-gateway.cjs` says
so in its own first line: "This is a readiness DETECTOR only. It never makes
network calls." Every "AI" surface here was arithmetic over the owner's rows —
which is why the record checks and the chase drafts can be trusted, and why
they cost nothing. `lib/sonara-ollama-adapter.cjs` is the first thing that
calls one.

Ollama first for three reasons that are facts rather than preferences: MIT owes
nothing but attribution, a local runtime costs nothing per call, and it needs no
key, so there is no secret to leak.

**The constraint stated before anything else:** this application deploys as
serverless functions, so a model on the owner's own machine is not reachable
from it, and `localhost` in production means the function's own container. The
readiness check names that case by host rather than letting it arrive as a
timeout. It is genuinely useful for a self-hosted deployment or a reachable
host, and misleading for a laptop — so it says which.

Off by default, and no page may depend on it. A model being unavailable must
never be the difference between a page working and a page failing.

Three defects found in the writing, all mine:

The adapter had `.catch(() => undefined)` on the fetch, which swallowed the
abort before the handler could classify it — a timeout reported as
"unreachable", sending somebody to check a network for a model that was merely
slow.

`integrationStatus` was checked for presence and never for value, so a typo
would have become a record nobody could filter on. It is now read from the type
union in the same file.

That union parse then reported every status but the first two as invalid,
because **a semicolon inside the comment explaining the new status ended the
non-greedy match.** Same class as the policy parser that once read 191 policies
where there were 497: a regex over source that prose can terminate early.
Comments are stripped first now.

`adapter_built` also has to name a module that exists, checked on disk. It is
the one status that claims something about this repository rather than about
the upstream project, so it is the one that can be false without anybody
noticing. Both new checks were verified by breaking them.

### 2026-08-12 — One adapter contract, three more adapters, and how to reach them

`lib/sonara-service-adapter.cjs` holds what all four have in common. The Ollama
adapter carried it inline; four copies would be four chances for one to be
quietly less careful, and the careless one would be the one nobody re-read.
Each adapter now owns only its call shape.

The refactor immediately proved the point. Moving the base URL onto the shared
readiness object leaked it — a base URL can carry a token in its query string
and readiness is rendered onto a page. The existing Ollama test failed within
seconds. It is carried non-enumerably now, so `postJson` can read it and
`JSON.stringify` cannot. Open WebUI's API key gets the same treatment.

**Langflow** (MIT): calls a flow by id, so the flow stays the owner's to change
without a deploy here. The id is validated as a plain identifier before it
enters the request path — a value containing a slash addresses a different
endpoint on the same host, with this server making the request.

**Open WebUI**: the licence review it was waiting on is done, read from the
repository rather than recalled. BSD-3-Clause in structure with one added
condition — branding may not be altered except under fifty end users, with
written permission, or under an enterprise licence. **That binds redistribution
and deployment with branding altered. It does not restrict calling the HTTP API
from separate software**, which is all the adapter does. It does bind the owner
if they deploy and rebrand it themselves, and that is recorded.

**Crawl4AI** (Apache-2.0): the one adapter that makes this server fetch a URL
somebody supplied, which is a request forwarder if the target is unchecked. It
refuses loopback, link-local, cloud-metadata and the private IPv4 ranges, and
refuses a URL carrying credentials. Stated limit: those checks read the URL as
written, and a public hostname that resolves to a private address is the case
they cannot see from here.

`docs/architecture/EXTERNAL-SERVICES.md` answers the connectivity question that
governs all of them. Three routes, in order: a tunnel (Cloudflare Tunnel or
Tailscale Funnel, free at this scale, no architecture change), a host the
server can already reach, or running this application beside the services on
one network. The third is the only one that also unblocks the wider question —
Dify is Python, Chatwoot is Rails, TastyIgniter is PHP, and none of them can
ever be required into a CommonJS Express app regardless of licence. As
neighbouring services called through adapters, all of them become reachable.

The document says the part people skip: a tunnel makes a service reachable by
everybody, and Ollama and Crawl4AI have no authentication of their own.

`tests/service-adapters.test.js` runs the same rules against every adapter and
asserts the list length, so adding one without adding it there fails. The
plain-language gate caught "endpoint" in the new page copy; rewritten rather
than exempted.

### 2026-08-12 — Two more adapters, one review that ended in a no

Secrets moved into `lib/sonara-service-adapter.cjs`. Open WebUI satisfied the
required check, deleted the property and redefined it non-enumerably by hand —
which worked, and was one forgotten line away from a key on a page the moment a
second adapter needed one. Three did. It is a declaration now, and forgetting it
means the key is not read at all rather than read and rendered.

**Dify** — licence read from the repository. Modified Apache 2.0 with two added
conditions: no operating a multi-tenant environment from the source without a
commercial licence, and no removing the LOGO or copyright from the Dify console.
Calling a self-hosted Dify's API is permitted and that is all the adapter does.

The boundary is not obvious and is recorded as a blocked use: **SONARA is itself
multi-tenant.** That is fine while each owner points the adapter at their own
Dify — SONARA is the multi-tenant thing, Dify is not. It stops being fine the
moment SONARA runs one shared Dify and serves customers from it, which is
exactly the condition. Somebody adding that as a convenience later would not
find it out from the code.

**RAGFlow** — plain Apache-2.0, and the review it was actually waiting on was
security, which was the right question: unlike a model or a crawler this one is
about the business's own documents. Same answer as Ollama — the owner's own
instance, the owner's own files, nothing sent to a third party. What remains is
a boundary the adapter enforces by omission: **it retrieves and it does not
upload.** A page pushing customer records into a search index would be a second
copy of customer data with different retention under different access rules.

It also separates "searched and found nothing" from "the search failed", and
keeps matched passages separate from the joined text so a caller showing an
answer can show where it came from. A source it does not know is `null`, never
invented.

**n8n — reviewed, and the answer is not yet.** The Sustainable Use License
permits internal business use and restricts free-of-charge non-commercial
distribution. On the three questions that decide our case it is silent: hosting
arrangements, self-hosting for internal automations called from separate
software, and whether that changes when the calling product is commercial SaaS
whose customers never touch n8n. A reading that this is plainly internal use is
available and may well be right — but it is a reading, and this register does
not record readings as findings. It stays out of the adapter set. That makes it
the second item, after the four owner steps, that needs someone with authority
to answer rather than more work here.

Six adapters now, all on one contract, all off by default, none depended on.

### 2026-08-12 — A cross-tenant write behind one environment variable

Asked what else needs to be on before paid usage, and went to look rather than
recall. The answer had a hole in it.

`SONARA_ALLOW_MANUAL_ORG_ID=true` accepts an `organization_id` straight from the
request body with **no membership check** — and there cannot be one, because the
branch exists to work without a resolved session. While it is on, any request
names any organization and every owner-record write that resolves through it
writes into whichever tenant the body asked for.

It was gated on the variable alone. One wrong value in a production dashboard
was a cross-tenant write hole, it appeared in no documentation, and nothing in
the release chain looked at it. The code now checks `NODE_ENV` and `VERCEL_ENV`
as well, so the flag is inert in production regardless of its value — a
convenience somebody can switch on in production is not a convenience. Verified
by removing the guard and watching the test fail.

**`pnpm run verify:env` was stale and not in the release chain.** Seven of its
twelve "required" names were read by nothing: `STRIPE_PRICE_STARTER` and
friends, whose real names all end `_MONTHLY`. It failed on every run, so anybody
who ran it would have chased eight variables that do not exist. A stale check is
worse than none — it teaches people the output is noise.

Rewritten to derive from source. Every name the code reads must be classified as
required, ratchet, development-only, optional capability or platform-provided,
and it fails in both directions: an unclassified variable, and a classification
for a variable nothing reads. Now in the chain.

It also caught itself. The script lives under `scripts/`, which it scans, so
every name in its own lists counted as "used" by being listed — the stale-name
check could never fire, which is the exact check that would have caught
`STRIPE_PRICE_STARTER`. It excludes itself now, verified by renaming an entry
and watching both errors appear.

Fifty-eight variables read, ten required. `docs/owner/WHAT-MUST-BE-ON.md` says
which, and what breaks without each.

### 2026-08-12 — All ten required variables were already set, and an adapter did its first work

Asked to set the ten required variables, and could not: they are secrets held in
Vercel, not in the repository, and AGENTS.md forbids committing them. Asking
production turned out to be better than setting anything — `/api/readiness`
reports configuration status without leaking values, and it says every one is
already configured. Supabase, Stripe, the Stripe webhook, Resend and admin
protection all `configured`, `missing` empty for every service, all three paid
plans at `checkout: enabled`. Google sign-in is `deferred`, deliberately.

So there was nothing to set. What is left is the leaked-password ratchet and the
paid signup nobody has run.

**Six adapters existed and nothing called them** — one step from a module
nothing references. The readiness page reported whether they were configured and
no feature ever asked them for anything.

`POST /api/market-intelligence/fetch-source` is the first that does work. Every
market intelligence surface depended on somebody having the page open in another
tab; this is the difference between recording what you found and going to look.

**It fetches and it stops.** Nothing is written — no summary, no signal type, no
confidence. A signal is evidence somebody judged, and a summary this server
invented would enter the record indistinguishable from one an owner wrote. The
test asserts the handler contains no insert, no `recordEvent`, no table name,
and none of the five fields the signal form requires.

An unconfigured Crawl4AI answers 200 with `fetched: false` and says to paste the
text instead. A 503 would make an optional capability look like a broken one,
and this page worked before the adapter existed.

The form-reachability check flagged it — correctly by its own rule and wrongly
for this case, since it matches create-shaped POSTs and this one creates
nothing. Recorded with that reason rather than joining the four "NOT YET
EXAMINED" entries beside it, because this one has been examined.

### 2026-08-12 — CI was running a different set of tests, and nobody could see it

A CI failure on `04dafda` that would not reproduce locally, under CI's exact
mocha command, with the proxy and Vercel variables stripped, and against the
merge commit. Re-running the same job on the same SHA with no change passed.
So it was flaky, not a real failure — and chasing it found two things worth
more than the flake.

**Four test files never ran in CI.** Its invocation passed `"tests/**/*.js"` on
the command line, and a glob there overrides the spec list. `pnpm test` also
passed `"tests/**/*.mjs"`. So `brand-assets`, `brand-registry`, `brand-routes`
and `platform-prep` ran locally and were invisible to the gate everyone trusts.
They were green either way, which is exactly why it went unnoticed: **a check
that does not run and a check that passes look identical from outside.**

**The suite relied on mocha's 2000ms default.** The slowest test locally is
744ms, and several iterate all 242 registered routes, so they scale with the
product. A slower runner turned that into a failed release on a commit that was
fine.

`.mocharc.json` now owns the spec list, the setup file, the timeout and
`--exit`, and both `pnpm test` and the workflow inherit it rather than restating
it. 15000ms is generous enough to absorb runner variance and bounded enough to
still catch a hang; several tests already set their own explicit timeouts.

`tests/ci-runs-the-same-tests.test.js` fails if the workflow passes a spec glob
or `--file` again, if the config stops matching either extension, or if the
timeout drifts outside the range. Verified by restoring the old glob and
watching it go red.

The flake itself is now much less likely, but the reason to fix this was not the
flake. It was that the release gate was quietly narrower than the one people
were running.

### 2026-08-12 — Search could not find the money

Search covered twelve tables and none of the records added since it was written.
`customers`, `quotes` and `customer_invoices` were all invisible: an owner who
raised an invoice could not find it, and **an empty result reads exactly like
"you have no invoices"** — this codebase's recurring failure, pointed at the one
page whose entire job is finding things.

Six tables added. The three money records, plus `purchase_orders`,
`maintenance_logs` and `bill_payment_records`, which hold a PO number, a
description and a payment reference — things an owner actually types.

Six deliberately left out, each with a reason rather than a silence: schedules
and time entries are found by person and date, a profit snapshot is a date and
numbers, an accounting export is a period and a file, and counts and transfers
are found by location and date. None has text a search term would match.

The list rotted because nothing compared it against the pages that exist.
`tests/search.test.js` now requires every owner record page's table to be either
searchable or named in `NOT_SEARCHABLE` with a reason, so adding a page forces
the decision. It also names `customers`, `quotes` and `customer_invoices`
explicitly — a count-based check would pass again the next time something is
added and forgotten, which is exactly how this happened.

Verified by removing an exclusion and watching it fail.

### 2026-08-12 — The owner dashboard showed one side of the money

Two gaps, both the same shape as the search one, found by checking rather than
assuming.

`operationsSummary` counted `vendor_invoices` under the label **"Invoices"** and
did not count `customer_invoices` at all. An owner opening their own dashboard
saw what they owed suppliers and nothing about what customers owed them — the
outward-only bias the schema had before accounts receivable existed, still
sitting in the summary. Both sides are counted now, and both are labelled by
direction: "Bills you owe" and "Invoices you have sent". The bare word
"Invoices" is no longer used for either, because with two sides on screen it
reads as whichever one you were looking for.

None of the money pages were linked from it. Customers, quotes, receivables,
money due and chase drafts were all reachable only by knowing the URL.

One thing worth recording about how this was found: the first harness read
`ROUTE_REGISTRY` entries as `.path` when the field is `.route`, and reported all
sixteen record-check fix links as broken. They were all fine. Three times now a
check has been wrong rather than the code, so the reflex of confirming the
harness before believing an alarming result keeps earning its keep.

`tests/owner-dashboard-reach.test.js` fails if a money page stops being linked,
if either invoice table stops being counted, if they share a label, or if a
label stops saying which direction the money goes. Verified by removing a link
and flattening a label, and watching both fail.

### 2026-08-12 — Five account pages nobody could reach, and a crawl that lied

After two hand-kept lists turned out stale, went looking for the general version
rather than a third instance.

A source scan of every registered page route against every link construct
reported 57 unlinked. **It was wrong.** `/tutorials` builds its four subpage
links from a list, so the literal path never appears in source — the scan
called them unreachable while `/tutorials` renders all four. Rendered HTML is
the only honest answer to "can somebody get here".

A rendered crawl was better and still not trustworthy: it reported
`/owner/agent-activity` unreached, which is linked from `/dashboard` — the
stubbed session does not render the signed-in pages, so the crawl under-reaches
and would have produced 162 claims, most of them false. **Not shipped.** A check
that cries wolf is the thing that teaches people to ignore checks, which is the
same disease as a check that never fires.

What survived verification was real. `/account` linked `/account/setup` and
nothing else, so **profile, security, preferences, workspaces and integrations
were registered, rendered, and reachable only by typing the URL** — the `/search`
defect, five times over, including the page somebody goes looking for after a
security scare.

Fixed, and added to `tests/page-reachability.test.js`, which fetches the page
and reads its rendered links. The links are built from `ACCOUNT_SECTIONS`, so
fixing five unreachable pages cost three lines of `server.js` rather than
thirteen; the ceiling moved 4072 → 4075 with that reason.

The general check is still worth building. It needs a session that renders the
signed-in pages, and until it has one it would report more noise than findings.

### 2026-08-12 — The tenant guard could not see the receivables table

Building the authenticated crawl surfaced this, which is worth more than the
crawl was: the tenant guard's own warning fired, for real, on
**`customer_invoices`** — the parent table of the entire accounts-receivable
feature. It was in neither `TENANT_SCOPED_TABLES` nor `GLOBAL_TABLES`, so
`lib/sonara-tenant-guard.cjs` could not check a single query against it. It had
been that way since the table was created.

The cause is a regex terminator. `generate-tenant-scoped-tables.cjs` required a
CREATE TABLE body to end with a **line-initial** `)`, and a CREATE TABLE inside
a `do $$ ... $$` block is indented. `integration_statuses` ends `    );`, never
terminated, and the non-greedy match ran on to the next line-initial `);` —
3,432 characters later, **in a different migration file**, swallowing
`customer_invoices` whole. The generator joins every migration into one string,
so nothing stopped it crossing the boundary.

**It was invisible because `verify:tenant-tables` regenerates and compares.** A
generator verified by re-running the same generator agrees with itself whatever
its parser does. Every release passed while the guard was blind to a money
table.

Three changes. The terminator tolerates indentation. A body containing another
`create table` now throws, because that match consumed past its own end — and
that fires on exactly the case that caused this, verified by restoring the old
terminator. And an independent scan, deliberately not sharing the pattern,
asserts every table a migration declares was classified.

The independent scan reported a table called **`to`** on its first run, from the
words "create table to" in a comment. Comments are stripped now — the same
lesson as the semicolon that once broke the licence-union parser. A cross-check
that reports phantoms is one people switch off.

Also surfaced: **`product_modules` is queried twice from `server.js` and created
by no migration.** Same class as the four authorization functions — schema in
the live database and not in version control. Recorded in `SHIP_READINESS.md`
rather than guessed at, because inventing a definition that may not match
production is worse than the gap.

### 2026-08-12 — Reaching the pages nobody could reach: 110 down to 26

Worked the unreachable list rather than adding a check that would have reported
it forever. Authenticated crawl, three structural fixes, and the number went
110 → 26.

**Eleven owner record pages.** The owner dashboard carried eleven hand-written
links and had fallen eleven pages behind: purchase orders, stock counts,
transfers, supplier payments, accounting exports, costs, maintenance, menu,
recipes, vehicles and vendors. Generated from `ALL_OWNER_PAGES` now — the same
list that defines the pages, so it cannot fall behind again.

**Seventy-three product pages**, across all three workspaces, registered and
rendering and reachable only by typing the URL. Same cause: hand-written link
lists beside the registry that defines the routes. The product dashboards now
carry a workspace index generated from `ROUTE_REGISTRY` by `productOwner`.

Business Builder needed it twice: `sonara-business-control-plane-routes.cjs`
intercepts `GET /business-builder/dashboard` before the per-slug handler, so
Creator Studio and Growth Studio got the index and Business Builder did not.
It is on both branches there — including the onboarding one, since an owner who
has not created a business yet is exactly the person who cannot find anything.

**The plain-language gate caught the index immediately**, which is the system
working: it renders registry titles, and three of those carry "lifecycle" and
"readiness". The rest of the application already calls those pages Roadmap and
Setup checklist in its own links — the plain name existed and the index was
reading the wrong field. `plainRouteTitle` now supplies it.

Two false alarms are worth recording. A source scan of link constructs reported
57 unreachable; `/tutorials` builds its links from a list, so the literals never
appear. And the first crawl reported 162, because a stubbed session does not
render signed-in pages. Neither was shipped as a check.

The 26 that remain are mostly legitimate: `/sitemap.xml` and `/robots.txt` are
machine endpoints, `/logout` and `/auth/callback` are redirect targets,
`/reset-password` arrives by email, and the `/terms` and `/cookies` family are
aliases of the canonical `/legal/*` pages the footer already links. They should
be declared rather than linked, which is the check still worth building.

### 2026-08-12 — The declaration check, and twelve more pages nobody could reach

`tests/every-page-is-reachable.test.js`. An authenticated crawl from ten roots,
following rendered links, comparing what it reaches against every registered
page route. Anything unreached must be declared with a reason, and **a
declaration for a page that turns out to be reachable fails too** — a stale
reason is how this list would rot the same way the hand-written link lists it
replaced did.

It found twelve on its first run, and the right answer for all twelve was to
link them rather than declare them. **Ten admin pages** — database management,
migrations, organizations, email, pipelines, deployments, audit, system design
intelligence, model safety and the prompt library. The admin index carried cards
for the pages somebody thought of, which is the same hand-kept list that had
fallen behind everywhere else; it is generated from the registry now.
`/notifications` and `/market-intelligence` are on the customer dashboard.

It also caught its own stale declaration immediately: `/business-builder/login`
was listed as unlinked and is reachable. Removed.

Three guards on the check itself, because a crawl that silently stops crawling
reports a clean bill of health. It asserts it fetched more than 100 pages and
reached more than 150 paths, so a broken session fails loudly rather than
reporting nothing unreachable.

**One bug of mine, worth recording.** The test replaced `global.fetch` with a
Supabase stub and restored only the environment. The stub leaked into every file
that ran after it, and ten sign-in tests failed — they got a Supabase that
answered every auth call successfully, so a refusal test saw a redirect.
`tests/setup-env.cjs` installs an offline firewall on that handle; putting it
back restores it. Fixed, and the reason is in the `after` hook.

Thirteen declarations remain, all genuine: two machine endpoints, five
redirect-or-email targets, and six aliases of the canonical `/legal/*` pages the
footer already links on every page.

### 2026-08-12 — A won lead becomes a customer

`growth_leads` and `customers` hold the same four fields — name, email, phone,
source — and nothing joined them. A lead that closed had to be retyped before it
could be quoted or invoiced. That seam is what the "one system" claim is
actually about: Growth Studio finds the work, Business Builder bills it.

`growth_leads.customer_id` added, and `POST
/api/growth-studio/leads/:leadId/customer` over it. Both tables belong to the
same organization, so this crosses a product boundary and not a tenancy one —
and every read and write still carries the organization rather than trusting
that.

The column is not only a join. **Without it there is no way to tell a lead has
already been converted**, and a second press creates two customers with the same
name and no way to know which is real. `customer_invoices.quote_id` does the
same job one step later.

Five refusals, each of which leaves a record somebody has to untangle if missed.
Only a **won** lead converts — "qualified" is somebody looking promising, which
is not agreement, and it is the same distinction as "sent" against "accepted" on
a quote. A lead with no name has nothing to address. A lead with no email *and*
no phone has nowhere to send an invoice, which is the only reason to create a
customer at all. An already-linked lead refuses. And a customer with the same
email refuses, matched on email rather than name because two people share a name
and a duplicate row is what somebody finds months later with half the invoices
against each.

The duplicate check reads existing customers first, so **a failed read refuses
rather than converting** — an unreadable list is not an empty one.

Two checks caught things, both correctly. The migration-column test used
`describedColumns`, which deliberately omits ALTER-added columns because it
cannot read their type; `hasColumn` knows them. And the policy scan caught a
literal table name passed through a read helper, which hides the table from the
member-policy check — every other call in that file goes through `TABLES`, and
now so does this one.

### 2026-08-12 — Two conversions with no button, one of them mine from two sprints ago

Went to check the lead conversion was pressable and found it was not — and
neither was turning an accepted quote into an invoice, built two sprints
earlier, tested, documented, and shipped with **no way for an owner to press
it**.

The reason nothing reported it: `createShapedRoutes` skips routes with a path
parameter, and both conversions are `/…/:id/…`. The one check that asks "does
this endpoint have a form" never saw either of them. So the endpoints worked,
the tests passed, the docs described them, and the feature did not exist for
anybody without an API client.

`rowAction` on an owner page declaration fixes it generally rather than adding
two buttons. A row that can take the action renders a form; a row that cannot
**says why in the same column** — "Waiting on their answer" for a sent quote,
"No customer on this quote" — rather than showing a button that would refuse
when pressed. A button that refuses teaches people the product is broken.

`tests/row-actions-are-pressable.test.js` asks the question the scan cannot: it
checks every declared action posts to a route the server registers, that each
declares a reason function and a label, that the quotes action offers itself on
an accepted quote with a customer and an amount and refuses the four ways it can
be wrong, and that a malformed row cannot take the page down.

It also asserts, as a test rather than as folklore, that `createShapedRoutes`
still excludes parameterised routes — so if that ever changes, the exemption
this test exists to cover can go with it.

The leads page uses a different renderer and still has no button. Recorded here
rather than half-built.

### 2026-08-12 — The competitor figure on the pricing page was wrong

Researched the comparison set against live 2026 pricing rather than the July
snapshot, and the headline finding is a correction that goes against us.

**$77 was Jobber's annual price added to Podia's monthly one.** Not a stack
anybody is quoted. On monthly billing — which is what a new customer takes —
Jobber Core is $39, Podia Mover $39, Brevo Starter $9: **$87**. The pricing page
had been telling customers $77 for two weeks.

The fees the July table never recorded matter more than the sticker prices.
**Podia Mover takes 5% of every digital sale**, so it costs more than Shaker at
about $1,000 of monthly sales. **Brevo Starter puts Brevo's logo on your emails**
unless you pay $9 to remove it, and has no automation until Standard at $18. A
working stack — unbranded, with automation, monthly — is **$105**.

Against $87 our All-three at $39 is 45% of the stack; against $105 it is 37%.
The recommendation does not change, because $19/$39/$79 was chosen so no
existing customer pays more. The comparison it rests on is simply stronger than
it was, and now says "monthly billing" out loud.

`docs/market/2026-08-12-MARKET-AUDIT.md` also separates what we can claim from
what we cannot. We take no percentage of a customer's sales, which against
Podia's 5% is the largest real cost difference — **and we cannot say it in
marketing until a paid signup has completed in production**, because until then
there is no evidence our own payment path works. And Jobber Connect at $119 buys
routing and a field app this product does not have; pricing against that would
be selling something we cannot deliver.

Two guards came out of it. `tests/pricing-claim-matches-research.test.js` ties
the figure on screen to the audit that establishes it, requires the billing
period to be named — that being the exact error — and requires the audit to
cite sources. And an existing test pinned the literal string "July 2026", so
**re-surveying the market broke the test that exists to keep the claim honest**.
It reads the date from the audit now.

The first version of my own check matched any "$N a month" and caught "$39 a
month for the business side" — a per-product figure in the same sentence.
Tightened to the sentence that totals the stack.

### 2026-08-12 — A tap was leaving cards rotated, and the check looked at the wrong file

Audited the depth against 2026 practice before changing anything, the same way
the pricing claim was audited. Findings and sources in
`docs/design/DEPTH-AND-CORE-WEB-VITALS.md`.

Most of it held up. Depth is CSS 3D rather than WebGL, `will-change` is scoped
to `.sonara-stage` so work screens rendering hundreds of cards pay nothing,
pointer work is one delegated passive `pointermove` coalesced into a single
`requestAnimationFrame`, entrance uses `IntersectionObserver` rather than a
scroll handler, and reduced motion and print are both handled. The 2026 shift
the research describes — depth that answers the cursor and the scroll position
instead of a hero object performing — is already what `sonara-depth.js` does.
Nothing needed adding.

**One rule did not hold.** `public/sonara-application-ui.css` tilted
`.sonara-product` on `:hover` with no pointer gate. A tap on a touch screen
latches `:hover` onto the tapped element until the next tap lands somewhere
else, so that is not a hover effect — the card rotates and stays rotated.

Nothing was visibly broken, which is the part worth keeping. A correct, gated
`body.sonara-home-v3 .sonara-product:hover` sat on top of it and won on
specificity. But that rule is scoped to a body class, and `.sonara-product`
renders on exactly one page: **the guarantee held because of where the card
rendered, not because of what the card was.** The first such card on any other
page brings the stuck tilt back with every check still green. The small-screen
fallback had the same shape — it reduced the tilt but was still `:hover`-bound,
and width is not pointer.

`tests/marketing-depth-surface.test.js` asserts this gate exists, by reading
`sonara-design-system.css` and only that file. It was true, and true about the
wrong file — the other stylesheet is linked by the same frame and loaded after
it, so at equal specificity the ungated rule wins.

`tests/pointer-gated-depth.test.js` names no file. It reads the stylesheet list
out of `lib/sonara-page-frame.cjs` and holds every served sheet to the same
rule, so a third stylesheet is covered without anyone remembering. It walks
`@media` nesting rather than matching text, because whether a selector is safe
depends entirely on what it is nested inside. It fails when it finds zero 3D
hover rules or fewer than two stylesheets, since a check guarding nothing reads
exactly like a check finding nothing wrong. Verified by putting the original
rule back and confirming it fails by name.

The last assertion is the one that generalises: a 3D hover rule scoped to a body
class must still carry its own pointer gate. Specificity is a fine way to win a
cascade and a poor way to hold a safety guarantee.

### 2026-08-12 — The lead conversion finally has a button

Recorded two entries above as half-built, and it is built now.

`/growth-studio/leads` is a capture form — somewhere to write a lead down, with
no list of the ones already written — so the conversion's rules, endpoint,
duplicate guards and migration were reachable only by an API client. That is
not what a small business owner has.

`/growth-studio/enquiries` lists the people who have come to you and carries the
button that makes one a customer. Named for what it holds rather than for the
table, in the words the totals card on this product already uses.

The row that cannot convert says why rather than showing a button that refuses.
**The reason is `reasonNotConvertible` itself — the endpoint's own function, not
a second copy of the rules.** Two implementations of "can this convert" drift,
and the one on the page drifts silently: it only ever shows or hides a button,
so nobody finds out until an owner presses one that fails. That rule needs the
customer list, so the page loads it, and a failed read stays `null` instead of
becoming an empty array — an unreadable customer list is not "no duplicates".

The endpoint answered every path with JSON. A form post would have shown the
owner a wall of punctuation and lost the customer they had just created: a
working endpoint that reads as a crash. It redirects a browser to the customer
it made, or back with `?problem=` when it refused.

`tests/row-actions-are-pressable.test.js` **names this exact defect in its own
header comment** and then iterated `ALL_OWNER_PAGES` and nothing else, so the
lead action could be absent or mis-wired with every assertion passing. It reads
both renderers now and asserts both declare an action, so a third collection
cannot quietly narrow what the file means.

Two checks came out of building it. Both renderers substitute on the literal
`:id`, so an action declared with the route's own parameter name — `:leadId` —
passes every other check here and posts to a literal `":leadId"` path when
pressed; that is now asserted. And route shapes are compared with parameter
names normalised rather than by string, which is what let the check cover two
routes whose parameters are named differently. Verified by mis-declaring the id
and by removing the action, and both were caught by name.

### 2026-08-12 — A table queried by the code and created by no migration

`verify:orphan-tables` asks which tables the migrations create that nothing
queries. That is the harmless direction — unused schema costs confusion. The
dangerous one went unasked: a table the application queries that no migration
creates is a feature that cannot work, in production, forever.

`server.js` counted `product_modules` on two admin surfaces. **No migration has
ever created it.** The name was written in a bulk commit in July 2026 and never
backed, so both cards have always rendered "unavailable until Supabase tables
are migrated" — a message promising a migration that was never coming. The
catalog it wanted is `sonara_module_registry`, which migration 018 creates and
seeds, and which is already classified global.

`tests/tenant-isolation.test.js` comes close and states its own limit honestly:
a `/rest/v1/${table}` is resolved at runtime and cannot be checked from there.
True — but the blind spot is wider than the sentence.
`safeCountTable(config, "product_modules")` passes a string literal, knowable at
rest, invisible only because a helper builds the URL.

`tests/every-declared-table-exists.test.js` asks the question of declarations
rather than of request URLs: rest paths, `table:` properties, assignments,
helper calls, and the `TABLES` maps route files use to keep literal names out of
call sites — the same indirection that hid this one. Across the whole runtime it
found exactly one problem. It separately asserts it still finds declarations
*through indirection*, without which it silently degrades into a duplicate of
the check that already passes.

### 2026-08-12 — What a streaming engine does and does not say about a record list

Prompted by a streaming-engine explainer. Two of its six concepts describe
something true here; the other four are a rendering architecture for a
continuous 3D world, and borrowing their vocabulary for a list of invoices would
be taking the appearance of rigour without the substance. Written up that way in
`docs/design/STREAMING-AND-RECORD-LOADING.md` rather than as six mapped
principles.

**The load zone did not know the size of the map.** Every owner and creator
record page read `limit=100` and captioned the table `${rows.length} records`.
Under the cap that is right. Over it, the page states a total it never measured
— a business with 250 customers is told it has 100, with nothing on screen
suggesting otherwise. Not a truncated list: a wrong number, presented as
confidently as a right one. The row count was never the record count.

Reading one row past the page settles "is there more" for free, and an exact
count is paid for only once the first read shows it will say something new — so
an account under the cap still costs one query. A failed count stays null and
the caption says "more than 100", the floor the first read established rather
than a number invented to fill the gap. The caption is its own exported
function, because the defect is a sentence and a sentence can be checked without
a database.

**Level of detail, applied.** The owner pages selected `*`: 307 columns fetched
to render 112. Now 153. The field list cannot be read off the declaration —
columns are `value: (row) => …`, the renderer reaches for `row.id`, and refusal
rules read fields no column shows — so it was derived two ways and unioned:
running each function against a recording proxy, and reading the properties
taken off the parameter in the function source. **Both were needed.** The
runtime probe alone missed `customer_id` on quotes, because the refusal rule
returns early on any status that is not `accepted` and never reaches the line
that reads it.

The check deliberately does not repeat that derivation — a check that rebuilds
the list the way the list was built agrees with itself by construction, which is
the tenant-tables defect exactly. It tests the property instead: give a column
function a row containing only what the select asked for, and see what it
reaches for. And separately, that every selected field is a column the
migrations create, because PostgREST rejects an unknown column by rejecting the
whole query — one typo turns into a page reporting itself as unconfigured.

Paging past the first 100 is still not built. The list now says a total exists
beyond the cap and still offers no way to reach it. Saying so is better than the
previous silence and is not the same as being finished.

### 2026-08-12 — The environment check could not report a name it had never heard of

`scripts/verify-env.mjs` exists to hold one line: every variable the code reads
is classified, and every classified name is read. It found names two ways —
`process.env.X`, and bare string literals, because this codebase declares some
variables by name rather than reaching for them. The literal pass read:

```js
if (candidateNames.has(match[1])) used.add(match[1]);
```

**A literal was recorded only if it was already classified.** A name the file
had never heard of was skipped rather than flagged, so "all classified" was true
by construction — it could not have come out any other way.

Thirteen names sat in that gap, and they were not incidental. The plan table in
`server.js` declares its price variables as `env:` and `envAliases:` values, and
`lib/sonara-readiness.cjs` resolves each primary name and then its aliases at
line 301. **The three variables that gate every paid plan were invisible to the
environment check while it reported success on every deploy.**

The filter had a real purpose — any shouty string literal would otherwise look
like a variable — so the fix is not removing it but adding a pass that needs no
allow-list: a key literally named `env` is not ambiguous. The count went 58 → 71.

Turning it on surfaced eight more names from `scripts/seed-stripe-products.mjs`,
which is **deleted rather than classified**. It was referenced only from
`archive/`, printed the retired public names, and quoted $9–15 / $29 / $49–59 /
$79–99 against live plans of $7 / $19 / $39. Classifying its variables would
have recorded a fiction; the honest read is that anyone who ran it would have
been told to build the wrong catalogue under names we do not use.

`tests/env-check-can-report-a-name-it-does-not-know.test.js` guards the property
rather than the line: it writes a module declaring an unclassified `env:` name,
runs the script, and requires it to fail *and to name the variable*. If that ever
comes back clean, the literal pass has been re-gated and the blind spot is open.

Worth stating plainly, since the classification is honest but easy to
misread: each price variable is genuinely optional — a missing one makes that
plan report setup_required, a stated fallback — which means **it is possible to
set all ten "required for paid usage" variables and still sell nothing.** The
ten cover the machinery of charging, not the existence of anything to charge for.

### 2026-08-12 — What the live Stripe account actually contains

Checked read-only against `acct_1TRSqj0dKtlEU3lA`. All three advertised plans
have an active price on an active product charging exactly the advertised
amount: Starter 700, Core 1900, Pro 3900. The price ids are now written into
`docs/owner/OWNER-STEPS.md` beside the variable each belongs in — they are not
secrets, they travel to the browser at checkout.

So step 1 is not blocked on Stripe configuration. What it proves is whether
*our* checkout, webhook and entitlement path works end to end, which no amount
of reading establishes.

Two findings from the same look. A one-time **$197 `Business Builder setup`
price is live and sellable** on an active product, while the application
deliberately does not offer that plan — nothing is broken, but the price exists
if a variable is ever pointed at it. And `lib/sonara-billing.cjs` claimed the
three retired plans were active prices on archived products; **that is no longer
true** — all three read inactive on both. The guard stays, because Stripe really
does not clear a price's active flag when its product is archived, but the
comment now describes a shape that could occur rather than one that does.

### 2026-08-12 — Two checks of the same rule, and the optimistic one was on display

Whether a plan can actually be sold is asked in two places: `lib/sonara-billing.cjs`
at checkout, where the key is always present, and `scripts/verify-stripe-env.mjs`
in the release chain, where it usually is not.

**They disagreed.** The runtime guard expands the Stripe product and refuses
`price_product_archived`, because archiving a product does not clear its prices'
active flag — `price.active` alone reads true and only the product says
otherwise. The release check read `price.active` and stopped, so it would pass a
configuration the running server rejects. The release output is what people
read, which put the more optimistic of the two on display.

The second defect was in the summary. The last line read *"Stripe configuration
verified against the deployed server"* whether or not the live comparison ran —
and it never runs in CI, because `STRIPE_SECRET_KEY` is not there. So every
release ended with a sentence saying the amounts had been checked against Stripe
while the `[SKIP]` two lines above said they had not. **The skip was honest and
the summary overwrote it.**

Both fixed: the release check expands the product and refuses an archived one,
and the summary now names which half ran. Offline runs say plainly that live
prices were not compared and point at the guard that does compare them.

`tests/stripe-checks-agree-with-each-other.test.js` holds the pair together. It
requires both files to expand the product and both to refuse an archived one, so
neither can quietly become the lenient one again. It also requires the summary
to be conditional, and requires the flag to be set on the success path rather
than when the key is found — setting it early would restore the original claim
in a new place. These are source assertions because the online half needs a live
secret, and a test that supplied one would mean either a secret in the
repository or a network call in the suite.

### 2026-08-12 — The same overclaim, one script over, and a check for the class

Having found it in `verify-stripe-env.mjs`, I swept the release chain for the
shape rather than assuming it was a one-off. It was not.

`verify-open-source-registry.mjs` printed `Network verification: disabled` and
then, on its last line, *"Open-source and external repository controls
verified."* The release chain does not pass `--network`, so **the release log
ended with the word "verified" while nothing had confirmed that any of the 72
registered GitHub targets still exists.**

Milder than the Stripe case in one respect: the network half is not unrun, it
has its own workflow (`external-repository-health.yml`). So the summary now
names it, which is more useful than a bare qualification — the question a reader
has at that point is "then who does check".

`tests/no-check-claims-more-than-it-ran.test.js` covers the class instead of the
two instances. It reads the script list out of `verify:launch` rather than
restating it, so a script added to the chain is covered without anybody
remembering; it selects the ones that can decline part of their work, by their
own output; and it requires their verification summary to name the reduced scope.
A third script cannot arrive with the same shape.

The sweep also found the honest cases, which is worth recording: `verify:db`,
`verify:api`, `verify:member-policies`, `verify:definer-exposure` and the rest
either need no credentials or fail rather than degrade. Two scripts had the
defect and the other eleven did not.

### 2026-08-12 — The differentiators reach the customer, bound to the code

The market audit worked out what is genuinely different about this product and
then none of it was on the site. Three findings sat in
`docs/market/2026-08-12-MARKET-AUDIT.md` and the home page said nothing about
any of them.

Each was verified against the code before it was written as copy, not after:

- **One record, not three.** The chain is pressable end to end — a lead becomes
  a customer, a quote becomes an invoice, an invoice becomes a reminder draft.
  It only became true this week; both conversions had shipped with no button.
- **Nothing is invented.** `lib/sonara-chase-drafts.cjs` makes no network call
  and loads no provider.
- **It says when it does not know.** The cash position excludes undated rows
  *and reports them*; an unreadable table renders unavailable rather than zero;
  and a capped list now names its total rather than its page.

`tests/the-claims-on-the-home-page-are-true.test.js` binds each sentence to the
behaviour underneath it. A claim on a marketing page is a promise, and this
repository's whole history is statements that were true when written and quietly
stopped being. If somebody wires a model into the chase drafts or makes the cash
position count an undated invoice as due today, the claim fails before a
customer finds out — verified by adding a `fetch` to the drafts and watching the
claim go red.

**It deliberately does not grep for comments.** `lib/sonara-chase-drafts.cjs`
contains the line "**No model call.**", and a check matching that would pass on
the comment while the file did whatever it liked underneath. It asserts the
absence of `fetch(`, of any gateway or adapter require, and of provider names.

One claim is checked more strictly than it reads. "Type it once" would be
satisfied, by every structural test, by a conversion that created a blank
customer and made the owner fill it in — so the test converts a real lead and
asserts name, email, phone and source all arrive. The source in particular:
losing it means the owner cannot remember where the customer came from, which is
the whole reason Growth Studio recorded it.

The copy went into the existing home page string rather than a new module,
because `server.js` sits exactly on its 4124-line ratchet and a `require` would
have cost the only line available. The section reuses `sonara-outcome-grid`, so
it inherits the mobile rules rather than needing new ones.

### 2026-08-12 — The totals card counted the page, including a money figure

The same defect as the record lists, in a different renderer, and one row of it
was money.

`growthTotalsCard` read up to 500 or 1000 rows and reported `rows.length` as the
total, under a heading reading "counted from your own records". A business with
1,200 enquiries was told it had 1,000. **Value of those sales summed the capped
read**, so a real revenue figure was short by however many conversions did not
fit — and the home page now claims every figure comes from the owner's own
records and that the product says when it does not know. The card contradicted
the claim shipped hours earlier.

A third defect sat in the same function: the failure guard was
`if (!campaigns.ok && !leads.ok && !conversions.ok && !content.ok)`, so a problem
was reported only when *every* read failed. One unreadable table left a real `0`
beside six real numbers, indistinguishable from a business that had none of that
thing.

Counts now come from `count=exact`, which costs one row of transfer whatever the
size, and each failed count says so in its own row. The value is the one figure
PostgREST cannot total without an RPC, so it is labelled for exactly the rows it
covers — "Value of the 1000 most recent sales" — rather than presented as a total
it is not.

**Two of my own assertions were wrong before they were right, and that is the
part worth recording.**

The first version stubbed every count as failing and asserted no `<td>0</td>`
appeared. It passed — and kept passing when I broke the code — because with all
counts failing the card short-circuits to "we could not count these" and renders
no rows at all. A vacuous assertion, of exactly the kind this repository keeps
finding. Caught only by breaking the code and noticing the test did not.

The second version failed only the leads count, which was right, but kept the
blanket "no zero anywhere" check — and that fails on the money row, which
honestly reads 0 when there are no sales. A check that cannot tell an honest zero
from a substituted one is not checking the thing it claims to. The third version
reads the specific row and asserts what that cell says.

### 2026-08-12 — The same substitution in the API, where nobody can question it

Swept for the shape rather than stopping at the card, and `/api/growth/metrics`
had it worse. Every field under a key literally called `totals` was `rows.length`
from a read capped at 500 or 1000. **A page has a heading somebody might
question; a JSON key called `totals` does not.**

Counts come from `count=exact` now, same field names, correct values. A count
that could not be read returns `null` rather than `0` — zero is an answer, "we
could not ask" is a different one, and an API returning `0` for both leaves the
caller unable to tell them apart.

`conversionValue` and the attribution breakdown are the two figures PostgREST
cannot compute without an RPC, so both are still a sample of the most recent
conversions. The response now carries `computedOver: { conversions, complete }`
saying so, instead of letting a caller assume it covers everything.

**The fix paid for itself in reads.** Once the counts came from the database,
five of the seven list reads were dead — still fetching up to a thousand rows
each purely to call `.length` on them. Lint caught it as five unused variables,
which is a more useful signal than it sounds: an unused variable here was a
thousand-row query nobody needed. The endpoint went from seven large reads to
two, plus nine counts that cost one row apiece.

### 2026-08-12 — A correction, and the worst instance of the same defect

**I got this wrong in the previous summary.** I said the remaining `rows.length`
uses found in the sweep were honest, and named two that were. I had not checked
`routes/sonara-business-control-plane-routes.cjs`, and it was not honest — it
carried the same defect twice, in the place it does the most damage.

`dashboardSnapshot` read each resource capped at 200 and did
`result.ok ? result.rows : []`. **Every failed read became a count of zero**, and
`nextBusinessAction` is driven entirely by those counts:

```js
if (!snapshot.counts.services) return { title: "Create the first offer", … };
if (!snapshot.counts.customers) return { title: "Add the first customer", … };
```

So an unreadable services table told a business that already sells things to
create its first offer, and an unreadable customers table told one with a full
list to add its first customer. A wrong number is a bad dashboard. **A wrong
instruction tells somebody their work has vanished** — and it is the same
sentence a genuinely new business sees, so nothing distinguishes a database
problem from an empty account.

Three fixes. A failed read is now `null` rather than `[]`, and "not readable"
never satisfies a "you have none of these" branch — it falls through to the
closing advice, which is true either way. Figures render as `—` rather than `0`,
because a confident zero on a dashboard reads as "your records are gone". And
the read asks for 201 rows so a full page reports `200+` rather than presenting
the cap as the total.

`moduleCard` needed catching on the way through: it interpolated the count
directly, so a null would have rendered the word "null" beside "saved records",
which is worse than either a wrong number or a dash.

The counts here are still page-based rather than `count=exact`, unlike the growth
surfaces. `rest()` discards the response headers and the tests bind their own
stub to `globalThis.__sonaraBusinessControlRest`, so exact counts would change a
contract several tests depend on. Recorded as a known limit rather than done
badly: the figures are now honest about being capped, which is the part that was
lying.

### 2026-08-12 — Sweeping "a failed read is an empty table"

Having found it twice by accident, I swept for the pattern rather than waiting to
trip over it again: `result.ok ? result.rows : []`, everywhere.

Fifteen sites. **Collapsing to `[]` is not automatically a defect** — it is fine
when nothing derives a claim from the empty set, and the sweep confirmed several
that were already right. `lib/sonara-cash-position.cjs` tracks what it could not
read and reports it. `routes/sonara-assistant-routes.cjs` goes further: without
the payments table a chase draft would state a full total on an invoice that may
be half settled, so it writes no draft at all. `/creator-studio/generation/jobs`
sets an unavailable message and never reaches its empty state.

Three sites were making a claim, and two of them were about the customer's own
history:

**The creator generation landing page** did `jobs = listed.ok ? listed.rows : []`
under an empty state reading *"Nothing yet. Use the form above to make your first
one."* A failed read told a creator their generated work had never existed and
invited them to start over — about outputs they may have paid for and waited on.

**A job's outputs card** did the same, and its sentence is worse: *"Nothing was
produced for this one"* on a completed job. The creator concludes the generation
they waited for failed, when the files are sitting in a table nobody could read.
The history card too.

**`GET /api/business-builder/businesses/:id`** returned `[]` per resource on
failure, over JSON, where a consumer has no heading to question and no way to
tell an empty table from an unreadable one. It now returns `null` for those and
lists them under `unavailable`.

That endpoint also read its eleven resources in a `for` loop with `await` inside
— eleven round trips in series for a response that needs none of them ordered.
Now one `Promise.all`.

The rule that came out of the sweep, and the reason it is not simply "never
return an empty array": **an empty list is only a lie when something reads it as
a fact about the customer.** A table that renders no rows is fine. A sentence
saying "you have never made anything", a count, an instruction, or a money total
is not.
