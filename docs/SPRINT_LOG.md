Newest first. Each entry says what changed, what was verified, and what the next
person should not have to rediscover. This is the hand-written half of
`docs/HANDOFF_PROMPT.md`; everything else in that file is generated.

### 2026-08-18 — the consent record's one meaningful field decided nothing

Went to check the consent-capture flow was really built, since `AGENTS.md`
requires it: "Enforce provenance, consent, and anti-clone safety." It is —
create, list, revoke, a page, and `evaluatePolicy` refusing a voice job without
a live record. Two things inside it were not.

**`consent_scope` was selected on every voice job and compared to nothing.** It
is the field that says *what the person agreed to* — text-to-speech, speech-to-
speech, voice clone, singing voice, or all of it — and a permission granted for
text-to-speech authorised a voice clone. The column being in the `select` list is
what made it look checked; that is this repository's recurring defect exactly, on
the most sensitive gate in the product.

There is now a map from capability to acceptable scopes, and a capability with no
entry is **refused** rather than let through on the blanket scope, so adding one
to `VOICE_CAPABILITIES` without deciding what covers it fails closed. A test
asserts every gated capability has an entry, and a second asserts every scope
named is one migration 20260723080000's check constraint will actually store —
otherwise a permission that satisfies the check could never be created.

`music_voice_profile` and `talking_avatar` have no scope of their own in that
constraint, so only `all_voice_generation` covers them. Stated rather than
quietly widened: the alternative is deciding on somebody's behalf that "singing
voice" included their face.

The mismatch has its own code and its own sentence. "Record a permission" would
send somebody to create a second one identical to the first; what they need is to
pick a different one or widen the one they have.

**And the form offered two capabilities nothing can run.** The capability list was
hand-written and included `voice_clone` and `singing_voice`; **no provider in
`lib/creator-generation-provider-registry.cjs` declares either.** So the two most
sensitive things on the menu were the two that could not work — a customer picked
"Voice copy", was told voice work needs a permission on file, went and recorded
one **naming a real person**, came back, pressed the button and got
`capability_not_supported`. A consent record about a real human being, collected
for nothing.

The list is derived from what providers declare now, filtered through an explicit
intent order, so both come back on their own the moment a provider offers them —
and a test asserts they are still filtered out, so the day that happens somebody
is told the menu grew rather than finding out later.

The check the change had to survive: the scope test must not become the only
test. A revoked or expired permission whose scope matches exactly is still
refused, and both are asserted.

Verified: `verify:launch` green end to end, 1999 tests passing. The scope check
was confirmed by disabling it and watching three tests fail.

### 2026-08-18 — the database was answering a question AGENTS.md says a person has to

Went to give `sensory_feedback_profiles` — the last of the three device tables
with an insert endpoint and no surface — a list and a form on
`/creator-studio/device-cues`, and found something in the schema on the way.

`AGENTS.md`: "Sounds, voice announcements, haptics, SMS, push, and email alerts
must be **off or explicitly user-controlled by default**." Migration 015 gives
`sensory_feedback_profiles.sound_enabled` and `.vibration_enabled` a **column
default of `true`**, and the insert path never named either. So every profile
created arrived with sound and vibration on, decided by the database, on a
question the rule says the person has to answer.

It is harmless today because nothing reads the table. That is not a reason to
leave it — the row is written now and read whenever somebody builds the consumer,
and by then nobody is looking at this. The four toggles are defaulted off in the
insert and asked for explicitly on the form. Both halves are tested: created off
when unasked, and **still on when somebody says yes**, because a default that
cannot be overridden is not a default and the rule is "off or explicitly
user-controlled" rather than "off".

Select options may now be `{ value, label }` as well as strings. `"true"` and
`"false"` in a dropdown is the schema talking to the customer; the eleven string
lists already written are untouched.

The "Uses" column folds four booleans into one readable cell and keeps the
distinction this repository keeps rediscovering: **absent is not false**. A row
whose columns did not come back reads "Not set"; all four genuinely off reads
"Nothing". Both are asserted, along with the two mixed cases.

That closes the third and last of the write-only device tables. All three
exemptions are gone from `tests/form-reachability.test.js` rather than reworded.

Verified: `verify:launch` green end to end, 1988 tests passing.

### 2026-08-18 — two tables nothing showed, and a wrong reason in an exemption list

`waste_logs` and `location_zones` were both excused in
`tests/form-reachability.test.js` as "no page displays this". One reason was
right and the other was false.

**`waste_logs` was right.** The endpoint existed, the columns existed, and a row
written through it was invisible from the moment it was created; the exemption
said "a form without a page to read the result on would be worse, not better",
which is true and describes the wrong fix. `/business-builder/owner/waste` is the
page. It belongs beside recipes and daily sales because it is the third number in
the same sum — `lib/sonara-formula-library.cjs` already defines `waste_cost` over
`waste_logs` and `inventory_items`, and a kitchen that knows its food cost and not
its waste knows the smaller half of where the money went.

**`location_zones` was false.** "No page displays location_zones; only the
generic list and insert exist" — `/business-builder/routes` has listed them the
whole time, and its empty state read "Add the areas you cover and they will
appear here" above no form, on a page that never had one. **A wrong reason inside
an exemption is worse than no exemption**, because it is what the next person
reads instead of checking. `/business-builder/owner/areas` lists and creates them;
the routes page redirects there, on the precedent set for vehicles — one page per
kind of record rather than a second view that can drift.

`polygon_geojson` is deliberately not on the form. Pasting GeoJSON into a text box
is not a form, and nothing here draws a polygon or reads one.

Two checks caught things on the way, both worth recording:

- The outage crawl rejected "Nothing is dispatched and nothing is tracked in the
  background" — "nothing is" reads as *you have no records* on a page whose reads
  are failing. Reworded to "It dispatches nobody and follows nobody". That is the
  **third** time this session the fix was the wording rather than an exemption.
- `tests/search-keeps-up.test.js` refused both pages until they were searchable.
  Waste searches by item and by the customer's own word for why; areas by name and
  kind. Not by cost — a number is not a search term.

Verified: `verify:launch` green end to end, 1981 tests passing, 277 required GET
routes.

### 2026-08-18 — the cue page was promising playback

Went to close the vibration-patterns dead end — a list with no way to add to it —
and checked what happens to a row before building the form, which is now the
habit. Found something bigger than the missing form.

`/creator-studio/device-cues` said: "Nothing plays, vibrates or moves on its own
— **a cue only runs when something you do asks for it** and your device allows
it." The first clause is the `AGENTS.md` position and was always true. The second
says a cue runs. **Nothing reads `sound_cues` or `haptic_patterns` anywhere.**
`grep` across `server.js`, `routes/` and `lib/` finds the record page, the generic
insert, and no consumer; the sound and vibration the application actually makes
come from a hardcoded map of five kinds in `public/sensory-device-client.js` —
success, error, warning, tap, complete — which never looks a row up.

So a customer could define a cue, be told it would fire when they did something,
and it would never fire. **The sound cue form has been in that position the whole
time** — the vibration list was the visible half of a problem both halves had.

The copy says what the rows are now: definitions, written down, not yet read by
anything. And with that true of both, the vibration form is honest, so it exists.
This is the fourth dead end examined this week and the first where the answer was
a door rather than a status — because the door's neighbour was already open.

`also` blocks carry forms now. That needed three things, and the third is the one
that would have rotted quietly:

- `routes/sonara-last9-routes.cjs` renders `formCard` under an `also` list when
  the block declares a form and an endpoint.
- `loadReferences` walks `also` form fields. **None of them is a reference
  today**, which is exactly when a picker breaks silently — the first one added
  would render "Nothing to choose yet" to a customer with records. That failure
  has now shipped twice in this file, on child forms and on the artist pages, and
  both were found afterwards.
- `lib/sonara-form-reachability.cjs` sees them, so `/api/sensory/haptic-patterns`
  came off the exemption list. Its stated reason was "no `also` block carries a
  create form" — an excuse that outlives its reason is the same defect as a page
  describing a capability it does not have.

**Two new checks, both verified by breaking them.** One asserts no runtime file
outside the record page's own surface names either table, so if somebody builds
the consumer the copy stops being true *and the build says so, naming the file* —
rather than leaving a page telling customers their cues do nothing after they
started working. The other checks every `also` form field against
`lib/sonara-migration-columns.cjs`, because a payload naming a column that is not
there is rejected by PostgREST while every stub in the suite accepts it: the
button works and nothing saves, which is how all nineteen record forms shipped
broken once.

Verified: `verify:launch` green end to end, 1975 tests passing.

Two rewrites the outage crawl forced, worth recording because the wording rule is
not obvious. "Nothing here plays, vibrates or moves" and "Nothing plays these"
both failed `tests/no-page-lies-when-the-database-is-down.test.js` — "Nothing
here" reads as *you have no records* on a page whose reads are failing. Reworded
to "Writing one down does not make it play", which says the same thing about the
feature and nothing about the customer's rows. Rewording beat adding an
exemption, the same call as the accounting-exports copy.

### 2026-08-18 — selling something that is not a service

Business Builder could price work and had no way to list a **thing**.
`business_service_catalog` carries one flat `price_cents` and a
`duration_minutes`, which is a service; `menu_items` is a menu; `inventory_items`
is stock on hand. A search across all 88 migrations for a variant or price-tier
table found only `growth_experiment_variants`, which is A/B testing. So a
business selling objects in sizes, colours or pack sizes had to retype every one
of them onto every invoice.

`merchant_products` and `merchant_product_variants` close that, with the record
page at `/business-builder/owner/products` and the versions as its child.

**The price is on the version and nowhere else.** A product with two sizes at one
price is a product with two versions that happen to agree. A price on the parent
as well would give two answers to "what does this cost", and the two would
disagree the first time somebody edited one. `tests/a-product-is-priced-through-its-versions.test.js`
asserts no column on `merchant_products` matches `/price|amount|cost/` and that
the form does not ask for one — verified by adding `price_cents` to the migration
and watching five tests fail.

**Named `merchant_products` rather than fighting for the word.** `products`
already exists and means something else: its `product_key` is constrained to
`business_builder`, `creator_studio`, `growth_studio` and `sonara_one`, so it
records which SONARA product an organization enabled. Two tables called products,
one of them meaning something else, is how the next person loses an afternoon.

**Scope, stated so nobody assumes the rest arrived with it.** This is a
catalogue: what you sell, in which variations, at what price. There is **no cart,
no checkout, no tax calculation and no shipping**. Those touch money rules
`AGENTS.md` governs, and a half-built checkout is worse than none. Quotes and
invoices already exist to take money for these.

**The one thing that could have looked finished and been useless.** An invoice
line can now name a catalogue version, which is what makes the catalogue worth
having — otherwise it is a list you retype. But a variant row says "Large",
"Blue", "Box of 12", and a dropdown offering three different products' "Large"
is a control that looks like a choice and is not one. `REFERENCE_SOURCES` grew an
optional `select`, used by exactly one of its nine sources, so the picker embeds
`merchant_products(name)` and each option reads "Oak shelf — Large". If the embed
does not come back the read is not-ok and the field renders "We could not load
these just now" rather than a list of adjectives. Verified by deleting the
`select` line and watching the test fail.

**Whether a product can be sold is a fact about its children**, so it is a card
on the detail page rather than a column on the list. Five states, and each says
only what is known: read failed, no versions, all versions archived, versions
with no price, and a price or a range. A blank price is not a free product —
`finiteNumber` again, for the same reason as every other total in that file.

`totalFrom` is now genuinely optional on a child spec, and the versions table
declares none. Adding up the prices of a small, a medium and a large produces a
number nobody is ever charged. `tests/owner-record-lines.test.js` distinguishes
"left out" from "set to undefined", so the omission is a decision rather than a
gap.

Verified: `pnpm run verify:launch` green end to end (exit 0), 1973 tests passing,
orphan-table check at 0 unused tables — the two new tables have a read path, which
is why the migration could not be committed on its own.

### 2026-08-18 — the third row claiming a worker, and a form not built

Went to close the reference-analysis dead end — a page listing analyses with no
way to create one — and checked what happens to a row before building the form
that would make them. Nothing happens to it.

`grep` for `creator_reference_analyses` finds the constant, one insert, and
**no runner, no status transition and no reader**. The endpoint wrote
`status: "queued"`, so every row claimed work waiting to be picked up and none
ever was. **Third instance of that shape this week**, after `accounting_exports`
reporting "whether each one finished" about a file nothing produced and
`integration_jobs` claiming a worker that does not exist.

Status is `review_required` now — in the schema's check constraint, and true
twice over. Nothing automated will touch it, and analysing reference material is
exactly what `AGENTS.md` puts in front of a person: provenance, consent and
anti-clone safety are judgements rather than jobs.

**The form was deliberately not built.** Adding one would let a customer queue an
analysis that never runs and watch it sit there, which is the defect this session
has now fixed three times. A dead end is better closed by telling the truth than
by adding a door onto nothing.

**What remains is an owner decision, not an engineering one.**
`/creator-studio/generation/reference-analysis` is a 302 into the generation page
carrying `capability=reference_analysis`, and the generation form's capability
picker does not offer it — the policy check even special-cases it
(`capability !== "reference_analysis"`). So the link names a capability the page
it lands on cannot perform. Either reference analysis is a product, in which case
it needs something that runs it, or it is not, in which case the signpost should
go. Both are decisions about what the product does.

**One thing checked and found not to be a bug.** `evaluatePolicy` lets
`reference_analysis` past the prompt requirement and then reads `prompt.length`
on the next line, which looks like a crash on a missing prompt. It is not:
`clean()` returns `String(value || "")`, so the prompt is always at least an
empty string. Reported here because the next person will read those two lines
the same way.

`verify:launch` green, 1954 tests passing.

### 2026-08-18 — a network check that could never have passed

`verify-external-repositories` failed on the branch head, and the log said what
happened without ambiguity:

> WARNING: GitHub API rate limit reached; remaining remote checks are indeterminate.
> ERROR: Network verification confirmed **none of 115** registered targets, so this run established nothing about whether they exist.

**The checker was right and behaved correctly.** It reached the rate limit before
confirming a single repository, and refused to report success on a run that
established nothing. That is the same discipline as every list-based check here:
a check satisfied by an empty result is worse than a check that fails.

**The workflow ran unauthenticated.** No token, which means 60 GitHub API
requests an hour shared across every runner on the same address, against **115
targets**. It could not have passed reliably at any point, and the register
growing from ninety-odd records to 111 this week turned "unlikely" into
"certain".

`scripts/verify-open-source-registry.mjs` has read `GITHUB_TOKEN` since it was
written — its own failure message ends "check GitHub availability and **the
token**". The workflow simply never passed one. One `env:` block does it, and
the existing `permissions: contents: read` is enough for the public repository
metadata it reads.

Worth stating plainly because the shape recurs: this was not a flaky check and
not a bad record. It was a check whose *preconditions were never met*, failing
honestly for months' worth of scheduled runs and only becoming visible when the
population grew past the free allowance. Nothing about the registry was wrong.

`verify:launch` green, 1954 tests passing.

### 2026-08-18 — offline touchpoints, refused twice and now built

