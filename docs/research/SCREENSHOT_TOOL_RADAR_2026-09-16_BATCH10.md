# Screenshot tool radar — batch 10

Measured: 2026-09-16
Review by: 2026-12-16

Seven batches of screenshots arrived across a single hold the owner asked for:
**68 images, 8 files and one pasted research block.** Nothing was processed until
the hold was released. This is what survived verification and, more usefully,
what did not.

It is numbered 10 rather than 8 because `capabilityBatch8` and `designBatch9`
already exist in `routes/sonara-requested-repositories-routes.cjs` and mean
something else. A card in that same file already tells readers so.

## The short version

| Outcome | Count |
| --- | --- |
| Repositories verified and recorded | 10 |
| Already in `data/open-source-tools.ts`, re-measured, agreed | 4 |
| Refused on conduct rather than licence | 5 |
| Services, vendors and content artefacts | 14 |
| Installed, executed, or enabled in production | **0** |

Every licence below was read from `git clone --depth 1` on 16 September 2026.
None was taken from a badge, a README claim, or a search-result snippet.

## Three descriptions did not survive measurement

This is the batch's recurring theme and the reason the reviewing skill says to
count rather than describe.

**`ran-isenberg/awesome-serverless-blueprints`** was submitted as
"production-ready architectural blueprints using the AWS CDK … clean
architecture, rigorous testing patterns, and high-performance setups like
Rust-based Lambda resolvers."

Measured: **13 files, of which exactly one is content** — `README.md`. The rest
are a licence, CODEOWNERS, a Makefile, `package.json`, a markdown linter config,
and three workflows that lint the list. There is no CDK, no tests and no Rust.
That description belongs to the repositories the README links to. Reference-only
as a fact rather than a caution: there is nothing here to take.

**`brandonhimpfen/awesome-serverless`** was submitted as "a curated directory".

Measured: 20 files, and **no `LICENSE`, `LICENCE` or `COPYING` file at all**. No
licence is not a permissive licence. The absence is not permission, and nobody
here can grant what its author has not.

**`beekeeper-studio/beekeeper-studio`** arrived as a Google result calling it "an
open-source, cross-platform SQL editor".

Measured: **GPL-3.0 for the Community Edition, plus a commercial EULA** governing
everything under a `src-commercial` directory, of which the clone contains one.
It is open source and also partly not, and a snippet cannot carry that.

## One licence would have been read wrongly from its own first line

`aws-samples/serverless-samples` opens:

> Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Stopping there records it as closed. The body grants use without restriction,
and — checked by grep rather than by eye — it contains **no "above copyright
notice … shall be included" clause**. That makes it **MIT-0**, not MIT: more
permissive, not less, and no attribution required at all.

## The ten records

| Repository | Licence, read from the file | Status |
| --- | --- | --- |
| `elementalsouls/Claude-BugHunter` | MIT for `*.py`/`*.sh`; CC BY 4.0 for `*.md`, wordlists, regex catalogs, rubrics | `research_only` |
| `beekeeper-studio/beekeeper-studio` | GPL-3.0 community + commercial EULA for `**/src-commercial` | `developer_only` |
| `serverless/examples` | MIT | `curated_reference` |
| `localstack/serverless-examples` | MIT | `curated_reference` |
| `aws-samples/serverless-samples` | MIT-0 | `curated_reference` |
| `ran-isenberg/awesome-serverless-blueprints` | MIT | `reference_only` |
| `brandonhimpfen/awesome-serverless` | **none declared — all rights reserved** | `reference_only_no_license` |
| `farhanashrafdev/90DaysOfCyberSecurity` | MIT | `reference_only` |
| `AdguardTeam/AdGuardHome` | GPL-3.0 | `research_only` |
| `iptv-org/iptv` | Unlicense **for the repository, not for the streams it lists** | `blocked` |

### Two records that needed each other

`serverless/examples` and `localstack/serverless-examples` were described in the
submitted research in almost identical words, which would have produced one
record for two divergent bodies of work. Measured: they share **63 of 105
top-level directories** and each holds **42 the other does not**. The deciding
fact is the tip commit — `serverless/examples` is dated 2026-09-09, LocalStack's
is dated **2020-04-26**. Six years without a commit, in an examples repository
for a fast-moving cloud API, is a snapshot of an old API.

## Refused on conduct, not on licence

Three of these five are permissively licensed. Filing them as licence problems
would imply a relicence could unblock them, and it could not.

