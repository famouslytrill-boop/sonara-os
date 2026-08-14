# What a trades owner is being sold, and what we actually replace

Source: *"The Top 12 AI Tools for Trades Business Owners"*, Profitable Tradie,
2026 — a free lead magnet for a coaching business, aimed at plumbing,
electrical, HVAC and similar owners. Read in full on 11 August 2026.

It is marketing, and that is why it is useful. A lead magnet has to name the
problems its readers actually have, or nobody downloads it. This is a list of
what our Business Builder customer believes is wrong with their week, written
by people who have sold to 4,271 of them since 2008.

**None of its wording goes into our marketing.** It is someone else's copy for
someone else's brand. What transfers are the market facts: what the tools cost,
and which jobs they do.

---

## The stack, priced

| # | Tool | Job | Entry cost | Free tier |
| --- | --- | --- | --- | --- |
| 1 | Claude | Draft estimates, scopes, objection handling | $20 | yes |
| 2 | Handoff AI | Site visit → branded proposal | $49 | no |
| 3 | SimplyWise | Photo → ballpark estimate | $19 | yes |
| 4 | QuickBooks (AI) | Bookkeeping, categorisation, cash prediction | $35 | no |
| 5 | Claude | Overdue-invoice chasing | — (same as 1) | yes |
| 6 | Float / Bauwise | 30/60/90-day cash forecast | $49 | no |
| 7 | Otter.ai | Site-visit transcription with action items | $17 | yes |
| 8 | Zapier | Glue between the other tools | $20 | yes |
| 9 | Gmail / Outlook AI | Reply drafting, thread summary | $14/user | no |
| 10 | Canva Magic Studio | Social posts, job ads, flyers | $15 | yes |
| 11 | Google Business Profile | Local search, review responses | free | free |
| 12 | AI voice receptionist | Answers and qualifies missed calls | $59 | no |

**Eleven distinct products** — Claude fills two of the twelve slots.

- **$297/month** if the owner takes the entry paid tier of each.
- **$206/month** at the floor: free tiers where offered, paid where not
  (Handoff $49, QuickBooks $35, Float $49, email AI $14, voice $59).

Both numbers matter. $206 is what a careful owner actually pays.

## What the guide says is wrong with their week

Stated as the customer's own complaint, not as our diagnosis:

- Twenty minutes on every estimate, and half-baked ones go out anyway.
- Estimates written at 10pm on a Sunday.
- Admin from 7pm to 10pm, on top of 7am–5pm in the field.
- Cash problems discovered the week payroll cannot be made.
- No training in marketing or hiring, and no time to get any.
- Missed calls while under a sink. The guide claims 85% of those never call
  back — **an unverified vendor-adjacent statistic, recorded as their claim,
  not adopted as ours.**

## What we actually do about each one

Read off the schema and `lib/sonara-record-checks.cjs` on 11 August 2026, not
recalled.

| Job | Us today | Evidence |
| --- | --- | --- |
| Quote a job | **Partial** | `quotes` holds title, `amount_cents`, status, customer. No line items, no photos, no scope generation. |
| Service pricing | **Yes** | `business_service_catalog`, and `services_without_price` flags gaps. |
| Bookings | **Yes** | `bookings`, `business_bookings`, `bookings_without_contact`. |
| Staff scheduling | **Yes** | `employee_schedules`, `employee_shifts`, `employee_time_entries`. |
| Bills you owe | **Yes** | `vendor_invoices`, `purchase_orders`, `bill_payment_records`, and `invoices_overdue_unpaid`. |
| **Invoices owed to you** | **No** | See below. |
| Cash forecast | **No** | No table matches `forecast` or `cash`. |
| Site-visit transcription | **Creator Studio only** | `audio_transcription_segments` is media-side. Nothing routes a site visit into it. |
| Review responses | **Partial** | `reviews` exists. Publishing a response is an owner-approval category under AGENTS.md. |
| Marketing content | **Yes** | Growth Studio campaigns, contacts, consent. |
| Job ads / hiring | **Yes** | `employee_job_posts`, `business_employee_invites`. |
| Missed-call capture | **No** | No table matches `call`. |
| Cross-app automation | **Partial** | `automation_rules` exists; it is not a Zapier. |

### The one that matters most

**Every money table in this schema points outward.** `vendor_invoices`,
`purchase_orders`, `bill_payment_records` are all money the business *owes*.
`payments` and `purchases` are SONARA's own Stripe billing, not the customer's.

There is no accounts-receivable table. A business using Business Builder can
record what it owes its suppliers and cannot record what its own customers owe
it.

The existing check is labelled honestly — `invoices_overdue_unpaid` says
"Supplier invoices past due" — so nothing on screen is lying. But Part Two of
that guide, the part titled *"Your business isn't broke. Your cash flow is"*,
is entirely about the receivable side, and for a trades business the receivable
side **is** the business. This is the largest single gap between what we
describe Business Builder as and what a trades owner needs from it.

Three of the twelve tools — the proposal builder, the invoice chaser, the cash
forecast — are all downstream of that one missing table. Adding it is the
highest-leverage item on this list, and it is a schema change with an owner
decision attached, so it is recorded here rather than done quietly.

## What this changes about pricing

`docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md` argues against a **$77** stack
— Jobber $29 + Podia $39 + Brevo $9 — assembled from published entry plans in
July.

That comparison is for a generalist. This document is a second one, for the
trades owner specifically, and the number is **$206 at the floor**. The
recommended "All three" price of $39 is under a fifth of it.

The $77 figure is the conservative one and should stay the headline, because it
is the cheapest credible stack and therefore the hardest to argue with. The
$206 figure belongs in the trades-specific argument, where it is accurate.

## What this document does not claim

It does not claim these twelve tools are the best available, or that the time
savings printed beside each one ("5–10 hrs/week") are measured. They are a
coaching business's marketing, and the guide offers no methodology for any of
them. The costs are checkable and the job categories are real; the hour counts
and the 85% callback figure are theirs.

It also does not claim we should build all twelve. Several are paid products
whose function conflicts with the no-cost requirement, and one — the voice
receptionist — answers a customer's phone, which is squarely inside the
owner-approval categories in AGENTS.md.
