# Codex handoff: skills, formulas, strategies, agents

Review by: 2026-12-22

Paste this into Codex, ChatGPT, or any assistant picking up engineering work
here. It is the **method** half of the handoff and it is deliberately not a
status report — `docs/HANDOFF_PROMPT.md` carries the live counts, the route and
table figures, and the recent sprint history, and
`docs/CODEX_TERMINAL_HANDOFF_2026-09-20.md` carries machine bootstrap and the
model registry. Read those for *what the repository is*. Read this for *how to
work in it without shipping a lie*.

Every figure below was read out of the repository on 22 September 2026. Where a
number is derived by a release check, the check is named so you can re-derive it
rather than trust this file.

---

## 1. The one rule that produces most of the work

The recurring defect here is not broken code. It is **a signal that reports
success without being true**: a test passing against a stub while the real path
is broken, a gate asserting a guarantee that stopped holding, a check satisfied
by an empty list, a report whose parser silently stopped matching.

Several have been found and fixed. Assume more exist. Concretely, in the last
week: a founder-facing count published as covering all screenshot intake while
four verified records sat outside the population it counted; a coverage gate red
since the module landed and invisible because another gate exits the chain
first; eleven live comments explaining decisions by a dependency count that had
changed; and a file-type sniffer that guessed `audio/mpeg` from two bytes once
in every 2,053 random inputs, feeding an authorization decision.

**The corollary that matters most:** a correct conclusion resting on a premise
that has changed is more dangerous than a wrong conclusion, because nothing
breaks and the next person inherits a reason that will not hold the next time it
is leaned on.

---

## 2. The six defect shapes

From `.claude/skills/checks-that-cannot-lie/SKILL.md` (374 lines — read it
before writing any check). Each shape is named after a case that actually
happened here.

| # | Shape | The case |
| --- | --- | --- |
| 1 | Passing by measuring nothing | A crawl that reported every page honest while crawling zero pages |
| 2 | Measuring a different population than claimed | A "runtime" scan naming `server.js` and `routes/` while the queries it hunted were in `lib/` |
| 3 | A value fetched into a decision and never used | `consent_scope` selected on every voice job and compared to nothing — being in the `select` list is what made it look checked |
| 4 | Absent read as false, or as zero | `Number(null)` is `0` and finite, which made unpriced services read as free across 23 columns |
| 5 | An exemption whose reason has expired | A form-reachability exemption reading "no page displays `location_zones`" while a page had displayed them all along |
| 6 | A check too weak to catch the bug it was written for | A per-file column comparison that the file's own eight other mentions hid the bug from |

Two additions earned since that file was written:

- **7. A pattern that matches prose as if it were code.** `select=*` counted 33
  occurrences until comments were stripped; the true figure is 21, and five of
  the extras were inside comments explaining why a file *avoids* `select=*`. Use
  `withoutComments` / `withoutSqlComments` / `withoutHashComments` from
  `lib/sonara-comment-stripping.cjs`. Never hand-roll a stripper: a two-pass
  block-then-line stripper reads `/*` inside a `//` comment as an opener, which
  erased 57% of one route file before matching.
- **8. A check whose own bookkeeping hides its subjects.**
  `scripts/report-unreferenced-modules.mjs` reported all thirteen of its
  accounted entries as stale on the run that introduced them, because naming a
  module in its register names it in a file under `scripts/`, which it searches.
  It now excludes its own path.

---

## 3. Falsification discipline

**Before you trust a check green, make it fail.** Break the thing it tests,
watch the check go red *by name*, put it back. A check that has never failed is
a check nobody has verified, and writing one is worse than writing none because
now there is a green light over the problem.

The procedure, including the traps:

1. **Copy the file aside, never `git checkout --`.** A checkout takes unrelated
   working-tree changes with it. `cp file "$SCRATCH/f.bak"`, then
   `md5sum file > "$SCRATCH/f.md5"`, and verify restoration with `md5sum -c`.
2. **Read the real exit code.** `$?` after a pipe reports the pipe's status.
   Redirect to a file, then read `$?`, then grep the file.
3. **Falsify in both directions for a two-sided register.** An unaccounted
   entry must fail, *and* an entry whose subject is gone must fail.
4. **Pick a subject that does not already have the property you are removing.**
   I tested a stale-allowance path against a file that genuinely does write,
   watched it pass, and nearly declared the check broken. It was right.
5. **Prove absence by mtime, not content.** A restore rewrites a file even when
   the bytes match, so comparing content cannot tell "never touched" from
   "touched and repaired".
6. **Two green runs is not evidence.** The `audio/mpeg` sniffer was green 2,052
   times out of 2,053. When a probabilistic test fails, measure the rate first,
   not last.