The refusal note in `lib/sonara-growth-create-specs.cjs` named its own
condition: *"If offline touchpoints are wanted later, the honest version starts
with a column recording that a person entered it."* That column landed earlier
today, so the feature is built — and the three parts that make it safe landed
together rather than in sequence.

**The form.** A business can record the conversation at the counter, the phone
call, the person who mentioned where they heard of you. It deliberately does not
offer `provider_key`, `anonymous_id` or `external_event_id`: those identify a
tracked source, and putting them on a hand-entry form is offering to dress a
typed row as a measured one.

**The endpoint records which.** `true` for anything the form submits, and
**`null` — not `false` — when a caller says nothing**, because defaulting to
false would assert that every integration-written row is *known* to be
machine-recorded, which is a claim about callers this endpoint has never met.

**The funnel excludes it, and this is the half that matters.** The "Reached"
stage counts only rows that are not hand-entered. Every drop rate below it is
computed against that number, so without this a business could raise its own
reach and lower its own apparent drop-off by typing. `!== true` rather than
`=== false`, because null means "nobody recorded which" and every row written
before the column existed is tracked as far as anybody knows — treating null as
hand-entered would erase the whole history from the funnel.

The typed ones are **reported, not dropped**. `countStage` returns `handEntered`
alongside `count`. Excluding them silently would be as misleading as counting
them: the business recorded those on purpose and is entitled to see them, just
not inside a measured figure.

**Three existing checks refused the change, and each was right.** The
Growth-forms test caught that the handler wants `tracking_basis_attested` and the
form had no field for it — a form that submits into a 400 the customer cannot
act on, which is a defect that test already guards for content. The
form-reachability test caught its own now-stale exemption. And the test that had
refused this form twice failed by name.

That third one was rewritten rather than deleted, and it now asserts the
**invariant instead of the absence**: the column exists, the funnel excludes
typed rows and still counts null ones, the form offers no tracked-source field,
and the attestation is present and not pre-ticked. Verified by removing each of
those three protections in turn — every one fails, and the funnel one fails by
name.

`verify:launch` green, **1954** tests passing.

### 2026-08-18 — an existence check that was asking the wrong module

Adding `hand_entered` to a customer-journey stage failed validation, which
turned out to be the validation's fault rather than the column's.

`lib/sonara-migration-columns.cjs` answers two different questions.
`tableColumns` says which columns **exist** — including the 229 added by
`alter table` across the migrations. `describedColumns` says which columns can
be **described**, meaning declared inside a `create table` block with a parsed
type; it deliberately omits the rest, and says why: *"a form field with a
made-up type is worse than a missing one"*.

`lib/sonara-customer-journey.cjs` used the second to answer the first. Its
`validate()` exists so no column is typed from memory, and it would have
reported a real column as missing — **35 columns across 22 tables exist without
being describable**, and the first stage to name one would have been rejected.
`sonara_sound_assets` alone has 13 of them.

Existence uses `tableColumns` now. Nothing in that file needed a type, so the
describable helper went out with the switch rather than staying beside it as a
second way to ask.

Verified in both directions, because a permissive check that stops rejecting
anything is the obvious way to "fix" this and would have been worse: a stage
naming a column that does not exist is still caught by name, and a stage naming
a real `alter table` column is now accepted.

**And a fix that was not made.** The first read of this looked like a 229-column
blind spot in the module itself, and the first instinct was to teach it to
describe `alter table` columns too. Reading the code stopped that. The omission
is deliberate, documented, and protective: describing those 35 columns would put
them into forms built from descriptions, and `hand_entered` reaching a customer
form is exactly the wrong outcome. The narrow fix was in the caller, not the
module.

`verify:launch` green, 1948 tests passing.

### 2026-08-18 — which AI is possible here, and the column two features were waiting on

Two pieces of work, and the first decided the second.

**Researching what AI could be added produced an answer about headers, not
models.** `AGENTS.md` requires AI calls through the Provider Gateway or an
approved adapter, and a feature must cost the customer nothing. Together those
rule out every hosted model API as a shipped capability: a per-token bill cannot
sit behind a free tool, and a free tier is a price somebody else can change. So
the question is *which AI has no per-use cost*, and there are two answers.

**The first is that the plumbing already exists and is switched off.** Six
adapters — Ollama, Open WebUI, Dify, Langflow, RAGFlow, Crawl4AI — plus the
gateway itself, every one reporting setup-required until configured, with no page
noticing its absence. The realistic zero-cost version of AI here is **Ollama on
hardware the owner already owns**, and that is configuration rather than
engineering.

**The second is browser-side inference**, and it mirrors the video sweep exactly:
the constraint that blocks server-side tools does not apply to something running
on the customer's own device. **Transformers.js** (16,261 stars) and **WebLLM**
(18,569), both verified Apache-2.0, registered at **111**.

Both are `needs_security_review` rather than adapters, and the reasons are in
this application's own headers, read out of `server.js` rather than assumed.
`connect-src` names Supabase and Stripe and nothing else, so a model download
from huggingface.co is refused — either that list grows or the weights are served
from here and this product pays the bandwidth. **`Cross-Origin-Embedder-Policy`
is not set anywhere in the codebase**: COOP is, COEP is not, so the page is not
cross-origin isolated, `SharedArrayBuffer` is unavailable, and multithreaded WASM
inference cannot run. And `script-src 'self'` with no bundler means a vendored
bundle this project then owns. None of that refuses the idea; it makes it an
owner decision about security posture.

WebLLM carries one more constraint that decides it alone: a usable model is
hundreds of megabytes at best and usually several gigabytes, once per device, on
the customer's connection. **Free that costs somebody two gigabytes of data is
not free.**

**Then the column two refused features were waiting on.** `growth_touchpoints`
and `sonara_prompt_templates` both refuse a form for the same reason: a typed row
would be indistinguishable from a tracked or curated one.
`lib/sonara-growth-create-specs.cjs` says so in as many words and names the fix —
"the honest version starts with a column recording that a person entered it".

`hand_entered` is that column, and it is **nullable on purpose**: true means a
person typed it, false means it arrived tracked or curated, and **null means
nobody recorded which**. A `not null default false` would write a claim about
every existing row — that it is *known* to be machine-recorded — on the strength
of nothing, which is the collapse this repository keeps finding, introduced
deliberately.

`tests/hand-entered-stays-three-state.test.js` pins that against the
well-intentioned tidy-up. Verified against both: making it `not null default
false` fails by name, and adding a backfill fails separately, because an UPDATE
is the same claim written another way.

Nothing writes the column yet, and that is stated rather than glossed. Before a
touchpoint form ships, two things have to happen: the form sets `hand_entered`
true, and the **"Reached" stage of `lib/sonara-customer-journey.cjs` stops
counting hand-entered rows as measured** — a funnel a business makes decisions on
must not quietly include evidence somebody typed.

A container reset landed mid-task and destroyed the migration, the research
document and the register edits before they were committed. All three were
rewritten. Sixth reset in twelve check-ins.

Register at **111**, 87 migrations. `verify:launch` green, **1948** tests passing.

### 2026-08-18 — contacts, and the same literal mistake for the third and fourth time

Third record type to become a file somebody else's software opens, after
bookings became calendar entries and accounting exports became CSV. A grep for
`VCARD` across `server.js`, `lib/` and `routes/` found nothing, so **"Customer &
Enquiry Tracker" — a paid product — could hold a customer's phone number and
offer no way to get it into the phone you would ring them from.**

`/business-builder/owner/customers/:id/contact` for one,
`/business-builder/owner/customers/contacts` for the address book. No dependency,
no service the owner runs, no per-customer cost. The static path is declared
before the parameterised one deliberately rather than by luck.

Two judgements written into the module rather than left implicit. **A name and
nothing else is a valid vCard and a useless one** — it imports somebody you still
cannot contact — so a card needs an email or a phone and the refusal says which
is missing. And **N is not guessed**: the product stores one `name` column, and
treating the last word as a family name is wrong for most of the world, so the
whole value goes in the first component and the rest stay empty.

**Then the same mistake, twice more.** `escapeText` was written
`.replace(/;/g, "\;")` — which in a JavaScript literal is just `";"`. In a vCard
that is worse than in a calendar file: `N` is positional and semicolon-separated,
so an unescaped semicolon in "Ashby; Ltd" imports as a family name and a given
name. Then the test asserting the fix was written with the same literal and
agreed with the broken code. That is the **third** and **fourth** occurrence of
one two-character mistake across three files.

So the guard is no longer per-module. One test now asserts that **both**
`sonara-contact-card.cjs` and `sonara-calendar-invite.cjs` escape a semicolon, a
comma and a backslash, and names which one failed. Verified by regressing each
module in turn: the calendar regression fails with "calendar invite leaves a
semicolon unescaped", the contact regression with "contact card leaves a
semicolon unescaped". Each module's own test would have caught only its own copy,
and the second copy was written *after* the first was fixed.

The outage crawl asked for the new download to be listed in `FILE_DOWNLOADS`,
which is the hand-maintained list added when the diary shipped. That puts it
under the stricter download assertion — 503, a readable body, no JSON blob, no
placeholder — rather than the page rule, which is the designed path and not a
weakening.

`verify:launch` green, **1944** tests passing.

### 2026-08-18 — the first e-commerce record, and a table named for the wrong thing

`lunarphp/lunar` was submitted with the instruction to add it to the application.
Verified **MIT** from GitHub's detected licence field, 3,650 stars, 495 forks,
pushed the day it was submitted. Registered at **109** — and it is the register's
**first e-commerce record**, which is a real gap in the same way speech
recognition was.

**It cannot be added as a dependency, and the licence is not why.** It is a
Composer package for Laravel; this application is Express CommonJS on Vercel
serverless with no build step. Adopting it means the owner runs a second
application with its own database — an infrastructure and cost decision, not a
licensing one. Recorded `reference_only` for that reason.

**Checking what Business Builder already has turned up the more interesting
thing.** The table called `products` is not a merchant catalogue at all: its
`product_key` is constrained to `business_builder`, `creator_studio`,
`growth_studio` and `sonara_one`, so it records *which SONARA product an
organization has enabled*. The merchant-facing tables are
`business_service_catalog`, `menu_items` and `inventory_items`, with quotes and
`customer_invoices` on top.

So a business here can price a service and invoice for it, and has **no product
catalogue with variants, no cart, no checkout, no tax rules and no shipping**.
That is a larger gap than the submission implied, and it is worth knowing before
anybody plans around the word "products".

Third table this week whose name points somewhere its columns do not —
`song_fingerprints` holds descriptions rather than audio, `accounting_exports`
promised a file nothing produced, and now `products` names SONARA's own
enablement rather than anything a customer sells. None is a bug. All three are
the kind of thing somebody builds a plan on.

What Lunar is genuinely good for is the model: variants, price breaks, tax rules
and discount stacking are the hard part of selling, they are worked out and
tested there, and reading them costs nothing and needs no service running. Its
payment and refund paths are explicitly out of scope — money here goes through
the existing provider path, and refunds are one of the seven owner-approval
categories whatever an imported library would allow.

`verify:launch` green, 1932 tests passing.

### 2026-08-18 — a submitted document, assessed rather than assumed

A saved MHTML archive of a newsletter landing page was submitted with the
instruction to use its information in the product and in the Claude setup. It was
opened before anything was done with it, which settled the question quickly.

**The archive is 125 KB and its entire visible text is 1,746 characters** — a
heading, fourteen resource tiles carrying a title, a category and a one-line
description each, and a footer reading `© 2026 The Code Newsletter`. No code, no
data, no specification, no attachment. Every tile is an outbound link to a
separate hosted site, eleven of them on `lovable.app`, and **none of the fourteen
is a repository**, so none is something this register can assess for a licence.

Registered **blocked**, on the reading already applied to the IONOS guide: a
document that is free to view and carries an explicit copyright notice has
granted nothing. Free is a price, not a licence. Register at **108**.

**What could honestly be taken was a count, not a sentence.** Eight of the
fourteen resources are about Claude Code, the Claude Agent SDK or building AI
agents. That is a dated, checkable observation about where a developer newsletter
believes its subscribers' attention is, and
`docs/market/2026-08-18-SUBMITTED-RESOURCE-INDEX.md` records it along with
something more useful: a table mapping the subjects those tiles name against what
this repository already has — the agent runner, the seven owner-approval
categories, the hourly scheduler, the approval queue that re-asks the gate, and
the 23-command release chain. Nothing on that list came from the document, and
the table says so plainly. **The subjects are current and the work is already
here.**

Written down deliberately rather than left implicit: none of the fourteen
destinations was fetched to extract its content. Reading somebody's guide in
order to lift it is exactly what the register exists to refuse, and a page being
publicly reachable is not a grant.

`verify:launch` green, 1932 tests passing.

### 2026-08-18 — the unexamined queue is empty

`tests/form-reachability.test.js` carried **thirteen** entries reading "NOT YET
EXAMINED". There are none left. Each now states what was checked and what was
found, and the answers divide into two kinds that matter more than the entries do.

**Listed somewhere, creatable nowhere.** A page displays the records and no form
makes one, so a customer sees an empty list with no way to fill it.

- `creator_reference_analyses` is rendered at
  `/creator-studio/generation/reference-analysis`, and the generation form's
  capability picker does not offer `reference_analysis` at all — the validator
  even special-cases it. Only a direct POST creates one.
- `haptic_patterns` is rendered on `/creator-studio/device-cues` as an `also`
  block, and **no `also` block in the whole file carries a create form**; that
  page's one form makes sound cues.

The second one was telling a customer something false. Its empty state read
*"You have not defined any vibration patterns yet"* — which says they simply had
not got round to it, when there is no way for them to do it at all. It now says
so, and states the `AGENTS.md` position while it is there: vibration stays off
until one exists. **A page inviting an action it does not offer is the same
defect as a page claiming a capability it does not have.**

**Displayed nowhere at all.** `waste_logs`, `location_zones` and
`sensory_feedback_profiles` appear only in the generic RESOURCE_MAP — a GET that
lists and a POST that inserts, with no page anywhere. A record written through
them is invisible from the moment it is created, which is exactly the shape that
made the market-intelligence page worth fixing. A form would make that worse
rather than better, and the entries say so.

**The four prompt-library endpoints are reachable only by API**, and the reason
is now stated rather than left as an absence. The library's single form —
"Fill the template" — posts to `/prompt-library/:slug/render`, produces a preview
to read, and saves nothing. What those pages render is curated content in
`data/prompts-chat-reference.cjs`, so a customer-authored row saved beside it
would be indistinguishable from the curated set on the page that lists them.
That is the same objection already recorded for growth touchpoints, and it wants
the same answer first: **a column marking a row as customer-authored.**

Two of the thirteen turned into fixes; the rest turned into reasons somebody can
disagree with. Both are better than "not yet examined", which is a note that
survives indefinitely because nothing about it ever fails.

`verify:launch` green, 1932 tests passing.

### 2026-08-18 — a page that never showed what it told you it would show

Working the "NOT YET EXAMINED" queue in `tests/form-reachability.test.js`. The
four market-intelligence entries examined together, and the examination found
something bigger than the entries.

