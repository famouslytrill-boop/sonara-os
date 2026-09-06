# Raising the breadth ladder: $29 / $59 / $109

Review by: 2026-12-06

Written 6 September 2026, on the owner's instruction to be "competitive but
cheaper". Competitor figures are the ones re-surveyed on 5 September in
`2026-09-05-PRICING-STRATEGY.md`, read from the sources cited there.

---

## What changed

| Plan | Was | Now | Yearly (two months free) |
| --- | --- | --- | --- |
| One workspace | $19/mo | **$29/mo** | $290/yr |
| All three | $39/mo | **$59/mo** | $590/yr |
| Team | $79/mo | **$109/mo** | $1090/yr |

**The old Starter $7 / Core $19 / Pro $39 ladder is deliberately untouched.**
Those three have live Stripe prices and are what a visitor sees today. A Stripe
price is immutable and somebody could be paying on one.

## Why this was safe to do in place

Raising a price normally means a fourth ladder and a migration story for existing
subscribers. Not here, and both reasons were checked rather than assumed:

1. **Nobody can be subscribed to these plans.** Their price variables are unset
   in production, so `/api/readiness` lists only `free`, `starter_monthly`,
   `core_monthly`, `pro_monthly` and the quoted package under `checkoutPlans`.
   Checkout for the breadth ladder has never been possible.
2. **No paid signup has completed in production at all** — `SHIP_READINESS.md`
   item 1, still open.

So no existing charge changes and no customer is migrated. This window closes
the moment the owner sets those three variables; after that, a price change is a
new plan key and a supersession, the way `workspace_monthly` supersedes
`starter_monthly` today.

## Where the numbers come from

Each is set against what the customer would otherwise pay for that job, not
against the plan below it.

| Plan | What it replaces | Their price | Ours | We are |
| --- | --- | --- | --- | --- |
| One workspace | Jobber Core, or Podia Mover | $49 | $29 | **59%** |
| All three | Jobber + Podia + Brevo | $107 | $59 | **55%** |
| Team | Jobber Connect (5 users) $139; Housecall Pro Essentials ~$149 | $139–149 | $109 | **73–78%** |

Three things worth stating about those figures.

**"Cheaper" survives at every tier, and the margin is deliberate.** The smallest
gap is Team at 73–78% of its comparators, and Team is also the plan carrying the
most that the comparators do not — all three workspaces, not just field service.

**The claim the pricing page rests on still holds, and is now a rounder
sentence.** All three at $59 against a $107 stack is a little over half. "Half
the stack" was true at $39 against $87 and is true at $59 against $107; it was
*not* true at $39 against $107, which understated us.

**One tier is not cheaper than every competitor in its column, and that is not
hidden.** Growth Studio alone against Brevo Starter at $9, or Brevo Standard at
$18, is more expensive at $29. That comparison is not like for like — Growth
Studio is a control plane over Klaviyo and HubSpot and does not send, which
`docs/market/2026-08-26-PER-PRODUCT-COMPETITOR-REASSESSMENT.md` says plainly —
but the honest reading is that One workspace is priced for the Business Builder
and Creator Studio columns, and is a poor deal bought for Growth alone.

## Why not higher

$59 for all three is 55% of the stack. Going to $79 would be 74% and still
"cheaper", and it was rejected for a specific reason rather than caution: the
comparison is the whole commercial argument, and an argument that needs
explaining stops working. *"They cost $107 between them; all three of ours cost
$59"* is a sentence somebody repeats. At $79 it becomes a discussion.

## Why not lower

`2026-08-11-PRICING-RESTRUCTURE.md` already established the floor, and it is not
about margin:

> **$7 is not a bargain, it is a signal.** Brevo's entry plan is $9 and does one
> of the three columns. A product doing all three for $7 does not read as good
> value; it reads as a product that does not work yet.

$19 for one workspace sat just above that floor. $29 sits comfortably clear of
it while remaining under three fifths of the single-column competitors.

## What the owner has to do, and the trap in it

**A Stripe price is immutable.** The three prices created on 13 August still
exist and still charge $19, $39 and $79. Pointing a variable at one of them
would put "$59/mo" on the pricing page and charge the customer **$39**.

`scripts/verify-stripe-env.mjs` compares the advertised amount against the live
Stripe price and would catch exactly that — but only on a run that has
`STRIPE_SECRET_KEY`, and it *skips* without one, which is every CI run. So the
guard offline is `docs/MANUAL_DASHBOARD_SETUP_FINAL.md`, which no longer prints
the old IDs and says why.

Create three new recurring monthly prices at $29, $59 and $109, and three yearly
at $290, $590 and $1090, with fresh lookup keys. Archive the 13 August three
once the new variables are set.

## What this does not claim

It does not claim these prices convert better than $19/$39/$79. No paid signup
has completed in production, so there is no conversion data for either set, and
inventing some would be the exact failure this codebase keeps finding.

It does not claim the competitor figures will hold. They moved between 28 July
and 5 September — Jobber's monthly Core went $39 to $49 — which is why every one
of them carries a date and a source, and why this document carries a review
date rather than being written as a standing fact.
