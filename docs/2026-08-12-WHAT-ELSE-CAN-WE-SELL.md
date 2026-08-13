# What else can we sell, and what is costing us money now

Researched: 2026-08-12
Review by: 2026-11-12

Written 12 August 2026, after the catalog was cut from 34 products to 23 and
seven of the fourteen paid ones turned out to advertise a plan the server
refuses. Two questions: what is losing money today, and what is already built
that nobody is being charged for.

Every competitor figure below is dated and linked. Vendor pricing pages are
mostly unreachable from this build environment — the egress proxy blocks them —
so the figures come from search-result aggregators, which is weaker than a
vendor page and is said here rather than hidden. Check them against the vendor
before any of it reaches marketing copy.

---

## Part 1 — What is costing money today

> **Decided 13 August 2026.** The owner chose to widen what a plan buys rather
> than raise the seven prices, and chose a location limit per plan rather than a
> per-location add-on. Both are applied. Creator Studio moved down to Starter
> and Growth Studio down to Core; the two Growth products marked Starter moved
> to Core, because growth_studio does not open below it. All 23 catalog products
> now open on the plan they advertise. Locations: Starter 1, Core 3, Pro
> unlimited, enforced in `lib/sonara-plan-limits.cjs`.
>
> One consequence to hold onto: **Pro $39 no longer opens a workspace that Core
> does not.** With three workspaces and three paid tiers, a cumulative ladder
> has three rungs, and moving two workspaces down spends two of them. Pro is the
> tier the staff and scheduling features belong in — section 2 below — and until
> they move there it is priced above what it uniquely opens.

### The seven mispriced products are one mistake, not seven

`getCustomerPaidEntitlement` matches a subscriber's plan against
`PAID_ENTITLEMENT_KEYS`. That map reads:

    business_builder: starter_monthly, core_monthly, pro_monthly, one_time
    creator_studio:   core_monthly, pro_monthly
    growth_studio:    pro_monthly

Read it as a price ladder and it looks arbitrary. Read it as what it actually
is — **a map of which workspaces a plan opens** — and it is coherent: Starter
buys Business Builder, Core adds Creator Studio, Pro adds Growth Studio.

The catalog prices products on a *depth* ladder (Starter → Core → Pro, more of
the same thing) while the entitlement map gates on *breadth* (which of the three
workspaces). Seven products sit where the two disagree, and each one is a
customer who buys the advertised plan and gets a 402.

This is direct, checkable evidence for the recommendation already written in
`docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md`: **One workspace $19, All three
$39, Team $79.** That structure makes the mismatch impossible by construction,
because the plan floor stops being a tier and becomes the thing the entitlement
map is already keyed on. The restructure doc argued from market comparison. This
is a second argument from inside the code, and it is the stronger of the two,
because it is a bug rather than an opinion.

### Growth Studio has no door below $39

Four of the seven are Growth Studio, and the cause is that `growth_studio`
accepts `pro_monthly` alone. Lead capture, landing pages, campaigns and the
consent ledger are all closed to anybody paying less than $39.

Consent is the one to look at hardest. `customer-timeline-consent-center` holds
the suppression list — the record of who asked not to be contacted. Pricing that
at $39 when the campaign tools sit at the same tier is coherent; pricing it above
the tools that send would not be, and is worth never doing by accident.

### The single change with the largest effect is still not a code change

Nobody has completed a paid signup in production. Every figure in this document
is downstream of that, and `positiveSubscribedUserTest` will keep printing
`"pending"` until somebody buys a plan with a real card and confirms the product
opened. It is item 1 in `docs/SHIP_READINESS.md` and it is the owner's.

---

## Part 2 — What is built and not being sold

Ranked by how much exists already against what the market pays for it.

### 1. Restaurant and food margin operations — the largest unsold asset

`supabase/migrations/014_sonara_restaurant_margin_ops_schema.sql` creates
**eighteen tables**: vendor accounts and invoices with line items, purchase
orders with line items, recipe cards with ingredients, menu items, POS sales
summaries, POS menu-mix items, inventory count sessions with lines, waste logs,
daily profit snapshots, bill payments, accounting exports, and inter-location
transfers with lines.

**Ten of the eighteen already have a working record page**, nine of them with a
form a customer can submit: vendors, invoices, recipes, menu, food costs,
payments to suppliers, accounting exports, purchase orders, stock counts, and
transfers.

Today this is sold as two words — "recipes, food costs" — inside *Bookings,
Staff & Day-to-Day* at Core.

