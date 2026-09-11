# Where an inbound call is answered

Review by: 2026-12-11

`docs/architecture/2026-09-10-CARRIER-VENDOR-COMPARISON.md` recommends Telnyx on
cost and then says the vendor should not be chosen first, because **a serverless
function cannot hold a call** and that constraint is identical on either carrier.
This is the research on that prior decision, so it can be made rather than
studied again.

Every figure below was read on **11 September 2026** from the vendor's own public
page, and every architectural claim is quoted rather than summarised. Where a
page does not answer something, this says so instead of filling the gap.

---

## The constraint, stated exactly

This application is Express on Vercel serverless functions. Two properties
matter and neither is a setting:

1. **A function ends.** Vercel's documented default duration is 300 seconds. A
   call is not bounded by that.
2. **A function cannot hold a socket.** There is nowhere for a bidirectional
   audio stream to live between invocations.

So the question is not "which AI" but **who holds the call for its duration**.
Four answers, and one of them is not an answer at all.

---

## A — A fully hosted agent, reached over a SIP trunk

ElevenLabs Agents, `elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking`:

> "Calls from your SIP trunk are routed to the ElevenLabs platform using your
> configured SIP INVITE address."

**Nothing of ours holds the call.** The carrier delivers it to them.

Three things on that page matter beyond the mechanism:

> "ElevenLabs is compatible with most standard SIP trunk providers including
> Twilio, Vonage, RingCentral, Sinch, Infobip, **Telnyx**, Exotel, Plivo,
> Bandwidth, and others that support SIP protocol standards."

So **this option does not constrain the carrier decision** — it works with
either candidate, which is the reason it can be decided first.

> "SIP trunking allows you to connect your existing phone numbers directly to
> ElevenLabs' ElevenAgents **without porting them**."

That directly addresses the lock-in risk the carrier comparison called the
hardest to reverse: the number stays with the carrier and the agent is attached
to it, so leaving the agent is not a porting exercise.

And a `transfer-to-number` system tool exists, which is the escalation path a
receptionist needs — the call reaching a person when the agent cannot help.

**We already integrate this vendor.** `routes/creator-generation-routes.cjs`
already calls ElevenLabs for generation, so this is a new product on an existing
relationship rather than a new vendor to onboard.

### Cost, from `elevenlabs.io/pricing/api`

| | Included agent minutes | Per-minute beyond | Concurrent calls |
|---|---|---|---|
| Free / pay-as-you-go | 15 | $0.160 | 4 |
| Starter, $6/mo | 75 | $0.160 | 6 |
| Creator, $22/mo | 275 | $0.160 | 10 |
| Pro, $99/mo | 1,238 | $0.160 | 20 |
| Scale, $299/mo | 3,738 | $0.160 | 30 |
| Business, $990/mo | 12,375 | $0.160 | 40 |

The page also prints a base rate of **$0.08 per minute** for Agents. It labels
$0.160 "Burst pricing (per minute)". **What exactly triggers burst is not stated
on that page and I did not confirm it**, so both figures are carried and the
costings below use $0.08 as the floor and note where $0.160 changes the answer.

**The concurrency column is a product ceiling, not a line item.** As printed
these are account limits, and the account would be ours — so on the $990 plan
*every SONARA customer shares 40 simultaneous calls*. Whether that is per
account or per agent is not stated on the pricing page. For a receptionist sold
to businesses whose phones matter to them, that number needs confirming before
it is sold, not after.

---

## B — Twilio ConversationRelay, which is not a hosted answer

Its documentation reads like Twilio holds the call. It does not.

`twilio.com/docs/voice/conversationrelay` shows the connection as:

> `connect.conversationRelay({ url: 'wss://mywebsocketserver.com/websocket', welcomeGreeting: 'Hi! Ask me anything!' });`

and divides the work:

> "Let Twilio handle the heavy lifting of speech recognition, text-to-speech, and
> voice synthesis, so you can focus on building your application."
>
> "Your application uses AI to analyze the text and generate a response."

**`mywebsocketserver.com` is ours.** Twilio does the speech; we host the socket
that stays open for the length of the call. A serverless function cannot.

So B is not a third option — **it collapses into C**, and it is listed
separately only because its marketing does not read that way and somebody will
otherwise reach for it as the Twilio-native answer.

No pricing appears on that page.

---

## C — A long-running process somewhere that is not this application

The `docs/architecture/EXTERNAL-SERVICES.md` pattern: a service the owner runs,
reached over a tunnel, a VPS, or a host the functions can already resolve, and
an adapter obeying that document's four rules — off by default, never a
dependency, never render its configuration, validate anything that becomes part
of a request.

