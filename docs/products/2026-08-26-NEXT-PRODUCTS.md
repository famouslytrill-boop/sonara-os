# The next fifteen products, and what each one costs us

Written 26 August 2026.

Review by: 2026-11-26

The brief was a long list of capabilities and one hard constraint: **it must cost
us nothing per customer, and be chargeable to the customer.** That constraint is
the useful part, and it does most of the sorting on its own.

Everything here is filtered through it, and through what already exists in this
repository. Each product names the modules it is built on, read out of `lib/` on
the date above rather than imagined.

## The rule this list is sorted by

A feature has zero marginal cost to us when it is one of exactly three things:

1. **Arithmetic over the customer's own rows.** Costs a CPU-millisecond inside a
   function invocation we are already paying for. This is what most of Business
   Builder already is.
2. **A file generated in-process.** `lib/sonara-zip.cjs`, `lib/sonara-qr-png.cjs`
   and `lib/sonara-calendar-invite.cjs` all write real formats with no
   dependency and no service.
3. **Work done in the customer's browser.** Cleared for adoption on
   26 August — see
   `docs/architecture/2026-08-26-BROWSER-INFERENCE-SECURITY-REVIEW.md`.

Anything that needs a GPU, a media pipeline, a phone number, an ingest server or
a third-party per-call API has a bill attached. Those are listed at the end,
honestly, rather than dressed up.

---

## Business Builder

| # | Product | Built on | Costs us | Customer pays |
| --- | --- | --- | --- | --- |
| 1 | **Point of sale, in-person** | `lib/sonara-connected-payments.cjs` + Stripe Terminal | Nothing. Stripe's per-transaction fee is charged on the business's own connected account, not ours. | Included in the plan; the business already pays Stripe |
| 2 | **RSVP and ticketed events** | `customer_bookings`, `lib/sonara-qr-png.cjs`, `lib/sonara-calendar-invite.cjs` | Nothing. A ticket is a row, a QR, and an `.ics` file, all generated in-process. | Plan tier |
| 3 | **Forecasting from their own history** | `customer_invoices`, `lib/sonara-invoice-settlement.cjs` | Nothing. Seasonality and cash-in projection are arithmetic over rows they already have. | Higher tier |
| 4 | **Offline-first local storage** | browser IndexedDB + existing record pages | Nothing. Storage is the customer's disk. | Included — it is a reliability feature, not an upsell |
| 5 | **A team of agents with an overseer** | `lib/sonara-agent-runner.cjs`, `-queue.cjs`, `-authority.cjs` | Nothing new. The gate, the queue and the log already exist. | Higher tier |

**On the agent team specifically**, because the brief asked for it directly. The
overseer already exists and is not a new idea here: `sonara-agent-authority.cjs`
classifies every action, seven categories require owner approval, seven named
actions may run unattended, and **the default is deny**. A refused run becomes a
row in `agent_pending_actions` that the owner approves on `/owner/agent-activity`,
and approving calls the same runner again with the approval attached rather than
bypassing the gate.

What is missing is not the overseer. It is *specialisation*: agents with distinct
task lists and distinct knowledge. `tools/agentkit` already does exactly that —
a coordinator with sub-agents, transfer between them, and now a credit model that
stops a run before it overspends. **The work is connecting agentkit's shape to
the deployed authority gate**, not inventing either.

**On point of sale**: this is the natural second half of the connected-payments
work that landed today. Stripe Terminal issues the card reader; the charge is
created on the connected account exactly as an online charge would be. Tap-to-pay
on a phone is the same path with different hardware. Square and Cash App are
alternatives to Stripe rather than additions — supporting a second processor
doubles the connected-account model for no new customer capability, and should
wait until a customer asks.

---

## Creator Studio

| # | Product | Built on | Costs us | Customer pays |
| --- | --- | --- | --- | --- |
| 1 | **Books, scripts and blueprints** | `creator_assets` + file upload + `lib/sonara-zip.cjs` | Nothing. Structure, versioning and export are rows and a ZIP. | Plan tier |
| 2 | **On-device drafting and rewriting** | Transformers.js on WebGPU | Nothing per use, once. Bandwidth to serve weights from our origin, paid once per device. | Included — this is the point |
| 3 | **Podcast and show notes** | `creator_assets` audio + `lib/sonara-whisper-adapter.cjs` | Nothing, when the owner runs Whisper. Per-minute if a hosted transcriber is used instead. | Plan tier |
| 4 | **Public profile and channel page** | `/creator/:handle`, `lib/sonara-scroll-site.cjs` | Nothing. Already a served page and a static ZIP export. | Included |
| 5 | **Rights and release packs** | `creator_rights`, `creator_releases`, voice permissions | Nothing. This is record-keeping, which is what the tables are. | Higher tier |

