# What is actually left before this can ship

Review by: 2026-12-15

Analysis date: 2026-08-12, at `be0e28a`. Measured against the running
application rather than against the earlier planning documents, because two of
the things below are not in them.

## The engineering gate is green

`pnpm run verify:launch` passes every command in the chain. The catalog reports
23 products, all 23 execution-enabled, and **entitlement integration is verified
for all of them** — there is no product that can run without the server checking
whether the customer paid for it.

This paragraph originally read "34 products, 13 execution-enabled" and called
the 21 restricted ones "a smaller launch than the catalog implies, honestly
labelled, so not a blocker". Two rounds of work since have closed that gap from
both ends. Eight of the 21 were only mislabelled and were opened. The other
eleven described work that does not exist and were removed from the catalog,
with `supabase/migrations/20260812120000_retire_removed_catalog_products.sql`
retiring their published rows — without it `/service-catalog` would have gone on
serving all eleven from the database, which merges over the code.

An honest label on a product that does nothing is still a product that does
nothing. The catalog is now shorter and every entry in it opens.

**So the remaining work is not code quality.** It is four things, and two of them
are not written down anywhere else.

---

## 1. The legal pages are placeholders, not policies

**This is the largest gap and the cheapest to close.** Every legal page is a stub
of three sections with headings literally named `Section 1`, `Section 2`,
`Section 3`:

| Page | Words |
|---|---|
| `/legal/privacy` | ~60 |
| `/legal/terms` | 78 |
| `/refund-policy` | 73 |
| `/acceptable-use` | 73 |
| `/earnings-disclaimer` | 68 |
| `/cookies` | 157 |

The privacy policy in full is three sentences. It does not mention **retention,
deletion, erasure, export, portability, or any customer right over their data** —
none of those words appear on the page. Its third sentence reads "Customer data
*should* be handled according to consent, retention, and organization access
controls", which describes an intention rather than a commitment the company is
making.

It also names **none of the four companies that actually process customer data**:
Supabase stores it, Stripe takes the payments, Resend sends the mail, Vercel
runs the server. A customer putting their own customers' names, emails, phone
numbers and invoices into this product is handing personal data to four
sub-processors none of which are disclosed.

`/refund-policy` is 73 words, and live Stripe prices exist at $7, $19 and $39 a
month. Taking card payments against a 73-word refund policy is the kind of gap
that turns into chargebacks rather than support tickets.

### Why this is being raised as a shipping item

`docs/SHIP_READINESS.md` removed legal review from the owner list, reasoning that
it "is not a shipping step — it is a decision about engaging counsel, and parking
it on this list meant the list had a permanent item nobody could close."

**That reasoning is right about counsel and wrong about the pages.** The problem
here is not that the terms are unreviewed. It is that they are unwritten. A
substantive privacy policy — what is collected, how long it is kept, who else
processes it, how a customer gets a copy or gets it deleted, how to ask — can be
drafted without a lawyer, and reviewed by one later. "Section 1" is not an
unreviewed policy; it is a placeholder that has been shipped as far as the
footer.

Nothing in this repository is dishonest about it: every page says the terms are
not legal advice, and `tests/server.test.js` asserts no page claims attorney
review. That disclaimer is doing a lot of work.

**Not legal advice, and not a legal opinion** — this is a report that the pages
are placeholders, which is a matter of fact and not of judgement.

---

## 2. There is no way for a customer to leave with their data, or to be forgotten

`/account` offers profile, security, preferences, workspaces, integrations and
setup. It offers **no account deletion and no data export.**

Record-level erasure is a deliberate, recorded decision:
`lib/sonara-module-crud.cjs` archives rather than hard-deletes, and says "a
customer who genuinely wants data erased is a support request, not a stray
click." That is sound reasoning for a single mistyped lead.

Account-level erasure and portability are a different question, and there is no
recorded decision on them at all — they are simply absent. For a product whose
whole pitch is that a business's records live in one place, "how do I get them
out" and "how do I close this and have it gone" are questions a customer will
ask in the first month.

Cancellation *is* covered: `server.js` opens a Stripe billing portal session,
which handles cancelling, payment methods and invoices. So a customer can stop
paying. They cannot leave.

---

## 3. Nobody has completed a paid signup in production

Unchanged, owner-only, and now the *only* unknown left in the paid path rather
than one of several. Everything around it checks out:

- The three advertised prices exist in the live Stripe account, active, on
  active products, charging exactly 700, 1900 and 3900 (verified read-only,
  2026-08-12; ids are in `docs/owner/OWNER-STEPS.md`).
