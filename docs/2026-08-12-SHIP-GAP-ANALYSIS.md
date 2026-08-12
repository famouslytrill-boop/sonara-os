# What is actually left before this can ship

Review by: 2026-09-12

Analysis date: 2026-08-12, at `be0e28a`. Measured against the running
application rather than against the earlier planning documents, because two of
the things below are not in them.

## The engineering gate is green

`pnpm run verify:launch` passes all nineteen commands. 1,610 tests pass. The
catalog reports 34 products, 13 execution-enabled, and **entitlement integration
is verified for all 13** — there is no product that can run without the server
checking whether the customer paid for it.

The 21 restricted products are restricted for stated reasons (13
validation-required, 1 planned, and 7 `sonara_industries` entries that are pages
rather than executable products). That split is disclosed on the site. It is a
smaller launch than the catalog implies, and it is honestly labelled, so it is
not a blocker.

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
