# Entering the pricing, step by step

Written 9 September 2026 against the live account `acct_1TRSqj0dKtlEU3lA`, with
the price IDs read from it rather than remembered. Where a number appears below
it came from the Stripe API on that date.

**Read this first: a Stripe price is immutable.** You cannot change the amount
of an existing price. Changing what a plan costs means creating a *new* price and
pointing the application at it, and the old one keeps existing until you archive
it. Every awkward step below follows from that one fact.

---

## What is already true

The three monthly plans are live, correct, and pointed at by production:

| Plan | Amount | Price ID | Lookup key |
|---|---|---|---|
| One workspace | $29/mo | `price_1UDTj00dKtlEU3lAmimC5cN7` | `sonara_workspace_monthly_v2` |
| All three | $59/mo | `price_1UDToK0dKtlEU3lAWURVCj6H` | `sonara_all_three_monthly_v2` |
| Team | $109/mo | `price_1UDUKr0dKtlEU3lAJzu0pVoe` | `sonara_team_monthly_v2` |

Those three are the pricing page. Nothing below is required to keep selling them.

---

## 1 — The annual plans, which now exist

**Created 9 September 2026 on the live account.** The three yearly prices are on
the same products as their monthly twins, so Stripe reports them as one plan
billed two ways rather than as six unrelated things:

| Plan | Amount | Price ID | Lookup key |
|---|---|---|---|
| One workspace, yearly | $290/yr | `price_1UDdUl0dKtlEU3lA8EB46MUJ` | `sonara_workspace_annual` |
| All three, yearly | $590/yr | `price_1UDdUv0dKtlEU3lArDuldBWw` | `sonara_all_three_annual` |
| Team, yearly | $1090/yr | `price_1UDdV30dKtlEU3lA9OltiqYX` | `sonara_team_annual` |

Two months free against monthly: $29 x 12 is $348, and the yearly is $290.

**They are not on the pricing page yet, and that is not a bug.** The plans are
marked `hiddenUntilBuyable` in `lib/sonara-stripe-plans.cjs`, so a yearly card
appears only once the application has a price id to sell. That means the
remaining step is setting three variables, below.

### Put them in Vercel

Vercel → project `sonara-os` → **Settings → Environment Variables** →
**Production**:

```
STRIPE_PRICE_WORKSPACE_ANNUAL = price_1UDdUl0dKtlEU3lA8EB46MUJ
STRIPE_PRICE_ALL_THREE_ANNUAL = price_1UDdUv0dKtlEU3lArDuldBWw
STRIPE_PRICE_TEAM_ANNUAL      = price_1UDdV30dKtlEU3lA9OltiqYX
```

**Do not mark these Sensitive.** This file used to say "mark them Sensitive if
you like; the deploy check knows the difference between a variable that is
set-but-redacted and one that is absent." That sentence was true and useless,
and it is withdrawn on evidence.

The check does distinguish the two — it prints a different message for each —
but it **fails on both**. `vercel env pull` cannot return a sensitive value, so
it writes the literal string `[SENSITIVE]` in its place, and a deployment that
reads the pulled environment gets a placeholder where a price id should be.

That is not hypothetical. It is what happened: on the 9 September deploy run,
`vercel env pull` reported *"65 Secret values cannot be pulled from the
`production` Environment"*, and the price check failed on six variables at once
— all three annual ids above plus `STRIPE_PRICE_WORKSPACE_MONTHLY`,
`STRIPE_PRICE_ALL_THREE_MONTHLY` and `STRIPE_PRICE_TEAM_MONTHLY` — each with:

> `STRIPE_PRICE_… is set but does not hold a Stripe price id.`

The three older ids (`STARTER`, `CORE`, `PRO`) were not marked Sensitive and
came through fine, which is the clearest evidence that the flag is the cause.

**A Stripe price id is not a secret.** It is served to every visitor of the
pricing page, in the checkout call. Marking it Sensitive protects nothing and
breaks the one check that compares what you advertise against what Stripe would
charge.

