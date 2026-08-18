# GitHub category sweep — 18 August 2026

Method, findings, and an honest account of what this kind of sweep can and
cannot finish. **Review before 18 February 2027**: every repository below is
filtered on "pushed within the last year", and that filter expires.

## Method, including the search that did not work

Filters used: `topic:<name>`, `stars:>N`, `pushed:>2025-08-18`, and `license:`.

The first attempt used free-text search — `restaurant OR point-of-sale OR pos in:name,description` — and returned **postcss, postgrest, oh-my-posh, postal, node-postgres and postgres-operator**. Substring matching on "pos". Zero of eight results were relevant, and the call cost about thirty thousand tokens.

Recording that because it is the useful half of the method: **topic filters find the category, free text finds the spelling.** Anybody repeating this sweep should start from `topic:`.

## Finding 1 — the POS category is mostly closed to us, and the reason is licensing

Of **18** point-of-sale projects above 200 stars pushed in the last year:

| Licence family | Count | Notable |
| --- | --- | --- |
| Reciprocal (GPL/AGPL) | **8** | erpnext (38.2k), frappe/books (4.9k), NexoPOS (1.2k), lakasir (896), OCA/pos (355), **ury (336)**, viewtouch (216), laravel-easy-pos (204) |
| Permissive (MIT/Apache/BSD) | **5** | btcpayserver (7.7k), react-point-of-sale (423), mycompany (318), point-of-sales (271), flutter_pos (209) |
| Other or undeclared | 5 | — |

**Every large one is reciprocal.** `CLAUDE.md` states the rule plainly: a reciprocal licence triggers on network use, so incorporating one into this hosted product obliges releasing this product's source under the same terms. That includes **ury**, which is the only purpose-built restaurant POS in the set and would otherwise have been the obvious candidate.

So the answer for restaurants and POS is not "adopt one". It is either build, or run one *separately* as an owner-operated service reached through an adapter — the arrangement `docs/architecture/EXTERNAL-SERVICES.md` already describes, where the licence obligation sits with the deployment rather than with this codebase.

## Finding 2 — the strongest speech candidate is the one that runs offline

Of text-to-speech projects above 3,000 stars pushed in the last year under MIT or Apache-2.0 (**27** in total), the shortlist:

| Repository | Stars | What it is | Position |
| --- | --- | --- | --- |
| **k2-fsa/sherpa-onnx** | 14.2k | STT, TTS, speaker diarization, enhancement, VAD — **offline, no internet**, 12 languages, embedded through server | The one worth pursuing |
| OpenBMB/VoxCPM | 35.8k | Tokenizer-free TTS, voice **cloning** | Consent-gated only |
| QwenAudio/CosyVoice | 22.8k | Multilingual generation, voice **cloning** | Consent-gated only |
| RVC-Boss/GPT-SoVITS | 61k | Voice **cloning** from one minute of audio | Consent-gated only |
| nari-labs/dia | 19.4k | Ultra-realistic dialogue TTS | Consent-gated only |

**Four of the five headline projects are voice cloning**, and `AGENTS.md` says: *enforce provenance, consent, and anti-clone safety*. This codebase already has `creator_voice_consents` and `song_fingerprints` for exactly that. None of the four is unusable — they are unusable **as a general feature**. Behind the existing consent gate, cloning a voice its owner has recorded permission for is the legitimate case, and it is the only one.

`sherpa-onnx` is different in kind rather than degree: transcription, synthesis and diarization with no cloning emphasis, running with no network call at all. That means **no per-customer cost and no customer audio leaving the owner's machine**, which is the same commercial and privacy argument that made the calculator tools worth building.

## What this sweep is not

The request named roughly forty categories and asked for "all repositories at github.com". Two things are worth stating rather than quietly not doing:

- **There is no finite set.** GitHub holds hundreds of millions of repositories. "All of them that pertain to this application" has no completion state, and a register that claimed to have swept it would be this codebase's own recurring defect — a signal reporting success without being true — at the largest scale yet attempted.
- **The register's standard is per-record.** All 88 existing records were reviewed before they were written. Bulk-adding candidates from search metadata would produce records asserting a review nobody did. The entries added today say exactly what they are based on: licence and metadata from the GitHub API and the project's own description, **not** a source read.