**`/*/market-intelligence` said "The workspace starts empty until
organization-scoped evidence is recorded."** That tells a customer that recording
evidence changes what they see. The handler was **synchronous**, read nothing,
and rendered the same static framework cards whether the organization had one
competitor recorded or four hundred. Four endpoints accept POSTs — segments,
competitors, signals, opportunities — no page displayed any of them, and no form
anywhere posts to them, so a record written through the API was invisible from
the moment it was created.

The page counts the organization's own evidence now, and a record type that could
not be read is **named** rather than folded into a zero.

**One exemption reason described a form that does not exist.**
`/api/market-intelligence/fetch-source` was excused with "…and the signal form is
still the only way anything is written". There is no signal form: no form action,
no create spec, nothing posts to any market-intelligence endpoint from a page.
The same defect as a page describing a capability it does not have, sitting in
the reason a check was excused.

**Then the crawl let the new page lie, and that was the real find.** Injecting
`0` in place of "could not be read" left the whole suite green. `CLAIMS_EMPTY`
looks for *words* — "no", "nothing", "yet" — and **"Competitors: 0" contains
none of them.** Any page rendering counts could tell somebody they have none of
something during a total outage and this crawl would pass it.

`CLAIMS_ZERO` closes that. No page renders a bare "Label: 0" today, so it is an
addition with nothing to clean up behind it, and it is deliberately narrow — a
pattern that fired on money would be switched off within a week.

**And the first version of `CLAIMS_ZERO` matched nothing at all.** Its lookahead
`0(?![.\d])` rejected "Competitors: 0." because the sentence-ending full stop
looked like a decimal point. It passed, while measuring zero pages — this file's
own defect, inside this file's own check — and the only thing that found it was
injecting the bug again and watching it stay green. **A check that has not been
run against bad input is not a check, however carefully it was written.**

`verify:launch` green, 1932 tests passing.

### 2026-08-18 — the same defect, found by generalising the last one

The accounting export was one instance of a shape: a row written with a status
that promises processing, and nothing that processes it. Rather than wait to trip
over the next one, the shape was searched for — every table inserted with a
default status through the generic write endpoints, thirty-one of them.

Most defaults are `active` or `draft`, which are honest initial states a *person*
changes by editing the record. Two words promise a machine: `queued` and
`scheduled`. **`integration_jobs` is the other `queued` one**, and grep finds the
insert, the tenant-scoped list, and no runner anywhere — no page, no status
transition, nothing that reads it.

Its default is **`manual_required`** now, which is already in the schema's check
constraint and is true: a person has to do this. One word, no migration, and the
row stops claiming a worker this system does not have.

**This one was already recorded as unexamined, and that is the part worth
keeping.** `tests/form-reachability.test.js` listed it as *"NOT YET EXAMINED:
resource in RESOURCE_MAP with no page."* — one of fourteen such entries. The
codebase had honestly written down that it did not know, rather than assuming it
was fine, and examining it took ten minutes and closed it. The entry now says
what is true: nothing consumes `integration_jobs`, so a form would let somebody
queue work that will never run, which is worse than no form.

Thirteen "NOT YET EXAMINED" entries remain, and they are a better queue of real
work than the rest of the GitHub category sweep.

`verify:launch` green, 1932 tests passing.

### 2026-08-18 — a status nothing could advance, and a cell that runs as code

Checking the product before searching again, this time across every record type:
**the application emitted no CSV at all.** 141 HTML responses, 10 plain text, one
XML. Nothing else.

That matters because `/business-builder/owner/accounting-exports` said *"Batches
of your records prepared for an accountant or accounting software, and whether
each one finished."* `accounting_exports` carries `export_type`, a period, a
`status` and a `file_url`. **Nothing wrote `file_url`. Nothing moved `status`
past `queued`.** The only code touching the table is the endpoint that inserts
the request. So a customer asked for an export, saw "Queued" under a column
promising to say whether it finished, and the answer could never change.

**The file is built when it is asked for**, not queued and stored. There is no
worker here, and a status only a worker could advance is how the promise came to
be written.

Three export types are served — bills, sales, inventory — and
`payroll_summary` and `journal_entries` are **refused by name**. Both need
accounting judgement this code has not been given: what belongs in a journal
line, how gross pay reconciles to cost. Guessing would put wrong figures in front
of an accountant, which is worse than putting none, and "not supported" tells
somebody nothing about whether to wait.

**A cell is not a formula, and that is a security property.** A value beginning
`=`, `+`, `-`, `@`, tab or carriage return is executed by Excel, Sheets and
LibreOffice on open — so a note a customer typed becomes code running on their
accountant's machine. `lib/sonara-record-csv.cjs` prefixes such a value with an
apostrophe, which **changes it**, so the count is returned and the route sends it
in a header rather than rewriting somebody's records silently.

**And the first version of that broke the export it was protecting.** `-` is a
formula-start character, so every negative amount came out as `'-12.50` — text,
in a file whose whole purpose is for an accountant to sum it. A plain number is
exempt now, by an exact pattern rather than a permissive one: `-1+cmd|'/c calc'!A1`
still fails it. The test caught this by asserting the behaviour and my reading
what that meant, not by going red.

Three more things the checks caught, each a real ambiguity rather than a nuisance:
`accounting_exports` had no member read policy (added, 51 now); the page copy I
wrote to replace the old promise said *"nothing sits here waiting to be
processed"*, which the outage crawl read as a claim that the customer has no
exports — ambiguous rather than wrong, and reworded rather than exempted; and the
"Status" column, which on seven other pages tracks something that moves, is
labelled **"Asked for"** here because nothing advances it.

`verify:launch` green, **1932** tests passing.

### 2026-08-18 — the diary, and a crawl that judged a file as if it were a page

The per-booking calendar download shipped as half a feature. A business wants
their week in their calendar, not to click twenty times.
`/business-builder/owner/bookings/calendar` is the diary.

**One builder, not two.** The feed was going to assemble its own VEVENT lines,
which is how two builders of one format drift until a client accepts the download
and rejects the feed. `eventLines` is now shared, and a test asserts the same
booking renders **identically** whether downloaded alone or inside the diary.

**What it does with a booking a calendar cannot show is the point.** It skips it
and *counts* it, and the count is returned rather than dropped — a feed that
quietly omits three appointments is a diary that lies by being incomplete, and
the business has no way to notice. The route sends the number in a header. `null`
and `[]` stay different answers too: a failed read is refused with
`not_a_list` rather than rendered as a business with no bookings, and the route
answers 503 instead of handing back an empty but perfectly valid calendar.

**Then the outage crawl failed, correctly, and the fix was not to relax it.**
The crawl requires every route to render a page with HTML markers. This route
serves a *file*; putting an HTML page into a `.ics` request would be the wrong
thing, so it answers 503 with a plain sentence.

The HTML rule was always a proxy for "a human can read what came back", chosen
because everything crawled until now was a page. **Widening that proxy for every
route would have weakened it.** Instead downloads come out of that population
into a separate, *stricter* assertion: 503, a body a person can read, no JSON
blob, no placeholder, and wording that says what actually happened. The count of
routes accounted for does not fall, and these gain a check the pages do not have.
`FILE_DOWNLOADS` is listed by hand and deliberately short, because a route added
there stops being checked for page markers.

Verified against bad input: answering JSON instead of a sentence fails, a
placeholder leaking into the message fails, and emptying `FILE_DOWNLOADS` fails
rather than passing on nothing.

**A note on how nearly this went wrong.** The first two probe runs appeared to
show the new check passing on bad input, and the honest conclusion looked like
"the check does not work". It did work — `head -3` was truncating the output
before the summary line, and the visible matches were test *names* containing the
word "failing". Printing what the check had actually collected settled it in one
run. A probe that lies about a check is the same defect one level up, and the
only cure is looking at the data rather than at a filtered view of it.

`verify:launch` green, **1923** tests passing.

### 2026-08-18 — a booking you can put in a calendar

Thirteenth sweep pass: calendar. Checking the product before searching ended it
before a query was run.

`business_bookings` has `starts_at`, `ends_at`, a customer and a status. Three
booking tables, an API, a page. A grep for `VCALENDAR`, `text/calendar`, `VEVENT`
or `.ics` across `server.js`, `lib/` and `routes/` found **nothing**, and
`package.json` has no calendar dependency. A business could take a booking and
still have to retype it into whatever they actually use.

**No repository was needed.** RFC 5545 for one event is a few lines of text.
`lib/sonara-calendar-invite.cjs` builds it: no dependency, no bundle, no service
the owner runs, no per-customer cost, works offline. Against this sweep's other
findings — six repositories cleared on licence and blocked on architecture or
bandwidth — the capability worth shipping needed nothing adopted at all. That is
a fifth kind of result: **the gap was real and the answer was not a repository**,
and a sweep looking only for things to adopt does not find it.

`/business-builder/owner/bookings/:id/calendar` serves it, organization-scoped
like every sibling read, because the service key bypasses row level security and
the tenant filter is the only boundary. A download rather than an emailed
invitation on purpose: sending mail is a customer campaign under `AGENTS.md` and
needs owner approval; handing somebody a file they asked for is not. A failed
read answers 503 and a missing booking 404, because answering 404 to both would
tell a business their booking is gone during an outage.

**The parts of the spec that fail silently are done rather than approximated.** A
malformed `.ics` does not error — the calendar declines it, or imports it at the
wrong time, and the business finds out when nobody arrives. CRLF on every line
including the last. Folding at 75 **octets** via `Buffer.byteLength`, because
counting characters splits a multi-byte character in half and one accented name
does it. UTC with `Z`, since a local time without `VTIMEZONE` is the commonest
way an invite lands an hour out. A stable UID, so downloading twice replaces the
entry rather than double-booking the day. An unrecognised status stays
`TENTATIVE`; a booking with no end time is refused by name rather than given a
guessed hour.

**And the bug worth keeping.** `escapeText` was written
`.replace(/;/g, "\;")` — in a JavaScript literal that is just `";"`, so it
compiles, runs, and emits an unescaped semicolon. Caught by printing the
generated file, not by reading the code. Then the test asserting the fix was
written with **the same literal**, agreed with the broken implementation, and
failed against the correct one. Running it caught that. Neither would have caught
itself, which is the whole argument for doing both.

The member-read-policy check then caught the new read: `business_bookings` had no
policy a signed-in member could read through. Added to `ORGANIZATION_READ_TABLES`
rather than the service-role escape hatch, because it is ordinary workspace data
— a business's own appointments, sibling to `customer_records` — and the hatch is
for privilege and audit tables. 50 organization-scoped policies now.

Register unchanged at **107**. `verify:launch` green, **1919** tests passing.

### 2026-08-18 — the category that was already built, and a description I nearly acted on

Twelfth sweep pass: automation. Twelve Apache-2.0 results above 2,000 stars —
`conductor` (32,100), `trigger.dev`, `dagster`, `cadence`, `argo-events`.

This looked like the most product-relevant category yet, because a paragraph
describing this codebase says an agent action refused by the approval gate has
nothing to re-run it once the owner approves, and a serverless runtime has no
process running when no request is in flight. That is exactly what this class of
software is for.

**The gap is closed, and it was closed here.** Checked rather than assumed: an
hourly Vercel cron at `/api/agents/schedule/tick`, secret-gated, reading
`agent_schedules` across tenants — deliberately unscoped with the reason *stated*
to `buildTenantQuery` rather than hand-built to slip past the guard — and scoping
every run to the `organization_id` on its own row; `agent_pending_actions`
holding a refused run with its inputs; `lib/sonara-agent-queue.cjs` calling the
**same runner** again on approval; and a test.

It is also better for this purpose than any candidate, because the requirement
was never durable distributed execution. The classification is re-derived from
the action type rather than read off the row, since a stored classification is a
column the subject can write. Approving is not running, and approving something
unimplemented writes `unimplemented` rather than reporting a job as done. A
decision is made once, because approving claims the row out of `waiting` first.
Adopting Conductor or Cadence would put the approval gate inside a third-party
execution engine — the one place `AGENTS.md`'s rule is hardest to enforce.

**Fourth kind of empty result: *already built*.** With wrong word, wrong intent
and wrong altitude, that is the full set this sweep has needed.

**And a methodological note worth more than the pass.** I began from that
paragraph and was ready to treat the gap as real. The paragraph was true when
written; the repository has moved past it, and `lib/sonara-agent-queue.cjs` is
the queue it says does not exist. Acting on it would have meant **removing a
working, tested approve button** — the paragraph even says no button should
suggest otherwise. The finding came only from opening the files instead of
trusting a description of them.

That is the same failure the `song_fingerprints` record turned on, pointing the
other way: there, a description promised a capability the columns did not have;
here, a description denied one the code does have. Descriptions drift in both
directions, and nothing executes them either way.

Register unchanged at **107**. `verify:launch` green, 1910 tests passing.

### 2026-08-18 — a category that yields tooling, and a property nothing was holding

Eleventh sweep pass: animation. Ten results above 1,000 stars, and **every one
runs in the browser** — the good shape by pass nine's rule. By the standard the
owner set, none of them qualifies. `anime.js` (72,222 stars, the most-starred
repository found anywhere in this sweep), `mojs`, `svg.js`, `two.js`, `thorvg`
and the rest are **libraries for building our own interface**. They would make
these pages nicer. None is something a Creator Studio customer would ever see
listed as a feature.

That is a third kind of empty result, and the three are worth keeping distinct:
**wrong word** (`topic:paywall`, where the software existed under
`topic:publishing`), **wrong intent** (paywall removers, StreamCap), and now
**wrong altitude** — real, well-licensed, well-shaped software that is
infrastructure for us rather than a product for a customer. A sweep optimising
for registrations adds `anime.js` on its star count, and the register then holds
a JavaScript animation library inside a programme of work about products that
solve customer problems.

**What the pass produced instead.** Asking whether the product needed an
animation library meant checking what it already does, and that turned up an
unguarded property rather than a defect.

Eight client assets start motion. **All eight respect `prefers-reduced-motion`,
so nothing is broken.** What did not exist was anything holding it there:
`tests/motion-brand-system.test.js` asserts that
`public/sonara-application-ui.css` carries a reduced-motion block — true, and
about that one loader. A ninth animating file with no guard would have failed
nothing, and the suite would have stayed green while the guarantee quietly
stopped being true. That is this codebase's defect class in its purest form: not
a signal reporting success falsely, but a guarantee with no signal at all.

`tests/motion-respects-the-reduced-motion-setting.test.js` now asserts it across
every asset in `public/`, and asserts the list is non-empty first, because a
list-based check passes by being empty. **Verified three ways before being
trusted**: a new animating file with no guard (caught), the guard stripped from a
real file (caught and named), and the population emptied to zero (caught by the
non-empty assertion rather than passing silently).

`AGENTS.md` puts sounds, voice announcements and haptics off by default or under
explicit user control. Motion is the same kind of thing, and the operating system
already carries the user's answer.

Register unchanged at **107** repositories. `verify:launch` green, **1910** tests
passing.

### 2026-08-18 — a cost that grows when the customer succeeds

