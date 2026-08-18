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
