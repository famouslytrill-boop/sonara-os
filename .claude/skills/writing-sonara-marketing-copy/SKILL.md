---
name: writing-sonara-marketing-copy
description: Write or rewrite customer-facing copy for SONARA Industries — landing pages, product overviews, pricing pages, feature sections, onboarding text, emails. Use whenever words are going in front of a customer, or when asked to improve, tighten, or rewrite copy that already is. Covers the positioning that is fixed rather than chosen, the five release checks that read public copy, and the two claims in this product that are checked against code.
---

# Writing SONARA marketing copy

Most copy advice is about persuasion. In this repository the hard part is
different: **the product already has positioning, and several claims a
copywriter would treat as free text are checked against code on every release.**
Write a price into a sentence here and a test compares it to what Stripe
charges. Say a repository is "integrated" and a gate reads the register and
disagrees.

So this is less "how to write" and more "what is already decided, what is
checked, and where the interesting failures have actually been".

Read `AGENTS.md` first. This skill assumes it.

## What is not yours to choose

`AGENTS.md` fixes the positioning. It is not a starting point to improve on:

- **SONARA Industries** is the parent company. **SONARA One** is the platform.
  **Business Builder**, **Creator Studio** and **Growth Studio** are the
  products. The public message is **Build. Create. Grow.**
- Business Builder: create, launch, run and manage a business — guided systems,
  payments, bookings, records, operational intelligence.
- Creator Studio: organise, protect, publish, monetise and grow creative work.
- Growth Studio: attract customers, leads, fans, referrals, reviews and revenue.

Two standing rules from the same file, both of which a good copywriter breaks by
instinct:

> Use plain customer-facing language. Avoid overusing internal engine names or
> "AI" in public copy.

> Do not reintroduce retired public names in active UI, navigation, metadata,
> manifests, tests, or launch docs.

The retired names are in `docs/archive/legacy-names.md` and
`scripts/check-no-legacy-public-copy.mjs` fails the release if one comes back.
Historical context belongs in that archive file, not in a sentence somebody
reads today.

## The claims that are checked against code

This is the part that makes writing here different, and both checks exist
because the failure already happened.

### A price in a sentence is compared to what we charge

`tests/a-price-in-prose-is-the-price-we-charge.test.js` holds a register of
sentence shapes and compares each stated amount to `lib/sonara-stripe-plans.cjs`.
Write "All three SONARA workspaces cost **$39**" and it fails, because they cost
$59.

Four prices drifted in two days before that test existed. The one worth
remembering: `docs/pricing/2026-09-05-PRICING-STRATEGY.md` carried the $39
comparison the day after the price became $59 — and `CLAUDE.md` names that
document as the one to read *before writing a comparison into marketing copy*. A
stale price in the document people copy from does not stay in that document.

**If you are quoting an old price on purpose**, say so in the line itself. The
test recognises a dated record — "as written on", "as repriced on", "corrected",
"amended", "no longer true" — because the honest correction of a price is a
sentence that contains the old one. Marking a line historical is a claim that it
*is* historical; do not use it to smuggle a live price past the check.

### Saying we ship something we only reviewed

`data/open-source-tools.ts` holds 227 reviewed repositories, most of which this
product does not ship. `scripts/check-research-lab-public-copy.mjs` and
`scripts/check-blocked-repo-claims.mjs` fail the release when public copy says a
reviewed repository is "integrated", "bundled" or "powered by".

The predecessor of that check watched `app/research-lab/**` and passed every
time it ran. **None of those pages was ever served** — that Next.js application
could not build and was deleted. The guard was green and pointed at the wrong
surface, which is worse than no guard, because a green check reads as a covered
risk. If you add copy on a new surface, the check does not automatically follow
it there.

## The other three checks that read copy

- `scripts/check-public-claims.mjs` — general overclaiming.
- `scripts/check-growth-studio-copy.mjs` — Growth Studio's own description.
- `scripts/report-stale-claims.mjs` — every document making a dated claim must
  carry a review date, and nothing may be past it.

That last one is why market and pricing documents open with `Review by:`. A
figure without a date is a figure that is wrong later and looks right forever.

## Writing it

The craft below is adapted from the source named at the bottom. It is good
advice and it is not SONARA-specific; the SONARA-specific part is above.

**Clarity beats cleverness.** If the reader has to decode the line, it has
failed. This is not tidiness — unclear positioning costs conversions.

**Benefits, then features.** A feature is what it does. A benefit is what that
means for somebody running a business on a Tuesday.

**Specific beats vague.** "Save time on your workflow" says nothing. "Send an
invoice from the booking that created it" is a sentence somebody recognises.

**Customer language beats company language.** Say bookings, invoices, customers,
payouts. Do not say entities, records-with-provenance, or the name of a module.

**One page, one action.** Decide what the reader should do next before writing
the first line.

### The SONARA-specific trap in all of that

"Specific beats vague" pushes toward numbers, and numbers here are checked or
must be dated. Before writing a figure into copy, know which kind it is:

| Kind of number | Where it must come from |
| --- | --- |
| A plan price | `lib/sonara-stripe-plans.cjs`, and it will be compared |
| A competitor price | `docs/market/`, dated and sourced |
| A count of anything in the repository | derived, never typed — see `scripts/verify-doc-counts.mjs` |
| A performance or outcome claim | somewhere real, or do not write it |

There is no conversion data for any plan, because **no paid signup has completed
in production** (`docs/SHIP_READINESS.md` item 1). Copy must not imply otherwise.

## What copy may never do on its own

`AGENTS.md` puts these behind owner approval, and no amount of "the campaign is
ready" changes it:

> Do not automate refunds, payout changes, legal/policy publishing, customer
> campaigns, proof/review publishing, security setting changes, or destructive
> data changes without owner approval.

Writing a campaign is fine. **Sending one is not**, and neither is publishing a
review, a testimonial or a proof claim. `lib/sonara-agent-authority.cjs` is that
rule as code and `lib/sonara-agent-runner.cjs` is the only path that executes.
If a marketing task ends in something being sent or published, it ends at the
owner.

## Before you call it done

1. Read it aloud. If a sentence needs a second pass to parse, rewrite it.
2. Check every number against the table above.
3. `pnpm run verify:gates` — the five copy checks are in it.
4. If you added a price sentence to a document, consider whether
   `tests/a-price-in-prose-is-the-price-we-charge.test.js` should know the shape.
   A price the register does not match is a price nothing is watching.

## Attribution

Adapted 7 September 2026 from **Marketing Skills** by Corey Haines —
<https://github.com/coreyhaines31/marketingskills> — MIT, Copyright (c) 2025
Corey Haines. Its `copywriting`, `copy-editing` and `product-marketing` skills
are the source of the craft section above.

What was deliberately **not** carried over: that library builds a
`.agents/product-marketing.md` context document by interviewing the user about
positioning and audience. SONARA's positioning is fixed in `AGENTS.md` and its
market figures are dated in `docs/market/`, so drafting a second, undated
statement of who we are would create exactly the kind of uncheckable second copy
this repository keeps finding and deleting.