Record every check you add in `docs/SPRINT_LOG.md` with what you broke to prove
it works.

---

## 4. The skills

Ten in `.claude/skills/`, each a `SKILL.md`, plus two shared ones under
`.ai/shared/`. They are procedures, not documentation.

| Skill | Lines | Fires when |
| --- | --- | --- |
| `checks-that-cannot-lie` | 374 | Writing or auditing any check, gate, test or report |
| `researching-screenshot-tools` | 174 | A tool arrives as a screenshot, social post or package name |
| `adding-a-record-page` | 168 | Any customer-facing page backed by a Supabase table |
| `writing-sonara-marketing-copy` | 165 | Words going in front of a customer |
| `comparing-sonara-to-a-competitor` | 161 | A competitor named beside a price or a feature claim |
| `reviewing-an-outside-repository` | 150 | Before adopting, adapting or recommending external code |
| `writing-a-social-post-for-sonara` | 144 | A post, hook, caption or carousel |
| `source-grounded-research` | 95 | A recommendation that rests on external factual evidence |
| `governed-batch-convergence` | 83 | Large multi-batch source material to integrate |
| `diagnosing-sonara-customer-flows` | 31 | A failing signup, checkout, booking or record save |
| `.ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md` | 94 | Shared with non-Claude assistants |
| `.ai/shared/SOURCE_GROUNDED_RESEARCH_SKILL.md` | 139 | Shared evidence rules |

The repository also keeps machine-readable strategy catalogues in
`lib/sonara-agent-skill-strategies.cjs`: 5 `AGENT_PATTERNS`
(`single_shot`, `iterative_react`, `planner_executor`, `reflexive`,
`verifier_gated`), 11 `SKILL_STRATEGIES` and 10 `BUSINESS_AI_SKILLS`. Those are
product surfaces, not instructions to you — do not confuse them with the
`SKILL.md` procedures above.

---

## 5. The agent authority contract

`lib/sonara-agent-authority.cjs` is the AGENTS.md safety rule expressed as code.
It is the single most important module to understand before touching anything
that acts.

**Seven categories require owner approval**, each with the reason in the module:

| Category | Why |
| --- | --- |
| `refunds` | It moves money back out of the business. |
| `payout_changes` | It changes where the business's money goes. |
| `legal_or_policy_publishing` | It publishes wording the business is held to. |
| `customer_campaigns` | It sends something to customers that cannot be unsent. |
| `proof_or_review_publishing` | It publishes something presented as a customer's own words. |
| `security_settings` | It changes who can reach what. |
| `destructive_data_changes` | It removes or overwrites records that may not come back. |

**Seven named actions may run unattended**, and the reason is always that the
act is not the consequence: `draft_content`, `summarise_records`,
`suggest_next_step`, `categorise_record`, `prepare_report`,
`check_data_quality`, `draft_reply`.

**Anything else goes to the owner.** `classifyAction("something_nobody_registered")`
returns `requiresOwnerApproval: true`, category `unrecognised`, with the reason
"This is not an action the rules recognise, so it goes to you rather than being
guessed at." An unnamed action returns category `unnamed`.

The default is deny **deliberately**: a classifier that fails open fails open
exactly when somebody adds a capability, which is the moment nobody is reading
that file.

**Autonomy breaker:** `BREAKER_FAILURES = 3` within `BREAKER_WINDOW = 10`
removes an agent from the unattended list. `OWNER_APPROVAL_ROLES` is
`owner`, `admin`, `business_owner`.

### The four modules, and the one path that executes

- `lib/sonara-agent-runner.cjs` — `createRunner`. **Classify, decide, run,
  record.** Call this rather than calling `classifyAction` yourself: a page that
  asks the gate and then does the work regardless is a gate that was never
  there, and that is what this replaced.
- `lib/sonara-agent-queue.cjs` — what happens between "an agent proposed this"
  and "it ran". A refused run becomes a row in `agent_pending_actions` carrying
  the action's own inputs; approving it calls the runner again with an approval
  attached. **The gate is asked again rather than bypassed**, and the
  classification is re-derived from the action type rather than read off the row.
- `lib/sonara-agent-action-log.cjs` — writes each run to `agent_action_logs`,
  which is organization-scoped. The nineteen `entity_*` tables key on
  `entity_id` and `entities` has no `organization_id`, so they are the wrong
  home for an organization's run.
- `/owner/agent-activity` — the read side, and where approval happens.

**Approving and running are two different things, and the page says which
happened.** Approving an action nothing implements writes `unimplemented` and
tells the owner nothing was changed. The one thing a button here must never do
is report a job as done when it was not.

