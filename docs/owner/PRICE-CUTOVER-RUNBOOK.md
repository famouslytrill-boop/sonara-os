# Moving the live pricing page to $29 / $59 / $109

Review by: 2026-12-06

Written 6 September 2026. The prices and the case for them are in
`docs/pricing/2026-09-06-PRICE-INCREASE.md`; this is only how to get from what
is live now to what the code already holds.

---

## What actually happened, added 8 September 2026

**Steps 1, 3 and 5 were done. Step 2 was not, and step 4 was not.** The code
deployed, the three monthly variables were set, and the pricing page swapped
ladders — it now advertises $29 / $59 / $109 and no longer offers Starter, Core
or Pro. But no Stripe price at $29, $59 or $109 was ever created: read from
`acct_1TRSqj0dKtlEU3lA` on 8 September 2026, the account holds thirteen prices
in its entire history and the closest are the 13 August three at $19 / $39 / $79.

So the three variables point at prices charging the old amounts, and
`assertPriceMatchesAdvertised` in `lib/sonara-billing.cjs` refuses every
checkout with `price_mismatch`. Nobody is charged the wrong amount. Nobody can
buy anything either.

**This is exactly the trap named under "The trap, stated before the steps"
below, and step 4 is the step that catches it.** Step 4 did not run, and without
`STRIPE_SECRET_KEY` the script skipped the comparison and exited 0 — so nothing
reported a problem. `--require-live` was added on 8 September 2026 to make that
impossible; step 4 below now uses it.

`docs/owner/SETUP-STEP-BY-STEP.md` section 1 is the recovery, in four steps.

---

## Where this starts

Read from the live site and the repository on 6 September 2026, not recalled.

| | State |
| --- | --- |
| The page today | Free, **Starter $7**, **Core $19**, **Pro $39**, Team (shown, not buyable), Business Builder setup (quoted) |
| `/api/readiness` `checkoutPlans` | `free`, `starter_monthly`, `core_monthly`, `pro_monthly`, `business_builder_one_time` |
| The code holds | Free, **One workspace $29**, **All three $59**, **Team $109**, and the three yearly plans |
| Active subscribers | **None, on any plan currently sold** |
| Deployed commit | `eebc80c` — behind `main`, so the new plan table is not deployed either |

**Nobody is subscribed to anything on sale.** `docs/SHIP_READINESS.md` records
the two charges that ever happened: both the owner's, both on prices now
`active: false`, one refunded and one failed for insufficient funds. So there is
no migration, no grandfathering decision and no proration question. That is the
whole reason this is a cutover rather than a project — and the window closes the
moment somebody subscribes.

---

## The three pathways, and why one of them is chosen

### A — Cut over in one step *(chosen)*

Create six Stripe prices, set six variables, deploy. `offeredPlanKeys` swaps the
ladders by itself: the old three drop off the moment their replacements can be
bought, and the new ones appear. Nothing to migrate, because nobody is on the
old plans.

### B — Stage monthly first, yearly later

Also supported, and no extra work to allow: the yearly plans carry
`hiddenUntilBuyable`, so they stay off the page entirely until their own prices
exist. Worth choosing only if you want to watch the monthly swap land before
committing to six prices instead of three. It costs one extra deploy.

### C — Archive the old prices first

**Do not.** A superseded plan drops off the page only when its *replacement* can
be bought. Archive Starter, Core and Pro before the new ladder is live and the
page keeps showing all three, each saying checkout is not configured — a pricing
page with nothing purchasable on it. Archiving is the **last** step, not the
first.

---

## The trap, stated before the steps

**A Stripe price is immutable.** The three prices created on 13 August 2026 still
exist and still charge **$19, $39 and $79**. Pointing
`STRIPE_PRICE_ALL_THREE_MONTHLY` at the 13 August price would put **$59/mo** on
the pricing page and charge the customer **$39**.

Two things catch that, and it is worth knowing which runs when:

- `scripts/verify-stripe-env.mjs` compares every advertised amount against the
  live Stripe price — **only on a run that has `STRIPE_SECRET_KEY`. It skips
  without one, which is every CI run.** Step 4 below is where you run it with
  the key, and it is the only step that proves the amounts agree.
- `tests/dashboard-setup-doc.test.js` fails if
  `docs/MANUAL_DASHBOARD_SETUP_FINAL.md` prints an amount that disagrees with
  the plan table. That is the offline half, and it runs on every release.

---

## The steps

### 1. Get the code deployed

The new plan table is on `main` and production serves `eebc80c`. Merge the open
pull request and let Controlled Production Deployment run. **Do not create any
Stripe price yet** — a variable set against undeployed code does nothing useful
and makes step 4 ambiguous.