To fix one that is already Sensitive, the surest route is to replace it:

```
vercel env rm  STRIPE_PRICE_WORKSPACE_ANNUAL production --yes
vercel env add STRIPE_PRICE_WORKSPACE_ANNUAL production --no-sensitive
```

`--no-sensitive` is documented as opting out of the default sensitive behaviour.
There is also a REST `PATCH /v9/projects/{idOrName}/env/{id}` that takes
`"type": "plain"`, if you would rather change it in place. Whether the dashboard
offers the same toggle is not recorded here, because it has not been checked —
the two commands above have documentation behind them.

Then **redeploy**, as below. Confirm with the run itself: `vercel env pull`
should no longer count these among the "Secret values cannot be pulled".

### Redeploy, because a variable alone changes nothing

A Vercel environment variable is read when a deployment is built. Changing one
does not change the running deployment. Vercel → **Deployments** → the current
production deployment → **⋯ → Redeploy**.

### Check it — done, 9 September 2026

`/api/readiness` returns `invalid` with every list empty, all three annual plans
read `checkout: enabled, reason: configured`, and `/pricing` serves the three
yearly cards at $290 / $590 / $1090.

**One thing that check does not prove.** Both `assertPriceMatchesAdvertised` and
`verify-stripe-env.mjs` compare the *amount*, and the duplicate set in section 1b
carries the same amounts. So a green readiness is consistent with either set
being configured. Confirming which takes ten seconds and cannot be done from
outside: open the three variables in Vercel and check the ids against the table
in section 1 — the right ones are the ones listed there.

Open `/pricing`. Three yearly cards appear beside the monthly ones. Before this,
there were none — that is `hiddenUntilBuyable` doing its job rather than a bug.

---

## 1b — A second set of prices exists at the same amounts. Do not use it.

Read off the live account 9 September 2026. Six prices were created in the
dashboard between 03:27 and 04:00 UTC that day, at exactly the amounts above,
but on **six new products** and with **no lookup keys**:

| Amount | Price ID | Product |
|---|---|---|
| $29/mo | `price_1UDcAR0dKtlEU3lA6xBfzRYu` | `prod_VE4J90xFtuitCR` One workspace |
| $59/mo | `price_1UDcB60dKtlEU3lAiTaUfXLI` | `prod_VE4JQr6tRsGAXW` All three |
| $109/mo | `price_1UDcC60dKtlEU3lABcH8EVw6` | `prod_VE4KC5s8A3DUa1` Team |
| $290/yr | `price_1UDcdq0dKtlEU3lA6bTBV7Pk` | `prod_VE4n0iwdZOsdik` One workspace |
| $590/yr | `price_1UDcfA0dKtlEU3lAaqioX8tE` | `prod_VE4o06VFm3PHBG` All three |
| $1090/yr | `price_1UDcg80dKtlEU3lAoLjca1r0` | `prod_VE4pvgqfKzWGX5` Team |

**The reason this needs a section of its own is that the guard does not catch
it.** `assertPriceMatchesAdvertised` re-fetches the configured price and compares
the *amount*. These amounts are identical, so pointing a variable at one of them
passes every check in this repository and every check in the deploy.

What breaks is quieter. The subscription lands on a different product, so Stripe
reports it as an unrelated plan rather than as the monthly twin of the yearly
one, the lookup keys are absent, and anything reasoning product-first —
entitlements, reporting, a future move to new amounts — is working from the wrong
object. A wrong price id that charges the right amount is harder to find than one
that charges the wrong amount, because nothing complains.

Use only the ids in the tables above and below this section: the ones on the
`SONARA One —` products, carrying lookup keys.

Not archived here, deliberately. Archiving is a destructive change to live
billing configuration, it belongs to the owner, and the rule in section 2 —
nothing is archived until a real card has completed a purchase — applies to these
for the same reason it applies to the old $19/$39/$79 set.

