# The steps only you can take

Five of them, and two records of what is already closed. Each is written to be run, not interpreted — the SQL, the exact
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

**This is now one command instead of a dashboard hunt.**

```
pnpm run enable:leaked-password              # report what it is set to
pnpm run enable:leaked-password -- --enable  # turn it on
```

It needs `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` — the same two the
deploy workflow already has. It changes exactly one field,
`password_hibp_enabled`, and it **reports and changes nothing unless you pass
`--enable`**, so running it by accident does nothing.

Three things it does that a dashboard click does not:

- It refuses to touch any project other than `yqncsonkxgwhcxedgevk`. This
  organization contains a second project named like production, and a setting
  flipped on the wrong one is worse than one nobody flipped, because it reads as
  done.
- It **reads the setting back from the server afterwards.** A 200 on the write
  means the request was accepted, not that the setting now reads true. If
  Supabase accepts the change and the value stays false, this fails rather than
  congratulating you.
- If the `password_hibp_enabled` field is missing from the response it fails
  rather than reporting "disabled" — absent is not false, and a changed API
  shape would otherwise send you to turn on something that may already be on.

### Then set the ratchet, which is the half people skip

Set `SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION=true` in Vercel, for Production.

Until it is set, `scripts/verify-production-project-identity.mjs` only warns, so
the setting could be switched back off and every release would stay green.

**That gate had a hole until 19 August 2026, and it is worth knowing about
because it is the kind you would never see.** It turned "protection is disabled"
into a deploy failure once the ratchet was set — correctly — but left "the auth
configuration could not be read" and "the field was missing from the response" as
passing notes, *even with the ratchet set*. So once you set the variable
believing the deploy now enforced this, a rotated token or a Supabase API change
would silently downgrade it to unenforced and every deploy would still pass.

An unread answer is not a confirmation. Both now fail when the ratchet is set.

### What is already covered without any of this

The application refuses breached passwords itself at signup and password reset
(`lib/sonara-leaked-password.cjs`), so the paths this repository owns are done.
The Supabase setting covers every path Supabase Auth serves, including ones this
application does not own — which is why it is worth having as well, not instead.

---

## 3 — Closed 19 August 2026

**You ran the query and supplied all four.** They are recorded verbatim in
`supabase/migrations/20260819050000_record_undeclared_authorization_functions.sql`,
which is now the only place in this repository they can be read.

    is_admin()            is_current_user_admin()
    has_scope(...)        has_company_access(...)

**That migration creates nothing, replaces nothing and drops nothing**, and that
is deliberate. Reading them turned up why:

**Two of them depend on tables this project does not have.** `has_scope` reads
`app_scopes` and `organization_members`; `has_company_access` reads
`organization_app_access`. None of those three exists in any migration here, or
anywhere else in this repository. `organization_members` is not a typo for
`organization_memberships` either — it joins on `org_id`, and this project's
column is `organization_id`. They describe a permission model this product does
not have, with a six-role vocabulary — owner, admin, manager, editor,
billing_admin, security_admin — that `organization_memberships` does not carry.

A `LANGUAGE sql` body is validated when the function is created, so a
`create or replace` of either one against a database lacking those tables fails
— on deploy, on the authorization path. That is the first reason nothing is
created. The second is that nothing in this repository can execute Postgres, so
a definition written here would be one nobody had run.

**`is_admin()` and `is_current_user_admin()` are byte-identical.** Same body,
same volatility, same search_path, two names. One is redundant. Which one to
keep is your call; nothing here depends on either.

**All four are hardened correctly.** Every one sets `search_path TO 'public'`,
which is what stops a caller redirecting an unqualified name inside the body to
a table they control. The advisor's warning reads as though these are careless,
and they are not.

**No policy in any migration calls any of the four.** `is_org_member` is called
in more than thirty places across five migrations; these four in none. That
matters for item 4 below.

It does not settle item 4, and the reason is the same limitation that created
this item: **these four existed in the database and in no migration, which is
proof the schema holds content this repository cannot see.** So "no migration
calls them" is not "nothing calls them".

The migration ends with a `do` block that raises notices — which of the four
functions and which of their three tables the database it runs against actually
has. It changes nothing and is safe to run twice. **Running it is how you find
out whether those tables exist**, which is the one question left here and the one
this repository cannot answer from outside.

---

## 4 — The revoke, and why it is far less dangerous than it looked

**Rewritten 19 August 2026 after measuring the thing this step was afraid of.**

The advisor asks for `EXECUTE` to be revoked from `authenticated` on twelve
`SECURITY DEFINER` functions. This step used to say: do not, because a policy
evaluates as the calling role, so removing the grant can turn a working policy
into a denial — customers locked out of their own records, silently, with
`is_org_member` alone backing 202 policies across 64 tables.

