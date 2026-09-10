# Pricing strategy — re-surveyed, and what to do about it

Review by: 2026-12-05

> ## Amended 6 September 2026
>
> **The prices in this document were raised the day after it was written.**
> One workspace $19 → **$29**, All three $39 → **$59**, Team $79 → **$109**, and
> the yearly plans $190/$390/$790 → **$290/$590/$1090**. The case is in
> `2026-09-06-PRICE-INCREASE.md` and the steps are in
> `docs/owner/PRICE-CUTOVER-RUNBOOK.md`.
>
> The competitor figures below are unchanged and still sourced. The analysis is
> left as written, because a dated document is a record. What is corrected
> inline is every sentence stating a SONARA price — above all the comparison in
> section 1, which `CLAUDE.md` warns is the kind of thing copied into marketing
> copy. **All three is 55% of the stack, not 36%.**

Written 5 September 2026. Supersedes the figures in
`2026-07-28-COMPETITOR-PRICING.md` and updates the argument in
`2026-08-11-PRICING-RESTRUCTURE.md`. The recommendation in that second document
still stands; the numbers underneath it moved in our favour.

Every competitor price below was read on **5 September 2026** from the sources
cited. A price copied without a date is a price that is wrong later and looks
right forever.

---

## 1 — What the market charges now

| Column | Cheapest credible | Monthly | Annual (per month) |
| --- | --- | --- | --- |
| Business — bookings, quotes, invoices | Jobber **Core** | **$49** | $29 |
| Creator — products, courses, digital sales | Podia **Mover** | **$49** | $42 |
| Growth — lists, campaigns, follow-up | Brevo **Starter** | **$9** | — |
| **The stack** | | **$107** | — |

**The stack is $107 a month, not $87.** The August figure was Jobber $39 +
Podia $39 + Brevo $9. Both of the first two have risen: Jobber's monthly Core is
now $49, and Podia's Mover is $49 monthly against the $42 it advertises on
annual billing.

Three things the headline number leaves out, all of which make the real figure
worse for the customer and better for us:

- **Podia Mover charges a 5% transaction fee.** On $2,000 of digital sales a
  month that is another $100 — more than the subscription. Shaker at $99
  monthly is the plan that removes it.
- **Brevo Starter excludes marketing automation.** Automation begins on
  Standard, from $18. A customer who wants follow-up sequences — which is what
  Growth Studio is for — is not on the $9 plan.
- **Brevo Starter carries Brevo's logo.** Removing it is a $10.80 add-on.

So the honest range is:

- **$107** — cheapest credible stack, monthly billing, entry plans.
- **$116** — the same stack with marketing automation switched on
  (Brevo Standard $18 rather than Starter $9). *Whether the logo add-on is still
  required on Standard was not confirmed and is not included.*
- **$107 + 5% of digital sales** — for anybody actually selling products.

Keep **$107** as the headline. It is the figure hardest to argue with, and a
claim nobody can dispute is worth more than a bigger one somebody can.

### What this does to the comparison

> Jobber, Podia and Brevo cost **$107 a month** between them on monthly billing,
> at their cheapest plans. All three SONARA workspaces cost **$59**.

That is 55% of the stack. *As written on 5 September this said $39 and 36%; the
price was raised on 6 September and the sentence is corrected here rather than
left for somebody to quote.* Against 45% when the August restructure was
written, the comparison is still stronger than it was.

---

## 2 — What was already decided, and is already built

`2026-08-11-PRICING-RESTRUCTURE.md` moved from a **depth** ladder to a
**breadth** one, and the owner applied it on 19 August. The code half is done:

| Plan | Monthly | State |
| --- | --- | --- |
| Free | $0 | Live |
| One workspace | **$29** | **Live** — see the box below |
| All three | **$59** | **Live** |
| Team | **$109** | **Live** |

