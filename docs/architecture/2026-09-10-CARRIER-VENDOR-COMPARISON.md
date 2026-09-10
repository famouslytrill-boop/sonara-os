# Which carrier, and what it costs — the last capability gap

Review by: 2026-12-10

`lib/sonara-telephony.cjs` decides whether a call may be answered or a text may
be sent, prices it, and classifies what an agent may do on the call. It dials
nothing. `SONARA_TELEPHONY_PROVIDER_URL` is the adapter variable and no runtime
file reads it.

This is the document that closes that. It is a **vendor decision, not an
engineering one** — the adapter shape is already settled and provider-agnostic —
so what follows is the price working, the constraints that are not about price,
and a recommendation with its reasoning exposed.

Every figure below was read on **10 September 2026** from the vendor's own
public pricing page, for **US, pay-as-you-go, no committed volume**. Nothing
here is from memory, and nothing is a quote we have been given.

---

## The correction this document was written for

`lib/sonara-paid-capabilities.cjs` priced `telephony` at **3.0 minor units** per
`message_or_minute` against a floor of **0.8**, and the only justification in the
comment was that "a carrier bills per message and per minute and there is no
version of this that does not."

That is an explanation of why a floor exists. **It is not a source for 0.8.**

Checked against real prices, 0.8 was below the true cost on *every* vendor and
every direction. The floor is now **1.4**, sourced, and the margin this
codebase reports dropped from a claimed 3.75× to an actual **2.14×**.

**The specific thing that made it wrong: US carrier surcharges.** They are a
mandatory pass-through neither vendor controls or marks up, and a floor built
from a base rate alone understates every single SMS.

| Carrier | Surcharge per message part |
|---|---|
| AT&T | $0.0035 |
| T-Mobile USA | $0.0045 |
| Verizon Wireless | $0.0045 |

Identical on both vendors, because it is not theirs.

---

## The price working

### Per-unit cost, US, read 10 September 2026

| Unit | Twilio | Telnyx | Telnyx advantage |
|---|---|---|---|
| Outbound SMS (base) | $0.0083 | $0.0040 | **2.1× cheaper** |
| Outbound SMS (base + worst surcharge) | **$0.0128** | **$0.0085** | 1.5× cheaper |
| Outbound voice / min | $0.0140 | $0.0050 | **2.8× cheaper** |
| Inbound voice / min (local) | $0.0085 | $0.0032 | **2.7× cheaper** |
| Inbound voice / min (toll-free) | $0.0220 | not compared | — |
| Number rent / month (local) | $1.15 | not compared | — |
| Number rent / month (toll-free) | $2.15 | not compared | — |

Sources: `twilio.com/en-us/sms/pricing/us`, `twilio.com/en-us/voice/pricing/us`,
`telnyx.com/pricing/messaging`, `telnyx.com/pricing/elastic-sip`.

### What that means against our 3.0 price

| Vendor and unit | Real cost | Our price | Margin | Margin as % of price |
|---|---|---|---|---|
| Telnyx inbound voice | 0.32 | 3.0 | 2.68 | 89% |
| Telnyx outbound voice | 0.50 | 3.0 | 2.50 | 83% |
| Telnyx outbound SMS | 0.85 | 3.0 | 2.15 | 72% |
| Twilio inbound voice (local) | 0.85 | 3.0 | 2.15 | 72% |
| Twilio outbound SMS | 1.28 | 3.0 | 1.72 | 57% |
| Twilio outbound voice | **1.40** | 3.0 | 1.60 | 53% |
| Twilio inbound toll-free | **2.20** | 3.0 | 0.80 | **27%** |

All figures in minor units (one minor unit = one cent).

**The floor is set at 1.40** — Twilio's outbound voice minute, the worst
plausible case on a local number. Deliberately the worst rather than the likely
one: a floor exists to prove we are not selling at a loss, so erring high is the
safe direction.

**Toll-free inbound at 2.20 is not covered by that floor**, and is called out
rather than averaged away. It would need its own capability or a higher price.
Nothing offers phone numbers yet, so the decision is not owed today — but it is
owed before a toll-free number is ever rented.

---

## Two costs this pricing model cannot express

Both are recorded here because the alternative is discovering them on an
invoice.

**A phone number costs fixed monthly rent.** $1.15 local, $2.15 toll-free on
Twilio. `sonara-paid-capabilities.cjs` is entirely per-unit, so **a customer
with a number costs money in a month they send nothing.** At $1.15/month a
number needs ~39 billed units a month just to cover its own rent at our margin.
That is a pricing-model gap, not a rounding error: it wants either a per-number
monthly line on the plan or a bundled allowance the plan price absorbs.