**That mechanism is not currently reachable in this product.**

Every table read in the running application goes through `supabaseHeaders()` in
`server.js`, which sends the service-role key as both `apikey` and
`Authorization`. **The service role bypasses row level security entirely.** 75
call sites across 14 files, and no exceptions: no read is made as
`authenticated`, so no policy is evaluated on any live path, so no policy's call
to a `SECURITY DEFINER` function is on any live path either.

`lib/sonara-supabase-clients.cjs` is the machinery for changing that — CRIT-3
item (2), forwarding the caller's JWT so RLS becomes a real second line of
defence. It is built, and it is required by exactly one file: its own test.

So the honest position today is that revoking that grant on any of the twelve
cannot lock a customer out of anything, because nothing they do is authorized by
a policy in the first place.

### This is true today and is designed to stop being true

CRIT-3 (2) is work somebody intends to do. The day a user-scoped read is wired
in, every sentence above becomes wrong, and the lockout this step originally
warned about becomes exactly as real as it sounded.

`tests/the-revoke-reasoning-is-still-true.test.js` fails the moment that
happens, and its failure message says to re-read this section before revoking
anything. That is the only reason it is safe to write the paragraph above down:
otherwise it is a reassurance with an expiry date and no label.

### So what should you actually do

**Still the preview branch, and still `sonara_has_org_role` first.** Not because
a lockout is likely — it is not, today — but because the reason it is unlikely
rests on a measurement of this repository, and this repository cannot see the
whole database. Item 3 is the proof: four authorization functions existed in the
live database and in no migration. Policies are created outside migrations too,
and a policy this repository cannot see is a policy this reasoning did not cover.

```sql
-- Preview branch only. Reversible; the grant is restored at the bottom.
revoke execute on function public.sonara_has_org_role(uuid, text[]) from authenticated;

-- If anything denies that should not:
-- grant execute on function public.sonara_has_org_role(uuid, text[]) to authenticated;
```

**How to tell it worked: nothing changes.** That is the expected result twice
over — the function is called by no policy this repository can see, and no read
this product makes is evaluated against a policy anyway.

**Add the four from item 3 to the same branch test.** `is_admin`,
`is_current_user_admin`, `has_scope` and `has_company_access` are called by no
policy in any migration, and two of them read tables that exist nowhere in this
repository. On the evidence here they are the next safest after
`sonara_has_org_role`.

**The remaining seven stay.** 202 policies is not a number to gamble with, and
the fact that those policies are not currently on a live path is a statement
about today rather than about the schema.

Then tell me, and I will write whatever survived as a migration.

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

## 6 — Make the upload bucket, and make it private

Added 26 August 2026, when `lib/sonara-multipart.cjs` and
`lib/sonara-file-storage.cjs` gave this application the ability to accept a file
for the first time. Until this is done, an upload reports setup-required and no
page notices — which is the correct behaviour and is not the same as working.

### Do this

In the Supabase dashboard, **Storage → New bucket**:

- Name it `sonara-uploads`, or any name you like and set `SONARA_UPLOAD_BUCKET`
  to match.
- Leave **Public bucket** switched **off**. This is the whole point of the step.

### Why the private setting is the step rather than a detail

Files are handed out through signed links that expire in five minutes by
default and an hour at most. **A public bucket makes every one of those links
pointless**: the object is readable by anyone with the path, forever, including
after the customer deletes the record that pointed at it.

Nothing in this repository can see that setting. `storageReadiness()` reports it
as an *assumption* rather than a guarantee, in those words, because the honest
thing a program can say about a setting it cannot read is that it is assuming
it. That is why this is on your list and not in a test.

### How to tell it worked

Upload a file, then open the signed link it produces in a private window. It
should work. Then wait an hour and open the same link again: it should not. If
it still works, the bucket is public.

## 7 — Enable Stripe Connect, so your customers can be paid

Added 26 August 2026, with `lib/sonara-connected-payments.cjs` and
`/business-builder/owner/payments`. **This is the single highest-value step on
this list.** It unblocks the largest gap in two of three products at once: a
contractor taking payment on a job, and a creator selling a product. Every
competitor at every price point does this; today this product raises an invoice
and cannot collect against it.

Nothing in this repository can do it, and the code fails closed until it is
done — the page reports "not switched on for this platform yet" and says it is
an owner step rather than the customer's mistake.

### Do this

1. In the Stripe dashboard, open **Connect** and complete the platform
   application. Stripe asks what your platform does and who your users are.
   The honest answer is short: *a business management application whose
   customers take payments from their own customers; charges are created
   directly on each connected account.*
