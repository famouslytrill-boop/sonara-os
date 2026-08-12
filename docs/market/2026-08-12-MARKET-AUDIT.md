# Market audit, and a correction to our own comparison

Researched 12 August 2026 against live pricing pages and current reviews, not
recalled. Sources at the end.

The headline finding is a correction, and it goes against us in the way that
matters: **our competitor comparison was quoting annual-billing prices against
our monthly price.** The stack we say we replace is more expensive than we have
been claiming, which means the claim was both weaker and unlike-for-unlike.

---

## What the comparison set actually costs

| Product | Plan | Monthly billing | Annual billing | What our July doc recorded |
| --- | --- | --- | --- | --- |
| Jobber | Core, 1 user | **$39** | $29 | $29 |
| Podia | Mover | **$39** | $33 | $39 |
| Brevo | Starter, 5k emails | **$9** | $9 | $9 |
| **Stack** | | **$87** | $71 | **$77** |

$77 was Jobber's *annual* price plus Podia's *monthly* price plus Brevo. It is
not a stack anybody is quoted. On monthly billing — which is what a small
operator starting out actually takes — the same three cost **$87**.

## The fees the sticker price does not include

This is where the comparison gets more interesting than the monthly figures, and
none of it was in the July document.

**Podia Mover charges 5% of every digital sale.** Shaker at $89/month charges
nothing. So a creator selling $2,000 a month pays $39 + $100 = $139 on Mover, or
$89 on Shaker — the cheap plan stops being cheap at roughly $1,000 of monthly
sales.

**Brevo Starter puts Brevo's logo on your emails** unless you pay $9/month to
remove it, and has **no marketing automation** — that starts on Standard at $18.
So "Brevo $9" is $9 for branded email with no automation. Unbranded with
automation is $27.

**Jobber charges 2.9% + 30¢** on card payments taken through it.

A working stack, monthly, unbranded, with automation:

> Jobber $39 + Podia $39 + Brevo $27 = **$105 a month**, plus 5% of digital
> sales and 2.9% of card payments.

## What this does to our own numbers

`docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md` recommends **All three at $39**
against a "$77 stack". Against the corrected figures the same recommendation is
stronger, not weaker:

- Against **$87** (monthly, sticker), $39 is **45%** of the stack.
- Against **$105** (monthly, working), $39 is **37%**.

The document should quote $87 as the conservative headline and $105 as the
working figure, and both should say "monthly billing" out loud, because the
annual/monthly distinction is exactly what went wrong the first time.

**The recommended prices do not change.** Free $0 / One workspace $19 / All
three $39 / Team $79 was chosen so no existing Core customer pays more, and that
constraint is about our own customers rather than the competition.

## Where we are genuinely cheaper, and where the claim would be false

**Cheaper, defensibly.** Three workspaces for $39 against $87–$105 for three
tools. One bill, one login, one set of records.

**Cheaper in a way we cannot yet claim.** Transaction fees. We take no
percentage of a customer's sales, which against Podia Mover's 5% is the single
largest cost difference at any real sales volume — and we cannot say it in
marketing until a paid signup has completed in production, because until then we
have no evidence our own payment path works.

**Not cheaper, and we should not imply it.** Jobber Connect at $119 and Grow at
$199 buy scheduling depth, routing, and a field app that this product does not
have. A trades business with six vans is not our customer today, and pricing
against them would be selling something we cannot deliver.

## Efficiency, which is the more defensible claim

The user's framing was "cheaper *and* more efficient". Cheaper is arithmetic.
Efficient is checkable, and it is where this product is genuinely different:

**One record, not three.** A lead in Growth Studio becomes a customer in
Business Builder, gets a quote, becomes an invoice, and is chased — without
retyping. In the three-tool stack every one of those steps is a copy-paste
between products, and every copy is a chance for the figure to differ.

**Nothing invented.** Every figure on every screen comes from the owner's own
rows. The chase drafts use no model precisely so they cannot claim a reminder
nobody sent. That is a marketable difference from any tool whose selling point
is generated content.

**It says when it does not know.** Undated invoices are excluded *and reported*;
an unreadable table renders as unavailable rather than as zero. This sounds like
a small thing and it is the difference between a cash figure an owner can act on
and one they have to double-check.

## What this audit did not cover

Scalability, usability testing, and the design and 3D work are not in here.
Those need their own passes, and folding an unresearched paragraph about each
into a document titled "audit" would be exactly the kind of claim this file
exists to correct.

---

## Sources

- [Jobber Pricing 2026: Core, Connect, Grow Plans Explained](https://buyersprint.com/2026/04/17/jobber-pricing-2026/)
- [Jobber Pricing (2026): Every Plan, and the Price You'll Actually Pay](https://servically.com/blog/jobber-pricing/)
- [Podia Pricing 2026: Mover vs Shaker & the 5% Fee](https://www.ruzuku.com/compare/podia-pricing)
- [Podia Pricing 2026: Plans, Fees and Free Trial](https://kourses.com/podia-pricing/)
- [Brevo Pricing 2026: Cheap, But With Extra Costs](https://www.emailtooltester.com/en/reviews/brevo/pricing/)
- [Brevo Pricing 2026: All Plans, Cost per Email & Hidden Fees](https://smtpedia.com/brevo-pricing/)