**A2P 10DLC registration is a real onboarding cost and a real delay.** Twilio's
page states that "US A2P 10DLC are subject to registration onboarding fees" and
Twilio charges "$0.001 per message" for messages terminating in failed status.
Registration is per-brand and per-campaign, it is not instant, and **it gates
outbound SMS entirely** — a customer cannot text anybody until it clears. Any
launch plan that treats SMS as switch-on-and-go is wrong about the timeline.

---

## What is not about price

Price says Telnyx. Four things do not, and they are why this is the owner's
decision rather than arithmetic.

**Inbound voice needs somewhere to answer.** Both vendors will deliver an
inbound call to a webhook, and **a serverless function cannot hold a call**.
`docs/architecture/EXTERNAL-SERVICES.md` is the rule here: a function cannot see
a machine the owner runs. Answering a call means either the vendor's own
hosted voice-agent product or a long-running process somewhere that is not this
application. **That constraint is identical on both vendors and is the real
work**, not the per-minute rate.

**Support and account risk.** Twilio is the larger, more documented, more widely
integrated vendor; Telnyx is cheaper and smaller. For a product whose customers
are small businesses whose phones matter to them, an outage is not a line item.
Neither page tells us anything checkable about this, so it is a judgement and is
labelled as one.

**Number portability and lock-in.** Once customers' business numbers live with a
vendor, moving is a per-number porting exercise with the customer's involvement.
This is the decision that is hardest to reverse later, which argues for weighting
support and stability above the 2-3× price gap.

**Compliance surface.** 10DLC registration, consent records, and opt-out
handling are ours regardless of vendor. `growth_contact_consents` and the
unsubscribe path already cover email; **SMS opt-out (STOP/UNSTOP) is a separate
legal obligation nothing here implements yet.** Whichever vendor is chosen, that
is code we owe before the first text.

---

## Recommendation

**Telnyx for cost, on local numbers, if and only if the answering side is solved
first.**

The reasoning, stated so it can be argued with:

1. The price gap is real and large — 2.1× to 2.8× on every unit compared — and
   it lands directly on a margin that is 53% at the Twilio floor and 83% at the
   Telnyx one.
2. **The hard part is not the vendor.** It is that a serverless function cannot
   answer a phone. Choosing a vendor before deciding *where a call is answered*
   buys nothing, because the adapter is provider-agnostic either way and the
   variable is already named.
3. So the order is: decide the answering architecture, then pick the vendor,
   then write the adapter. Picking first is picking the easy half.
4. **Start with local numbers, not toll-free.** Toll-free inbound is the one unit
   whose real cost (2.20) leaves only 27% margin at our price, and it is the one
   the floor does not cover.

**If the owner prefers Twilio anyway, the pricing still works** — 53% margin at
the worst covered unit — and the floor is already set to Twilio's number, so
nothing in the code needs to change for that choice. That is the point of
setting the floor to the worst plausible case rather than the expected one.

---

## What is settled, and what this document does not decide

Settled and in code: the decision core, the per-channel consent rule, the
inbound/outbound asymmetry, the classification of what an agent may do on a
call, and now a sourced floor.

Not decided here, and each is the owner's:

1. **The vendor**, per the recommendation above.
2. **Where an inbound call is answered**, which should be decided first.
3. **Whether toll-free is offered**, which needs its own floor or price.
4. **How a number's monthly rent is charged**, since the per-unit model has no
   place for it.
5. **Whether `book_appointment` may run unattended** — it needs approval today,
   which makes an AI receptionist weaker than Jobber's, and it is a one-line
   change in a module the release chain checks.

Not decided and **ours, not the owner's**: SMS STOP/UNSTOP handling.

Since this document was written, the two halves of it that do not need a vendor
have been built. Enforcement was already there — a withdrawn consent makes
`authoriseOutbound` refuse before anything is spent. Recognition is now
`lib/sonara-sms-keywords.cjs`, which reads a reply against the **union** of both
vendors' documented keyword lists, because the set a contact can rely on must
not narrow the day the carrier changes: `REVOKE` and `OPTOUT` are Twilio's and
not Telnyx's, and `stop all` with a space is Telnyx's and not Twilio's.

**What is still owed is the inbound webhook that writes the withdrawal**, and
that one genuinely waits on the vendor, because verifying a webhook signature is
the one part of this that differs between them.

Two things learned from their pages that change how it must be built:

- Twilio: `YES` "will not work to opt-in a previously unsubscribed user."
  Recording it as permission would put "reachable" in our record while the
  network still refused the number.
- Both carriers reply to an opt-out automatically by default, and Telnyx sends
  "a generic unsubscribed message from the number that received the opt out
  message." So **a confirmation from us on top of that is two texts about
  stopping texts**, and a confirmation from nobody is an unmet obligation. It
  depends on a setting in an account nobody has opened, so it is reported as
  unknown rather than defaulted.