1. **Email/username OSINT suites and a real-time OSINT dashboard** (flight
   tracking, CCTV, satellites, Telegram). AGENTS.md permits security tooling only
   against systems SONARA owns or is explicitly authorized to assess. The target
   of an email-or-username sweep is by construction somebody who did not ask.
   Both are MIT; it changes nothing.
2. **Watermark and provenance-metadata removers.** AGENTS.md requires SONARA to
   *enforce* provenance. Creator Studio's claim is that a customer can prove
   authorship of their own work; shipping the removal of that proof contradicts
   the product.
3. **Routing a coding agent's model calls through a consumer chat web session**,
   advertised as needing no API key. A terms question before a technical one, and
   it bypasses Provider Gateway, which AGENTS.md makes the boundary for every
   model call.
4. **The jailbreak and detection-evasion sections of two prompt cheat sheets** —
   DAN, STAN, DUDE, Developer Mode, "How to Trick Detection". The rest of both
   sheets is unremarkable and duplicates skills already here, so nothing is lost
   by declining the whole artefact.
5. **"Web paywall to bypass the 30% app store fee."** A platform-rules question,
   and the platform decides how it lands. The failure mode is a customer's
   business losing its listing.

## Four already in the register, re-measured, all four agreed

A confirmation is evidence. Recorded so a reader can see the second reading
happened and does not perform a third.

| Repository | Register says | Re-read says |
| --- | --- | --- |
| `owasp-noir/noir` | MIT | MIT, © 2022 HAHWUL |
| `volcengine/OpenViking` | AGPL-3.0, reciprocal, high | GNU AGPL v3 |
| `simplifaisoul/osiris` | MIT, blocked | MIT, © 2026 simplifaisoul |
| `kamranahmedse/developer-roadmap` | custom, personal use only, blocked | confirmed verbatim |

The `developer-roadmap` record notes that its licence file is lowercase
`license`, which is why fetching `LICENSE` or `LICENSE.md` 404s and a quick check
concludes there is no licence at all. This session hit that exact trap before
reading the note — which is the argument for writing findings down.

## What this batch actually changed in the product

The intake's one real engineering outcome came from **OWASP Noir's premise**
rather than from Noir itself. Noir is a compiled Crystal binary (`shard.yml`:
v1.3.1, Crystal ~> 1.19), so it cannot run in a Vercel request process whatever
its MIT licence permits. Its premise — *hunt every endpoint in your code, expose
shadow APIs* — was worth taking.

Applied to this repository: the page manifest declares **308** routes and the
server answers **558**. The 250-route difference included `/staff/location`,
`/admin/subscriptions`, `/account/security/two-factor`, `/growth/unsubscribe` and
fourteen legal documents, and no check here examined any of them.

That produced `lib/sonara-route-surface.cjs`,
`scripts/verify-route-surface.mjs` (the 48th release-chain command),
`tests/a-route-nobody-declared-still-answers.test.js`, and
`docs/owner/LEGAL-URL-DECISION.md`. A SONARA-owned implementation of the idea,
not another dependency — which the intake skill says is often the useful outcome
of research.

## Services and content, recorded as references

Fourteen entries, including **Slang** (paid 24/7 phone answering for
restaurants — the closest direct competitor in seven batches), JumpCloud, Toad,
IDERA, IONOS, ByteByteGo's twelve security domains, a DXC white paper, and a
24-vendor AI sales stack.

Two notes that apply across all of them:

- **A hosted service with a free tier is a price, not a licence**, and not one of
  these screenshots carried a price — so none can become a figure in
  `docs/pricing/` or `docs/market/`, which require a dated source per number.
- Vendor case-study claims — "operational costs cut by 65%", "over 1 billion
  daily requests", "trusted by 1,200+ restaurants", "join 1,000,000+ readers" —
  are quotable as attributed claims and are not figures. Each traces to a
  marketing page citing another marketing page.

## Unresolved, and staying that way

An **agent inspection harness** claiming 32 repeatable inspections against any
agent, surfacing where behaviour drifts from expected alignment over time. It is
the most interesting idea in the whole intake and the least resolvable: it
arrived as a screen recording of a social post inside another screenshot. No
owner or repository can be established from those pixels, and guessing one into a
permanent register is the thing the intake skill forbids outright. It stays a
lead.

## Two files flagged back to the owner

An **invoice PDF** and a **2012 gang-codes PDF** arrived inside the batch with no
product context. Neither was opened, extracted, quoted or committed. An invoice is
a financial record; the second has no business use here. Both were flagged as
probably misfiled, and no content from either enters this repository.