**On the on-device model**, which is the one that changes the economics: the
security review cleared Transformers.js on four conditions, and the binding one
is that weights are served from our own origin so `connect-src` is not widened.
That makes bandwidth the cost, paid once per device, rather than a per-token bill
that grows for ever.

**What Creator Studio still cannot do at zero cost**: generate images, video or
music. Every one of those needs a GPU somebody rents. Higgsfield's answer is
expiring credits at $19/$59/$129 a month, and that is the only honest shape for
it here too — a credit pack whose price covers the GPU bill, not an included
feature. `tools/agentkit/agentkit/credits.py` is now the accounting model for
exactly that, and it was written with this in mind: integer micro-credits,
expiry, soonest-expiring spent first.

---

## Growth Studio

| # | Product | Built on | Costs us | Customer pays |
| --- | --- | --- | --- | --- |
| 1 | **Profile-count pruning** | `growth_contacts`, provider registry | Nothing. Segmenting a list is arithmetic. | Higher tier — and it pays for itself |
| 2 | **Consent ledger and proof** | existing per-contact consent records | Nothing. Already recorded before dispatch. | Included |
| 3 | **On-device copy assistance** | Transformers.js, as above | Nothing per use | Included |
| 4 | **Referral and review requests** | `growth_touchpoints`, QR, shareable links | Nothing. A referral link is a token and a page. | Plan tier |
| 5 | **Attribution the customer can audit** | `growth_conversions` | Nothing. The figures are provider-reported and already carry their reporting window. | Higher tier |

**Product 1 is the strongest commercial idea in this document**, and it comes
straight from a dated market fact: in February 2025 Klaviyo changed from billing
on *emailed* contacts to billing on *total active profiles*, so anyone holding a
large unengaged list pays for contacts they never mail — $150/month at 10,000
profiles, $720 at 50,000.

A control plane that prunes and segments before the profile count is billed is
selling a measurable saving against an invoice the customer can see. That is a
far better pitch than being cheaper, it is honest about what Growth Studio is
(it does not send — see `scripts/check-growth-studio-copy.mjs`), and it needs no
new infrastructure.

---

## What was asked for and cannot be free

Listed rather than quietly dropped, because a product list that omits these
implies they are coming.

| Asked for | Why it has a bill |
| --- | --- |
| Image, video and music generation | A GPU somebody rents. Priced as expiring credits or not at all. |
| Live streaming, OBS ingest, online radio, public access channel | An ingest server and egress bandwidth, running whether or not anybody watches. Bandwidth is the cost that scales with the audience, and it is the one that surprises people. |
| Game development (Unreal, Unity) | Not a web application. Unreal's licence also takes a royalty above a revenue threshold — a licence question before an engineering one. |
| 3D modelling and printing | Slicing is heavy compute; printing is hardware and a physical supply chain. |
| SMS, voice, phone answering | A telephony provider bills per message and per minute. This is the gap against Jobber's AI Receptionist and Housecall Pro's Voice, and it cannot be closed for free. |
| Meta payment terminal | Hardware plus a processor relationship. Stripe Terminal is the same product with a partner we already have. |

None of these is refused. Each needs a price attached before it is built, and
the credit model now exists to attach one.

---

## The order

1. **Point of sale** — the second half of work that landed today, and the thing
   contractors actually switch software for.
2. **Profile-count pruning** — no new infrastructure, and it sells against a
   number the customer can read off someone else's invoice.
3. **On-device drafting** — turns "our AI costs us money per customer" into
   "it does not". Cleared by the security review; needs a model chosen and
   measured.
4. **The agent team** — connect agentkit's specialisation to the deployed
   authority gate. Both halves exist.
5. **RSVP and ticketing** — QR, `.ics` and bookings are all already written.

Everything below that waits for a customer to ask.