### If readiness says `invalid_prefix`

That is not "the price is wrong". It means the value in Vercel does not begin
with `price_` at all, so nothing was even looked up. The two values that produce
it most often are a **product** id (`prod_...`) and a lookup key — both sit next
to the price id in the dashboard, and both look plausible.

---

## 2 — Archiving the old prices, and why it is last

Six prices on this account still charge the old amounts:

| Amount | Price ID | Note |
|---|---|---|
| $19/mo | `price_1U47yP0dKtlEU3lAvkakKNgm` | lookup `sonara_workspace_monthly` |
| $39/mo | `price_1U47yd0dKtlEU3lAeTBQ8o3D` | lookup `sonara_all_three_monthly` |
| $79/mo | `price_1U47yp0dKtlEU3lAhPqsCS7r` | lookup `sonara_team_monthly` |
| $19/mo | `price_1U639f0dKtlEU3lAydIKkGZ9` | on a separate product, no lookup key |
| $39/mo | `price_1U63Af0dKtlEU3lAaDXHjoeq` | on a separate product, no lookup key |
| $79/mo | `price_1U63BZ0dKtlEU3lA3p0kai67` | on a separate product, no lookup key |

**Do not archive any of them until a real card has completed a purchase at the
new amounts.** An archived price cannot be un-archived into service the way you
would want under pressure, and while the old ones exist you can point a variable
back at them in under a minute. That is the entire value of leaving them: a way
back that costs nothing to keep.

The first three still hold the un-suffixed lookup keys. If you ever want
`sonara_workspace_monthly` to mean $29, the old price has to be archived first —
Stripe will not let two live prices share a lookup key.

Archive when ready: Dashboard → the product → the price → **⋯ → Archive**.
Archiving never affects an existing subscription; it only stops new checkouts.

---

## 3 — The check that will tell you if you got it wrong

```
node scripts/verify-stripe-env.mjs --require-live
```

With `STRIPE_SECRET_KEY` set, this fetches every configured price from Stripe
and compares it to the amount the pricing page advertises. It is the check that
would have caught the September mismatch, where `/pricing` said $29 while the
configured price charged $19 and every headline plan silently refused checkout.

Two things worth knowing about it:

- **Without `--require-live` it skips and exits 0.** That is deliberate for the
  local chain and is why the flag exists. The deployment passes the flag.
- It reads the **pulled production environment**, not your shell. What it
  verifies is what production is configured with.

A read-only Stripe key is enough — the script only ever does
`GET /v1/prices/{id}`.

---

## 4 — What still cannot be checked from here

`assertPriceMatchesAdvertised` in `lib/sonara-billing.cjs` re-fetches the price
on **every checkout** and refuses to create a session if the amount does not
match the page. So a mismatch cannot overcharge anybody; it can only refuse to
sell. That is the right failure and it is also a silent one — `/api/readiness`
will still say `checkout: enabled`, because "enabled" there means *a price
variable is set*, not *a price that can be sold*.

The only thing that proves the whole path is buying a plan with a real card and
confirming the account unlocks. That has never happened on this account: it has
had exactly one subscription in its history, $9.99/mo, started and cancelled on
4 May 2026. Until somebody completes a purchase,
`verify-production-product-catalog.mjs` reports `positiveSubscribedUserTest:
"pending"`, and it is right to.

---

## The order, if you only read one thing

1. ~~Create three yearly prices at $290 / $590 / $1090.~~ Done 9 September 2026.
2. ~~Set the three `_ANNUAL` variables in Vercel production.~~ Done 9 September
   2026, ~06:25 UTC.
3. ~~Redeploy.~~ Done — `/api/readiness` returns an empty `invalid` block and
   `/pricing` shows the three yearly cards at $290 / $590 / $1090.
4. Buy one plan with a real card. Confirm it unlocks. Refund yourself.
5. **Then** archive the six old prices.
