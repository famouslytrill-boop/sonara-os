---
name: comparing-sonara-to-a-competitor
description: Write or update a comparison between SONARA and a competing product or stack — pricing pages, comparison tables, market documents, sales copy. Use whenever a competitor is named alongside a price, a feature claim, or a "cheaper than" statement. Covers where the figures must come from, why every one carries a date, and the three stale comparisons this repository has already shipped.
---

# Comparing SONARA to a competitor

A comparison is the highest-risk sentence in this product's marketing. It is the
line most likely to be copied into somewhere nobody re-checks, it goes stale
without anybody touching it, and it names another company.

`CLAUDE.md` is explicit about where the numbers come from:

> `docs/market/` and `docs/pricing/` — what competing stacks cost and what we
> actually replace, each figure dated and sourced. Read these before writing a
> comparison into marketing copy; **the numbers in them are checkable and the
> ones in your memory are not.**

That last clause is the whole skill. A competitor price you recall is a
competitor price that was true once.

## The three that already went wrong

Not hypotheticals. Each shipped.

1. **`~$77` outlived its correction.** `tests/pricing.test.js` pinned Pro under
   "the ~$77 competitor stack the page compares against". The figure was
   corrected to $87 on 12 August — it had mixed Jobber's annual price with
   Podia's monthly one — and the test was never moved. A stale bound in a test
   is worse than one in prose, because it reads as verification.

2. **"All three cost $39" the day after they cost $59.** The comparison sentence
   in `docs/pricing/2026-09-05-PRICING-STRATEGY.md`, in the document `CLAUDE.md`
   names as the one to read before writing a comparison.

3. **The check written for that sentence could not see it.**
   `tests/a-price-in-prose-is-the-price-we-charge.test.js` originally treated a
   line beginning `>` as a historical record. The canonical comparison is
   *written as a blockquote*, so reverting it to $39 left the suite green. Found
   by falsification before it shipped, and the reason that file now says a line
   is historical because it says so, not because of how it is indented.

## Where each figure comes from

| Figure | Source | Checked by |
| --- | --- | --- |
| A SONARA plan price | `lib/sonara-stripe-plans.cjs` | `tests/a-price-in-prose-is-the-price-we-charge.test.js` |
| A competitor price | `docs/market/`, with the date it was read and the URL | nothing automatic — the date is the check |
| "the stack" total | the sum of the dated competitor entries | `tests/pricing.test.js` |
| A review date | the document's own `Review by:` line | `scripts/report-stale-claims.mjs` |

**Nothing verifies a competitor's price for us.** No test can; it lives on
somebody else's site. What the repository enforces instead is that the figure
carries a date and a source, so a reader can tell how old it is. That is why
every market document opens with when it was read and closes with the URLs.

## Writing one

### 1. Read the current figures, do not recall them

`docs/market/` and `docs/pricing/`, newest first. If the newest is past its
`Review by:` date, re-survey before writing — `report-stale-claims.mjs` will
fail the release anyway.

As surveyed on 5 September 2026: Jobber Core **$49/mo**, Podia Mover **$49/mo**,
Brevo Starter **$9/mo** — a **$107** stack. Against All three at **$59**, which
is 55% of it. Those numbers move; the documents are authoritative, not this
paragraph.

### 2. Compare like with like, and say when you are not

The August survey put the stack at $87 by mixing one product's annual price with
another's monthly. Pick one billing period and hold it across every column.

Three things the headline number leaves out, all recorded in
`docs/pricing/2026-09-05-PRICING-STRATEGY.md`: Podia Mover charges 5% on digital
sales, Brevo Starter excludes marketing automation, and Brevo Starter carries
Brevo's logo. Leaving them out understates the gap in our favour, which is the
safe direction — but state the range rather than implying the cheapest number is
what everyone pays.

### 3. Take the claim nobody can argue with

The strategy document chose $107 over $116 deliberately:

> Keep **$107** as the headline. It is the figure hardest to argue with, and a
> claim nobody can dispute is worth more than a bigger one somebody can.

A comparison that needs explaining stops working. The reason All three is $59
rather than $79 is the same reasoning: *"They cost $107 between them; all three
of ours cost $59"* is a sentence somebody repeats.

### 4. Say where we are not cheaper

`docs/pricing/2026-09-06-PRICE-INCREASE.md` records that One workspace at $29 is
**more expensive** than Brevo Starter at $9 for somebody who only wants Growth.
The document says so in its own text rather than leaving it to be discovered.
Do the same. A comparison that hides its weakest column is the one a customer
finds first.

Also true, and easy to overclaim past: Growth Studio is a control plane over
Klaviyo and HubSpot and **does not send**
(`docs/market/2026-08-26-PER-PRODUCT-COMPETITOR-REASSESSMENT.md`). Comparing it
to a sender on price alone is not like for like.

### 5. Date the sentence you just wrote

Every competitor figure gets the date it was read and the URL it came from. A
price copied without a date is a price that is wrong later and looks right
forever.

## What a comparison may never claim

- **That our prices convert better.** No paid signup has completed in
  production (`docs/SHIP_READINESS.md` item 1), so there is no conversion data
  for any plan, ours or theirs.
- **That a reviewed repository ships with the product.**
  `scripts/check-blocked-repo-claims.mjs` reads `data/open-source-tools.ts` and
  fails on it.
- **A competitor's feature you did not check.** Their marketing page is a claim
  too. If you cannot cite where you read it and when, leave it out.

Publishing a comparison as a customer campaign, or as proof, needs owner
approval — `AGENTS.md`, and `lib/sonara-agent-authority.cjs` enforces it.

## Attribution

Adapted 7 September 2026 from **Marketing Skills** by Corey Haines —
<https://github.com/coreyhaines31/marketingskills> — MIT, Copyright (c) 2025
Corey Haines. Its `competitors` and `competitor-profiling` skills are the source
of the comparison structure.

What was deliberately **not** carried over: that library gathers competitor
pricing live and builds a positioning matrix from it. Here the figures live in
dated documents under `docs/market/` on purpose, because the failure this
project actually had was not a missing comparison — it was three that were
written once and then quietly stopped being true.