`scripts/verify-supabase-contract.mjs` checks all of this on every release, so
weakening the rule fails the build rather than shipping quietly.

---

## 6. The formulas

### Paid capability margin floors

`verify:margins` refuses a price below its floor. Seven capabilities, price /
floor per unit:

| Capability | Price | Floor | Unit |
| --- | --- | --- | --- |
| `media_generation` | 0.25 | 0.0747 | gpu_second |
| `live_streaming` | 4 | 1 | viewer_gigabyte |
| `game_engine_export` | 6 | 1.5 | build_minute |
| `three_d_processing` | 1 | 0.2 | cpu_minute |
| `telephony` | 3 | 1.4 | message_or_minute |
| `campaign_email` | 0.15 | 0.07 | email |
| `payment_terminal` | 5900 | 5900 | device |

### Market opportunity score

`scoreMarketOpportunity` in `lib/sonara-market-intelligence-registry.cjs`.
Positive dimensions, each clamped: demand evidence 0–25, willingness to pay
0–20, strategic fit 0–20, underserved need 0–15, differentiation 0–10, channel
access 0–10. Penalties: delivery complexity 0–15, compliance risk 0–15.

    score = clamp(round(positives - penalties), 0, 100)

Bands: **≥75 prioritize, ≥55 validate, ≥35 watch, ≥0 hold.**

Note the deliberate default: absent dimensions read as `0`, the columns are
`integer not null default 0`, and an unscored opportunity therefore scores 0 and
recommends `hold`. That is the conservative direction and is correct here — but
it means the API cannot distinguish "scored zero" from "never scored", so do not
present a 0 as a measurement somebody made.

### Coverage floor

`scripts/verify-coverage-floor.mjs`: `FLOOR = 0.35` per runtime file,
`REGRESSION_TOLERANCE_POINTS = 2` for a registered file, and blind-check
minimums `MINIMUM_FILES = 150` / `MINIMUM_LINES = 25000`. Current measurement:
295 runtime files, 58,828 countable lines, 93.3% overall, one file under the
floor and it is the one registered with a reason.

### Handoff budget

`HANDOFF_BUDGET_BYTES = 128 * 1024` in `scripts/generate-handoff-prompt.mjs`.
The generator embeds the newest `docs/SPRINT_LOG.md` entries newest-first until
the budget is hit and fails the release above it. `docs/HANDOFF_PROMPT.md` is
currently ~131 KB of a 131,072-byte budget, self-trimming.

### MPEG audio frame length

In `lib/sonara-multipart.cjs`, because a bare frame sync is not a magic number:

    Layer I:       (floor(12000 * bitrate / sampleRate) + padding) * 4
    Layer II/III:   floor(144000 * bitrate / sampleRate) + padding

A sync is believed only when the buffer holds a whole frame **and** the next
frame begins where this one says it will. Before that rule, 974 of 2,000,000
random 64-byte buffers read as `audio/mpeg`; after it, zero.

### Derived counts, never typed

The release chain length, the shipped-source notice population, the test-file
count and the register size are all **derived and gated**. Do not edit the
number in a document — regenerate it:

    pnpm run fix:doc-counts            # rewrites derived figures in docs/
    pnpm run fix:proprietary-notice    # recomputes the notice population

Current: **58 chain commands**, 296 shipped source files carrying the notice,
363 test files, 269 unique GitHub targets on the register, 36 of them carrying a
reciprocal licence and every one at a status that keeps its source out of what
customers are served.

---

## 7. Two-sided accounted lists

The pattern to copy whenever a check needs an exemption. A list is two-sided
when **an unaccounted subject fails** *and* **an entry whose subject no longer
exists fails**. A wrong reason inside an exemption is worse than no exemption,
because it is what the next person reads instead of checking.

Twelve checks use it today, including `scripts/report-orphan-tables.mjs`,
`scripts/report-unreferenced-modules.mjs`, `scripts/verify-dependency-claims.mjs`,
`scripts/verify-doc-script-paths.mjs` and `scripts/verify-applied-migrations.mjs`.
Read `report-orphan-tables.mjs` first; it does both directions cleanly.

Each entry's reason must be something you **verified**, with the file you opened
and the date. "Reviewed and approved" is not checkable. If you cannot say which
file you opened, say so in the comment instead of asserting it.

---

## 8. External tools and code

`data/open-source-tools.ts` holds every external repository reviewed — licence,
risk, how far integration may go, what is forbidden. Check the record before
adapting anything.

Four decisions, always stated separately (from the screenshot-research skill):

1. **Research value** — is there an idea worth learning from?
2. **Code/licence permission** — may SONARA legally use it in the proposed way?
3. **Architecture fit** — where would it run if adopted?
4. **Production enablement** — is it actually configured and executing now?

