> **Superseded in part on 12 August 2026.** The $77 stack figure below mixed
> Jobber's annual price with Podia's monthly one. Corrected figures, and the
> transaction fees this table never recorded, are in
> `docs/market/2026-08-12-MARKET-AUDIT.md`. The per-product rows here remain
> useful as the July snapshot they are.

# Competitor pricing survey

Review by: 2026-10-28

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

## What SONARA charges

| Plan | Price | Sits below |
| --- | --- | --- |
| Free | $0 | — |
| Starter | $7 | Brevo's $9, the cheapest entry plan found |
| Core | $19 | Mailchimp's $20 and Jobber's $29 |
| Pro | $39 | Jobber, HoneyBook and Podia individually, while covering all three jobs |

Pro at $39 against a $77 stack is a real difference, not a rounding of one.
That is the comparison the pricing page makes, and it is the only competitive
claim on the page.

### The decision

These prices were briefly changed to $5 / $15 / $29 and then reverted by the
owner on 28 July 2026. **They stay at $7 / $19 / $39.**

The survey is what makes that defensible rather than accidental: Starter at $7
still undercuts every entry plan found, including Brevo's $9. Pro at $39 is
still about half what the three tools cost separately, and less than any one of
Jobber, HoneyBook or Podia on its own. The original prices were already below
the market; the survey confirmed it rather than prompting a change.

Worth knowing if this is revisited: roughly $5 a month is a practical floor.
Below it, card processing takes a visible bite — Stripe's 2.9% + 30c costs a $3
subscription about 13%, against about 8.9% at $5.

## Claims policy

`AGENTS.md` forbids unsupported claims. The pricing page therefore:

- dates the comparison ("based on published entry plans in July 2026"),
- describes the competitor total as approximate,
- names no competitor on the page itself,
- makes no promise about future pricing.

If the page is going to keep claiming ~$77, this table needs re-checking each
time prices are reviewed. It is a dated snapshot, not a standing fact.

## What has to happen before customers can pay these prices

No Stripe Price exists for any plan yet, so nothing can be bought regardless of
what the page says. The three subscription prices have to be created and the
environment variables pointed at them:

| Env var | Create a recurring monthly price at |
| --- | --- |
| `STRIPE_PRICE_STARTER_MONTHLY` | $7.00 USD |
| `STRIPE_PRICE_CORE_MONTHLY` | $19.00 USD |
| `STRIPE_PRICE_PRO_MONTHLY` | $39.00 USD |

Only the account owner can create these. Until they exist, the pricing page
shows each paid plan as not open for checkout, which is accurate — nothing is
advertised as buyable that cannot be bought.

Note for any future change: Stripe Price objects are immutable. The amount on
an existing price cannot be edited, so changing a price always means creating a
new one and repointing the environment variable.

`amountCents` in `STRIPE_PLANS` records what the page promises, and
`tests/pricing.test.js` checks the displayed string and `amountCents` agree, so
the page cannot quietly drift from the number in the config.

`pnpm run verify:stripe` goes one step further: when `STRIPE_SECRET_KEY` is
present it fetches each configured Price from Stripe and fails if the amount,
currency, billing interval, or active state disagrees with what the page
advertises. Without a key it skips and says so. Run it once the prices above
exist, before opening checkout.

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
