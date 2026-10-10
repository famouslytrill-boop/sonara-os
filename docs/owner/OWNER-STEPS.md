# Owner-only setup and verification

Updated: 2026-09-27

## Current production evidence

Controlled Production Deployment run #248 completed successfully for `main`
commit `9a105da6abc0e46aff170bebf690de80dc957886`. Vercel deployment
`dpl_7YKcMPxTLwTt7FCNsPijrtsrWMVR` is **READY**. The production smoke test
passed 282 assertions. Google sign-in configuration and Stripe prices matched
the production requirements. Supabase reported the remote database was up to
date; no migrations ran in this deployment.

The historical price cutover in section 5 is complete and the live price
configuration was reverified by run #248. Do not create prices, repoint
variables, or follow the old cutover instructions in that section. Section 8
is a historical database incident record; its former repair instructions are
not current production instructions.

The following owner-controlled checks were **not proven by this release**:
one real customer purchase and entitlement; the live Supabase leaked-password
setting and enforcement flag; a preview-only authorization experiment; the
private upload bucket; and Stripe Connect activation. Confirm their current
state in the relevant account before acting. Section 3 is a closed record;
section 4 describes a reversible preview-only check.

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

## 4 — SECURITY BLOCKER: verify RLS function grants before any revoke

**Updated 10 October 2026. Do not revoke `EXECUTE` in production based on the August service-role-only snapshot.**

The August 19 inventory found `supabaseHeaders()` in `server.js` sending the service-role credential on legacy reads. That historical observation is not a complete inventory of live customer paths, later code, branches, background work, or database policies. In particular, `lib/sonara-adaptive-learning-policy.cjs` now imports `isVerifiedUserScopedRead()` from `lib/sonara-supabase-clients.cjs` for a guarded, non-executing learning-evidence preview adapter. Its existence **does not prove** that a customer HTTP route uses a caller JWT today, and **does invalidate** the earlier claim that the user-scoped module is required only by its test.

PostgreSQL RLS policy expressions execute as the querying role. Removing `EXECUTE` from a function used by a live authenticated policy can deny legitimate access even when SQL/migrations parse correctly. Conversely, leaving a broadly callable `SECURITY DEFINER` function exposed can grant excessive privileges. Both directions require a measured, function-specific decision—not a blanket revoke, grant, or presumed absence of effects.

### Required acceptance evidence (preview/staging, never production first)

1. Resolve the exact target project and role identities; do not assume the only connected Supabase project is the live Vercel target. Export read-only function definitions, owners, role grants **including PUBLIC membership**, and every current policy referencing each candidate function. Reconcile drift against the applied migration list and repository files.
2. Trace actual registered runtime routes, jobs and server-side adapters, including `requireVerifiedUserScopedRead`, `isVerifiedUserScopedRead`, and indirect calls. A text import or comment alone neither proves nor excludes an executable request path.
3. With synthetic users belonging to two separate organizations, prove allowed same-tenant reads **and writes where supported**, cross-tenant deny, anonymous deny, unauthenticated deny, and legitimate non-owner/member access. Use the same signed-in JWT and app path a customer actually uses.
4. On a disposable preview branch, compare the exact before/after GRANT and policy behavior for **one named function at a time**. Verify expected authorization and non-authorization outcomes after the proposed revoke, and perform rollback/regrant rehearsal. Never infer pass from zero fixtures, zero matching policies, or a mock database.
5. Require owner-reviewed migration, fresh checksum/applied-history reconciliation, native PostgreSQL replay, browser flows, rollback evidence and exact-head full green CI before even proposing production promotion. Any missing, ambiguous, or contradictory evidence blocks the change.

### Operator decision

**Do not revoke EXECUTE in production without a passing target-specific preview matrix and explicit owner authorization.** The old claim that no customer path could be affected is retired; the remaining question is empirical and function-specific. For Supabase/PostgreSQL privileges, review https://supabase.com/docs/guides/database/functions and https://www.postgresql.org/docs/current/ddl-rowsecurity.html.