2. When Connect is live, set one variable in Vercel Production:

   ```
   STRIPE_CONNECT_ENABLED=true
   ```

   No new secret. The credential is the `STRIPE_SECRET_KEY` you already have —
   this flag only says the platform side is ready, which is the one thing you
   can state truthfully from what you can see in your own dashboard.
3. Redeploy.

### What you are agreeing to, stated plainly

**Standard accounts, direct charges.** Each business gets its own Stripe
account and its own dashboard. A charge is created *on* their account, so the
money lands in their balance and **never passes through yours**. There is
nothing for you to pay out, and no customer's money is ever in your custody.

That was a deliberate choice over destination charges, which route funds
through the platform first and carry a money-transmission posture with
registration and reconciliation attached. The database constraint refuses any
mode but `direct`, so changing it is a migration somebody writes and a reviewer
sees.

**Disputes and refunds belong to the business**, not to you. That is the right
side of that line for a tool a small operator adopts alongside things they
already run.

### How to tell it worked

Open `/business-builder/owner/payments` in a workspace you own. Before this step
it says the platform is not switched on. After it, it offers **Connect a payment
account** — and pressing that should take you to `connect.stripe.com`.

If it takes you anywhere else, stop and tell me: the module refuses any
onboarding URL not on that host, so a different destination means something is
wrong upstream rather than a cosmetic issue.

### What this does *not* turn on

**No pay button appears on a shared invoice**, now or later. `/shared/:token`
tells its reader to pay the way they agreed with the business and never from a
link, because a forwarded invoice carrying a pay button is the shape of a
payment-redirection fraud — and that advice protects your customers only while
it is always true. Connecting an account and collecting a payment are separate
pieces of work; this is the first.

## 8 — Production has been serving 5 August code, and the deploy is failing

**This is the one that matters most, and it needs your database.**

The last Controlled Production Deployment that succeeded was run **#110, on
5 August 2026**, for pull request #191. Every run since has failed: **#111
through #124**, covering pull requests #192 to #205. Nothing merged after
5 August has ever reached production.

What `sonaraindustries.com` is serving right now is deployment
`dpl_4DK4UkJShM4NsWNqHprpFHsWeSmS`, which carries commit `eebc80c` — **252
commits behind `main`**. The deployment is dated 19 August, but it is a
redeploy of a redeploy of a redeploy of the 5 August build, so the code has not
moved since 5 August.

### Why it fails

`supabase db push` stops on the first of 28 pending migrations:

```
Applying migration 20260811220000_customer_invoices_accounts_receivable.sql...
ERROR: relation "public.quotes" does not exist (SQLSTATE 42P01)
```

That migration's `customer_invoices` table has
`quote_id uuid references public.quotes(id)`, and **`public.quotes` is not in
your production database**.

It is in the repository. `010_sonara_platform_current_schema.sql` creates it,
and `pnpm run verify:migration-replay` applies all 108 migrations to an empty
PostgreSQL and gets a working schema every time. So the migration set is fine.
What has gone wrong is that production's migration history says
`010_sonara_platform_current_schema.sql` is already applied and the table it
creates is not there — which is what happens when an existing database is
adopted into the CLI and early migrations are marked applied rather than run.

The file name is the clue: "current schema" is what somebody writes when they
are describing a database that already exists.

### What only you can do

Nothing here can reach your production database, and this is a schema change to
a live system, so it is yours either way. In rough order:

1. Confirm the gap. In the Supabase SQL editor:

   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public' and table_name in ('quotes', 'customers')
   order by table_name;
   ```

   If `quotes` is missing, this is the whole story. If `customers` is missing
   too, more of `010` never ran and the same will happen again further down the
   list.

2. Compare the history against the files:

   ```sql
   select version from supabase_migrations.schema_migrations order by version;
   ```

   Anything marked applied whose tables are absent is the set to repair.

3. Apply the missing objects, then re-run the deployment from
   **Actions → Controlled Production Deployment → Run workflow**. Do not use the
   Vercel dashboard's Redeploy button: that is what took the alias on 4 August
   and is why the workflow header exists.

Take a backup first. Everything in `010` is `create table if not exists`, so
re-running that one file is additive rather than destructive, but the decision
is yours and the checkpoint costs nothing.

### Why no check caught it

`verify:migration-replay` runs against an **empty** database, which is what lets
it prove the migrations agree with each other. It never reads production's
history, so it cannot see a migration marked applied that did not run. That
limit is now stated in the command's own output rather than left to be inferred.

The deploy workflow was honestly red for fourteen consecutive runs. Nothing was
watching it.

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