> ### Closed, verified 10 September 2026
>
> This table said `variable unset` against all three, and the paragraph below it
> said the restructure was *"one owner step away from being live, and has been
> since 13 August."* **Both were out of date, and in our favour.**
>
> Read from the live site rather than from this repository:
>
> - `/api/readiness` reports `checkout: enabled, reason: configured` for **all
>   ten** plan keys — `free`, the three depth plans, the three breadth plans and
>   all three annual plans. `missing.stripe` and `deferred.stripe` are both empty.
> - `/pricing` serves **$0 / $29 / $59 / $109** monthly and **$290 / $590 /
>   $1090** annual. The old $7 / $19 / $39 amounts no longer appear on it.
>
> So `offeredPlanKeys` has swapped ladders, which is what that paragraph was
> waiting on. The breadth restructure decided on 11 August and applied on 19
> August is **live to customers**.
>
> One caveat worth keeping, because it is the opposite failure and easy to
> conflate: six `STRIPE_PRICE_*` variables are marked **Sensitive** in Vercel, so
> `vercel env pull` writes `[SENSITIVE]` and the deploy-time price check reads a
> placeholder rather than a price id. That blocks *verification*, not *checkout*
> — the running application is given the real values.
> `docs/owner/PRICING-STEP-BY-STEP.md` carries the two commands that fix it.

The depth ladder's Starter $7 / Core $19 / Pro $39 keys remain purchasable rather
than withdrawn, so nobody already on one loses it; `offeredPlanKeys` decides what
a new visitor is shown, and it now shows the breadth ladder.

---

## 3 — What was missing, and what this document adds

Four gaps. Two are now closed in code; two are decisions.

### Gap 1 — No annual billing at all. **Closed in code.**

Every competitor in the survey discounts annually. Jobber drops 41% monthly to
annual; Podia drops 14%. We had no annual option, which means:

- We were being compared monthly-to-annual and losing a comparison we win.
- We collected no cash up front and had no annual retention step.

**Added: two months free.** As repriced on 6 September: `$290`, `$590` and
`$1090` against `$348`, `$708` and `$1308` paid monthly — a 16.7% discount.
*Written on 5 September as $190/$390/$790 against $228/$468/$948, at the prices
of that day.*

Why two months free rather than matching Jobber's 41%: the deep discounts in
this market are anchored on much higher monthly prices, where a 40% cut still
leaves a bigger absolute number than our full price. Matching the *percentage*
would give away margin to win a comparison we already win on the absolute
figure. Two months free is the convention a customer recognises without being
told a percentage.

The annual plans stay **off the pricing page** until their Stripe prices exist,
because the monthly twin already sells the same product and an unbuyable card
costs a customer nothing. Their entitlements and allowances are **derived** from
the monthly twin rather than listed again — four separate lists had to agree for
a plan to work, and the last time they did not, seven products advertised plans
that would have answered a paying customer with a 402.

### Gap 2 — Six metered capabilities are priced and charge nobody. **Open.**

`lib/sonara-paid-capabilities.cjs` prices the six things with a real marginal
cost, each against a dated floor, and the release chain fails if a price drops
below its floor.

| Capability | Unit | Price | Floor |
| --- | --- | --- | --- |
| Media generation | GPU second | 0.25 | 0.0747 |
| Live streaming | Viewer gigabyte | 4 | 1 |
| Game engine export | Build minute | 6 | 1.5 |
| 3D processing | CPU minute | 1 | 0.2 |
| Telephony | Message or minute | 3 | 0.8 |
| Payment terminal | Device | 5900 | 5900 |

**That module is required by exactly two files: its own release check and its
own test.** No route, no billing code, no page reads it. It is a price list that
verifies its own margins and sells nothing.

This is the usage layer, and it is a build rather than a decision. The
recommendation for how to build it is in section 4.

### Gap 3 — One product cannot be sold without a human. **Decision.**

`business_builder_one_time` advertises "We quote you". Everything else in the
table is self-serve. If the goal is a business that runs without anybody in the
loop, this is the only line in the price list that contradicts it.

It is not simply a matter of putting a number on it. The plan's own comment
records why it became quoted: it previously carried a live $197 Stripe price
behind a button that advertised no amount, so the first figure a customer saw
was on Stripe's checkout page after committing — and the work's scope genuinely
varies, which is what makes a single self-serve price wrong for it.

So the automated version is **a different product**: a fixed-scope, fixed-price
setup — a named list of what gets done, done the same way every time — rather
than the current open-ended engagement at a quoted price. Three options, and
this is the owner's call:

1. **Retire it.** Cleanest. It is an entitlement key, so anyone already granted
   it keeps access; `quoted` already keeps it off checkout.
2. **Replace it with a fixed-scope package** at a fixed price. Automatable,
   but somebody has to define the scope and it has to be deliverable without
   a person, or it is the same problem with a price on it.
