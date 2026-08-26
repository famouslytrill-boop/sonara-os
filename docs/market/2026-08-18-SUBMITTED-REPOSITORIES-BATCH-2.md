# Twenty-eight submitted repositories, and what their licences actually say

Reviewed 18 August 2026. Review by: 2027-02-18.

Submitted together with the instruction to "insure all technology is free and
open source". **They are not, and the ways they are not divide into three groups
that need different decisions.** Every licence below was read from the GitHub
API's detected `license.spdx_id` on the date above, not from a README and not
from memory. Star counts and last-push dates are from the same read.

Full records are in `data/open-source-tools.ts`; this document is the summary and
the reasoning that does not belong in a per-record note.

---

## The headline

| Group | Count | What it means for a hosted commercial product |
| --- | --- | --- |
| No licence declared | 3 | **All rights reserved.** Nothing may be copied. |
| Reciprocal (copyleft) | 6 | Free and open source, and adopting one obliges releasing SONARA's source. |
| Licence unresolved | 3 | GitHub could not classify it. Read the file before deciding. |
| Permissive | 16 | MIT, Apache-2.0 or Unlicense. Usable subject to architecture and cost. |

Twenty-seven records were written for twenty-eight submissions:
`boxyhq/saas-starter-kit` was already in the register, already carried further
than a fresh review would have taken it. The duplicate-slug check refused the
second record, which is that check doing its job.

---

## Three declare no licence at all

| Repository | Stars | Last push |
| --- | --- | --- |
| `ripienaar/free-for-dev` | 132,144 | 2026-08-17 |
| `SadServers/sadservers` | 2,966 | 2026-08-13 |
| `philtabor/Multi-Agent-Deep-Deterministic-Policy-Gradients` | 380 | 2021-04-08 |

`CLAUDE.md` states the rule and it is worth restating: **the absence of a licence
is not permission**, and nobody here can grant what an author has not.

The first of these is the most-starred repository in the batch — three times the
next — and the one with the least permission attached. That combination is the
whole lesson: **popularity is not a licence.** A repository 13,871 people have
forked is still one nobody may copy from.

There is a real distinction inside this group. The MADDPG *algorithm* is
published research and is not its author's to restrict; that particular
*implementation* is. Reading a paper and copying a file are different acts.

## Six are reciprocal

| Repository | Licence | Note |
| --- | --- | --- |
| `figranium/figranium-templates` | AGPL-3.0 | Network use is itself the trigger |
| `figranium/figranium` | GPL-3.0 | |
| `figranium/figranium-mcp` | GPL-3.0 | |
| `ikergarcia1996/Self-Driving-Car-in-Video-Games` | GPL-3.0 | |
| `flox/flox` | GPL-2.0 | A tool, not a dependency — see below |
| `nautechsystems/nautilus_trader` | LGPL-3.0 | Weak copyleft: linking is permitted |

These **are** free and open source in the strict sense. The obligation is the
point: incorporating one into this hosted product obliges releasing this
product's source under the same terms. That is a decision only the owner can
make, and it is not an engineering trade-off.

Two distinctions worth keeping:

- **The AGPL closes the door the GPL leaves open.** Running a GPL project as a
  separate service reached over HTTP does not trigger the obligation. For
  `figranium-templates`, which is AGPL-3.0, it does — that arrangement is
  precisely what the AGPL was written for. So the register marks it `blocked`
  where the plain-GPL siblings are `reference_only`.
- **Using a GPL tool to build software does not make the software GPL.** The
  obligation follows the code you ship, not the compiler you ran. `flox` is
  therefore usable by anyone working here and is not a dependency of the product.

**An organisation is not a licence.** The four figranium repositories carry three
different licences — GPL-3.0, MIT and AGPL-3.0 — across one org. Checking one
repository tells you nothing about its siblings. The MIT one, `n8n-nodes-figranium`,
is a permissive wrapper whose useful half is the GPL service it calls; the MIT
buys nothing.

## Three could not be classified

`Unity-Technologies/ml-agents`, `NirDiamant/GenAI_Agents` and `PostHog/posthog`
return `NOASSERTION`. That is a prompt to read the file, not a verdict either way,
and all three are recorded `needs_license_review`.