Tenth sweep pass: streaming, licence-first, MIT and Apache-2.0 run separately
because qualifiers cannot be OR'd. Six results above 800 stars, and pass nine's
rule sorted them on sight: `srs` (29,145), `vidgear` and `red5-server` are media
servers; `rx-player` (932) is client-side but a browser already plays ordinary
video, so it earns its place only for adaptive streaming with DRM, which this
product does not have.

**"A server the owner runs" was hiding two different costs, and the distinction
matters.** Every server-side candidate so far — whisper.cpp, vosk, Spleeter,
Ghost — costs compute **per file, once**: transcribe a video and the cost is paid
and finished. A media server costs **bandwidth, per viewer, every time**. It is
the one shape where the bill grows with the customer's success — a business whose
event goes well pays more than one whose event nobody watched, and pays again on
every replay.

The shorthand this sweep has used since the speech-recognition pass was accurate
and was concealing that. For a product whose rule is that a feature costs the
customer nothing, per-viewer bandwidth is the one cost that cannot be absorbed by
buying a bigger box once.

**And the category produced a second conduct block.** `ihmily/StreamCap` — 4,113
stars, verified Apache-2.0, second-largest result — monitors and automatically
records live streams from TikTok, Twitch, YouTube, Bilibili, Douyin, Douyu and
Huya. Every recording is somebody else's broadcast, taken without their
involvement. AGENTS.md requires this product to enforce provenance, consent and
anti-clone safety; this is not a borderline reading of that rule, it is the case
the rule describes. Recorded `blocked`, on **conduct rather than licence** — the
same shape as watermarks-remover, also permissive and also blocked.

Worth keeping visible for how it presents: legitimate topic, legitimate search,
clean permissive licence, high stars, and **nothing in its metadata flags it**.
Only the description does. That is `topic:paywall` again — a search term right
for the capability and wrong for the intent — and it is the concrete argument
against screening on licence and stars and skipping the reading, which is
otherwise the fastest way to run these passes.

Register at **107** repositories, 11 reciprocal, 6 declaring no licence.
`verify:launch` green, 1908 tests passing.

### 2026-08-18 — the blocker was a server-side blocker

Ninth sweep pass: video, licence-first. Fourteen MIT results above 1,000 stars.
Most are Python pipelines — moviepy, backgroundremover, autoclip, FunClip — with
the familiar blocker. **Two are a different shape**, both verified MIT:
**WebAV** (2,085 stars, WebCodecs SDK) and **FreeCut** (2,046, a complete
browser editor on WebCodecs and WebGPU).

**This qualifies the conclusion from pass six.** That pass ended "licence was the
constraint when this sweep started, architecture is now", on the strength of six
permissive repositories all blocked by this runtime. Every one of those six needs
**a server the owner runs** — infrastructure they pay for, a queue, and the
customer's media leaving the customer's machine.

A WebCodecs library has none of that shape. The work happens in the browser the
customer already has: no per-customer cost, no queue, and no upload of a file
that was never meant to leave their device. That is the same pair of constraints
this product's rules impose anyway, satisfied for free.

So architecture is the constraint **for server-side tools**, and there is a class
of candidate for which it is not. The sweep had not looked at that class until
now, only because every earlier category's leaders happened to be Python — which
is a fact about the categories chosen, not about what exists. A generalisation
drawn from six samples that shared a hidden property; the second one this sweep
has had to walk back, after the NOASSERTION rule.

What does **not** change, written into both records rather than glossed:
WebCodecs is not available everywhere and a browser without it must be *told* the
feature is unavailable rather than shown an editor that silently does nothing;
video work is heavy on a phone and `AGENTS.md` requires mobile to work; the
vendoring decision under `script-src 'self'` is the same one Excalidraw needs;
and FreeCut was created November 2025, so a browser editor's real cost — keeping
up with codec and browser changes — is a cost it has not paid yet.

Carried forward for the remaining categories: **ask where a candidate runs before
asking what it does.** Client-side and server-side are not two implementations of
one capability here — they are a free feature and a funded one.

Register at **106** repositories, 11 reciprocal, 6 declaring no licence.
`verify:launch` green, 1908 tests passing.

### 2026-08-18 — a table whose name promised something its columns do not have

Eighth sweep pass: audio and music, licence-first. Two registered, both verified
MIT — **spleeter** (28,379 stars, stem separation) and **seek-tune** (5,595, Go,
Shazam's recognition algorithm). Both carry the split that WhisperX established:
the code is MIT and the pretrained models are separately licensed, and the models
are the part doing the work. Both are outside this runtime, so both are services
the owner runs.

**seek-tune is registered mainly because of a trap next to it.** This repository
has a table called `song_fingerprints`, and the subsystem registry described it
as backing anti-clone matching. Pointing an acoustic fingerprinter at it is the
obvious move and it is wrong.

Its columns are `song_title`, `creator_name`, `identity`, `mood`,
`audience_signal`, `sonic_palette`, and a `fingerprint_id` that is **a plain text
field somebody supplies**. No audio, no hash, nothing derived from a recording.
The word "fingerprint" in its name means something entirely different from the
word "fingerprint" in seek-tune's. `grep` finds no writer either — the migration,
the tenant-scoped list, the registry note, and no code.

So acoustic matching is new storage and a new safety flow, not a column added to
a table that already sounds right.

**The registry's description was the part that misled, and it is fixed.** It read
*"Fingerprints used to tell one piece of work from another"* — which is precisely
what an acoustic fingerprint does, so it promised what the columns do not hold.
It now says what the table actually stores. The table cannot be renamed from
here: migration 004 is frozen and a rename is a destructive data change, which
`AGENTS.md` puts behind owner approval, so the description was moved to the
columns rather than the other way round.

This is the codebase's recurring defect found one layer out from the code. A
*description* claiming a capability that does not exist is harder to catch than a
function that lies, because nothing executes a description — no test fails, no
page breaks, and it reads as documentation of something real for as long as
nobody opens the schema.

The safety point sits ahead of the engineering one and the registry already had
it right: a false positive accuses a creator of copying, so the flow that
consumes a match is the safety-critical part, not the matcher, and nothing should
act on a match until that flow exists.

Register at **104** repositories, 11 reciprocal, 6 declaring no licence.
`verify:launch` green, 1908 tests passing.

### 2026-08-18 — the empty category was the wrong word

Seventh sweep pass: publishing. `topic:publishing` splits between publishing and
**package** publishing — lerna, gradle-play-publisher and intuit/auto are all
about shipping software releases. Fifth ambiguity, milder than the rest because
the real hits still sit at the top.

**And the top result is what pass three went looking for and reported as absent.**
Pass three searched `topic:paywall` for a way to help creators put work *behind*
a paywall and get paid, found four tools for defeating paywalls, and wrote the
category up as yielding nothing. It was not an empty category. It was the wrong
word: nobody building membership software tags it "paywall" — the people using
that tag are the ones removing them. **`TryGhost/Ghost`**, 54,789 stars, Node.js,
verified **MIT**, describes itself as "publishing, memberships, subscriptions and
newsletters", and was under `topic:publishing` the whole time.

Carried into the sweep document as a rule, because it will happen again: **when a
category comes back empty or hostile, suspect the search term before concluding
the software does not exist.** An empty result is evidence about vocabulary at
least as often as evidence about the world.

Ghost is also the strongest counterexample yet to the NOASSERTION observation
from pass five. Ghost(Pro) is not a side business, it is how the project is
funded, and the software is still MIT. Two clear exceptions out of six data
points now. The tendency stays as something to search by; both documents say
plainly it is not something to conclude from.

What is actually available: being Node.js is less useful than it sounds, since
Ghost is a full application with its own database and admin client — adopting it
means running it, not importing it. The part that needs no licence resolved and
no service run is the **membership model** — tiers, gated posts, what a member
sees before and after paying. That is the piece this product does not have.

Register at **102** repositories, 11 reciprocal, 6 declaring no licence.
`verify:launch` green, 1908 tests passing.

### 2026-08-18 — the rule broke on its first test, which is the useful part

Sixth sweep pass, run licence-first — `license:mit` in the query before any
assessment of fit, which is what the previous pass concluded to do. The method
works. It also broke the rule that motivated it, in one category.

**Digital signage** yields three MIT results above 200 stars and nothing worth
registering: a Flutter embedder, an Android kiosk lockdown app, a 363-star
signage CMS. Hardware-adjacent enough that signage would be a new product rather
than an improvement to an existing one.

**Whiteboard and drawing** yields `excalidraw/excalidraw` at **129,927 stars**,
verified **MIT** — and Excalidraw has a hosted commercial product at
excalidraw.com behind it, exactly like twenty, Carbon and Hi.Events. The rule was
stated after three data points and contradicted by the fourth, which is about
what three data points are worth. It stays in the sweep document as a good thing
to *search* by and not as something to conclude from. Recording that explicitly
matters more than the rule did: a generalisation that survives in a document
because nobody went back to check it reads exactly like one that held.

Same result set, same old lesson: `poteto/hiring-without-whiteboards` at 51,379
stars is a **list of companies**, not software.

**The bottleneck has moved, and that is the finding of the day.** Excalidraw is
the first candidate in the whole sweep whose licence, size, maturity and product
fit all pass. What stops it is that it is a React package and this application is
server-rendered Express with **no build step** and `script-src 'self'`. Using it
means vendoring a prebuilt bundle served from this origin — permitted by the CSP
— and owning its size and updates permanently. A supply-chain decision for the
owner, and explicitly not a licence problem, so the record does not describe it
as one.

Counting this pass with the speech-recognition pass: of the four repositories
added whose licences are fully settled and permissive — whisper.cpp, whisperX,
vosk, Excalidraw — **all four are blocked by this runtime rather than by their
terms**. Licence was the binding constraint when this sweep started. It is not
any more.

Register at **101** repositories, 11 reciprocal, 6 declaring no licence.
`verify:launch` green, 1908 tests passing.

### 2026-08-18 — three for three, and a rule worth more than the repositories

Fifth sweep pass: events, RSVP and ticketing. `topic:event-management` turns out
to be mostly **software event dispatchers** — fourth topic-name trap, after
`topic:pos`, `topic:scheduling` and `topic:paywall`. Four of eight results above
300 stars are event buses and listener libraries, `saltstack/salt` among them.

One real hit, `HiEventsDev/Hi.Events` (3,981 stars, Eventbrite alternative), and
its detected licence is **NOASSERTION** — the third in a row.

**That is now the most useful thing this whole sweep produced.** Three
categories, three leaders, three licences GitHub cannot classify: twenty (CRM,
55,066 stars, twenty.com behind it), Carbon (manufacturing, carbon.ms),
Hi.Events (ticketing, hi.events). Written up as a rule rather than three
anecdotes:

> A project positioned as "the open-source alternative to X", with a hosted
> commercial product behind it, has usually written a licence specifically
> against being resold as a hosted service. That is what this product is.

Three consequences, all of which change how the next sweep should be run.
**Star count and category leadership predict licence trouble, not licence
safety** — the more polished the alternative-to-X project, the more likely a
company is protecting it. **Read the licence first**, because screening by stack
or stars and checking the licence afterwards means doing the fit analysis on
exactly the repositories least likely to be usable. And **NOASSERTION is not
"unknown, probably fine"** — it means GitHub read a real licence file and could
not match it to anything standard, which is what a lawyer-written custom licence
looks like from outside.

None of the three is blocked, and all three are worth reading for their domain
models, which needs no licence resolved. What none of them is, on current
evidence, is something to take code from.

Register at **100** repositories, 11 reciprocal, 6 declaring no licence.
`verify:launch` green, 1908 tests passing.

### 2026-08-18 — the closest fit keeps having the worst licence

Fourth sweep pass: manufacturing and industrial. 13 repositories above 300 stars
pushed in the last year, splitting cleanly in two.

**Most of the category is MQTT and protocol plumbing** — emqx (16,630), vernemq,
nanomq, node-opcua, neuron. Brokers for talking to PLCs and sensors. Correctly
tagged and irrelevant: Business Builder helps somebody run a business, not read a
Siemens S7. The ERP half is dominated by the GPL family (ERPNext at 38,211,
metasfresh), which reaches a hosted product.

**`crbnos/carbon` is the second closest-fit-worst-licence in this sweep.** ERP,
MES and QMS on **Supabase, PostgreSQL, TypeScript and React Router** — this
product's exact stack — and its detected licence is **NOASSERTION**. So is
`twentyhq/twenty`, the closest fit in the CRM category, also Supabase and
TypeScript, also with a hosted commercial product behind it.

That is not a coincidence and it is now written down where the next sweep will
find it: **a project with a company behind it writes a licence protecting it
from being resold as a hosted service, which is exactly the use this product
would make of it.** Searching by stack and then checking the licence walks into
that every time. Reading the licence first and letting the stack decide between
what is left is the cheaper order.

**And the doc-count guard fired on a true sentence.** Writing that finding up
produced "13 repositories above 300 stars pushed in the last year", which the
register-count pattern read as a claim about our register and failed the release
over. Rewording the prose would have been the wrong fix — a check that fires on
true statements does not get fixed, it gets written around, and then it is
training people to avoid it rather than measuring anything. The pattern now
requires "**reviewed** repositories".

Narrowing a pattern is a quiet weakening on its own, so it comes with the thing
that stops it being one: the check now **refuses to pass if that pattern matches
nothing at all**. Three cases were run before trusting it — the register count
wrong (caught), the claim reworded out of the document entirely (caught by the
new guard), and the true sentence about search results (correctly ignored).

Register at **99** repositories, 11 reciprocal, 6 declaring no licence.
`verify:launch` green, 1908 tests passing.

### 2026-08-18 — the search term that would have got it backwards

Third sweep pass: paywall, creator economy, speech recognition.

**`topic:paywall` is paywall *bypassing*.** Third topic-name trap after
`topic:pos` (postcss, postgrest, oh-my-posh) and `topic:scheduling` (cron, not
appointments), and the first one where following the results would have been
actively harmful rather than merely wasteful. Five repositories carry the topic
above 200 stars; **four exist to defeat paywalls** — `everywall/ladder` at 8,819
stars leads the category. Creator Studio's job is to help creators put work
*behind* a paywall and get paid. A sweep that ranked by stars and skipped the
reading would have reported the most popular anti-paywall tool on GitHub as the
category leader for a product that sells paywalls. Nothing registered, and
licence had nothing to do with it.

**`topic:creator-economy` is thin and yields nothing.** Four repositories above
50 stars in the last year: a curriculum, a Google-Drive-plus-crypto video
platform, a 100-star project with 161 open issues, and a cookbook for a keyed
hosted API that also "finds verified emails" — a price rather than a licence, and
a lead-scraping capability that meets this product's consent rules head-on. The
empty result is recorded deliberately: research that only reports hits cannot be
distinguished from research that found nothing and said nothing.

**Speech recognition was a real gap.** 33 projects above 3,000 stars pushed in
the last year, and the register held **nothing at all** under it across 95
records — while captions and transcripts are squarely Creator Studio's job and
the owner named speech recognition explicitly. Three added, each licence verified
by the detected-licence method: **whisper.cpp** MIT (52,977 stars),
**whisperX** BSD-2-Clause (23,617), **vosk-api** Apache-2.0 (15,064).

**Licence is not what constrains any of the three, and the records say so.** This
is Express on Vercel serverless with no build step. A C++ binary with
multi-gigabyte weights, a Python GPU pipeline and native bindings are none of
them things a serverless function loads. All three sit at
`optional_adapter_after_review` because adopting them means the owner runs a
service reached under the four rules in `docs/architecture/EXTERNAL-SERVICES.md`
— infrastructure and cost, not licensing. Two further things the licence does not
cover, written into the records rather than left to be found: WhisperX's
permissive licence does not reach the alignment and diarization models it
downloads at runtime, which are the pieces doing the work; and diarization
attributes speech to a named person, which under this product's provenance and
consent rules is a draft for a human to confirm, never a published label.

Register at **98** repositories, 11 reciprocal, 6 declaring no licence.
`verify:launch` green, 1908 tests passing.

### 2026-08-18 — the repository had been renamed, and six licences were guesses

Having just written that a search filter is not a licence, the obvious next
question was whether anything *could* verify one from here. Something can, and it
changed six records.

**`search_repositories` with `minimal_output: false` returns GitHub's detected
licence.** The full repository object carries `license.spdx_id` — what GitHub
read out of the root `LICENSE` file — as distinct from the licence *filter*,
which only says which bucket a repository sorted into. Every record resting on a
family was re-read, and **none of the six was as recorded**: wacrm **MIT**
(back into the adoption path), vercel-labs/skills **MIT**, GPT-SoVITS **MIT** on
the code, ury **AGPL-3.0**, brightbean-studio **AGPL-3.0** confirmed rather than
inferred from its topic list, and twenty **NOASSERTION** — GitHub read its
licence file and could not match it to any known licence, which is a far better
answer than "appeared in neither filter" and means the same thing.

**Foodya-Restaurant settled the other way.** Its repository object has **no
`license` key at all**, which is what GitHub returns when it finds no licence
file: an established absence, not an unread field. The record moved
`needs_license_review` → `blocked`. Repositories declaring no licence went 5 →
6, and `verify-doc-counts` — added hours earlier — caught the stale figure in
`docs/owner/WHAT-IS-LEFT.md` before it could ship. That is the check earning its
place on its first live change.

**Cal.com was not refused. It was renamed.** Yesterday's note recorded that
`repo:calcom/cal.com` returned 422 and concluded the session lacked permission.
The repository is now **`calcom/cal.diy`** — same repository id `350360184`, same
2021 creation date, 47,768 stars. The 422 was accurate; the inference was not.
GitHub's message says *"the resource does not exist **or** you do not have
permission"*, and it was read as the second clause because that was the clause
already suspected. **A refusal that names two causes is not evidence for
whichever one you came in believing.** It is now record 95, at
`needs_license_review` despite a clean MIT at the root — because GitHub detects
the *root* licence and this is a monorepo, and projects in this category
routinely keep an enterprise directory under separate commercial terms. The root
is established; the packages are not, and taking code from one means reading that
one.

Method note for whoever sweeps next: `repo:` returns 422 for any repository name
containing a dot. Use `org:` plus a filter for those.

Register at **95** repositories, 11 reciprocal, 6 declaring no licence.
`verify:launch` green, 1908 tests passing.

### 2026-08-18 — a bucket is not a grant, and half an adoption path

Three CRM and social-scheduling repositories went onto the register from a
second GitHub sweep, and closing the counts behind them turned up two checks
measuring less than they claimed.

**A search filter is not a licence.** `wacrm` was recorded as permissive because
GitHub's licence *filter* sorted it into the permissive bucket, and it shipped
at `optional_adapter_after_review` on that basis.
`tests/open-source-licence-terms.test.js` rejected it, correctly: a filter
reports which bucket a repository fell into, not what its author granted.
Reading the file itself was refused — `api.github.com/repos/ArnasDon/wacrm/license`
answers **403** to a session scoped to this repository only — so the record now
says the licence is **not established** and sits at `needs_license_review`. The
same 403 is why Cal.com's licence is still recorded as unverified rather than
recalled.

**The adoption-path check covered half the adoption path.** Its name says
"everything in the adoption path"; its status set held
`optional_adapter_after_review` alone. `adapter_built` — the status meaning code
from that repository *is already here and something calls it*, the stronger
commitment of the two — was outside the population it claimed to measure. The
covered set went **13 → 19**. Two named-but-not-SPDX licences (Dify, Open WebUI)
are allowlisted explicitly rather than admitted by loosening the pattern.

**The reciprocal-licence count is derived now, and could not be derived the
obvious way.** `docs/owner/WHAT-IS-LEFT.md` quotes it at somebody deciding what
may legally be adopted, and it had drifted **10 → 11** with nothing watching.
Searching the licence prose for `AGPL` reports **12**: one record's licence text
reads *"it appeared in neither the permissive filter (MIT, Apache-2.0,
BSD-3-Clause) nor the reciprocal filter (AGPL-3.0, GPL-3.0, ...)"* — four
reciprocal licences named in the course of saying the repository is in none of
them. So the register states the fact instead, in a **required** `reciprocalLicense`
field: a missing flag is a type error, and `verify-doc-counts` refuses to run
the count unless all 94 records answer. Optional would have let somebody add an
AGPL repository, omit the flag, and leave the figure sitting where it was.

