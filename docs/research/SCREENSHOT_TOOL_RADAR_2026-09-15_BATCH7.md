# Screenshot tool radar — Batch 7, 15 September 2026

Review by: 2026-12-15

Nine repositories arrived as social-media screenshots across two submissions.
Seven are new records in `lib/sonara-screenshot-tool-radar-batch7.cjs`. Two
already carry verdicts and did not get second ones.

Every licence below was read from the file in a shallow clone, not from a badge.
Every count was measured, not described.

---

## The finding that shaped this batch

Two of the submitted repositories are advertised as curated API and playbook
directories. They are affiliate placement lists.

| Repository | Links in markdown | Carrying an affiliate parameter | Share | Code |
|---|---|---|---|---|
| `cporter202/openclaw-api-list` | 78,913 | 78,216 | **99.1%** | `?fpr=p2hrc6` |
| `cporter202/software-income-playbooks` | 78,884 | 78,186 | **99.1%** | `?fpr=p2hrc6` |

One code, byte for byte, across both. That is evidence of a single arrangement
rather than an inference about two repositories.

**The folder names are not counts.** `openclaw-api-list` has nineteen category
directories named `automation-apis-4825`, `lead-generation-apis-3452`,
`social-media-apis-3268`, `ai-apis-1208` and so on. Each contains **exactly one
file**. The whole repository is 25 files.

### The same code reaches a record we already had

`cporter202/lead-gen-api-stack` is already recorded in Batch 2 as
"provider-discovery reference only; no code/content adoption and no
scraping/outreach automation without independent compliance review" — the right
verdict, reached without this measurement. Measured now: **5 of its 7 links
carry `?fpr=p2hrc6`.**

That record is not rewritten here, because a repository with two verdicts has
none. This note is the cross-reference.

### And the half that stops it becoming a story about a person

`cporter202/generative-ai-arbitrage`, recorded in Batch 4, carries **89 links
and zero affiliate parameters.**

So the pattern covers three of the four repositories from that account and is
not a property of the account. The measurement is the finding; the author is
not. Both halves are stated because reporting only the first would be the same
defect this codebase is named for — a true sentence arranged to support a
conclusion it does not carry.

---

## Verified repository records

### DwarfStar — `ivanfioravanti/ds4-metal` — MIT — research only

LICENSE read: `MIT License, Copyright (c) 2026 The ds4.c authors, Copyright (c)
2023-2026 The ggml authors`. A full Apache-2.0 text is bundled at
`licenses/Apache-2.0.txt`, so the tree carries Apache material alongside the MIT
grant; both permissive, both compatible. Measured 2,202 files — 1,256 `.txt`,
638 `.json`, 60 `.c`, 36 `.py`, 35 `.cuh` — a small C core surrounded by data.

Its README is unusually candid: *"The code is self-contained and deliberately
narrow, not a general GGUF runner"*, and *"This project would not exist without
llama.cpp and GGML"*. Supported hardware, quoted: Metal *"on Macs with 96 GB or
more"*, CUDA where *"the DGX Spark is our main gaol"* (sic), ROCm on Strix Halo.

**The licence permits everything this project would want. The architecture
permits none of it.** A Vercel function has no GPU, no persistent disk and a
documented 300-second lifetime. Its only possible shape is the owner-hosted
worker pattern in `docs/architecture/EXTERNAL-SERVICES.md`, which makes the real
cost a machine somebody buys — not a per-token bill.

### Ballast — `tight-line/ballast` — MIT — research only

LICENSE read: `MIT License, Copyright (c) 2026 Tight Line LLC`. 186 files, 69
`.go` and 69 `.yaml`. A Kubernetes operator that right-sizes requests and limits
from observed history and *applies* them, at admission time and on running pods
via in-place resize (Kubernetes 1.35+).

Clean licence, careful engineering, **nothing to attach to**. There is no
cluster, no pod, no VPA object and no admission webhook in this project. Sits
beside the Batch 2 `kubeopt/kubeopt` record under the same rule: infrastructure
recommendations are advisory and never authorize mutation.

The transferable idea is the measurement rather than the code — size from
observed usage rather than from what somebody reserved, which is the same
argument as sourcing a cost floor from real vendor prices.

### ClawFlows — `nikilster/clawflows` — licence ambiguous — license-gated

The README has a `License` section whose entire content is the word `MIT`.
**There is no LICENSE file anywhere in the tree**, checked by name. So the MIT
text is absent: no named copyright holder, no permission grant, no warranty
disclaimer — which is to say, nothing to comply *with*.

