# Competitor pricing survey and the SONARA price change

Surveyed 28 July 2026. Every figure below is a published entry-level plan
billed monthly, taken from the vendor or from a pricing review dated 2026.
Annual billing is usually cheaper; we compare monthly-to-monthly because that
is what somebody starting out actually pays.

## What comparable tools charge

### Business side — bookings, quotes, invoices, customers

| Tool | Entry plan | Monthly |
| --- | --- | --- |
| Jobber | Core, 1 user | $29 |
| Square Appointments | Plus | $29 (some sources report $49) |
| HoneyBook | Starter | $36 |
| Housecall Pro | Basic, 1 user | $59 |

### Creator side — products, courses, digital sales

| Tool | Entry plan | Monthly |
| --- | --- | --- |
| Podia | Mover | $39 |
| Kajabi | Basic | $143 (annual) to $179 (monthly) |
| Gumroad | — | no fixed fee, takes a cut of every sale |

### Marketing side — lists, campaigns, follow-up

| Tool | Entry plan | Monthly |
| --- | --- | --- |
| Brevo | Starter | $9 (5,000 emails) |
| Constant Contact | Essentials | ~$13 |
| Mailchimp | Standard | $20 (500 contacts) |

### The stack a small operator actually ends up buying

Jobber $29 + Podia $39 + Brevo $9 = **$77 a month**, and that is picking the
cheapest credible option in each column.

## What SONARA charged, and what it charges now

| Plan | Was | Now | Sits below |
| --- | --- | --- | --- |
| Free | $0 | $0 | — |
| Starter | $7 | **$5** | Brevo's $9, the cheapest entry plan found |
| Core | $19 | **$15** | Mailchimp's $20 and Jobber's $29 |
| Pro | $39 | **$29** | Jobber alone, while covering all three jobs |

Pro at $29 against a $77 stack is a real difference, not a rounding of one.
That is the comparison the pricing page now makes, and it is the only
competitive claim on the page.

### Why these numbers and not lower

$5 is a deliberate floor. Below roughly $5 a month, card processing takes a
visible bite out of each charge — Stripe's 2.9% + 30c means a $3 subscription
loses about 13% to fees, against about 8.9% at $5. Going lower would cost more
in margin than it wins in signups.

## Claims policy

`AGENTS.md` forbids unsupported claims. The pricing page therefore:

- dates the comparison ("based on published entry plans in July 2026"),
- describes the competitor total as approximate,
- names no competitor on the page itself,
- makes no promise about future pricing.

If the page is going to keep claiming ~$77, this table needs re-checking each
time prices are reviewed. It is a dated snapshot, not a standing fact.

## What has to happen before customers can pay these prices

Stripe Price objects are immutable — the amount on an existing price cannot be
edited. The three subscription prices have to be **created fresh** at the new
amounts, and the environment variables repointed at the new price IDs:

| Env var | Create a recurring monthly price at |
| --- | --- |
| `STRIPE_PRICE_STARTER_MONTHLY` | $5.00 USD |
| `STRIPE_PRICE_CORE_MONTHLY` | $15.00 USD |
| `STRIPE_PRICE_PRO_MONTHLY` | $29.00 USD |

Only the account owner can create these. Until they exist, the pricing page
shows each paid plan as not open for checkout, which is accurate — nothing is
advertised as buyable that cannot be bought.

`amountCents` in `STRIPE_PLANS` records what the page promises;
`tests/pricing.test.js` checks the displayed string and `amountCents` agree, so
the page can never quietly drift from the number in the config. It cannot check
Stripe itself — that needs a live API call — so **verify the created Stripe
prices match this table by hand** before opening checkout.

## Sources

- [Square Appointments pricing (Koalendar, 2026)](https://koalendar.com/blog/square-appointments-pricing)
- [Square Appointments pricing (Capterra, 2026)](https://www.capterra.com/p/170263/Square-Appointments/pricing/)
- [Jobber vs Housecall Pro pricing (ITQlick, 2026)](https://www.itqlick.com/compare/jobber/housecall-pro)
- [Housecall Pro pricing (G2, 2026)](https://www.g2.com/products/housecall-pro/pricing)
- [HoneyBook pricing (SchedulingKit, 2026)](https://schedulingkit.com/pricing-guides/honeybook-pricing)
- [Podia pricing (Kourses, 2026)](https://kourses.com/podia-pricing/)
- [Kajabi pricing (Kourses, 2026)](https://kourses.com/kajabi-pricing/)
- [Brevo pricing (Layer3Labs, 2026)](https://www.layer3labs.io/guides/brevo-pricing)
- [Email marketing tool pricing comparison (etropo, 2026)](https://www.etropo.com/marketing-tool-prices/email-marketing)