**Each of the three new checks was run against bad input before being trusted.**
Wrong number in prose, a dropped flag, an AGPL record flagged false, and a vague
licence promoted to `adapter_built` — all four fail. The first pattern written
for the prose claim matched *nothing*, because the document wraps "carry a /
reciprocal licence" across a line break and the pattern had a literal space in
it; it reported green while checking zero claims. Countable claims went 7 → 8
only after that was fixed, which is how it was caught.

Register at **94** repositories, 11 reciprocal, 5 declaring no licence.
`verify:launch` green, 1908 tests passing.

### 2026-08-18 — the open end closed, and the pin that was loose by more than double

Yesterday's entry recorded thirteen routes the outage crawl could not render,
unexamined, with the count pinned "so the set cannot grow unnoticed". Examining
them found something about the pin itself first.

**There were six, not thirteen.** The 13 came from a run before the alias rule
took effect and was never re-measured. A pin set at more than double the real
figure would have sat green through **seven** new failures — which is the same
defect as the bare `continue` it replaced, only quieter, because a number that
looks deliberate invites less suspicion than an obvious gap.

**Examining the six closed all of them.**

- `/business-builder/dashboard` and `/business-builder/control-center` answer
  **503 and render a real page** — *"Business Builder is temporarily
  unavailable"*. The crawl skipped every non-200, which meant **it had never
  inspected the pages written for the state it exists to test**. Those are the
  pages most likely to make a claim about a customer's records, because they are
  the ones with something to explain. 503 bodies are read now, when a body came
  back; a 302 has nothing to read and a 500 is a different check's problem.
- `/creator-studio/billing` and `/growth-studio/billing` redirect to `/billing`,
  which redirects again to `/business-builder/billing`, which the crawl renders.
  **A two-hop chain against a one-hop rule.** The rule follows the chain now,
  with a `seen` set, because a redirect loop would otherwise hang the check that
  exists to stop things going unnoticed.
- `/business-builder/businesses` is a 302 to `/control-center`, resolved by the
  same two fixes together.
- `/auth/callback` answers *"OAuth deferred"* to a request carrying no OAuth
  code, which is correct.

**The pin is now zero**, asserted as `deepEqual(unreachable, [])`. Every route is
either rendered or lands on a page that was. Proved rather than assumed: adding
one unrenderable route to the registry fails the run, and removing it passes.

Worth keeping the shape of this. The finding was not in the six routes — five of
the six were behaving correctly all along. The finding was that **the number
guarding them was wrong, and wrong in the permissive direction**, which is the
only direction that stays quiet.

### 2026-08-18 — a GitHub category sweep, and the search that returned postcss

Two categories swept properly out of roughly forty asked for. Method and findings
in `docs/market/2026-08-18-GITHUB-CATEGORY-SWEEP.md`; three records added.

**The failed search is the useful half of the method.** The first attempt used
free text — `restaurant OR point-of-sale OR pos in:name,description` — and
returned **postcss, postgrest, oh-my-posh, postal, node-postgres and
postgres-operator**. Substring matching on "pos". Zero of eight results were
relevant and the call cost about thirty thousand tokens. `topic:` filters find
the category; free text finds the spelling. Written down so the next person does
not spend the same thirty thousand tokens discovering it.

**Finding one: the POS category is mostly closed to us, on licensing.** Of
eighteen point-of-sale projects above 200 stars pushed in the last year, **eight
are reciprocal and every large one is** — erpnext at 38.2k, frappe/books, NexoPOS,
lakasir, OCA/pos, viewtouch. That includes **ury**, the only purpose-built
restaurant system in the set and otherwise the obvious candidate. A reciprocal
licence triggers on network use, and this is a hosted product.

The route that stays open is not adoption but an **owner-operated deployment
reached through an adapter**, where the obligation sits with that deployment
rather than with this codebase — the arrangement `EXTERNAL-SERVICES.md` already
describes. Five of the eighteen are permissive, and none of those five is a
restaurant system.

**Finding two: four of the five headline speech projects are voice cloning.**
GPT-SoVITS (61k, clones from one minute of audio), VoxCPM, CosyVoice and dia are
all permissively licensed and all pushed recently — and `AGENTS.md` says *enforce
provenance, consent, and anti-clone safety*. They are recorded as **one** record
rather than four, because they pose one question. None is unusable; all are
unusable *as a general feature*. Cloning a voice whose owner has recorded
permission is the legitimate case and the only one, and the difference is a
`creator_voice_consents` row, not a disclaimer.

**The one worth pursuing is the one that runs offline.** `sherpa-onnx` —
Apache-2.0, 14.2k stars — does speech-to-text, text-to-speech, diarization and
VAD with **no network call at all**. That is the same commercial argument that
made the calculator tools worth building: no per-customer cost, and no customer
audio leaving the machine. It is also the only headline speech project in the
shortlist not built around cloning.

**What these three records claim, stated precisely.** Licence and fit, from the
GitHub API licence field and the project's own description. **Not a source read.**
The other 88 records were read before they were written, and writing three that
quietly implied the same standard would be the defect this register exists to
prevent. Each says so in its own licence field.

**And what was not done.** The request named around forty categories and asked
for "all repositories at github.com". GitHub holds hundreds of millions; there is
no completion state for that, and a register claiming to have swept it would be
this codebase's recurring defect at the largest scale yet attempted. Two
categories cost six searches and an afternoon of judgement. Forty is a programme,
best done in the order the product actually needs them.

### 2026-08-18 — a storyboard that adds up, and a guide that cannot be copied

**The IONOS guide cannot go into the product, and the reason is on its cover.**
Submitted as a PDF to add to the application: *"Smarter business with AI — the
ultimate prompting guide for entrepreneurs"*, fourteen pages, and the cover reads
**COPYRIGHT © 2025 IONOS INC.** It grants nothing. A free download is a price of
zero, not a licence, and copying its text in would be the failure this register
exists to prevent with prose instead of code.

Two things can be taken from it legitimately, and both were. The **intelligence**:
a hosting competitor is spending marketing budget teaching small businesses to
prompt, which says where that market believes the value is. And the **techniques**
— role prompting, style targeting, prompt chaining, few-shot, progressive
layering — which are industry-standard, predate the document by years and belong
to nobody. What is theirs is the wording, and none of it has been used. Registered
as blocked with that reasoning attached.

**The Creator Studio tool, built rather than offered.** The storyboard prompt
circulating online produces a handsome document whose shot durations do not sum
to the runtime. That is not cosmetic: a creator books a shoot, a voice artist and
an edit against those numbers and finds out on the timeline that the shot list
was thirty seconds long for a fifteen-second slot.

So the arithmetic is the product. `allocateSeconds` uses **largest-remainder**
rather than rounding each shot independently — eight shots rounded separately
lose or gain up to four seconds against the runtime, which is exactly the defect.
The test checks the property across nine awkward runtimes and three shot counts,
including 7 seconds over 8 shots, where independent rounding falls apart.

**What is ours and what is film grammar.** The shape — hook, subject, tension,
demonstration, message, payoff, climax, ending — is in every screenwriting text
for fifty years and is nobody's property. Ours is the **weighting**: the hook and
the ending get more than an even split, because those two shots decide whether
the middle is watched at all. That is asserted rather than asserted-to: the test
compares both against `total / count`.

It also refuses. No runtime, no shot list — a plan built on a guessed runtime is
worse than none. No idea, no subject invented. And a runtime that leaves shots
under two seconds gets told so, without the warning costing the sum.

**Not done, and said plainly rather than left to look done.** The request also
asked to improve all products, to research breakthrough technology worldwide, and
to review "all GitHub repositories at github.com that pertains to our
application". The register holds 88 records, each one read before it was written;
GitHub holds hundreds of millions. There is no version of that last item that
finishes, and a sweep that pretends to would be this codebase's own recurring
defect at the largest scale it has yet been attempted. The forty-two catalog
products can be improved one at a time against stated criteria, which is a real
piece of work with a real shape, and it is the next thing worth doing.

### 2026-08-18 — nine more products, this time from what the market complains about

The first nine were built from what a small business obviously needs. These nine
were built from dated survey figures, and each one is only defensible while its
number holds. Sources in `docs/market/2026-08-18-PRODUCT-GAP-RESEARCH.md`, with a
February 2027 review date on them.

**The three numbers that drove the design.**

- **67% of creators had a contract or payment dispute in the past year** (HubSpot
  2025), and the average creator earns **$44,293** (CreatorIQ 2026). That is a
  market with a paperwork problem and no budget for a lawyer. The crowded answer
  is contract *generators*; the gap is the moment before a contract exists.
- **83% of small businesses call referrals their best acquisition source, up from
  65%; 87% at ten staff or fewer** (LocaliQ 2026). The channel most businesses
  rate first is the one almost no software measures, because a referral has no
  click to attribute.
- **52% of buyers switch business software over inefficiency, not price**, and
  the feature they need is *"buried, missing, or on the enterprise tier at three
  times the budget"*. Competing on breadth competes where the complaint is, so
  three of these are deliberately narrow.