PostHog is the instructive one: it is **MIT for most of the tree and its own
enterprise terms for parts of it**. "PostHog is MIT" is true of most files and
false of the repository. If code is ever taken, the question is which licence
covers that exact path — there is no repository-level answer.

## Five fail the freshness rule

Reviewed repositories here are expected to have been created or updated within
the last year.

| Repository | Last push |
| --- | --- |
| `philtabor/Multi-Agent-...` | 2021-04-08 |
| `kovidomi/game-reversing` | 2023-04-05 |
| `ikergarcia1996/Self-Driving-Car-...` | 2024-01-01 |
| `aiwaves-cn/agents` | 2024-09-26 |
| `async-labs/saas` | 2025-03-21 |

Each says so in its own record rather than being quietly dropped.

---

## The word "agents" did a lot of work here

Eight repositories in this batch are named `agents` or match on it, and they mean
at least three unrelated things:

1. **Task agents that act on a business's behalf** — what SONARA has.
   `lib/sonara-agent-authority.cjs` gates seven categories behind owner approval.
   `cloudflare/agents`, `openai/openai-agents-python` and `microsoft/Agents` are
   in this family.
2. **Reinforcement-learning policies** — `philtabor/MADDPG`,
   `Unity-Technologies/ml-agents`, and `Self-Driving-Car-in-Video-Games`. Nothing
   in this product trains a policy.
3. **Prompt and skill definitions for coding assistants** — `wshobson/agents`.
   Changes how somebody works *on* this codebase; ships nothing to a customer.

A batch assembled by keyword will contain things the keyword only appears to
connect. Recorded because the cost of the confusion is adopting an unrelated
dependency, and the register is where that gets caught.

## What is genuinely relevant, and why none of it is a dependency

Three have real product fit:

- **PostHog** — Growth Studio already models touchpoints, experiments and
  attribution that says when it is not established. This is a thing SONARA does.
  What stops it is not the licence: session replay and event capture put customer
  behaviour into a third party, and `hand_entered` exists on `growth_touchpoints`
  precisely so a typed-in touchpoint cannot be counted as a measured one. Wiring
  in an analytics vendor is the opposite decision, and it is the owner's.
- **LiveKit Agents** (Apache-2.0) — a business taking bookings by phone is a real
  fit and the most expensive one to serve: bandwidth per participant per minute,
  which grows with the customer's success. The same shape already flagged against
  live streaming. It also lands on rules that already exist — a synthetic voice
  resembling a real person needs a consent record whose *scope* covers that
  capability, which this product now enforces.
- **BoxyHQ** (already registered) — names the gap this product has: SAML SSO and
  SCIM directory sync. SONARA has organizations, memberships, roles and grants;
  it has no federated identity.

Everything else is blocked by the same structural fact recorded in
`docs/architecture/EXTERNAL-SERVICES.md`: **this runtime is Express CommonJS on
Vercel serverless with no build step.** Chakra UI, the Nuxt template and Open SaaS
need a bundler. Cloudflare's agents need Durable Objects. The Python frameworks
need Python. None of that is a licence problem and none of it is solved by one.

## The two that bear on "add skills to Claude"

`wshobson/agents` (MIT, 38,898 stars) and `wasp-lang/open-saas` (MIT, which ships
its own `AGENTS.md`, skills and a Claude Code plugin) are the two submissions that
answer that part of the request directly. Both are prompt and configuration files
rather than runtime code, so nothing about this repository's shape fights them.

The conclusion drawn from reading them is that **the form is worth adopting and
the files are not.** A general-purpose "code reviewer" skill would say nothing
about pnpm-only, the twenty-four-command release chain, that a check must be made
to fail before it is trusted, or that absent is not false. Two skills were written
into `.claude/skills/` on that basis, both derived from work in this repository
rather than from any submitted file:

- `adding-a-record-page` — the eight-file sequence and the six ways the release
  chain refuses an incomplete one.
- `checks-that-cannot-lie` — the six shapes of the recurring defect, each with the
  case in this repository that produced it.