3. **Leave it.** Honest, and it means the business is not fully automated.

### Gap 4 — A stale comparison bound in a test. **Closed.**

`tests/pricing.test.js` asserted Pro stays "under the ~$77 competitor stack the
page compares against". $77 was corrected to $87 on **12 August** — it had mixed
Jobber's annual price with Podia's monthly one — and the test was never updated.
It has now been re-pinned to the figure in this document, with the source.

---

## 4 — The recommendation

**Three layers, and no fourth.**

### Layer 1 — Subscription, priced on breadth

Free / One workspace $29 / All three $59 / Team $109, monthly or yearly.
*Written on 5 September as $19/$39/$79.* Already built. Needs six Stripe Price objects (three monthly, three annual).

### Layer 2 — Usage, sold as prepaid credits rather than metered invoices

For the six capabilities in Gap 2. **Prepaid, not post-paid**, and the reason is
the automation goal rather than a preference:

- A post-paid metered bill can exceed what the customer expected, which produces
  a dispute, which needs a person.
- Prepaid caps our exposure to a provider bill we have already been paid for.
- `tools/agentkit/agentkit/credits.py` already holds a credit model in integer
  minor units, and `lib/sonara-paid-capabilities.cjs` already holds the per-unit
  prices in the same shape. The arithmetic exists; what is missing is the ledger
  and the Stripe top-up.

Nothing here is built yet, and this document does not claim it is.

### Layer 3 — Nothing. Specifically, no lifetime or founding membership

Worth stating because it is the obvious next idea and it is wrong for this
product. A lifetime price is a fixed payment against an unbounded future cost,
and six of our capabilities carry a real per-unit bill. The margin check in the
release chain exists to stop us selling below cost on a single GPU second; a
lifetime membership does the same thing on purpose, across every future second,
and calls it marketing.

If a founding-customer offer is wanted, the safe shape is a **discounted first
year on an annual plan** — bounded, automatable, and it renews.

---

## 5 — What has to be true before any of this takes money

Unchanged from the August document, and still the honest blocker:

**Nobody has completed a paid signup in production end to end.** Every price in
this document can be correct and the path still be untested. `SHIP_READINESS.md`
item 1.

**Three of the six Stripe Price objects exist; three do not.** This document
first said none of them did, which was wrong: `docs/MANUAL_DASHBOARD_SETUP_FINAL.md`
records that the three breadth prices were **created in the live account on
13 August 2026**, with lookup keys `sonara_workspace_monthly`,
`sonara_all_three_monthly` and `sonara_team_monthly`. What is missing for those
three is not the price — it is the three Vercel variables that name it.

So the work is asymmetric, and it matters which is which:

- **One workspace / All three / Team, monthly** — as written: price exists,
  variable unset, one step from live. **That step was taken; verified live
  10 September 2026.** See the box in section 2.
- **The three annual plans** — price does not exist. Two steps: create a yearly
  recurring price at $290, $590 and $1090, then set the variables.

Until each is done, `offeredPlanKeys` keeps the old ladder on the page and the
annual plans off it entirely, which is the correct behaviour and also means none
of this is live.

---

## 6 — What this does not claim

It does not claim these prices convert better. No paid signup has completed, so
there is no conversion data, and inventing some would be the exact failure this
codebase keeps finding.

It does not claim the $107 stack is what every customer pays. It is the cheapest
credible entry stack on monthly billing. A customer selling digital products
pays more, because of Podia's 5% fee; a customer who wants automation pays more,
because Brevo's $9 plan does not include it.

It does not claim the annual discount is optimal. Two months free is a
convention, chosen over a deeper discount for a reason given above, not a figure
derived from elasticity nobody has measured.

## Sources

Read 5 September 2026:

- Jobber — <https://costbench.com/software/field-service-management/jobber/>,
  <https://myquoteiq.com/jobber-pricing-breakdown-2026/>,
  <https://buyersprint.com/2026/04/17/jobber-pricing-2026/>
- Podia — <https://costbench.com/software/lms/podia/>,
  <https://www.schoolmaker.com/blog/podia-pricing>,
  <https://kourses.com/podia-pricing/>
- Brevo — <https://costbench.com/software/marketing-automation/brevo/>,
  <https://www.emailtooltester.com/en/reviews/brevo/pricing/>,
  <https://smtpedia.com/brevo-pricing/>
