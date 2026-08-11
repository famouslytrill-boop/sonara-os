# Pricing and packaging — analysis and recommendation

Written 11 August 2026, against the competitor survey of 28 July 2026 in this
directory and against what the product can actually do today.

**Nothing here is applied.** `STRIPE_PLANS` still reads Free / Starter $7 / Core
$19 / Pro $39. AGENTS.md keeps billing changes owner-approved, and a live price
is the last thing to change on a guess. This is the case for changing it and the
numbers behind the case.

---

## What is wrong with the current structure

Not the prices. The shape.

Free / Starter / Core / Pro prices **depth** — how much of one thing you get.
The product's shape is **breadth**: three workspaces, each replacing a different
tool a small operator already pays for. Business Builder replaces a jobs-and-
invoices tool. Creator Studio replaces a digital-products tool. Growth Studio
replaces an email-and-campaigns tool.

A customer who needs one of the three is being sold a tier. A customer who needs
all three is being sold the same tier at a higher number. Neither is being told
the thing that is actually true about this product, which is:

> The stack you are replacing costs $77 a month at the cheapest credible option
> in each column. Jobber $29 + Podia $39 + Brevo $9.

That sentence is the entire commercial argument, and the current price list does
not make it.

## What the survey says

| Column | Cheapest credible | Typical |
| --- | --- | --- |
| Business — bookings, quotes, invoices | Jobber Core $29 | $29–$59 |
| Creator — products, courses, digital sales | Podia Mover $39 | $39–$179 |
| Growth — lists, campaigns, follow-up | Brevo Starter $9 | $9–$20 |
| **The stack** | **$77** | $77–$258 |

Two things follow.

**$7 is not a bargain, it is a signal.** Brevo's entry plan is $9 and does one
of the three columns. A product doing all three for $7 does not read as good
value; it reads as a product that does not work yet. The Starter price is
below the floor at which a small business believes the software is real.

**$39 is the wrong ceiling.** Pro at $39 is half the stack it replaces. There is
room above it, and nothing in the current list uses it.

## Recommendation

Four plans, priced against what each one replaces rather than against each
other.

| Plan | Monthly | What it is | Replaces |
| --- | --- | --- | --- |
| **Free** | $0 | One workspace, real records, no invented data, capped volume | a spreadsheet |
| **One workspace** | **$19** | Any one of Business Builder, Creator Studio, Growth Studio, in full | one tool at $9–$39 |
| **All three** | **$39** | All three workspaces, one login, one bill | the $77 stack |
| **Team** | **$79** | All three, plus the staff portal, per-person schedules, time entries and assigned tasks | the stack plus a scheduling tool |

Four changes from today, and the reason for each.

**Starter $7 → One workspace $19.** Priced just under Mailchimp's $20 and just
below the middle of the single-column range. It is a real price for a real tool,
and it stops the cheapest paid plan reading as a trial.

**Core $19 disappears.** It was the middle of a depth ladder that is being
replaced by a breadth one. Anybody on it moves to One workspace at the same
price, which is why $19 is the number: **no existing customer pays more.**

**Pro $39 → All three $39.** Same price, honest name. The bundle is half the
$77 stack, and saying so is the pitch.

**Team $79 is new.** The staff portal, per-person schedules, time entries and
assigned tasks already exist and are given away. A business with employees is a
different customer from a sole operator, and $79 still undercuts Housecall Pro
plus Podia plus Brevo by a wide margin.

### What this does to the argument

The pricing page can say one thing and have it be true:

> Jobber, Podia and Brevo cost $77 a month between them, at their cheapest
> plans. All three SONARA workspaces cost $39.

## What has to be true before any of this is applied

**The positive subscribed-user test.** `SHIP_READINESS.md` item 1: nobody has
completed a paid signup in production end to end. Changing prices before that is
changing a number on a path nobody has walked.

**Stripe prices created and verified.** `scripts/verify-stripe-config.mjs`
compares `STRIPE_PLANS` amounts against live Stripe prices and currently skips
when `STRIPE_SECRET_KEY` is absent. New price objects have to exist in Stripe
first, and the amounts have to match, or checkout sends a customer to a price
that is not there.

**Existing subscribers.** Anybody on Core $19 moves to One workspace at $19 —
the same charge — and anybody on Starter $7 is grandfathered or moved with
notice. This is the part that is a decision rather than a calculation, and it is
the owner's.

**The entitlement keys.** `business_builder`, `creator_studio` and
`growth_studio` each already gate their workspace. "All three" and "Team" need
entitlement keys that do not exist yet, and the catalog's paid products resolve
against those keys — so this is a code change, not only a Stripe change.

## What this does not claim

It does not claim these prices convert better. Nobody has run a paid signup, so
there is no conversion data to reason from, and inventing one would be the exact
failure this codebase keeps finding. The argument here is about **structure and
comparison**, both of which are checkable today: the survey figures are cited
and dated, and the claim "the bundle is half the stack" is arithmetic.
