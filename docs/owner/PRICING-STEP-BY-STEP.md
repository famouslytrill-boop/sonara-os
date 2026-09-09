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

## 1 — The annual plans, which do not exist yet

This is the only pricing work with money behind it. The plans are already
written into `lib/sonara-stripe-plans.cjs` at **$290 / $590 / $1090**, marked
`hiddenUntilBuyable`, which means the pricing page shows nothing at all for them
until a real price exists. Create the prices and they appear. Do nothing and the
page stays exactly as it is.

Two months free against monthly is the offer: $29 × 12 is $348, and the annual is
$290.

### Create each price on the product that already exists

Do **not** create new products. Each annual price is the yearly twin of a
monthly plan and belongs on the same product, or Stripe reporting will treat
them as unrelated things.

Stripe Dashboard → **Product catalogue** → open the product → **Add another
price**.

| Create on this product | Amount | Billing period | Set lookup key to |
|---|---|---|---|
| `prod_V4GVbBWtrp9JcH` (One workspace) | **290.00 USD** | Yearly | `sonara_workspace_annual` |
| `prod_V4GVdWm2zvl9mC` (All three) | **590.00 USD** | Yearly | `sonara_all_three_annual` |
| `prod_V4GVM5ZUxjyQm7` (Team) | **1090.00 USD** | Yearly | `sonara_team_annual` |

For each one: **Recurring**, billing period **Yearly**, currency **USD**. Leave
tax behaviour unspecified, which is what the monthly three use.

Copy each new price ID as you go. They begin `price_1…`.

### Put them in Vercel

Vercel → project `sonara-os` → **Settings → Environment Variables** →
**Production**:

```
STRIPE_PRICE_WORKSPACE_ANNUAL   = <the $290 price id>
STRIPE_PRICE_ALL_THREE_ANNUAL   = <the $590 price id>
STRIPE_PRICE_TEAM_ANNUAL        = <the $1090 price id>
```

Mark them **Sensitive** if you like; the deploy check knows the difference
between a variable that is set-but-redacted and one that is absent.

### Redeploy, because a variable alone changes nothing

A Vercel environment variable is read when a deployment is built. Changing one
does not change the running deployment. Vercel → **Deployments** → the current
production deployment → **⋯ → Redeploy**.

### Check it

Open `/pricing`. Three yearly cards appear beside the monthly ones. Before this,
there were none — that is `hiddenUntilBuyable` doing its job rather than a bug.

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

1. Create three yearly prices at $290 / $590 / $1090 on the existing products.
2. Set the three `_ANNUAL` variables in Vercel production.
3. Redeploy, or nothing changes.
4. Buy one plan with a real card. Confirm it unlocks. Refund yourself.
5. **Then** archive the six old prices.