`researched`, `adapter built`, and `enabled in production` are three different
states. `/free-launch-stack` renders them as "Research candidate", "Adapter
built, not enabled" and "Available in SONARA" respectively — the middle one
exists because OpenTelemetry sat as a "research candidate" for a day while eight
of its packages were production dependencies and a tested adapter existed.

Facts that come up repeatedly:

- **No licence declared is all rights reserved.** Absence is not permission and
  nobody here can grant what the author has not.
- **A reciprocal licence triggers on network use**, so a hosted product is the
  case AGPL/SSPL/OSL are written for. Set `reciprocalLicense` from *reading* the
  licence, never from a substring search.
- **Cost is a constraint of the same weight as licence.** A free tier is a
  price, not a licence, and it changes at the vendor's discretion.
- **A star count is not a safety signal.** A 44.3k-star "Claude skill library"
  here turned out to be CC BY-NC, which forbids commercial use; a repository
  whose post called it open source was Elastic License 2.0, which forbids
  offering the software as a hosted service.

---

## 9. Verification

One command, and it is the only signal worth reporting:

    pnpm run verify:launch

58 commands, ~4,911 tests. Also required before any push:
`pnpm install --frozen-lockfile`, `pnpm audit --audit-level moderate`,
`pnpm run lint`, `pnpm test`, `pnpm run build`.

**`verify:gates` alone is not a valid signal.** It depends on `test:coverage`
having run first in chain order, so running it standalone produces failures that
mean nothing. Run the chain.

**pnpm only.** No npm, no `npm audit fix`, no `package-lock.json`. The one
documented exception is a globally installed CLI, which touches neither this
repository's dependency tree nor its lockfile.

**`engines.node` is `24.x` and on Vercel that field *is* the production
runtime**, guarded by `tests/the-runtime-ci-tests-is-one-production-may-run.test.js`.
If `pnpm` prints `Unsupported engine`, your local Node is wrong — not the field.

---

## 10. Traps that have cost real time

- **A `finally` does not survive a signal.** Five tests mutated tracked files
  and restored them in a `finally`; an interrupted run left a migration
  truncated to 33 unterminated `execute '` statements and a baseline document
  missing the pointer its own gate reads, and `git add -A` would have committed
  both. Tests that must break something break a copy —
  `createScriptSandbox` in `tests/helpers/script-sandbox.cjs`.
- **Never `git add -A` here.** Stage the files you meant to change, by name.
- **Do not start the OpenTelemetry SDK in the test suite's own process.**
  `HttpInstrumentation` patches `http` on start and the shutdown flush can hang
  once the suite has pushed hundreds of requests through it. The one case that
  needs it runs in a SIGKILL-bounded child.
- **Mocha merges positional paths *into* `.mocharc.json`'s `spec`** rather than
  replacing it. Use `--config .mocharc.targeted.json` for a targeted run, or a
  13-assertion evidence file ends up containing 4,779 tests.
- **A merged remote branch is deleted**, so a later `--force-with-lease` fails
  with `stale info` against the leftover local ref. `git remote prune origin`
  first.
- **Parallel branches collide silently on hand-maintained counts.** Two commits
  each raised `EXPECTED_FILES` from 287 to 288; git merged two identical-looking
  edits with no conflict and the value that landed was one short. This is why
  the counts are regenerated rather than typed.
- **Two figures I put in comments this week were never measured** ("1,000+" was
  498; "363" was 359 in a function that counted differently). Both were caught
  pre-commit by the same correction: run the thing and read the number rather
  than reusing one that happens to be in front of you.

---

## 11. Owner-reserved

Do not decide these; surface them. Merge authority and production deployment are
the owner's alone.

- Whether `public/sonara-scroll.js` gets a customer-facing licence grant — that
  is legal publishing.
- Whether the `?v=` asset token is bumped, at the cost of invalidating every
  cached asset plus the service-worker `VERSION`.
- Whether the nine production dependencies added for OpenTelemetry and
  OpenFeature are wired in or removed — `docs/SHIP_READINESS.md` has the
  measurement and the meter-ordering hazard.
- Supabase PITR, which blocks the backup/restore drill.
- The checkout and campaign SLO numbers.
- `LICENSE` wording now the repository is deliberately public.

And from `AGENTS.md`, never negotiable: service-role secrets stay server-only;
AI calls go through Provider Gateway or an approved server-side adapter;
provenance, consent and anti-clone safety are enforced; no raw card data or CVV;
sounds, voice, haptics, SMS, push and email alerts are off or explicitly
user-controlled by default; and audit or security checks are not weakened
without the exact reason recorded in `SECURITY_NOTES.md`.