Historical 19 August notes (75 service-role call sites, 12 proposed revocations and the four undeclared functions in item 3) remain research evidence, **not** today's authorization proof. The test `tests/the-revoke-reasoning-is-still-true.test.js` guards that scope distinction and unexpected new client wiring; it cannot substitute for live RLS validation.

---

## 5 — Historical Stripe price cutover (completed)

On 8 September 2026 the canonical Stripe prices and production environment
pointers were updated. The controlled release on 27 September verified the
live prices against the pricing page and passed the production catalog checks.

**No price setup action is currently required.** Do not recreate products,
restore retired price IDs, or repoint production variables from the historical
tables that used to live here. The current provider-read price IDs and the safe
verification sequence are in
[SETUP-STEP-BY-STEP.md](SETUP-STEP-BY-STEP.md).

The 27 September deployment did not perform a real customer payment. Section 1
remains the owner-only end-to-end proof: complete one checkout with a card you
control, confirm the persisted entitlement, then refund or cancel the test
transaction if appropriate.

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

### The Connect webhook, and the events it must receive

Marketplace sales and shop orders change state only when Stripe tells this
application what happened. In the Stripe dashboard, under **Developers →
Webhooks**, add an endpoint that listens to **events on connected accounts**:

```
https://sonaraindustries.com/api/webhooks/stripe-connect
```

Subscribe it to exactly these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

Then copy its signing secret into Vercel Production as
`STRIPE_CONNECT_WEBHOOK_SECRET` and redeploy. No checkout opens until that
secret is set, because a payment nothing can verify is a payment nothing can
fulfil.

Missing an event fails silently: the application never hears about it. The last
one, `charge.dispute.closed`, is how a dispute the seller *won* gives the buyer
their licence back and puts the sale back into the business's money received.
Without it, a won dispute stays disputed for good.

### What this does *not* turn on

**No pay button appears on a shared invoice**, now or later. `/shared/:token`
tells its reader to pay the way they agreed with the business and never from a
link, because a forwarded invoice carrying a pay button is the shape of a
payment-redirection fraud — and that advice protects your customers only while
it is always true. Connecting an account and collecting a payment are separate
pieces of work; this is the first.

## 8 — Historical production database incident (resolved)

The earlier schema and migration investigation below is retained as an incident
record. Its 3 September diagnosis and owner remediation steps are not current
instructions.

On 27 September, controlled deployment run #248 verified the production schema
and catalog. Supabase reported **Remote database is up to date**; no migration
was applied. The release recorded a pre-migration recovery checkpoint and
completed Vercel deployment and live route checks on commit
`9a105da6abc0e46aff170bebf690de80dc957886`.

Use a fresh controlled deployment report before considering any production
database change. Do not run the SQL, merge, or migration advice inside the
historical incident below as a current repair plan.

<details>
<summary>Historical diagnosis from 3 September 2026 — superseded by run #248</summary>

**This is the one that matters most, and it needs your database.**

> **Updated 3 September 2026, after run #125 actually tried it.** The repair
> described below was merged and the deployment ran. It got further and failed
> again, on something this section did not anticipate: **a missing column, not
> a missing table.** Read "What run #125 proved" near the end before acting on
> the rest — two of the claims below are now known to be incomplete, and the
> diagnostic queries have been changed to ask the question that is now blocking.

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
your production database**. (28 were pending at that run; the repository has
added more since.)

It is in the repository. `010_sonara_platform_current_schema.sql` creates it,
and `pnpm run verify:migration-replay` applies all 178 migrations to an empty
PostgreSQL and gets a working schema every time. So the migration set is fine.
What has gone wrong is that production's migration history says
`010_sonara_platform_current_schema.sql` is already applied and the table it
creates is not there — which is what happens when an existing database is
adopted into the CLI and early migrations are marked applied rather than run.

