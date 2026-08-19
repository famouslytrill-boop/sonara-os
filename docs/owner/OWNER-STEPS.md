# The steps only you can take

Five of them. Each is written to be run, not interpreted — the SQL, the exact
dashboard path, and how to tell whether it worked.

Nothing in this list can be done from inside the repository, which is why it is
a list rather than a commit. Everything that could be done from inside it has
been.

---

## 1 — Buy a plan in production, once

**Why nobody else can.** It needs a real card against the live Stripe account.
No test substitutes for it, and thirteen catalog products depend on the path.

**Do this.**

1. In production, sign up as a new customer with an email you control.
2. Buy any paid plan.
3. Confirm the entitlement lands: open the workspace that plan unlocks. It
   should open, not show "setup required".
4. Refund yourself in Stripe afterwards if you want; the entitlement test is
   the checkout, not the money.

**How to tell it worked.** `scripts/verify-production-product-catalog.mjs`
reports `positiveSubscribedUserTest: "pending"` on every deploy today. It is
the only thing in the release output that is honest about being unproven. Once
you have done this, tell me and I will change it to report the date it was
proven rather than the word pending — that is a one-line change I should not
make before it is true.

**If it fails**, send me the checkout URL and what you saw. A failure here is a
real finding, not a mistake on your part.

**The Stripe side is ready.** Checked read-only against the live account
(`acct_1TRSqj0dKtlEU3lA`) on 2026-08-12. All three advertised plans have an
active price on an active product, charging exactly what the page says:

| Plan | Page says | Stripe price | Charges | Variable |
|---|---|---|---|---|
| Starter | $7/mo | `price_1TjCkh0dKtlEU3lAsSDgFblT` | 700 | `STRIPE_PRICE_STARTER_MONTHLY` |
| Core | $19/mo | `price_1TjClL0dKtlEU3lAXi7RHc5j` | 1900 | `STRIPE_PRICE_CORE_MONTHLY` |
| Pro | $39/mo | `price_1TjClr0dKtlEU3lA0EWKaSBS` | 3900 | `STRIPE_PRICE_PRO_MONTHLY` |

Price ids are not secrets — they travel to the browser during checkout — so
they are written down here rather than described.

Two things worth knowing before you start:

- **A one-time $197 price is live and sellable** — `Business Builder setup`,
  `price_1TjCnv0dKtlEU3lAzjxJnhLK`, on an active product. The application does
  not offer it: that plan is quoted, not sold through checkout. Nothing is
  wrong, but it means the price exists if anyone ever points a variable at it,
  and nobody should.
- **The three retired plans are fully archived** — SONARA OS Creator, Pro and
  Label, at $9.99, $19.99 and $49.99. Both their prices and their products read
  inactive, so they cannot be bought by accident. `lib/sonara-billing.cjs` used
  to say these were active prices on archived products; that was true when it
  was written and is not true now, and the comment has been corrected. The
  guard against that shape stays, because Stripe genuinely does not clear a
  price's active flag when its product is archived.

So what step 1 proves is not whether Stripe is configured — it is whether *our*
checkout, webhook and entitlement path works end to end. That is the part no
amount of reading can establish.

---

## 2 — Turn on Supabase leaked-password protection

**Why nobody else can.** It is a dashboard toggle on the live project. The
Supabase MCP connection this repository uses is read-only by contract, asserted
in `scripts/verify-supabase-contract.mjs`.

**Do this.**

1. Supabase dashboard → **Authentication → Providers → Password**.
2. Enable **leaked password protection**.
3. Set the environment variable `SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true`
   in Vercel, for Production.

**Step 3 is the part that is easy to skip and matters most.** Until that
variable is set, the deploy prints a warning and passes either way — so a green
deploy currently tells you nothing about whether the toggle is on. Setting it
turns the warning into a gate.

**What is already covered without it.** The application refuses breached
passwords itself at signup and password reset
(`lib/sonara-leaked-password.cjs`), so the paths in this repository are done.
The toggle covers every path Supabase Auth serves, including ones this
application does not own.

---

## 3 — Put four authorization functions into version control

**Why nobody else can.** They exist in the live database and in no migration,
so this repository cannot read them. This is the most serious item on the list,
and it is not the one the security advisor flagged.

    is_admin()            is_current_user_admin()
    has_scope(...)        has_company_access(...)