- Entitlement integration is verified for all 13 executable products.
- The checkout path compares the price against the advertised amount before
  charging, and refuses on mismatch.

What a real purchase proves is the part none of that covers: that the webhook
lands, the entitlement is written, and the product opens.

---

## 4. Three security and schema steps, all owner-only

Documented in `docs/owner/OWNER-STEPS.md` and unchanged: the Supabase
leaked-password toggle plus its ratchet variable, exporting the four
authorization functions that exist in the live database and in no migration, and
trying one `EXECUTE` revoke on a preview branch.

The middle one is worth restating because it is easy to read past: **four
authorization primitives exist in production and in no version control.** An
authorization function nobody can read is one nobody can review.

---

## Suggested order

1. **Write the six legal pages properly.** No dependencies, no credentials, and
   it is the only item here that is currently a stub pretending to be finished.
2. **Decide the deletion and export position**, then either build the two paths
   or record the decision the way record-level erasure was recorded. Either is
   defensible; silence is not.
3. **Run the paid signup** (owner).
4. **The three security steps** (owner).

Items 1 and 2 can be done by anyone. Items 3 and 4 cannot be done from inside
this repository at all.

## What not to spend effort on before launch

Pricing, market position, the 3D and depth work, and the differentiator copy are
researched, applied, and bound to tests that fail if the claims stop being true.
The remaining 21 catalog products are disclosed as unavailable. None of that is
what is standing between this and a first paying customer.

---

## Update, same day: items 1 and 2 are done, and two corrections

**Correction to this document.** It said the legal surface was six pages and that
sub-processors were named nowhere. Both were wrong. There are **fourteen** legal
pages, and `/legal/data-processing` already named Supabase, Vercel, Stripe and
Resend — I had checked only `/legal/privacy`. Several pages were already
substantive: the cookie policy is specific and accurate, and the sub-processor
notice exists.

What survived checking: the *thin* pages were thin, the placeholder `Section N`
headings were real, and **retention, deletion, export, erasure and portability
appeared nowhere across any of the fourteen** — that part held.

**Item 2, done.** `/account/data` says what is kept, for how long, how to take a
copy, and how to ask for erasure. Export is immediate. Erasure is a request,
because AGENTS.md forbids automating destructive changes without owner approval
and `sonara-module-crud.cjs` had already settled the same question for a single
record. The export names any record type it could not read rather than omitting
it silently.

**Item 1, three pages done.** Privacy 76 → 396 words, refunds 73 → 241, terms
78 → 278, all with real headings. They describe only what the product does, and
`tests/data-rights.test.js` binds each claim to the behaviour: the export
promise fails if the route goes, the erasure wording fails if the handler starts
deleting, and the refund page fails if it ever promises an automatic refund.

**Item 1, finished.** All fourteen legal pages are written: 2,942 words across
the surface, no placeholder headings anywhere.

Writing the remaining eight surfaced two pages my earlier assessment had called
"already substantive" — the cookie policy and the data-processing page. Their
*content* was substantive and their *headings* were still `Section 1`,
`Section 2`, `Section 3`, because they passed plain strings rather than
title-and-body pairs. I had read the source and not the rendered page. The
sub-processor notice was also genuinely thin at 95 words, and now names the four
processors, says what each receives, and says where they are.

`tests/data-rights.test.js` holds the whole surface rather than the pages
somebody happened to rewrite: every legal page must render, must not use
placeholder headings, and must clear a word floor — three sentences is not a
refund policy for a product taking card payments, whatever those sentences say.
Four more claims are bound to behaviour: the AI page's "off until configured"
fails if adapters stop defaulting off, the payment page's "checked against the
amount Stripe holds" fails if the mismatch guard goes, the security page's
"fails the build" fails if the client-secret scan leaves the release chain, and
the accessibility page's reduced-motion promise fails if the stylesheet stops
honouring it.

---

## Re-verified 2026-09-15, at `85f1db3`. Four of its figures were stale and its central evidence no longer exists.

`report-stale-claims.mjs` flagged this document three days past its review date.
The rule that follows is the script's own: *"Re-verify the claim, then move the
date. Moving the date without looking is the one thing this cannot catch."* So
everything below was measured today, and the date above moved only after.

**The engineering gate is still green.** `pnpm run verify:launch` and
`pnpm run verify:gates` both exit 0, with the chain at 46 commands.

### The catalog figures were wrong twice over

This document says **23 products, all 23 execution-enabled** in its opening
section and **"all 13 executable products"** in item 3. Those cannot both be
right; the 13 is a leftover the same-day update did not catch, and it sat here
for a month.

Both are now stale anyway. Measured today: **42 products, 42 active, 42 open, 0
restricted.**