Verify: `curl -s https://sonaraindustries.com/api/health` reports the new commit.

### 2. Create six Stripe prices

All recurring, USD, on the existing products.

| Variable | Interval | Amount | Suggested lookup key |
| --- | --- | --- | --- |
| `STRIPE_PRICE_WORKSPACE_MONTHLY` | month | $29 | `sonara_workspace_monthly_v2` |
| `STRIPE_PRICE_ALL_THREE_MONTHLY` | month | $59 | `sonara_all_three_monthly_v2` |
| `STRIPE_PRICE_TEAM_MONTHLY` | month | $109 | `sonara_team_monthly_v2` |
| `STRIPE_PRICE_WORKSPACE_ANNUAL` | **year** | $290 | `sonara_workspace_annual` |
| `STRIPE_PRICE_ALL_THREE_ANNUAL` | **year** | $590 | `sonara_all_three_annual` |
| `STRIPE_PRICE_TEAM_ANNUAL` | **year** | $1090 | `sonara_team_annual` |

New lookup keys with a `_v2` suffix on the three monthly ones, rather than
moving the old keys, so the old price and the new one stay tellable apart in the
dashboard while both exist.

**Creating a price charges nobody.** A Stripe price is inert until a checkout
session names it, so this step is safe to do and check before anything is set.

Verify: the yearly three say **year**, not month. `verify-stripe-env.mjs`
refuses a subscription plan whose Stripe interval disagrees with the period the
page advertises — it was pinned to `month` for every plan until 5 September and
would have rejected a correct yearly price.

### 3. Set six variables in Vercel Production, and redeploy

Set all six together. The ladders are designed to move as sets: a replacement
stays off the page for as long as *any* plan it replaces can still be bought, so
a half-set does not put two $59 cards on the page — but it does leave the old
ladder up, which looks like nothing happened.

Vercel does not apply environment changes to a running deployment. **Redeploy.**

### 4. Prove the amounts agree, with the key present

```
STRIPE_SECRET_KEY=sk_live_... node scripts/verify-stripe-env.mjs --require-live
```

This is the step that catches the 13 August prices. **It was skipped on the real
cutover and the 13 August prices went live behind the new page** — see the top
of this document.

Without the key the script prints
`[SKIP] STRIPE_SECRET_KEY is not set, so live prices cannot be compared` and
passes, which is not the same as agreeing. `--require-live` turns that skip, and
every other reason for not comparing, into a failure — so the exit code means
what the last line says, and this step can no longer be passed by not running.

Expect one `[OK] … Stripe charges exactly what the pricing page advertises` per
plan. Anything else stops the cutover.

### 5. Confirm the page swapped

```
curl -s https://sonaraindustries.com/api/readiness | python3 -m json.tool
```

`checkoutPlans` should now name `workspace_monthly`, `all_three_monthly`,
`team_monthly` and the three annual keys, and **should no longer offer**
`starter_monthly`, `core_monthly` or `pro_monthly`. Load `/pricing` and check
the cards match.

If the old three are still offered, one of the six variables did not take.

### 6. Buy one, with a real card

`docs/SHIP_READINESS.md` item 1, still open, and this is the moment it is
cheapest to close. The charge path, subscription creation and refund have all
been observed working; **the entitlement half never has** — the only subscription
that ever existed lived 29 minutes.

Buy One workspace at $29, confirm the workspace opens, then refund. That single
purchase proves the half of the path nothing else can.

### 7. Archive the old prices — last

Once steps 4 and 5 pass, archive the 13 August three ($19/$39/$79) and, if you
are retiring the depth ladder entirely, Starter/Core/Pro as well. Nobody is on
them.

Archiving before this point is pathway C, and it takes the pricing page down to
nothing purchasable.

---

## Rolling back

Unset the six variables and redeploy. `offeredPlanKeys` puts the old ladder back
by itself, because a superseded plan returns the moment its replacement cannot
be bought. Nothing else has to be undone — provided step 7 has not run, which is
why step 7 is last.

If a customer has subscribed by then, do **not** roll back by archiving their
price: a Stripe price is immutable and their subscription goes on charging what
they agreed. Roll back the page and leave the subscription alone.

---

## What this runbook does not cover

**Migrating a subscriber.** There are none, so there is no procedure here for
one. If somebody subscribes before the cutover, this document stops being
accurate and the change becomes a new plan key and a supersession, the way
`workspace_monthly` supersedes `starter_monthly` today.

**Whether the new prices convert better.** No paid signup has completed, so there
is no conversion data for either set.

**The quoted setup package.** `business_builder_one_time` is unaffected — it is
`quoted`, off checkout, and carries no Stripe price. What happens to it is an
open decision in `docs/pricing/2026-09-05-PRICING-STRATEGY.md`.