**Business Builder** — Price Rise Planner (pricing tools compute a price; none
answer *how many customers can I afford to lose*); Software Spend Auditor (the
category's own products add to the stack, this one measures it); Quiet Month Cash
Plan (forecasts project a trend, this names the month you run out).

**Creator Studio** — Deal Memo Recorder; Late Payment Escalation (invoicing tools
resend, this prices the delay); Usage Rights Expiry (no mainstream creator tool
tracks a licence *end* date, and the failure is silent — the brand keeps using
the work and nobody is doing anything wrong on purpose).

**Growth Studio** — Referral Source Tracker; Review Recency Score (review tools
optimise the average while the survey says **recency** is what moved); Enquiry
Response Clock.

**Profitability, stated rather than assumed.** All nine are deterministic: no
model call, no provider, no network, **no per-customer cost**. A tool with a
per-use cost cannot sit on a free tier and act as the reason somebody signs up,
which is the whole commercial argument for building them this way.

**Where the tools refuse to answer.** A price rise on a price already below cost
returns no "customers you can afford to lose" figure at all, because there is
not one — it says the rise is not the first move. Late payment accrues no
interest before the due date. The response-time tool states its rule in the
output and says plainly *"not a measurement of your business"*, because it is one
explicit assumption applied to the customer's own numbers, and dressing that as
data would be the most saleable thing on the page and the least honest.

**Three of my own test expectations were wrong**, and running them is what found
it: a cash plan whose figures never actually went negative while the test
asserted a month it ran out; a licence expiry asserted as December when 12 × 30.44
days lands in January; and a response-time gap asserted at double its real value.
The code was right in all three. The corrections are in the test with the
arithmetic spelled out, because the next person will otherwise redo the same
sums.

**Also registered: `vercel-labs/skills`** (`find-skills`), as
`needs_license_review` — its licence has not been read, and that is stated rather
than assumed from a social post. The reason it is not simply low-risk developer
tooling: its output is *an install command for somebody else's skill*, so the
thing under review is not one repository but a channel for arbitrary ones, and
`npx` fetches and executes on the spot. Recorded with the boundary that nothing
it recommends is installed without its own register entry.

**And `watermarks-remover` arrived again, and stays blocked.** The screenshot
adds detail that confirms the original review rather than changing it: 5k stars,
v0.4.0, and a table naming C2PA, EXIF and XMP across PNG, JPEG, PDF, DOCX, HTML
and Markdown. Popularity is not a licence argument and was never the objection.

### 2026-08-18 — the outage crawl had never once opened the admin area

`tests/no-page-lies-when-the-database-is-down.test.js` opens with the sentence
*"Every page, rendered with every data read failing."* It was not every page. It
was 211 of 260.

**The `continue` that hid it.** The crawl skipped any route that did not answer
200, with a bare `continue` and no record. Measured: **49 routes skipped**, 46 of
them redirects to a login the customer session cannot pass, and almost all of
those the admin area. So the file whose whole job is catching a page that tells
somebody they have no records had never rendered `/admin`, `/admin/database`,
`/admin/users` or `/admin/system` — the pages an **owner** opens during an
outage, which is where that false claim does the most damage, because the owner
is the person deciding whether anything has actually been lost.

The guard beside it, `rendered >= 150`, says how much was looked at and says
nothing about what was missed. That is the shape worth remembering: a population
check that cannot shrink-detect is not a population check.

**Two passes now**, customer and owner, over the same routes. The stub answers
`user_roles` with `owner` and `ADMIN_EMAILS` is set alongside the Supabase
stubs, so the admin gate resolves.

**What the owner pass found on its first run: nothing false.** Three findings,
all the same sentence, all the database console's own caveat card — *"Nothing
here says your database is empty."* That card exists to stop an owner concluding
exactly the thing this check hunts for, so it is the opposite of a lie, flagged
only because the pattern matches the words "Nothing here" anywhere. It went into
`NOT_A_CLAIM_ABOUT_RECORDS` with that reason, which is what the excuse list is
for. Reporting it as a defect found would have been the easy write-up and the
wrong one.

**Accounting, rather than a bare skip.** A route now counts as unreachable only
when *both* sessions were refused — neither cookie reaches everything, the owner
being redirected away from `/billing` and `/account/*` just as the customer is
from `/admin/*`. Aliases are covered too: `/business-builder/tutorial` is a 302
to `/tutorials/business-builder` and `/business-builder/pricing` a 302 to
`/pricing`, both of which the crawl renders, so a redirect whose destination was
rendered is not a gap.

**Thirteen routes are left, and that is stated rather than dressed up.** They
sit behind a session this crawl does not establish, and they have not been
examined one by one. The count is pinned so the set cannot grow without somebody
being told — which is strictly better than the `continue` that dropped
forty-nine in silence, and honestly worse than examining them. Next person: that
is the open end of this.

### 2026-08-18 — nine new products, three for each product line

Built on what is already here rather than on anything new: the free-tool runtime,
the module-output save path, the records pages, the catalog, and the outage crawl
written this morning — which covered all nine the moment they were registered,
without a line added to it.

**Why calculators and not generators.** The fifteen tools that came before are
mostly outline and script builders: words in, better-organised words out. What a
small business is actually stuck on is arithmetic it does not trust itself to do
— what price covers the cost, how long the cash lasts, whether a referral reward
is affordable, whether the splits add to a hundred. Those have one right answer
and an expensive wrong one.

So all nine are deterministic. No model call, no provider, no network, **no
per-customer cost**, same inputs to same output. `docs/SHIP_READINESS.md` records
eleven catalog products removed for describing work that did not exist, and the
cheapest way not to repeat that is to ship things that compute.

**Business Builder** — Break-Even and Runway; Shift Rota Cost Planner; Deposit and
Payment Schedule.
**Creator Studio** — Rate Card Builder; Split Sheet and Credits; Repurposing
Planner.
**Growth Studio** — Campaign Budget Split; Referral Reward Planner; Follow-Up
Schedule.

**Two rules run through all of them.** A number that cannot be read is *named*,
never turned into `NaN` — `numberFrom` returns null and every tool checks before
doing arithmetic, so the customer is told which box was unreadable rather than
shown `$NaN`. And a case with no answer says so rather than returning zero: a
business losing money on every sale has **no** break-even, and "0 sales needed"
would be the most dangerous possible rounding of that. A rota with no expected
sales reports that the labour share cannot be worked out and *"is not zero"*.

**Guards caught three things on the way in**, each a real integration the work
would otherwise have half-done:

- `verify-route-registry` refused nine routes that existed but were not
  canonically registered.
- The catalog seed migration `20260725180000` is applied and **frozen**, so the
  new products could not be added to it. They are seeded by a new migration
  instead, and the test that checked "one migration seeds every product" now asks
  whether each product is seeded *anywhere* — which is the actual guarantee. It
  also refuses to count the generated sync migration, because that one only
  updates: a product listed there and nowhere else would be retired-proof and
  never created.
- `verify-doc-counts` caught a migration count that moved 83 → 84.

**One assumption checked rather than acted on.** The existing tools use
`parsePositiveNumber`, which returns null, and null in arithmetic gives `NaN` —
so I expected `$NaN` on the pricing tool for prose input and went to fix it.
Submitted it: zero occurrences. The existing path already handles it. Nothing was
changed on the strength of a defect I had reasoned my way to rather than seen.

### 2026-08-18 — a malformed role read could take out every admin page

Ten focused minutes on the sweep, and the one thing found is the worst-placed
instance of the day.

**`getUserRoles` iterated whatever came back.** It read `user_roles` and ran
`for (const row of rows)` on the parsed body. PostgREST answers **200 with an
object** in some failure modes — an error body rather than a row list — and
`for...of` on an object throws. This is the admin authorization path; every admin
page calls it. Before the route safety net landed earlier in this branch that
throw hung the request forever, and after it the same throw is a **500 on every
admin page at once**, from a database that is answering.

Verified by removing the guard and watching `TypeError: rows is not iterable` at
`getUserRoles` on `/admin`, rather than by reading the code and reasoning about
it.

The fix fails closed, which is the only acceptable direction here: an unreadable
role list grants nothing. `row?.role` rather than `row.role` for the same reason —
a ragged array denies instead of throwing, and a valid row after a bad one is
still honoured.

**Two smaller cause-claims corrected while there.** The dashboard said *"Setup
required: the service_requests table is not available yet"* and the same for
deliverables, whenever `safeListTable` returned not-ok. A 500 is not a missing
table, and that sentence sends an owner to run a migration that is already
applied. Both now say the figure could not be read.

**Two sibling reads were already guarded** — storage buckets and the agent
activity queue both do `Array.isArray(rows) ? rows : []`. `getUserRoles` was the
outlier, which is the useful shape of the finding: the pattern was known here and
the one place it was missing is the one that gates administration.

### 2026-08-18 — a crawl for the pages nobody crawled, and the branch it proved unreachable

Six instances of this pattern were found by hand today. The seventh was found by
a check, which is the point: the last two lived on **pages a customer only sees
after pressing a button**, and every sweep in this repository issues GETs.

**Placeholder leakage, everywhere.**
`tests/no-page-lies-when-the-database-is-down.test.js` already renders 150+ pages
with every read failing. It now also fails on `null`, `undefined`, `NaN` and
`[object Object]` in visible text — the four things a JavaScript template
produces when the value behind it is missing, and none of them a word this
product's copy would use. It found nothing on the GET pages, which is why it was
proved rather than trusted: injecting `Reference ID: null.` into one real card
fails the run, and removing it passes.

**Its self-check caught a trap on the way in.** A `/g` regex carries `lastIndex`
between calls, so the recognition test matched its first sentence, resumed from
that offset for the second, and reported that the pattern had stopped working.
The file already had this shape for its other pattern — `CLAIMS_EMPTY` and
`CLAIMS_EMPTY_ALL` — and the new one now follows it. **The check written to prove
the check works is what caught it.**

**And the pages that were never crawled at all.**
`tests/every-tool-result-page-survives-an-outage.test.js` posts to all **fifteen**
free tools with the session resolved, the workspace found, and every write
refused — the state a real customer is in during an outage, and the state where a
result page has most to get wrong: the tool worked, so there is an answer to
show, and the save did not, so there is bad news beside it. `TOOLS` is exposed
through `app.locals.sonaraFreeTools`, following the same pattern
`sonaraDatabaseManagementPage` already uses.

**The generated submission was wrong first, and the fix was to stop guessing.**
The first draft chose values by field name — numbers for `/cost|price|rate|…/`,
prose otherwise — and got `visitors`, `leads` and `customers` wrong, so the KPI
calculator correctly refused with a 400 and this file reported its own bad input
as a missing page. Every field now gets `"12"`, which the calculators parse and
the text tools accept. A per-name heuristic is a thing that drifts silently the
moment somebody adds the sixteenth tool.

**Then the crawl found what hand-testing had missed.** Re-injecting yesterday's
`Reference ID: null` defect did **not** fail the run — because the branch it
lives in was unreachable. `saveModuleOutput` returned `code: "setup_required"`
for *every* unsaved outcome, including this one: past a resolved workspace, past
a working config, with only the writes failing. So `sendToolResult` always took
its setup branch, and the "this is on our side" wording added yesterday had never
once rendered. The code is `save_failed` now, the branch is reachable, and the
crawl bites on the defect it was written for.

That is the part worth remembering. Yesterday's fix was verified by a test that
asserted the *new* wording appears — and it did, on the one path that test drove.
It never asked whether the other path could happen at all.

### 2026-08-17 — "Reference ID: null", which I put there

Sixth instance, and the first one this session's own work created. Worth the
entry for that reason rather than its size.

**What happened.** Two commits earlier, `saveModuleOutput` stopped minting a
`randomUUID()` reference for work it had not saved and returned `null` instead.
That was right. `sendToolResult` printed the value through `String(...)`
unconditionally, so every unsaved free-tool result rendered:

> Save requires account database setup. Your output was generated and is shown
> above. … **Reference ID: null.**

A fix that swapped a misleading number for the literal word "null" on a
customer's screen. Nothing objected, because **no test rendered that page** — the
existing coverage asserted the JSON body, and the two page-level assertions in
`saas-platform-upgrade` were checking for the presence of the string "Reference
ID", which `null` satisfies.

**The test I wrote to catch it was itself wrong first**, and that is the more
useful half. Its first draft asked for `text/html` while calling `.send(object)`,
which sets `Content-Type: application/json` — and this application answers JSON
to that regardless of `Accept`. So two assertions about page content passed
against a body with no page in it. They went green immediately, which is the only
reason I looked: a check that passes the moment you write it has not been shown
to work. The HTML case posts a form now, the way a browser does.

**Two more things wrong on the same card.** *"Save requires account database
setup"* states a cause, and it is false whenever the workspace is finished and
the write failed underneath it — `workspace_unreadable` and `records_unavailable`
both arrive here, and both sent the customer to a setup page with nothing on it
to do. There are two messages now, and which one shows depends on the code rather
than on the assumption. And a JSON caller got **200 with `ok: true`** for a write
that stored nothing, while `POST /service-requests` and `sendWorkspacePostResult`
both answer 503 with `ok: false` for the same failure — one product, one kind of
failure, two answers. Now 503 either way.

**The output still renders in every case**, asserted first, because a free tool
that loses the answer it just worked out to a save failure would be a worse
product than the one with the bad label.

### 2026-08-17 — the queue that was not there

Fifth instance, and the first one that is not a read collapsing. This is a
**mechanism described to the customer that was never built**, with a passing test
asserting it.

**The sentence.** A support request whose insert failed ended at:

> "Setup required: the account database is not configured, so the request used
> the safe fallback queue. Reference ID: `<uuid>`."

There is no fallback queue. Searched for: no table, no file, no in-memory store,
nothing scheduled. The phrase was in five strings — the support result, two
dashboard cards, an admin card and a service-lifecycle page — and every one of
them described something that does not exist.

**What actually happened on that path.** The insert had failed *and* the
notification email had failed, so nothing was stored and nothing was sent. The
customer got `ok: true`, HTTP 200, a reference number, and the word "queue". They
would reasonably stop chasing it. **A support request that silently disappears is
worse than a form that refuses to submit, because the second one gets retried** —
and this was the one page somebody reaches when something has already gone wrong.

**A test asserted the fabrication**, by name: *"POST /support/request uses the
safe fallback queue with a reference ID when database is missing"*. It cleared
the Supabase environment and checked for `ok: true` and a reference ID. The
guarantee had a green tick and no implementation, which is this codebase's stated
recurring defect in its purest form.

**The reference number is the part that does the damage.** It is minted before
the insert and written into the row as `reference_id`, so when the row is stored
it genuinely identifies it — and when the row is not stored but the email went
out, it is in the email body, so support can still find it. Both real, in
different places, and the message now says which. When neither happened it
identifies nothing anywhere, and handing it over is the artefact that makes
somebody believe they have a case open. That case now returns **no reference at
all**, `ok: false`, and 503 — so a caller reading only the status code cannot
record a vanished request as a filed one.

`lib/sonara-support-outcome.cjs` holds the four-way decision. Its test asserts
the two success endings *first*, because every "did not go through" assertion
would otherwise pass against a form that refuses everything.

**Three more invented references, swept in the same pass.** `POST
/service-requests` minted one with `randomUUID()` on two failure branches and, on
the success branch, fell back to `randomUUID()` when the insert worked but the
representation did not come back — the hardest of the three to notice, because
everything else about the request was fine. `saveModuleOutput` did the same in
two places, and `sendWorkspacePostResult` printed the result on a page that had
already, correctly, said the work could not be saved. All now null, and the
unsaved page prints no reference.

**Lint proved the sweep was complete** in one file: removing the last
`randomUUID()` call left the import unused and the build said so. That is a
better completeness check than my own reading of the file.

Four tests changed. Each asserted the old behaviour, and each was read before
being touched — one of them, *"still accepts a valid request"*, is a real guard
against fixing a failure path by breaking a success path, so it kept its job and
lost only its acceptance of the word "queued".

### 2026-08-17 — Awesome DeepSeek Agent reviewed; the answer is that nothing needs adding

Added to the register on request. **Blocked**, and the more useful half of the
finding is that the request it came with was already satisfied.

**No licence, checked three ways** rather than assumed: the repository page shows
no LICENSE file, the repository API returns no licence field, and
`/repos/deepseek-ai/awesome-deepseek-agent/license` answers 404, which is what
GitHub returns when it detects none. No licence is not permissive by default. It
is all rights reserved, and nobody here can grant what the author has not.

**Two claims in the pitch did not survive reading the repository.** It described
twenty applications; the contents table lists 24. And the one-million-token
context window is stated there for one tool's DeepSeek-TUI entry, not as a
property of a model — worth being exact about, because that is precisely the kind
of figure that gets repeated into marketing copy and then has to be defended.
`DeepSeek-V4-Pro` and `DeepSeek-V4-Flash` are referenced by name in the
repository; their pricing, terms and availability were **not** verified here, and
cost is a constraint of the same weight as licence.

**There is nothing to install.** It is documentation — 24 setup guides, no
runnable code, no installer, no agent skill.

**And DeepSeek already works without a line of code changing here.**
`lib/sonara-open-webui-adapter.cjs` sends `model: readiness.model`, read from
`SONARA_OPEN_WEBUI_MODEL`. The model is a configuration value, not a code path,
so a DeepSeek model served behind the owner's own Open WebUI or gateway is
reachable today. That is the arrangement `docs/architecture/EXTERNAL-SERVICES.md`
describes, and the reason the register has carried DeepSeek V3 as an optional
gateway model family rather than as a dependency since before this.

**A second stale number fell out of it.** The doc-count guard rejected the
release for `docs/owner/WHAT-IS-LEFT.md` saying "85 reviewed repositories", which
is what it is for. Counting the rest of that sentence by hand found the next
clause wrong too: it said **2** repositories declare no licence, and the register
held **4** before today. That figure was never checked, because
`verify-doc-counts.mjs` deliberately leaves licence questions to a human — and
rightly, for the interpretive ones. Whether a reciprocal licence reaches a hosted
product is a judgement. How many records say no licence was declared is not; it
is a fact about the register, and it is now derived and compared like the other
counts. Verified by putting the wrong figure back and watching it fail before
trusting the green. The sentence now reads 86 and 5.

**One correction worth recording, because a guard made it.** The record was first
filed as `reference_only`, reasoning that reading a public page needs no licence.
That reasoning is true and it is not what this register governs.
`tests/open-source-licence-terms.test.js` refused it: a record whose licence text
says nothing was declared must be `blocked`. The rule is right to be absolute —
the moment an undeclared licence can sit at `reference_only`, the line between
may-read and may-take rests on whoever opens the entry next. **The record moved,
not the check.** Weakening it would also have needed a documented reason in
`SECURITY_NOTES.md`, which is the second reason not to.

### 2026-08-17 — the fourth instance, and this one is what the customer sees

Went looking for it deliberately. Three fixes today were the same collapse in
three different modules, so the question was where else it lives — and the
answer was one layer further out, in the rendering rather than the reading.

**`workspaceRecordCards` returned `""` for a read that failed.** It returns `""`
for three unrelated situations: a page with no records section, a read that
failed, and a read that could not be attempted. The reasoning above it is sound
and is kept — *"a records list that cannot load should leave the tool usable
rather than take the page down with it"*. The mistake is the choice of `""` for
the middle one. `""` is what a page with no records section looks like, so a
customer with twenty saved leads saw the form and nothing under it. On a page
titled Records, an empty page is not the absence of a statement.

**The neighbouring renderers already had it right for the case they could see.**
`renderRecordCards` on a genuinely empty list says *"Nothing saved yet. Use the
form above and it will appear here."* That sentence is true after a successful
read and false after a failed one, and nothing told them apart — the failure
never reached the renderer at all.

`renderRecordsUnavailable` now says the list could not be loaded, that it is our
side, and that nothing has been deleted. Setup codes stay silent, because a
customer with no workspace yet is not looking at a failure and the page has its
own setup card; a "we could not load" banner on a brand-new account would be a
new false statement in place of the old one.

**Two smaller things found on the way in.** `moduleCrud.list` passed a 200
carrying a non-array straight through as `records`, which reached `.map` in the
renderers — before this morning's route safety net that hung the request, and
after it a 500. It is a read failure now. And `readModuleRecords` reported
`setup_required` for every organization failure, which since this morning
includes `workspace_unreadable`; only a genuine `workspace_not_ready` maps there
now.

**The test's second half is the half that matters.** For each of the two page
shapes it asserts the failed read says so — and then that a *successful* empty
read still says "Nothing saved yet" and does not say "could not load". Without
that pair, a page apologising unconditionally would pass, and that is the same
lie told in the commoner direction, to every customer who genuinely has not
saved anything yet.

**Line-neutral in server.js**, which stays at 4032: two `return ""` became two
calls, and the new markup lives in `lib/sonara-module-crud.cjs` beside the
renderers it belongs with.

### 2026-08-17 — a customer who had paid could be shown a paywall

Third instance of the same collapse in one day, and the one that touches money.

`getCustomerPaidEntitlement` asks two tables whether this customer holds a plan
that opens this product: `billing_entitlements`, then `billing_subscriptions`.
Both reads were `if (response?.ok) { ... }` with no else. A read that failed and
a read that found nothing ended in the same place — **HTTP 402**, under the
heading **"Upgrade required"**, beside a link to pricing, with the sentence
*"Paid access is locked until payment updates show an active or trialing plan."*

So during an outage on our side, a paying customer was told they had not paid.
402 is literally Payment Required. The first thought of somebody shown a paywall
they already paid past is that they have been charged wrongly, and every element
of that page agreed with them.

A plan can live in either table, so **one** silent read is enough to make the
conclusion unfounded — the subscription read failing alone was sufficient, with
the entitlement read answering correctly and finding nothing.

**Now:** `readBilling` returns rows or `null`, never `[]`, and treats a 200
carrying a non-array as failed too. If either read came back null and neither
found a match, the answer is `503 entitlement_unreadable` with a message that
says whose fault it is and does not mention payment. `workspace_unreadable` and
`workspace_unavailable` from the tenant resolver land there as well, rather than
being flattened into `upgrade_required` as every organization failure was.

**The page had to change with it.** The heading was hardcoded, so a 503 would
still have rendered under "Upgrade required". The result now carries a `heading`,
and server.js drops the pricing link when it is present — there is nothing to buy.
Results that genuinely mean upgrade carry no heading and are untouched, which is
what the test's `assert.equal(unpaid.heading, undefined)` is for.

**The test asserts the paid paths and the genuine-402 path first**, so the three
503 cases are not green against a reader that stopped charging anybody.

Two notes for whoever is next. The four production markers
`verify-production-product-catalog.mjs` greps for are intact — both PostgREST
paths, the active-or-trialing filter, and the locked message, which is still the
text of a genuine 402. And `billingRowOpensProduct`, which refuses a
`workspace_monthly` row for the wrong workspace, still returns its own 402: that
is a real answer about a real row, not a read that failed.

**A container reset landed mid-change** and put the tree back on `f3e51f2`, four
commits behind. Recovered by fetching and fast-forwarding rather than resetting
hard. Worth recording because the first version of this fix was written against
the stale file — which had neither `metadata` in its selects nor
`billingRowOpensProduct` — and the patch's own assertion is the only reason it
did not apply cleanly onto code that had moved on.

### 2026-08-17 — a read that failed could hand a customer a second workspace

Found while sweeping for the absent-vs-empty collapse this codebase keeps
producing. This one is in the tenant boundary itself, which makes it the worst
place it has turned up.

**What it was.** `getCustomerPrimaryOrganization` looks in
`organization_memberships`, then `business_memberships`, and if neither has a
row it calls `sonara_bootstrap_customer_workspace` to make one. Both lookups
were written as `if (response?.ok) { ... }` with no else, so "the read failed"
and "there is no row" fell through to the third step identically.

**Why it was not caught by the RPC being idempotent.** It is idempotent — but
only against `organization_memberships`, which it checks for an active
membership before creating anything. It never looks at `business_memberships`.
So a failed read of the first table was covered by accident, and a failed read
of the second was not: a customer whose only membership lives there, on a
request where that read failed, was handed a brand-new empty organization while
their real one sat untouched with every record in it. From their side the
product had lost their business.

**The fix is a refusal, not a retry.** Both reads must answer before "there is
nothing to find" is a conclusion anyone may write against. `readMemberships`
returns the rows or `null`, never `[]`, for exactly that reason — and it returns
null for a 200 carrying something that is not an array too, which is a real
PostgREST failure mode and read as "no membership" before.

**And the same collapse one level up.** "No workspace" and "could not check"
were both `workspace_not_ready`, a code that reads as a fact about the customer.
Someone mid-outage was told they had no workspace and offered a button to create
one. `workspace_unreadable` is now separate; callers testing only `.ok` are
unaffected, which is nearly all 95 of them.

**Extracted while fixing**, to `lib/sonara-customer-organization.cjs`. server.js
came down 40 lines and the ratchet in `tests/server-split.test.js` went to 4033
— below where it stood before this morning's seven-line rise for the async route
safety net.

**Two existing guards caught the move before the tests did**, which is worth
recording because both were written after being fooled once.
`tests/member-read-policies.test.js` refuses any function handed a table name
that it does not know, so `readMemberships` had to be registered before its two
tables could go unchecked. And `tests/database-query-contract.test.js` pins the
deterministic membership query — explicit total order and `limit=1`, without
which a customer in two organizations flips between them per request. Its
assertions now read the whole runtime rather than server.js, per that file's own
note that which file holds a query is not part of the contract, and check that
both tables go through one shared query rather than each carrying its own.

### 2026-08-17 — a route that fails now answers, instead of hanging

`docs/SHIP_READINESS.md` carried one open finding since 13 August: a request to
`/admin/database` with a *healthy* catalog did not complete, while requests whose
catalog failed answered in milliseconds. It was never diagnosed. It is now, and
the cause was not in that route.

**Express 4 ignores the promise an async handler returns.** A handler that
throws, or awaits something that rejects, never reaches `next(error)`. Nothing
writes a response. The request stays open until whoever is at the other end
gives up. Probed directly against this application: `UNHANDLED REJECTION` on the
process, and no response at all through a five-second deadline. There are **225
async handlers** here. `/admin/database` was where somebody happened to be
looking, and its healthy branch is simply the one with more code in it to fail.

**A stall is not a slow 500**, which is why this got a module rather than a
try/catch in the handler that was noticed. The customer sees a spinner, so they
retry rather than report. The serverless function is billed until its own
timeout rather than until the error. And it landed on the page an owner opens
when they already think something is wrong.

**Fixed at registration.** `lib/sonara-async-route-safety.cjs` patches
`app.get/post/put/patch/delete/use/all` once, before the first route exists, so
a rejection becomes `next(error)`; a terminal handler registered last answers
500 — a branded page, or JSON under `/api/` — with no error text and no stack in
it. Wrappers keep their argument count, because Express decides what is an error
handler by counting parameters, and a 4-argument handler wrapped in a
3-argument one silently stops being one and starts receiving the error as `req`.
Express routers are left unwrapped so `verify-route-registry` can still walk
their stacks. 225 handlers cannot be individually remembered, and the 226th gets
written by somebody who never read this entry.

**The test's first assertion is that the defect exists.** An unpatched Express 4
app must stall; otherwise the four passing cases after it would be green against
a framework that never had the problem. Then: a page for a browser, JSON for an
API caller, no error text or stack in either, a synchronous throw caught too,
and a response already sent left alone — a 500 written over work that succeeded
is worse than the stall. Two more read the real router stack: every registered
handler wrapped, terminal handler last.

**The one thing still unknown**, said plainly rather than closed over: what made
`/admin/database` throw was never identified and no longer reproduces — 2ms
inside the full suite, 40ms standalone. An unidentified throw is still an
unidentified throw. What changed is that it can no longer take a request down
with it, and if it comes back it arrives as a 500 with a stack in the log rather
than as silence.

**One ratchet moved.** `server.js` grew 7 lines and the ceiling in
`tests/server-split.test.js` went 4066 → 4073, with the reason written next to
it: a require, one call after `const app = express()`, and a four-line terminal
handler, all of which must be in that file because they bracket every route
registered in it. Everything else went into the module.

### 2026-08-17 — "GitHub is down" is not "the repository is gone"

`external-repository-health` went red on PR #202 with thirty-five lines of
`ERROR: GitHub returned 504 for ...`, naming `rust-lang/rust`,
`sindresorhus/awesome` and `ollama/ollama` among others. Nothing was wrong with
the register. GitHub's API was returning gateway timeouts, and the checker
reported that as evidence about the repositories.

**Why this one mattered more than the noise.** The obvious response to a red
external-repository-health run is to go and remove the named entries from
`data/open-source-tools.ts`. A check that cannot tell *this repository is gone*
from *GitHub did not answer* does not merely fail uselessly — it argues for
deleting eighty-five records that are fine, in the one place where the argument
looks authoritative.

**Three outcomes now, not two.** Confirmed means GitHub answered and the answer
was good; error means GitHub answered and the answer was bad — 404, 410,
disabled, no default branch; indeterminate means GitHub did not answer — 5xx,
timeout, transport failure, rate limit. 429 and 5xx are retried twice with
backoff first, because a gateway timeout is usually a moment rather than a
state; a rate limit is not retried, since burning attempts against it only
deepens it. Transport failures were folded in too — an offline runner used to
report every registered repository as broken.

**And the pass had to be tightened at the same time.** Downgrading 5xx to a
warning on its own would have turned thirty-five false errors into a silent
green, which is this codebase's recurring defect wearing its other face. So a
`--network` run that confirms *zero* targets now fails, and the summary line
reports the population it actually reached rather than the one it was given.
That line already lied on the rate-limit path, which breaks out of the loop
partway and then went on to claim "every registered repository still exists".

**Verified against a stubbed API rather than reasoned about**, since a check
about failure handling that has only been read is a check nobody has run: three
504s among ninety-one targets warn and exit 0 naming 88 of 91 confirmed; a 404
on `rust-lang/rust` still exits 1; a rate limit on the first target exits 1 for
having established nothing; and the offline release-chain path is unchanged.

### 2026-08-14 — the 124 policy-less tables are correct, and now provably so

The Supabase work asked for was a search for what is broken. What it found was
a property that is right and undefended, which is a different kind of problem
and a worse one, because the fix for it looks like a fix.

**The finding.** Row level security is enabled on every table in this schema.
124 of them carry no policy at all. A security advisor reads that as a gap, and
the obvious remedy is to write policies. Both readings are wrong. RLS enabled
with zero policies denies every row to `anon` and to `authenticated`; the
service role bypasses RLS entirely. Every query this product makes goes through
Express holding the service key, so deny-all is not a gap in the wall — it *is*
the wall, and it is the strongest state available. Writing policies to satisfy
the advisor would open 124 tables to any signed-in user of any organization, in
exchange for nothing, because nothing is being denied that anybody wanted.

**Why it held.** Checked rather than assumed: no file under `public/` or
`packages/` names `/rest/v1/`, a `*.supabase.co` host, or `createClient(`. The
anon key appears only in server-side modules. The browser genuinely has no route
to PostgREST, so the tenant boundary is the `organization_id` filter in Express
and nothing depends on a policy that isn't there.

**What was missing.** Nothing checked the "no route to PostgREST" half. That is
the load-bearing assumption, it is invisible from the database side, and the
first client script to query PostgREST directly would get empty results from 124
tables and send whoever wrote it straight to the policy editor. The database
cannot warn about this; only the client tree can.

**What was added.** `scripts/client-secret-scan.cjs`, already in
`verify:launch`, now also fails if a browser file names a PostgREST path, a
Supabase host, or a Supabase client constructor — with the reasoning in the
failure text, so the person who trips it reads why before deciding what to do.
The scan also throws on zero files read, since a walk that stopped matching
would otherwise report both of its checks green having read nothing, which is
this codebase's recurring defect exactly.

**Verified to bite.** Appending a `fetch("https://<ref>.supabase.co/rest/v1/customers")`
call to `public/sonara-one.js` fails the scan; so does a bare Supabase host
string with no fetch around it. The restored tree passes and names the count of
files it read.

**Still open and owner-only.** Leaked-password protection is a dashboard toggle
in Supabase Auth and no tool here can set it. The four authorization functions
(`is_admin`, `is_current_user_admin`, `has_scope`, `has_company_access`) exist
in the live database and not in any migration; exporting them needs the Supabase
MCP connector authorized, which it is not.

### 2026-08-14 — watermarks-remover reviewed and refused

Added to the register on request, and **blocked**. The name suggests removing a
photographer's visible watermark. Read from the repository, it does something
else: it strips multi-vendor **AI provenance marks** — C2PA Content Credentials,
SynthID-class statistical text watermarks, invisible Unicode markers, and
EXIF/XMP metadata — across PNG, JPEG, WebP, SVG, PDF, DOCX, ODT, HTML and
Markdown. Its own skill manifest gives the purpose as *"anti-detect clean AI
output"*, and it ships a reference document on defeating one specific vendor's
marks.

**The licence is MIT, and that is the point of this entry.** There is no licence
obstacle whatsoever. The obstacle is ours. `AGENTS.md` says, in as many words:
*enforce provenance, consent, and anti-clone safety*. C2PA and SynthID **are**
the provenance layer. A product that sells provenance enforcement and also ships
a provenance stripper is not offering two features — it is contradicting itself,
and the contradiction gets discovered by whichever customer relied on the first
one. This is the register's most useful shape: a repository with a clean licence
that still cannot be used, for a reason that has nothing to do with copyright.

**The legitimate slice, acknowledged rather than flattened.** The project frames
itself as privacy and hygiene on content you own, and one part of that is real:
stripping GPS coordinates out of your own photograph before publishing is
privacy hygiene creators genuinely need. That slice does not require this. It is
a metadata field, it can be built against the files a customer already uploads,
and building it separately is what keeps it from arriving bundled with
provenance removal. The register entry says so, and the safety boundary written
against it is that any future EXIF-privacy feature strips location and device
fields only and leaves content credentials intact.

**Not installed anywhere.** The repository ships an agent-skill installer
(`skills/remove-ai-marks/`, `install-skill.sh`). It was not installed into this
session or into the repository's skills, and "installing that skill into any
agent used on this codebase" is written into `blockedUses` so the reason
outlives whoever read it.

### 2026-08-13 — Every connector reconciled against what the application actually uses

A connector being available as a tool is not the same as the product depending
on it, and the two were never written down together. Reconciled:

| Connector | State | What the application does with it |
| --- | --- | --- |
| Stripe | live, account `sos` | Checkout and billing. Three new prices created today. |
| Resend | `sonaraindustries.com` verified, sending enabled | Email delivery. |
| Vercel | team and project `sonara-os` reachable | Hosting. **No env-var tool exists**, so setting the three price variables is the owner's step and cannot be done from here. |
| GitHub | working | Branch, PR and CI for this repository. |
| ElevenLabs | authenticated, **zero agents** | Named in the voice provider registry. |
| Cloudinary | authenticated, **Free plan**, 64 objects, 0.68% of credits | **Nothing.** No source file references it. |
| Cloudflare | authenticated | Two mentions, both register entries rather than calls. |
| Base44, Canva, HeyGen, Supabase | **need authorisation** | Not usable from this session. |

**Two findings worth keeping.**

`descript` appeared to be referenced in 43 source files. It was matching the
word "description". Recorded because a grep that answers a question you did not
ask is how a survey ends up confidently wrong.

Cloudinary is on a **Free plan** and the application does not use it. That is
the good version of the free-tier hazard in CLAUDE.md — a free tier that
nothing ships on can change without breaking anything. It would stop being the
good version the moment a feature rested on it.

**The voice gate was checked rather than assumed.** ElevenLabs is a voice
cloning service and AGENTS.md requires provenance, consent and anti-clone
safety, so the path that could reach it was read end to end. `evaluatePolicy`
refuses any voice capability without a rights attestation, a consent
attestation, and a consent row that exists, is attested, is not revoked and has
not expired — scoped to the organisation and the user. Imitation language in a
prompt routes to human review before any of that. And a consent row that could
not be *read* refuses too, rather than being treated as permission, which is the
same rule this codebase applies everywhere else and the one that is easiest to
get backwards.

### 2026-08-13 — Agents run on the customer's schedule, and still cannot approve themselves

Until now nothing proposed work on a schedule. Agents run on one now, and the
schedule belongs to the **customer**: a single platform cron at 03:00 UTC would
have been our schedule wearing their name, and two businesses want their week
reviewed on different days.

`agent_schedules` holds cadence, local hour, weekday or day-of-month, and the
customer's time zone. `/owner/agent-schedule` is where they set it.
`vercel.json` carries an hourly cron onto `/api/agents/schedule/tick`, because
Vercel runs no process between requests and a schedule needs something to knock.

**The safety property survives, and was tested against a deliberate attack on
it.** A scheduled run goes through the same runner as any other, so
`decideExecution` still refuses the seven gated categories without an approval.
Writing `issue_refund` straight into the schedules table — bypassing the
allowlist the form enforces — produced `refused`, and the action was queued for
the owner with category `refunds` rather than executed. **A schedule can start
work. It cannot approve it.**

**Three things the arithmetic gets right, and they are the easy ones to get
wrong invisibly.** The customer's local hour, not the server's — "Monday at 9"
is a different instant in Auckland and Lisbon. Never twice in one period, so an
hourly tick still produces one daily run. And a missed period is not made up:
three quiet days produce one run, not three, because catching up turns an outage
into a burst of work at the moment service returns.

**Scheduled runs do real work rather than reporting `unimplemented`.**
`check_data_quality` was registered against the queue runner, running the same
22 record checks the assistant page runs. Its limit is stated rather than
papered over: it returns counts and writes no findings, because an audit trail
accumulating copies of a customer's records would be a second store with
different retention. A scheduled check tells an owner *that* something needs
attention; the page tells them what.

**Three gates caught this change, which is the system working on its author.**
The tenant guard blocked the tick's cross-tenant read until it was declared in
`EXEMPT_PATTERNS` with its reason — narrowed to the exact shape the tick issues.
`verify:env` refused the new secret until it was classified. And `verify:doc-counts`
caught the migration count moving 82 → 83 in two owner documents.

**One claim corrected because it stopped being true.** The contract gate printed
"autonomous execution remains disabled" on every release. Agents now run on a
schedule, so it says what is true instead: schedules can start work but cannot
approve it, and no gated action executes without an approval record.

**The three Stripe prices exist.** Created in the live account on the owner's
instruction — `sonara_workspace_monthly` $19, `sonara_all_three_monthly` $39,
`sonara_team_monthly` $79, with lookup keys so they can be found without the
setup table. Creating a price charges nobody; it is inert until a checkout
session names it. The remaining step is the owner's: set the three variables in
Vercel and redeploy, and the pricing page switches ladders on its own.

### 2026-08-13 — The database console could report a database with nothing in it

Swept the 38 admin pages with the database down. Thirty-seven report the failed
read; the outage path was already sound everywhere. What the sweep found instead
was one page that can report an **impossible** figure.

`/admin/database` summarises the catalog through `lengthOf`, which returned `0`
for a missing key and `0` for an empty list. So a catalog response the page did
not expect — a renamed key, a partial read, an RPC answering 200 on its own
internal failure — rendered as **0 schemas, 0 tables, 0 functions, 0 policies,
0 applied migrations**. A connected Postgres has never had no schemas and no
tables. That pair is not a low count, it is an impossible one, and it appears on
the page an owner opens when they already suspect something is wrong.

`reconcileMigrations` did the same thing one layer up, coercing an absent
`applied` list to `[]` before the summary could see it, so "the catalog said
nothing about migrations" and "no migration has ever been applied" arrived as
the same value.

Both distinguish absent from empty now: a missing figure reads `unavailable`, a
genuinely empty list still reads `0`, and no-schemas-and-no-tables carries a card
saying the figures describe the response rather than the database.

**A correction to make plainly.** The first version of this note said the page
showed zeros during an outage. It does not — an outage fails the RPC and the
page correctly says "Database Management needs setup". What was actually
reproduced is the narrower case where the catalog answers and the answer is not
what the page assumed. The fix is the same; the description was wrong.

**And an open finding that came out of it.** The healthy-catalog render stalls
under the test harness — not slowly, at all, twice through eight-second
deadlines — while the failing-catalog renders in the same process answer in
milliseconds. Ordering, the admin gate, the section default and the environment
are all ruled out. It is not explained, so it is written up in
`docs/SHIP_READINESS.md` as an open finding, and the test file carries no
healthy-page assertion rather than a green one that cannot run.

### 2026-08-13 — Two free-LLM-API directories reviewed and registered

Added on request: `mnfst/awesome-free-llm-apis` and
`open-free-llm-api/awesome-freellm-apis`. Both went through the register rather
than into the product, which is what `CLAUDE.md` requires of any external
repository, and both licences were **read from the repository's own licence
file** rather than assumed:

| Repository | Licence | Status |
| --- | --- | --- |
| `mnfst/awesome-free-llm-apis` | CC0-1.0 | `reference_only` |
| `open-free-llm-api/awesome-freellm-apis` | MIT | `reference_only` |

Neither licence restricts anything. **That is the easy half, and it is not the
half that decides this.** `CLAUDE.md`: *"Cost is a constraint of the same weight
as licence. A hosted service with a free tier is a price, not a licence, and a
shipped feature resting on one stops working when the tier changes — which is
the vendor's decision, not this project's."* Every entry in both directories is
exactly that. So they are good research for deciding what an owner might
configure, and nothing in them may become something a customer-facing feature
depends on.

**Two things recorded that a reader should weigh.** The mnfst list is published
by manifest.build and links to it throughout — a commercial interest in the
list rather than a defect, but worth knowing. And the second repository is the
content surface of a hosted service: `freellm.net` appears 115 times in its
README and the data is refreshed from that site, so it is a snapshot of
somebody else's service rather than the source of its own facts.

**One pattern in it is explicitly blocked.** It ships
`code-examples/claude-code.md`, which tells a reader to point Claude Code at a
third-party endpoint by setting `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`.
That is a developer's own choice on their own machine; it is not a pattern for
this repository, because redirecting an assistant sends whatever is in the
prompt to that provider. It is in `blockedUses` so the reason survives the
person who found it.

Both are placed under Research Lab and AI Governance — reading them is research,
and the conclusion recorded against them is governance. The register is at 84
records, and the integration map regenerated to match.

### 2026-08-13 — The data export left out 21 of the 51 record types

`/legal/terms` says: *"What you put in stays yours. You can export it at any
time from your data page."* The export covered **30** tables. The product keeps
**51**.

Missing: **every Growth Studio record** — leads, campaigns, audience groups,
contact history, conversions, automations — and **every line item inside a
record**, including what is on an invoice and what has been paid against it.

The sharpest of those was `growth_contact_consents`, the record proving somebody
agreed to be contacted. A business that leaves without it loses the basis on
which it contacts its own customers, and the export gave no sign anything was
absent.

The cause was ordinary and is the reason this keeps happening: `EXPORTABLE` was
assembled by hand from two of the three page collections, and nothing compared
it against the third or against the children. It is derived from all of them
now, so a record type that ships with a page is in the export the day it ships.
`GROWTH_TABLES` moved to `lib/` for it — the map lived inside the growth routes
where the export could not reach it, which is how the gap opened.

**An unreadable table is `null`, not `[]`.** The file already named unreadable
tables under `unreadable` and set `complete: false`, and then wrote `[]` into
`records` for them — so a consumer reading `records.growth_contact_consents`
read it as the consents. That is the "a field called ok is read as ok" mistake
one level down, and for a consent record the difference between `[]` and `null`
is the difference between having permission and not.

**Verified.** 1807 tests passing, chain green. The export was downloaded through
Express with two tables failing: 51 record types present, the two named, both
`null`, the rest carrying rows. Reverting to the two-collection list fails the
new check, and so does putting `[]` back.

**Also checked and sound, recorded so it is not re-swept.** The staff portal
reports a failed personal read on all six pages rather than showing an empty
schedule, and `/staff` itself states no count it could not support.

### 2026-08-13 — Eight stale figures in the documents the owner reads

`verify:doc-counts` exists because a figure typed into prose has nothing
watching it. It shipped covering two claim shapes — the length of the release
chain, and a raw "N passing" — and **eight live figures drifted underneath it
anyway**, all of them in the two documents an owner reads to decide whether to
launch:

| Document | Said | Is |
| --- | --- | --- |
| `owner/WHAT-IS-LEFT.md` | 66 reviewed repositories | 82 |
| `owner/WHAT-IS-LEFT.md` | 302 tables created | 303 |
| `owner/WHAT-IS-LEFT.md` | 209 organization-scoped | 210 |
| `SHIP_READINESS.md` | 77 migrations | 82 |
| `SHIP_READINESS.md` | 497 policies | 505 |
| `SHIP_READINESS.md` | 197 policies / 59 tables | 202 / 64 |
| `owner/OWNER-STEPS.md` | 197 policies / 59 tables | 202 / 64 |

Every one was right when written. That is the whole point, and it is why adding
a check for one shape of figure does not watch the others.

**The gate now derives four more.** Repositories on the open-source register,
migration files, tables created by the migrations, and how many of those are
organization-scoped — each read from the repository, each anchored on the noun
phrase the documents actually use so a sentence about somebody else's
repositories is not misread as a claim about ours. Six countable claims are
checked where there were two, and every one of the four was confirmed to fail on
the figure it had been carrying.

**What was deliberately not automated.** "How many licences reach a hosted
product" is a judgement recorded at review time, not something re-derivable from
the register, so it stays a human's to keep — the check counts the nine
reciprocal licences and leaves the reading to a person.

**One number was left wrong on purpose.** `SHIP_READINESS.md` recounts a bug
where a broken parser "saw 191 policies instead of 497". Correcting 497 to 505
would falsify the history — 497 was true that day. It now says "where there were
then 497" and points at the live figure above it, the same principle that keeps
this log and the dated audits out of the check entirely. `docs/audits/` is now
excluded by path, because those carry their date in the filename rather than in
a `Date:` line the existing marker could see.

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