These are authorization primitives. An authorization primitive nobody can read
is one nobody can review, and no care about its `EXECUTE` grant compensates for
not knowing what it does.

**Do this.** Run the query below in the Supabase SQL editor and send me the
output. I will turn it into a migration so the definitions live in version
control from then on.

```sql
select
  p.proname as name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_admin', 'is_current_user_admin', 'has_scope', 'has_company_access')
order by p.proname;
```

**It is also proof of something broader.** Functions and policies are being
created outside migrations. That is the limit on every report in this
repository that reads migrations to reason about the live database — including
the security-definer exposure report. Worth knowing regardless of what these
four turn out to do.

---

## 4 — Try one `EXECUTE` revoke, on a preview branch only

**Why nobody else can.** It needs a database you can afford to break.

The advisor's remediation is to revoke `EXECUTE` from `authenticated` on twelve
`SECURITY DEFINER` functions. **Do not do that.** Seven of them are load-bearing:
`is_org_member` alone is called by **202 policies across 64 tables**, and a
policy evaluates as the calling role, so removing the grant can turn a working
policy into a denial — customers locked out of their own records, silently.

Exactly one is safe on this repository's own evidence. `sonara_has_org_role` is
called by **no policy** and appears to be a superseded twin of `has_org_role`.

**Do this, on a preview branch and not on production.**

```sql
-- Preview branch only. Reversible; the grant is restored at the bottom.
revoke execute on function public.sonara_has_org_role(uuid, text[]) from authenticated;

-- Then exercise the app against the branch: sign in, open a workspace, open
-- records, save one. Every one of those paths runs through RLS.
--
-- If anything denies that should not, restore it immediately:
-- grant execute on function public.sonara_has_org_role(uuid, text[]) to authenticated;
```

**How to tell it worked.** Nothing changes. That is the expected result — the
function is called by no policy, so revoking it should be invisible. If
something *does* break, that is the finding: it means a policy calls it from
outside version control, which is item 3's problem showing up again.

**Then tell me**, and I will write it as a migration. I have not written one
pre-emptively, because a migration in this repository runs on deploy, and
shipping this without the branch test would be acting past the evidence.

**The other eleven stay as they are.** Seven because 202 policies is not a
number to gamble with, and four because they are the ones nobody can read yet.

---

## 5 — Set three variables in Vercel

**Checked against the live account on 19 August 2026, and most of this step was
already done.** The prices exist. What is left is three environment variables.

### What is already in Stripe

Read from `acct_1TRSqj0dKtlEU3lA` in live mode. All three amounts match
`lib/sonara-stripe-plans.cjs` exactly, and each product's description on Stripe
matches the description in that file **verbatim**:

| Plan | Amount | Price id | Variable to set |
| --- | --- | --- | --- |
| One workspace | $19.00/mo | `price_1U47yP0dKtlEU3lAvkakKNgm` | `STRIPE_PRICE_WORKSPACE_MONTHLY` |
| All three | $39.00/mo | `price_1U47yd0dKtlEU3lAeTBQ8o3D` | `STRIPE_PRICE_ALL_THREE_MONTHLY` |
| Team | $79.00/mo | `price_1U47yp0dKtlEU3lAhPqsCS7r` | `STRIPE_PRICE_TEAM_MONTHLY` |

Price ids are not secrets — they travel to the browser during checkout — so they
are written down here rather than described.

They were created on 13 August 2026, carry lookup keys
(`sonara_workspace_monthly`, `sonara_all_three_monthly`, `sonara_team_monthly`)
and nicknames, and sit on products named `SONARA One — One workspace`, `— All
three` and `— Team`.

### Do this

In Vercel, for **Production**, set each variable above to its price id. That is
the whole step.

### How to tell it worked

```
pnpm run verify:stripe
```

With `STRIPE_SECRET_KEY` present it fetches each price from Stripe and compares
the amount against what the pricing page promises. Read the last line rather
than the exit code: without the key it checks the offline half and says plainly
that live prices were not compared.

Once all three are set, the pricing page switches ladders on its own. Free /
Starter $7 / Core $19 / Pro $39 drops off and Free / One workspace $19 / All
three $39 / Team $79 replaces it, because `offeredPlanKeys` in
`lib/sonara-stripe-plans.cjs` moves both ladders as sets — a superseded plan
leaves only once its replacement can be bought, and a replacement stays hidden
while any plan it replaces is still buyable. Setting all three at once is the
clean switchover.