Two categories done properly cost roughly six searches and an afternoon of judgement. Forty categories is a programme of work, and it is worth doing one category at a time in the order the product actually needs them.

---

# Second pass — 18 August 2026, later the same day

## Another topic-name trap, in a new form

`topic:scheduling` returns **cron and batch job schedulers** — luigi, apscheduler, quartznet, croner — not appointment booking. The word means something different in this ecosystem than in our domain, which is the same failure as "pos" matching postcss, arriving through a valid topic rather than a bad search.

Two rules now, and they are opposites:

- **Short, ambiguous terms need `topic:`** — "pos" as free text is useless.
- **Distinctive terms are better as free text** — "calendly" in a description found the one relevant project that no topic filter surfaced.

Also: `OR` does not apply to qualifiers. `topic:a OR topic:b` is a 422, and multiple `topic:` filters are ANDed. One search per topic.

## Finding 3 — appointment booking is thin, and the obvious answer is unverifiable from here

`topic:booking` above 300 stars returns **two** results, one of which is a Gantt/timeline UI component rather than a booking system. `topic:calendly` returns two, the notable one being **CloudMeet** (518 stars, created December 2025, a Calendly alternative on Cloudflare's free tier).

**Cal.com is the obvious candidate and its licence was not verified.** `repo:` search is refused for repositories outside this session's scope, and the GitHub API returns 403 to unauthenticated fetches from here. Its licence is **not recorded** rather than recalled — this document does not carry a figure nobody checked.

> **Corrected later the same day.** The paragraph above is right that nothing was verified and wrong about why. The repository had been **renamed**: `calcom/cal.com` is now [`calcom/cal.diy`](https://github.com/calcom/cal.diy), same repository id `350360184`, same 2021 creation date, 47,768 stars. So the 422 was accurate and the inference drawn from it was not. GitHub's 422 says *"the resource does not exist **or** you do not have permission"*, and it was read as the second clause because that was the one already suspected. A refusal naming two causes is not evidence for whichever one you came in believing.
>
> Two method notes came out of it. `repo:` still returns 422 for any repository name containing a dot, so `org:` plus a filter is the way to reach those. And the licence question is now answerable in general: `search_repositories` with `minimal_output: false` returns the full repository object, including GitHub's **detected** `license.spdx_id`. That is a different thing from the licence *filter* used earlier in this sweep, which only reports which bucket a repository sorted into.

### Licences settled by the detected-licence method, 18 August 2026

Every record in this register that rested on a licence *family* rather than a licence was re-read this way. None of the six was as recorded.

| Repository | Was recorded as | Is |
| --- | --- | --- |
| `ArnasDon/wacrm` | "permissive family" | **MIT** |
| `twentyhq/twenty` | "in neither filter, unknown" | **NOASSERTION** — GitHub read its licence file and could not match it to any known licence |
| `vercel-labs/skills` | "not verified, submitted from a social post" | **MIT** |
| `RVC-Boss/GPT-SoVITS` | "MIT or Apache-2.0" | **MIT** on the code; weights separate and still unchecked |
| `ury-erp/ury` | "GPL/AGPL family" | **AGPL-3.0** |
| `brightbeanxyz/brightbean-studio` | "AGPL per its own topic list" | **AGPL-3.0**, confirmed rather than assumed |

And one absence settled the other way: `Shahzaib-Awann/Foodya-Restaurant` returns **no `license` key at all**, which is what GitHub returns when it finds no licence file. That is an established absence rather than an unread field, so the record moved from `needs_license_review` to `blocked`. Repositories declaring no licence went 5 → 6, which `verify-doc-counts` caught in `docs/owner/WHAT-IS-LEFT.md` before it could be published wrong.

One caveat the method does not remove: GitHub detects the **root** `LICENSE` file. For a monorepo — Cal is one — a root licence says nothing about a subdirectory kept under separate commercial terms, which is a common arrangement in this category. The root is established; the packages are not.

## Finding 4 — CRM is the healthiest category swept so far

Of **37** CRM projects above 1,000 stars pushed in the last year:

| Licence family | Count | Notable |
| --- | --- | --- |
| Permissive (MIT/Apache/BSD) | **13** | krayin/laravel-crm (23.7k), Django-CRM (2.4k), **wacrm (1.9k)**, open-mercato (1.6k) |
| Reciprocal (GPL/AGPL/LGPL) | **12** | erpnext (38.2k), monica (25.1k), dolibarr (7.5k), SuiteCRM (5.7k), espocrm (3.2k), frappe/crm (3.3k), ever-gauzy (4.3k), relaticle (1.5k) |
| Other or undeclared | 12 | **twenty (55.1k)** |

Two things stand out.

**The largest open CRM in the world carries neither a permissive nor a reciprocal licence** by the API's reckoning. `twenty` at 55.1k stars appears in neither filtered result, which means its terms have to be read rather than assumed in either direction. That is a finding about the category's headline project, not a gap in the search.

**`wacrm` is the closest architectural fit found in any category so far.** Self-hostable CRM on **Supabase, Next.js and TypeScript** — the same database this product runs on — with a shared inbox, pipelines, broadcasts and no-code automations. Its own description says *"Fork it, brand it, host it"*, and its ratio confirms it: **5,221 forks against 1,961 stars**. That is a template, not a dependency, and adopting it would mean forking rather than importing.

## Finding 5 — the social scheduling answer is reciprocal

**brightbean-studio** (2,152 stars, created March 2026) is a self-hostable social media management platform — schedule and publish across ten-plus platforms, an explicit Buffer, Sendible and SocialPilot alternative. Directly in Growth Studio's territory. Its own topic list begins with **`agpl`**, so the same rule applies as everywhere else in this document: reciprocal triggers on network use, and this is a hosted product.

## Running tally

Four categories swept properly: point-of-sale, text-to-speech, CRM, and appointment booking. Of roughly forty asked for. The pattern holding across all four is that **the strongest project in a category is more often reciprocal than not**, and the usable ones are smaller, newer, or templates.


## Pass three: paywall, creator economy, speech recognition

### `topic:paywall` is paywall *bypassing*, and this is the trap that matters

Third topic-name trap in this sweep, after `topic:pos` (postcss, postgrest,
oh-my-posh) and `topic:scheduling` (cron and batch jobs, not appointments). This
one is different in kind, because the results are plausible, popular, and would
be actively harmful to adopt.

Five repositories carry the topic above 200 stars. **Four of them exist to defeat
paywalls**: `everywall/ladder` (8,819 stars, "selfhosted alternative to 12ft.io"),
`manualdousuario/marreta`, `burlesco/burlesco`, `stefanw/bibbot`. The fifth,
`paywallpro/paywall-gallery`, is a screenshot gallery of iOS subscription
paywalls — a design reference, not software.

Creator Studio's job is to help creators **put** work behind a paywall and get
paid for it. The most popular software under the obvious search term is built to
take that away from them. A sweep that ranked by stars and skipped the reading
would have surfaced an 8,800-star "paywall" project as the category leader.
Nothing here is registered, and the reason is not licence.

### `topic:creator-economy` is thin, and nothing in it is adoptable

Four repositories above 50 stars pushed in the last year, and each fails on
something other than licence:

- `ai-creator-academy` (1,947 stars) — a curriculum. Not software.
- `drivetube` (130 stars) — video platform on Google Drive with cryptocurrency
  payments. Two hard dependencies this product does not want.
- `InPactAI` (100 stars) — sponsorship matching; 161 open issues against 100
  stars, which is a project earlier than its star count suggests.
- `stormy-cookbook` (59 stars) — a cookbook for a **hosted, keyed API** that
  also "finds verified emails". A price, not a licence, and a lead-scraping
  capability that runs straight into this product's consent rules.

Recording an empty category is the point. "Extensive research" that only reports
hits cannot be told apart from research that found nothing and said nothing.

### `topic:speech-recognition` — the real gap, and it was not licence

33 projects above 3,000 stars pushed in the last year, and the register held
**nothing at all** under speech recognition across 95 records, while captions and
transcripts are squarely Creator Studio's job. Three were verified and added:

| Repository | Stars | Licence (detected) | Why it is here |
| --- | --- | --- | --- |
| `ggml-org/whisper.cpp` | 52,977 | **MIT** | Runs on ordinary CPUs — no per-minute cost, no audio leaving the owner's hardware |
| `m-bain/whisperX` | 23,617 | **BSD-2-Clause** | Word-level timestamps and diarization: the difference between a transcript and a publishable caption file |
| `alphacep/vosk-api` | 15,064 | **Apache-2.0** | Small models on modest hardware, where the Whisper family will not run |

All three permissive, and **licence is not what constrains any of them**. This
application is Express on Vercel serverless with no build step. A C++ binary with
multi-gigabyte weights, a Python GPU pipeline, and native bindings are all things
a serverless function does not load. Adopting any of them means the owner runs a
service and this application reaches it through an adapter under the four rules
in `docs/architecture/EXTERNAL-SERVICES.md` — an infrastructure and cost
decision, not a licensing one. All three are recorded at
`optional_adapter_after_review` for that reason and no other.

Two things the licence does not cover, stated in the records rather than left to
be discovered. WhisperX's permissive licence does not reach the alignment and
diarization models it downloads at runtime, which are the pieces doing the work.
And diarization attributes speech to a person — under this product's provenance
and consent rules that is a draft for a human to confirm, never a label published
automatically.


## Pass four: manufacturing and industrial

13 repositories above 300 stars pushed in the last year. The category splits
cleanly in two and only one half is relevant.

**Most of it is MQTT and industrial protocol plumbing** — `emqx` (16,630),
`vernemq` (3,620), `nanomq` (2,592), `node-opcua` (1,653), `emqx/neuron`
(1,384). Brokers and connectivity servers for talking to PLCs and sensors. Real
software, correctly tagged, and nothing to do with what Business Builder does:
this product helps somebody run a business, not read a Siemens S7.

**The ERP half is the relevant one**, and it is dominated by reciprocal licences
— `frappe/erpnext` (38,211) and `metasfresh` (2,400) both sit in the GPL family,
which reaches a hosted product. `aureuserp` (11,764) is Laravel/PHP, off-stack
for a Node product.

### The closest architectural fit had the least usable licence, again

`crbnos/carbon` (2,366 stars, created June 2024) is ERP, MES and QMS built on
**Supabase, PostgreSQL, TypeScript and React Router** — the same database and
language this product runs on. Its detected licence is **NOASSERTION**: GitHub
read the licence file and could not match it to anything known.

That is the second time in this sweep. `twentyhq/twenty`, the closest
architectural fit in the CRM category, is also Supabase-and-TypeScript, also has
a hosted commercial product behind it, and also returns NOASSERTION.

**The pattern is not a coincidence and is worth carrying into the next sweep.** A
project with a company behind it writes a licence that protects it from being
resold as a hosted service — which is exactly the use a hosted product like this
one would make of it. So the repositories that look most adoptable on stack
grounds are systematically the ones whose licences are written against this
specific use. Searching by stack and then checking the licence walks into it
every time; the cheaper order is to read the licence first and let the stack
decide between what is left.

Recorded at `needs_license_review`. Reading Carbon's manufacturing domain model —
work orders, routings, quality records, configure-to-order pricing — needs no
licence resolved. Taking any of it does.


## Pass five: events, RSVP and ticketing

**`topic:event-management` is mostly software event dispatchers.** Fourth
topic-name trap. Of eight results above 300 stars pushed in the last year, four
are event buses and listener libraries — `saltstack/salt` (15,616),
`golevelup/nestjs`, `laminas-eventmanager`, `gookit/event` — with nothing to do
with a real-world event. Two more, `hitobito` and `admidio`, are club and
membership systems under 500 stars.

**One real hit:** `HiEventsDev/Hi.Events` (3,981 stars), self-hosted event
management and ticket selling, positioned against Eventbrite, Tito and Ticket
Tailor. Laravel and React, so off this runtime's stack; the value is the domain
model, not the code.

Its detected licence is **NOASSERTION**.

## The NOASSERTION pattern, now three for three

| Repository | Category | Stars | Hosted product behind it | Detected licence |
| --- | --- | --- | --- | --- |
| `twentyhq/twenty` | CRM | 55,066 | twenty.com | **NOASSERTION** |
| `crbnos/carbon` | Manufacturing ERP/MES | 2,366 | carbon.ms | **NOASSERTION** |
| `HiEventsDev/Hi.Events` | Ticketing | 3,981 | hi.events | **NOASSERTION** |

Three categories, three leaders, three licences GitHub cannot classify. This is
the most useful thing found in the whole sweep, so it is worth stating as a rule
rather than three anecdotes:

> **A project positioned as "the open-source alternative to X", with a hosted
> commercial product behind it, has usually written a licence specifically
> against being resold as a hosted service. That is what this product is.**

The practical consequences:

1. **Star count and category leadership predict licence trouble, not licence
   safety.** The bigger and more polished the alternative-to-X project, the more
   likely there is a company protecting it.
2. **Read the licence first.** Screening by stack or stars and checking the
   licence afterwards means doing the fit analysis on the repositories least
   likely to be usable. Reading the licence first and letting stack decide
   between what survives is strictly cheaper.
3. **NOASSERTION is not "unknown, probably fine".** It means GitHub read a real
   licence file and could not match it to anything standard — which is what a
   custom licence written by a company's lawyers looks like from the outside.

None of the three is blocked. All three are `needs_license_review`, and all three
are worth *reading* for their domain models, which needs no licence resolved at
all. What none of them is, on current evidence, is something to take code from.


## Pass six: licence-first, and the rule breaks on its first test

The previous pass ended with "read the licence first". This pass ran that way —
`license:mit` in the query before any assessment of fit — and it works. It also
produced a counterexample to the rule that motivated it, within one category.

**Digital signage, licence-first:** three MIT results above 200 stars.
`ardera/flutter-pi` (1,981, a Flutter embedder), `RushB-fr/freekiosk` (549,
Android kiosk lockdown), `screenlite/screenlite` (363, signage CMS). A real
category, thin at the top, and hardware-adjacent enough that a signage feature
would be a new product rather than an improvement to an existing one. Nothing
registered.

**Whiteboard and drawing, licence-first:** six MIT results above 1,000 stars, led
by `excalidraw/excalidraw` at **129,927 stars**. Verified MIT at the root.

Two things worth taking from it.

### The rule is a tendency, not a law

Excalidraw has a hosted commercial product at excalidraw.com behind it, exactly
like twenty, Carbon and Hi.Events — and it ships **MIT**. The rule was stated
after three data points and contradicted by the fourth, which is roughly what
three data points are worth. It stays in this document because it is still a good
thing to *search* by; it does not stay as something to conclude from.

Also visible in the same result set: `poteto/hiring-without-whiteboards` at
51,379 stars is a **list of companies**, not software. Star-ranked topic results
keep including things that are not programs, which is the same lesson as
`ai-creator-academy` in the creator-economy pass.

### The blocker was architecture, again

Excalidraw is the first candidate in this whole sweep whose licence, size,
maturity and product fit all pass. What stands between it and a shipped feature
is that it is published as a React package, and this application is
server-rendered Express with **no build step** and a Content-Security-Policy of
`script-src 'self'`. Using it means serving a prebuilt bundle from this origin —
which the CSP permits — and owning that bundle's size and updates permanently.

That is a supply-chain and page-weight decision for the owner. It is a real one,
and it is **not** a licence problem, so the record does not describe it as one.

Counting this pass and the ASR pass together: of the four repositories added
whose licences are fully settled and permissive, **all four are blocked by this
runtime rather than by their terms**. The register's bottleneck has moved.
Licence was the constraint that stopped things at the start of this sweep; by the
end of it, architecture is.


## Pass seven: publishing — and the answer the paywall search missed

`topic:publishing` splits between publishing and **package** publishing —
`lerna` (36,050), `gradle-play-publisher` (4,311), `intuit/auto` (2,499) are all
about shipping software releases. A fifth ambiguity, milder than the others
because the real hits are still at the top.

And the top result is the one that matters. **`TryGhost/Ghost`** — 54,789 stars,
Node.js, verified **MIT** — describes itself as *"publishing, memberships,
subscriptions and newsletters"*.

### That is what pass three went looking for and could not find

Pass three searched `topic:paywall` for a way to help creators put work **behind**
a paywall and get paid. It returned four tools for *defeating* paywalls and
nothing that builds one, and the pass was written up as an empty category.

It was not an empty category. It was the wrong word. Nobody building membership
software tags it "paywall" — the people who tag things "paywall" are the people
removing them. The capability was under `topic:publishing` the whole time.

**Worth carrying forward: when a category comes back empty or hostile, suspect
the search term before concluding the software does not exist.** An empty result
is evidence about the vocabulary at least as often as it is evidence about the
world.

### And the strongest counterexample yet to the NOASSERTION observation

Ghost(Pro) is not a side business — it is how Ghost is funded — and the software
is still MIT. Combined with Excalidraw, the "hosted product behind it means a
protective licence" tendency now has two clear exceptions out of six data points.
It stays a reasonable thing to search by. It is not something to conclude from,
and this document should not be read as saying it is.

### What is actually available here

Being Node.js puts Ghost in the same language as this application, which is less
useful than it sounds: it is a full application with its own database and admin
client, so adopting it means *running* it, not importing it — an adapter to a
service the owner runs, under the four rules in
`docs/architecture/EXTERNAL-SERVICES.md`.

The value available without adopting anything, and without resolving any licence,
is the **membership model itself**: tiers, gated posts, and what a member sees
before and after paying. That is the part this product does not have, and it is
readable for free.


## Pass eight: audio and music

Licence-first again: `topic:audio-processing`, MIT, above 2,000 stars, pushed in
the last year. Five results, and two worth registering.

| Repository | Stars | Licence (verified) | What it is |
| --- | --- | --- | --- |
| `deezer/spleeter` | 28,379 | **MIT** | Splits a mix into vocals, drums, bass, other |
| `cgzirim/seek-tune` | 5,595 | **MIT** | Shazam's recognition algorithm, in Go |

Both carry the split now familiar from WhisperX: **the code is MIT and the
pretrained models are separately licensed**, and the models are the part doing
the work. Both are also outside this runtime — Python/TensorFlow and Go — so
they are services the owner runs, not libraries this application imports.

### The trap in seek-tune, which is the reason it is registered

This repository already has a table called **`song_fingerprints`**, and the
subsystem registry described it as backing anti-clone matching. Pointing an
acoustic fingerprinter at it is the obvious move and it is wrong.

Its columns are `song_title`, `creator_name`, `identity`, `mood`,
`audience_signal`, `sonic_palette`, and a `fingerprint_id` that is **a plain text
field somebody supplies**. No audio. No hash. Nothing derived from a recording.
It is a description of a work's creative identity, and the word "fingerprint" in
its name means something entirely different from the word "fingerprint" in
seek-tune's.

`grep` finds no writer either — the migration, the tenant-scoped list, and the
registry note, and no code that reads or writes it.

So acoustic matching is **new storage and a new safety flow**, not a column added
to a table that already sounds right.

The registry's description said *"Fingerprints used to tell one piece of work from
another"* — which is exactly what an acoustic fingerprint does, and so read as a
promise the columns do not keep. **That description has been corrected** to say
what the table actually holds. The table itself cannot be renamed from here:
migration 004 is frozen, and a rename is a destructive data change, which
`AGENTS.md` puts behind owner approval.

This is the recurring defect of this codebase found one layer out from the code —
a *description* claiming a capability that does not exist, which is harder to
notice than a function that lies, because nothing runs it.

And the safety point stands ahead of the engineering one: a false positive
accuses a creator of copying. The flow that consumes a match is the
safety-critical part, not the matcher, and the registry was already right that
nothing should act on a match until that flow is designed.


## Pass nine: video — and a shape that does not have the blocker

`topic:video-editing`, MIT, above 1,000 stars, pushed in the last year: 14
results. Most are Python pipelines (`moviepy` 14,850, `backgroundremover` 8,019,
`autoclip` 6,384, `FunClip` 6,160) — the familiar shape, and the familiar
blocker: a server the owner has to run.

**Two are not that shape**, and both verified MIT:

| Repository | Stars | Licence | Runs where |
| --- | --- | --- | --- |
| `WebAV-Tech/WebAV` | 2,085 | **MIT** | The customer's browser, on WebCodecs |
| `walterlow/freecut` | 2,046 | **MIT** | The customer's browser, on WebCodecs + WebGPU |

### The register's blocker was a server-side blocker

Every permissive repository added during this sweep — whisper.cpp, whisperX,
vosk, Spleeter, seek-tune, Ghost — is stopped by the same thing. Not its licence:
it needs **a server the owner runs**. That means infrastructure the owner pays
for, a queue, and the customer's media leaving the customer's machine.

A WebCodecs library has none of that shape. The work happens in the browser the
customer already has. **No per-customer cost, no queue, and no upload of a file
that was never meant to leave their device** — which is the same pair of
constraints (cost to the customer, and their work staying theirs) that this
product's rules impose anyway.

So the conclusion at the end of pass six — "licence was the constraint, now
architecture is" — needs qualifying. Architecture is the constraint **for
server-side tools**. There is a whole class of candidate for which it is not, and
this sweep had not looked at it until now, because every earlier category's
leaders happened to be Python.

### What that does not mean

The constraint changes rather than disappears, and the records say so:

- **WebCodecs is not available everywhere.** A browser without it must be told
  the feature is unavailable, not shown an editor that silently does nothing.
- **Video work is heavy on a phone**, and `AGENTS.md` requires mobile layouts to
  work.
- **The vendoring question is unchanged.** No build step and `script-src 'self'`
  means serving a prebuilt bundle from this origin and owning its updates — the
  same decision Excalidraw needs.
- **Age matters here more than elsewhere.** FreeCut was created November 2025, so
  its 2,046 stars were earned in about nine months; a browser-side editor's real
  cost is keeping up with codec and browser changes, and it has not had to yet.
  WebAV was last pushed January 2026 — inside the year, by seven months.

These are answerable without the owner running anything, which is what makes them
different from the questions the server-side candidates raise.

**Worth carrying into the remaining categories: ask where a candidate runs before
asking what it does.** Client-side and server-side are not two implementations of
one capability for this product — they are a free feature and a funded one.


## Pass ten: streaming — a cost that scales with success

`topic:live-streaming` licence-first, MIT and Apache-2.0 separately (they cannot
be OR'd): six results above 800 stars. Applying pass nine's rule — where does it
run — sorts them immediately.

**Server-side, and worse than the earlier server-side candidates:** `ossrs/srs`
(29,145, MIT, C++ media server), `vidgear` (3,721, Apache-2.0, Python),
`Red5/red5-server` (3,418, a Java media server whose topic list still says
`flash` and `flv`).

**Client-side:** `canalplus/rx-player` (932, Apache-2.0, TypeScript) — a DASH/HLS
player. It runs in the browser, but a browser already plays ordinary video with a
`<video>` element; rx-player earns its place only for adaptive streaming with
DRM, which this product does not have.

### "A server the owner runs" was hiding two different costs

Every server-side candidate so far — whisper.cpp, vosk, Spleeter, Ghost — costs
compute **per file, once**. Transcribe a video and the cost is paid and finished.

A media server costs **bandwidth, per viewer, every time**. It is the one shape
where the bill grows with the customer's success: a business whose event goes
well pays more than one whose event nobody watched, and pays it again on every
replay.

That is a materially different thing from "the owner runs a service", which is
the shorthand this document has been using since the speech-recognition pass. It
was accurate and it was hiding the distinction. **For a product whose rule is
that a feature must cost the customer nothing, per-viewer bandwidth is the one
cost that cannot be absorbed by buying a bigger box once.**

### And a blocked record found the same way `topic:paywall` was

`ihmily/StreamCap` — 4,113 stars, verified **Apache-2.0**, second-largest result
in the category — monitors and automatically records live streams from TikTok,
Twitch, YouTube, Bilibili, Douyin, Douyu and Huya.

Every one of those recordings is **somebody else's broadcast**, captured without
their involvement. `AGENTS.md` requires this product to enforce provenance,
consent and anti-clone safety. Shipping this is not a borderline reading of that
rule; it is the case the rule describes.

Recorded as `blocked`, and the block is **on conduct, not licence** — the same
shape as `watermarks-remover`, which is also permissively licensed and also
blocked.

Worth keeping visible for how it presents: legitimate topic, legitimate search,
clean permissive licence, high star count, and **nothing in its metadata flags
it**. Only the description does. That is `topic:paywall` again — a search term
that is right for the capability and wrong for the intent. A sweep that screens
on licence and stars and skips the reading ships this one.