The file name is the clue: "current schema" is what somebody writes when they
are describing a database that already exists.

### The repair is written and waiting in this branch

`supabase/migrations/20260811210000_repair_missing_platform_tables.sql` creates
**42 tables**, copied column for column from the migrations that first defined
them, all `create table if not exists`. Its version sits between the last
migration production applied (`20260806090000`) and the one that fails
(`20260811220000`), so `supabase db push` runs it first.

Not two. `quotes` was the table the error named, and fixing only that would have
shipped a repair that failed one migration later. Across the 32 pending
migrations, 65 tables are referenced, altered, indexed or given a policy without
being created — and **34 of them exist only in the pre-CLI numbered files, 010
to 016**, the same family as the snapshot that demonstrably did not run on your
database. Taking the transitive closure over their foreign keys gives 42.

Every one is `create table if not exists`, so on a database that already has
them this does nothing at all. Row level security is enabled on each, because a
table that arrives without it is exposed through PostgREST.

It creates **only** those two. Re-running `010` whole would have been the
obvious move and would have been wrong: `010` also creates `billing_customers`,
which `20260805120000_retire_superseded_tables.sql` deliberately retired, so a
replay would resurrect a table somebody decided to remove.

Proven rather than assumed, on a throwaway PostgreSQL:

| | result |
| --- | --- |
| applied to a database with none of the 42 | all 42 created, row level security on every one |
| applied a second time | no error, still 42 — a no-op where the tables exist |
| then `20260811220000`, the failing migration | applies cleanly, `customer_invoices` created |

And the full 109-migration replay onto an empty database still passes, so it
does not disagree with the migrations around it.

**What it cannot promise:** that there is no second gap further down the list.
Nothing in this repository can read your schema. The queries below are what
answer that, and they are worth running first.

### What run #125 proved, on 3 September 2026

The repair was merged and **Controlled Production Deployment #125 ran**. It
reached further into the list than any run since 5 August, and failed here:

```
Applying migration 20260819030000_member_read_policies_research_sources.sql...
NOTICE: skipping shared_links: table not present
ERROR: column "organization_id" does not exist (SQLSTATE 42703)
At statement: 10
  create policy "customers_select_member" on public.customers
    for select to authenticated using (public.is_org_member(organization_id))
```

Three things follow, and two of them correct this section.

**Your `public.customers` exists and has no `organization_id` column.** That is
a different disease from a missing table. The 42-table repair is entirely
`create table if not exists`, which repairs a table that is *absent* and is a
**no-op for a table that is present in an older shape**. It could never have
fixed `customers`.

The `shared_links` NOTICE in that output is **not** a second problem, and saying
so here because it reads like one: `shared_links` is created by
`20260819070000_shared_links.sql`, which is still further down the same pending
list. It is absent because its own migration has not run yet, which is exactly
what should happen, and the policy migration skipping it is the guard working.

**Point 5 above anticipated a second gap and guessed the wrong kind.** It said
to look for another `relation does not exist`. What is actually blocking is a
column. The fix for that is not another table — it is
`20260812000000_existing_tables_reach_the_shape_later_migrations_expect.sql`,
generated from the repair migration's own table definitions, which adds any
declared column a live table is missing (42 tables, 530 columns, all
`add column if not exists`, all nullable so a table holding rows can take them).
That is pull request **#213**.

**Nothing from run #125 landed.** `20260819030000` was first in the pending list
and migrations run in a transaction, so its failure rolled back. Steps 23 to 29
were skipped, so the application never deployed either. Production is exactly
where it was.

One thing that is **not** claimed: that the 42-table repair is what let the run
get this far. Run #125's dry-run, before anything was applied, already listed
the pending set starting at `20260819030000` — so your migration history had
all existing migrations recorded as applied *before that run started*.
Something moved it between 27 August and 3 September and it was not this
deployment. Nobody here knows what, and guessing would be the same mistake as
assuming absent tables were the whole story.

### What only you can do