That also kills a line under *What not to spend effort on*: **"The remaining 21
catalog products are disclosed as unavailable"** describes nothing. There are no
restricted products left.

### The evidence for "the engineering gate is green" has been removed from the codebase

This document offered, as its proof, that *"entitlement integration is verified
for all of them"*. **That field no longer exists as catalog data.** It survives
only as a comment in `lib/sonara-paid-access.cjs`, which records why it went:

> `const entitlementIntegrationVerified = planFloor === "free";`
>
> which defines "verified" as "free".

So the sentence this document leaned on was reporting a field that was false by
construction for every paid product — the defect this codebase is named for,
quoted here as a green light. The comment records what production showed:
`executionEnabled 3, executionRestricted 31`.

It is better now, and differently shaped. Paid access is an explicit map in
`lib/sonara-paid-access.cjs` that billing and the catalog both read, and
`withAnnualTwins` expands it so **a plan's annual form opens exactly what its
monthly form opens and cannot drift by omission.** Adding a key to that map is a
statement that the server checks a real entitlement. The right claim today is
about that map, not about a boolean.

### Item 3: the prices are no longer three, and the pipeline now checks them

The three this document names — 700, 1900, 3900 — are still configured, as
`starter_monthly`, `core_monthly` and `pro_monthly`. But there are now **11
plans: 9 sold through checkout and 1 quoted**, and six of the nine arrived after
the read-only verification of 2026-08-12 that this document cites:

| Plan | Advertised | Configured |
|---|---|---|
| `workspace_monthly` | $29/mo | 2900 |
| `all_three_monthly` | $59/mo | 5900 |
| `team_monthly` | $109/mo | 10900 |
| `workspace_annual` | $290/yr | 29000 |
| `all_three_annual` | $590/yr | 59000 |
| `team_annual` | $1090/yr | 109000 |

**None of those six is covered by the hand-verification this document records.**
A note saying the paid path has one unknown, while six prices were added and
never mentioned, is the kind of quiet drift this file exists to prevent.

They are covered by something better now. In the production pipeline the step
*Verify live Stripe prices match what the pricing page advertises* **passes** —
confirmed on run 171 at `3061e20`. Nine plans compared against what Stripe would
actually charge, by the pipeline, on every deploy, rather than three compared by
hand once.

### What is actually blocking the deploy, which is narrower than this document implies

The production deployment still fails, and it is no longer the price check. It
fails one step later, at **`Synchronize verified Stripe runtime secret to Vercel
production`**, and the step says exactly why:

> A full live Stripe runtime key is required. Configure the protected
> `STRIPE_RUNTIME_SECRET_KEY` secret with an `sk_live_` key; the read-only
> verifier key will not be promoted.

That is **deliberate, not broken.** PR #256 separated the read-only verifier
credential from the runtime secret, so a restricted key that is sufficient for
reading prices cannot be promoted into the production runtime. The step refuses
because the key available to it does not begin with `sk_live_`.

Everything after it is **skipped** — the rollback checkpoint, the migration
apply, and the Vercel deploy. Production is untouched and still serves its
previous build. A red workflow instead of a half-migrated database is the gate
working.

**So the single remaining deploy blocker is one named repository secret**, and it
is owner-only: nothing in this repository can set it, and it must never be pasted
into a conversation or a commit.

### Item 4: the middle claim moved

This document says *"four authorization primitives exist in production and in no
version control."* Measured today,
`scripts/report-security-definer-exposure.mjs` reports **8 of 12** advisor-named
functions are now defined in this repository as `SECURITY DEFINER`.

The remainder carries a wrinkle this document could not have known: the report
notes that **two of them read tables that exist in no migration, so creating
those functions would fail on deploy.** "Recorded is not defined" is the
report's phrase, and it means the gap cannot be closed by transcription alone.

The leaked-password item is unchanged and still owner-only, with a runnable
command in `docs/owner/OWNER-STEPS.md`
(`pnpm run enable:leaked-password -- --enable`).

### The corrected order

1. **Set `STRIPE_RUNTIME_SECRET_KEY`** to a full `sk_live_` key as a protected
   repository secret. This is the only thing standing between `main` and a
   deployed build, and it is the owner's alone.
2. **Run the paid signup** once deployed — still the one thing no check can
   prove, and now across nine plans rather than three.
3. **The two security steps**: the leaked-password toggle, and the four
   authorization functions still undefined here — two of which need their
   missing tables designed before they can be written down at all.

Items 1 and 2 of the original list (legal pages, data rights) remain done and
remain bound to `tests/data-rights.test.js`.
