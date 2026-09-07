---
name: writing-a-social-post-for-sonara
description: Draft, format or critique a social post for SONARA Industries — LinkedIn, Instagram, X, YouTube, a short-form script, a newsletter opener. Use when asked for a post, a hook, a caption, a carousel outline, or feedback on a draft. Covers the hook and formatting craft, the scoring rubric, why the numbers in a post are the risky part here, and the line between drafting a post and sending one.
---

# Writing a social post for SONARA

The craft here is borrowed and works. What changes for SONARA is **what a post
is allowed to assert**, and that is where the whole risk sits: social copy is
short, which means every sentence is a claim with nothing around it to qualify.

Read `AGENTS.md` first. Two of its rules land directly on this skill.

## The line you do not cross

> Do not automate refunds, payout changes, legal/policy publishing, **customer
> campaigns**, **proof/review publishing**, security setting changes, or
> destructive data changes without owner approval.

**Drafting a post is work. Posting it is a customer campaign.** So is scheduling
it. A post quoting a customer, a rating, a testimonial or a result is *proof
publishing* twice over. Both go to the owner —
`lib/sonara-agent-authority.cjs` is that rule as code, and
`lib/sonara-agent-runner.cjs` is the only path that executes. Hand back a draft;
do not hand back a published post.

> Sounds, voice announcements, haptics, SMS, push, and email alerts must be off
> or explicitly user-controlled by default.

Relevant here because "cross-post it and notify the list" is one instruction
away from a post, and the list half is not yours to send.

## The numbers problem, which is specific and real

Short copy pulls toward a number, because a number is the fastest way to sound
specific. Almost every number available to a SONARA post is one of these:

| Tempting number | Why not |
| --- | --- |
| "10,000 businesses run on SONARA" | **No paid signup has completed in production** — `docs/SHIP_READINESS.md` item 1 |
| "Save 12 hours a week" | No measurement exists. Inventing one is the exact defect `CLAUDE.md` describes |
| "$39 for all three" | It is $59. `tests/a-price-in-prose-is-the-price-we-charge.test.js` checks prose; a post is not checked, which makes it *more* dangerous, not less |
| "350k followers proved this works" | Somebody else's audience. See Attribution — the source library is built on its author's own results, and those are not ours |
| "Cheaper than Jobber" | Fine, with the dated figure from `docs/market/`. Not fine from memory |

The plan prices as they stand: **One workspace $29, All three $59, Team $109**,
monthly. `lib/sonara-stripe-plans.cjs` is authoritative; that line is not.

**A post is the one surface with no automated check on it.** Everything in
`docs/` is swept by five copy checks and a price test. A caption is swept by
nothing, so the discipline has to come from here.

## Writing the post

### 1. One post, one idea

If the draft has two ideas it is two posts. This is the single highest-yield
edit and the one most often skipped.

### 2. The hook is two lines

- **Line 1** — around 40 characters. Something specific or unexpected. Not a
  question.
- **Line 2** — around 40 characters. Contradicts, reframes or undercuts line 1.

Write six variants across different angles before choosing: number-led,
contrarian, a concrete before-and-after, a named mistake, a plain statement of
the problem, and the outcome stated flatly.

**Adapted deliberately:** the source library requires a "How I" or "I" statement
and a digit in every hook, on clickbait principles. That is right for a personal
brand and wrong for SONARA Industries, which is a company and whose own rule is
*plain customer-facing language*. Keep the tension and the specificity; drop the
first-person-guru framing and do not manufacture a digit to satisfy a formula —
see the table above for why a manufactured digit is the expensive kind of wrong.

### 3. Body

Short lines. One idea per line, with white space between. Say the concrete thing
first and the category second: *"Send the invoice from the booking that made
it"* before *"operational intelligence"*.

Avoid the words `AGENTS.md` tells us to avoid: internal engine names, and "AI"
used as a selling point rather than a description. Never a retired product name
— `docs/archive/legacy-names.md` lists them, and
`scripts/check-no-legacy-public-copy.mjs` fails the build if one reaches the
repository.

### 4. Close

One action. The post says what to do next, once.

## Scoring a draft

Score out of 10 across five axes, two points each. Say the score and then say
the single edit that would raise it most.

1. **Hook** — would the first line stop a scroll on its own?
2. **One idea** — or is it two posts?
3. **Specific** — a concrete thing somebody recognises, not a category.
4. **Truthful** — every claim traceable to code, a dated document, or something
   that actually happened. **This axis is a veto**: a post that fails it scores
   zero regardless of the other four.
5. **Voice** — plain, calm, customer-facing. Not hype, not engine names.

**Adapted deliberately:** the source `post-scorer` pulls the author's real post
history through **Apify** and scores drafts against what performed. That is a
better rubric than a static one, and it is not available here. Apify is a hosted
paid service, it is in no record in `data/open-source-tools.ts`, and `CLAUDE.md`
is explicit that *a hosted service with a free tier is a price, not a licence*,
and that a shipped feature resting on one stops working at the vendor's
discretion. A rubric that silently scores nothing when a key is missing is worse
than a plain one. So: a plain one, and it says what it measures.

There is also no SONARA post history to learn from. When there is, that is the
moment to revisit this section — and the honest version will read the real
numbers, not an average somebody remembers.

## Before handing it back

1. Every number checked against the table above.
2. No retired names, no "AI" as the selling point.
3. Nothing published, nothing scheduled, nothing sent.
4. If it quotes a customer or a result, say plainly that it needs owner approval
   before it goes anywhere.

## Attribution

Adapted 7 September 2026 from **Social Media Skills** by Charlie Hills —
<https://github.com/charlie947/social-media-skills> — MIT, Copyright (c) 2026
Charlie Hills. Its `hook-generator`, `post-writer`, `post-formatter` and
`post-scorer` skills are the source of the hook shape, the formatting rules and
the idea of scoring against a rubric.

Two things were deliberately **not** carried over, both noted in that
repository's record in `data/open-source-tools.ts`:

- **The Apify dependency**, for the reason given in the scoring section.
- **The audience framing.** That library is built around its author's own
  results — the banner reads "the 17 skills behind 350k followers and 100M+
  views a year". The frameworks travel; the proof does not. Repeating those
  figures inside SONARA copy would be somebody else's evidence presented as
  ours, which is proof publishing, which `AGENTS.md` puts behind owner approval
  even when the proof is real.