### A duplicate set was found and archived

There were **two** of each plan. A second set — bare products named `One
workspace`, `All three` and `Team`, with no descriptions and no lookup keys —
was created on 19 August 2026 at the same three amounts.

Two live prices at the same amount, differing only in which one carries the
customer-facing description, is a trap: point a variable at the wrong one and
the invoice a customer receives names a product with no description. Neither set
had a single subscriber, so the duplicate products were archived:
`prod_V6FejKrPFMI61v`, `prod_V6FgqpmKZeEth5`, `prod_V6FgGMeVSnnwR2`.

**This is reversible.** Setting a product back to `active: true` in the
dashboard restores it. Nothing was deleted, and Stripe does not permit deleting
a price in any case.

One consequence worth knowing, because this repository already guards against
it: archiving a product does **not** clear its prices' `active` flag. Those
three prices still read active on their own and cannot be sold, because their
product is archived. `lib/sonara-billing.cjs` carries that exact guard for the
three retired SONARA OS plans, and it now applies to three more.

### What this confirmed about step 1

The account has had **one subscription in its entire history** — $9.99/mo,
started 4 May 2026, cancelled the same day, on a price that is now archived.

That is independent confirmation of item 1: **nobody has completed a paid signup
in production.** It is not an inference from the deploy output; it is the
subscription list.

---

---

## Optional, blocking nothing — ask HyperFormula's vendor for a price

Deliberately unnumbered. The four above block a launch; this one blocks a
capability nobody has asked for yet, and numbering it five would put it in a
list whose whole point is that finishing it means you can ship. It is here
because it is the one open fact from the reciprocal-licence decision, and
because it is a two-line email nobody has sent.

`data/open-source-tools.ts` records 17 registered repositories under a
reciprocal licence. Working through them on 18 August 2026 established that
only one is both technically installable here and genuinely useful:
HyperFormula, a headless formula engine. It is dual-licensed — GPL-3.0, which
would oblige publishing SONARA's source, **or** a paid proprietary licence,
which would not.

I could not get the price. `hyperformula.handsontable.com` is blocked by this
environment's network egress proxy, and I will not put a number in a document
that I could not check. So:

> Ask Handsontable what a commercial HyperFormula licence costs for one hosted
> SaaS product, and whether the price is per developer, per application, or
> per deployment.

Three things worth knowing before you spend anything on it:

- **There is a free alternative to buying.** Running HyperFormula as a separate
  service this application calls over HTTP keeps the GPL at arm's length —
  GPL is not AGPL, and the service boundary is the settled reading there. That
  costs a machine instead of a licence.
- **Neither is worth doing yet.** Nothing in the product lets a customer write
  their own formula, so an adapter today would be a capability with no caller —
  the exact dead-end shape this repository has spent the month closing.
- **The deterministic tools do not need it.** `lib/sonara-formula-library.cjs`
  computes break-even, food cost, labour and the rest as ordinary arithmetic
  over the owner's own rows, with no engine and no service behind them.

Record the answer in the HyperFormula entry in `data/open-source-tools.ts` and
this step closes.

## Before any of the above: what has to be switched on

`docs/owner/WHAT-MUST-BE-ON.md` lists the ten environment variables a paying
customer cannot be served without, the one that must never be on in production,
and the one that turns the leaked-password warning into a gate. `pnpm run
verify:env` checks that classification on every release.

## What is not on this list, and why

**Pricing.** It moved onto the list as item 5 on 19 August 2026, when you chose
to apply the restructure now rather than after item 1. The code half is done and
the Stripe half is yours.

**Installing the rest of the reciprocal repositories.** Asked and answered on
18 August 2026: eleven are AGPL-3.0 or OSL-3.0 and stay untouched; the rest are
either whole applications in languages this runtime does not have, or duplicates
of something already installed under a permissive licence. Figranium is the
clearest of those — GPL-3.0, doing what the Apache-2.0 Crawl4AI adapter already
does. `docs/architecture/EXTERNAL-SERVICES.md` has the full working.

**Legal review.** Every legal page states the terms are not legal advice, and a
test asserts no page ever claims attorney review. Engaging counsel is a business
decision, not a shipping step, and keeping it on a checklist made the checklist
permanently unfinishable.