Recorded as license-gated rather than blocked. "The author wrote MIT
informally" and "the author said nothing" are different positions, and
flattening them would overstate the finding.

Little to adopt regardless: 141 of 179 files are markdown, 25 are bats shell
tests. Same shape as the twelve-starter repository that turned out to be 57
markdown files and nothing executable.

### `cporter202/openclaw-api-list` — no licence — **blocked**

No LICENSE file, no README licence statement. Under `CLAUDE.md` the absence of a
licence is not permission: all rights reserved. Plus the 99.1% affiliate
measurement above.

**No internal review can unblock it** — there is no licence to review, and only
the author can grant one. And passing an undisclosed affiliate link to a
customer who trusts the product is a disclosure problem before it is a licence
problem.

### `cporter202/software-income-playbooks` — no licence — **blocked**

Same position, same code, 98 files. Posted to a beginners' group as "a great
launchpad for turning useful data into real projects and products". Treat it and
`openclaw-api-list` as one artefact under two labels.

### Vulture — `vulture-osint-automation-tool/vulture` — no licence — **blocked**

Seven files: `vulture.py`, `credharvest.py`, `passForge.py`, `api_keys.py`,
`user_agents.py`. The Dehashed module *"will make a request to the Dehashed API
which will return with data breaches associated with the target. This will
include emails and passwords that have been leaked"*, with the key written into
`api_keys.py`. The dorking module, in its own README's words, *"is a brute-force
style program that will eventually alert Google bot detection. If detection is
alerted, you must wait for a lockout cooldown or change IP."*

**Two independent refusals, either sufficient.** The licence one is mechanical:
no LICENSE file, no rights granted. The conduct one does not depend on it —
SONARA One sells operations software to small businesses and has no product
surface for third-party reconnaissance.

This is **not** a position on authorised security testing. If credential-exposure
checking is ever wanted as a customer feature, that is a consented, contracted
provider integration and not this.

### OpenContext — `0xranx/OpenContext` — three licence declarations — license-gated

Found by reading every manifest rather than trusting the badge:

| Location | Declares |
|---|---|
| `LICENSE` | MIT text, `Copyright (c) 2025 OpenContext` |
| root `package.json` | `Apache-2.0` |
| `crates/opencontext-node/package.json` | `ISC` |

All three permissive, none reciprocal, so the worst case is an attribution
obligation somebody guessed at rather than a prohibition — hence medium risk.
But which governs is unanswered, and this is the same principle the register
already applies to duplicate records, turned on the licence itself.

242 files, published as `@aicontextlab/cli`. Honest about cost: *"no extra agent
subscription"*, so not a metered tier that can be withdrawn. Development-time
only — a context store for coding agents has no place near customer data, and
stored context grants no authority.

---

## Submitted again, already decided — not re-recorded

| Repository | Where it lives | Verdict |
|---|---|---|
| `ai-sdlc-framework/ai-sdlc` | `data/open-source-tools.ts`, 9 Sept 2026 | Apache-2.0 core with a separately licensed enterprise tier; reference only. Re-cloned 15 Sept: licence and `engines` (node >=22, pnpm) unchanged. |
| `n8n-io/n8n` | `data/open-source-tools.ts`, enriched 10 Sept 2026 | Sustainable Use License v1.0; embedding into this paid hosted product forbidden by two independent clauses. Risk critical. |

The AI-SDLC record is worth re-reading for one reason beyond licence: its
`package.json` test script is dozens of named fail-closed gates —
`test:dor-gate`, `test:drift-gate`, `test:coverage-gate`,
`test:attestation-sign-gate` — which is the same architecture as this
repository's own 46-command release chain. That is the idea worth having, and it
is already ours.

---

## What this batch did not change

- **Nothing is installed, imported, executed or enabled.** All seven records
  carry `enabledInProduction: false` and `humanReviewRequired: true`, and the
  batch's production execution count is **0**.
- **Batch 7 joins the latest-intake surface, not the legacy aggregate**, for the
  reason that page already gives: the aggregate API contract is not changed
  silently when new evidence arrives.
- **No SONARA authority moved.** Any idea taken from an external agent workflow
  still passes `lib/sonara-agent-authority.cjs`, and unknown consequential
  actions still fail closed to owner review.

## The one thing worth building from all nine

Nothing. Four are blocked or licence-gated, two are permissive with no place to
run, one is a local developer trial, and the two genuinely aligned projects were
already reviewed. The useful outcome of this batch is the measurement that stops
two affiliate catalogues being cited as curated research — and a record so the
next person meeting them does not redo it.