That document's own warning applies with more force here than anywhere it was
written for: **a serverless function cannot see the owner's laptop.** A tunnel
from a laptop is a fine way to try Ollama. It is not a place to answer a
customer's business calls, because the failure mode is a small business's phone
not ringing.

So C in practice means a VPS or managed container that somebody operates,
monitors and patches — a second deployment whose uptime a customer's phone
depends on. That is a real ongoing cost in attention rather than dollars, and it
is the honest reason to prefer A unless something forces it.

**C is the right answer only for a reason A cannot serve**: data residency, a
model that must be self-hosted, or a volume where $0.08/min loses to owning the
inference.

---

## D — Forward the call. No AI, no server, no new vendor.

The option none of the vendor pages lists, because none of them sells it.

An inbound call to the business's number is forwarded to the owner's own mobile.
The carrier holds both legs. Nothing of ours holds anything, and **no answering
architecture is needed at all.**

Cost is one inbound minute plus one outbound minute, both already sourced in the
carrier comparison:

| Carrier | Inbound (local) | Outbound | Total cost | Our price | Margin |
|---|---|---|---|---|---|
| Telnyx | 0.32 | 0.50 | **0.82** | 3.0 | 73% |
| Twilio | 0.85 | 1.40 | **2.25** | 3.0 | 25% |

All figures in minor units; one minor unit is one cent.

**Forwarding fits inside the existing telephony price on Telnyx and is thin on
Twilio** — a third place where the two decisions interact, and another point for
Telnyx.

It needs only the carrier adapter, which is already the one named engineering
gap. It is a smaller product than an AI receptionist and it is not a pretend
version of one: "your business gets a number, and it rings you" is a true
sentence that competes with nothing and disappoints nobody.

---

## The finding that changes the price list

`lib/sonara-paid-capabilities.cjs` prices `telephony` at **3.0** minor units per
`message_or_minute` against a floor of **1.4**. That floor is sourced, and it is
sourced for **the carrier minute only**.

An AI-answered minute costs the carrier minute **plus the agent**:

| | Agent | Carrier inbound | Total cost | Our 3.0 price |
|---|---|---|---|---|
| ElevenLabs base + Telnyx | 8.00 | 0.32 | **8.32** | sells at **36% of cost** |
| ElevenLabs base + Twilio | 8.00 | 0.85 | **8.85** | sells at **34% of cost** |
| ElevenLabs burst + Telnyx | 16.00 | 0.32 | **16.32** | sells at **18% of cost** |

**So an AI receptionist billed as `telephony` would sell at roughly a third of
its cost, and a sixth at burst.** `verifyMargins()` would not catch it, because
the capability's floor is correct for what it was measured against — the failure
would be billing a new thing through an old capability, which is the same shape
as the toll-free case one document over, with a far bigger gap.

**An AI receptionist needs its own capability, its own sourced floor and its own
price.** Nothing offers one today, so nothing is mispriced today; this is
recorded so it is met here rather than on an invoice. The telephony comment in
`sonara-paid-capabilities.cjs` now says its floor excludes answering, and
`tests/a-cost-floor-is-a-figure-somebody-checked.test.js` asserts that it says
so.

---

## Recommendation

**Ship D, then A as a separately priced capability. Not B. C only on cause.**

1. **Forwarding first.** It needs nothing that is not already the named gap, it
   is within margin on the recommended carrier, and it closes "nothing here
   answers a phone" for every customer without a new vendor, a new server, or a
   new price. A product that rings the owner beats a receptionist that does not
   exist.
2. **Then the hosted agent, priced separately.** Fully hosted, works with either
   carrier, keeps numbers unported, reuses a vendor already integrated — and it
   cannot be sold at the telephony price.
3. **Not ConversationRelay**, unless C is being built for another reason, since
   it needs the same server C is.
4. **C when a named reason demands it**, and not before. It trades a per-minute
   bill for a deployment whose downtime is somebody's business phone.

The reasoning to argue with is step 1: it deliberately ships the smaller thing
first, on the grounds that the bigger one needs a price the owner has not set
and a concurrency limit nobody has confirmed.

---

## What this does not decide

1. **The AI receptionist's price.** The floor is derivable — 8.85 worst case at
   base rate, 16.85 at burst — but the price is a product decision.
2. **Whether 40 concurrent calls is enough**, and whether that limit is per
   account or per agent. Not stated on the pricing page; worth asking before
   selling, because as printed every customer shares it.
3. **What triggers burst pricing**, which doubles the agent cost.
4. **Whether `book_appointment` may run unattended.** Unchanged and still the
   owner's — and it bites hardest here, because an AI receptionist that cannot
   book an appointment is weaker than the competitor products that can.