Nothing here can reach your production database, and applying a schema change to
a live system is yours either way. In rough order:

1. **Get the real schema, once, instead of inferring it a third time.** Two
   guesses have now been made from error messages. The actual answer is already
   sitting in GitHub: run #125 took a schema-only dump before touching anything,
   and uploaded it as the artifact **`rollback-checkpoint-33807980211`**
   (Actions → the #125 run → Artifacts; expires 3 October 2026). It contains
   `pre-migration-schema.sql`. Attach it here and the remaining gaps can be
   derived rather than guessed.

   Failing that, this asks the question that is now blocking — which columns are
   missing, not just which tables:

   ```sql
   select c.relname as table_name, a.attname as column_name
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   left join pg_attribute a
     on a.attrelid = c.oid and a.attname = 'organization_id' and a.attnum > 0 and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r' and a.attname is null
   order by c.relname;
   ```

   Every row is a table with no `organization_id`. Some of those are global by
   design; the ones that also appear in `lib/sonara-tenant-scoped-tables.cjs`
   are the gaps.

2. Compare the history against the files:

   ```sql
   select version from supabase_migrations.schema_migrations order by version;
   ```

   Anything marked applied whose tables *or columns* are absent is the set to
   repair. This is also what would explain how the `20260811` versions came to
   be recorded.

3. Merge **#213**. Both repair migrations then run ahead of the failing one on
   the next deployment. If you would rather not merge everything at once, each
   file stands alone — apply it in the SQL editor and nothing else changes.

4. Re-run the deployment from **Actions → Controlled Production Deployment →
   Run workflow**. Do not use the Vercel dashboard's Redeploy button: that is
   what took the alias on 4 August and is why the workflow header exists.

5. If it fails again, read *which kind* of error it is before acting:
   `relation ... does not exist` is a missing table and belongs in the 42-table
   repair; `column ... does not exist` is a missing column and belongs in the
   shape repair. Both files are generated — regenerate them, do not hand-edit.

Take a backup first. Both repairs are additive and idempotent, but the decision
is yours and the checkpoint costs nothing.

**What the shape repair deliberately does not do:** it adds columns nullable and
without their primary key, unique or foreign key clauses, because a table that
already holds rows cannot take those. So it gives production the columns later
migrations need and *not* full referential parity with a fresh replay. That
divergence is real and stated rather than hidden; closing it needs the dump in
step 1.

### Why no check caught it

`verify:migration-replay` runs against an **empty** database, which is what lets
it prove the migrations agree with each other. It never reads production's
history, so it cannot see a migration marked applied that did not run. That
limit is now stated in the command's own output rather than left to be inferred.

The deploy workflow was honestly red for fourteen consecutive runs. Nothing was
watching it.

</details>

## Before any of the above: what has to be switched on

`docs/owner/WHAT-MUST-BE-ON.md` lists the ten environment variables a paying
customer cannot be served without, the one that must never be on in production,
and the one that turns the leaked-password warning into a gate. `pnpm run
verify:env` checks that classification on every release.

## Not a step, but read it before you rotate the Supabase service role key

**Rotating `SUPABASE_SERVICE_ROLE_KEY` will break every unsubscribe link already
sitting in a customer's inbox — unless you set `SONARA_UNSUBSCRIBE_SECRET` first.**

Nothing here needs doing today. This is the one consequence of that rotation
that is not obvious, and it is written down because the alternative is
discovering it from a complaint.

### Why the link depends on that key at all

A Growth Studio campaign carries a per-recipient unsubscribe link, and
`lib/growth-studio-dispatch.cjs` **refuses to send a campaign it cannot build
one for.** The link is signed, so a stranger holding one cannot use it against
anybody else.

Signing needs a secret. Rather than making the whole sending feature wait on you
setting one, `lib/growth-studio-unsubscribe.cjs` derives its signing key from
`SUPABASE_SERVICE_ROLE_KEY` — already required, already server-only, present
wherever this application runs at all. So campaigns work on deploy with nothing
for you to do.

The cost is that the signature is tied to that key's value. Rotate the key and
links signed under the old one stop verifying. Somebody who presses Unsubscribe
in an email from last month gets "this link does not work" and a note telling
them to reply and ask — honest, and worse than the link simply working.

### If you ever do rotate it

1. Generate a long random value and set it as `SONARA_UNSUBSCRIBE_SECRET` in
   Vercel, for Production, Preview and Development:

   ```
   vercel env add SONARA_UNSUBSCRIBE_SECRET production --no-sensitive
   ```

   Use `--no-sensitive` for the same reason the `STRIPE_PRICE_*` variables need
   it: a Sensitive variable pulls through as `[SENSITIVE]` and cannot be read
   back for verification.

2. Deploy, and send one campaign. Links from then on are signed with the new
   secret and survive any future service-role rotation.

3. Then rotate `SUPABASE_SERVICE_ROLE_KEY`.

**Setting `SONARA_UNSUBSCRIBE_SECRET` is itself a key change**, so doing it
invalidates the links signed before it, in exactly the same way. There is no
order that preserves old links; the choice is only about which cut-over you take
and when. Earliest is cheapest, because the number of links in the wild is
smallest.

`pnpm run verify:env` classifies the variable as optional, which is what makes
"unset" a supported state rather than a misconfiguration.

## 9 — Choose the database + Storage recovery mechanism

> Status verified 24 September 2026: the connected Supabase organization
> reports the Free plan. Do not treat PITR as available on the current
> environment.

Every production deployment records a UTC pre-migration checkpoint and a
schema-only dump. Those are useful rollback evidence, but neither contains
customer data. Supabase database backups also do not restore Storage objects.

### Choose one controlled path before destructive production migrations

1. **Paid/PITR path:** move to an eligible paid plan, explicitly enable PITR,
   record the retention window, and restore a dated checkpoint into an isolated
   environment before relying on PITR operationally.
2. **Logical-backup path:** create a database logical backup, store it in
   approved off-site backup storage rather than GitHub, separately copy the
   required Supabase Storage objects, and rehearse restoring both into an
   isolated environment.

For either path, record measured restore time, the oldest recoverable point,
object-count reconciliation, database row/checksum reconciliation where
appropriate, and the exact date of the drill.

Do **not** put customer database dumps, Storage objects, service-role keys, or
other credentials in GitHub Actions artifacts.

Until one of those paths has a completed restore drill, SONARA has rollback
instructions and schema evidence, but it does not have proved customer-data
recovery.

## 10 — Let campaign emails report what happened to them

Added 7 October 2026. A Growth Studio campaign records that the email provider
*accepted* each message. Whether it then reached the inbox, bounced, was marked
as spam, was opened or had a link followed only reaches this application if
Resend is told where to report it. Until then a campaign's page says "Delivered
to the provider" and nothing after that, and says why.

### Do this

1. In the Resend dashboard, open **Webhooks** and add an endpoint:

   ```
   https://sonaraindustries.com/api/webhooks/resend
   ```

2. Subscribe it to these events: `email.delivered`, `email.delivery_delayed`,
   `email.bounced`, `email.complained`, `email.opened`, `email.clicked`,
   `email.failed`, `email.suppressed`.
3. Copy the endpoint's signing secret (it starts with `whsec_`) into Vercel
   Production as `RESEND_WEBHOOK_SECRET`, and redeploy.
4. Apply migration `20261007130000_what_happened_to_a_campaign_email.sql`.

### How to tell it worked

Send a campaign to an address you own. Within a minute its page under
**Growth Studio → Your campaigns** shows **What happened to the emails**, with the
message counted under *Reached the inbox server*.

Opens and clicks are only reported if open and click tracking are switched on
for the sending domain in Resend. Leaving them off is a reasonable choice: the
page says so rather than showing a low number as if nobody read the email.

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