MarginEdge, the closest comparable, is **$350 per location per month**, or $500
bundled with their liquor scale ([xpay, 2026](https://www.xpay.sh/saas-pricing/marginedge/),
[RestaurantTools, 2026](https://restauranttools.ai/tools/marginedge)). Their
vendor page is blocked from this environment, so treat $350 as sourced from
aggregators rather than confirmed at source.

Two orders of magnitude between that and $19 is not a rounding error, and the
gap is not explained by what is missing.

**What is missing** is eight tables with no page, and they are not evenly
important:

- `recipe_ingredients` — without it a recipe card has no ingredients, so recipe
  costing does not cost anything. This is the one that makes the product work.
- `pos_sales_summaries` and `pos_menu_mix_items` — the inputs to
  `daily_profit_snapshots`, which currently has a read-only page showing figures
  nothing can produce.
- `waste_logs` — the difference between theoretical and actual food cost, which
  is the number a restaurant owner is buying.
- `vendor_invoice_lines`, `purchase_order_lines`, `inventory_count_lines`,
  `location_transfer_lines` — line items under headers that already have pages.

That is a coherent piece of work with a clear order, and the schema for all of
it is already applied.

### 2. Team and scheduling — built, working, and given away

Six staff-portal pages (`/staff`, schedule, time, tasks, announcements,
location) plus owner pages for staff profiles, schedules, time entries and
bookings. Every one has a form. All free today.

- Homebase Essentials: **$24.95 per location per month**; payroll $39 base plus
  $6 per active employee ([Workstream, 2026](https://www.workstream.us/blog/homebase-pricing),
  [ITQlick, 2026](https://www.itqlick.com/homebase/pricing))
- Deputy Lite: **$5 per user per month**, Core $6.50 ([ITQlick, 2026](https://www.itqlick.com/compare/deputy/homebase))

`docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md` already proposes Team at $79
for exactly this. The evidence supports it: a five-person business pays Deputy
$25–33 a month for less than what is being given away here.

The per-person scoping is already correct and was built deliberately — shifts,
time entries and tasks are scoped by employee record, not by organization, so a
colleague cannot read another colleague's hours. That is the hard part of a
staffing product and it is done.

### 3. Fleet and maintenance

`vehicle_records` and `maintenance_logs`, both with pages and forms. Sold today
as one word, "vehicles", inside the same Core product.

Fleetio: **$4 per vehicle per month** on Essential, $7 Professional, $10
Premium, five-vehicle minimum ([PricingNow, 2026](https://pricingnow.com/question/fleetio-pricing/),
[Capterra, 2026](https://www.capterra.com/p/120855/Fleetio/)).

Small numbers per vehicle, but it is a per-unit axis on a plan that currently has
none, and a trades business with six vans is a different customer from a sole
operator. `lib/sonara-record-checks.cjs` already carries the domain logic —
"an unregistered vehicle on the road is a bigger problem than a renewal fee".

### 4. Multi-location — done

`business_locations`, `location_transfers` and `location_transfer_lines` exist
with pages. Multi-location is the standard upsell axis in every product in the
comparison set — MarginEdge and Homebase both price *per location* — and this
product charged per account regardless of how many a customer ran.

Applied 13 August 2026 as an allowance rather than an add-on: **Starter 1, Core
3, Pro unlimited**, in `lib/sonara-plan-limits.cjs` and enforced when a location
is created. An add-on would have needed a Stripe price object that does not
exist and that only the owner can create; an allowance needs the count and the
plan, both of which are already on the request.

The one thing worth knowing about the implementation: a count that could not be
read refuses with *"we could not check"* and HTTP 503, not with *"you have hit
your limit"* and 402. Those are different sentences and only one of them is true
when the read failed — which is the failure this codebase keeps finding, and the
reason `locationAllowance` returns three answers rather than two.

### 5. Data portability and erasure

`/account/data`, `/account/data/export` and the erasure request path are built
and working. In the comparison set this is normally a Business or Enterprise line
item. It is not a product on its own for a sole operator, but it is a reason a
larger customer picks a tier.

### 6. Not yet sellable, and worth saying why

**Agent approvals.** `lib/sonara-agent-authority.cjs`, the runner, the action log
and `/owner/agent-activity` are real and enforced. But nothing re-runs an action
after approval — it is written in `CLAUDE.md` in those words — so a gated action
stops and is recorded as pending. Selling an approval workflow with no queue
behind it would be selling the gate as if it were the process. The queue is the
work that makes this sellable.

**Five orphan Creator Studio tables.** `creator_album_cycles`,
`creator_artist_profiles`, `creator_prompt_blueprints`, `creator_sonic_profiles`,
`creator_video_treatments` — created, never queried, reported every release by
`scripts/report-orphan-tables.mjs`. Schema for a product nobody built. Either
build it or drop the tables; carrying them is a standing claim that something
exists.

---

## What follows from this

In order of money per unit of work:

1. **The paid signup test.** Owner-only, blocks everything, no code.
2. ~~Resolve the seven mispriced products.~~ Done 13 August: widened.
3. ~~Price per location.~~ Done 13 August: an allowance per plan.
4. **Give Pro something of its own.** The most urgent of the rest, and it was
   created by item 2 rather than found: Pro $39 opens no workspace Core $19 does
   not. The staff and scheduling features in section 2 are the intended answer
   and they already exist.
5. **Team $79, or fold it into Pro.** Already argued in the restructure doc. If
   Pro absorbs the staff features instead, the ladder works again without a
   fourth plan -- that is the cheaper version of item 4 and worth pricing before
   building anything.
6. **Finish the restaurant product.** `recipe_ingredients` first, then POS
   summaries and menu mix, then waste logs. This is the one with a competitor at
   $350 a location.

Nothing here claims a conversion rate. There is no signup data to reason from,
and inventing one would be the exact failure this codebase keeps finding.

## Sources

- [MarginEdge Pricing 2026 — xpay](https://www.xpay.sh/saas-pricing/marginedge/)
- [MarginEdge Review 2026 — RestaurantTools](https://restauranttools.ai/tools/marginedge)
- [Homebase Pricing 2026 — Workstream](https://www.workstream.us/blog/homebase-pricing)
- [Homebase Pricing 2026 — ITQlick](https://www.itqlick.com/homebase/pricing)
- [Deputy vs Homebase 2026 — ITQlick](https://www.itqlick.com/compare/deputy/homebase)
- [Fleetio Pricing 2026 — PricingNow](https://pricingnow.com/question/fleetio-pricing/)
- [Fleetio — Capterra 2026](https://www.capterra.com/p/120855/Fleetio/)
